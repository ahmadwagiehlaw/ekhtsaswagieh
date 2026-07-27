import React, { createContext, useContext, useState, useEffect } from 'react';
import { onSnapshot, setDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db, SETTINGS_DOC_REF, SCHEMA_DOC_REF, CASES_COLLECTION_REF, LEGACY_MAIN_DOC_REF } from '../lib/firebase';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [cases, setCases] = useState([]);
  const [schema, setSchema] = useState([]);
  const [settings, setSettings] = useState({ 
    consultantName: "أحمد وجيه", 
    adminPassword: "444",
    employees: [],
    decisions: ['للحكم', 'تصريح', 'للإطلاع', 'للإعلان', 'آخر أجل', 'للمستندات', 'للمذكرات', 'لورود التقرير', 'استبعاد', 'لتنفيذ قرار الإعادة']
  });
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('isAdmin') === 'true');
  const [isEmployee, setIsEmployee] = useState(() => localStorage.getItem('isEmployee') === 'true');
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('currentUser') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Listen to cases collection
    const unsubCases = onSnapshot(CASES_COLLECTION_REF, (snapshot) => {
      const casesData = [];
      snapshot.forEach(doc => {
        casesData.push({ id: doc.id, ...doc.data() });
      });
      setCases(casesData);
      setLoading(false);
    });

    // 2. Listen to dynamic schema
    const unsubSchema = onSnapshot(SCHEMA_DOC_REF, (docSnap) => {
      if (docSnap.exists() && docSnap.data().fields) {
        setSchema(docSnap.data().fields);
      } else {
        // Default schema if none exists
        setSchema([
          { id: 'رقم الدعوى', label: 'رقم الدعوى', type: 'text', visible: true, primary: true },
          { id: 'السنة', label: 'السنة', type: 'text', visible: true, primary: true },
          { id: 'المدعي', label: 'المدعي', type: 'text', visible: true },
          { id: 'المدعى_عليه', label: 'المدعى عليه', type: 'text', visible: true },
          { id: 'آخر جلسة', label: 'تاريخ آخر جلسة', type: 'date', visible: true, isDate: true },
          { id: 'القرار', label: 'القرار', type: 'text', visible: true },
          { id: 'الصفة', label: 'الصفة', type: 'text', visible: true }
        ]);
      }
    });

    // 3. Listen to settings
    const unsubSettings = onSnapshot(SETTINGS_DOC_REF, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(prev => ({ ...prev, ...docSnap.data() }));
      }
    });

    return () => {
      unsubCases();
      unsubSchema();
      unsubSettings();
    };
  }, []);

  const loginAdmin = (password) => {
    if (password === 'a4450422') {
      setIsAdmin(true);
      setIsEmployee(false);
      setCurrentUser('المدير');
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('isEmployee', 'false');
      localStorage.setItem('currentUser', 'المدير');
      return true;
    }

    // Check employee
    const employee = settings.employees?.find(emp => emp.password === password);
    if (employee) {
      setIsAdmin(false);
      setIsEmployee(true);
      setCurrentUser(employee.name);
      localStorage.setItem('isAdmin', 'false');
      localStorage.setItem('isEmployee', 'true');
      localStorage.setItem('currentUser', employee.name);
      return true;
    }
    
    return false;
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    setIsEmployee(false);
    setCurrentUser('');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('isEmployee');
    localStorage.removeItem('currentUser');
  };

  const sanitizeId = (str) => String(str).replace(/[\/\\?%*:|"<>\s]/g, '_');

  const cleanUndefined = (obj) => {
    const newObj = {};
    for (let key in obj) {
      if (obj[key] !== undefined) {
        newObj[key] = obj[key];
      }
    }
    return newObj;
  };

  const saveCaseToFirebase = async (caseId, caseData) => {
    try {
      const safeId = sanitizeId(caseId);
      const caseRef = doc(CASES_COLLECTION_REF, safeId);
      const dataToSave = cleanUndefined({ ...caseData });
      delete dataToSave.id; 
      await setDoc(caseRef, dataToSave, { merge: true });
      return true;
    } catch (error) {
      console.error("Error saving case: ", error);
      return false;
    }
  };

  const createNewCase = async (caseData) => {
    try {
      const caseNo = caseData['رقم الدعوى'] || caseData['رقم القضية'] || 'جديد';
      const year = caseData['السنة'] || caseData['سنة'] || new Date().getFullYear();
      const rawId = `${caseNo}-${year}-${Date.now()}`;
      const safeId = sanitizeId(rawId);
      return await saveCaseToFirebase(safeId, caseData);
    } catch (error) {
      console.error("Error creating new case: ", error);
      return false;
    }
  };

  const deleteCaseFromFirebase = async (caseId) => {
    try {
      const safeId = sanitizeId(caseId);
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(CASES_COLLECTION_REF, safeId));
      return true;
    } catch (error) {
      console.error("Error deleting case:", error);
      return false;
    }
  };

  // Helper for excel sync
  const saveBatchCasesToFirebase = async (casesArray) => {
    try {
      const chunkArray = (arr, size) => arr.length ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [];
      const batches = chunkArray(casesArray, 490);
      
      for (const batchCases of batches) {
        const batch = writeBatch(db);
        batchCases.forEach(c => {
          const rawId = c.id || `${c['رقم الدعوى'] || 'unk'}-${c['السنة'] || 'unk'}`;
          const safeId = sanitizeId(rawId);
          const caseRef = doc(CASES_COLLECTION_REF, safeId);
          const dataToSave = cleanUndefined({ ...c });
          delete dataToSave.id;
          batch.set(caseRef, dataToSave, { merge: true });
        });
        await batch.commit();
      }
      return true;
    } catch (error) {
      console.error("Batch save error:", error);
      return false;
    }
  };

  const saveSchemaToFirebase = async (newSchema) => {
    try {
      await setDoc(SCHEMA_DOC_REF, { fields: newSchema }, { merge: true });
      return true;
    } catch (error) {
      console.error("Schema save error:", error);
      return false;
    }
  };

  const saveSettingsToFirebase = async (newSettings) => {
    try {
      await setDoc(SETTINGS_DOC_REF, newSettings, { merge: true });
      return true;
    } catch (error) {
      console.error("Settings save error:", error);
      return false;
    }
  };

  // Factory Reset (Admin only)
  const deleteAllCases = async () => {
    try {
      const { deleteDoc } = await import('firebase/firestore');
      const snapshot = await getDocs(CASES_COLLECTION_REF);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
      return true;
    } catch (e) {
      console.error('Error deleting all cases:', e);
      return false;
    }
  };

  return (
    <AppContext.Provider value={{
      cases,
      schema,
      settings,
      isAdmin,
      isEmployee,
      currentUser,
      loading,
      loginAdmin,
      logoutAdmin,
      saveCaseToFirebase,
      createNewCase,
      saveBatchCasesToFirebase,
      saveSchemaToFirebase,
      saveSettingsToFirebase,
      deleteAllCases,
      deleteCaseFromFirebase
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
