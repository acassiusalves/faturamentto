// @ts-nocheck
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableNetwork } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "marketflow-flmb6",
  "appId": "1:565748530082:web:6b83fb9fd117a5a6fe10fb",
  "storageBucket": "marketflow-flmb6.firebasestorage.app",
  "apiKey": "AIzaSyDWkF2S764FFlHsd288XH8fA-VvJbeczRY",
  "authDomain": "marketflow-flmb6.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "565748530082"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined' && !getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  try {
    enableNetwork(db);
    console.log("Firebase network enabled.");
  } catch (error) {
    console.warn("Could not enable network for Firestore. This might happen on subsequent reloads.", error);
  }
} else if (getApps().length > 0) {
    app = getApp();
    auth = getAuth(app);
    db = getFirestore(app);
}

// Fallback for server-side rendering or environments where `window` is not defined
if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}
if (!auth) {
    auth = getAuth(app);
}
if (!db) {
    db = getFirestore(app);
}


export { app, db, auth };
