const SITE = 'https://sansglutenfoodsolutions.com';
const GOODS_CENTS = 4328;
const DELIVERY_CENTS = 671;
const CARTON_WEIGHT_KG = '3.500';
const DIMENSIONS_CM = {length:'34', width:'15', height:'16'};

function json(data,status=200,origin=SITE){
  return new Response(JSON.stringify(data),{status,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, Stripe-Signature','Vary':'Origin'
  }});
}
function isPostal(v){return typeof v==='string' && /^[0-9]{5}$/.test(v);}
function isQuantity(v){return Number.isInteger(v) && v>=1 && v<=20;}
function short(v,max=120){return String(v||'').trim().slice(0,max);}
function validateEmail(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&s.length<=250;}
function sendcloudAuth(env){return 'Basic '+btoa(env.SENDCLOUD_PUBLIC_KEY+':'+env.SENDCLOUD_SECRET_KEY);}
async function stripeRequest(env,path,options={}){
 const response=await fetch('https://api.stripe.com/v1/'+path,{...options,headers:{
  'Authorization':'Bearer '+env.STRIPE_SECRET_KEY,...(options.body?{'Content-Type':'application/x-www-form-urlencoded'}:{})
 }});
 const body=await response.json();
 if(!response.ok) throw new Error('Stripe '+response.status);
 return body;
}
async function findPoints(env,postal,city){
 const u=new URL('https://panel.sendcloud.sc/api/v3/service-points');
 for(const [k,v] of Object.entries({country_code:'FR',use_integration_carriers:'true',address_postal_code:postal,radius:'20000',limit:'30'}))u.searchParams.set(k,v);
 if(city)u.searchParams.set('address_city',city);
 const r=await fetch(u,{headers:{Authorization:sendcloudAuth(env)}});
 if(!r.ok)throw new Error('Sendcloud service points '+r.status);
 const data=(await r.json())?.data?.results;
 if(!Array.isArray(data))throw new Error('Invalid service point response');
 return data.filter(p=>p?.id&&p?.address?.country_code==='FR'&&!p.is_expired)
  .filter(p=>/mondial/i.test(String(p?.carrier?.name||'')+' '+String(p?.carrier?.code||'')+' '+String(p?.operating_carrier?.name||'')))
  .map(p=>({id:String(p.id),name:short(p.name),address:short([p.address.street,p.address.house_number].filter(Boolean).join(' ')),
   postal_code:short(p.address.postal_code,12),city:short(p.address.city,100),
   kind:p.general_shop_type==='locker'?'locker':'point_relais',
   carrier:String(p?.carrier?.code||'mondialrelay'),country_code:'FR'}));
}
async function relayShippingOption(env,relay,quantity){
 const body={from_address:{country_code:'FR',postal_code:env.SENDCLOUD_FROM_POSTAL_CODE||'13960',city:env.SENDCLOUD_FROM_CITY||'Sausset-les-Pins'},
  to_address:{country_code:'FR',postal_code:relay.postal_code,city:relay.city},
  to_service_point:{id:relay.id},
  parcels:Array.from({length:quantity},()=>({weight:{value:CARTON_WEIGHT_KG,unit:'kg'},dimensions:{...DIMENSIONS_CM,unit:'cm'}}))};
 const r=await fetch('https://panel.sendcloud.sc/api/v3/shipping-options',{method:'POST',headers:{Authorization:sendcloudAuth(env),'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok)throw new Error('Sendcloud shipping options '+r.status);
 const data=(await r.json())?.data;
 if(!Array.isArray(data))throw new Error('Invalid shipping options response');
 const options=data.filter(o=>/mondial/i.test(String(o?.carrier?.name||'')+' '+String(o?.carrier?.code||'')+' '+String(o?.code||'')));
 const option=options.find(o=>o?.code);
 if(!option)throw new Error('Mondial Relay unavailable for this relay');
 return {code:String(option.code),name:short(option.name,100),carrier:String(option.carrier?.code||'mondialrelay')};
}
async function handleCheckout(request,env){
 if(env.CHECKOUT_ENABLED!=='true')return json({message:'La boutique en ligne est temporairement fermée.'},503);
 if(!env.DB||!env.STRIPE_SECRET_KEY||!env.STRIPE_PRICE_ID)return json({message:'Le paiement est en cours de configuration.'},503);
 let input;try{input=await request.json();}catch{return json({message:'Données invalides.'},400);}
 const q=input.quantity,postal=input.postal_code,city=short(input.city,80);
 const first=short(input.customer?.first,80),last=short(input.customer?.last,80);
 const email=short(input.customer?.email,250),phone=short(input.customer?.phone,32),relayId=short(input.service_point_id,30);
 const optionCode=short(input.shipping_option_code,160);
 if(!isQuantity(q)||!isPostal(postal)||!first||!last||!phone||!validateEmail(email)||!relayId||!optionCode)
  return json({message:'Vérifiez la quantité, vos coordonnées et le point relais.'},400);
 let relay,option;
 try{
  relay=(await findPoints(env,postal,city)).find(p=>p.id===relayId);
  if(!relay)return json({message:'Ce point relais n’est plus disponible. Sélectionnez-en un autre.'},422);
  option=await relayShippingOption(env,relay,q);
  if(option.code!==optionCode)return json({message:'Le mode d’expédition a changé. Choisissez de nouveau le point relais.'},422);
 }catch{return json({message:'Mondial Relay est momentanément indisponible. Réessayez.'},503);}
 let price;
 try{price=await stripeRequest(env,'prices/'+encodeURIComponent(env.STRIPE_PRICE_ID));}
 catch{return json({message:'Le tarif Stripe est indisponible.'},503);}
 if(!price.active||price.currency!=='eur'||price.unit_amount!==GOODS_CENTS||price.type!=='one_time'||price.tax_behavior!=='inclusive')
  return json({message:'Le tarif du carton ne correspond pas au prix validé.'},503);
 const ref='SGFS-'+crypto.randomUUID().slice(0,12).toUpperCase();
 const name=short(first+' '+last,160),total=(GOODS_CENTS+DELIVERY_CENTS)*q;
 const params=new URLSearchParams();
 params.set('mode','payment');params.set('client_reference_id',ref);params.set('customer_email',email);
 params.set('success_url',SITE+'/commander/succes?session_id={CHECKOUT_SESSION_ID}');
 params.set('cancel_url',SITE+'/commander');
 params.set('automatic_tax[enabled]','true');params.set('billing_address_collection','required');
 params.set('phone_number_collection[enabled]','true');
 params.set('line_items[0][price]',env.STRIPE_PRICE_ID);params.set('line_items[0][quantity]',String(q));
 params.set('line_items[1][price_data][currency]','eur');params.set('line_items[1][price_data][unit_amount]',String(DELIVERY_CENTS));
 params.set('line_items[1][price_data][tax_behavior]','inclusive');params.set('line_items[1][price_data][product_data][name]','Livraison Mondial Relay – 1 carton');
 params.set('line_items[1][quantity]',String(q));
 const metadata={sgfs_order_ref:ref,cartons:String(q),relay_id:relay.id,relay_name:relay.name,
  relay_address:short(relay.address+', '+relay.postal_code+' '+relay.city,230),relay_postal_code:relay.postal_code,
  relay_city:relay.city,relay_type:relay.kind,shipping_option_code:option.code,phone,customer_name:name};
 for(const [k,v] of Object.entries(metadata))params.set('metadata['+k+']',v);
 for(const k of ['sgfs_order_ref','cartons','relay_id','shipping_option_code'])params.set('payment_intent_data[metadata]['+k+']',metadata[k]);
 let session=null;
 try{
  session=await stripeRequest(env,'checkout/sessions',{method:'POST',body:params});
  if(!/^https:\/\/checkout\.stripe\.com\//.test(session.url||''))throw new Error('No Stripe checkout URL');
  await env.DB.prepare(`INSERT INTO orders(order_ref,checkout_session_id,status,quantity,amount_total,email,customer_name,phone,relay_id,relay_name,relay_address,relay_postal_code,relay_city,relay_type,shipping_option_code,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(ref,session.id,'awaiting_payment',q,total,email,name,phone,relay.id,relay.name,relay.address,relay.postal_code,relay.city,relay.kind,option.code,new Date().toISOString(),new Date().toISOString()).run();
  return json({url:session.url,total_cents:total,order_ref:ref});
 }catch(e){
  // If DB persistence failed after creating the Stripe Session, expire it to avoid an untracked payment.
  try{if(session?.id)await stripeRequest(env,'checkout/sessions/'+session.id+'/expire',{method:'POST'});}catch{}
  return json({message:'La commande n’a pas pu être enregistrée. Réessayez.'},503);
 }
}
async function verifyStripeSignature(raw,header,secret){
 if(!header||!secret)return false;
 const parts=Object.fromEntries(header.split(',').map(x=>x.split('=').map(v=>v.trim())));
 const t=Number(parts.t),sig=parts.v1;
 if(!Number.isFinite(t)||!sig||Math.abs(Date.now()/1000-t)>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw)));
 const expected=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 if(expected.length!==sig.length)return false;
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^sig.charCodeAt(i);
 return diff===0;
}
async function announcePaidOrder(env,order){
 const products=Array.from({length:order.quantity},(_,i)=>({
  order_number:order.order_ref+'-'+String(i+1).padStart(2,'0'),
  total_order_price:{currency:'EUR',value:((GOODS_CENTS+DELIVERY_CENTS)/100).toFixed(2)},
  to_address:{name:order.customer_name,email:order.email,phone_number:order.phone,country_code:'FR',
   postal_code:order.relay_postal_code,city:order.relay_city,address_line_1:order.relay_address},
  from_address:env.SENDCLOUD_SENDER_ADDRESS_ID
   ? {sender_address_id:Number(env.SENDCLOUD_SENDER_ADDRESS_ID)}
   : {name:'Sans Gluten Food Solutions',company_name:'Sans Gluten Food Solutions',
      address_line_1:'chemin de Bel Air',house_number:'3',
      postal_code:env.SENDCLOUD_FROM_POSTAL_CODE||'13960',
      city:env.SENDCLOUD_FROM_CITY||'Sausset-les-Pins',country_code:'FR',
      email:'contact@sansglutenfoodsolutions.com'},
  to_service_point:{id:order.relay_id},
  ship_with:{type:'shipping_option_code',properties:{shipping_option_code:order.shipping_option_code}},
  label_details:{mime_type:'application/pdf',dpi:72},
  parcels:[{weight:{value:CARTON_WEIGHT_KG,unit:'kg'},dimensions:{...DIMENSIONS_CM,unit:'cm'},
   parcel_items:[{item_id:'SGFS-MIX-500',description:'Mix Universel BIO SGFS – carton de 6 sachets',quantity:1,
    weight:{value:CARTON_WEIGHT_KG,unit:'kg'},price:{value:(GOODS_CENTS/100).toFixed(2),currency:'EUR'},sku:'SGFS-MIX-500'}]}]
 }));
 for(const parcel of products){
  await env.DB.prepare(`INSERT OR IGNORE INTO shipments(order_ref,parcel_number,status,created_at) VALUES(?,?,?,?)`)
   .bind(order.order_ref,parcel.order_number,'pending',new Date().toISOString()).run();
  const existing=await env.DB.prepare('SELECT status FROM shipments WHERE order_ref=? AND parcel_number=?').bind(order.order_ref,parcel.order_number).first();
  if(existing?.status==='created')continue;
  if(existing?.status==='error')throw new Error('Shipment requires manual verification before retry');
  try{
   const r=await fetch('https://panel.sendcloud.sc/api/v3/shipments/announce',{method:'POST',headers:{Authorization:sendcloudAuth(env),'Content-Type':'application/json'},body:JSON.stringify(parcel)});
   const body=await r.json();
   if(!r.ok)throw new Error('Sendcloud announcement '+r.status);
   const shipment=body?.data||body;
   await env.DB.prepare('UPDATE shipments SET status=?,sendcloud_id=?,tracking_number=?,tracking_url=?,label_url=?,updated_at=? WHERE order_ref=? AND parcel_number=?')
    .bind('created',String(shipment.id||''),String(shipment.tracking_number||''),String(shipment.tracking_url||''),String(shipment.label?.url||shipment.label_url||''),new Date().toISOString(),order.order_ref,parcel.order_number).run();
  }catch(e){
   await env.DB.prepare('UPDATE shipments SET status=?,error_code=?,updated_at=? WHERE order_ref=? AND parcel_number=?')
    .bind('error',short(e.message,200),new Date().toISOString(),order.order_ref,parcel.order_number).run();
   throw e;
  }
 }
 await env.DB.prepare('UPDATE orders SET status=?,updated_at=? WHERE order_ref=?').bind('paid_fulfilled',new Date().toISOString(),order.order_ref).run();
}
async function handleStripeWebhook(request,env){
 if(!env.DB||!env.STRIPE_WEBHOOK_SECRET)return json({message:'Webhook non configuré.'},503);
 const raw=await request.text();
 if(!await verifyStripeSignature(raw,request.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET))return json({message:'Signature invalide.'},400);
 let event;try{event=JSON.parse(raw);}catch{return json({message:'JSON invalide.'},400);}
 const id=short(event.id,120);
 if(!id)return json({message:'Événement invalide.'},400);
 const seen=await env.DB.prepare('SELECT status FROM stripe_events WHERE event_id=?').bind(id).first();
 if(seen?.status==='done')return json({received:true,duplicate:true});
 await env.DB.prepare('INSERT OR IGNORE INTO stripe_events(event_id,event_type,status,created_at) VALUES(?,?,?,?)').bind(id,short(event.type,100),'processing',new Date().toISOString()).run();
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){await env.DB.prepare('UPDATE stripe_events SET status=? WHERE event_id=?').bind('done',id).run();return json({received:true});}
 const session=event.data?.object;
 if(!session?.id)return json({message:'Session invalide.'},400);
 const order=await env.DB.prepare('SELECT * FROM orders WHERE checkout_session_id=?').bind(session.id).first();
 if(!order)return json({received:true,unmatched:true});
 if(session.payment_status!=='paid'){
  await env.DB.prepare('UPDATE orders SET status=?,updated_at=? WHERE order_ref=?').bind('payment_pending',new Date().toISOString(),order.order_ref).run();
  await env.DB.prepare('UPDATE stripe_events SET status=? WHERE event_id=?').bind('done',id).run();
  return json({received:true,pending:true});
 }
 if(Number(session.amount_total)!==order.amount_total)return json({message:'Montant invalide.'},400);
 await env.DB.prepare('UPDATE orders SET status=?,updated_at=? WHERE order_ref=?').bind('paid',new Date().toISOString(),order.order_ref).run();
 try{await announcePaidOrder(env,order);}
 catch{await env.DB.prepare('UPDATE orders SET status=?,updated_at=? WHERE order_ref=?').bind('paid_shipment_error',new Date().toISOString(),order.order_ref).run();await env.DB.prepare('UPDATE stripe_events SET status=? WHERE event_id=?').bind('needs_review',id).run();return json({received:true,paid:true,shipment_pending:true});}
 await env.DB.prepare('UPDATE stripe_events SET status=? WHERE event_id=?').bind('done',id).run();
 return json({received:true,paid:true,shipped:true});
}
async function handleOrderStatus(request,env){
 const sessionId=short(new URL(request.url).searchParams.get('session_id'),255);
 if(!env.DB||!sessionId||!sessionId.startsWith('cs_'))return json({message:'Commande introuvable.'},400);
 const order=await env.DB.prepare('SELECT status,order_ref,quantity FROM orders WHERE checkout_session_id=?').bind(sessionId).first();
 if(!order)return json({status:'processing'});
 const shipments=await env.DB.prepare('SELECT parcel_number,status,tracking_number,tracking_url FROM shipments WHERE order_ref=? ORDER BY parcel_number').bind(order.order_ref).all();
 return json({status:order.status,order_ref:order.order_ref,quantity:order.quantity,shipments:shipments.results||[]});
}
export default {async fetch(request,env){
 const u=new URL(request.url),origin=request.headers.get('Origin');
 if(origin&&origin!==SITE&&origin!=='https://www.sansglutenfoodsolutions.com')return json({message:'Origine non autorisée.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||SITE,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Stripe-Signature','Vary':'Origin'}});
 if(u.pathname==='/health'&&request.method==='GET')return json({status:'ok',configured:!!(env.DB&&env.STRIPE_SECRET_KEY&&env.STRIPE_PRICE_ID&&env.STRIPE_WEBHOOK_SECRET&&env.SENDCLOUD_PUBLIC_KEY&&env.SENDCLOUD_SECRET_KEY),checkout_enabled:env.CHECKOUT_ENABLED==='true'});
 if(u.pathname==='/service-points'&&request.method==='GET'){
  const postal=u.searchParams.get('postal_code'),city=short(u.searchParams.get('city'),80);
  if(!isPostal(postal))return json({message:'Code postal français à 5 chiffres requis.'},400);
  try{return json({service_points:await findPoints(env,postal,city)});}catch{return json({message:'Recherche des points relais indisponible.'},503);}
 }
 if(u.pathname==='/shipping-option'&&request.method==='POST'){
  let body;try{body=await request.json();}catch{return json({message:'Données invalides.'},400);}
  const q=body.quantity,postal=body.postal_code,city=short(body.city,80),id=short(body.service_point_id,30);
  if(!isQuantity(q)||!isPostal(postal)||!id)return json({message:'Point relais invalide.'},400);
  try{const relay=(await findPoints(env,postal,city)).find(p=>p.id===id);if(!relay)return json({message:'Point relais indisponible.'},422);
   const option=await relayShippingOption(env,relay,q);return json({shipping_option_code:option.code,name:option.name,delivery_cents:DELIVERY_CENTS,quantity:q,total_cents:(GOODS_CENTS+DELIVERY_CENTS)*q});
  }catch{return json({message:'Aucun service Mondial Relay disponible pour ce point.'},503);}
 }
 if(u.pathname==='/checkout'&&request.method==='POST')return handleCheckout(request,env);
 if(u.pathname==='/stripe-webhook'&&request.method==='POST')return handleStripeWebhook(request,env);
 if(u.pathname==='/order-status'&&request.method==='GET')return handleOrderStatus(request,env);
 return json({message:'Ressource introuvable.'},404);
}};
