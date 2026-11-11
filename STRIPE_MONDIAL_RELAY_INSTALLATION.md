# SGFS — passage de Colissimo/virement à Mondial Relay + Stripe

Cette branche est une préparation **non publiée** : ne pas fusionner tant que les accès et les tests manquent. Le site actuel doit rester fonctionnel.

## Pré-requis
1. Ouvrir ou vérifier le compte **Stripe professionnel de la SAS Sans Gluten Food Solutions** et enregistrer le compte de versement Shine. Récupérer la clé secrète via le tableau de bord Stripe ; ne jamais la mettre dans GitHub ni dans le HTML.
2. Ouvrir un compte **Mondial Relay professionnel** et récupérer le **code enseigne** destiné au widget. Valider la prise en charge du carton de 6 sachets et des Lockers/Points Relais.
3. Fixer le **prix TTC facturé au client** pour le transport, en tenant compte du poids réel du carton emballé et des frais, puis le convertir en centimes.
4. Activer la facturation Firebase nécessaire aux Cloud Functions/Secret Manager ; autoriser l'accès à Firestore pour le compte de service.
5. Configurer localement `functions/.env` (ne pas le committer) avec `MONDIAL_RELAY_BRAND=...` et `MON_DIAL_RELAY_SHIPPING_CENTS=...` et déposer les deux secrets :
   `firebase functions:secrets:set STRIPE_SECRET_KEY`
   `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`
6. `cd functions && npm install` puis revenir à la racine et `firebase deploy --only functions`.
7. Dans le tableau de bord Stripe, créer l'endpoint webhook :
   `https://europe-west1-sans-gluten-food-solutions.cloudfunctions.net/stripeWebhook`
   événement `checkout.session.completed`. **Configurer le secret webhook avant déploiement final**, puis redéployer si nécessaire.
8. Effectuer des tests de bout en bout en **mode Stripe test**, avec un Point Relais réel : sélection, affichage du prix, échec et succès carte, webhook signé, commande payée en Firestore, mail/gestion du colis, contrôle de remboursement.
9. Basculer vers la **clé Stripe live**, reconfigurer le webhook live et tester, puis fusionner la branche et vérifier la publication GitHub Pages sur le domaine public.

## Fonctionnement
- Page commande : carton unique à **44,90 € TTC** + livraison Mondial Relay uniquement.
- Le client sélectionne un Point Relais via le widget officiel, puis paie sur Stripe Checkout.
- Le prix et la référence commande sont calculés côté serveur ; aucune clé Stripe secrète n'est dans le navigateur.
- Le webhook Stripe enregistre seulement les commandes **payées** dans `sgfs_orders` de Firestore. La création des étiquettes et la facturation restent **manuelles** ; elles ne sont pas encore automatisées.
- Le compte Stripe doit activer les reçus clients si souhaité. Un système d'e-mail de notification au vendeur reste à ajouter si besoin.

## Réversibilité
La branche ne modifie pas `main`. Tant qu'elle n'est pas fusionnée, le formulaire Colissimo/virement reste public.
