import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { onSnapshot, setDoc, doc, writeBatch, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import { db, getSettingsRef, getSchemaRef, getCasesRef, getRollsRef, getTasksRef, getViewingTasksRef, getActivityLogsRef } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { getSafeDateObj } from '../utils/dateUtils';
import { getCaseRole, getAppellantName, getAppelleeName, syncSessionRootFields } from '../utils/caseUtils';
import { isNoInterestRole, isOutOfJurisdictionRole } from '../constants/roleHelpers';
import { CasesContext } from './CasesContext';
import { SettingsContext } from './SettingsContext';
import { TasksContext } from './TasksContext';
const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const { userData, currentUser, logout } = useAuth();
  
  const [rawCases, setRawCases] = useState([]);
  const [deletedCases, setDeletedCases] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [globalTasks, setGlobalTasks] = useState([]);
  const [viewingTasks, setViewingTasks] = useState([]);
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
         const role = getCaseRole(c);
         return !isNoInterestRole(role);
      });
    }
    if (globalHideNoInterest === 2) {
      return rawCases.filter(c => {
         const role = getCaseRole(c);
         return !isNoInterestRole(role) && !isOutOfJurisdictionRole(role);
      });
    }
    return rawCases;
  }, [rawCases, globalHideNoInterest]);

  const plaintiffsList = useMemo(() => {
    const set = new Set();
    rawCases.forEach(c => {
      const p = getAppellantName(c);
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [rawCases]);

  const defendantsList = useMemo(() => {
    const set = new Set();
    rawCases.forEach(c => {
      const def = getAppelleeName(c);
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
      setViewingTasks([]);
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
        const obsoleteFields = ['الحكم', 'تصنيف الحكم', 'المنطوق', 'الرول', 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي'];
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
          { id: 'نوع الحكم', label: 'نوع الحكم', type: 'text', visible: true },
          { id: 'منطوق الحكم', label: 'منطوق الحكم', type: 'textarea', visible: true }
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

    const unsubViewingTasks = onSnapshot(getViewingTasksRef(tenantId), (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      data.sort((a, b) => getSafeDateObj(b.createdAt) - getSafeDateObj(a.createdAt));
      setViewingTasks(data);
    });

    return () => {
      unsubCases();
      unsubSchema();
      unsubSettings();
      unsubRolls();
      unsubTasks();
      unsubViewingTasks();
    };
  }, [tenantId]);

  const logoutAdmin = () => {
    logout();
  };

  const sanitizeId = (str) => String(str).replace(/[\/\\?%*:|"<>\s]/g, '_');

  const logActivity = async (action, entity, entityId, details) => {
    if (!tenantId) return;
    try {
      const email = currentUser?.email || '';
      const uName = email.split('@')[0];
      let displayName = uName;
      if (isAdmin) {
        displayName = settings?.consultantName || 'المستشار';
      } else if (isEmployee && settings?.employees) {
        const emp = settings.employees.find(e => e.username === uName);
        if (emp && emp.name) displayName = emp.name;
      }
      
      const logData = {
        action,
        entity,
        entityId,
        details,
        user: displayName,
        email: email,
        timestamp: new Date().toISOString()
      };
      await addDoc(getActivityLogsRef(tenantId), logData);
    } catch(e) {
      console.warn('Failed to log activity', e);
    }
  };

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
        }
        // Removed aggressive 'حكم' override to allow manual corrections and preliminary judgments
      }

      // Sync root fields with sessions
      payload = syncSessionRootFields(payload);

      const isNew = !cases.some(c => c.id === caseId);
      const dataToSave = cleanUndefined({ ...payload, updatedAt: new Date().toISOString() });
      delete dataToSave.id; 
      await setDoc(caseRef, dataToSave, { merge: true });
      
      if (isNew) {
        await logActivity(
          'إضافة',
          'ملف',
          caseId,
          `تمت إضافة ملف جديد رقم ${payload['رقم الدعوى'] || ''} لسنة ${payload['السنة'] || ''}`
        );
      } else {
        const caseNum = existingCase['رقم الدعوى'] || payload['رقم الدعوى'] || caseId;
        const changes = [];
        
        if (payload.documents && Array.isArray(payload.documents)) {
          const oldDocs = existingCase.documents || [];
          if (payload.documents.length > oldDocs.length) {
            const lastDoc = payload.documents[payload.documents.length - 1];
            changes.push(`رفع مستند/صورة (${lastDoc?.name || 'جديدة'})`);
          } else if (payload.documents.length < oldDocs.length) {
            changes.push(`حذف مستند/مرفق من الملف`);
          }
        }

        if (payload.coverImage && payload.coverImage !== existingCase.coverImage) {
          changes.push(`تعديل/رفع غلاف الصورة للملف`);
        }

        if (payload.sessions && Array.isArray(payload.sessions)) {
          const oldSessions = existingCase.sessions || [];
          if (payload.sessions.length > oldSessions.length) {
            changes.push(`إضافة جلسة جديدة`);
          }
        }

        if (payload.procedures && Array.isArray(payload.procedures)) {
          const oldProc = existingCase.procedures || [];
          if (payload.procedures.length > oldProc.length) {
            changes.push(`إضافة إجراء جديد للملف`);
          }
        }

        if (payload['تاريخ الجلسة'] && payload['تاريخ الجلسة'] !== existingCase['تاريخ الجلسة']) {
          changes.push(`تحديث تاريخ الجلسة إلى (${payload['تاريخ الجلسة']})`);
        }

        if (payload['القرار'] && payload['القرار'] !== existingCase['القرار']) {
          changes.push(`تحديث القرار إلى (${payload['القرار']})`);
        }

        const detailsText = changes.length > 0
          ? `${changes.join(' + ')} (ملف رقم ${caseNum})`
          : `تعديل بيانات الملف رقم ${caseNum}`;

        await logActivity('تعديل', 'ملف', caseId, detailsText);
      }

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
      const c = cases.find(x => x.id === caseId);
      if (permanent) {
        await deleteDoc(doc(getCasesRef(tenantId), safeId));
        await logActivity('حذف نهائي', 'ملف', safeId, `حذف نهائي للملف ${c?.['رقم الدعوى'] || ''}`);
      } else {
        await setDoc(doc(getCasesRef(tenantId), safeId), { 
          isDeleted: true, 
          deletedAt: new Date().toISOString() 
        }, { merge: true });
        await logActivity('حذف إلى الأرشيف', 'ملف', safeId, `تم نقل الملف ${c?.['رقم الدعوى'] || ''} إلى الأرشيف`);
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
      id = data.id || crypto.randomUUID();
    } else {
      id = idOrData || crypto.randomUUID();
      data = dataObj || {};
    }
    
    // Ensure the data has the generated ID
    data.id = id;
    const isNew = !globalTasks.some(t => t.id === id);

    try {
      await setDoc(doc(getTasksRef(tenantId), id), data, { merge: true });
      if (data.status !== 'completed' || isNew) {
        await logActivity(
          isNew ? 'إضافة' : 'تعديل',
          'مهمة',
          id,
          isNew ? `تمت إضافة مهمة: ${data.title}` : `تم تعديل مهمة: ${data.title}`
        );
      }
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
    
    await logActivity('إنجاز', 'مهمة', taskId, `تم إنجاز المهمة: ${t.title}`);

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
      const t = globalTasks.find(x => x.id === id);
      await deleteDoc(doc(getTasksRef(tenantId), id));
      await logActivity('حذف', 'مهمة', id, `تم حذف المهمة: ${t?.title || ''}`);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // ─── Viewing Tasks (مهام الإطلاع) — منفصلة تماماً ───────────────

  const saveViewingTask = async (idOrData, dataObj) => {
    if (!tenantId) return false;
    let id, data;
    if (typeof idOrData === 'object' && idOrData !== null) {
      data = idOrData;
      id = data.id || crypto.randomUUID();
    } else {
      id = idOrData || crypto.randomUUID();
      data = dataObj || {};
    }
    data.id = id;
    const isNew = !viewingTasks.some(t => t.id === id);
    try {
      await setDoc(doc(getViewingTasksRef(tenantId), id), data, { merge: true });
      if (data.status !== 'completed' || isNew) {
        await logActivity(
          isNew ? 'إضافة' : 'تعديل',
          'مهمة إطلاع',
          id,
          isNew ? `تمت إضافة مهمة إطلاع: ${data.title || data.notes || ''}` : `تم تعديل مهمة إطلاع: ${data.title || data.notes || ''}`
        );
      }
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteViewingTask = async (id) => {
    if (!tenantId) return false;
    try {
      const t = viewingTasks.find(x => x.id === id);
      await deleteDoc(doc(getViewingTasksRef(tenantId), id));
      await logActivity('حذف', 'مهمة إطلاع', id, `تم حذف مهمة إطلاع: ${t?.title || t?.notes || ''}`);
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const completeViewingTask = async (taskId, isCompleted = true) => {
    const t = viewingTasks.find(task => task.id === taskId);
    if (!t) return false;
    const now = new Date().toISOString();
    const updatedTask = {
      ...t,
      status: isCompleted ? 'completed' : 'pending',
      completedAt: isCompleted ? now : null
    };
    await saveViewingTask(updatedTask);
    if (isCompleted) {
      await logActivity('إنجاز', 'مهمة إطلاع', taskId, `تم إنجاز مهمة الإطلاع`);
    }
    return true;
  };

  const userEmail = currentUser?.email || '';
  const username = userEmail.split('@')[0];
    
  let currentUserName = username;
  if (isAdmin) {
    currentUserName = settings?.consultantName || 'المستشار';
  } else if (isEmployee && settings?.employees) {
    const emp = settings.employees.find(e => e.username === username);
    if (emp && emp.name) {
      currentUserName = emp.name;
    }
  }

  const settingsValue = useMemo(() => ({
    settings, isAdmin, isEmployee, currentUser: userEmail, currentUserName, currentUserPermissions,
    loading, saveSettingsToFirebase, logoutAdmin: logout
  }), [settings, isAdmin, isEmployee, userEmail, currentUserName, currentUserPermissions, loading, logout]);

  const tasksValue = useMemo(() => ({
    globalTasks, saveGlobalTask, deleteGlobalTask, completeGlobalTask, PREDEFINED_TASKS,
    viewingTasks, saveViewingTask, deleteViewingTask, completeViewingTask
  }), [globalTasks, viewingTasks]);

  const casesValue = useMemo(() => ({
    cases, rawCases, deletedCases, plaintiffsList, defendantsList, rolls, schema,
    globalHideNoInterest, setGlobalHideNoInterest,
    saveCaseToFirebase, createNewCase, checkDuplicateCase, saveBatchCasesToFirebase,
    saveSchemaToFirebase, deleteAllCases, deleteCaseFromFirebase, restoreCaseFromFirebase,
    saveRollToFirebase, deleteRollFromFirebase
  }), [cases, rawCases, deletedCases, plaintiffsList, defendantsList, rolls, schema, globalHideNoInterest]);

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
      currentUser: userEmail,
      currentUserName,
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
      // ─── المهام العادية ───
      globalTasks,
      saveGlobalTask,
      deleteGlobalTask,
      PREDEFINED_TASKS,
      completeGlobalTask,
      // ─── مهام الإطلاع (منفصلة تماماً) ───
      viewingTasks,
      saveViewingTask,
      deleteViewingTask,
      completeViewingTask,
  }), [
    cases, rawCases, deletedCases, plaintiffsList, defendantsList, rolls, schema, settings, isAdmin, isEmployee, 
    userEmail, currentUserName, currentUserPermissions, loading, globalHideNoInterest,
    globalTasks, viewingTasks, logout
  ]);

  return (
    <SettingsContext.Provider value={settingsValue}>
      <TasksContext.Provider value={tasksValue}>
        <CasesContext.Provider value={casesValue}>
          <AppContext.Provider value={contextValue}>
            {children}
          </AppContext.Provider>
        </CasesContext.Provider>
      </TasksContext.Provider>
    </SettingsContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
