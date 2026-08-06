import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { onSnapshot, setDoc, doc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';
import { db, getSettingsRef, getSchemaRef, getCasesRef, getRollsRef, getTasksRef } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { getSafeDateObj } from '../utils/dateUtils';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const { userData, currentUser, logout } = useAuth();
  
  const [rawCases, setRawCases] = useState([]);
  const [deletedCases, setDeletedCases] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [globalTasks, setGlobalTasks] = useState([]);
  const [schema, setSchema] = useState([]);
  
  const defaultSettings = { 
    consultantName: "أحمد وجيه", 
    courtDegree: "ثان درجة",
    courtSpecialization: "الإدارية العليا",
    decisions: ['للحكم', 'تصريح', 'للإطلاع', 'للإعلان', 'آخر أجل', 'للمستندات', 'للمذكرات', 'لورود التقرير', 'استبعاد', 'لتنفيذ قرار الإعادة', 'إحالة للموضوع'],
    judgmentCategories: ['نهائي وبات (عليا)', 'قرار فحص', 'حكم أول درجة', 'حكم منه للخصومة', 'حكم غير منه للخصومة', 'تمهيدي'],
    judgmentClassifications: ['صالح', 'ضد', 'مختلط', 'اعتبار', 'وقف جزائي', 'وقف تعليقي', 'خبراء'],
    roles: ['طاعن', 'مطعون ضده', 'مدعي', 'مدعى عليه', 'خصم مدخل', 'خصم متدخل', 'لا شأن'],
    fileLocations: ['في المكتب', 'بالمحكمة', 'غير موجود', 'مؤقت', 'خارج الاختصاص'],
    sessionTypes: ['فحص', 'موضوع', 'حكم', 'مفوضين', 'مرافعة']
  };
  
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  
  const [globalHideNoInterest, setGlobalHideNoInterest] = useState(() => {
    const saved = localStorage.getItem('globalHideNoInterest');
    if (saved === 'true') return 1;
    if (saved === 'false') return 0;
    return saved !== null ? Number(saved) : 1;
  });

  useEffect(() => {
    localStorage.setItem('globalHideNoInterest', globalHideNoInterest.toString());
  }, [globalHideNoInterest]);

  const cases = useMemo(() => {
    if (globalHideNoInterest === 1) {
      return rawCases.filter(c => {
         const role = String(c['الصفة'] || c['صفة'] || '').trim();
         return role !== 'لا شأن' && role !== 'لاشأن';
      });
    }
    if (globalHideNoInterest === 2) {
      return rawCases.filter(c => {
         const role = String(c['الصفة'] || c['صفة'] || '').trim();
         return role !== 'لا شأن' && role !== 'لاشأن' && role !== 'خارج الاختصاص';
      });
    }
    return rawCases;
  }, [rawCases, globalHideNoInterest]);

  const plaintiffsList = useMemo(() => {
    const set = new Set();
    rawCases.forEach(c => {
      if (c['المدعي']) set.add(c['المدعي']);
    });
    return Array.from(set);
  }, [rawCases]);

  const defendantsList = useMemo(() => {
    const set = new Set();
    rawCases.forEach(c => {
      const def = c['المدعى_عليه'] || c['المدعى عليه'] || c['المطعون ضده'] || c['المطعون ضدها'];
      if (def) set.add(def);
    });
    return Array.from(set);
  }, [rawCases]);

  const tenantId = userData?.tenantId;
  const isAdmin = userData?.role === 'super_admin' || userData?.role === 'consultant';
  const isEmployee = userData?.role === 'employee';
  
  let empPermissions = null;
  if (isEmployee && settings?.employees) {
    const emp = settings.employees.find(e => `${e.username}@${tenantId}.ekhtsas.local` === userData?.email);
    if (emp && emp.permissions) {
      empPermissions = emp.permissions;
    }
  }

  const currentUserPermissions = {
    canEditData: isAdmin || (isEmployee && empPermissions?.canEditData),
    canDeleteData: isAdmin || (isEmployee && empPermissions?.canDeleteData),
    canManageRolls: isAdmin || (isEmployee && empPermissions?.canManageRolls),
    canManageTasks: isAdmin || (isEmployee && empPermissions?.canManageTasks)
  };

  useEffect(() => {
    if (!tenantId) {
      setRawCases([]);
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
      setRawCases(casesData);
      setDeletedCases(deletedData);
      setLoading(false);
    });

    const unsubSchema = onSnapshot(getSchemaRef(tenantId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().fields) {
        const obsoleteFields = ['الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم', 'الرول', 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي'];
        let cleanSchema = docSnap.data().fields.filter(f => f && !obsoleteFields.includes(f.id));
        
        const essentialFields = [
          { id: 'تصنيف الدعوى', label: 'تصنيف الدعوى', type: 'text', visible: true },
          { id: 'موضوع الدعوى', label: 'موضوع الدعوى', type: 'textarea', visible: true },
          { id: 'المقر المختار', label: 'المقر المختار', type: 'textarea', visible: true },
          { id: 'عنوان المدعي', label: 'عنوان المدعي / الطاعن', type: 'text', visible: true },
          { id: 'عنوان المدعى عليه', label: 'عنوان المدعى عليه / المطعون ضده', type: 'textarea', visible: true },
          { id: 'مكان الملف', label: 'مكان الملف', type: 'text', visible: true },
          { id: 'حكم محكمة أول درجة', label: 'حكم محكمة أول درجة (الرقم والسنة)', type: 'text', visible: true },
          { id: 'محكمة أول درجة', label: 'محكمة أول درجة', type: 'text', visible: true },
          { id: 'جلسة حكم أول درجة', label: 'جلسة حكم أول درجة', type: 'date', visible: true },
          { id: 'منطوق حكم أول درجة', label: 'منطوق حكم أول درجة', type: 'textarea', visible: true },
          { id: 'ملخص الطعن', label: 'ملخص الطعن وتفاصيله', type: 'textarea', visible: true },
          { id: 'طلبات الطاعن', label: 'طلبات الطاعن', type: 'textarea', visible: true },
          { id: 'نوع الجلسة', label: 'نوع الجلسة', type: 'text', visible: true },
          { id: 'تصنيف الحكم', label: 'تصنيف الحكم', type: 'text', visible: true },
          { id: 'نوع الحكم', label: 'نوع الحكم', type: 'text', visible: true }
        ];

        essentialFields.forEach(ef => {
           const existing = cleanSchema.find(s => s.id === ef.id);
           if (!existing) {
              cleanSchema.push(ef);
           } else if (existing.type !== ef.type && (ef.id === 'المقر المختار' || ef.id === 'عنوان المدعى عليه')) {
              // Convert specific fields to textarea to allow multiple lines
              existing.type = 'textarea';
           }
        });

        if (!cleanSchema.find(f => f.id === 'طلبات المدعي')) {
          cleanSchema.push({ id: 'طلبات المدعي', label: 'طلبات المدعي', type: 'textarea', visible: true });
        }

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
          { id: 'المقر المختار', label: 'المقر المختار', type: 'textarea', visible: true },
          { id: 'عنوان المدعي', label: 'عنوان المدعي / الطاعن', type: 'text', visible: true },
          { id: 'عنوان المدعى عليه', label: 'عنوان المدعى عليه / المطعون ضده', type: 'textarea', visible: true },
          { id: 'مكان الملف', label: 'مكان الملف', type: 'text', visible: true },
          { id: 'دعاوى منضمة', label: 'دعاوى منضمة', type: 'text', visible: true },
          { id: 'حكم محكمة أول درجة', label: 'حكم محكمة أول درجة (الرقم والسنة)', type: 'text', visible: true },
          { id: 'محكمة أول درجة', label: 'محكمة أول درجة', type: 'text', visible: true },
          { id: 'جلسة حكم أول درجة', label: 'جلسة حكم أول درجة', type: 'date', visible: true },
          { id: 'منطوق حكم أول درجة', label: 'منطوق حكم أول درجة', type: 'textarea', visible: true },
          { id: 'ملخص الطعن', label: 'ملخص الطعن وتفاصيله', type: 'textarea', visible: true },
          { id: 'طلبات الطاعن', label: 'طلبات الطاعن', type: 'textarea', visible: true },
          { id: 'طلبات المدعي', label: 'طلبات المدعي', type: 'textarea', visible: true },
          { id: 'نوع الجلسة', label: 'نوع الجلسة', type: 'text', visible: true },
          { id: 'تصنيف الحكم', label: 'تصنيف الحكم', type: 'text', visible: true },
          { id: 'نوع الحكم', label: 'نوع الحكم', type: 'text', visible: true }
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
      rollsData.sort((a, b) => getSafeDateObj(b.date) - getSafeDateObj(a.date));
      setRolls(rollsData);
    });

    const unsubTasks = onSnapshot(getTasksRef(tenantId), (snapshot) => {
      const tasksData = [];
      snapshot.forEach(doc => {
        tasksData.push({ id: doc.id, ...doc.data() });
      });
      tasksData.sort((a, b) => getSafeDateObj(b.createdAt) - getSafeDateObj(a.createdAt));
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
      
      // Get the existing case data to check transitions correctly if needed
      const existingCase = cases.find(c => c.id === caseId) || {};
      let payload = { ...caseData };

      // Apply Court Degree State Machine Logic
      const currentCourtDegree = settings?.courtDegree || 'أول درجة';
      const isSupreme = currentCourtDegree === 'ثان درجة' || currentCourtDegree === 'عليا' || currentCourtDegree === 'الإدارية العليا';
      
      const newSessionType = payload['نوع الجلسة'] || existingCase['نوع الجلسة'];
      const newDecision = payload['القرار'] || existingCase['القرار'];
      const hasJudgmentData = (payload['الحكم'] || existingCase['الحكم']) || (payload['منطوق الحكم'] || existingCase['منطوق الحكم']) || (payload['تصنيف الحكم'] || existingCase['تصنيف الحكم']);

      if (isSupreme) {
        // Supreme Court Transitions
        if (newSessionType === 'فحص' && newDecision === 'إحالة للموضوع') {
          payload['نوع الجلسة'] = 'موضوع';
        } else if (newSessionType === 'موضوع' && hasJudgmentData) {
          payload['نوع الجلسة'] = 'حكم';
        }
        // Note: If type is 'فحص' and hasJudgmentData is true, it intentionally remains 'فحص' per user rules.
      } else {
        // First Degree Transitions
        if ((newSessionType === 'مفوضين' || newSessionType === 'مرافعة') && hasJudgmentData) {
          payload['نوع الجلسة'] = 'حكم';
        }
      }

      const dataToSave = cleanUndefined({ ...payload, updatedAt: new Date().toISOString() });
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

      let payload = { ...caseData };
      const currentCourtDegree = settings?.courtDegree || 'أول درجة';
      const isSupreme = currentCourtDegree === 'ثان درجة' || currentCourtDegree === 'عليا' || currentCourtDegree === 'الإدارية العليا';
      const newSessionType = payload['نوع الجلسة'];
      const newDecision = payload['القرار'];
      const hasJudgmentData = payload['الحكم'] || payload['منطوق الحكم'] || payload['تصنيف الحكم'];

      if (isSupreme) {
        if (newSessionType === 'فحص' && newDecision === 'إحالة للموضوع') {
          payload['نوع الجلسة'] = 'موضوع';
        } else if (newSessionType === 'موضوع' && hasJudgmentData) {
          payload['نوع الجلسة'] = 'حكم';
        }
      } else {
        if ((newSessionType === 'مفوضين' || newSessionType === 'مرافعة') && hasJudgmentData) {
          payload['نوع الجلسة'] = 'حكم';
        }
      }

      const rawId = `${caseNo}-${year}-${Date.now()}`;
      const safeId = sanitizeId(rawId);
      await saveCaseToFirebase(safeId, payload);
      return safeId;
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

  const saveGlobalTask = async (idOrData, dataObj) => {
    if (!tenantId) return false;
    let id, data;
    if (typeof idOrData === 'object' && idOrData !== null) {
      data = idOrData;
      id = data.id;
    } else {
      id = idOrData;
      data = dataObj;
    }
    
    try {
      await setDoc(doc(getTasksRef(tenantId), id), data, { merge: true });
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const PREDEFINED_TASKS = [
    'شهادة من الجدول',
    'تعجيل من الوقف',
    'إخطار بالحكم',
    'إجراءات حفظ الملف',
    'إحالة الملف',
    'طلب/ استعجال المستندات',
    'خطاب فني للجهة الإدارية',
    'تحرير مذكرة دفاع/رأي',
    'عدم الممانعة / صيغة تنفيذية',
    'الإعلان للمدعى عليه',
    'الإعلان في مواجهة النيابة',
    'إجراء تحريات'
  ];

  const completeGlobalTask = async (taskId, notes) => {
    const t = globalTasks.find(task => task.id === taskId);
    if (!t) return false;

    const now = new Date().toISOString();
    const updatedTask = { ...t, status: 'completed', notes: notes || '', completedAt: now };
    await saveGlobalTask(updatedTask);

    if (t.linkedCases && t.linkedCases.length > 0) {
      for (const caseId of t.linkedCases) {
        const c = cases.find(c => c.id === caseId);
        if (c) {
          const proceduresList = Array.isArray(c.procedures) ? c.procedures : Object.values(c.procedures || {});
          const newProc = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5),
            title: `تنفيذ مهمة: ${t.title}`,
            date: now.split('T')[0],
            notes: notes || '',
            createdAt: now
          };
          
          let updateObj = { procedures: [...proceduresList, newProc] };
          
          // إحالة الملف -> شعبة المحال
          if (t.title === 'إحالة الملف') {
             updateObj['مكان الملف'] = 'شعبة المحال';
          }
          
          await saveCaseToFirebase(caseId, updateObj);
        }
      }
    }
    return true;
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

  const contextValue = useMemo(() => ({
      cases,
      rawCases,
      deletedCases,
      plaintiffsList,
      defendantsList,
      rolls,
      schema,
      settings,
      isAdmin,
      isEmployee,
      currentUser: currentUser?.email || '',
      currentUserPermissions,
      loading,
      globalHideNoInterest,
      setGlobalHideNoInterest,
      logoutAdmin: logout,
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
      deleteGlobalTask,
      PREDEFINED_TASKS,
      completeGlobalTask
  }), [
    cases, rawCases, deletedCases, plaintiffsList, defendantsList, rolls, schema, settings, isAdmin, isEmployee, 
    currentUser, currentUserPermissions, loading, globalHideNoInterest
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
