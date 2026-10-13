"use strict";
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {defineSecret} = require("firebase-functions/params");
const {logger} = require("firebase-functions");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

initializeApp();
const resendApiKey = defineSecret("RESEND_API_KEY");
const RECIPIENT = "benoit.rey@sansglutenfoodsolutions.com";
const SENDER = "SGFS Commandes <commandes@sansglutenfoodsolutions.com>";
const formatEuro = cents => (cents / 100).toLocaleString("fr-FR", {style:"currency",currency:"EUR"});
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));
exports.notifyValidatedOrder = onDocumentUpdated(
  {document:"orders/{orderId}",region:"europe-west1",secrets:[resendApiKey],retry:false},
  async event => {
    const before = event.data?.before.data(), after = event.data?.after.data();
    // A request is not a confirmed order. Fire only on the first validation transition.
    if (!before || !after || before.status === "validee" || after.status !== "validee") return;
    const id = event.params.orderId;
    const db = getFirestore();
    const dedupe = db.collection("order_notifications").doc(id);
    try {
      await db.runTransaction(async tx => {
        const previous = await tx.get(dedupe);
        if (previous.exists) throw new Error("ALREADY_PROCESSED");
        tx.create(dedupe, {state:"processing",startedAt:FieldValue.serverTimestamp()});
      });
    } catch (e) {
      if (e.message === "ALREADY_PROCESSED") return;
      throw e;
    }
    const quantity = Number(after.quantity);
    const unitPriceCents = Number(after.unitPriceCents);
    const shippingCents = Number(after.shippingCents);
    const totalCents = Number(after.totalCents);
    const subtotal = Number.isSafeInteger(quantity * unitPriceCents) ? formatEuro(quantity * unitPriceCents) : "à confirmer";
    const shipping = Number.isSafeInteger(shippingCents) && shippingCents >= 0 ? formatEuro(shippingCents) : "à confirmer";
    const total = Number.isSafeInteger(totalCents) && totalCents >= 0 ? formatEuro(totalCents) : "à confirmer";
    const plain = [
      "Nouvelle commande SGFS VALIDÉE", "Référence : " + id,
      "Client : " + after.firstName + " " + after.lastName,
      "Entreprise : " + (after.company || "Particulier"),
      "Email : " + after.email, "Téléphone : " + after.phone,
      "Livraison : " + after.address + ", " + after.postalCode + " " + after.city,
      "Produit : Mix universel BIO 500 g", "Quantité : " + quantity,
      "Sous-total : " + subtotal, "Transport : " + shipping,
      "Total : " + total, "État : validée (vérifier le paiement séparément)",
      "Notes : " + (after.notes || "aucune")
    ].join("\n");
    const key = resendApiKey.value();
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method:"POST",
        headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"sgfs-validated-"+id},
        body:JSON.stringify({from:SENDER,to:[RECIPIENT],subject:"SGFS — commande validée "+id.slice(0,8).toUpperCase(),
          text:plain, html:"<h2>Commande SGFS validée</h2><pre style='white-space:pre-wrap;font-family:Arial,sans-serif'>"+escape(plain)+"</pre>"})
      });
      if (!resp.ok) throw new Error("Resend HTTP "+resp.status+": "+(await resp.text()).slice(0,300));
      await dedupe.set({state:"sent",sentAt:FieldValue.serverTimestamp()},{merge:true});
      logger.info("Commande validée : notification envoyée",{orderId:id});
    } catch(err) {
      await dedupe.set({state:"error",error:String(err.message).slice(0,400),failedAt:FieldValue.serverTimestamp()},{merge:true});
      logger.error("Notification SGFS non envoyée",{orderId:id,error:err});
      // Fail closed: the order remains valid. An admin can see the error in Firestore.
    }
  }
);
