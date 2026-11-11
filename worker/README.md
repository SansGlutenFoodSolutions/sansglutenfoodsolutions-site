# SGFS : paiement Stripe et Mondial Relay (brouillon)

Cette branche est un brouillon NON publié. Ne pas fusionner avant les tests et la mise en place de la confirmation des paiements.

## Parcours et prix
- Cartons de 6 sachets de 500 g, quantité 1 à 99.
- Mix BIO : 43,28 euros TTC x quantité.
- Livraison Point Relais ou Locker Mondial Relay : 6,71 euros TTC x quantité. Chaque carton est un colis distinct.
- Total : 49,99 euros TTC x quantité.
- Le site recherche les points relais par code postal avec Sendcloud Service Points API v3.
- Le Worker revalide le point relais et le prix Stripe, puis crée une session Stripe Checkout. Aucune clé secrète n'est exposée au navigateur.

## Connexion technique sans compte de facturation Google Cloud
Le site reste hébergé sur Firebase Hosting statique. Le service privé Stripe/Sendcloud tourne séparément sur Cloudflare Workers Free (compte requis).
1. Créer un compte Cloudflare puis déployer le dossier worker avec Wrangler.
2. Configurer dans les secrets Cloudflare : STRIPE_SECRET_KEY (d'abord la clé TEST), STRIPE_PRICE_ID (le prix Stripe du produit à 43,28 EUR, paiement ponctuel et taxes incluses), SENDCLOUD_PUBLIC_KEY, SENDCLOUD_SECRET_KEY.
3. Une fois l'URL du Worker obtenue, renseigner uniquement cette URL publique dans public/sgfs-checkout-config.js, sans aucune clé secrète.
4. Tester GET /health, GET /service-points?postal_code=13000 et POST /checkout avec 1, 2 et 3 cartons.
5. En mode test Stripe, contrôler les totaux 49,99 EUR, 99,98 EUR et 149,97 EUR ainsi que la TVA. Le prix du carton existant doit être inclusif.
6. Mettre en place un webhook Stripe signé et un suivi durable des commandes avant ouverture au public. Le retour navigateur ne confirme jamais, à lui seul, le règlement.
7. Ajouter l'import des commandes payées et la génération d'une étiquette Sendcloud v3 par carton. Ce brouillon ne crée pas encore d'étiquettes et ne synchronise pas les commandes vers Sendcloud.
8. Vérifier les frais de transaction Stripe, la comptabilité des frais de livraison et les suppléments de transport éventuels.
9. Après ces vérifications, fusionner dans main et déployer Firebase.

## Précisions
- La ligne livraison est multipliée par le nombre de cartons dans Stripe Checkout. Le Shipping Rate fixe créé dans Stripe n'est pas employé car il ne se multiplie pas automatiquement.
- Le taux de TVA Stripe de la ligne de livraison est calculé automatiquement à partir du code taxe expédition : vérifier le résultat avec un paiement de TEST et le comptable avant toute mise en production.
- La tranche Sendcloud 3–5 kg était estimée à 5,59 EUR HT / 6,71 EUR TTC ; les suppléments et le poids réel restent à contrôler.
- Ne pas stocker la clé secrète Stripe ni la clé secrète Sendcloud dans GitHub ou dans le code Firebase public.

## Documentation
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/payments/checkout/fulfillment
- https://sendcloud.dev/api/v3/service-points/retrieve-a-list-of-service-points
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/configuration/secrets/
