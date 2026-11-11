"use strict";
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const region = "europe-west1";
const allowedOrigins = ["https://sansglutenfoodsolutions.com", "https://www.sansglutenfoodsolutions.com"];
const productCents = 4490; // Carton de 6 sachets, TTC. Montant défini côté serveur uniquement.

function shippingCents() {
  const value = String(process.env.MON_DIAL_RELAY_SHIPPING_CENTS || "");
  if (!/^[1-9][0-9]{0,4}$/.test(value)) return null;
  const cents = Number(value);
  return cents <= 5000 ? cents : null;
}
function relayBrand() {
  const value = String(process.env.MONDIAL_RELAY_BRAND || "").trim();
  return /^[A-Za-z0-9]{3,20}$/.test(value) ? value : null;
}
function ready() { return shippingCents() !== null && relayBrand() !== null; }
function clean(value, max=200) {
  return typeof value === "string" ? value.trim().slice(0,max) : "";
}
function fail(res, status, message) {
  res.status(status).json({error:message});
}
exports.checkoutConfig = onRequest({region, cors:allowedOrigins}, (req,res) => {
  if (req.method !== "GET") return fail(res,405,"Méthode non autorisée");
  res.set("Cache-Control", "no-store");
  res.json({ready:ready(),brand:relayBrand(),shippingCents:shippingCents(),productCents});
});
exports.createCheckoutSession = onRequest({region,cors:allowedOrigins,secrets:[STRIPE_SECRET_KEY],maxInstances:5}, async (req,res) => {
  if(req.method !== "POST") return fail(res,405,"Méthode non autorisée");
  if(!ready()) return fail(res,503,"Commande en ligne en cours d'activation");
  const v = req.body && typeof req.body === "object" ? req.body : {};
  const first = clean(v.first,80), last=clean(v.last,80);
  const email=clean(v.email,250), phone=clean(v.phone,35);
  const postcode=clean(v.postal,5), city=clean(v.city,100);
  const relayCode=clean(v.relayCode,16), relayName=clean(v.relayName,100);
  const relayAddress=clean(v.relayAddress,200);
  const relayPostcode=clean(v.relayPostal,5), relayCity=clean(v.relayCity,80);
  if(!first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[+0-9 ()-]{8,35}$/.test(phone) ||
     !/^[0-9]{5}$/.test(postcode) || !city ||
     !/^FR-[0-9]{6}$/.test(relayCode) || !relayName || !relayAddress || !/^[0-9]{5}$/.test(relayPostcode) || !relayCity) {
    return fail(res,400,"Coordonnées ou Point Relais incomplets");
  }
  const ref = "SGFS-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + require("node:crypto").randomBytes(4).toString("hex").toUpperCase();
  try{
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const session = await stripe.checkout.sessions.create({
      mode:"payment", locale:"fr", payment_method_types:["card"],
      customer_email:email, client_reference_id:ref,
      billing_address_collection:"required",
      line_items:[
        {price_data:{currency:"eur",unit_amount:productCents,product_data:{name:"Mix Universel BIO SGFS — carton de 6 sachets de 500 g"}},quantity:1},
        {price_data:{currency:"eur",unit_amount:shippingCents(),product_data:{name:"Livraison Mondial Relay — Point Relais / Locker"}},quantity:1}
      ],
      metadata:{reference:ref,first,last,phone,relayCode,relayName,relayAddress,relayPostcode,relayCity,customerPostcode:postcode,customerCity:city},
      success_url:"https://sansglutenfoodsolutions.com/commander/confirmation/?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:"https://sansglutenfoodsolutions.com/commander/?paiement=annule",
      expires_at:Math.floor(Date.now()/1000)+1800
    },{idempotencyKey:clean(v.attemptId,64)||undefined});
    res.set("Cache-Control","no-store");
    res.json({url:session.url});
  }catch(err){
    console.error("createCheckoutSession error",err.type || err.message);
    fail(res,502,"Impossible d'ouvrir le paiement sécurisé pour le moment");
  }
});
exports.checkoutStatus = onRequest({region,cors:allowedOrigins,secrets:[STRIPE_SECRET_KEY]}, async(req,res)=>{
  if(req.method !== "GET") return fail(res,405,"Méthode non autorisée");
  const sid=clean(req.query.session_id,120);
  if(!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sid)) return fail(res,400,"Référence de paiement invalide");
  try{
    const s=await new Stripe(STRIPE_SECRET_KEY.value()).checkout.sessions.retrieve(sid);
    res.set("Cache-Control","no-store");
    res.json({paid:s.payment_status==="paid",reference:s.client_reference_id || "",amountTotal:s.amount_total || 0,currency:s.currency || "eur",relayName:s.metadata?.relayName || "",relayCode:s.metadata?.relayCode || ""});
  }catch(e){fail(res,404,"Paiement introuvable");}
});
exports.stripeWebhook = onRequest({region,secrets:[STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET]},async(req,res)=>{
  if(req.method!=="POST") return res.status(405).send("Method Not Allowed");
  let event;
  try{
    const stripe=new Stripe(STRIPE_SECRET_KEY.value());
    event=stripe.webhooks.constructEvent(req.rawBody,req.get("stripe-signature"),STRIPE_WEBHOOK_SECRET.value());
  }catch(e){return res.status(400).send("Invalid signature");}
  if(event.type==="checkout.session.completed" && event.data.object.payment_status==="paid"){
    const s=event.data.object;
    try{
      await admin.firestore().collection("sgfs_orders").doc(s.id).set({
        stripeSessionId:s.id,reference:s.client_reference_id || "",
        email:s.customer_details?.email || s.customer_email || "",
        paymentStatus:"paid",amountTotal:s.amount_total,currency:s.currency,
        metadata:s.metadata || {},paidAt:admin.firestore.FieldValue.serverTimestamp(),
        transport:"Mondial Relay",fulfillmentStatus:"a_preparer"
      },{merge:true});
    }catch(e){console.error("stripeWebhook order persistence failed",e);return res.status(500).send("Retry");}
  }
  return res.status(200).send("ok");
});
