import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, LEGACY_CASES_COLLECTION_REF, LEGACY_ROLLS_COLLECTION_REF, LEGACY_TASKS_COLLECTION_REF, LEGACY_SETTINGS_DOC_REF, LEGACY_SCHEMA_DOC_REF, getCasesRef, getRollsRef, getTasksRef, getSettingsRef, getSchemaRef, INVITES_REF } from '../lib/firebase';
import { getDocs, getDoc, setDoc, doc, writeBatch, collection } from 'firebase/firestore';
import { ShieldAlert, Database, Key, Copy, Check } from 'lucide-react';

export default function SuperAdmin() {
  const { userData } = useAuth();
  const [migrationStatus, setMigrationStatus] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  if (userData?.role !== 'super_admin') {
    return <div className="p-8 text-center font-bold text-rose-600">غير مصرح لك بدخول هذه الصفحة</div>;
  }

  const handleMigration = async () => {
    if (!window.confirm('هل أنت متأكد من بدء عملية الترحيل؟ هذه العملية ستقوم بنسخ البيانات من قاعدة البيانات القديمة إلى مساحة العمل الخاصة بك (tenant_main)')) {
      return;
    }
    setIsMigrating(true);
    setMigrationStatus('جاري قراءة البيانات القديمة...');
    const tenantId = 'tenant_main';
    
    try {
      // 1. Migrate Settings
      const settingsSnap = await getDoc(LEGACY_SETTINGS_DOC_REF);
      if (settingsSnap.exists()) {
        await setDoc(getSettingsRef(tenantId), settingsSnap.data());
      }
      
      // 2. Migrate Schema
      const schemaSnap = await getDoc(LEGACY_SCHEMA_DOC_REF);
      if (schemaSnap.exists()) {
        await setDoc(getSchemaRef(tenantId), schemaSnap.data());
      }

      setMigrationStatus('جاري ترحيل الدعاوى والجلسات (Cases)...');
      const casesSnap = await getDocs(LEGACY_CASES_COLLECTION_REF);
      let casesBatch = writeBatch(db);
      let casesCount = 0;
      casesSnap.forEach(docSnap => {
        casesBatch.set(doc(getCasesRef(tenantId), docSnap.id), docSnap.data());
        casesCount++;
      });
      if (casesCount > 0) await casesBatch.commit();

      setMigrationStatus('جاري ترحيل الرولات (Rolls)...');
      const rollsSnap = await getDocs(LEGACY_ROLLS_COLLECTION_REF);
      let rollsBatch = writeBatch(db);
      let rollsCount = 0;
      rollsSnap.forEach(docSnap => {
        rollsBatch.set(doc(getRollsRef(tenantId), docSnap.id), docSnap.data());
        rollsCount++;
      });
      if (rollsCount > 0) await rollsBatch.commit();

      setMigrationStatus('جاري ترحيل المهام (Tasks)...');
      const tasksSnap = await getDocs(LEGACY_TASKS_COLLECTION_REF);
      let tasksBatch = writeBatch(db);
      let tasksCount = 0;
      tasksSnap.forEach(docSnap => {
        tasksBatch.set(doc(getTasksRef(tenantId), docSnap.id), docSnap.data());
        tasksCount++;
      });
      if (tasksCount > 0) await tasksBatch.commit();

      setMigrationStatus('✅ تمت عملية الترحيل بنجاح تام! يمكنك الآن استخدام التطبيق بشكل طبيعي.');
    } catch (error) {
      console.error(error);
      setMigrationStatus(`❌ حدث خطأ أثناء الترحيل: ${error.message}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const generateInvite = async () => {
    const code = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newTenantId = 'tenant_' + Math.random().toString(36).substring(2, 10);
    
    await setDoc(doc(INVITES_REF, code), {
      code,
      tenantId: newTenantId,
      createdAt: new Date().toISOString(),
      used: false
    });
    
    setInviteCode(code);
    setCopied(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-lg flex items-center gap-4">
        <ShieldAlert className="w-12 h-12 text-indigo-300" />
        <div>
          <h1 className="text-2xl font-black">لوحة التحكم العليا (Super Admin)</h1>
          <p className="text-indigo-200 font-bold text-sm mt-1">إدارة مساحات العمل وترحيل البيانات</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Migration Tool */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-slate-800">ترحيل البيانات القديمة</h2>
          </div>
          <p className="text-sm font-bold text-slate-500 leading-relaxed">
            استخدم هذه الأداة لمرة واحدة فقط لنقل جميع البيانات من القاعدة القديمة المفتوحة إلى مساحة العمل الآمنة الخاصة بك (tenant_main).
          </p>
          <button 
            onClick={handleMigration}
            disabled={isMigrating}
            className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition"
          >
            {isMigrating ? 'جاري الترحيل...' : 'بدء عملية الترحيل الآن'}
          </button>
          {migrationStatus && (
            <div className={`p-4 rounded-xl text-sm font-bold mt-4 ${migrationStatus.includes('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : migrationStatus.includes('❌') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse'}`}>
              {migrationStatus}
            </div>
          )}
        </div>

        {/* Invite Generator */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Key className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black text-slate-800">إنشاء كود دعوة لمستشار جديد</h2>
          </div>
          <p className="text-sm font-bold text-slate-500 leading-relaxed">
            قم بإنشاء كود دعوة لإعطائه لمستشار جديد. باستخدام هذا الكود يمكنه إنشاء حساب ومساحة عمل منفصلة.
          </p>
          <button 
            onClick={generateInvite}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl transition"
          >
            توليد كود جديد
          </button>
          
          {inviteCode && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <span className="font-mono text-lg font-black text-slate-800 tracking-wider">{inviteCode}</span>
              <button onClick={copyCode} className="text-slate-500 hover:text-indigo-600 transition p-2 bg-white rounded-lg shadow-sm">
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
