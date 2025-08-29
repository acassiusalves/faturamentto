
// @ts-nocheck
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, enableNetwork } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  "projectId": "marketflow-flmb6",
  "appId": "1:565748530082:web:6b83fb9fd117a5a6fe10fb",
  "storageBucket": "marketflow-flmb6.firebasestorage.app",
  "apiKey": "AIzaSyDWkF2S764FFlHsd288XH8fA-VvJbeczRY",
  "authDomain": "marketflow-flmb6.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "565748530082"
};

// Simplified and robust initialization for Next.js
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const functions = getFunctions(app);

// The enableNetwork call should ideally only run on the client.
// However, since Firestore handles this gracefully, we can attempt it,
// but it's often better to manage network state within client-side hooks if needed.
// For this fix, we'll keep it simple as the primary issue is initialization.
try {
  if (typeof window !== 'undefined') {
    enableNetwork(db);
  }
} catch (error) {
  console.warn("Could not enable network for Firestore on this environment.", error);
}


export { app, db, auth, functions };
