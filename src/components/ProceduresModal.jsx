import React, { useState, useRef } from 'react';
import { X, ClipboardList, CheckCircle2, Trash2, FileText, Plus, Loader2, Paperclip, History, Edit3, Camera, FileCheck, Landmark, Search } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { uploadToR2 } from '../lib/r2';
import imageCompression from 'browser-image-compression';
import { formatDateString } from '../utils/dateUtils';

export default function ProceduresModal({ isOpen, onClose, caseData, setCaseData }) {
  const { saveCaseToFirebase, settings, isAdmin, currentUserPermissions } = useAppContext();
  const canEditData = isAdmin || currentUserPermissions?.canEditData;
  const { toast, showConfirm, showPrompt } = useUI();
  
  const [newProcedure, setNewProcedure] = useState({ id: null, date: new Date().toISOString().split('T')[0], title: '', notes: '', sessionDate: '' });
  const [procedureAttachment, setProcedureAttachment] = useState(null);
  const [isUploadingProcedureFile, setIsUploadingProcedureFile] = useState(false);
  const [isAddingProcedure, setIsAddingProcedure] = useState(false);
  const procedureFileInputRef = useRef(null);

  if (!isOpen) return null;

  const proceduresList = Array.isArray(caseData.procedures) ? caseData.procedures : Object.values(caseData.procedures || {});

  const handleAddProcedure = async () => {
    if(!newProcedure.title || !newProcedure.date) {
      toast('يرجى إدخال اسم وتاريخ الإجراء.', 'error');
      return;
    }
    setIsAddingProcedure(true);
    
    let updatedProcedures;
    let updatedDocuments = caseData.documents || [];

    if (newProcedure.id) {
       // Edit Mode
       const procObj = {
         ...proceduresList.find(p => p.id === newProcedure.id),
         title: newProcedure.title,
         date: newProcedure.date,
         notes: newProcedure.notes,
         sessionDate: newProcedure.sessionDate || null,
         attachmentUrl: procedureAttachment?.url || null,
         attachmentName: procedureAttachment?.name || null,
       };
       updatedProcedures = proceduresList.map(p => p.id === newProcedure.id ? procObj : p);
       
       if (procedureAttachment && (!procObj.attachmentUrl || procObj.attachmentUrl !== procedureAttachment.url)) {
           updatedDocuments = [...updatedDocuments, {
              id: Date.now().toString() + '_doc',
              title: `مرفق إجراء: ${newProcedure.title}`,
              url: procedureAttachment.url,
              type: 'مستندات',
              fileType: procedureAttachment.name?.match(/\.(jpg|jpeg|png|webp)$/i) ? 'image' : 'pdf',
              date: newProcedure.date
           }];
       }
       toast('تم تعديل الإجراء بنجاح', 'success');
    } else {
       // Add Mode
       const newProcObj = {
         id: Date.now().toString(),
         title: newProcedure.title,
         date: newProcedure.date,
         notes: newProcedure.notes,
         sessionDate: newProcedure.sessionDate || null,
         attachmentUrl: procedureAttachment?.url || null,
         attachmentName: procedureAttachment?.name || null,
         createdAt: new Date().toISOString()
       };
       updatedProcedures = [...proceduresList, newProcObj];
       
       if (procedureAttachment) {
          updatedDocuments = [...updatedDocuments, {
             id: Date.now().toString() + '_doc',
             title: `مرفق إجراء: ${newProcedure.title}`,
             url: procedureAttachment.url,
             type: 'مستندات',
             fileType: procedureAttachment.name?.match(/\.(jpg|jpeg|png|webp)$/i) ? 'image' : 'pdf',
             date: newProcedure.date
          }];
       }
       toast('تم تسجيل الإجراء بنجاح', 'success');
    }
    
    const updatedCaseData = { ...caseData, procedures: updatedProcedures, documents: updatedDocuments };
    await saveCaseToFirebase(caseData.id, { procedures: updatedProcedures, documents: updatedDocuments });
    setCaseData(updatedCaseData);
    
    setNewProcedure({ id: null, date: new Date().toISOString().split('T')[0], title: '', notes: '', sessionDate: '' });
    setProcedureAttachment(null);
    setIsAddingProcedure(false);
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        setIsUploadingProcedureFile(true);
        try {
          const pastedFile = new File([file], `pasted_image_${Date.now()}.png`, { type: file.type });
          let fileToUpload = pastedFile;
          if (file.type.startsWith('image/')) {
            fileToUpload = await imageCompression(pastedFile, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
          }
          const url = await uploadToR2(fileToUpload, 'ekhtsasi-light-files');
          setProcedureAttachment({ url, name: pastedFile.name });
          toast("تم رفع الصورة المنسوخة مؤقتاً، اضغط حفظ لتأكيد الإجراء", "success");
        } catch (err) {
          toast("فشل رفع الصورة", "error");
        } finally {
          setIsUploadingProcedureFile(false);
        }
        break;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-slate-50 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6" />
            <div>
               <h2 className="text-lg font-black leading-tight">سجل الإجراءات</h2>
               <p className="text-xs font-bold text-indigo-100 opacity-80">تسجيل ومتابعة الإجراءات المتخذة في الملف</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
           
           {/* Procedures Timeline */}
           {proceduresList.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-300 rounded-xl bg-white">
                 <p className="text-xs font-bold text-slate-500">لا توجد إجراءات مسجلة في هذا الملف.</p>
              </div>
           ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                 {proceduresList.sort((a, b) => new Date(b.date) - new Date(a.date)).map((proc, idx) => {
                   let ProcIcon = CheckCircle2;
                   if (proc.title?.includes('تصوير') || proc.title?.includes('استخراج')) ProcIcon = Camera;
                   else if (proc.title?.includes('إيداع') || proc.title?.includes('مذكرة') || proc.title?.includes('تقرير')) ProcIcon = FileCheck;
                   else if (proc.title?.includes('استعلام') || proc.title?.includes('شهادة')) ProcIcon = Search;
                   else if (proc.title?.includes('إعلان') || proc.title?.includes('دعوى')) ProcIcon = Landmark;
                   
                   return (
                   <div key={proc.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                     {/* Icon */}
                     <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-white text-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform group-hover:scale-110">
                       <ProcIcon className="w-5 h-5" />
                     </div>
                     {/* Card */}
                     <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                       <div className="flex justify-between items-start mb-2">
                         <div className="flex flex-wrap gap-1.5 items-center mb-2">
                           <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                             {formatDateString(proc.date)}
                           </div>
                           {proc.sessionDate && (
                             <div className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-250">
                               مرتبط بجلسة: {formatDateString(proc.sessionDate)}
                             </div>
                           )}
                         </div>
                         {canEditData && (
                           <div className="flex items-center gap-1">
                             <button
                               onClick={() => {
                                 setNewProcedure({
                                   id: proc.id,
                                   title: proc.title,
                                   date: proc.date,
                                   notes: proc.notes || '',
                                   sessionDate: proc.sessionDate || ''
                                 });
                                 setProcedureAttachment(proc.attachmentUrl ? { url: proc.attachmentUrl, name: proc.attachmentName } : null);
                                 setTimeout(() => {
                                   procedureFileInputRef.current?.parentElement?.parentElement?.parentElement?.scrollIntoView({ behavior: 'smooth' });
                                 }, 100);
                               }}
                               className="text-slate-400 hover:text-indigo-600 p-1"
                               title="تعديل الإجراء"
                             >
                               <Edit3 className="w-4 h-4" />
                             </button>
                             <button 
                               onClick={async () => {
                                 const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الإجراء؟');
                                 if (confirmed) {
                                   const newProcs = proceduresList.filter(p => p.id !== proc.id);
                                   const updatedCaseData = { ...caseData, procedures: newProcs };
                                   await saveCaseToFirebase(caseData.id, { procedures: newProcs });
                                   setCaseData(updatedCaseData);
                                 }
                               }}
                               className="text-slate-400 hover:text-rose-600 p-1"
                               title="حذف الإجراء"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         )}
                       </div>
                       <h4 className="text-sm font-black text-navy-900 mb-2">{proc.title}</h4>
                       {proc.notes && (
                         <p className="text-xs font-bold text-slate-600 mb-3">{proc.notes}</p>
                       )}
                       {proc.attachmentUrl && (
                         <a href={proc.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 transition">
                           <FileText className="w-4 h-4 text-indigo-500" /> {proc.attachmentName || 'مرفق'}
                         </a>
                       )}
                     </div>
                   </div>
                 )})}
              </div>
           )}

           {/* Add Procedure Form */}
           {canEditData && (
               <div className="bg-white p-4 sm:p-5 rounded-2xl border border-indigo-100 shadow-sm mt-6 relative overflow-hidden" onPaste={handlePaste}>
                 <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500"></div>
                 <h4 className="text-sm font-black text-navy-900 mb-4 flex items-center gap-2">
                   {newProcedure.id ? <Edit3 className="w-4 h-4 text-indigo-600" /> : <Plus className="w-4 h-4 text-indigo-600" />} 
                   {newProcedure.id ? 'تعديل الإجراء' : 'تسجيل إجراء جديد'}
                 </h4>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 flex gap-2">
                      <input 
                        type="date" 
                        value={newProcedure.date}
                        onChange={e => setNewProcedure({...newProcedure, date: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 focus:bg-white flex-[1] transition"
                      />
                      <select
                        value={newProcedure.sessionDate || ''}
                        onChange={e => setNewProcedure({...newProcedure, sessionDate: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 focus:bg-white flex-[1] transition"
                      >
                        <option value="">تاريخ الجلسة المرتبطة (اختياري)</option>
                        {caseData.sessions?.map(s => (
                          <option key={s.date} value={s.date}>{formatDateString(s.date)}</option>
                        ))}
                      </select>
                    </div>
                    <input 
                      type="text" 
                      placeholder="اسم الإجراء (مثال: إيداع مذكرة دفاع، تقديم حافظة...)" 
                      value={newProcedure.title}
                      onChange={e => setNewProcedure({...newProcedure, title: e.target.value})}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 focus:bg-white flex-[2] transition"
                    />
                  </div>
                  {/* Quick selection procedures list */}
                  <div className="flex flex-wrap gap-1 mt-2 items-center">
                    <span className="text-[10px] font-bold text-slate-400">إدخال سريع:</span>
                    {(settings?.commonProcedures || ['إيداع مذكرة دفاع', 'تقديم حافظة مستندات', 'طلب تصوير ملف', 'سداد الأمانة', 'حضور الجلسة']).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewProcedure({...newProcedure, title: p})}
                        className={`px-2.5 py-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-[10px] font-bold transition-all ${newProcedure.title === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : ''}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <textarea 
                    placeholder="ملاحظات تفصيلية (اختياري)..."
                    value={newProcedure.notes}
                    onChange={e => setNewProcedure({...newProcedure, notes: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 focus:bg-white min-h-[60px] resize-none transition"
                  />
                  
                  {/* File Upload Section */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center pt-2">
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
                            toast("تم رفع المرفق مؤقتاً، اضغط حفظ لتأكيد الإجراء", "success");
                         } catch (err) {
                            toast("فشل رفع المرفق", "error");
                         } finally {
                            setIsUploadingProcedureFile(false);
                         }
                      }}
                    />
                    
                    <div className="flex-1 flex items-center gap-2 w-full">
                       <button 
                         onClick={() => procedureFileInputRef.current?.click()}
                         disabled={isUploadingProcedureFile}
                         className="bg-white border border-slate-300 text-slate-600 hover:text-navy-900 hover:bg-slate-50 px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         {isUploadingProcedureFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                         {procedureAttachment ? 'تغيير المرفق' : 'إضافة مرفق'}
                       </button>
                       {procedureAttachment && (
                         <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-200 overflow-hidden">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span className="truncate max-w-[150px]">{procedureAttachment.name}</span>
                            <button onClick={() => setProcedureAttachment(null)} className="ml-2 hover:text-rose-600"><X className="w-3 h-3" /></button>
                         </div>
                       )}
                    </div>
                    
                     {newProcedure.id && (
                        <button 
                          onClick={() => {
                             setNewProcedure({ id: null, date: new Date().toISOString().split('T')[0], title: '', notes: '', sessionDate: '' });
                             setProcedureAttachment(null);
                          }}
                          className="w-full sm:w-auto bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                        >
                          إلغاء التعديل
                        </button>
                     )}
                    <button 
                      onClick={handleAddProcedure}
                      disabled={isAddingProcedure}
                      className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                    >
                      {isAddingProcedure ? <Loader2 className="w-4 h-4 animate-spin" /> : (newProcedure.id ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                      {newProcedure.id ? 'حفظ التعديلات' : 'حفظ الإجراء'}
                    </button>
                  </div>
                </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
