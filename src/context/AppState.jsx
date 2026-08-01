import React, { createContext, useContext, useState, useEffect } from 'react';
import { onSnapshot, setDoc, doc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';
import { db, getSettingsRef, getSchemaRef, getCasesRef, getRollsRef, getTasksRef } from '../lib/firebase';
import { useAuth } from './AuthContext';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const { userData, currentUser, logout } = useAuth();
  
  const [cases, setCases] = useState([]);
  const [deletedCases, setDeletedCases] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [globalTasks, setGlobalTasks] = useState([]);
  const [schema, setSchema] = useState([]);
  
  const defaultSettings = { 
    consultantName: "أحمد وجيه", 
    decisions: ['للحكم', 'تصريح', 'للإطلاع', 'للإعلان', 'آخر أجل', 'للمستندات', 'للمذكرات', 'لورود التقرير', 'استبعاد', 'لتنفيذ قرار الإعادة'],
    judgmentCategories: ['نهائي وبات (عليا)', 'قرار فحص', 'حكم أول درجة', 'حكم منه للخصومة', 'حكم غير منه للخصومة', 'تمهيدي'],
    judgmentClassifications: ['صالح', 'ضد', 'مختلط', 'اعتبار', 'وقف جزائي', 'وقف تعليقي', 'خبراء'],
    judgmentTextMap: {
      'وقف جزائي': 'وقف الدعوى جزائيا لمدة شهر',
      'اعتبار': 'اعتبار الدعوى كأن لم تكن',
      'رفض': 'بقبول الدعوي شكلا ورفضها موضوعا وإلزام رافعها المصروفات'
    }
  };
  
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  const tenantId = userData?.tenantId;
  const isAdmin = userData?.role === 'super_admin' || userData?.role === 'consultant';
  const isEmployee = userData?.role === 'employee';

  const currentUserPermissions = {
    canEditData: isAdmin || isEmployee,
    canDeleteData: isAdmin || isEmployee,
    canManageRolls: isAdmin || isEmployee,
    canManageTasks: isAdmin || isEmployee
  };

  useEffect(() => {
    if (!tenantId) {
      setCases([]);
      setDeletedCases([]);
      setRolls([]);
      setGlobalTasks([]);
      setSchema([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubCases = onSnapshot(getCasesRef(tenantId), (snapshot) => {
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

    const unsubSchema = onSnapshot(getSchemaRef(tenantId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().fields) {
        const obsoleteFields = ['الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم', 'الرول', 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي'];
        let cleanSchema = docSnap.data().fields.filter(f => !obsoleteFields.includes(f.id));
        
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

    const unsubSettings = onSnapshot(getSettingsRef(tenantId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({ ...prev, ...data }));
        if (data.dateFormat) {
          localStorage.setItem('dateFormat', data.dateFormat);
        }
      }
    });

    const unsubRolls = onSnapshot(getRollsRef(tenantId), (snapshot) => {
      const rollsData = [];
      snapshot.forEach(doc => {
        rollsData.push({ id: doc.id, ...doc.data() });
      });
      rollsData.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRolls(rollsData);
    });

    const unsubTasks = onSnapshot(getTasksRef(tenantId), (snapshot) => {
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
  }, [tenantId]);

  const logoutAdmin = () => {
    logout();
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
    if (!tenantId) return false;
    try {
      const safeId = sanitizeId(caseId);
      const caseRef = doc(getCasesRef(tenantId), safeId);
      const dataToSave = cleanUndefined({ ...caseData, updatedAt: new Date().toISOString() });
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
    if (!tenantId) return false;
    try {
      const safeId = sanitizeId(caseId);
      if (permanent) {
        await deleteDoc(doc(getCasesRef(tenantId), safeId));
      } else {
        await setDoc(doc(getCasesRef(tenantId), safeId), { 
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
    if (!tenantId) return false;
    try {
      const safeId = sanitizeId(caseId);
      await setDoc(doc(getCasesRef(tenantId), safeId), { 
        isDeleted: false,
        deletedAt: null
      }, { merge: true });
      return true;
    } catch (error) {
      console.error("Error restoring case:", error);
      return false;
    }
  };

  const saveBatchCasesToFirebase = async (casesArray) => {
    if (!tenantId) return false;
    try {
      const chunkArray = (arr, size) => arr.length ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [];
      const batches = chunkArray(casesArray, 490);
      
      for (const batchCases of batches) {
        const batch = writeBatch(db);
        batchCases.forEach(c => {
          const rawId = c.id || `${c['رقم الدعوى'] || 'unk'}-${c['السنة'] || 'unk'}`;
          const safeId = sanitizeId(rawId);
          const caseRef = doc(getCasesRef(tenantId), safeId);
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
    if (!tenantId) return false;
    try {
      await setDoc(getSchemaRef(tenantId), { fields: newSchema }, { merge: true });
      return true;
    } catch (error) {
      console.error("Schema save error:", error);
      return false;
    }
  };

  const saveSettingsToFirebase = async (newSettings) => {
    if (!tenantId) return false;
    try {
      await setDoc(getSettingsRef(tenantId), newSettings, { merge: true });
      return true;
    } catch (error) {
      console.error("Settings save error:", error);
      return false;
    }
  };

  const deleteAllCases = async () => {
    if (!tenantId) return false;
    try {
      const snapshot = await getDocs(getCasesRef(tenantId));
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
    if (!tenantId) return false;
    try {
      await setDoc(doc(getRollsRef(tenantId), id), data, { merge: true });
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteRollFromFirebase = async (id) => {
    if (!tenantId) return false;
    try {
      await deleteDoc(doc(getRollsRef(tenantId), id));
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const saveGlobalTask = async (id, data) => {
    if (!tenantId) return false;
    try {
      await setDoc(doc(getTasksRef(tenantId), id), data, { merge: true });
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteGlobalTask = async (id) => {
    if (!tenantId) return false;
    try {
      await deleteDoc(doc(getTasksRef(tenantId), id));
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
      currentUser: currentUser?.email || '',
      currentUserPermissions,
      loading,
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
