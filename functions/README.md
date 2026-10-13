# Notifications e-mail SGFS (non déployées)
Le module envoie **un e-mail au dirigeant à la première transition du statut Firestore `orders/{id}.status` vers `validee`**. Une simple demande `en_attente_confirmation` n'envoie rien. La validation doit être réservée à un administrateur authentifié. La preuve de paiement est à intégrer au futur prestataire de paiement (ne jamais valider à partir du navigateur client).

Destinataire configuré : `benoit.rey@sansglutenfoodsolutions.com`.

## Mise en service (à faire avant lancement)
1. Vérifier le domaine `sansglutenfoodsolutions.com` dans Resend et son expéditeur `commandes@`; créer la clé API côté serveur.
2. Activer la facturation du projet Firebase (Cloud Functions nécessite généralement le forfait Blaze). Ne jamais placer la clé API dans le site public ou GitHub.
3. Dans le projet Firebase : `firebase functions:secrets:set RESEND_API_KEY`, puis `npm install --prefix functions`.
4. Déployer `firebase deploy --only functions,firestore:rules` après validation des règles et tests.
5. Tester avec une commande de démonstration : statut `en_attente_confirmation` (aucun email), passage par un admin vers `validee` (un mail), revalidation (aucun second mail).
6. Contrôler `order_notifications/{id}` : `sent` ou `error`; surveiller les échecs d'envoi. Le mécanisme reste désactivé tant qu'il n'est pas déployé.

**Important** : paiement en ligne Shine/PSP non encore connecté ; ne pas activer une validation automatique avant confirmation serveur du paiement. Le montant du produit est 7,90 € TTC/sachet et les frais de transport restent à calculer.
