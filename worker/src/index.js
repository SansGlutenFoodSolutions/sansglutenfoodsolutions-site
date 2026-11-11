// Worker Cloudflare : recherche de points relais et session Stripe sécurisée.
// Ne contient aucune clé secrète. Il n'expédie pas de colis automatiquement.
const SITE = 'https://sansglutenfoodsolutions.com';
const GOODS_CENTS = 4328;
const DELIVERY_CENTS = 671;

function json(data, status = 200, origin = SITE) {
  return new Response(JSON.stringify(data), {
    status, headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    }
  });
}
function isPostal(v) { return typeof v === 'string' && /^[0-9]{5}$/.test(v); }
function isQuantity(v) { return Number.isInteger(v) && v >= 1 && v <= 99; }
function short(v, max = 120) { return String(v || '').trim().slice(0, max); }
function validateEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 250; }
async function stripeRequest(env, path, options = {}) {
  const response = await fetch('https://api.stripe.com/v1/' + path, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
      ...(options.body ? {'Content-Type': 'application/x-www-form-urlencoded'} : {})
    }
  });
  const body = await response.json();
  if (!response.ok) throw new Error('Stripe a refusé la demande (' + response.status + ')');
  return body;
}
async function findPoints(env, postal, city) {
  if (!env.SENDCLOUD_PUBLIC_KEY || !env.SENDCLOUD_SECRET_KEY) throw new Error('Sendcloud non configuré');
  const u = new URL('https://panel.sendcloud.sc/api/v3/service-points');
  u.searchParams.set('country_code', 'FR');
  // L'intégration Sendcloud SGFS est paramétrée avec Mondial Relay uniquement.
  u.searchParams.set('use_integration_carriers', 'true');
  u.searchParams.set('address_postal_code', postal);
  if (city) u.searchParams.set('address_city', city);
  u.searchParams.set('radius', '20000');
  u.searchParams.set('limit', '30');
  const response = await fetch(u, {
    headers: {'Authorization': 'Basic ' + btoa(env.SENDCLOUD_PUBLIC_KEY + ':' + env.SENDCLOUD_SECRET_KEY)}
  });
  if (!response.ok) throw new Error('Sendcloud indisponible (' + response.status + ')');
  const payload = await response.json();
  const entries = payload?.data?.results;
  if (!Array.isArray(entries)) throw new Error('Réponse Sendcloud non reconnue');
  return entries
    .filter(p => p?.id && p?.address?.country_code === 'FR' && !p.is_expired)
    .filter(p => /mondial/i.test(String(p?.carrier?.name || '') + ' ' + String(p?.carrier?.code || '') + ' ' + String(p?.operating_carrier?.name || '')))
    .map(p => ({
      id: String(p.id), name: short(p.name),
      address: short([p.address.street, p.address.house_number].filter(Boolean).join(' ')),
      postal_code: short(p.address.postal_code, 12), city: short(p.address.city, 100),
      kind: p.general_shop_type === 'locker' ? 'locker' : 'point_relais',
      carrier: String(p?.carrier?.code || '')
    }));
}
async function handleCheckout(request, env) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) return json({message:'Paiement en cours de configuration'},503);
  let input;
  try { input = await request.json(); } catch { return json({message:'Données invalides'},400); }
  const q = input.quantity, postal = input.postal_code, city = short(input.city,80);
  const first = short(input.customer?.first,80), last = short(input.customer?.last,80);
  const email = short(input.customer?.email,250), phone = short(input.customer?.phone,32);
  const relayId = short(input.service_point_id,30);
  if (!isQuantity(q) || !isPostal(postal) || !first || !last || !phone || !validateEmail(email) || !relayId) {
    return json({message:'Vérifiez la quantité, vos coordonnées et le point relais.'},400);
  }
  let relay;
  try {
    const points = await findPoints(env,postal,city);
    relay = points.find(p => p.id === relayId);
  } catch { return json({message:'Le point relais ne peut pas être vérifié. Réessayez.'},503); }
  if (!relay) return json({message:'Ce point relais n’est plus disponible. Sélectionnez-en un autre.'},422);
  // Vérifier que le tarif Stripe utilisé est bien celui créé pour 1 carton (43,28 € TTC).
  let price;
  try { price = await stripeRequest(env, 'prices/' + encodeURIComponent(env.STRIPE_PRICE_ID)); }
  catch { return json({message:'Le tarif Stripe est indisponible pour le moment.'},503); }
  if (!price.active || price.currency !== 'eur' || price.unit_amount !== GOODS_CENTS || price.type !== 'one_time' || price.tax_behavior !== 'inclusive') {
    return json({message:'Le tarif du carton ne correspond pas au prix SGFS validé.'},503);
  }
  const ref = 'SGFS-' + crypto.randomUUID().slice(0,12).toUpperCase();
  const params = new URLSearchParams();
  params.set('mode','payment');
  params.set('client_reference_id',ref);
  params.set('customer_email',email);
  params.set('success_url',SITE + '/commander/succes?session_id={CHECKOUT_SESSION_ID}');
  params.set('cancel_url',SITE + '/commander');
  params.set('automatic_tax[enabled]','true');
  params.set('billing_address_collection','required');
  params.set('phone_number_collection[enabled]','true');
  params.set('line_items[0][price]',env.STRIPE_PRICE_ID);
  params.set('line_items[0][quantity]',String(q));
  // La livraison est un POSTE distinct multiplié par le nombre de cartons.
  // Ne pas utiliser ici le Shipping Rate fixe du Dashboard Stripe : il ne multiplie pas le prix par carton.
  params.set('line_items[1][price_data][currency]','eur');
  params.set('line_items[1][price_data][unit_amount]',String(DELIVERY_CENTS));
  params.set('line_items[1][price_data][tax_behavior]','inclusive');
  params.set('line_items[1][price_data][product_data][name]','Livraison Mondial Relay – 1 carton');
  params.set('line_items[1][price_data][product_data][tax_code]','txcd_92010001');
  params.set('line_items[1][quantity]',String(q));
  const metadata = {
    'sgfs_order_ref':ref, 'cartons':String(q), 'relay_id':relay.id,
    'relay_name':relay.name, 'relay_address':short(relay.address + ', ' + relay.postal_code + ' ' + relay.city,230),
    'relay_type':relay.kind, 'phone':phone,
    'customer_name':short(first + ' ' + last,160)
  };
  for (const [k,v] of Object.entries(metadata)) params.set('metadata['+k+']',v);
  for (const k of ['sgfs_order_ref','cartons','relay_id']) params.set('payment_intent_data[metadata]['+k+']',metadata[k]);
  try {
    const session = await stripeRequest(env,'checkout/sessions',{method:'POST',body:params});
    if (!/^https:\/\/checkout\.stripe\.com\//.test(session.url||'')) throw new Error('URL Stripe absente');
    return json({url:session.url});
  } catch { return json({message:'Le paiement Stripe ne peut pas démarrer. Réessayez.'},503); }
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && origin !== SITE && origin !== 'https://www.sansglutenfoodsolutions.com') {
      return json({message:'Origine non autorisée'},403);
    }
    if (request.method === 'OPTIONS') return json({},204,origin || SITE);
    if (u.pathname === '/health' && request.method === 'GET') return json({status:'ok',configured:!!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID && env.SENDCLOUD_PUBLIC_KEY && env.SENDCLOUD_SECRET_KEY)});
    if (u.pathname === '/service-points' && request.method === 'GET') {
      const postal = u.searchParams.get('postal_code'), city = short(u.searchParams.get('city'),80);
      if (!isPostal(postal)) return json({message:'Code postal français à 5 chiffres requis'},400);
      try { return json({service_points:await findPoints(env,postal,city)}); }
      catch { return json({message:'Recherche des points relais indisponible.'},503); }
    }
    if (u.pathname === '/checkout' && request.method === 'POST') return handleCheckout(request,env);
    return json({message:'Ressource introuvable'},404);
  }
};
