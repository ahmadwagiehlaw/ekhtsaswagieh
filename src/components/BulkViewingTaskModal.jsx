import React, { useState, useEffect } from 'react';
import { X, ClipboardList, CheckCircle2, Save, FileText, Camera, Settings } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import SmartDateInput from './SmartDateInput';

export default function BulkViewingTaskModal({ isOpen, onClose, selectedCaseIds, cases, sessionDate }) {
  const { saveViewingTask, saveSettingsToFirebase, settings, currentUser } = useAppContext();
  const { toast, showPrompt } = useUI();

  const [selectedDocs, setSelectedDocs] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      let defaultDate = sessionDate;
      if (!defaultDate) {
         const selectedCases = cases.filter(c => selectedCaseIds.has(c.id));
         let latestDate = null;
         selectedCases.forEach(c => {
            const caseSessions = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
            caseSessions.forEach(s => {
               if (s.date && (!latestDate || new Date(s.date) > new Date(latestDate))) {
                   latestDate = s.date;
               }
            });
         });
         defaultDate = latestDate || new Date().toISOString().split('T')[0];
      }
      setDueDate(defaultDate);
    }
  }, [isOpen, sessionDate, cases, selectedCaseIds]);

  if (!isOpen) return null;

  const selectedCases = cases.filter(c => selectedCaseIds.has(c.id));
  const defaultDocs = settings?.reviewTasks || ['عريضة الدعوى', 'تقرير المفوضين', 'مذكرة الدفاع', 'حوافظ مستندات', 'محضر الجلسة'];

  const toggleDoc = (doc) => {
    if (selectedDocs.includes(doc)) {
      setSelectedDocs(selectedDocs.filter(d => d !== doc));
    } else {
      setSelectedDocs([...selectedDocs, doc]);
    }
  };

  const handleSave = async () => {
    if (selectedDocs.length === 0) {
      toast('يرجى تحديد مستند واحد على الأقل', 'error');
      return;
    }

    setIsSaving(true);
    let successCount = 0;

    for (const c of selectedCases) {
      // Find the latest session for case context
      const caseSessions = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
      const latestSession = caseSessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      const docsString = selectedDocs.join('، ');
      const title = `مهمة إطلاع وتصوير: ${docsString}`;
      
      const taskObj = {
        id: `viewing-${c.id}-${Date.now()}`,
        title: title,
        notes: `يرجى الإطلاع وتصوير: ${docsString}`,
        assignee: assignee || '',
        dueDate: dueDate || '',
        priority: 'normal',
        status: 'pending',
        type: 'viewing',
        linkedCases: [c.id],
        createdAt: new Date().toISOString(),
        createdBy: currentUser || 'مجهول',
        caseContext: {
          roll: latestSession?.roll || c['الرول'] || c['رول الجلسة'] || '',
          date: latestSession?.date || c['تاريخ الجلسة'] || '',
          decision: latestSession?.decision || c['القرار'] || c['قرار الجلسة'] || ''
        }
      };

      try {
        await saveViewingTask(taskObj);
        successCount++;
      } catch (error) {
        console.error("Error saving task:", error);
      }
    }

    setIsSaving(false);
    if (successCount > 0) {
      toast(`تم إنشاء ${successCount} مهمة إطلاع بنجاح`, 'success');
      onClose();
    } else {
      toast('حدث خطأ أثناء إنشاء المهام', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black">
                  {selectedCaseIds && selectedCaseIds.size === 1 ? 'إنشاء مهمة إطلاع' : 'إنشاء مهام إطلاع مجمعة'}
                </h3>
                <p className="text-indigo-100 text-sm font-bold mt-1">توليد مهام لـ {selectedCases.length} ملف</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/20 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-black text-navy-900">المستندات المطلوب الإطلاع عليها/تصويرها:</label>
              <button 
                type="button"
                onClick={async () => {
                  const newDoc = await showPrompt('إضافة نوع مستند', 'أدخل اسم المستند الجديد (مثال: تقرير طبي):');
                  if (newDoc && newDoc.trim()) {
                    const currentDocs = settings?.reviewTasks || ['عريضة الدعوى', 'تقرير المفوضين', 'مذكرة الدفاع', 'حوافظ مستندات', 'محضر الجلسة'];
                    if (!currentDocs.includes(newDoc.trim())) {
                      const updatedDocs = [...currentDocs, newDoc.trim()];
                      await saveSettingsToFirebase({ ...settings, reviewTasks: updatedDocs });
                      toast('تمت إضافة المستند للقائمة بنجاح', 'success');
                    }
                  }
                }}
                className="text-slate-400 hover:text-indigo-600 transition p-1.5 rounded-lg hover:bg-indigo-50"
                title="إضافة نوع مستند جديد للقائمة الدائمة"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {defaultDocs.map((doc, idx) => {
                const isSelected = selectedDocs.includes(doc);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDoc(doc)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-right transition-all ${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                      isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-xs font-bold leading-tight">{doc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1.5">تاريخ الاستحقاق / الجلسة</label>
              <SmartDateInput 
                
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1.5">إسناد إلى الموظف (اختياري)</label>
              <select 
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">غير محدد</option>
                {settings?.employees?.map(emp => (
                  <option key={emp.name} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <h4 className="text-xs font-black text-amber-800 mb-1">معلومة:</h4>
            <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
              سيتم إنشاء مهمة إطلاع منفصلة لكل ملف محدد، مما يتيح لك لاحقاً إرفاق المستندات المصورة داخل كل دعوى على حدة من خلال شاشة المهام.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || selectedDocs.length === 0}
            className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? 'جاري الإنشاء...' : 'إنشاء مهام الإطلاع الآن'}
          </button>
        </div>
      </div>
    </div>
  );
}
