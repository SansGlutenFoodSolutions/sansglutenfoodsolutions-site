# Boutique SGFS — Stripe + Mondial Relay

Le parcours client préparé dans cette branche comprend recherche des points relais, validation de l'option Mondial Relay auprès de Sendcloud, paiement Stripe Checkout et traitement du webhook signé. La page de commande de la branche principale reste en pré-lancement et cette branche ne doit pas être publiée avant configuration, contrôles et activation volontaire de la boutique.

## Parcours

- Carton de 6 sachets de 500 g : 43,28 € TTC.
- Mondial Relay : 6,71 € TTC par carton ; total affiché : 49,99 € TTC par carton.
- Expédition d'un colis de 34 × 15 × 16 cm et 3,5 kg par carton ; quantité maximale actuelle : 20.
- La commande est enregistrée dans Cloudflare D1 avant de retourner l'acheteur vers Stripe.
- Stripe Checkout confirme le paiement via `POST /stripe-webhook` avec vérification HMAC de `Stripe-Signature`.
- Après paiement, le Worker crée une expédition et son étiquette Sendcloud v3 par carton, puis garde les références de suivi dans D1.
- Le retour navigateur ne confirme jamais à lui seul un paiement. `GET /order-status?session_id=...` fournit uniquement l'état et le suivi.

## Configuration requise avant activation

1. Créer la base D1 `sgfs-orders`, exécuter `migrations/0001_orders.sql`, puis copier son identifiant réel dans `wrangler.toml` et lier le binding `DB` au Worker Cloudflare.
2. Configurer les secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDCLOUD_PUBLIC_KEY`, `SENDCLOUD_SECRET_KEY`, `SENDCLOUD_SENDER_ADDRESS_ID`. Garder `STRIPE_PRICE_ID` dans une variable Cloudflare non secrète.
3. Dans Stripe, créer le webhook live `https://sgfs-checkout.sgfs-benoit-rey.workers.dev/stripe-webhook` pour `checkout.session.completed` et `checkout.session.async_payment_succeeded`, puis enregistrer son secret de signature dans Cloudflare.
4. Confirmer que le contrat Mondial Relay Sendcloud est vérifié et que le service choisi supporte les points relais et les dimensions/poids déclarés. Les tarifs estimés Sendcloud ne remplacent pas les tarifs facturés au compte.
5. Comparer le prix, la TVA et la ligne de livraison avec le comptable. Le prix du produit doit rester un prix Stripe one-time, EUR, 4 328 centimes, taxes incluses.
6. Vérifier en mode Stripe test et contrat/carrier de test la recherche, les prix, les webhooks signés, les événements en double, le retour navigateur, l'étiquette et les erreurs. Ne pas créer d'étiquette réelle ni effectuer de paiement réel pendant cette recette.
7. Garder le formulaire de commande non publié jusqu'au lancement.

## Protection des données

D1 conserve les coordonnées client, le point relais, les identifiants de paiement, les événements Stripe et le suivi d'expédition afin de traiter et suivre une commande. Restreindre l'accès au compte Cloudflare, définir une durée de conservation et refléter ce traitement dans la politique de confidentialité avant d'activer la prise de commande.

## Routes

- `GET /health` : statut de configuration (sans valeur de secret).
- `GET /service-points?postal_code=13000` : points Mondial Relay en France.
- `POST /shipping-option` : revalide l'option Sendcloud compatible.
- `POST /checkout` : contrôle à nouveau point relais, option et prix Stripe, puis crée la session.
- `POST /stripe-webhook` : vérifie la signature Stripe et ne traite que les paiements réussis.
- `GET /order-status?session_id=cs_...` : état non sensible et suivi éventuel.

Les secrets ne doivent jamais figurer dans le dépôt ni dans les fichiers statiques Firebase.
