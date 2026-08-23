import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppState';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { Settings as SettingsIcon, Plus, Trash2, ShieldAlert } from 'lucide-react';

export default function SettingsSystemTab() {
  const { settings, saveSettingsToFirebase, deleteAllCases } = useAppContext();
  const { currentUser } = useAuth();
  const { login } = useAuth(); // Needed for re-auth
  const { toast, showConfirm, showPrompt } = useUI();
  
  const [localNumberFormat, setLocalNumberFormat] = useState('en');
  const [localDateFormat, setLocalDateFormat] = useState('dd/MM/yyyy');
  const [localConsultantName, setLocalConsultantName] = useState('');
  const [localCourtDegree, setLocalCourtDegree] = useState('أول درجة');
  const [localCourtSpecialization, setLocalCourtSpecialization] = useState('قضاء إداري');
  const [localReviewTasks, setLocalReviewTasks] = useState([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    setLocalNumberFormat(settings?.numberFormat || 'en');
    setLocalDateFormat(settings?.dateFormat || 'dd/MM/yyyy');
    setLocalConsultantName(settings?.consultantName || settings?.officeName || '');
    setLocalCourtDegree(settings?.courtDegree || 'أول درجة');
    setLocalCourtSpecialization(settings?.courtSpecialization || 'قضاء إداري');
    setLocalReviewTasks(settings?.reviewTasks || ['تصوير ملف', 'تقرير مفوضين', 'حكم أول درجة', 'تقرير خبراء', 'حافظة مستندات']);
  }, [settings]);

  const handleSaveSystemSettings = async () => {
    setIsProcessing(true);
    await saveSettingsToFirebase({
      ...settings,
      numberFormat: localNumberFormat,
      dateFormat: localDateFormat,
      consultantName: localConsultantName,
      courtDegree: localCourtDegree,
      courtSpecialization: localCourtSpecialization,
      reviewTasks: localReviewTasks
    });
    setIsProcessing(false);
    toast('تم حفظ إعدادات النظام بنجاح', 'success');
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

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
      {/* Global Preferences */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
          <h3 className="font-black text-sm text-navy-900">إعدادات النظام العامة</h3>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between border-b border-slate-100 pb-4">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-xs font-bold text-slate-700">تنسيق الأرقام (لأرقام القضايا):</label>
              <div className="flex bg-slate-100 p-1 rounded-xl self-start">
                <button
                  onClick={() => setLocalNumberFormat('en')}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition ${localNumberFormat === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  إنجليزية (123)
                </button>
                <button
                  onClick={() => setLocalNumberFormat('ar')}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition ${localNumberFormat === 'ar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  عربية (١٢٣)
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
                <option value="dd/MM/yyyy">يوم/شهر/سنة (15/08/2023)</option>
                <option value="MM/dd/yyyy">شهر/يوم/سنة (08/15/2023)</option>
                <option value="yyyy-MM-dd">سنة-شهر-يوم (2023-08-15)</option>
                <option value="dd-MM-yyyy">يوم-شهر-سنة (15-08-2023)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">اسم المستشار / اسم المكتب المطبوع:</label>
              <input
                type="text"
                value={localConsultantName}
                onChange={e => setLocalConsultantName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                placeholder="اسم المستشار للطباعة"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">درجة التقاضي الافتراضية للطباعة:</label>
              <input
                type="text"
                value={localCourtDegree}
                onChange={e => setLocalCourtDegree(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                placeholder="أول درجة / استئناف / نقض"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">التخصص الافتراضي للطباعة:</label>
              <input
                type="text"
                value={localCourtSpecialization}
                onChange={e => setLocalCourtSpecialization(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                placeholder="مدني / قضاء إداري"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button onClick={handleResetConfirms} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline transition">
              إعادة تفعيل جميع رسائل التأكيد المخفية
            </button>
          </div>
        </div>
      </div>

      {/* Review Tasks Management */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
          <h3 className="font-black text-sm text-navy-900">إدارة مهام الإطلاع الدورية</h3>
        </div>
        <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
          هذه هي الخيارات التي تظهر في قائمة مهام الاطلاع (للمنوبين أو للمراجعة بالمحكمة).
        </p>
        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
          {localReviewTasks.map((task, i) => (
            <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
              <span>{task}</span>
              <button onClick={() => setLocalReviewTasks(localReviewTasks.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-indigo-600 mr-2">
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

      {/* Save Settings Button */}
      <button onClick={handleSaveSystemSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm hover:bg-navy-800 transition disabled:opacity-50">
        {isProcessing ? 'جاري الحفظ...' : 'حفظ إعدادات النظام'}
      </button>

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
  );
}
