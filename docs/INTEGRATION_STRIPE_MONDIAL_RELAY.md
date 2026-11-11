# SGFS — Passage de Colissimo/virement à Mondial Relay/Stripe

Statut : **préparation uniquement**. Ne pas déployer une commande payante tant que les prérequis ci-dessous ne sont pas satisfaits.

## Configuration existante vérifiée
- Site statique Firebase Hosting, forfait Spark. `firebase.json` sert `public/`.
- Page actuelle : `public/commander/index.html`.
- Vente : carton de 6 sachets 500 g à **44,90 € TTC**, et non un sachet à l'unité.
- Expédition : **Colissimo 17,39 €** sur la page actuelle.
- Paiement : **virement bancaire Shine**, demande transmise par **FormSubmit**.
- La page `public/commander-v2/index.html` est une prévisualisation, **sans collecte de données et sans paiement**.

## Architecture cible sans facturation Google Cloud
1. Conserver Firebase Spark pour servir les pages HTML/CSS/JS.
2. Pour un parcours automatisé fiable, utiliser un backend HTTPS sécurisé **hors Firebase Functions** (choisir l'hébergeur et valider les coûts éventuels).
3. Le backend vérifie le catalogue et calcule les prix côté serveur (ne jamais faire confiance au montant navigateur).
4. Après sélection du Point Relais via le widget officiel de Mondial Relay, valider la sélection et les frais applicables via une API serveur ou une méthode contractuellement admise.
5. Le backend crée une session Stripe Checkout côté serveur pour le total de commande, frais de port compris ; le `checkout.session.id` doit servir à rapprocher la commande.
6. Un webhook Stripe **signé et vérifié** marque la commande payée (`checkout.session.completed`, en tenant compte des moyens de paiement asynchrones). Ne jamais prendre une page de retour comme preuve de paiement.
7. Créer l'expédition Mondial Relay / étiquette uniquement après paiement confirmé ; enregistrer l'identifiant Point Relais et l'expédition dans les données de commande, avec contrôle des doublons (idempotence).
8. Transmettre à SGFS la commande payée, la livraison et les données utiles à la facturation, en conformité avec la protection des données.

## Éléments manquants pour l'activation
- Confirmation de l'accès au compte Stripe SGFS et de son activation ; clé API **uniquement sur le backend sécurisé**, jamais dans GitHub ni dans le navigateur.
- Compte pro Mondial Relay, identifiants d'intégration, contrat et grille tarifaire tenant compte du poids du carton et de l'emballage.
- Choix d'un hébergement backend qui ne requiert **aucun compte de facturation Google Cloud**, avec examen de ses propres tarifs.
- Validation des zones desservies, conditions de vente, expéditions et politique de confidentialité.

## Sécurité / production
- Ne pas envoyer les informations d'une commande par FormSubmit puis rediriger vers un lien Stripe statique : risque de paiement non rapproché et d'expédition erronée.
- Ne pas mettre de secret Stripe ou Mondial Relay dans le JavaScript public ou le dépôt.
- Ne pas fusionner et remplacer la page actuelle avant test de bout en bout en mode Stripe test (paiement, webhook, commande, relais, annulation/échec, prix réel du port).
- Maintenir `main` inchangé jusqu'à validation.
