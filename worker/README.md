# Boutique SGFS — Stripe + Mondial Relay

Le parcours client préparé dans cette branche comprend recherche des points relais, validation de l'option Mondial Relay auprès de Sendcloud, paiement Stripe Checkout et traitement du webhook signé. La page de commande de la branche principale reste en pré-lancement et cette branche ne doit pas être publiée avant configuration, contrôles et activation volontaire de la boutique.

## Parcours

- Carton de 6 sachets de 500 g : 43,28 € TTC.
- Mondial Relay : 6,71 € TTC par carton ; total affiché : 49,99 € TTC par carton.
- Expédition d'un colis de 34 × 15 × 16 cm et 3,5 kg par carton ; quantité maximale actuelle : 20.
- La cotation Sendcloud est calculée sur **un seul carton** même pour une commande de plusieurs cartons, car chaque carton est expédié avec sa propre étiquette (pas de multicollo).
- La commande est enregistrée dans Cloudflare D1 avant de retourner l'acheteur vers Stripe.
- Stripe Checkout confirme le paiement via `POST /stripe-webhook` avec vérification HMAC de `Stripe-Signature`.
- Après paiement, le Worker crée une expédition et son étiquette Sendcloud v3 par carton, puis garde les références de suivi dans D1.
- Chaque numéro de colis est réservé en base avant l'appel d'annonce Sendcloud. Les réponses incertaines et tentatives simultanées ne déclenchent **aucune nouvelle étiquette automatique** : un contrôle manuel est nécessaire pour éviter une double facturation. Sendcloud reçoit aussi un `external_reference_id` unique par carton pour sa propre protection contre les doublons.
- La sélection du mode de transport utilise le filtre Sendcloud `to_service_point_id` pour ne retenir que les options compatibles avec le relais choisi.
- Le retour navigateur ne confirme jamais à lui seul un paiement. `GET /order-status?session_id=...` fournit uniquement l'état et le suivi.

## Accès privé sans abonnement supplémentaire

- Le Worker sert les fichiers statiques du parcours de commande depuis `worker/static/` et bloque la page ainsi que les routes de recherche, de cotation, de paiement et de suivi sans session.
- La connexion utilise le secret Cloudflare `PRIVATE_SHOP_PASSWORD` (mot de passe d'au moins 10 caractères) et un cookie `HttpOnly`, `Secure`, `SameSite=Strict` valable 8 heures. Le secret reste côté Worker et ne doit pas être placé dans le site statique.
- Le site Firebase redirige `/commander` vers la page du Worker : la page statique ne doit pas être publiée par le site public. La page publique ne contient qu'une redirection vers le Worker, et les vrais fichiers de commande restent dans `worker/static/`, hors de `public/`..
- Pour activer cette protection, ajouter `PRIVATE_SHOP_PASSWORD` dans les secrets du Worker, puis déployer avec les assets configurés par Wrangler. Tant que ce secret manque, la page et l'API restent fermées.

## Configuration requise avant activation

1. Déployer le Worker depuis `worker/` avec Wrangler après avoir configuré l'asset binding dans `wrangler.toml`; renseigner le secret `PRIVATE_SHOP_PASSWORD` dans Cloudflare. Ne jamais le committer au dépôt.
2. Créer la base D1 `sgfs-orders`, exécuter `migrations/0001_orders.sql`, puis copier son identifiant réel dans `wrangler.toml` et lier le binding `DB` au Worker Cloudflare.
3. Configurer les secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDCLOUD_PUBLIC_KEY`, `SENDCLOUD_SECRET_KEY`. `SENDCLOUD_SENDER_ADDRESS_ID` est facultatif : sans lui, l’adresse complète SGFS enregistrée dans Sendcloud est utilisée. Garder `STRIPE_PRICE_ID` dans une variable Cloudflare non secrète.
4. Dans Stripe, créer le webhook live `https://sgfs-checkout.sgfs-benoit-rey.workers.dev/stripe-webhook` pour `checkout.session.completed` et `checkout.session.async_payment_succeeded`, puis enregistrer son secret de signature dans Cloudflare.
5. Confirmer que le contrat Mondial Relay Sendcloud est vérifié et que le service choisi supporte les points relais et les dimensions/poids déclarés. Les tarifs estimés Sendcloud ne remplacent pas les tarifs facturés au compte.
6. Laisser `CHECKOUT_ENABLED=false` tant que les essais ne sont pas validés et que la boutique doit rester cachée. Seul `CHECKOUT_ENABLED=true` ouvre la création de sessions de paiement.
7. Comparer le prix, la TVA et la ligne de livraison avec le comptable. Le prix du produit doit rester un prix Stripe one-time, EUR, 4 328 centimes, taxes incluses.
8. Vérifier en mode Stripe test et contrat/carrier de test la recherche, les prix, les webhooks signés, les événements en double, le retour navigateur, l'étiquette et les erreurs. Ne pas créer d'étiquette réelle ni effectuer de paiement réel pendant cette recette.
9. Garder le formulaire de commande non publié jusqu'au lancement.

## Protection des données

D1 conserve les coordonnées client, le point relais, les identifiants de paiement, les événements Stripe et le suivi d'expédition afin de traiter et suivre une commande. Restreindre l'accès au compte Cloudflare, définir une durée de conservation et refléter ce traitement dans la politique de confidentialité avant d'activer la prise de commande.

## Routes

- `GET /health` : statut de configuration (sans valeur de secret).
- `GET /service-points?postal_code=13000&city=Marseille` : points Mondial Relay en France. La page demande le code postal **et** la ville, car certaines recherches par code postal seul peuvent ne retourner aucun point.
- `POST /shipping-option` : revalide l'option Sendcloud compatible.
- `POST /checkout` : contrôle à nouveau point relais, option et prix Stripe, puis crée la session.
- `POST /stripe-webhook` : vérifie la signature Stripe et ne traite que les paiements réussis.
- `GET /order-status?session_id=cs_...` : état non sensible et suivi éventuel.

Les secrets ne doivent jamais figurer dans le dépôt ni dans les fichiers statiques Firebase.

## Vérification du 14 novembre 2026

- Ajout du verrou indépendant `FULFILLMENT_ENABLED=false` : aucune annonce/étiquette Sendcloud tant que ce verrou est fermé. Un webhook payé reçoit alors HTTP 503 afin de permettre sa reprise après activation ; vérifier les événements en attente avant lancement.
- Le checkout exige un secret webhook configuré et refuse le prix provisoire `DISABLED_UNTIL_LAUNCH`.
- Le webhook contrôle aussi la devise EUR et accepte plusieurs signatures v1 lors de la rotation du secret Stripe.
- Tests locaux avec réseau interdit : paiement fermé, configuration incomplète refusée, achat d’étiquette bloqué, signatures valides/multiples/altérées/expirées, bornes de quantité, totaux 1/2/20 cartons. Tous passés ; aucun appel externe.
- Ces tests ne valident pas les comptes Live, le déploiement Cloudflare, les tables D1 distantes ni le contrat Sendcloud. Leur contrôle reste nécessaire.
- Avant ouverture décidée par Benoît : résoudre les conflits avec main sans écraser le site public, terminer la recette en environnement test, vérifier le prix Live, les secrets, D1 et le contrat, puis activer volontairement les deux verrous et publier la page.
