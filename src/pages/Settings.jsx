import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppState';
import { Upload, LogIn, LogOut, Check, ShieldCheck, Database, LayoutTemplate, Plus, Trash2, ArrowDownUp, Users, ShieldAlert, Settings as SettingsIcon, BookOpen, ClipboardList, Scale, Download, FileJson, ArrowUpFromLine } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useUI } from '../context/UIContext';

export default function Settings() {
  const { isAdmin, loginAdmin, logoutAdmin, cases, schema, settings, saveSettingsToFirebase, deleteAllCases, saveBatchCasesToFirebase, saveSchemaToFirebase } = useAppContext();
  const { toast, showConfirm, showPrompt } = useUI();
  
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const fileInputRef = useRef(null);

  // Sync state
  const [syncData, setSyncData] = useState(null); // { added: [], updated: [], kept: [] }
  const [isProcessing, setIsProcessing] = useState(false);

  // Schema state
  const [localSchema, setLocalSchema] = useState(schema || []);
  const [activeTab, setActiveTab] = useState('sync'); // sync, schema, advanced

  // Advanced state
  const [localEmployees, setLocalEmployees] = useState(settings?.employees || []);
  const [localDecisions, setLocalDecisions] = useState(settings?.decisions || []);
  const [localReviewTasks, setLocalReviewTasks] = useState(settings?.reviewTasks || ['تصوير ملف', 'تقرير مفوضين', 'حكم أول درجة', 'تقرير خبراء', 'حافظة مستندات']);
  const [localRollTypes, setLocalRollTypes] = useState(settings?.rollTypes || ['رول جلسة', 'حصر الفحص', 'حصر الموضوع', 'رول أحكام']);
  const [localNumberFormat, setLocalNumberFormat] = useState(settings?.numberFormat || 'en');
  const [localRoles, setLocalRoles] = useState(settings?.roles || ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص']);
  const [localSessionTypes, setLocalSessionTypes] = useState(settings?.sessionTypes || ['فحص', 'موضوع', 'للحكم', 'أول جلسة']);
  const [localFileLocations, setLocalFileLocations] = useState(settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي']);
  const [localCommonProcedures, setLocalCommonProcedures] = useState(settings?.commonProcedures || ['إيداع مذكرة دفاع', 'تقديم حافظة مستندات', 'طلب تصوير ملف', 'سداد الأمانة', 'حضور الجلسة']);
  const [localCaseClassifications, setLocalCaseClassifications] = useState(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']);
  const [localJudgmentTextMap, setLocalJudgmentTextMap] = useState(settings?.judgmentTextMap || {
    'وقف جزائي': 'وقف الدعوى جزائيا لمدة شهر',
    'اعتبار': 'اعتبار الدعوى كأن لم تكن',
    'رفض': 'بقبول الدعوي شكلا ورفضها موضوعا وإلزام رافعها المصروفات'
  });
  const [localJudgmentDefaults, setLocalJudgmentDefaults] = useState(settings?.judgmentDefaults || []);
  const [localJudgmentCategories, setLocalJudgmentCategories] = useState(settings?.judgmentCategories || ['نهائي', 'حكم أول درجة', 'شق عاجل', 'فحص']);
  const [localJudgmentClassifications, setLocalJudgmentClassifications] = useState(settings?.judgmentClassifications || ['صالح', 'ضد', 'حكم منه للخصومة', 'غير منه للخصومة', 'تمهيدي']);
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
    setLocalRoles(settings?.roles || ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص']);
    setLocalSessionTypes(settings?.sessionTypes || ['فحص', 'موضوع', 'للحكم', 'أول جلسة']);
    setLocalFileLocations(settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي']);
    setLocalCommonProcedures(settings?.commonProcedures || ['إيداع مذكرة دفاع', 'تقديم حافظة مستندات', 'طلب تصوير ملف', 'سداد الأمانة', 'حضور الجلسة']);
    setLocalCaseClassifications(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']);
    setLocalJudgmentCategories(settings?.judgmentCategories || ['نهائي', 'حكم أول درجة', 'شق عاجل', 'فحص']);
    setLocalJudgmentClassifications(settings?.judgmentClassifications || ['صالح', 'ضد', 'حكم منه للخصومة', 'غير منه للخصومة', 'تمهيدي']);
    setLocalJudgmentTextMap(settings?.judgmentTextMap || {
      'وقف جزائي': 'وقف الدعوى جزائيا لمدة شهر',
      'اعتبار': 'اعتبار الدعوى كأن لم تكن',
      'رفض': 'بقبول الدعوي شكلا ورفضها موضوعا وإلزام رافعها المصروفات'
    });
  }, [settings]);

  const handleSaveSettings = async () => {
    setIsProcessing(true);
    await saveSettingsToFirebase({
      ...settings,
      employees: localEmployees,
      decisions: localDecisions,
      reviewTasks: localReviewTasks,
      rollTypes: localRollTypes,
      numberFormat: localNumberFormat,
      roles: localRoles,
      sessionTypes: localSessionTypes,
      fileLocations: localFileLocations,
      commonProcedures: localCommonProcedures,
      caseClassifications: localCaseClassifications,
      judgmentCategories: localJudgmentCategories,
      judgmentClassifications: localJudgmentClassifications,
      judgmentTextMap: localJudgmentTextMap,
      judgmentDefaults: localJudgmentDefaults
    });
    setIsProcessing(false);
    toast('تم حفظ الإعدادات المتقدمة بنجاح', 'success');
  };

  const handleResetConfirms = () => {
    localStorage.removeItem('disabledConfirms');
    toast('تم إعادة تفعيل جميع الرسائل التأكيدية بنجاح!', 'success');
  };

  const handleDeleteAll = async () => {
    if (deletePassword !== 'a4450422') {
      toast('كلمة المرور غير صحيحة!', 'error');
      return;
    }
    
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

      // Also dynamically update schema if new columns are found
      if (excelCases.length > 0) {
        const keys = Object.keys(excelCases[0]);
        let schemaChanged = false;
        const newSchema = [...localSchema];
        keys.forEach(k => {
          if (!newSchema.find(s => s.id === k)) {
            newSchema.push({ id: k, label: k, type: 'text', visible: true, primary: false });
            schemaChanged = true;
          }
        });
        if (schemaChanged) {
          setLocalSchema(newSchema);
          saveSchemaToFirebase(newSchema);
        }
      }

      const existingMap = new Map();
      cases.forEach(c => existingMap.set(c.id || getCaseKey(c), c));

      let added = 0;
      let updated = 0;
      const newMergedData = [];

      excelCases.forEach(excelCase => {
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
        <button onClick={() => setActiveTab('schema')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'schema' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>🧩 هيكلة الحقول</button>
        <button onClick={() => setActiveTab('judgments')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'judgments' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>⚖️ الجلسات والأحكام</button>
        <button onClick={() => setActiveTab('lists')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'lists' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>📁 قوائم النظام</button>
        <button onClick={() => setActiveTab('other')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'other' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>⚙️ إعدادات أخرى</button>
        <button onClick={() => setActiveTab('data')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'data' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>🛡️ بيانات ونسخ</button>
      </div>

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

            <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full border-2 border-dashed border-slate-300 hover:border-navy-900 hover:bg-slate-50 text-slate-600 font-bold py-5 rounded-2xl flex flex-col items-center justify-center gap-2">
              {isProcessing ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-navy-900"></div>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-amber-500" />
                  <span className="text-sm">اختر ملف إكسيل (.xlsx) للمزامنة</span>
                </>
              )}
            </button>

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

      {/* SCHEMA TAB */}
      {activeTab === 'schema' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-navy-900" />
              <h3 className="font-black text-sm text-navy-900">إدارة الحقول (Dynamic Schema)</h3>
            </div>
            <button onClick={addSchemaField} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-200">
              <Plus className="w-4 h-4"/> إضافة حقل
            </button>
          </div>

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
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button onClick={saveSchema} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
              {isProcessing ? 'جاري الحفظ...' : 'حفظ هيكلة الحقول'}
            </button>
          </div>
        </div>
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
              <div className="flex items-center gap-4">
                <label className="text-xs font-bold text-slate-700">تنسيق الأرقام والتواريخ:</label>
                <div className="flex bg-slate-100 p-1 rounded-xl">
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

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
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
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Users className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة الموظفين والصلاحيات</h3>
            </div>
            
            <div className="space-y-3">
              {localEmployees.map((emp, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 items-start sm:items-center">
                  <input type="text" placeholder="الاسم" value={emp.name} onChange={e => {
                    const newEmp = [...localEmployees];
                    newEmp[index].name = e.target.value;
                    setLocalEmployees(newEmp);
                  }} className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto" />
                  
                  <select 
                    value={emp.jobTitle || 'السكرتارية'} 
                    onChange={e => {
                      const newEmp = [...localEmployees];
                      newEmp[index].jobTitle = e.target.value;
                      setLocalEmployees(newEmp);
                    }} 
                    className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto bg-white"
                  >
                    <option value="السكرتارية">السكرتارية</option>
                    <option value="إطلاع">إطلاع</option>
                    <option value="صادر">صادر</option>
                    <option value="محامي">محامي</option>
                  </select>

                  <input type="text" placeholder="كلمة المرور" value={emp.password} onChange={e => {
                    const newEmp = [...localEmployees];
                    newEmp[index].password = e.target.value;
                    setLocalEmployees(newEmp);
                  }} className="flex-1 text-xs font-bold p-2 rounded-lg border border-slate-300 w-full sm:w-auto" />
                  
                  <button onClick={() => setLocalEmployees(localEmployees.filter((_, idx) => idx !== index))} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              ))}
            </div>

            <button onClick={() => setLocalEmployees([...localEmployees, { name: '', jobTitle: 'السكرتارية', password: '' }])} className="w-full border-2 border-dashed border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2">
              <Plus className="w-4 h-4"/> إضافة موظف جديد
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
              <h4 className="text-xs font-black text-slate-500">خيارات حقل نوع الجلسة (فحص / موضوع / إلخ):</h4>
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

          {/* Default Judgment Settings Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-sm text-navy-900">قواعد التعبئة التلقائية للأحكام</h3>
              </div>
              <button 
                onClick={() => setLocalJudgmentDefaults([...localJudgmentDefaults, { triggerField: 'category', triggerValue: '', setClassification: '', setType: '', setText: '' }])}
                className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-100"
              >
                <Plus className="w-4 h-4"/> إضافة قاعدة
              </button>
            </div>
            
            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              قم بإعداد قواعد ديناميكية لملء تفاصيل الحكم آلياً عند اختيار فئة أو تصنيف محدد (مثلاً: إذا تم اختيار فئة "فحص" {'->'} يتم التعيين كـ "رفض").
            </p>

            <div className="space-y-3">
              {localJudgmentDefaults.map((rule, idx) => (
                <div key={idx} className="flex flex-col gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-800 bg-indigo-100 px-2 py-1 rounded w-max">
                    قاعدة رقم {idx + 1}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2 border-r-[3px] border-indigo-400 pr-3">
                      <p className="text-xs font-black text-slate-600">إذا تحقق الشرط التالي:</p>
                      <div className="flex gap-2">
                        <select 
                          value={rule.triggerField} 
                          onChange={(e) => {
                            const newRules = [...localJudgmentDefaults];
                            newRules[idx].triggerField = e.target.value;
                            setLocalJudgmentDefaults(newRules);
                          }}
                          className="text-xs font-bold p-2 rounded-lg border border-slate-300 w-1/3"
                        >
                          <option value="category">فئة الحكم</option>
                          <option value="classification">تصنيف الحكم</option>
                        </select>
                        {rule.triggerField === 'category' ? (
                          <select 
                            value={rule.triggerValue}
                            onChange={(e) => {
                              const newRules = [...localJudgmentDefaults];
                              newRules[idx].triggerValue = e.target.value;
                              setLocalJudgmentDefaults(newRules);
                            }}
                            className="text-xs font-bold p-2 rounded-lg border border-slate-300 w-2/3 bg-white"
                          >
                            <option value="">- اختر الفئة -</option>
                            {localJudgmentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <select 
                            value={rule.triggerValue}
                            onChange={(e) => {
                              const newRules = [...localJudgmentDefaults];
                              newRules[idx].triggerValue = e.target.value;
                              setLocalJudgmentDefaults(newRules);
                            }}
                            className="text-xs font-bold p-2 rounded-lg border border-slate-300 w-2/3 bg-white"
                          >
                            <option value="">- اختر التصنيف -</option>
                            {localJudgmentClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 border-r-[3px] border-emerald-400 pr-3">
                      <p className="text-xs font-black text-slate-600">يتم التعبئة التلقائية بـ:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <select 
                          value={rule.setClassification}
                          onChange={(e) => {
                            const newRules = [...localJudgmentDefaults];
                            newRules[idx].setClassification = e.target.value;
                            setLocalJudgmentDefaults(newRules);
                          }}
                          className="text-xs font-bold p-2 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="">-- تصنيف (اختياري) --</option>
                          {localJudgmentClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input 
                          type="text" 
                          placeholder="النوع (اختياري)" 
                          value={rule.setType}
                          onChange={(e) => {
                            const newRules = [...localJudgmentDefaults];
                            newRules[idx].setType = e.target.value;
                            setLocalJudgmentDefaults(newRules);
                          }}
                          className="text-xs font-bold p-2 rounded-lg border border-slate-300"
                        />
                      </div>
                      <input 
                        type="text" 
                        placeholder="المنطوق الافتراضي (اختياري)" 
                        value={rule.setText}
                        onChange={(e) => {
                          const newRules = [...localJudgmentDefaults];
                          newRules[idx].setText = e.target.value;
                          setLocalJudgmentDefaults(newRules);
                        }}
                        className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 mt-2"
                      />
                    </div>
                  </div>
                  <button onClick={() => setLocalJudgmentDefaults(localJudgmentDefaults.filter((_, i) => i !== idx))} className="self-end text-rose-500 hover:bg-rose-100 p-2 rounded-lg flex items-center gap-1 text-[10px] font-bold">
                    <Trash2 className="w-4 h-4"/> مسح القاعدة
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Save Settings Button */}
          <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
            {isProcessing ? 'جاري الحفظ...' : 'حفظ الإعدادات المتقدمة'}
          </button>
        </div>
      )}

    </div>
  );
}
