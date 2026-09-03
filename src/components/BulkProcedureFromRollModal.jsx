import React, { useState } from 'react';
import { X, ClipboardList, Bell, Eye, Save } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import SmartDateInput from './SmartDateInput';

const ACTION_TYPES = [
  { id: 'procedure', label: 'إجراء', icon: ClipboardList, color: 'indigo', description: 'إيداع مذكرة، تقديم مستندات، سداد أمانة، إلخ' },
  { id: 'review', label: 'مهمة إطلاع', icon: Eye, color: 'amber', description: 'تصوير ملف، مراجعة مستندات، اطلاع على ملف' },
  { id: 'reminder', label: 'تذكير / تنبيه', icon: Bell, color: 'rose', description: 'تذكير بجلسة، تنبيه بموعد هام، متابعة مطلوبة' },
];

export default function BulkProcedureFromRollModal({ isOpen, onClose, selectedCaseIds, cases, sessionDate }) {
  const { saveCaseToFirebase, saveGlobalTask, settings } = useAppContext();
  const { toast } = useUI();

  const [actionType, setActionType] = useState('procedure');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(sessionDate || new Date().toISOString().split('T')[0]);
  const [assignee, setAssignee] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const selectedCases = cases.filter(c => selectedCaseIds.has(c.id));
  const employees = settings?.employees || [];

  const handleSave = async () => {
    if (!title.trim()) {
      toast('يرجى إدخال عنوان الإجراء/المهمة.', 'error');
      return;
    }
    if (selectedCases.length === 0) {
      toast('لم يتم تحديد أي ملف.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (actionType === 'procedure') {
        const promises = selectedCases.map(async (caseObj) => {
          const existingProcedures = Array.isArray(caseObj.procedures)
            ? caseObj.procedures
            : Object.values(caseObj.procedures || {});
          const newProc = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
            title: title.trim(),
            date: dueDate,
            notes: notes.trim(),
            sessionDate: sessionDate || null,
            createdAt: new Date().toISOString(),
          };
          await saveCaseToFirebase(caseObj.id, { procedures: [...existingProcedures, newProc] });
        });
        await Promise.all(promises);
        toast(`تم إضافة الإجراء لـ ${selectedCases.length} ملف بنجاح!`, 'success');
      } else {
        const taskId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        await saveGlobalTask(taskId, {
          id: taskId,
          assignee: assignee || 'غير محدد',
          title: title.trim(),
          notes: notes.trim(),
          status: 'pending',
          dueDate: dueDate,
          type: actionType,
          createdAt: new Date().toISOString(),
          linkedCases: selectedCases.map(c => c.id),
          sessionDate: sessionDate || null,
        });
        toast(`تم إنشاء ${actionType === 'reminder' ? 'التذكير' : 'المهمة'} لـ ${selectedCases.length} ملف!`, 'success');
      }
      onClose();
      setTitle('');
      setNotes('');
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء الحفظ.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="font-black text-base text-navy-900">إضافة جماعية من الرول</h2>
            <p className="text-[11px] font-bold text-slate-500 mt-0.5">{selectedCases.length} ملف محدد</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {ACTION_TYPES.map(at => {
              const Icon = at.icon;
              const isActive = actionType === at.id;
              return (
                <button key={at.id} onClick={() => setActionType(at.id)}
                  className={`p-3 rounded-2xl border-2 text-center transition flex flex-col items-center gap-1.5 ${isActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className={`text-[11px] font-black ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>{at.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-2 rounded-xl">
            {ACTION_TYPES.find(a => a.id === actionType)?.description}
          </p>

          <div>
            <label className="text-xs font-black text-navy-900 block mb-1">
              {actionType === 'procedure' ? 'نوع الإجراء' : actionType === 'reminder' ? 'موضوع التذكير' : 'نوع المهمة'} *
            </label>
            {actionType === 'procedure' && settings?.commonProcedures?.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {settings.commonProcedures.map(p => (
                    <button key={p} onClick={() => setTitle(p)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${title === p ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
                      {p}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="أو اكتب إجراء مخصص..." value={title} onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
              </div>
            ) : (
              <input type="text" placeholder="اكتب هنا..." value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
            )}
          </div>

          {(actionType === 'review' || actionType === 'reminder') && (
            <div>
              <label className="text-xs font-black text-navy-900 block mb-1">المكلف</label>
              {employees.length > 0 ? (
                <select value={assignee} onChange={e => setAssignee(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-amber-400">
                  <option value="">-- اختر الموظف --</option>
                  {employees.map(e => <option key={e.name} value={e.name}>{e.name}{e.jobTitle ? ` (${e.jobTitle})` : ''}</option>)}
                </select>
              ) : (
                <input type="text" placeholder="اسم المكلف..." value={assignee} onChange={e => setAssignee(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-amber-400" />
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-black text-navy-900 block mb-1">تاريخ التنفيذ</label>
            <SmartDateInput  value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
          </div>

          <div>
            <label className="text-xs font-black text-navy-900 block mb-1">ملاحظات (اختياري)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="أي ملاحظات إضافية..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 resize-none" />
          </div>

          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
            <p className="text-[10px] font-black text-slate-500 mb-2">الملفات المحددة ({selectedCases.length})</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {selectedCases.map(c => (
                <div key={c.id} className="text-[10px] font-bold text-navy-900 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                  دعوى {c['رقم الدعوى']} لسنة {c['السنة']} - {c['المدعي'] || c['الطاعن'] || ''}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm">
            إلغاء
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="flex-[2] bg-navy-900 hover:bg-navy-800 text-amber-300 font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isSaving
              ? <span className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
              : <Save className="w-4 h-4" />}
            {isSaving ? 'جاري الحفظ...' : `تطبيق على ${selectedCases.length} ملف`}
          </button>
        </div>
      </div>
    </div>
  );
}
