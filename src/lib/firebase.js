import { initializeApp } from "firebase/app";
import { getFirestore, doc, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDpil-ZG7qzutPNK9A04Hrmv4DOXF2RgnA",
  authDomain: "ekhtsasi-light.firebaseapp.com",
  projectId: "ekhtsasi-light",
  storageBucket: "ekhtsasi-light.firebasestorage.app",
  messagingSenderId: "713907672870",
  appId: "1:713907672870:web:9204f3330ff9085aa713e7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Legacy reference (for migration if needed)
export const LEGACY_MAIN_DOC_REF = doc(db, "appData", "main");

// New Architecture References
export const SETTINGS_DOC_REF = doc(db, "appData", "settings");
export const SCHEMA_DOC_REF = doc(db, "appData", "schema");
export const CASES_COLLECTION_REF = collection(db, "cases");
export const ROLLS_COLLECTION_REF = collection(db, "rolls");
export const TASKS_COLLECTION_REF = collection(db, "tasks");
