import React, { useRef, useState } from 'react';
import { useAppContext } from '../../context/AppState';
import { useUI } from '../../context/UIContext';
import { Download, Upload, Check, Database, ArrowUpFromLine, Activity, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';

export default function SettingsDataTab() {
  const { cases, schema, saveBatchCasesToFirebase, saveSettingsToFirebase, saveSchemaToFirebase, deleteAllCases } = useAppContext();
  const { login, currentUser } = useAuth();
  const { toast, showConfirm } = useUI();

  const [syncData, setSyncData] = useState(null); // { added: [], updated: [], kept: [] }
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  
  const backupInputRef = useRef(null);
  const [backupRestoreStatus, setBackupRestoreStatus] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');

  const handleDeleteAll = async () => {
    if (!deletePassword) {
      toast('يرجى إدخال كلمة المرور!', 'error');
      return;
    }

    try {
      setIsProcessing(true);
      if (currentUser?.email) {
        await login(currentUser.email, deletePassword);
      }
    } catch (err) {
      setIsProcessing(false);
      toast('كلمة المرور غير صحيحة!', 'error');
      return;
    }

    setIsProcessing(false);
    const confirmed = await showConfirm('مسح البيانات', 'هل أنت متأكد من أنك تريد مسح جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.');
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

  const getCaseKey = (c) => {
    const id = c['رقم الدعوى'] || c['رقم القضية'] || c['رقم_الدعوى'] || '';
    const year = c['السنة'] || c['سنة'] || c['year'] || '';
    if (!id && !year) return `unnamed-${Date.now()}-${Math.random()}`;
    return `${id}-${year}`.replace(/[\/\\?%*:|"<>\s]/g, '_');
  };

  const handleExportBackup = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      cases: cases,
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
    const headers = {};
    schema.filter(s => s.visible).forEach(s => {
      headers[s.id] = "";
    });
    
    const noteRow = {};
    schema.filter(s => s.visible).forEach(s => {
      noteRow[s.id] = s.primary ? "حقل إجباري" : "اختياري";
    });

    const ws = XLSX.utils.json_to_sheet([noteRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب إدخال البيانات');
    XLSX.writeFile(wb, `قالب-اختصاصي-لإدخال-البيانات.xlsx`);
    toast('تم تحميل قالب الإكسيل بنجاح', 'success');
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
          if (typeof val === 'number' && val > 30000 && val < 70000 && (k.includes('جلسة') || k.includes('تاريخ') || k.includes('حكم'))) {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            val = date.toISOString().split('T')[0];
          }
          clean[k.trim()] = String(val).trim();
        }
        return clean;
      });

      const schemaKeys = schema.map(s => s.id);
      
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

  return (
    <div className="space-y-4 animate-in fade-in zoom-in duration-300">
      {/* Smart Sync Section */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Database className="w-5 h-5 text-navy-900" />
          <h3 className="font-black text-sm text-navy-900">مزامنة البيانات من Excel (Smart Sync)</h3>
        </div>
        <p className="text-[11px] font-bold text-slate-500">قم برفع ملف إكسيل لتحديث البيانات الحالية. النظام ذكي بما يكفي لتحديث القضايا الموجودة وإضافة الجديدة دون تكرار.</p>

        <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={processExcel} className="hidden" />

        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleDownloadTemplate} className="flex flex-col items-center gap-2 p-4 border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 text-emerald-700 font-bold rounded-2xl transition">
            <Download className="w-6 h-6 text-emerald-500" />
            <span className="text-xs text-center">تحميل قالب إدخال فارغ</span>
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
              <Check className="w-4 h-4" /> تم تحليل الملف بنجاح
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-lg p-2 shadow-sm border border-emerald-100">
                <p className="text-lg font-black text-emerald-600">{syncData.added}</p>
                <p className="text-[10px] font-bold text-slate-500">قضايا جديدة</p>
              </div>
              <div className="bg-white rounded-lg p-2 shadow-sm border border-emerald-100">
                <p className="text-lg font-black text-blue-600">{syncData.updated}</p>
                <p className="text-[10px] font-bold text-slate-500">تم تحديثها</p>
              </div>
              <div className="bg-white rounded-lg p-2 shadow-sm border border-emerald-100">
                <p className="text-lg font-black text-slate-600">{syncData.kept}</p>
                <p className="text-[10px] font-bold text-slate-500">قضايا مطابقة</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSyncData(null)} className="flex-1 bg-white border border-slate-200 py-2 rounded-xl text-xs font-bold">إلغاء</button>
              <button onClick={confirmSync} disabled={isProcessing} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm disabled:opacity-50">
                {isProcessing ? 'جاري الحفظ...' : 'تأكيد وحفظ المزامنة'}
              </button>
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
          <Download className="w-5 h-5 text-indigo-600" />
          <h3 className="font-black text-sm text-navy-900">تصدير ونسخ احتياطي</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleExportBackup} className="group bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 p-4 rounded-xl flex flex-col items-center gap-2 transition">
            <div className="w-10 h-10 bg-indigo-100 group-hover:bg-indigo-200 rounded-xl flex items-center justify-center transition">
              <Database className="w-5 h-5 text-indigo-700" />
            </div>
            <span className="text-xs font-black text-indigo-900">نسخة احتياطية</span>
            <span className="text-[10px] font-bold text-indigo-600 text-center">تصدير جميع القضايا بصيغة (JSON) كنسخة كاملة</span>
          </button>
          
          <button onClick={handleExportExcel} className="group bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 p-4 rounded-xl flex flex-col items-center gap-2 transition">
            <div className="w-10 h-10 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center transition">
              <Download className="w-5 h-5 text-blue-700" />
            </div>
            <span className="text-xs font-black text-blue-800">تصدير Excel</span>
            <span className="text-[10px] font-bold text-blue-600 text-center">تصدير جميع القضايا بصيغة إكسيل</span>
          </button>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-[11px] font-bold text-slate-600">
            عدد القضايا الإجمالي المسجلة: <span className="text-navy-900 font-black">{cases.length} قضية</span>
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
          يمكنك استعادة قاعدة البيانات من ملف JSON تم تصديره سابقاً. سيتم دمج البيانات الجديدة مع البيانات الحالية.
        </p>

        <input type="file" accept=".json" ref={backupInputRef} onChange={handleImportBackup} className="hidden" />

        {!backupRestoreStatus && (
          <button
            onClick={() => backupInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50 text-slate-600 font-bold py-5 rounded-2xl flex flex-col items-center justify-center gap-2 transition"
          >
            <ArrowUpFromLine className="w-7 h-7 text-amber-500" />
            <span className="text-sm">رفع ملف نسخة احتياطية (.json)</span>
          </button>
        )}

        {backupRestoreStatus?.type === 'preview' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <h4 className="font-black text-sm text-amber-900 flex items-center gap-2">
              <Check className="w-4 h-4" /> تم تحليل الملف بنجاح
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
                تاريخ النسخة: {new Date(backupRestoreStatus.exportedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setBackupRestoreStatus(null)} className="flex-1 bg-white border border-slate-200 py-2 rounded-xl text-xs font-bold">إلغاء</button>
              <button onClick={confirmRestoreBackup} disabled={isProcessing} className="flex-[2] bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-xs shadow-sm disabled:opacity-50">
                {isProcessing ? 'جاري الاستعادة...' : 'تأكيد واستعادة'}
              </button>
            </div>
          </div>
        )}

        {backupRestoreStatus?.type === 'success' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-2">
            <p className="text-2xl">✅</p>
            <p className="font-black text-emerald-800">تم الاستعادة بنجاح!</p>
            <p className="text-[11px] font-bold text-emerald-600">تم استعادة {backupRestoreStatus.casesCount} قضية</p>
            <button onClick={() => setBackupRestoreStatus(null)} className="text-xs font-bold text-emerald-700 underline">إخفاء</button>
          </div>
        )}
      </div>
      {/* Factory Reset */}
      <div className="bg-rose-50 rounded-2xl p-5 border border-rose-200 shadow-sm space-y-4 mt-8">
        <div className="flex items-center gap-2 pb-3 border-b border-rose-200/50">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <h3 className="font-black text-sm text-rose-900">منطقة الخطر: مسح البيانات</h3>
        </div>
        <p className="text-[11px] font-bold text-rose-700">تحذير: سيتم حذف جميع القضايا والملفات بشكل نهائي. تأكد من عمل نسخة احتياطية (Excel أو JSON) قبل القيام بهذه الخطوة.</p>

        <div className="flex gap-2">
          <input
            type="password"
            placeholder="أدخل باسوورد الإدارة للتأكيد"
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
  );
}
