import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppState';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { firebaseConfig, USERS_DIRECTORY_REF } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Upload, LogIn, LogOut, Check, ShieldCheck, Database, LayoutTemplate, Plus, Trash2, ArrowDownUp, Users, ShieldAlert, Settings as SettingsIcon, BookOpen, ClipboardList, Scale, Download, FileJson, ArrowUpFromLine, Copy, Clock, Fingerprint, Edit3, Search, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useUI } from '../context/UIContext';

export default function Settings() {
  const { isAdmin, loginAdmin, logoutAdmin, cases, schema, settings, saveSettingsToFirebase, deleteAllCases, saveBatchCasesToFirebase, saveSchemaToFirebase } = useAppContext();
  const { userData, login, currentUser } = useAuth();
  const { toast, showConfirm, showPrompt } = useUI();

  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const fileInputRef = useRef(null);

  // Sync state
  const [syncData, setSyncData] = useState(null); // { added: [], updated: [], kept: [] }
  const [isProcessing, setIsProcessing] = useState(false);

  // Schema state
  const [localSchema, setLocalSchema] = useState(schema || []);
  const [activeTab, setActiveTab] = useState('other'); // judgments, lists, schema, other, data
  const [localConsultantName, setLocalConsultantName] = useState(settings?.consultantName || settings?.officeName || '');

  // Advanced state
  const [localEmployees, setLocalEmployees] = useState(settings?.employees || []);
  const [localDecisions, setLocalDecisions] = useState(settings?.decisions || []);
  const [localReviewTasks, setLocalReviewTasks] = useState(settings?.reviewTasks || ['تصوير ملف', 'تقرير مفوضين', 'حكم أول درجة', 'تقرير خبراء', 'حافظة مستندات']);
  const [localRollTypes, setLocalRollTypes] = useState(settings?.rollTypes || ['رول جلسة', 'حصر الفحص', 'حصر الموضوع', 'رول أحكام']);
  const [localNumberFormat, setLocalNumberFormat] = useState(settings?.numberFormat || 'en');
  const [localDateFormat, setLocalDateFormat] = useState(settings?.dateFormat || 'dd/MM/yyyy');
  const [localRoles, setLocalRoles] = useState(settings?.roles || ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص']);
  const [localSessionTypes, setLocalSessionTypes] = useState(settings?.sessionTypes || []);
  const [localFileLocations, setLocalFileLocations] = useState(settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي']);
  const [localViewingTasksPrintTemplate, setLocalViewingTasksPrintTemplate] = useState(settings?.viewingTasksPrintTemplate || {
    title: 'كشف مهام الإطلاع وتصوير المستندات',
    showCreationDate: true,
    showConsultant: true,
    showRoll: true,
    showCaseNumber: true,
    showAppellant: true,
    showAppellee: true,
    showRequiredDocs: true,
    showSessionDate: true,
    showDecision: true,
    showStatus: true
  });
  const [localViewingTasksPrintOrder, setLocalViewingTasksPrintOrder] = useState(settings?.viewingTasksPrintOrder || [
    'showRoll', 
    'showCaseNumber', 
    'showAppellant', 
    'showAppellee', 
    'showSessionDate', 
    'showSessionType', 
    'showDecision', 
    'showStatus',
    'showRequiredDocs'
  ]);
  const [localCommonProcedures, setLocalCommonProcedures] = useState(settings?.commonProcedures || ['إيداع مذكرة دفاع', 'تقديم حافظة مستندات', 'طلب تصوير ملف', 'سداد الأمانة', 'حضور الجلسة']);
  const [localCaseClassifications, setLocalCaseClassifications] = useState(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']);
  const [localCourtDegree, setLocalCourtDegree] = useState(settings?.courtDegree || 'أول درجة');
  const [localCourtSpecialization, setLocalCourtSpecialization] = useState(settings?.courtSpecialization || 'قضاء إداري');

  const migrateJudgmentRule = (rule) => {
    if (rule.triggerField) {
      return {
        name: rule.name || '',
        conditions: {
          role: '',
          category: rule.triggerField === 'category' ? (rule.triggerValue || '') : '',
          classification: rule.triggerField === 'classification' ? (rule.triggerValue || '') : '',
          type: ''
        },
        actions: {
          category: '',
          classification: rule.setClassification || '',
          type: rule.setType || '',
          text: rule.setText || ''
        }
      };
    }
    return {
      name: rule.name || '',
      conditions: rule.conditions || { role: '', category: '', classification: '', type: '', sessionType: '', decision: '' },
      actions: rule.actions || { category: '', classification: '', type: '', text: '' }
    };
  };

  const [localJudgmentDefaults, setLocalJudgmentDefaults] = useState((settings?.judgmentDefaults || []).map(migrateJudgmentRule));
  const [localJudgmentCategories, setLocalJudgmentCategories] = useState(settings?.judgmentCategories || ['نهائي وبات (عليا)', 'قرار فحص', 'حكم أول درجة', 'حكم منه للخصومة', 'حكم غير منه للخصومة', 'تمهيدي']);
  const [localJudgmentClassifications, setLocalJudgmentClassifications] = useState(settings?.judgmentClassifications || ['صالح', 'ضد', 'مختلط', 'وقف جزائي', 'اعتبار', 'خبراء']);
  const [localJudgmentTypes, setLocalJudgmentTypes] = useState(settings?.judgmentTypes || [
    'قبول', 'إلغاء', 'رفض', 'عدم قبول', 'سقوط الخصومة', 'شطب', 'اعتبار الدعوى كأن لم تكن', 'وقف جزائي', 'انقطاع سير الخصومة', 'إحالة', 'إحالة للخبراء'
  ]);
  const [localDeadlineRules, setLocalDeadlineRules] = useState(settings?.deadlineRules || [
    { name: 'الطعن العادي', days: 60, targetRole: 'طاعنين', description: 'ميعاد الطعن العادي 60 يوماً' },
    { name: 'تعجيل من الوقف الجزائي', days: 15, triggerAfterDays: 30, targetRole: 'طاعنين', description: 'يجب التعجيل خلال 15 يوماً بعد مرور شهر من الوقف' }
  ]);
  const [expandedRules, setExpandedRules] = useState([]);
  const [rulesSearchQuery, setRulesSearchQuery] = useState('');
  const [expandedRuleGroups, setExpandedRuleGroups] = useState(['قواعد عامة']); // Default expand first/general group
  const [localMemoCalculationMode, setLocalMemoCalculationMode] = useState(settings?.memoCalculationMode || 'session_date');
  const [localScratchpadPosition, setLocalScratchpadPosition] = useState(settings?.scratchpadPosition || 'right');
  const [deletePassword, setDeletePassword] = useState('');
  const backupInputRef = useRef(null);
  const [backupRestoreStatus, setBackupRestoreStatus] = useState(null); // { type: 'success'|'error'|'preview', data: ... }

  // ===== BACKUP FUNCTIONS =====
  const handleExportBackup = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      cases: cases,
      settings: settings,
      schema: schema,
    };
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `اختصاصي-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`تم تصدير نسخة احتياطية شاملة (${cases.length} قضية)`, 'success');
  };

  const handleExportExcel = () => {
    if (!cases || cases.length === 0) { toast('لا توجد بيانات للتصدير', 'error'); return; }
    const rows = cases.map(c => {
      const base = {};
      Object.keys(c).forEach(k => {
        if (typeof c[k] !== 'object') base[k] = c[k];
      });
      base['عدد الجلسات'] = (c.sessions || []).length;
      base['عدد المرفقات'] = (c.documents || []).length;
      base['عدد الإجراءات'] = (c.procedures || []).length;
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'القضايا');
    XLSX.writeFile(wb, `اختصاصي-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast(`تم تصدير ${cases.length} قضية إلى Excel`, 'success');
  };

  const handleDownloadTemplate = () => {
    // Generate empty template based on current visible schema
    const headers = {};
    localSchema.filter(s => s.visible).forEach(s => {
      headers[s.id] = "";
    });
    
    // Add a helper note row
    const noteRow = {};
    localSchema.filter(s => s.visible).forEach(s => {
      noteRow[s.id] = s.primary ? "حقل إجباري" : "اختياري";
    });

    const ws = XLSX.utils.json_to_sheet([noteRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب إدخال البيانات');
    XLSX.writeFile(wb, `قالب-اختصاصي-لإدخال-البيانات.xlsx`);
    toast('تم تحميل قالب الإكسيل بنجاح', 'success');
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.cases || !Array.isArray(data.cases)) {
        toast('الملف غير صالح - لا يحتوي على بيانات قضايا', 'error');
        return;
      }
      setBackupRestoreStatus({
        type: 'preview',
        data: data,
        casesCount: data.cases.length,
        exportedAt: data.exportedAt,
      });
    } catch (err) {
      toast('فشل قراءة الملف - تأكد من أنه ملف JSON صحيح', 'error');
    }
    if (backupInputRef.current) backupInputRef.current.value = '';
  };

  const confirmRestoreBackup = async () => {
    if (!backupRestoreStatus?.data) return;
    const confirmed = await showConfirm(
      'تأكيد الاستعادة',
      `سيتم استبدال البيانات الحالية بـ ${backupRestoreStatus.casesCount} قضية من النسخة الاحتياطية. هل تريد المتابعة؟`
    );
    if (!confirmed) return;
    setIsProcessing(true);
    const { data } = backupRestoreStatus;
    try {
      await saveBatchCasesToFirebase(data.cases);
      if (data.settings) await saveSettingsToFirebase(data.settings);
      if (data.schema) await saveSchemaToFirebase(data.schema);
      setBackupRestoreStatus({ type: 'success', casesCount: data.cases.length });
      toast(`✅ تم استعادة ${data.cases.length} قضية بنجاح`, 'success');
    } catch (err) {
      toast('حدث خطأ أثناء الاستعادة', 'error');
      setBackupRestoreStatus(null);
    }
    setIsProcessing(false);
  };

  // Sync settings when loaded
  React.useEffect(() => {
    setLocalEmployees(settings?.employees || []);
    setLocalDecisions(settings?.decisions || []);
    setLocalReviewTasks(settings?.reviewTasks || ['تصوير ملف', 'تقرير مفوضين', 'حكم أول درجة', 'تقرير خبراء', 'حافظة مستندات']);
    setLocalRollTypes(settings?.rollTypes || ['رول جلسة', 'حصر الفحص', 'حصر الموضوع', 'رول أحكام']);
    setLocalNumberFormat(settings?.numberFormat || 'en');
    setLocalDateFormat(settings?.dateFormat || 'dd/MM/yyyy');
    setLocalRoles(settings?.roles || ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص']);
    setLocalSessionTypes(settings?.sessionTypes || []);
    setLocalFileLocations(settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي']);
    setLocalCommonProcedures(settings?.commonProcedures || ['إيداع مذكرة دفاع', 'تقديم حافظة مستندات', 'طلب تصوير ملف', 'سداد الأمانة', 'حضور الجلسة']);
    setLocalCaseClassifications(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']);
    setLocalJudgmentCategories(settings?.judgmentCategories || ['نهائي وبات (عليا)', 'قرار فحص', 'حكم أول درجة', 'حكم منه للخصومة', 'حكم غير منه للخصومة', 'تمهيدي']);
    setLocalJudgmentClassifications(settings?.judgmentClassifications || ['صالح', 'ضد', 'مختلط', 'اعتبار', 'وقف جزائي', 'وقف تعليقي', 'خبراء']);
    setLocalJudgmentTypes(settings?.judgmentTypes || ['قبول', 'إلغاء', 'رفض', 'عدم قبول', 'سقوط الخصومة', 'شطب', 'اعتبار الدعوى كأن لم تكن', 'وقف جزائي', 'انقطاع سير الخصومة', 'إحالة', 'إحالة للخبراء']);
    setLocalCourtDegree(settings?.courtDegree || 'أول درجة');
    setLocalCourtSpecialization(settings?.courtSpecialization || 'قضاء إداري');

    setLocalDeadlineRules(settings?.deadlineRules || [
      { name: 'الطعن العادي', days: 60, targetRole: 'طاعنين', description: 'ميعاد الطعن العادي 60 يوماً' },
      { name: 'تعجيل من الوقف الجزائي', days: 15, triggerAfterDays: 30, targetRole: 'طاعنين', description: 'يجب التعجيل خلال 15 يوماً بعد مرور شهر من الوقف' }
    ]);
  }, [settings]);

  const handleSaveSettings = async () => {
    // Validate employees before processing
    for (const emp of localEmployees) {
      if (emp.password && emp.password.length > 0 && emp.password.length < 6) {
        toast(`كلمة المرور للموظف "${emp.name || emp.username}" يجب أن تكون 6 أحرف/أرقام على الأقل`, 'error');
        return; // Stop saving
      }
    }

    setIsProcessing(true);

    // Create accounts for new employees
    if (userData?.tenantId) {
      for (const emp of localEmployees) {
        if (!emp.username || !emp.password) continue;

        try {
          const safeTenantId = userData.tenantId.replace(/_/g, '-').trim();
          const email = `${emp.username.toLowerCase().trim()}@${safeTenantId}.ekhtsas.local`;

          const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              password: emp.password,
              returnSecureToken: false
            })
          });

          const data = await response.json();
          if (response.ok && data.localId) {
            // Write employee role to directory
            await setDoc(doc(USERS_DIRECTORY_REF, data.localId), {
              email: email,
              role: 'employee',
              tenantId: userData.tenantId,
              name: emp.name
            });
          } else if (!response.ok) {
            if (data.error?.message === 'EMAIL_EXISTS') {
              // Attempt to update password if changed
              const oldEmp = settings?.employees?.find(e => e.username.toLowerCase() === emp.username.toLowerCase());
              if (oldEmp && oldEmp.password !== emp.password) {
                try {
                  const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: oldEmp.password, returnSecureToken: true })
                  });
                  const signInData = await signInRes.json();

                  if (signInRes.ok && signInData.idToken) {
                    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ idToken: signInData.idToken, password: emp.password, returnSecureToken: false })
                    });
                  }
                } catch (err) {
                  console.error("Failed to update employee password", err);
                }
              }
            } else {
              console.error("Firebase Auth Error for employee:", data.error?.message);
              toast(`تعذر إنشاء/تحديث حساب للموظف ${emp.username}: ${data.error?.message || 'خطأ غير معروف'}`, 'error');
            }
          }
        } catch (error) {
          console.error("Error provisioning employee:", error);
          toast(`فشل الاتصال لإنشاء حساب الموظف ${emp.username}`, 'error');
        }
      }
    }

    await saveSettingsToFirebase({
      ...settings,
      consultantName: localConsultantName,
      viewingTasksPrintTemplate: localViewingTasksPrintTemplate,
      viewingTasksPrintOrder: localViewingTasksPrintOrder,
      employees: localEmployees,
      decisions: localDecisions,
      reviewTasks: localReviewTasks,
      rollTypes: localRollTypes,
      numberFormat: localNumberFormat,
      dateFormat: localDateFormat,
      roles: localRoles,
      sessionTypes: localSessionTypes,
      fileLocations: localFileLocations,
      commonProcedures: localCommonProcedures,
      caseClassifications: localCaseClassifications,
      judgmentCategories: localJudgmentCategories,
      judgmentClassifications: localJudgmentClassifications,
      judgmentTypes: localJudgmentTypes,
      courtDegree: localCourtDegree,
      courtSpecialization: localCourtSpecialization,

      judgmentDefaults: localJudgmentDefaults,
      deadlineRules: localDeadlineRules,
      memoCalculationMode: localMemoCalculationMode,
      scratchpadPosition: localScratchpadPosition
    });
    setIsProcessing(false);
    toast('تم حفظ الإعدادات المتقدمة بنجاح', 'success');
  };

  const handleResetConfirms = () => {
    localStorage.removeItem('disabledConfirms');
    toast('تم إعادة تفعيل جميع الرسائل التأكيدية بنجاح!', 'success');
  };

  const handleDeleteAll = async () => {
    if (!deletePassword) {
      toast('يرجى إدخال كلمة المرور!', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      // Verify with Firebase using current user email and provided password
      if (currentUser?.email) {
        await login(currentUser.email, deletePassword);
      }
    } catch (err) {
      setIsProcessing(false);
      toast('كلمة المرور غير صحيحة!', 'error');
      return;
    }

    setIsProcessing(false);
    const confirmed = await showConfirm('تحذير نهائي', 'هل أنت متأكد من مسح جميع البيانات بشكل لا رجعة فيه؟');

    if (confirmed) {
      setIsProcessing(true);
      const success = await deleteAllCases();
      setIsProcessing(false);
      if (success) {
        toast('تم مسح جميع البيانات بنجاح.', 'success');
        setDeletePassword('');
      } else {
        toast('حدث خطأ أثناء المسح.', 'error');
      }
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginAdmin(password)) {
      setLoginError('');
      setPassword('');
      setLocalSchema(schema);
    } else {
      setLoginError('كلمة المرور غير صحيحة');
    }
  };

  const sanitizeId = (str) => String(str).replace(/[\/\\?%*:|"<>\s]/g, '_');

  const getCaseKey = (c) => {
    const id = c['رقم الدعوى'] || c['رقم القضية'] || c['رقم_الدعوى'] || '';
    const year = c['السنة'] || c['سنة'] || c['year'] || '';
    if (!id && !year) return sanitizeId(`unnamed-${Date.now()}-${Math.random()}`);
    return sanitizeId(`${id}-${year}`);
  };

  const processExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setSyncData(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      const excelCases = rawData.map(row => {
        const clean = {};
        for (let k in row) {
          let val = row[k];
          // Fix Excel Serial Dates for columns that look like dates
          if (typeof val === 'number' && val > 30000 && val < 70000 && (k.includes('جلسة') || k.includes('تاريخ') || k.includes('حكم'))) {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            val = date.toISOString().split('T')[0];
          }
          clean[k.trim()] = String(val).trim();
        }
        return clean;
      });

      // We do NOT dynamically update the schema anymore based on user feedback.
      // Filter out any columns from excelCases that do not exist in the current schema
      const schemaKeys = localSchema.map(s => s.id);
      
      const mappedExcelCases = excelCases
        .filter(ec => {
           const val = String(ec['رقم الدعوى'] || ec['رقم القضية'] || ec['رقم_الدعوى'] || '').trim();
           return val !== '' && val !== 'حقل إجباري' && val !== 'اختياري';
        })
        .map(ec => {
        const mapped = {};
        for (let k in ec) {
          if (schemaKeys.includes(k)) {
            mapped[k] = ec[k];
          }
        }
        return mapped;
      });

      const existingMap = new Map();
      cases.forEach(c => existingMap.set(c.id || getCaseKey(c), c));

      let added = 0;
      let updated = 0;
      const newMergedData = [];

      mappedExcelCases.forEach(excelCase => {
        const key = getCaseKey(excelCase);
        if (existingMap.has(key)) {
          const existingCase = existingMap.get(key);
          const merged = { ...existingCase, ...excelCase, id: key };

          // Basic diff ignoring id
          const { id: id1, ...c1 } = existingCase;
          const { id: id2, ...c2 } = merged;
          if (JSON.stringify(c1) !== JSON.stringify(c2)) {
            updated++;
          }
          newMergedData.push(merged);
          existingMap.delete(key);
        } else {
          added++;
          newMergedData.push({ ...excelCase, id: key });
        }
      });

      // Keep rest
      const kept = existingMap.size;

      setSyncData({
        added,
        updated,
        kept,
        total: newMergedData,
        ready: true
      });

    } catch (err) {
      toast("حدث خطأ أثناء قراءة الملف", "error");
      console.error(err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmSync = async () => {
    if (!syncData || !syncData.total) return;
    setIsProcessing(true);
    const success = await saveBatchCasesToFirebase(syncData.total);
    setIsProcessing(false);
    if (success) {
      toast('تم تحديث ومزامنة البيانات بنجاح!', 'success');
      setSyncData(null);
    } else {
      toast('حدث خطأ أثناء الحفظ.', 'error');
    }
  };

  const addSchemaField = () => {
    const id = `field_${Date.now()}`;
    setLocalSchema([...localSchema, { id, label: 'حقل جديد', type: 'text', visible: true, primary: false }]);
  };

  const updateSchemaField = (index, key, value) => {
    const newSchema = [...localSchema];
    newSchema[index][key] = value;
    setLocalSchema(newSchema);
  };

  const removeSchemaField = (index) => {
    const newSchema = localSchema.filter((_, i) => i !== index);
    setLocalSchema(newSchema);
  };

  const saveSchema = async () => {
    setIsProcessing(true);
    await saveSchemaToFirebase(localSchema);
    setIsProcessing(false);
    toast('تم حفظ بنية البيانات بنجاح!', 'success');
  };

  const handleCleanupSchema = async () => {
    const confirmed = await showConfirm('تأكيد تنظيف الحقول', 'سيتم دمج الحقول المكررة (سنة، year) في (السنة)، و(رقم القضية، رقم_الدعوى) في (رقم الدعوى). هل أنت متأكد؟');
    if (!confirmed) return;

    setIsProcessing(true);
    
    const duplicatesToRemove = ['سنة', 'year', 'رقم القضية', 'رقم_الدعوى', 'المدعى_عليه'];
    const newSchema = localSchema.filter(f => !duplicatesToRemove.includes(f.id));
    
    setLocalSchema(newSchema);
    await saveSchemaToFirebase(newSchema);
    
    toast('تم تنظيف الحقول بنجاح', 'success');
    setIsProcessing(false);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 bg-navy-50 rounded-2xl mx-auto flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-navy-900" />
          </div>
          <div>
            <h2 className="text-xl font-black text-navy-900">تسجيل دخول الإدارة</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-sm font-bold focus:outline-none focus:border-navy-900"
              />
              {loginError && <p className="text-rose-500 text-[11px] font-bold mt-2">{loginError}</p>}
            </div>
            <button type="submit" className="w-full bg-navy-900 hover:bg-navy-800 text-amber-300 font-bold py-3 rounded-xl">دخول</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6">

      {/* Admin Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-navy-900">لوحة الإدارة</h2>
          </div>
        </div>
        <button onClick={logoutAdmin} className="text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-2 rounded-xl flex items-center gap-1.5">
          <LogOut className="w-3 h-3" /> تسجيل خروج
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-1 rounded-xl flex-wrap">
        <button onClick={() => setActiveTab('other')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'other' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>⚙️ الإعدادات الأساسية</button>
        <button onClick={() => setActiveTab('judgments')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'judgments' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>⚖️ الجلسات والأحكام</button>
        <button onClick={() => setActiveTab('lists')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'lists' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>📁 قوائم النظام</button>
        <button onClick={() => setActiveTab('deadlines')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'deadlines' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>⏰ المواعيد</button>
        <button onClick={() => setActiveTab('schema')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'schema' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>🧩 هيكلة الحقول</button>
        <button onClick={() => setActiveTab('data')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'data' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>🛡️ بيانات ونسخ</button>
        <button onClick={() => setActiveTab('print')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'print' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>🖨️ الطباعة</button>
      </div>

      {/* PRINT TAB */}
      {activeTab === 'print' && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
          <details className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-0" open>
            <summary className="flex items-center justify-between pb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-slate-100 transition-colors">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-navy-900" />
                <h3 className="font-black text-sm text-navy-900">نموذج كشف مهام الإطلاع</h3>
              </div>
              <ArrowDownUp className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="pt-4 space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-500 block mb-1">عنوان الكشف الافتراضي</label>
                <input
                  type="text"
                  value={localViewingTasksPrintTemplate.title}
                  onChange={(e) => setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, title: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-xs text-navy-900 mb-3">بيانات الكشف الأساسية</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'showCreationDate', label: 'إظهار تاريخ التحرير' },
                      { key: 'showConsultant', label: 'إظهار اسم المستشار / توقيع الموظف' }
                    ].map(field => (
                      <div key={field.key} className={`flex items-center justify-between p-3 rounded-xl border ${localViewingTasksPrintTemplate[field.key] ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'} transition-all cursor-pointer shadow-sm`} onClick={() => setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, [field.key]: !localViewingTasksPrintTemplate[field.key]})}>
                        <span className="text-[11px] font-black text-navy-900">{field.label}</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${localViewingTasksPrintTemplate[field.key] ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localViewingTasksPrintTemplate[field.key] ? 'left-0.5' : 'right-0.5'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-xs text-navy-900">أعمدة الجدول وترتيبها</h4>
                    <span className="text-[10px] text-slate-500 font-bold bg-slate-200/70 px-2 py-0.5 rounded-full">استخدم الأسهم للترتيب</span>
                  </div>
                  <div className="space-y-2">
                    {localViewingTasksPrintOrder.map((key, index) => {
                      const fieldLabels = {
                        showRoll: 'عمود الرول',
                        showCaseNumber: 'عمود رقم الدعوى',
                        showAppellant: 'عمود المدعي',
                        showAppellee: 'عمود المدعى عليه',
                        showRequiredDocs: 'عمود المستندات المطلوبة (الملاحظات)',
                        showSessionDate: 'عمود تاريخ الجلسة',
                        showSessionType: 'عمود نوع الجلسة',
                        showDecision: 'عمود القرار',
                        showStatus: 'عمود حالة المهمة'
                      };
                      const label = fieldLabels[key];
                      const isDisabled = key === 'showRequiredDocs';

                      const moveUp = (e) => {
                        e.stopPropagation();
                        if (index === 0) return;
                        const newOrder = [...localViewingTasksPrintOrder];
                        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                        setLocalViewingTasksPrintOrder(newOrder);
                      };

                      const moveDown = (e) => {
                        e.stopPropagation();
                        if (index === localViewingTasksPrintOrder.length - 1) return;
                        const newOrder = [...localViewingTasksPrintOrder];
                        [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
                        setLocalViewingTasksPrintOrder(newOrder);
                      };

                      return (
                        <div key={key} className={`flex items-center justify-between p-3 rounded-xl border ${localViewingTasksPrintTemplate[key] ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'} transition-all cursor-pointer shadow-sm group hover:border-indigo-300`} onClick={() => !isDisabled && setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, [key]: !localViewingTasksPrintTemplate[key]})}>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-0.5 z-10 bg-white/60 p-0.5 rounded-lg border border-slate-100 opacity-70 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={moveUp} disabled={index === 0} className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all">
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button type="button" onClick={moveDown} disabled={index === localViewingTasksPrintOrder.length - 1} className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all">
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[11px] font-black text-navy-900">{label} {isDisabled ? <span className="text-red-500 mr-1">(إلزامي ولا يمكن إخفاءه)</span> : ''}</span>
                          </div>
                          <div className={`w-8 h-4 rounded-full relative transition-colors ${localViewingTasksPrintTemplate[key] ? 'bg-indigo-600' : 'bg-slate-300'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localViewingTasksPrintTemplate[key] ? 'left-0.5' : 'right-0.5'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </details>

          <div className="pt-2">
            <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm hover:bg-navy-800 transition disabled:opacity-50">
              {isProcessing ? 'جاري الحفظ...' : 'حفظ الإعدادات الأساسية والطباعة'}
            </button>
          </div>
        </div>
      )}

      {/* DATA TAB: Sync + Backup merged */}
      {activeTab === 'data' && (
        <div className="space-y-4 animate-in fade-in zoom-in duration-300">

          {/* Smart Sync Section */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Database className="w-5 h-5 text-navy-900" />
              <h3 className="font-black text-sm text-navy-900">مزامنة البيانات من Excel (Smart Sync)</h3>
            </div>
            <p className="text-[11px] font-bold text-slate-500">استيراد ملف إكسيل ودمجه بذكاء مع البيانات الحالية دون حذف أي بيانات موجودة.</p>

            <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={processExcel} className="hidden" />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => handleDownloadTemplate()} className="flex flex-col items-center gap-2 p-4 border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 text-emerald-700 font-bold rounded-2xl transition">
                <Download className="w-6 h-6 text-emerald-500" />
                <span className="text-xs text-center">تحميل قالب إكسيل فارغ</span>
              </button>
              
              <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-slate-300 hover:border-navy-900 hover:bg-slate-50 text-slate-600 font-bold rounded-2xl transition">
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-navy-900"></div>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-amber-500" />
                    <span className="text-xs text-center">رفع ملف إكسيل للمزامنة</span>
                  </>
                )}
              </button>
            </div>

            {syncData && syncData.ready && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-4">
                <h4 className="font-black text-sm text-emerald-900 flex items-center gap-2">
                  <Check className="w-4 h-4" /> تحليل البيانات جاهز
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2 shadow-sm border border-emerald-100">
                    <p className="text-lg font-black text-emerald-600">{syncData.added}</p>
                    <p className="text-[10px] font-bold text-slate-500">قضية جديدة</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 shadow-sm border border-emerald-100">
                    <p className="text-lg font-black text-blue-600">{syncData.updated}</p>
                    <p className="text-[10px] font-bold text-slate-500">تم تحديثها</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 shadow-sm border border-emerald-100">
                    <p className="text-lg font-black text-slate-600">{syncData.kept}</p>
                    <p className="text-[10px] font-bold text-slate-500">بدون تغيير</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSyncData(null)} className="flex-1 bg-white border border-slate-200 py-2 rounded-xl text-xs font-bold">إلغاء</button>
                  <button onClick={confirmSync} className="flex-[2] bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs shadow-sm">حفظ ومزامنة</button>
                </div>
              </div>
            )}
          </div>

          {/* Audit Logs Section */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">سجل النشاطات (مراقبة الموظفين)</h3>
            </div>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              تتبع جميع عمليات الإضافة والتعديل والحذف التي يقوم بها الموظفون داخل التطبيق مع تسجيل الوقت والتفاصيل.
            </p>
            <div className="mt-4">
              <Link 
                to="/audit-logs" 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition rounded-xl px-4 py-3 font-black text-xs"
              >
                <Activity className="w-4 h-4" />
                فتح سجل النشاطات
              </Link>
            </div>
          </div>

          {/* Export Section */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Download className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-sm text-navy-900">تصدير نسخة احتياطية</h3>
            </div>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              تصدير نسخة احتياطية شاملة (قضايا، جلسات، مرفقات، إجراءات، إعدادات) بصيغة JSON أو Excel.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportBackup}
                className="flex flex-col items-center gap-2 p-4 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl transition group"
              >
                <div className="w-10 h-10 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center transition">
                  <FileJson className="w-5 h-5 text-emerald-700" />
                </div>
                <span className="text-xs font-black text-emerald-800">JSON شامل</span>
                <span className="text-[10px] font-bold text-emerald-600 text-center">كل البيانات + الإعدادات</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 hover:border-blue-400 rounded-2xl transition group"
              >
                <div className="w-10 h-10 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center transition">
                  <Download className="w-5 h-5 text-blue-700" />
                </div>
                <span className="text-xs font-black text-blue-800">Excel مبسط</span>
                <span className="text-[10px] font-bold text-blue-600 text-center">البيانات الأساسية فقط</span>
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-[11px] font-bold text-slate-600">
                📊 إجمالي البيانات الحالية: <span className="text-navy-900 font-black">{cases.length} قضية</span>
              </p>
            </div>
          </div>

          {/* Import/Restore Section */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ArrowUpFromLine className="w-5 h-5 text-amber-600" />
              <h3 className="font-black text-sm text-navy-900">استعادة من نسخة احتياطية</h3>
            </div>
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              استعد بيانات كاملة من ملف JSON تم تصديره سابقاً. سيتم دمج البيانات بذكاء مع البيانات الحالية.
            </p>

            <input type="file" accept=".json" ref={backupInputRef} onChange={handleImportBackup} className="hidden" />

            {!backupRestoreStatus && (
              <button
                onClick={() => backupInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50 text-slate-600 font-bold py-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition"
              >
                <ArrowUpFromLine className="w-7 h-7 text-amber-500" />
                <span className="text-sm">اختر ملف النسخة الاحتياطية (.json)</span>
              </button>
            )}

            {backupRestoreStatus?.type === 'preview' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <h4 className="font-black text-sm text-amber-900 flex items-center gap-2">
                  <Check className="w-4 h-4" /> تم قراءة الملف بنجاح
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg p-2 border border-amber-100 text-center">
                    <p className="text-lg font-black text-amber-700">{backupRestoreStatus.casesCount}</p>
                    <p className="text-[10px] font-bold text-slate-500">قضية في النسخة</p>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-amber-100 text-center">
                    <p className="text-lg font-black text-navy-900">{cases.length}</p>
                    <p className="text-[10px] font-bold text-slate-500">قضية حالية</p>
                  </div>
                </div>
                {backupRestoreStatus.exportedAt && (
                  <p className="text-[10px] font-bold text-slate-500">
                    تاريخ التصدير: {new Date(backupRestoreStatus.exportedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setBackupRestoreStatus(null)} className="flex-1 bg-white border border-slate-200 py-2 rounded-xl text-xs font-bold">إلغاء</button>
                  <button onClick={confirmRestoreBackup} disabled={isProcessing} className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-xs shadow-sm disabled:opacity-50">
                    {isProcessing ? 'جاري الاستعادة...' : '✅ تأكيد الاستعادة'}
                  </button>
                </div>
              </div>
            )}

            {backupRestoreStatus?.type === 'success' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
                <p className="text-2xl">✅</p>
                <p className="font-black text-emerald-800">تمت الاستعادة بنجاح!</p>
                <p className="text-[11px] font-bold text-emerald-600">تم استعادة {backupRestoreStatus.casesCount} قضية</p>
                <button onClick={() => setBackupRestoreStatus(null)} className="text-xs font-bold text-emerald-700 underline">إغلاق</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DEADLINES TAB */}
      {activeTab === 'deadlines' && (
        <details className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-0 animate-in fade-in zoom-in duration-300">
          <summary className="flex items-center justify-between pb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-slate-100 transition-colors">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-rose-600" />
              <h3 className="font-black text-sm text-navy-900"><span className="text-[12px] opacity-70 group-open:hidden ml-1">▼</span><span className="text-[12px] opacity-70 hidden group-open:inline ml-1">▲</span> محرك قواعد المواعيد الإجرائية</h3>
            </div>
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}><button
              onClick={() => {
                setLocalDeadlineRules([...localDeadlineRules, { name: 'قاعدة جديدة', days: 30, targetRole: 'طاعنين', description: '' }]);
              }}
              className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-200"
            >
              <Plus className="w-4 h-4" /> إضافة قاعدة
            </button></div></summary>
          <div className="pt-2 space-y-4">

            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              تتحكم هذه القواعد في التنبيهات التي تظهر في لوحة القيادة. إذا كانت القاعدة مرتبطة بـ "الطعن" سيتم حسابها من تاريخ الحكم. وإذا كانت مرتبطة بـ "وقف جزائي" سيتم حسابها من تاريخ الجلسة بعد انقضاء مدة الوقف.
            </p>

            <div className="space-y-3">
              {localDeadlineRules.map((rule, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200 items-start sm:items-center">
                  <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">اسم القاعدة (مثال: الطعن، وقف جزائي)</label>
                      <input
                        type="text"
                        value={rule.name}
                        onChange={e => {
                          const newRules = [...localDeadlineRules];
                          newRules[idx].name = e.target.value;
                          setLocalDeadlineRules(newRules);
                        }}
                        className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">صفة المصلحة الموجهة لها التنبيه</label>
                      <select
                        value={rule.targetRole || 'طاعنين'}
                        onChange={e => {
                          const newRules = [...localDeadlineRules];
                          newRules[idx].targetRole = e.target.value;
                          setLocalDeadlineRules(newRules);
                        }}
                        className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none"
                      >
                        <option value="طاعنين">الطاعن / المدعي</option>
                        <option value="مطعون ضدنا">المطعون ضده / المدعى عليه</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      {rule.name.includes('وقف') && (
                        <div className="flex-1">
                          <label className="text-[9px] text-slate-500 font-bold block mb-1">تفعيل بعد (يوم)</label>
                          <input
                            type="number"
                            value={rule.triggerAfterDays || 30}
                            onChange={e => {
                              const newRules = [...localDeadlineRules];
                              newRules[idx].triggerAfterDays = e.target.value;
                              setLocalDeadlineRules(newRules);
                            }}
                            className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 outline-none"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="text-[9px] text-slate-500 font-bold block mb-1">المهلة (يوم)</label>
                        <input
                          type="number"
                          value={rule.days}
                          onChange={e => {
                            const newRules = [...localDeadlineRules];
                            newRules[idx].days = e.target.value;
                            setLocalDeadlineRules(newRules);
                          }}
                          className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 outline-none"
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">وصف الميعاد</label>
                      <input
                        type="text"
                        value={rule.description || ''}
                        onChange={e => {
                          const newRules = [...localDeadlineRules];
                          newRules[idx].description = e.target.value;
                          setLocalDeadlineRules(newRules);
                        }}
                        className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setLocalDeadlineRules(localDeadlineRules.filter((_, i) => i !== idx))}
                    className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition self-end sm:self-auto mt-2 sm:mt-0"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
                {isProcessing ? 'جاري الحفظ...' : 'حفظ المواعيد'}
              </button>
            </div>

          </div>
        </details>
      )}

      {/* SCHEMA TAB */}
      {activeTab === 'schema' && (
        <details className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-0 animate-in fade-in zoom-in duration-300">
          <summary className="flex items-center justify-between pb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-slate-100 transition-colors">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-navy-900" />
              <h3 className="font-black text-sm text-navy-900"><span className="text-[12px] opacity-70 group-open:hidden ml-1">▼</span><span className="text-[12px] opacity-70 hidden group-open:inline ml-1">▲</span> إدارة الحقول (Dynamic Schema)</h3>
            </div>
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}><button onClick={addSchemaField} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-200">
              <Plus className="w-4 h-4" /> إضافة حقل
            </button></div></summary>
          <div className="pt-2 space-y-4">

            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              يمكنك من هنا تخصيص الحقول التي تظهر في استمارة القضية دون الحاجة لمبرمج.
              المعرّف (ID) هو اسم العمود في ملف الإكسيل.
            </p>

            <div className="space-y-3">
              {localSchema.map((field, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start sm:items-center">
                  <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">اسم العرض</label>
                      <input type="text" value={field.label} onChange={e => updateSchemaField(index, 'label', e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300" />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">المعرف (طابق الإكسيل)</label>
                      <input type="text" value={field.id} onChange={e => updateSchemaField(index, 'id', e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 bg-slate-100" />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">النوع</label>
                      <select value={field.type} onChange={e => updateSchemaField(index, 'type', e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300">
                        <option value="text">نص</option>
                        <option value="number">رقم</option>
                        <option value="textarea">نص طويل</option>
                        <option value="date">تاريخ</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                        <input type="checkbox" checked={field.visible} onChange={e => updateSchemaField(index, 'visible', e.target.checked)} />
                        مرئي
                      </label>
                    </div>
                  </div>
                  <button onClick={() => removeSchemaField(index)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition self-end sm:self-auto mt-2 sm:mt-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button onClick={saveSchema} disabled={isProcessing} className="flex-[2] bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
                {isProcessing ? 'جاري الحفظ...' : 'حفظ هيكلة الحقول'}
              </button>
              <button onClick={handleCleanupSchema} disabled={isProcessing} className="flex-1 bg-amber-100 text-amber-700 font-bold py-3 rounded-xl shadow-sm text-sm border border-amber-200 hover:bg-amber-200">
                تنظيف الحقول المكررة
              </button>
            </div>

          </div>
        </details>
      )}

      {/* OTHER TAB */}
      {activeTab === 'other' && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">

          {/* Global Preferences */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <SettingsIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">تفضيلات العرض والرسائل</h3>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-bold text-slate-700">تنسيق الأرقام (للعرض والطباعة):</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                    <button
                      onClick={() => setLocalNumberFormat('en')}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition ${localNumberFormat === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      إنجليزي (123)
                    </button>
                    <button
                      onClick={() => setLocalNumberFormat('ar')}
                      className={`px-4 py-2 rounded-lg text-xs font-black transition ${localNumberFormat === 'ar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      عربي (١٢٣)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-bold text-slate-700">تنسيق التواريخ الافتراضي:</label>
                  <select
                    value={localDateFormat}
                    onChange={e => setLocalDateFormat(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-slate-50"
                  >
                    <option value="dd/MM/yyyy">يوم/شهر/سنة (31/12/2026)</option>
                    <option value="yyyy/MM/dd">سنة/شهر/يوم (2026/12/31)</option>
                    <option value="dd-MM-yyyy">يوم-شهر-سنة (31-12-2026)</option>
                    <option value="d MMMM yyyy">نصي كامل (31 ديسمبر 2026)</option>
                    <option value="MM/dd">رقمي مختصر (12/31)</option>
                    <option value="d MMMM">نصي مختصر (31 ديسمبر)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-between border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center gap-1 group relative">
                    <label className="text-xs font-bold text-slate-700">طريقة احتساب مذكرات الدفاع للإحصائية الشهرية:</label>
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-[9px] flex items-center justify-center cursor-help">?</span>
                    <div className="absolute top-6 right-0 w-64 p-2 bg-navy-900 text-white text-[10px] rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition z-50">
                      يحدد هذا الخيار طريقة عد مذكرات الدفاع في إحصائية الشهر. "تاريخ إضافة الإجراء" يعتمد على التاريخ الفعلي لتسجيل المذكرة في النظام كإجراء، بينما "تاريخ الجلسة" يعتمد على تاريخ الجلسة التي تم تقديم المذكرة فيها.
                    </div>
                  </div>
                  <select
                    value={localMemoCalculationMode}
                    onChange={e => setLocalMemoCalculationMode(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-slate-50"
                  >
                    <option value="session_date">بناءً على تاريخ الجلسة المرتبطة (تاريخ الجلسة)</option>
                    <option value="action_date">بناءً على تاريخ اعتماد وتسجيل الإجراء (تاريخ التنفيذ)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-bold text-slate-700">موقع المفكرة العائمة:</label>
                  <select
                    value={localScratchpadPosition}
                    onChange={e => setLocalScratchpadPosition(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-slate-50"
                  >
                    <option value="right">يمين الشاشة</option>
                    <option value="left">يسار الشاشة</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                <div>
                  <h4 className="text-xs font-black text-navy-900">الرسائل التأكيدية</h4>
                  <p className="text-[10px] text-slate-500 font-bold">إعادة تفعيل الرسائل التأكيدية التي قمت بتعطيلها مسبقاً عبر خيار (عدم الإظهار مجدداً).</p>
                </div>
                <button
                  onClick={handleResetConfirms}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-750 text-xs font-black px-4 py-2 rounded-xl border border-slate-200 transition shadow-sm self-start sm:self-auto"
                >
                  إعادة تفعيل النوافذ التأكيدية
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-3 border-t border-slate-100">
                <div className="flex flex-col gap-2 flex-1">
                  <h4 className="text-xs font-black text-navy-900">تخصيص الشعار واسم القسم</h4>
                  <p className="text-[10px] text-slate-500 font-bold">يمكنك تغيير الاسم الافتراضي (أحمد وجيه) ليظهر اسمك الخاص أعلى التطبيق.</p>
                  <input
                    type="text"
                    value={localConsultantName}
                    onChange={(e) => setLocalConsultantName(e.target.value)}
                    placeholder="مثال: مكتب الفهد للمحاماة والاستشارات القانونية"
                    className="w-full text-sm font-bold p-3 rounded-xl border border-slate-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-slate-50"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-between border-t border-slate-100 pt-4">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-black text-navy-900">درجة التقاضي للقسم</label>
                  <p className="text-[10px] text-slate-500 font-bold mb-1">يؤثر هذا الخيار على ظهور الحقول المتقدمة للطعون.</p>
                  <select
                    value={localCourtDegree}
                    onChange={e => setLocalCourtDegree(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-slate-50"
                  >
                    <option value="أول درجة">أول درجة</option>
                    <option value="ثان درجة">ثان درجة</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-black text-navy-900">تخصص المحكمة</label>
                  <p className="text-[10px] text-slate-500 font-bold mb-1">يحدد المصطلحات (مثال: طاعن/مطعون، دعوى/طعن) في النظام.</p>
                  <select
                    value={localCourtSpecialization}
                    onChange={e => {
                      const spec = e.target.value;
                      setLocalCourtSpecialization(spec);
                    }}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-slate-50"
                  >
                    <option value="قضاء إداري">قضاء إداري</option>
                    <option value="الإدارية العليا">الإدارية العليا</option>
                    <option value="قضاء مدني">قضاء مدني</option>
                    <option value="نقض">نقض</option>
                    <option value="قضاء تأديبي">قضاء تأديبي</option>
                    <option value="استئنافية">استئنافية</option>
                  </select>
                </div>
              </div>
              <div className="bg-blue-50 text-blue-700 p-3 rounded-xl border border-blue-100 text-xs font-bold flex gap-2 items-start mt-2">
                <span>💡</span>
                <span>تغيير تخصص المحكمة سيعمل على ضبط المسميات في واجهة التطبيق، لتغيير قائمة "الصفة" و "نوع الجلسة"، يرجى تحديثها من نافذة "قوائم النظام".</span>
              </div>
            </div>
          </div>

          {/* Review Tasks Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة مهام الإطلاع السريعة</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localReviewTasks.map((task, i) => (
                <div key={i} className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{task}</span>
                  <button onClick={() => setLocalReviewTasks(localReviewTasks.filter((_, idx) => idx !== i))} className="text-emerald-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newTask = await showPrompt('إضافة مهمة إطلاع', 'أدخل اسم المهمة الجديدة:');
                  if (newTask?.trim()) setLocalReviewTasks([...localReviewTasks, newTask.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة مهمة
              </button>
            </div>
          </div>

          {/* Employees Management */}
          <details className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-0">
            <summary className="flex items-center justify-between pb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-slate-100 transition-colors">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm text-navy-900"><span className="text-[12px] opacity-70 group-open:hidden ml-1">▼</span><span className="text-[12px] opacity-70 hidden group-open:inline ml-1">▲</span> إدارة الموظفين والصلاحيات</h3>
              </div>
              {userData?.tenantId && (
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-2">
                  <Fingerprint className="w-4 h-4" />
                  <span className="text-[10px] font-black">كود المستشار:</span>
                  <span className="text-sm font-mono font-black tracking-wider">{userData.tenantId}</span>
                </div>
              )}</summary>
            <div className="pt-2 space-y-4">
              <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                لإضافة موظف، أدخل اسمه ومعرف الدخول بالإنجليزية (Username). سيتطلب من الموظف إدخال "معرف الدخول" و "كود المستشار" لتسجيل الدخول.
              </p>

              <div className="space-y-3">
                {localEmployees.map((emp, index) => {
                  const empPerms = emp.permissions || { canEditData: true, canDeleteData: true, canManageRolls: true, canManageTasks: true };
                  return (
                    <div key={index} className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <input type="text" placeholder="الاسم" value={emp.name} onChange={e => {
                          const newEmp = [...localEmployees];
                          newEmp[index].name = e.target.value;
                          setLocalEmployees(newEmp);
                        }} className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto" />

                        <input type="text" placeholder="معرف الدخول (مثال: omar)" value={emp.username || ''} onChange={e => {
                          const newEmp = [...localEmployees];
                          newEmp[index].username = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                          setLocalEmployees(newEmp);
                        }} className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto bg-slate-50" dir="ltr" />

                        <input
                          type="text"
                          list="jobTitlesList"
                          placeholder="الوظيفة (مثال: محامي)"
                          value={emp.jobTitle || ''}
                          onChange={e => {
                            const newEmp = [...localEmployees];
                            newEmp[index].jobTitle = e.target.value;
                            setLocalEmployees(newEmp);
                          }}
                          className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto bg-white"
                        />
                        <datalist id="jobTitlesList">
                          <option value="محامي" />
                          <option value="سكرتارية" />
                          <option value="إداري" />
                          <option value="صادر" />
                          <option value="إطلاع" />
                        </datalist>

                        <input type="text" placeholder="كلمة المرور" value={emp.password} onChange={e => {
                          const newEmp = [...localEmployees];
                          newEmp[index].password = e.target.value;
                          setLocalEmployees(newEmp);
                        }} className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto" />

                        <button onClick={() => setLocalEmployees(localEmployees.filter((_, idx) => idx !== index))} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-1 p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer hover:text-navy-900 transition">
                          <input type="checkbox" checked={empPerms.canEditData} onChange={e => {
                            const newEmp = [...localEmployees];
                            newEmp[index].permissions = { ...empPerms, canEditData: e.target.checked };
                            setLocalEmployees(newEmp);
                          }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          📝 إضافة وتعديل القضايا
                        </label>

                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer hover:text-rose-600 transition">
                          <input type="checkbox" checked={empPerms.canDeleteData} onChange={e => {
                            const newEmp = [...localEmployees];
                            newEmp[index].permissions = { ...empPerms, canDeleteData: e.target.checked };
                            setLocalEmployees(newEmp);
                          }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          🗑️ حذف القضايا
                        </label>

                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer hover:text-navy-900 transition">
                          <input type="checkbox" checked={empPerms.canManageRolls} onChange={e => {
                            const newEmp = [...localEmployees];
                            newEmp[index].permissions = { ...empPerms, canManageRolls: e.target.checked };
                            setLocalEmployees(newEmp);
                          }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          📅 إدارة رول الجلسات
                        </label>

                        <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer hover:text-navy-900 transition">
                          <input type="checkbox" checked={empPerms.canManageTasks} onChange={e => {
                            const newEmp = [...localEmployees];
                            newEmp[index].permissions = { ...empPerms, canManageTasks: e.target.checked };
                            setLocalEmployees(newEmp);
                          }} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                          📋 إدارة المهام
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => setLocalEmployees([...localEmployees, { name: '', username: '', jobTitle: '', password: '', permissions: { canEditData: true, canDeleteData: true, canManageRolls: true, canManageTasks: true } }])} className="w-full border-2 border-dashed border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> إضافة موظف جديد
              </button>

            </div>
          </details>
          
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-right">
              <h3 className="font-bold text-sm text-blue-900">الدليل الترحيبي والتثبيت</h3>
              <p className="text-xs text-blue-700 mt-1">إذا كنت ترغب في إعادة عرض الدليل الترحيبي وخطوات تثبيت التطبيق التي تظهر في المرة الأولى.</p>
            </div>
            <button onClick={() => {
              localStorage.removeItem('ekhtsas_onboarding_v1');
              window.location.reload();
            }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-xs whitespace-nowrap transition shadow-sm">
              إعادة عرض الدليل
            </button>
          </div>

          {/* Save Settings Button */}
          <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
            {isProcessing ? 'جاري الحفظ...' : 'حفظ الإعدادات المتقدمة'}
          </button>

          {/* Factory Reset */}
          <div className="bg-rose-50 rounded-2xl p-5 border border-rose-200 shadow-sm space-y-4 mt-8">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-200/50">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <h3 className="font-black text-sm text-rose-900">منطقة الخطر: مسح البيانات</h3>
            </div>
            <p className="text-[11px] font-bold text-rose-700">تحذير: سيتم حذف جميع القضايا والملفات بشكل نهائي. تأكد من عمل نسخة احتياطية (Excel) قبل القيام بهذه الخطوة.</p>

            <div className="flex gap-2">
              <input
                type="password"
                placeholder="أدخل باسوورد المدير للتأكيد"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                className="flex-1 text-xs font-bold p-2 rounded-lg border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button onClick={handleDeleteAll} disabled={isProcessing || !deletePassword} className="bg-rose-600 text-white font-bold px-4 py-2 rounded-lg text-xs hover:bg-rose-700 disabled:opacity-50 shadow-sm">
                مسح جميع البيانات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LISTS TAB */}
      {activeTab === 'lists' && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
          {/* Core Field Options Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <SettingsIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة خيارات الحقول الجوهرية</h3>
            </div>

            {/* Roles choice */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-500">خيارات حقل الصفة (طاعن / مطعون ضدنا / إلخ):</h4>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                {localRoles.map((role, i) => (
                  <div key={i} className="flex items-center gap-1 bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <span>{role}</span>
                    <button onClick={() => setLocalRoles(localRoles.filter((_, idx) => idx !== i))} className="text-rose-450 hover:text-rose-600 mr-2">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={async () => {
                    const newRole = await showPrompt('إضافة صفة', 'أدخل مسمى الصفة الجديد:');
                    if (newRole?.trim()) setLocalRoles([...localRoles, newRole.trim()]);
                  }}
                  className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm"
                >
                  <Plus className="w-3 h-3" /> إضافة صفة
                </button>
              </div>
            </div>

            {/* Session Types choice */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-500">إضافة نوع جلسة مخصص (فحص / موضوع / مفوضين / مرافعة):</h4>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                {localSessionTypes.map((type, i) => (
                  <div key={i} className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <span>{type}</span>
                    <button onClick={() => setLocalSessionTypes(localSessionTypes.filter((_, idx) => idx !== i))} className="text-emerald-450 hover:text-emerald-600 mr-2">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={async () => {
                    const newType = await showPrompt('إضافة نوع جلسة', 'أدخل اسم نوع الجلسة الجديد:');
                    if (newType?.trim()) setLocalSessionTypes([...localSessionTypes, newType.trim()]);
                  }}
                  className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm"
                >
                  <Plus className="w-3 h-3" /> إضافة نوع
                </button>
              </div>
            </div>

            {/* File Locations choice */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-500">خيارات حقل مكان الملف (شعبة الحفظ / أصلي / إلخ):</h4>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                {localFileLocations.map((loc, i) => (
                  <div key={i} className="flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <span>{loc}</span>
                    <button onClick={() => setLocalFileLocations(localFileLocations.filter((_, idx) => idx !== i))} className="text-amber-450 hover:text-amber-600 mr-2">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={async () => {
                    const newLoc = await showPrompt('إضافة مكان الملف', 'أدخل مسمى مكان الملف الجديد:');
                    if (newLoc?.trim()) setLocalFileLocations([...localFileLocations, newLoc.trim()]);
                  }}
                  className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm"
                >
                  <Plus className="w-3 h-3" /> إضافة مكان
                </button>
              </div>
            </div>
          </div>

          {/* Common Procedures Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة خيارات الإجراءات الشائعة (سجل الإجراءات)</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localCommonProcedures.map((proc, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{proc}</span>
                  <button onClick={() => setLocalCommonProcedures(localCommonProcedures.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newProc = await showPrompt('إضافة إجراء شائع', 'أدخل اسم الإجراء الجديد:');
                  if (newProc?.trim()) setLocalCommonProcedures([...localCommonProcedures, newProc.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة إجراء
              </button>
            </div>
          </div>

          {/* Case Classifications Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة تصنيفات الدعوى</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localCaseClassifications.map((cls, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{cls}</span>
                  <button onClick={() => setLocalCaseClassifications(localCaseClassifications.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newCls = await showPrompt('إضافة تصنيف', 'أدخل تصنيف الدعوى الجديد:');
                  if (newCls?.trim()) setLocalCaseClassifications([...localCaseClassifications, newCls.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة تصنيف
              </button>
            </div>
          </div>

          {/* Save Settings Button */}
          <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
            {isProcessing ? 'جاري الحفظ...' : 'حفظ الإعدادات المتقدمة'}
          </button>
        </div>
      )}

      {/* JUDGMENTS TAB */}
      {activeTab === 'judgments' && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
          {/* Decisions Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <SettingsIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة القرارات الافتراضية</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localDecisions.map((dec, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{dec}</span>
                  <button onClick={() => setLocalDecisions(localDecisions.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newDec = await showPrompt('إضافة قرار', 'أدخل القرار الجديد:');
                  if (newDec?.trim()) setLocalDecisions([...localDecisions, newDec.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة قرار
              </button>
            </div>
          </div>

          {/* Roll Types Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة أنواع رولات الجلسات</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localRollTypes.map((type, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{type}</span>
                  <button onClick={() => setLocalRollTypes(localRollTypes.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newType = await showPrompt('إضافة نوع رول', 'أدخل اسم نوع الرول الجديد:');
                  if (newType?.trim()) setLocalRollTypes([...localRollTypes, newType.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة نوع
              </button>
            </div>
          </div>

          {/* Judgment Categories Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Scale className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة فئات الأحكام</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localJudgmentCategories.map((cat, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{cat}</span>
                  <button onClick={() => setLocalJudgmentCategories(localJudgmentCategories.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newCat = await showPrompt('إضافة فئة', 'أدخل اسم فئة الحكم الجديدة (مثال: شق عاجل، نهائي):');
                  if (newCat?.trim()) setLocalJudgmentCategories([...localJudgmentCategories, newCat.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة فئة
              </button>
            </div>
          </div>

          {/* Judgment Classifications Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة تصنيفات الأحكام</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localJudgmentClassifications.map((cls, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{cls}</span>
                  <button onClick={() => setLocalJudgmentClassifications(localJudgmentClassifications.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newCls = await showPrompt('إضافة تصنيف', 'أدخل تصنيف الحكم الجديد (مثال: صالح، ضد):');
                  if (newCls?.trim()) setLocalJudgmentClassifications([...localJudgmentClassifications, newCls.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة تصنيف
              </button>
            </div>
          </div>

          {/* Judgment Types Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة أنواع الأحكام</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localJudgmentTypes.map((type, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{type}</span>
                  <button onClick={() => setLocalJudgmentTypes(localJudgmentTypes.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newType = await showPrompt('إضافة نوع', 'أدخل نوع الحكم الجديد (مثال: قبول، رفض، إلغاء):');
                  if (newType?.trim()) setLocalJudgmentTypes([...localJudgmentTypes, newType.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة نوع
              </button>
            </div>
          </div>

          {/* Default Judgment Settings Management */}
          <details className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-0">
            <summary className="flex items-center justify-between pb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-slate-100 transition-colors">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-sm text-navy-900"><span className="text-[12px] opacity-70 group-open:hidden ml-1">▼</span><span className="text-[12px] opacity-70 hidden group-open:inline ml-1">▲</span> قواعد التعبئة التلقائية للأحكام</h3>
              </div>
              <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="flex gap-2">
                <button
                  onClick={() => {
                    const confirmLoad = window.confirm('هل أنت متأكد من تحميل القواعد الافتراضية الذكية (للطاعن والمطعون ضده)؟ سيتم إضافتها للقواعد الحالية.');
                    if (confirmLoad) {
                      const defaults = [
                        { name: 'استنتاج ذكي: قبول/إلغاء للطاعن', conditions: { role: 'طاعن', type: 'قبول' }, actions: { classification: 'صالح' } },
                        { name: 'استنتاج ذكي: قبول/إلغاء للطاعن', conditions: { role: 'طاعن', type: 'إلغاء' }, actions: { classification: 'صالح' } },
                        { name: 'استنتاج ذكي: قبول/إلغاء للمطعون ضده', conditions: { role: 'مطعون ضده', type: 'قبول' }, actions: { classification: 'ضد' } },
                        { name: 'استنتاج ذكي: قبول/إلغاء للمطعون ضده', conditions: { role: 'مطعون ضده', type: 'إلغاء' }, actions: { classification: 'ضد' } },
                        
                        { name: 'استنتاج ذكي: رفض/عدم قبول للطاعن', conditions: { role: 'طاعن', type: 'رفض' }, actions: { classification: 'ضد' } },
                        { name: 'استنتاج ذكي: رفض/عدم قبول للطاعن', conditions: { role: 'طاعن', type: 'عدم قبول' }, actions: { classification: 'ضد' } },
                        { name: 'استنتاج ذكي: رفض/عدم قبول للمطعون ضده', conditions: { role: 'مطعون ضده', type: 'رفض' }, actions: { classification: 'صالح' } },
                        { name: 'استنتاج ذكي: رفض/عدم قبول للمطعون ضده', conditions: { role: 'مطعون ضده', type: 'عدم قبول' }, actions: { classification: 'صالح' } },
                        
                        { name: 'استنتاج ذكي: سقوط/شطب للطاعن', conditions: { role: 'طاعن', type: 'سقوط الخصومة' }, actions: { classification: 'ضد' } },
                        { name: 'استنتاج ذكي: سقوط/شطب للطاعن', conditions: { role: 'طاعن', type: 'شطب' }, actions: { classification: 'ضد' } },
                        { name: 'استنتاج ذكي: سقوط/شطب للمطعون ضده', conditions: { role: 'مطعون ضده', type: 'سقوط الخصومة' }, actions: { classification: 'صالح' } },
                        { name: 'استنتاج ذكي: سقوط/شطب للمطعون ضده', conditions: { role: 'مطعون ضده', type: 'شطب' }, actions: { classification: 'صالح' } },
                        
                        { name: 'استنتاج ذكي: اعتبار للطاعن (خطر)', conditions: { role: 'طاعن', type: 'اعتبار الدعوى كأن لم تكن' }, actions: { classification: 'ضد' } },
                        { name: 'استنتاج ذكي: اعتبار للمطعون ضده', conditions: { role: 'مطعون ضده', type: 'اعتبار الدعوى كأن لم تكن' }, actions: { classification: 'صالح' } },
                        
                        { name: 'استنتاج ذكي: وقف جزائي للطاعن (خطر)', conditions: { role: 'طاعن', type: 'وقف جزائي' }, actions: { classification: 'إجرائي' } },
                        { name: 'استنتاج ذكي: وقف جزائي للمطعون ضده', conditions: { role: 'مطعون ضده', type: 'وقف جزائي' }, actions: { classification: 'إجرائي' } },
                      ];
                      setLocalJudgmentDefaults([...localJudgmentDefaults, ...defaults]);
                    }
                  }}
                  className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-emerald-100"
                >
                  <Plus className="w-4 h-4" /> توليد القواعد الافتراضية
                </button>
                <button
                  onClick={() => setLocalJudgmentDefaults([...localJudgmentDefaults, { name: '', conditions: { role: '', category: '', classification: '', type: '', sessionType: '', decision: '' }, actions: { category: '', classification: '', type: '', text: '' } }])}
                  className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-100"
                >
                  <Plus className="w-4 h-4" /> إضافة قاعدة
                </button>
              </div></summary>
            <div className="pt-2 space-y-4">

              <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                قم بإعداد قواعد ديناميكية متعددة الشروط لملء تفاصيل الحكم آلياً عند تسجيل حكم (مثلاً: إذا كانت الصفة "طاعنين" والفئة "نهائي" {'->'} يتم تعبئة التصنيف والمنطوق بـ "..." ).
              </p>

              {/* Toolbar: Search and Expand/Collapse */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="flex-1 relative min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ابحث في القواعد (بالاسم، النوع، الصفة...)"
                    value={rulesSearchQuery}
                    onChange={e => setRulesSearchQuery(e.target.value)}
                    className="w-full text-xs font-bold pl-3 pr-9 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setExpandedRuleGroups([...new Set(localJudgmentDefaults.map(r => r.conditions.type ? `قواعد: ${r.conditions.type.trim()}` : 'قواعد عامة'))])} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">فرد الكل</button>
                  <button onClick={() => setExpandedRuleGroups([])} className="text-[10px] font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg transition">طي الكل</button>
                </div>
              </div>

              <div className="space-y-4">
                {(() => {
                  const grouped = {};
                  localJudgmentDefaults.forEach((rule, originalIdx) => {
                    if (rulesSearchQuery) {
                      const q = rulesSearchQuery.toLowerCase();
                      const match = (rule.name || '').toLowerCase().includes(q) ||
                        (rule.conditions.type || '').toLowerCase().includes(q) ||
                        (rule.conditions.role || '').toLowerCase().includes(q) ||
                        (rule.conditions.category || '').toLowerCase().includes(q) ||
                        (rule.actions.text || '').toLowerCase().includes(q);
                      if (!match) return;
                    }
                    const groupName = rule.conditions.type ? `قواعد: ${rule.conditions.type.trim()}` : 'قواعد عامة';
                    if (!grouped[groupName]) grouped[groupName] = [];
                    grouped[groupName].push({ rule, idx: originalIdx });
                  });

                  if (Object.keys(grouped).length === 0) return <div className="text-center py-6 text-slate-400 text-xs font-bold bg-slate-50 rounded-xl border border-slate-100">لا توجد قواعد مطابقة للبحث</div>;

                  return Object.entries(grouped).map(([gName, rulesList]) => {
                    const isGroupExpanded = expandedRuleGroups.includes(gName) || rulesSearchQuery; // Always expand if searching
                    return (
                      <div key={gName} className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-sm transition-all">
                        <div
                          onClick={() => setExpandedRuleGroups(prev => prev.includes(gName) ? prev.filter(g => g !== gName) : [...prev, gName])}
                          className="flex items-center justify-between p-3 hover:bg-slate-100 cursor-pointer select-none transition"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[11px]">{rulesList.length}</div>
                            <h4 className="font-black text-xs text-navy-900">{gName}</h4>
                          </div>
                          <span className="text-slate-400 text-[10px]">{isGroupExpanded ? '▼' : '◀'}</span>
                        </div>

                        {isGroupExpanded && (
                          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white border-t border-slate-100">
                            {rulesList.map(({ rule, idx }) => {
                              const isExpanded = expandedRules.includes(idx);
                              const toggleExpand = () => setExpandedRules(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);

                              const getRuleSummary = (r) => {
                                const conds = [];
                                if (r.conditions.role) conds.push(`الصفة "${r.conditions.role}"`);
                                if (r.conditions.category) conds.push(`الفئة "${r.conditions.category}"`);
                                if (r.conditions.classification) conds.push(`التصنيف "${r.conditions.classification}"`);
                                if (r.conditions.type) conds.push(`النوع "${r.conditions.type}"`);
                                if (r.conditions.sessionType) conds.push(`الجلسة "${r.conditions.sessionType}"`);
                                if (r.conditions.decision) conds.push(`القرار "${r.conditions.decision}"`);

                                const acts = [];
                                if (r.actions.category) acts.push(`الفئة "${r.actions.category}"`);
                                if (r.actions.classification) acts.push(`التصنيف "${r.actions.classification}"`);
                                if (r.actions.type) acts.push(`النوع "${r.actions.type}"`);
                                if (r.actions.text) acts.push(`المنطوق "${r.actions.text.slice(0, 25)}${r.actions.text.length > 25 ? '...' : ''}"`);

                                const condStr = conds.length > 0 ? conds.join(' + ') : 'أي دعوى';
                                const actStr = acts.length > 0 ? acts.join('، و') : 'لا شيء';
                                return (
                                  <div className="text-[10px] font-bold text-slate-600 leading-relaxed truncate">
                                    <span className="text-rose-500 ml-1">لو:</span> {condStr} <span className="mx-2 text-slate-300">|</span> <span className="text-emerald-600 ml-1">يتم تعبئة:</span> {actStr}
                                  </div>
                                );
                              };

                              return (
                                <div key={idx} className={`flex flex-col gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 transition ${isExpanded ? 'col-span-full' : ''}`}>
                                  <div className="flex items-center justify-between">
                                    <div
                                      onClick={toggleExpand}
                                      className="flex items-center gap-1 text-[11px] font-black text-indigo-800 hover:text-indigo-600 transition w-max cursor-pointer select-none"
                                    >
                                      <span className="text-indigo-400 ml-1">{isExpanded ? '▼' : '◀'}</span>
                                      {rule.name || `قاعدة رقم ${idx + 1}`}
                                    </div>
                                    <div className="flex gap-1">
                                      <button onClick={toggleExpand} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition" title="تعديل">
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => setLocalJudgmentDefaults([...localJudgmentDefaults, JSON.parse(JSON.stringify(rule))])} className="text-slate-400 hover:text-sky-600 hover:bg-sky-50 p-1.5 rounded-lg transition" title="تكرار">
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => setLocalJudgmentDefaults(localJudgmentDefaults.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition" title="حذف">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {!isExpanded ? (
                                    <div className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-200 transition" onClick={toggleExpand}>
                                      {getRuleSummary(rule)}
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1 animate-in fade-in slide-in-from-top-2">
                                      <div className="col-span-full">
                                        <label className="text-[9px] font-bold text-slate-500 block mb-1">اسم القاعدة (اختياري)</label>
                                        <input
                                          type="text"
                                          placeholder="مثال: رفض الطعن موضوعاً"
                                          value={rule.name}
                                          onChange={(e) => {
                                            const newRules = [...localJudgmentDefaults];
                                            newRules[idx].name = e.target.value;
                                            setLocalJudgmentDefaults(newRules);
                                          }}
                                          className="w-full text-xs font-bold p-1.5 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
                                        />
                                      </div>
                                      {/* Conditions */}
                                      <div className="space-y-2 border-r-2 border-indigo-300 pr-2 bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                        <p className="text-[10px] font-black text-slate-700 mb-2 border-b border-slate-100 pb-1">شروط التطبيق (اتركها فارغة للتجاهل):</p>

                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-[8px] font-bold text-slate-500 block mb-0.5">الصفة</label>
                                            <select
                                              value={rule.conditions.role}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].conditions.role = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                            >
                                              <option value="">- أي صفة -</option>
                                              {localRoles.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[8px] font-bold text-slate-500 block mb-0.5">فئة الحكم</label>
                                            <select
                                              value={rule.conditions.category}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].conditions.category = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                            >
                                              <option value="">- أي فئة -</option>
                                              {localJudgmentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[8px] font-bold text-slate-500 block mb-0.5">تصنيف الحكم</label>
                                            <select
                                              value={rule.conditions.classification}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].conditions.classification = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                            >
                                              <option value="">- أي تصنيف -</option>
                                              {localJudgmentClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[8px] font-bold text-slate-500 block mb-0.5">نوع الحكم</label>
                                            <select
                                              value={rule.conditions.type}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].conditions.type = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                            >
                                              <option value="">- أي نوع -</option>
                                              {localJudgmentTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[8px] font-bold text-slate-500 block mb-0.5">نوع الجلسة</label>
                                            <select
                                              value={rule.conditions.sessionType}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].conditions.sessionType = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                            >
                                              <option value="">- أي نوع جلسة -</option>
                                              {localSessionTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[8px] font-bold text-slate-500 block mb-0.5">القرار</label>
                                            <select
                                              value={rule.conditions.decision}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].conditions.decision = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                            >
                                              <option value="">- أي قرار -</option>
                                              {localDecisions.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Actions */}
                                      <div className="space-y-2 border-r-2 border-emerald-400 pr-2 bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                                        <p className="text-[10px] font-black text-slate-700 mb-2 border-b border-slate-100 pb-1">تعبئة البيانات تلقائياً بـ:</p>

                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-[8px] font-bold text-slate-500 block mb-0.5">فئة الحكم</label>
                                            <select
                                              value={rule.actions.category}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].actions.category = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                            >
                                              <option value="">-- بدون تغيير --</option>
                                              {localJudgmentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[8px] font-bold text-slate-500 block mb-0.5">تصنيف الحكم</label>
                                            <select
                                              value={rule.actions.classification}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].actions.classification = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                            >
                                              <option value="">-- بدون تغيير --</option>
                                              {localJudgmentClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                          </div>
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-500 block mb-0.5">نوع الحكم</label>
                                          <select
                                              value={rule.actions.type}
                                              onChange={(e) => {
                                                const newRules = [...localJudgmentDefaults];
                                                newRules[idx].actions.type = e.target.value;
                                                setLocalJudgmentDefaults(newRules);
                                              }}
                                              className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                            >
                                              <option value="">-- بدون تغيير --</option>
                                              {localJudgmentTypes.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                          <label className="text-[8px] font-bold text-slate-500 block mb-0.5">منطوق الحكم</label>
                                          <textarea
                                            placeholder="المنطوق الافتراضي (اختياري)"
                                            value={rule.actions.text}
                                            onChange={(e) => {
                                              const newRules = [...localJudgmentDefaults];
                                              newRules[idx].actions.text = e.target.value;
                                              setLocalJudgmentDefaults(newRules);
                                            }}
                                            className="w-full text-[10px] font-bold p-2 rounded-md border border-slate-200 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 min-h-[40px] resize-none"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

            </div>
          </details>

          {/* Save Settings Button */}
          <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
            {isProcessing ? 'جاري الحفظ...' : 'حفظ الإعدادات المتقدمة'}
          </button>
        </div>
      )}

    </div>
  );
}
