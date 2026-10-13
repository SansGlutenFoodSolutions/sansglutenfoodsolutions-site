# SGFS — commandes et facturation automatique (préparation, NON déployé)

Le module reste dans la branche `feature/commande-sgfs-shine` et ne doit pas être fusionné pour le moment.

## Parcours prévu
- Demande du client : `en_attente_confirmation`, aucun e-mail de facture.
- Confirmation **côté serveur** du paiement et passage atomique de la commande vers `status: "validee"`, `paymentStatus: "paid"`, `paymentVerifiedBy: "server"`.
- Une facture PDF numérotée `SGFS-AAAA-000001` est produite pour le panier à **7,90 € TTC/sachet**, frais de port en sus.
- Envoi séparé du même PDF au client (adresse saisie) et au dirigeant à `benoit.rey@sansglutenfoodsolutions.com` ; le mail dirigeant comprend aussi la notification de commande validée.
- Registre d'émission `order_notifications` et compteur annuel `internal_counters`. L'envoi ne démarre pas sans données et paramètres comptables valides.

## À impérativement terminer AVANT mise en service
1. **Connecter le prestataire d'encaissement Shine** côté serveur : la saisie client ne doit jamais pouvoir déclarer elle-même une commande payée. Il n'y a pas encore de paiement connecté.
2. Renseigner et vérifier les vrais identifiants de la SAS (`SGFS_SIREN`, `SGFS_VAT_NUMBER`), ainsi que les taux validés du produit et du port (`SGFS_PRODUCT_VAT_BPS`, `SGFS_SHIPPING_VAT_BPS` en points de base, ex. 550 = 5,50 %). Le capital/adresse figurant dans le PDF doivent être contrôlés.
3. Configurer Resend (expéditeur `commandes@sansglutenfoodsolutions.com` domaine vérifié ; clé secrète Firebase `RESEND_API_KEY`) ; activer la facturation Firebase Blaze si nécessaire. Déployer les fonctions et les règles avec tests.
4. Compléter facture : adresse de **facturation distincte**, SIREN client professionnel, conditions de vente, date de livraison/acompte, mentions réglementaires adaptées. Le formulaire actuel ne recueille qu'une adresse de livraison.
5. **Archivage durable du PDF émis**, mécanisme de reprise contrôlée des e-mails échoués, correction par avoir et jamais par écrasement, prévention des trous de séquence, tests TVA et arrondis.
6. Si commandes B2B françaises après l'entrée en vigueur applicable, utiliser une **plateforme agréée** pour la facturation électronique : un simple PDF e-mail ne suffit pas à satisfaire cette obligation.
7. Prévoir authentification et interface admin pour valider/consulter les commandes ; les données doivent rester privées.

Le code est une **préparation non testée en production**, pas un service fonctionnel. Aucun mail n'est effectivement envoyé tant qu'il n'est pas déployé et configuré.
