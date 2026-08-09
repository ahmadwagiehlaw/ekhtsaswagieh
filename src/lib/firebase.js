import { initializeApp } from "firebase/app";
import { doc, collection, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyDpil-ZG7qzutPNK9A04Hrmv4DOXF2RgnA",
  authDomain: "ekhtsasi-light.firebaseapp.com",
  projectId: "ekhtsasi-light",
  storageBucket: "ekhtsasi-light.firebasestorage.app",
  messagingSenderId: "713907672870",
  appId: "1:713907672870:web:9204f3330ff9085aa713e7"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);

// ─── Multi-Tenant Dynamic References ────────────────────────────
// These functions return refs scoped to a specific workspace (tenantId)
export const getSettingsRef = (tenantId) => doc(db, "tenants", tenantId, "appData", "settings");
export const getSchemaRef = (tenantId) => doc(db, "tenants", tenantId, "appData", "schema");
export const getCasesRef = (tenantId) => collection(db, "tenants", tenantId, "cases");
export const getRollsRef = (tenantId) => collection(db, "tenants", tenantId, "rolls");
export const getTasksRef = (tenantId) => collection(db, "tenants", tenantId, "tasks");
export const getActivityLogsRef = (tenantId) => collection(db, "tenants", tenantId, "activity_logs");

// ─── Global / Admin References ──────────────────────────────────
export const USERS_DIRECTORY_REF = collection(db, "users_directory");
export const INVITES_REF = collection(db, "invites");

// ─── Legacy References (Read-Only for Migration Script) ─────────
export const LEGACY_MAIN_DOC_REF = doc(db, "appData", "main");
export const LEGACY_SETTINGS_DOC_REF = doc(db, "appData", "settings");
export const LEGACY_SCHEMA_DOC_REF = doc(db, "appData", "schema");
export const LEGACY_CASES_COLLECTION_REF = collection(db, "cases");
export const LEGACY_ROLLS_COLLECTION_REF = collection(db, "rolls");
export const LEGACY_TASKS_COLLECTION_REF = collection(db, "tasks");
