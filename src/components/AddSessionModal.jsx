import React, { useState, useRef } from 'react';
import { X, Save, CalendarPlus, Paperclip, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { uploadToR2 } from '../lib/r2';
import { syncLatestSessionToCaseData } from '../utils/caseUtils';

import imageCompression from 'browser-image-compression';

export default function AddSessionModal({ isOpen, onClose, caseData }) {
  const { saveCaseToFirebase, saveViewingTask, settings, isAdmin, currentUserPermissions, currentUser } = useAppContext();
  const canEditData = isAdmin || currentUserPermissions?.canEditData;
  const { toast, showPrompt } = useUI();
  const [sessionDate, setSessionDate] = useState('');
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [roll, setRoll] = useState('');
  const [sessionType, setSessionType] = useState('فحص');
  
  // Viewing Task State
  const [createViewingTask, setCreateViewingTask] = useState(false);
  const [viewingTaskNotes, setViewingTaskNotes] = useState('');
  // Procedure States
  const [showProcedureForm, setShowProcedureForm] = useState(false);
  const [procedureTitle, setProcedureTitle] = useState('');
  const [procedureNotes, setProcedureNotes] = useState('');
  const [procedureAttachment, setProcedureAttachment] = useState(null);
  const [isUploadingProcedureFile, setIsUploadingProcedureFile] = useState(false);
  const procedureFileInputRef = useRef(null);

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !caseData) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sessionDate) {
      toast("يرجى إدخال تاريخ الجلسة", "error");
      return;
    }
    
    setIsSaving(true);
    
    // Create new session object
    const newSession = {
      id: Date.now().toString(),
      date: sessionDate,
      decision: decision,
      roll: roll,
      type: sessionType,
      notes: notes,
      createdAt: new Date().toISOString()
    };

    // Update case data
    const existingSessions = caseData.sessions || [];
    const updatedSessions = [...existingSessions, newSession].sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first

    const updateData = {
      sessions: updatedSessions,
    };

    if (procedureTitle.trim()) {
      const newProcObj = {
        id: Date.now().toString() + '_proc',
        title: procedureTitle.trim(),
        date: sessionDate, // Sync date with session
        notes: procedureNotes,
        sessionDate: sessionDate,
        attachmentUrl: procedureAttachment?.url || null,
        attachmentName: procedureAttachment?.name || null,
        createdAt: new Date().toISOString()
      };
      
      const currentProceduresList = Array.isArray(caseData.procedures) ? caseData.procedures : Object.values(caseData.procedures || {});
      updateData.procedures = [...currentProceduresList, newProcObj];
      
      if (procedureAttachment) {
         const updatedDocuments = caseData.documents || [];
         updateData.documents = [...updatedDocuments, {
            id: Date.now().toString() + '_doc',
            title: `مرفق إجراء الجلسة: ${procedureTitle.trim()}`,
            url: procedureAttachment.url,
            type: 'مستندات',
            fileType: procedureAttachment.name?.match(/\.(jpg|jpeg|png|webp)$/i) ? 'image' : 'pdf',
            date: sessionDate
         }];
      }
    }

    // Also update main fields to reflect the latest session for stats and list view
    Object.assign(updateData, syncLatestSessionToCaseData(caseData, updatedSessions));

    if (createViewingTask && saveViewingTask) {
      const caseNumber = caseData['رقم الدعوى'] || caseData['رقم القضية'] || '';
      const caseYear = caseData['السنة'] || caseData['سنة'] || '';
      const taskObj = {
        id: `viewing-${Date.now()}`,
        title: `مهمة اطلاع: دعوى ${caseNumber} لسنة ${caseYear}`,
        notes: viewingTaskNotes || 'يرجى مراجعة وتصوير المستندات المطلوبة لهذه الدعوى',
        dueDate: sessionDate, // usually relates to session
        createdAt: new Date().toISOString(),
        status: 'pending',
        priority: 'normal',
        type: 'viewing',
        assignee: '', // let them assign in Tasks screen if needed, or leave unassigned
        createdBy: currentUser || 'مجهول',
        linkedCases: [caseData.id],
        caseContext: {
          roll: roll,
          date: sessionDate,
          decision: decision
        }
      };
      await saveViewingTask(taskObj);
    }

    const success = await saveCaseToFirebase(caseData.id, updateData);
    setIsSaving(false);
    
    if (success) {
      setSessionDate('');
      setDecision('');
      setRoll('');
      setSessionType('فحص');
      setNotes('');
      setProcedureTitle('');
      setProcedureNotes('');
      setProcedureAttachment(null);
      setShowProcedureForm(false);
      setCreateViewingTask(false);
      setViewingTaskNotes('');
      toast("تمت إضافة الجلسة بنجاح", "success");
      onClose();
    } else {
      toast("حدث خطأ أثناء حفظ الجلسة", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-amber-500 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-white">
            <CalendarPlus className="w-5 h-5" />
            <h2 className="font-black text-lg">إضافة جلسة جديدة</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6">
          <form id="add-session-form" onSubmit={handleSubmit} className="space-y-4">
            
            <div className="flex gap-3">
              <div className="flex-[2]">
                <label className="text-[11px] font-black text-slate-500 block mb-1.5">تاريخ الجلسة *</label>
                <input 
                  type="date"
                  required
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-black text-slate-500 block mb-1.5">الرول</label>
                <input 
                  type="text"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  placeholder="مثال: 15"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition text-center"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-[2]">
                <label className="text-[11px] font-black text-slate-500 block mb-1.5">القرار</label>
                <input 
                  list="decisions-list"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                  placeholder="مثال: التأجيل للاطلاع..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-black text-slate-500 block mb-1.5">نوع الجلسة</label>
                <select 
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                >
                  <option value="فحص">فحص</option>
                  <option value="موضوع">موضوع</option>
                  <option value="تحقيق">تحقيق</option>
                  <option value="خبراء">خبراء</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1.5">ملاحظات إضافية</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="أي ملاحظات حول الجلسة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none transition"
              />
            </div>

            {/* Viewing Task Integration */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input 
                  type="checkbox" 
                  checked={createViewingTask} 
                  onChange={(e) => setCreateViewingTask(e.target.checked)} 
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-[11px] font-black text-indigo-700">إنشاء مهمة إطلاع/تصوير مستندات مرتبطة بالجلسة</span>
              </label>
              
              {createViewingTask && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <input 
                    type="text" 
                    value={viewingTaskNotes} 
                    onChange={e => setViewingTaskNotes(e.target.value)} 
                    placeholder="المطلوب (مثال: تصوير محضر الجلسة السابقة ومذكرة الخصوم...)" 
                    className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2 text-[11px] font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
                  />
                </div>
              )}
            </div>

            {/* Optional Procedure Form */}
            <div className="pt-2 border-t border-slate-100">
               {!showProcedureForm ? (
                 <button 
                   type="button" 
                   onClick={() => setShowProcedureForm(true)}
                   className="w-full py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-[11px] font-black hover:bg-indigo-100 transition flex justify-center items-center gap-1.5"
                 >
                   <Plus className="w-3.5 h-3.5" /> إضافة إجراء متزامن مع هذه الجلسة
                 </button>
               ) : (
                 <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-3 relative">
                   <button type="button" onClick={() => setShowProcedureForm(false)} className="absolute top-2 right-2 text-indigo-400 hover:text-rose-500 transition"><X className="w-4 h-4" /></button>
                   <h4 className="text-[11px] font-black text-indigo-700">تسجيل إجراء متزامن:</h4>
                   
                   <div>
                     <input 
                       type="text" 
                       placeholder="اسم الإجراء (مثال: تقديم حافظة...)" 
                       value={procedureTitle}
                       onChange={e => setProcedureTitle(e.target.value)}
                       className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 transition"
                     />
                     {/* Quick selection procedures list */}
                     <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                       {(settings?.commonProcedures || ['إيداع مذكرة دفاع', 'تقديم حافظة مستندات', 'حضور الجلسة']).slice(0,4).map(p => (
                         <button
                           key={p}
                           type="button"
                           onClick={() => setProcedureTitle(p)}
                           className={`px-2 py-1 bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 rounded text-[9px] font-bold transition-all ${procedureTitle === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : ''}`}
                         >
                           {p}
                         </button>
                       ))}
                     </div>
                   </div>

                   <textarea 
                     placeholder="ملاحظات تفصيلية حول الإجراء..."
                     value={procedureNotes}
                     onChange={e => setProcedureNotes(e.target.value)}
                     className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 min-h-[50px] resize-none transition"
                   />
                   
                   <div className="flex items-center gap-2">
                     <input 
                       type="file" 
                       ref={procedureFileInputRef} 
                       className="hidden" 
                       accept="image/*,application/pdf"
                       onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setIsUploadingProcedureFile(true);
                          try {
                             let fileToUpload = file;
                             if (file.type.startsWith('image/')) {
                                fileToUpload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
                             }
                             const url = await uploadToR2(fileToUpload, 'ekhtsasi-light-files');
                             setProcedureAttachment({ url, name: file.name });
                             toast("تم رفع المرفق للإجراء مؤقتاً", "success");
                          } catch (err) {
                             toast("فشل رفع المرفق", "error");
                          } finally {
                             setIsUploadingProcedureFile(false);
                          }
                       }}
                     />
                     <button 
                       type="button"
                       onClick={() => procedureFileInputRef.current?.click()}
                       disabled={isUploadingProcedureFile}
                       className="bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                     >
                       {isUploadingProcedureFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                       {procedureAttachment ? 'تغيير المرفق' : 'مرفق الإجراء'}
                     </button>
                     {procedureAttachment && (
                       <div className="flex-1 flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg text-[10px] font-bold border border-emerald-200 overflow-hidden">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{procedureAttachment.name}</span>
                          <button type="button" onClick={() => setProcedureAttachment(null)} className="ml-auto hover:text-rose-600"><X className="w-3 h-3" /></button>
                       </div>
                     )}
                   </div>
                 </div>
               )}
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 bg-white border border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-100 transition"
          >
            إلغاء
          </button>
          <button 
            type="submit" 
            form="add-session-form"
            disabled={isSaving}
            className="flex-[2] bg-amber-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-amber-600 transition disabled:opacity-50"
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <><Save className="w-4 h-4" /> حفظ الجلسة</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
