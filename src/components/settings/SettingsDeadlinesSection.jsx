import React from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';

export default function SettingsDeadlinesSection({ 
  localDeadlineRules, 
  setLocalDeadlineRules, 
  handleSaveSettings, 
  isProcessing 
}) {
  return (
    <details className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-0 animate-in fade-in zoom-in duration-300">
      <summary className="flex items-center justify-between pb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-slate-100 transition-colors">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-rose-600" />
          <h3 className="font-black text-sm text-navy-900"><span className="text-[12px] opacity-70 group-open:hidden ml-1">▼</span><span className="text-[12px] opacity-70 hidden group-open:inline ml-1">▲</span> محرك قواعد المواعيد الإجرائية</h3>
        </div>
        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}><button
          onClick={() => {
            setLocalDeadlineRules([...localDeadlineRules, { name: 'قاعدة جديدة', days: 30, alertDaysBefore: 15, targetRole: 'طاعنين', description: '' }]);
          }}
          className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-200 transition"
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
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
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
                <div className="lg:col-span-2">
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
                
                {rule.name.includes('وقف') && (
                  <div>
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
                <div>
                  <label className="text-[9px] text-slate-500 font-bold block mb-1">المهلة الإجمالية (يوم)</label>
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
                <div>
                  <label className="text-[9px] text-slate-500 font-bold block mb-1">التنبيه قبل (يوم)</label>
                  <input
                    type="number"
                    value={rule.alertDaysBefore !== undefined ? rule.alertDaysBefore : 15}
                    onChange={e => {
                      const newRules = [...localDeadlineRules];
                      newRules[idx].alertDaysBefore = parseInt(e.target.value) || 0;
                      setLocalDeadlineRules(newRules);
                    }}
                    className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                    placeholder="مثال: 15"
                  />
                </div>
                
                <div className="sm:col-span-2 lg:col-span-4">
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
          <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm hover:bg-navy-800 transition disabled:opacity-50">
            {isProcessing ? 'جاري الحفظ...' : 'حفظ المواعيد'}
          </button>
        </div>

      </div>
    </details>
  );
}
