import React, { useState, useEffect } from 'react';
import { X, ClipboardList, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';

export default function BulkAssignTaskModal({ isOpen, onClose, selectedCases, onClearSelection }) {
  const { settings, saveGlobalTask, cases } = useAppContext();
  const { toast } = useUI();
  
  const [selectedTaskType, setSelectedTaskType] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-select the "إطلاع" employee if they exist, or just clear
  useEffect(() => {
    if (isOpen) {
      const reviewEmployee = settings?.employees?.find(e => e.jobTitle === 'إطلاع');
      if (reviewEmployee) {
        setSelectedAssignee(reviewEmployee.name);
      } else {
        setSelectedAssignee('');
      }
      setSelectedTaskType('');
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleAssign = async () => {
    if (!selectedAssignee || !selectedTaskType) {
      toast('يرجى اختيار الموظف ونوع المهمة.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const taskId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      const globalTaskObj = {
        id: taskId,
        assignee: selectedAssignee,
        title: selectedTaskType,
        status: 'pending',
        notes: '',
        createdAt: new Date().toISOString(),
        linkedCases: selectedCases,
      };

      await saveGlobalTask(taskId, globalTaskObj);

      toast('تم إنشاء المهمة بنجاح!', 'success');
      onClearSelection();
      onClose();
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء إنشاء المهمة.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-navy-900">إسناد مهمة جماعية</h2>
              <p className="text-[11px] font-bold text-slate-500">{selectedCases.length} ملف محدد</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          
          <div className="space-y-2">
            <label className="text-xs font-black text-navy-900">الموظف المكلف (الإطلاع تلقائياً)</label>
            <select 
              value={selectedAssignee} 
              onChange={e => setSelectedAssignee(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- اختر الموظف --</option>
              {settings?.employees?.map(emp => (
                <option key={emp.name} value={emp.name}>{emp.name} ({emp.jobTitle})</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-navy-900">نوع المهمة</label>
            <div className="grid grid-cols-2 gap-2">
              {(settings?.reviewTasks || []).map(task => (
                <button
                  key={task}
                  onClick={() => setSelectedTaskType(task)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    selectedTaskType === task 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {task}
                </button>
              ))}
            </div>
            
            <div className="mt-2 pt-2 border-t border-slate-100">
               <input 
                 type="text"
                 placeholder="أو اكتب مهمة أخرى هنا..."
                 value={selectedTaskType}
                 onChange={e => setSelectedTaskType(e.target.value)}
                 className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
               />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
          >
            إلغاء
          </button>
          <button 
            onClick={handleAssign}
            disabled={isSaving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isSaving ? (
              'جاري الإسناد...'
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> تأكيد الإسناد
              </>
            )}
          </button>
        </div>
        
      </div>
    </div>
  );
}
