import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, LEGACY_CASES_COLLECTION_REF, LEGACY_ROLLS_COLLECTION_REF, LEGACY_TASKS_COLLECTION_REF, LEGACY_SETTINGS_DOC_REF, LEGACY_SCHEMA_DOC_REF, getCasesRef, getRollsRef, getTasksRef, getSettingsRef, getSchemaRef, INVITES_REF, USERS_DIRECTORY_REF } from '../lib/firebase';
import { getDocs, getDoc, setDoc, doc, writeBatch, query, where, orderBy, getCountFromServer, updateDoc } from 'firebase/firestore';
import { ShieldAlert, Database, Key, Copy, Check, Users, Activity, ToggleLeft, ToggleRight, LayoutDashboard, Calendar, FolderOpen, Scale } from 'lucide-react';
import { useUI } from '../context/UIContext';

export default function SuperAdmin() {
  const { userData } = useAuth();
  const { toast } = useUI();
  const [migrationStatus, setMigrationStatus] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  
  // Dashboard states
  const [showMigrationTool, setShowMigrationTool] = useState(false);
  const [consultants, setConsultants] = useState([]);
  const [invites, setInvites] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (userData?.role === 'super_admin') {
      fetchDashboardData();
    }
  }, [userData]);

  const fetchDashboardData = async () => {
    setIsLoadingData(true);
    try {
      // Fetch consultants
      const qUsers = query(USERS_DIRECTORY_REF, where("role", "==", "consultant"));
      const usersSnap = await getDocs(qUsers);
      const fetchedConsultants = [];
      
      for (const docSnap of usersSnap.docs) {
        const data = docSnap.data();
        let casesCount = 0;
        try {
          const countSnap = await getCountFromServer(getCasesRef(data.tenantId));
          casesCount = countSnap.data().count;
        } catch (e) {
          console.error("Count err", e);
        }
        fetchedConsultants.push({ id: docSnap.id, casesCount, ...data });
      }
      setConsultants(fetchedConsultants);

      // Fetch invites
      const invitesSnap = await getDocs(INVITES_REF);
      const fetchedInvites = [];
      invitesSnap.forEach(doc => fetchedInvites.push({ id: doc.id, ...doc.data() }));
      
      // Sort invites by date descending
      fetchedInvites.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setInvites(fetchedInvites);

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast('حدث خطأ أثناء تحميل بيانات الإحصائيات.', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  if (userData?.role !== 'super_admin') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4"><div className="bg-white p-8 rounded-3xl shadow text-center font-bold text-rose-600">غير مصرح لك بدخول هذه الصفحة</div></div>;
  }

  const handleToggleLogo = async (consultantId, currentStatus) => {
    try {
      await updateDoc(doc(USERS_DIRECTORY_REF, consultantId), {
        canCustomizeLogo: !currentStatus
      });
      fetchDashboardData();
      toast('تم تحديث الصلاحية بنجاح', 'success');
    } catch (error) {
      console.error(error);
      toast('حدث خطأ أثناء التحديث', 'error');
    }
  };

  const handleToggleBan = async (consultantId, currentStatus) => {
    const action = currentStatus ? 'إلغاء حظر' : 'حظر';
    if (!window.confirm(`هل أنت متأكد من ${action} هذا المستشار؟`)) return;
    try {
      await updateDoc(doc(USERS_DIRECTORY_REF, consultantId), {
        banned: !currentStatus
      });
      fetchDashboardData();
      toast(`تم ${action} المستشار بنجاح`, 'success');
    } catch (error) {
      console.error(error);
      toast('حدث خطأ أثناء التحديث', 'error');
    }
  };

  const handleMigration = async () => {
    if (!window.confirm('هل أنت متأكد من بدء عملية الترحيل؟')) return;
    
    setIsMigrating(true);
    setMigrationStatus('جاري قراءة البيانات القديمة...');
    const tenantId = 'tenant_main';
    
    try {
      const settingsSnap = await getDoc(LEGACY_SETTINGS_DOC_REF);
      if (settingsSnap.exists()) await setDoc(getSettingsRef(tenantId), settingsSnap.data());
      
      const schemaSnap = await getDoc(LEGACY_SCHEMA_DOC_REF);
      if (schemaSnap.exists()) await setDoc(getSchemaRef(tenantId), schemaSnap.data());

      setMigrationStatus('جاري ترحيل الدعاوى والجلسات (Cases)...');
      const casesSnap = await getDocs(LEGACY_CASES_COLLECTION_REF);
      let casesBatch = writeBatch(db);
      let casesCount = 0;
      casesSnap.forEach(docSnap => { casesBatch.set(doc(getCasesRef(tenantId), docSnap.id), docSnap.data()); casesCount++; });
      if (casesCount > 0) await casesBatch.commit();

      setMigrationStatus('جاري ترحيل الرولات (Rolls)...');
      const rollsSnap = await getDocs(LEGACY_ROLLS_COLLECTION_REF);
      let rollsBatch = writeBatch(db);
      let rollsCount = 0;
      rollsSnap.forEach(docSnap => { rollsBatch.set(doc(getRollsRef(tenantId), docSnap.id), docSnap.data()); rollsCount++; });
      if (rollsCount > 0) await rollsBatch.commit();

      setMigrationStatus('جاري ترحيل المهام (Tasks)...');
      const tasksSnap = await getDocs(LEGACY_TASKS_COLLECTION_REF);
      let tasksBatch = writeBatch(db);
      let tasksCount = 0;
      tasksSnap.forEach(docSnap => { tasksBatch.set(doc(getTasksRef(tenantId), docSnap.id), docSnap.data()); tasksCount++; });
      if (tasksCount > 0) await tasksBatch.commit();

      setMigrationStatus('✅ تمت عملية الترحيل بنجاح تام!');
      toast('تم ترحيل البيانات بنجاح', 'success');
    } catch (error) {
      console.error(error);
      setMigrationStatus(`❌ حدث خطأ أثناء الترحيل: ${error.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const generateInvite = async () => {
    const code = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newTenantId = 'counselor_' + Math.random().toString(36).substring(2, 10);
    
    await setDoc(doc(INVITES_REF, code), {
      code,
      tenantId: newTenantId,
      createdAt: new Date().toISOString(),
      used: false
    });
    
    setInviteCode(code);
    setCopied(false);
    fetchDashboardData(); // Refresh list
    toast('تم إنشاء كود الدعوة بنجاح', 'success');
  };

  const copyCode = (codeText) => {
    navigator.clipboard.writeText(codeText);
    if (codeText === inviteCode) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    toast('تم نسخ الكود', 'success');
  };

  const unusedInvites = invites.filter(inv => !inv.used).length;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 animate-fade-in pb-10">
      
      {/* Header */}
      <div className="bg-gradient-to-l from-indigo-900 to-indigo-800 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <LayoutDashboard className="w-8 h-8 text-indigo-200" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black">لوحة التحكم العليا</h1>
            <p className="text-indigo-200 font-bold text-sm mt-1">مراقبة النظام، إدارة مساحات العمل، والأكواد</p>
          </div>
        </div>
        <button onClick={() => setShowMigrationTool(!showMigrationTool)} className="bg-white/10 hover:bg-white/20 transition px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
          <Database className="w-4 h-4" />
          {showMigrationTool ? 'إخفاء أداة الترحيل' : 'إظهار أداة الترحيل'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-800">{isLoadingData ? '-' : consultants.length}</p>
          <p className="text-xs font-bold text-slate-500 mt-1">المستشارين (Tenants)</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
            <Key className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-800">{isLoadingData ? '-' : invites.length}</p>
          <p className="text-xs font-bold text-slate-500 mt-1">إجمالي الدعوات</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3">
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-2xl font-black text-slate-800">{isLoadingData ? '-' : unusedInvites}</p>
          <p className="text-xs font-bold text-slate-500 mt-1">دعوات غير مستخدمة</p>
        </div>
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center">
          <button 
            onClick={generateInvite}
            className="w-full h-full min-h-[100px] flex flex-col items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl transition shadow-md group"
          >
            <div className="bg-white/20 p-2 rounded-full group-hover:scale-110 transition-transform">
              <Key className="w-5 h-5" />
            </div>
            <span className="text-sm font-black">توليد كود مستشار</span>
          </button>
        </div>
      </div>

      {/* New generated invite banner */}
      {inviteCode && (
        <div className="bg-emerald-50 border-2 border-emerald-500 p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-white p-2 rounded-full">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-emerald-900 text-lg">تم إنشاء الكود بنجاح</p>
              <p className="text-xs font-bold text-emerald-700 mt-1">أرسل هذا الكود للمستشار الجديد لإنشاء حسابه.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-emerald-200 shadow-sm">
            <span className="font-mono text-xl font-black text-emerald-800 tracking-widest">{inviteCode}</span>
            <button onClick={() => copyCode(inviteCode)} className="text-emerald-600 hover:text-emerald-800 transition p-2 bg-emerald-50 rounded-lg">
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {/* Migration Tool Toggle Area */}
      {showMigrationTool && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-rose-600" />
            <h2 className="text-lg font-black text-rose-900">ترحيل البيانات القديمة (نظام قاعدة البيانات المفتوحة)</h2>
          </div>
          <p className="text-sm font-bold text-rose-700 leading-relaxed max-w-3xl">
            استخدم هذه الأداة لنقل البيانات من الإصدار القديم إلى مساحة `tenant_main`. تستخدم هذه الأداة لمرة واحدة فقط عند الترقية.
          </p>
          <button 
            onClick={handleMigration}
            disabled={isMigrating}
            className="w-full md:w-auto px-8 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition"
          >
            {isMigrating ? 'جاري الترحيل...' : 'بدء عملية الترحيل الآن'}
          </button>
          {migrationStatus && (
            <div className={`p-4 rounded-xl text-sm font-bold mt-4 ${migrationStatus.includes('✅') ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {migrationStatus}
            </div>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Consultants Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="font-black text-slate-800 text-lg">المستشارين المسجلين</h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {isLoadingData ? (
              <div className="flex justify-center items-center h-full text-slate-400 font-bold text-sm">جاري التحميل...</div>
            ) : consultants.length === 0 ? (
              <div className="flex justify-center items-center h-full text-slate-400 font-bold text-sm">لا يوجد مستشارين حالياً</div>
            ) : (
              <div className="space-y-3">
                {consultants.map(c => (
                  <div key={c.id} className={`bg-white border p-4 rounded-2xl transition shadow-sm ${c.banned ? 'border-rose-300 opacity-75' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-black text-slate-800">{c.email}</span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${c.banned ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {c.banned ? 'محظور' : 'نشط'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-xl">
                        <Database className="w-3 h-3 text-slate-400" />
                        <span>معرف:</span>
                        <code className="text-[10px]">{c.tenantId}</code>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-indigo-50 px-2 py-1 rounded-xl">
                        <FolderOpen className="w-3 h-3 text-indigo-400" />
                        <span>{c.casesCount || 0} قضية</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-100">
                      <button 
                        onClick={() => handleToggleLogo(c.id, c.canCustomizeLogo)}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition ${c.canCustomizeLogo ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        <Scale className="w-3 h-3" /> {c.canCustomizeLogo ? 'تعطيل اللوجو' : 'تفعيل اللوجو'}
                      </button>
                      
                      <button 
                        onClick={() => handleToggleBan(c.id, c.banned)}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-bold transition ${c.banned ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}`}
                      >
                        <ShieldAlert className="w-3 h-3" /> {c.banned ? 'فك الحظر' : 'حظر الحساب'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Invites Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
            <Key className="w-5 h-5 text-emerald-600" />
            <h2 className="font-black text-slate-800 text-lg">سجل الدعوات</h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {isLoadingData ? (
              <div className="flex justify-center items-center h-full text-slate-400 font-bold text-sm">جاري التحميل...</div>
            ) : invites.length === 0 ? (
              <div className="flex justify-center items-center h-full text-slate-400 font-bold text-sm">لا يوجد دعوات سابقة</div>
            ) : (
              <div className="space-y-3">
                {invites.map(inv => (
                  <div key={inv.id} className="bg-white border border-slate-200 p-3 rounded-2xl flex items-center justify-between hover:border-emerald-300 transition shadow-sm">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-black text-slate-800 tracking-wider">{inv.code}</span>
                        <button onClick={() => copyCode(inv.code)} className="text-slate-400 hover:text-indigo-600 transition">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(inv.createdAt).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    <div>
                      {inv.used ? (
                        <span className="text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-1.5 rounded-xl border border-rose-100 flex items-center gap-1">
                          <ToggleRight className="w-3 h-3" /> تم الاستخدام
                        </span>
                      ) : (
                        <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-1">
                          <ToggleLeft className="w-3 h-3" /> متاح للتسجيل
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
