// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = window.__app_id || 'default';
const config = window.__firebase_config ? JSON.parse(window.__firebase_config) : {};

let app, db, auth;
export let userId = null;
export let isAuthReady = false;
export let dbAvailable = false;

export { db, auth };

export function initFirebase() {
  if (Object.keys(config).length > 0) {
    app = initializeApp(config);
    db = getFirestore(app);
    auth = getAuth(app);
    dbAvailable = true;
    setupAuth();
  } else {
    fallbackToLocal();
  }
}

function setupAuth() {
  onAuthStateChanged(auth, user => {
    if (user) {
      userId = user.uid;
      document.getElementById('user-id-display').textContent = `ID: ${userId}`;
      isAuthReady = true;
      hideLoading();
      if (document.getElementById('notes-view').classList.contains('active')) {
        setupNotes();
      }
    } else {
      signInAnonymously(auth).catch(console.error);
    }
  });
}

function fallbackToLocal() {
  dbAvailable = false;
  userId = 'offline_user';
  isAuthReady = true;
  const msg = document.getElementById('loading-message');
  msg.textContent = 'Modo local (solo este navegador)';
  msg.classList.add('text-orange-500');
  document.getElementById('local-storage-warning')?.classList.remove('hidden');
  hideLoading();
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
  document.getElementById('main-content').classList.remove('hidden');
}

export const getNotesRef = () => dbAvailable ? collection(db, 'artifacts', appId, 'users', userId, 'notes') : null;