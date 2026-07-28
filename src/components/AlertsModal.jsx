import React, { useState } from 'react';
import { X, Bell, AlertTriangle, CheckCircle2, CalendarPlus } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useAppContext } from '../context/AppState';

export default function AlertsModal({ isOpen, onClose, caseData }) {
  const { saveCaseToFirebase, isAdmin } = useAppContext();
  const { toast } = useUI();
  const [newAlert, setNewAlert] = useState({ date: '', title: '' });
  const [isAddingAlert, setIsAddingAlert] = useState(false);

  if (!isOpen || !caseData) return null;

  const alertsList = Array.isArray(caseData.alerts) ? caseData.alerts : Object.values(caseData.alerts || {});

  const handleAddAlert = async () => {
    if (!newAlert.date || !newAlert.title) {
      toast('يرجى اختيار التاريخ وكتابة نص التنبيه.', 'error');
      return;
    }
    setIsAddingAlert(true);
    try {
      const alertObj = {
        id: Date.now().toString(),
        date: newAlert.date,
        title: newAlert.title,
        isDone: false,
        createdAt: new Date().toISOString()
      };
      
      const updatedAlerts = [...alertsList, alertObj];
      await saveCaseToFirebase(caseData.id, { alerts: updatedAlerts });
      
      setNewAlert({ date: '', title: '' });
      toast('تمت إضافة التنبيه بنجاح', 'success');
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء إضافة التنبيه', 'error');
    } finally {
      setIsAddingAlert(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-navy-900">مواعيد وتنبيهات الملف</h2>
              <p className="text-xs font-bold text-slate-500">إدارة التنبيهات لرقم الدعوى {caseData['رقم الدعوى'] || caseData['رقم القضية'] || caseData.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="p-4 sm:p-5 max-h-[60vh] overflow-y-auto">
          {alertsList.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
               <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
               <p className="text-sm font-bold text-slate-500">لا توجد مواعيد أو تنبيهات مسجلة.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertsList.map((alert, idx) => {
                 const isCompleted = alert.isDone;
                 const alertDate = new Date(alert.date);
                 const today = new Date();
                 const diffDays = Math.ceil((alertDate - today) / (1000 * 60 * 60 * 24));
                 
                 let statusClass = "bg-slate-50 border-slate-200";
                 let statusText = "";
                 
                 if (isCompleted) {
                   statusClass = "bg-slate-100 border-slate-200 opacity-60";
                   statusText = "مكتمل";
                 } else if (diffDays < 0) {
                   statusClass = "bg-rose-50 border-rose-300 shadow-sm";
                   statusText = "متأخر ⚠️";
                 } else if (diffDays <= 3) {
                   statusClass = "bg-amber-50 border-amber-300 shadow-sm";
                   statusText = "قريب جداً ⏳";
                 } else {
                   statusClass = "bg-blue-50 border-blue-200";
                   statusText = "قادم";
                 }

                 return (
                  <div key={alert.id || idx} className={`p-4 rounded-xl border ${statusClass} flex justify-between items-center transition`}>
                    <div>
                      <h4 className={`text-sm font-black ${isCompleted ? 'text-slate-500 line-through' : 'text-navy-900'}`}>
                        {alert.title}
                      </h4>
                      <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-2">
                        <span>الموعد: {alert.date}</span>
                        {!isCompleted && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black ${diffDays < 0 ? 'bg-rose-100 text-rose-700' : diffDays <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {statusText}
                          </span>
                        )}
                      </p>
                    </div>
                    {!isCompleted && isAdmin && (
                      <button
                        onClick={async () => {
                          const updatedAlerts = [...alertsList];
                          updatedAlerts[idx].isDone = true;
                          await saveCaseToFirebase(caseData.id, { alerts: updatedAlerts });
                          toast('تم إغلاق التنبيه', 'success');
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1 shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" /> إنجاز
                      </button>
                    )}
                  </div>
                 );
              })}
            </div>
          )}

          {isAdmin && (
            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 mt-6">
              <h4 className="text-xs font-black text-rose-900 mb-3 flex items-center gap-1.5">
                <CalendarPlus className="w-4 h-4" /> إضافة تنبيه جديد:
              </h4>
              <div className="flex flex-col gap-3">
                <input 
                  type="date" 
                  value={newAlert.date}
                  onChange={e => setNewAlert({...newAlert, date: e.target.value})}
                  className="bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:ring-rose-500"
                />
                <input 
                  type="text" 
                  placeholder="وصف التنبيه (مثال: آخر موعد للطعن)..." 
                  value={newAlert.title}
                  onChange={e => setNewAlert({...newAlert, title: e.target.value})}
                  className="bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:ring-rose-500"
                />
                <button 
                  onClick={handleAddAlert}
                  disabled={isAddingAlert}
                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm"
                >
                  {isAddingAlert ? 'جاري الإضافة...' : 'حفظ التنبيه'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
