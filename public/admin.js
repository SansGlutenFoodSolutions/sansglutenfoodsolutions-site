import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig } from "/firebase-config.js";

const loginPanel = document.querySelector('#loginPanel');
const dashboard = document.querySelector('#dashboard');
const loginForm = document.querySelector('#loginForm');
const loginStatus = document.querySelector('#loginStatus');
const leadList = document.querySelector('#leadList');
const logoutButton = document.querySelector('#logoutButton');

const isConfigured = !Object.values(firebaseConfig).some(value => String(value).startsWith('VOTRE_'));
if (!isConfigured) {
  loginStatus.className = 'form-status error';
  loginStatus.textContent = 'Renseignez firebase-config.js avant d’utiliser cet espace.';
  loginForm.querySelector('button').disabled = true;
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let unsubscribe = null;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const dateText = value => value?.toDate ? value.toDate().toLocaleString('fr-FR') : 'En cours';

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginStatus.textContent = '';
    try {
      await signInWithEmailAndPassword(auth, document.querySelector('#adminEmail').value.trim(), document.querySelector('#adminPassword').value);
    } catch (error) {
      loginStatus.className = 'form-status error';
      loginStatus.textContent = 'Connexion impossible. Vérifiez le compte et les droits administrateur.';
    }
  });

  logoutButton.addEventListener('click', () => signOut(auth));

  onAuthStateChanged(auth, user => {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    loginPanel.hidden = Boolean(user);
    dashboard.hidden = !user;
    if (!user) return;

    const leadsQuery = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    unsubscribe = onSnapshot(leadsQuery, snapshot => {
      if (snapshot.empty) {
        leadList.innerHTML = '<p class="admin-empty">Aucune demande pour le moment.</p>';
        return;
      }
      const rows = snapshot.docs.map(doc => {
        const lead = doc.data();
        return `<tr>
          <td>${esc(dateText(lead.createdAt))}</td>
          <td><strong>${esc(lead.firstName)} ${esc(lead.lastName)}</strong><br>${esc(lead.company)}</td>
          <td>${esc(lead.activity)}<br>${esc(lead.postalCode)}</td>
          <td><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a><br>${esc(lead.phone)}</td>
          <td>${esc(lead.volume || 'Non défini')}</td>
          <td style="white-space:normal;min-width:280px">${esc(lead.message)}</td>
        </tr>`;
      }).join('');
      leadList.innerHTML = `<table class="admin-table"><thead><tr><th>Date</th><th>Contact</th><th>Activité</th><th>Coordonnées</th><th>Volume</th><th>Projet</th></tr></thead><tbody>${rows}</tbody></table>`;
    }, error => {
      console.error(error);
      leadList.innerHTML = '<p class="admin-empty">Accès refusé. Vérifiez que votre UID figure dans la collection admins.</p>';
    });
  });
}
