// @ts-nocheck
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "marketflow-flmb6",
  "appId": "1:565748530082:web:6b83fb9fd117a5a6fe10fb",
  "storageBucket": "marketflow-flmb6.firebasestorage.app",
  "apiKey": "AIzaSyDWkF2S764FFlHsd288XH8fA-VvJbeczRY",
  "authDomain": "marketflow-flmb6.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "565748530082"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
