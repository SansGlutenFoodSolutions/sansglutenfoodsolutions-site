"use strict";
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {defineSecret, defineString} = require("firebase-functions/params");
const {logger} = require("firebase-functions");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const PDFDocument = require("pdfkit");
initializeApp();
const resendApiKey = defineSecret("RESEND_API_KEY");
const sellerSiren = defineString("SGFS_SIREN", {default:""});
const sellerVat = defineString("SGFS_VAT_NUMBER", {default:""});
const vatRateBps = defineString("SGFS_PRODUCT_VAT_BPS", {default:""});
const shippingVatRateBps = defineString("SGFS_SHIPPING_VAT_BPS", {default:""});
const RECIPIENT = "benoit.rey@sansglutenfoodsolutions.com";
const SENDER = "SGFS Commandes <commandes@sansglutenfoodsolutions.com>";
const euro = n => (n/100).toFixed(2).replace(".",",")+" EUR";
function pdfBuffer(data) {
 return new Promise((resolve,reject)=>{
  const doc = new PDFDocument({size:"A4",margin:48});let arr=[];
  doc.on("data",x=>arr.push(x));doc.on("end",()=>resolve(Buffer.concat(arr)));doc.on("error",reject);
  doc.fontSize(20).text("SANS GLUTEN FOOD SOLUTIONS");doc.moveDown(.4).fontSize(10)
   .text("SAS - capital social 1 000 EUR - 3 chemin Bel Air, 13960 Sausset-les-Pins")
   .text("SIREN : "+data.siren+" | TVA intracommunautaire : "+data.vat)
   .moveDown().fontSize(18).text("FACTURE "+data.number).fontSize(10)
   .text("Date d'émission : "+data.date)
   .text("Date de vente / paiement : "+data.date)
   .text("Commande : "+data.orderId)
   .moveDown().text("CLIENT : "+data.customer)
   .text("Adresse : "+data.address)
   .text("Email : "+data.email)
   .moveDown().text("Livraison de biens : mix alimentaire 500 g et frais de transport.")
   .moveDown().fontSize(11).text("Mix Universel BIO sans gluten 500 g - quantité : "+data.quantity)
   .text("Prix unitaire TTC : "+euro(data.unitPriceCents))
   .text("Sous-total TTC : "+euro(data.subtotalCents))
   .text("Transport TTC : "+euro(data.shippingCents))
   .moveDown().text("Total HT : "+euro(data.totalHt))
   .text("TVA sur produits ("+(data.productBps/100).toFixed(2)+" %) : "+euro(data.productVat))
   .text("TVA sur transport ("+(data.shippingBps/100).toFixed(2)+" %) : "+euro(data.shippingVat))
   .fontSize(14).text("TOTAL TTC : "+euro(data.totalCents))
   .moveDown().fontSize(10).text("Règlement : payé via prestataire de paiement (confirmation serveur).")
   .text("Conditions applicables : voir les CGV remises au client.");
  doc.end();
 });
}
function vatPart(ttc,bps){return Math.round(ttc*bps/(10000+bps))}
async function mail(key,payload,idempotency){
 const response=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":idempotency},
  body:JSON.stringify(payload)
 });
 if(!response.ok)throw new Error("Resend HTTP "+response.status+": "+(await response.text()).slice(0,300));
}
exports.notifyValidatedOrder = onDocumentUpdated(
 {document:"orders/{orderId}",region:"europe-west1",secrets:[resendApiKey],retry:false},
 async event=>{
  const before=event.data?.before.data(),after=event.data?.after.data();
  if(!before||!after||before.status==="validee"||after.status!=="validee")return;
  const orderId=event.params.orderId;
  // A validated order is not sufficient: only a server-verified payment can issue a paid invoice.
  if(after.paymentStatus!=="paid"||after.paymentVerifiedBy!=="server"){
    logger.warn("Validation non facturable: paiement non confirmé côté serveur",{orderId});return;
  }
  const q=Number(after.quantity),unit=Number(after.unitPriceCents),shipping=Number(after.shippingCents);
  const total=Number(after.totalCents),pBps=Number(vatRateBps.value()),sBps=Number(shippingVatRateBps.value());
  const siren=sellerSiren.value().trim(),vat=sellerVat.value().trim();
  if(!/^\\d{9}$/.test(siren)||!/^FR[0-9A-Z]{11}$/.test(vat)||!/^\\d+$/.test(vatRateBps.value())||!/^\\d+$/.test(shippingVatRateBps.value())
    || !Number.isInteger(q)||q<1||q>100||unit!==790||!Number.isSafeInteger(shipping)||shipping<0
    ||total!==q*unit+shipping||pBps<0||pBps>2500||sBps<0||sBps>2500||!after.email){
    logger.error("Données ou configuration fiscale manquantes: aucune facture émise",{orderId});return;
  }
  const db=getFirestore(),ref=db.collection("order_notifications").doc(orderId),seq=db.collection("internal_counters").doc("invoice_"+new Date().getUTCFullYear());
  let invoice;
  try {
   invoice=await db.runTransaction(async tx=>{
    const previous=await tx.get(ref);
    if(previous.exists)return null;
    const counter=await tx.get(seq);
    const year=new Date().getUTCFullYear(),next=(counter.exists?counter.data().lastNumber:0)+1;
    const number="SGFS-"+year+"-"+String(next).padStart(6,"0");
    tx.set(seq,{lastNumber:next});
    tx.create(ref,{state:"processing",invoiceNumber:number,orderId,createdAt:FieldValue.serverTimestamp()});
    return number;
   });
  }catch(error){logger.error("Facture: réservation impossible",{orderId,error:String(error)});return}
  if(!invoice)return;
  const date=new Date().toLocaleDateString("fr-FR",{timeZone:"Europe/Paris"});
  const productTotal=q*unit,productVat=vatPart(productTotal,pBps),shippingVat=vatPart(shipping,sBps);
  const d={siren,vat,number:invoice,date,orderId,
   customer:after.company||[after.firstName,after.lastName].join(" "),
   address:[after.address,after.postalCode,after.city].filter(Boolean).join(", "),
   email:after.email,quantity:q,unitPriceCents:unit,subtotalCents:productTotal,
   shippingCents:shipping,totalCents:total,totalHt:total-productVat-shippingVat,
   productBps:pBps,shippingBps:sBps,productVat,shippingVat};
  try{
   const pdf=await pdfBuffer(d);
   const attachment={filename:invoice+".pdf",content:pdf.toString("base64")};
   const text="Facture "+invoice+" pour "+q+" sachet(s) de Mix Universel BIO sans gluten 500 g. Total TTC : "+euro(total)+".";
   // Separate emails: no disclosure of customer information via CC / recipient list.
   await mail(resendApiKey.value(),{from:SENDER,to:[after.email],subject:"Votre facture SGFS "+invoice,text,attachments:[attachment]},"sgfs-invoice-client-"+orderId);
   await ref.set({customerEmailSent:true},{merge:true});
   await mail(resendApiKey.value(),{from:SENDER,to:[RECIPIENT],subject:"Commande validée SGFS - facture "+invoice,
    text:text+"\nClient : "+d.customer+"\nEmail : "+after.email+"\nLivraison : "+d.address+"\nTransport : "+euro(shipping),
    attachments:[attachment]},"sgfs-invoice-admin-"+orderId);
   await ref.set({state:"sent",adminEmailSent:true,sentAt:FieldValue.serverTimestamp()},{merge:true});
  }catch(error){
   await ref.set({state:"error",error:String(error).slice(0,400),failedAt:FieldValue.serverTimestamp()},{merge:true});
   logger.error("Envoi facture interrompu : intervention requise",{orderId,error:String(error)});
  }
 }
);
