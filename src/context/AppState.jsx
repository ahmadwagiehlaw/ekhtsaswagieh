import React, { createContext, useContext, useState, useEffect } from 'react';
import { onSnapshot, setDoc, doc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';
import { db, SETTINGS_DOC_REF, SCHEMA_DOC_REF, CASES_COLLECTION_REF, ROLLS_COLLECTION_REF, LEGACY_MAIN_DOC_REF, TASKS_COLLECTION_REF } from '../lib/firebase';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [cases, setCases] = useState([]);
  const [deletedCases, setDeletedCases] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [globalTasks, setGlobalTasks] = useState([]);
  const [schema, setSchema] = useState([]);
  const [settings, setSettings] = useState({ 
    consultantName: "أحمد وجيه", 
    adminPassword: "444",
    employees: [],
    decisions: ['للحكم', 'تصريح', 'للإطلاع', 'للإعلان', 'آخر أجل', 'للمستندات', 'للمذكرات', 'لورود التقرير', 'استبعاد', 'لتنفيذ قرار الإعادة'],
    judgmentTextMap: {
      'وقف جزائي': 'وقف الدعوى جزائيا لمدة شهر',
      'اعتبار': 'اعتبار الدعوى كأن لم تكن',
      'رفض': 'بقبول الدعوي شكلا ورفضها موضوعا وإلزام رافعها المصروفات'
    }
  });
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('isAdmin') === 'true');
  const [isEmployee, setIsEmployee] = useState(() => localStorage.getItem('isEmployee') === 'true');
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('currentUser') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubCases = onSnapshot(CASES_COLLECTION_REF, (snapshot) => {
      const casesData = [];
      const deletedData = [];
      snapshot.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        if (data.isDeleted) {
          deletedData.push(data);
        } else {
          casesData.push(data);
        }
      });
      setCases(casesData);
      setDeletedCases(deletedData);
      setLoading(false);
    });

    // 2. Listen to dynamic schema
    const unsubSchema = onSnapshot(SCHEMA_DOC_REF, (docSnap) => {
      if (docSnap.exists() && docSnap.data().fields) {
        const obsoleteFields = ['الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم', 'الرول', 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي'];
        let cleanSchema = docSnap.data().fields.filter(f => !obsoleteFields.includes(f.id));
        
        // Ensure essential fields exist
        const essentialFields = [
          { id: 'تصنيف الدعوى', label: 'تصنيف الدعوى', type: 'text', visible: true },
          { id: 'موضوع الدعوى', label: 'موضوع الدعوى', type: 'textarea', visible: true },
          { id: 'المقر المختار', label: 'المقر المختار', type: 'text', visible: true },
          { id: 'عنوان المدعي', label: 'عنوان المدعي / الطاعن', type: 'text', visible: true },
          { id: 'عنوان المدعى عليه', label: 'عنوان المدعى عليه / المطعون ضده', type: 'text', visible: true },
          { id: 'مكان الملف', label: 'مكان الملف', type: 'text', visible: true }
        ];

        essentialFields.forEach(ef => {
           if (!cleanSchema.find(s => s.id === ef.id)) {
              cleanSchema.push(ef);
           }
        });

        setSchema(cleanSchema);
      } else {
        // Default schema if none exists
        setSchema([
          { id: 'رقم الدعوى', label: 'رقم الدعوى', type: 'text', visible: true, primary: true },
          { id: 'السنة', label: 'السنة', type: 'text', visible: true, primary: true },
          { id: 'المدعي', label: 'المدعي', type: 'text', visible: true },
          { id: 'المدعى_عليه', label: 'المدعى عليه', type: 'text', visible: true },
          { id: 'آخر جلسة', label: 'تاريخ آخر جلسة', type: 'date', visible: true, isDate: true },
          { id: 'القرار', label: 'القرار', type: 'text', visible: true },
          { id: 'الصفة', label: 'الصفة', type: 'text', visible: true },
          { id: 'تصنيف الدعوى', label: 'تصنيف الدعوى', type: 'text', visible: true },
          { id: 'موضوع الدعوى', label: 'موضوع الدعوى', type: 'textarea', visible: true },
          { id: 'المقر المختار', label: 'المقر المختار', type: 'text', visible: true },
          { id: 'عنوان المدعي', label: 'عنوان المدعي / الطاعن', type: 'text', visible: true },
          { id: 'عنوان المدعى عليه', label: 'عنوان المدعى عليه / المطعون ضده', type: 'text', visible: true },
          { id: 'مكان الملف', label: 'مكان الملف', type: 'text', visible: true },
          { id: 'دعاوى منضمة', label: 'دعاوى منضمة', type: 'text', visible: true }
        ]);
      }
    });

    // 3. Listen to settings
    const unsubSettings = onSnapshot(SETTINGS_DOC_REF, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(prev => ({ ...prev, ...docSnap.data() }));
      }
    });

    // 4. Listen to rolls
    const unsubRolls = onSnapshot(ROLLS_COLLECTION_REF, (snapshot) => {
      const rollsData = [];
      snapshot.forEach(doc => {
        rollsData.push({ id: doc.id, ...doc.data() });
      });
      // Sort rolls by date descending
      rollsData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRolls(rollsData);
    });

    // 5. Listen to global tasks
    const unsubTasks = onSnapshot(TASKS_COLLECTION_REF, (snapshot) => {
      const tasksData = [];
      snapshot.forEach(doc => {
        tasksData.push({ id: doc.id, ...doc.data() });
      });
      tasksData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setGlobalTasks(tasksData);
    });

    return () => {
      unsubCases();
      unsubSchema();
      unsubSettings();
      unsubRolls();
      unsubTasks();
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

  const checkDuplicateCase = (caseNo, year, excludeId = null) => {
    return cases.some(c => {
      const cNo = c['رقم الدعوى'] || c['رقم القضية'] || c['رقم_الدعوى'];
      const cYear = c['السنة'] || c['سنة'] || c['year'];
      
      if (String(cNo).trim() === String(caseNo).trim() && String(cYear).trim() === String(year).trim()) {
        if (excludeId && c.id === excludeId) return false;
        return true;
      }
      return false;
    });
  };

  const createNewCase = async (caseData) => {
    try {
      const caseNo = caseData['رقم الدعوى'] || caseData['رقم القضية'] || 'جديد';
      const year = caseData['السنة'] || caseData['سنة'] || new Date().getFullYear();
      
      if (checkDuplicateCase(caseNo, year)) {
         throw new Error('DUPLICATE_CASE');
      }

      const rawId = `${caseNo}-${year}-${Date.now()}`;
      const safeId = sanitizeId(rawId);
      return await saveCaseToFirebase(safeId, caseData);
    } catch (error) {
      console.error("Error creating new case: ", error);
      if (error.message === 'DUPLICATE_CASE') throw error;
      return false;
    }
  };

  const deleteCaseFromFirebase = async (caseId, permanent = false) => {
    try {
      const safeId = sanitizeId(caseId);
      if (permanent) {
        await deleteDoc(doc(CASES_COLLECTION_REF, safeId));
      } else {
        await setDoc(doc(CASES_COLLECTION_REF, safeId), { 
          isDeleted: true, 
          deletedAt: new Date().toISOString() 
        }, { merge: true });
      }
      return true;
    } catch (error) {
      console.error("Error deleting case:", error);
      return false;
    }
  };

  const restoreCaseFromFirebase = async (caseId) => {
    try {
      const safeId = sanitizeId(caseId);
      await setDoc(doc(CASES_COLLECTION_REF, safeId), { 
        isDeleted: false,
        deletedAt: null
      }, { merge: true });
      return true;
    } catch (error) {
      console.error("Error restoring case:", error);
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

  const saveRollToFirebase = async (id, data) => {
    try {
      await setDoc(doc(ROLLS_COLLECTION_REF, id), data, { merge: true });
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteRollFromFirebase = async (id) => {
    try {
      await deleteDoc(doc(ROLLS_COLLECTION_REF, id));
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const saveGlobalTask = async (id, data) => {
    try {
      await setDoc(doc(TASKS_COLLECTION_REF, id), data, { merge: true });
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteGlobalTask = async (id) => {
    try {
      await deleteDoc(doc(TASKS_COLLECTION_REF, id));
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  return (
    <AppContext.Provider value={{
      cases,
      deletedCases,
      rolls,
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
      checkDuplicateCase,
      saveBatchCasesToFirebase,
      saveSchemaToFirebase,
      saveSettingsToFirebase,
      deleteAllCases,
      deleteCaseFromFirebase,
      restoreCaseFromFirebase,
      saveRollToFirebase,
      deleteRollFromFirebase,
      globalTasks,
      saveGlobalTask,
      deleteGlobalTask
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
