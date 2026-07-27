import React, { useState, useRef } from 'react';
import { useAppContext } from '../context/AppState';
import { Upload, LogIn, LogOut, Check, ShieldCheck, Database, LayoutTemplate, Plus, Trash2, ArrowDownUp } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Settings() {
  const { isAdmin, loginAdmin, logoutAdmin, cases, schema, saveBatchCasesToFirebase, saveSchemaToFirebase, migrateLegacyData } = useAppContext();
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const fileInputRef = useRef(null);

  // Sync state
  const [syncData, setSyncData] = useState(null); // { added: [], updated: [], kept: [] }
  const [isProcessing, setIsProcessing] = useState(false);

  // Schema state
  const [localSchema, setLocalSchema] = useState(schema || []);
  const [activeTab, setActiveTab] = useState('sync'); // sync, schema, advanced

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
      alert("حدث خطأ أثناء قراءة الملف");
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
      alert('تم تحديث ومزامنة البيانات بنجاح!');
      setSyncData(null);
    } else {
      alert('حدث خطأ أثناء الحفظ.');
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
    alert('تم حفظ بنية البيانات بنجاح!');
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
      <div className="flex bg-slate-200/50 p-1 rounded-xl">
        <button onClick={() => setActiveTab('sync')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition ${activeTab === 'sync' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>مزامنة الداتا</button>
        <button onClick={() => setActiveTab('schema')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition ${activeTab === 'schema' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>هيكلة الحقول (No-Code)</button>
        <button onClick={() => setActiveTab('advanced')} className={`flex-1 text-xs font-bold py-2 rounded-lg transition ${activeTab === 'advanced' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>متقدم</button>
      </div>

      {/* SYNC TAB */}
      {activeTab === 'sync' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Database className="w-5 h-5 text-navy-900" />
            <h3 className="font-black text-sm text-navy-900">مزامنة البيانات (Smart Sync)</h3>
          </div>
          
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={processExcel} className="hidden" />
          
          <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full border-2 border-dashed border-slate-300 hover:border-navy-900 hover:bg-slate-50 text-slate-600 font-bold py-6 rounded-2xl flex flex-col items-center justify-center gap-2">
            {isProcessing ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-navy-900"></div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-amber-500" />
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

      {/* ADVANCED TAB */}
      {activeTab === 'advanced' && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4 animate-in fade-in zoom-in duration-300">
           <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ArrowDownUp className="w-5 h-5 text-rose-600" />
            <h3 className="font-black text-sm text-navy-900">مرحلة الانتقال للبنية الجديدة</h3>
          </div>
          <p className="text-xs font-bold text-slate-600">إذا كنت قد قمت بحفظ قضايا باستخدام الإصدار القديم من التطبيق (الذي كان يستخدم ملف واحد لحفظ كل القضايا)، يمكنك ترحيلها إلى البنية الجديدة (Collections) بالضغط هنا لمرة واحدة فقط.</p>
          <button onClick={migrateLegacyData} className="w-full bg-rose-50 text-rose-600 font-bold border border-rose-200 py-3 rounded-xl hover:bg-rose-100">
            ترحيل البيانات القديمة للبنية الجديدة
          </button>
        </div>
      )}

    </div>
  );
}
