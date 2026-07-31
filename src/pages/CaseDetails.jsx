import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Edit3, X, Gavel, Trash2, CalendarPlus, ClipboardList, CheckCircle2, Bell, AlertTriangle, FileText, ExternalLink, BookOpen, Files, Hash, Paperclip, Scale, Loader2, Plus, Star, MessageSquare } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import AddSessionModal from '../components/AddSessionModal';
import CaseDocuments from '../components/CaseDocuments';
import AlertsModal from '../components/AlertsModal';
import ProceduresModal from '../components/ProceduresModal';
import { formatDateString, getSafeDateObj } from '../utils/dateUtils';
import { localizeNumber } from '../utils/numberUtils';
import { calculateLitigationStage } from '../utils/caseUtils';
import { uploadToR2 } from '../lib/r2';
import imageCompression from 'browser-image-compression';
import { useRef } from 'react';

export default function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cases, schema, isAdmin, saveCaseToFirebase, settings, rolls, checkDuplicateCase, deleteCaseFromFirebase, restoreCaseFromFirebase, saveSettingsToFirebase, saveGlobalTask, currentUser, currentUserPermissions } = useAppContext();
  
  const canEditData = isAdmin || currentUserPermissions?.canEditData;
  const canDeleteData = isAdmin || currentUserPermissions?.canDeleteData;
  const { toast, showConfirm, openRollViewer, showPrompt } = useUI();

  // In the new architecture, id is the document id, not the array index.
  const caseData = cases.find(c => c.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(caseData || {});
  const [expandedGroups, setExpandedGroups] = useState(['📌 بيانات أساسية']);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isProceduresModalOpen, setIsProceduresModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'documents' | 'sessions' | 'tasks'
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [isChangeLocationModalOpen, setIsChangeLocationModalOpen] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [newLocation, setNewLocation] = useState('');
  
  // Session File Upload
  const fileInputRef = useRef(null);
  const [activeSessionIdx, setActiveSessionIdx] = useState(null);
  const [isUploadingSessionFile, setIsUploadingSessionFile] = useState(false);
  const [pastedFile, setPastedFile] = useState(null);
  const [editingSessionIdx, setEditingSessionIdx] = useState(null);
  const [editSessionData, setEditSessionData] = useState({});
  const [activeNoteSessionIdx, setActiveNoteSessionIdx] = useState(null);
  const [activeJudgmentSessionIdx, setActiveJudgmentSessionIdx] = useState(null);

  // Global Paste Handler for the Case
  React.useEffect(() => {
    const handlePaste = (e) => {
      // Ignore paste if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const originalName = file?.name || 'image.png';
            const fileName = originalName === 'image.png' ? `pasted-image-${Date.now()}.png` : originalName;
            const newFile = new File([file], fileName, { type: file.type });
            
            setPastedFile(newFile);
            setActiveTab('documents'); // Switch to documents tab
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);
  
  // Procedure state
  const procedureFileInputRef = useRef(null);
  const [newProcedure, setNewProcedure] = useState({ date: new Date().toISOString().split('T')[0], title: '', notes: '', sessionDate: '' });
  const [isAddingProcedure, setIsAddingProcedure] = useState(false);
  const [isUploadingProcedureFile, setIsUploadingProcedureFile] = useState(false);
  const [procedureAttachment, setProcedureAttachment] = useState(null); // { url, name }

  const isEmptyValue = (val) => {
    if (val === null || val === undefined) return true;
    const s = String(val).trim();
    return s === '' || s === '-' || s === '---' || s === 'لا يوجد' || s === 'لايوجد';
  };

  const getAutocompleteOptions = (fieldId) => {
    const values = cases
      .map(c => c[fieldId])
      .filter(val => val && typeof val === 'string' && val.trim() !== '')
      .map(val => val.trim());
    return [...new Set(values)];
  };

  const handleAddUrgentReminder = async (urgentText) => {
    const reminderDate = await showPrompt('تحديد موعد التذكير', 'أدخل تاريخ التذكير (السنة-الشهر-اليوم):', new Date().toISOString().split('T')[0]);
    if (!reminderDate) return;
    
    // 1. Save reminderDate on case
    const updated = { ...editData, urgentReminderDate: reminderDate };
    setEditData(updated);
    await saveCaseToFirebase(caseData.id, { urgentReminderDate: reminderDate });

    // 2. Add to globalTasks
    const taskObj = {
      id: `urgent-${Date.now()}`,
      title: `إجراء عاجل: ${urgentText}`,
      dueDate: reminderDate,
      createdAt: new Date().toISOString(),
      status: 'pending',
      assignee: currentUser || 'المدير',
      linkedCases: [caseData.id]
    };
    await saveGlobalTask(taskObj.id, taskObj);
    
    toast('تمت جدولة التذكير بنجاح وإضافته إلى المهام!', 'success');
  };

  // Joined cases state
  const [newJoinedNo, setNewJoinedNo] = useState('');
  const [newJoinedYear, setNewJoinedYear] = useState('');

  // Extract unique values for autocomplete
  const defaultDecisions = settings?.decisions || [];

  const handleSessionFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || activeSessionIdx === null) return;
    
    setIsUploadingSessionFile(true);
    try {
       let fileToUpload = file;
       if (file.type.startsWith('image/')) {
          fileToUpload = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true });
       }
       const url = await uploadToR2(fileToUpload, 'ekhtsasi-light-files');
       
       // Update session
       const newSessions = [...caseData.sessions];
       const sessionDate = newSessions[activeSessionIdx].date;
       newSessions[activeSessionIdx] = { 
          ...newSessions[activeSessionIdx], 
          attachmentUrl: url,
          attachmentName: file.name
       };
       
       // Add to documents
       const newDoc = {
          id: Date.now().toString(),
          url,
          name: file.name,
          type: `مستندات جلسة ${sessionDate || 'غير محدد'}`,
          uploadedAt: new Date().toISOString(),
          fileType: file.type.startsWith('image/') ? 'image' : 'pdf'
       };
       const newDocuments = [...(caseData.documents || []), newDoc];
       
       await saveCaseToFirebase(caseData.id, { sessions: newSessions, documents: newDocuments });
       toast('تم رفع وحفظ المرفق بنجاح!', 'success');
    } catch (err) {
       console.error(err);
       toast('حدث خطأ أثناء الرفع', 'error');
    } finally {
       setIsUploadingSessionFile(false);
       setActiveSessionIdx(null);
       if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  if (!caseData) {
    return (
      <div className="text-center p-10">
        <p className="text-slate-500 font-bold">الملف غير موجود.</p>
        <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-navy-900 text-amber-300 rounded-xl text-xs font-bold">عودة</button>
      </div>
    );
  }

  const getFieldValue = (obj, keys) => {
    for (let key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return '';
  };

  const caseNo = getFieldValue(caseData, ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']);
  const year = getFieldValue(caseData, ['السنة', 'سنة', 'year']);

  const appellant = getFieldValue(caseData, ['المدعي', 'الطاعن', 'المستأنف']);
  const appellee = getFieldValue(caseData, ['المدعى_عليه', 'المدعى عليه', 'المطعون ضده', 'المطعون']);
  const lastSessionRaw = getFieldValue(caseData, ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة']);
  const lastSession = formatDateString(lastSessionRaw);
  const decision = getFieldValue(caseData, ['القرار', 'قرار الجلسة', 'المنطوق']);
  const sessionType = getFieldValue(caseData, ['نوع الجلسة', 'نوع_الجلسة']) || '';
  const caseRoll = getFieldValue(caseData, ['الرول']) || '';
  const role = getFieldValue(caseData, ['الصفة', 'صفة']) || '';
  const fileLocation = getFieldValue(caseData, ['مكان الملف']) || '';
  const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
  const isAppellee = role.includes('مطعون ضده') || role.includes('مطعون ضدنا') || role.includes('مستأنف ضده') || role.includes('مدعى عليه') || role.includes('مدعى علينا');
  const isNoInterest = role === 'لا شأن';
  const isOutOfJurisdiction = role === 'خارج الاختصاص';

  const joinedCasesArr = caseData.joinedCasesList || [];
  const legacyJoinedStr = getFieldValue(caseData, ['دعاوى منضمة']) || '';
  const hasJoinedCases = joinedCasesArr.length > 0 || legacyJoinedStr.trim() !== '';

  const isJudgment = String(decision).includes('حكم') || String(decision).includes('للحكم');

  let roleBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
  let accentLineClass = 'bg-amber-500';
  let textColorClass = 'text-amber-500';
  
  if (isAppellant) {
    roleBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    accentLineClass = 'bg-rose-500';
    textColorClass = 'text-rose-600';
  } else if (isAppellee) {
    roleBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    accentLineClass = 'bg-emerald-500';
    textColorClass = 'text-emerald-600';
  } else if (isOutOfJurisdiction) {
    roleBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    accentLineClass = 'bg-indigo-500';
    textColorClass = 'text-indigo-600';
  } else if (isNoInterest) {
    roleBadgeClass = 'bg-slate-100 text-slate-500 border-slate-300';
    accentLineClass = 'bg-slate-400';
    textColorClass = 'text-slate-500';
  }

  const coverImageDoc = (caseData.documents || []).find(doc => doc.type === 'غلاف الملف' && doc.fileType === 'image');
  const coverImageUrl = coverImageDoc ? coverImageDoc.url : null;

  const handleSaveSessionEdit = async (idx) => {
    const newSessions = [...caseData.sessions];
    newSessions[idx] = { ...newSessions[idx], ...editSessionData };
    // Sort descending by date
    newSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const updateData = { sessions: newSessions };
    
    const sessionKey = Object.keys(caseData).find(k => k === 'آخر جلسة' || k === 'تاريخ الجلسة' || k === 'أخر جلسة') || 'آخر جلسة';
    const decisionKey = Object.keys(caseData).find(k => k === 'القرار' || k === 'قرار الجلسة' || k === 'المنطوق') || 'القرار';

    if (newSessions.length > 0) {
      updateData[sessionKey] = newSessions[0].date;
      updateData[decisionKey] = newSessions[0].decision || '';
    }

    await saveCaseToFirebase(caseData.id, updateData);
    setEditingSessionIdx(null);
    setEditSessionData({});
    toast('تم حفظ الجلسة وتحديث الترتيب', 'success');
  };

  const handleSave = async () => {
    if (!canEditData) return;
    
    // Check for duplicate Case No + Year
    const newCaseNo = getFieldValue(editData, ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']);
    const newYear = getFieldValue(editData, ['السنة', 'سنة', 'year']);
    
    if (checkDuplicateCase(newCaseNo, newYear, caseData.id)) {
       toast("هذه الدعوى مسجلة بالفعل (رقم الدعوى والسنة مكرران)", "error");
       return;
    }
    
    try {
      const previousData = { ...caseData };
      await saveCaseToFirebase(caseData.id, editData);
      setIsEditing(false);
      toast("تم حفظ التعديلات بنجاح!", "success", {
        actionLabel: "تراجع",
        onAction: async () => {
          await saveCaseToFirebase(caseData.id, previousData);
          setEditData(previousData);
        }
      });
    } catch (error) {
      console.error(error);
      toast("حدث خطأ أثناء الحفظ.", "error");
    }
  };

  const handleDeleteCase = async () => {
    if (!canDeleteData) return;
    const confirmed = await showConfirm("نقل إلى سلة المحذوفات", "هل أنت متأكد من نقل هذه الدعوى إلى سلة المحذوفات؟");
    if (confirmed) {
       const success = await deleteCaseFromFirebase(caseData.id);
       if (success) {
          toast("تم نقل الدعوى إلى سلة المحذوفات", "success", {
            actionLabel: "تراجع",
            onAction: async () => {
              await restoreCaseFromFirebase(caseData.id);
            }
          });
          navigate('/', { replace: true });
       } else {
          toast("حدث خطأ أثناء حذف الملف.", "error");
       }
    }
  };

  const latestJudgmentSession = [...(caseData.sessions || [])]
    .filter(s => s.hasJudgment && s.judgment)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const stampData = latestJudgmentSession ? latestJudgmentSession.judgment : null;
  const stampColor = stampData ? 
    (stampData.result === 'للصالح' ? 'emerald' : 
     stampData.result === 'للضد' ? 'rose' :
     stampData.result === 'مختلط' ? 'amber' :
     stampData.result === 'إجرائي خطير' ? 'red' : 'indigo') : null;

  const litigationStage = calculateLitigationStage(caseData);

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3 shadow-sm flex items-center justify-between no-print">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition active:scale-95"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        
        <div className="flex-1 text-center font-black text-sm text-navy-900 mx-2 truncate">
          تفاصيل الدعوى
        </div>

        {(canEditData || canDeleteData) ? (
          isEditing ? (
            <div className="flex gap-2">
              <button 
                onClick={() => { setIsEditing(false); setEditData(caseData); }}
                className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
              <button 
                onClick={handleSave}
                className="w-10 h-10 rounded-xl bg-emerald-500 text-white shadow-sm flex items-center justify-center transition"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              {canDeleteData && (
                <button 
                  onClick={handleDeleteCase}
                  className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 shadow-sm flex items-center justify-center transition hover:bg-rose-100"
                  title="حذف الملف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {canEditData && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="w-10 h-10 rounded-xl bg-navy-900 text-amber-300 shadow-sm flex items-center justify-center transition"
                  title="تعديل الملف"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        ) : (
          <div className="w-10 h-10"></div>
        )}
      </div>

      {/* HERO CARD - Primary Info */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mx-4 sm:mx-0 relative">
        {coverImageUrl ? (
          <div className="h-32 w-full relative">
            <img src={coverImageUrl} alt="غلاف الدعوى" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-white"></div>
            <div className={`absolute top-0 left-0 w-full h-1 ${accentLineClass}`}></div>
          </div>
        ) : (
          <div className={`h-2 w-full ${accentLineClass}`}></div>
        )}

        {stampData && (
          <div className={`absolute top-4 left-4 z-10 opacity-90 transform -rotate-6 select-none pointer-events-none`}>
            <div className={`border-[3px] border-${stampColor}-600 rounded-lg p-2 bg-white/90 backdrop-blur-sm shadow-xl flex flex-col items-center justify-center`}>
              <span className={`text-[15px] font-black text-${stampColor}-700 uppercase tracking-widest leading-none`}>
                {stampData.isFinal ? 'حكم نهائي' : stampData.category}
              </span>
              <span className={`text-[11px] font-black text-${stampColor}-600 mt-1 border-t-2 border-${stampColor}-600/30 pt-1 w-full text-center truncate max-w-[100px]`}>
                {stampData.result}
              </span>
            </div>
          </div>
        )}
        
        <div className={`text-center space-y-4 ${coverImageUrl ? 'p-5 pt-2' : 'p-5'}`}>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
             {role ? (
               <button 
                  onClick={() => { setNewRole(role); setIsChangeRoleModalOpen(true); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border hover:opacity-80 transition cursor-pointer shadow-sm ${roleBadgeClass}`}
                  title="تغيير الصفة"
               >
                 {role} <span className="opacity-50 ml-1">▼</span>
               </button>
             ) : (
               <button 
                  onClick={() => { setNewRole(''); setIsChangeRoleModalOpen(true); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200 transition cursor-pointer shadow-sm`}
                  title="إضافة صفة"
               >
                 إضافة صفة <span className="opacity-50 ml-1">▼</span>
               </button>
             )}
             <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shadow-sm flex items-center gap-1 ${
                litigationStage === 'استعلام' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                litigationStage.includes('موقوف جزائياً') ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' :
                litigationStage === 'شعبة المحال' || litigationStage === 'شعبة الأحكام' || litigationStage === 'الشعبة' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                'bg-blue-50 text-blue-700 border-blue-200'
             }`}>
               <CheckCircle2 className="w-3 h-3" />
               {litigationStage}
             </div>
             {fileLocation ? (
               <button 
                  onClick={() => { setNewLocation(fileLocation); setIsChangeLocationModalOpen(true); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 transition cursor-pointer shadow-sm`}
                  title="تغيير مكان الملف"
               >
                 📁 {fileLocation} <span className="opacity-50 ml-1">▼</span>
               </button>
             ) : (
               <button 
                  onClick={() => { setNewLocation(''); setIsChangeLocationModalOpen(true); }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black border bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200 transition cursor-pointer shadow-sm`}
                  title="تحديد مكان الملف"
               >
                 تحديد مكان الملف <span className="opacity-50 ml-1">▼</span>
               </button>
             )}
             {isJudgment && (
               <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 shadow-sm flex items-center gap-1">
                 ⚖️ للحكم
               </span>
             )}
          </div>
          
          {/* Case Number and Year */}
          <div className="text-center">
            <h1 className="flex items-center gap-2 flex-wrap justify-center">
              <span className={`${textColorClass} font-black text-3xl sm:text-4xl`}>
                {localizeNumber(caseNo, settings?.numberFormat)}
              </span>
              <span className="text-slate-400 font-normal text-lg sm:text-xl mr-1">
                لسنة {localizeNumber(year, settings?.numberFormat)}
              </span>
              {hasJoinedCases && (
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-lg flex items-center gap-1 border border-indigo-200" title={`دعاوى منضمة: ${joinedCasesArr.map(c => `${localizeNumber(c.no, settings?.numberFormat)} لسنة ${localizeNumber(c.year, settings?.numberFormat)}`).join('، ')} ${legacyJoinedStr}`}>
                  <Files className="w-4 h-4" /> مجمعة
                </span>
              )}
            </h1>
          </div>
          
          {/* Action Buttons Centered Below */}
          <div className="flex items-center justify-center gap-3 mt-2">
            {/* Star Button */}
            <button
               onClick={async () => {
                 if (caseData.isImportant) {
                    const confirmed = await showConfirm('تأكيد الإزالة', 'هل أنت متأكد من إزالة النجمة عن هذه الدعوى الهامة؟');
                    if (!confirmed) return;
                 } else {
                    toast('تم تمييز الدعوى كدعوى هامة', 'success');
                 }
                 await saveCaseToFirebase(caseData.id, { isImportant: !caseData.isImportant });
               }}
               className={`relative p-2 rounded-xl transition ${caseData.isImportant ? 'bg-amber-100 text-amber-500 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
               title={caseData.isImportant ? "إزالة الأهمية" : "تمييز كدعوى هامة"}
            >
               <Star className={`w-5 h-5 ${caseData.isImportant ? 'fill-amber-500' : ''}`} />
            </button>
            
            {/* Case Task Button */}
            <button 
              onClick={() => {
                navigate(`/tasks?caseId=${caseData.id}`);
              }}
              className="relative p-2 rounded-xl transition bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-indigo-600"
              title="إضافة مهمة متعلقة بهذه الدعوى"
            >
              <ClipboardList className="w-5 h-5" />
            </button>

            {/* Procedures Modal Button */}
            <button 
              onClick={() => setIsProceduresModalOpen(true)}
              className="relative p-2 rounded-xl transition bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-indigo-600"
              title="سجل الإجراءات"
            >
              <FileText className="w-5 h-5" />
            </button>

            {/* Alerts Button in Header */}
            <button 
              onClick={() => setIsAlertsOpen(true)}
              className={`relative p-2 rounded-xl transition ${
                caseData.alerts && caseData.alerts.some(a => !a.isDone) 
                  ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
              }`}
              title="مواعيد وتنبيهات الملف"
            >
              <Bell className="w-5 h-5" />
              {caseData.alerts && caseData.alerts.some(a => !a.isDone) && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-white"></span>
                </span>
              )}
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 sm:p-4 flex items-center justify-center gap-3 border border-slate-100 text-center flex-wrap">
             <span className={`text-sm sm:text-base ${isAppellant ? 'text-rose-700 font-black' : 'text-navy-900 font-bold'}`}>
               {appellant || '---'}
             </span>
             <span className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-black shrink-0">
               X
             </span>
             <span className={`text-sm sm:text-base ${isAppellee ? 'text-emerald-700 font-black' : 'text-navy-900 font-bold'}`}>
               {appellee || '---'}
             </span>
          </div>

          {(decision || lastSession) && (
            <div className={`mt-3 p-3 rounded-xl border flex flex-row items-center justify-center gap-3 flex-wrap ${isJudgment ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-amber-50/50 border-amber-100 text-amber-800'}`}>
              {caseRoll && (
                <div className="text-sm font-black flex items-center gap-1 shrink-0">
                  <Hash className="w-4 h-4 text-slate-500" />
                  <span dir="ltr">{caseRoll}</span>
                </div>
              )}
              {caseRoll && lastSession && <div className="w-px h-4 bg-current opacity-20"></div>}
              {lastSession && (
                <button 
                  onClick={() => openRollViewer(lastSession)}
                  className="text-sm font-black flex items-center gap-1.5 shrink-0 hover:text-indigo-600 transition"
                  title="عرض رول الجلسة"
                >
                  📅 جلسة: <span dir="ltr">{lastSession}</span>
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                </button>
              )}
              {lastSession && decision && <div className="w-px h-4 bg-current opacity-20"></div>}
              {decision && (
                <span className="text-sm font-black text-center">
                  {decision}
                </span>
              )}
              {((lastSession || decision) && sessionType) && <div className="w-px h-4 bg-current opacity-20"></div>}
              {sessionType && (
                <span className="text-sm font-black text-center">
                  {sessionType}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mx-4 sm:mx-0 sticky top-[64px] z-40 bg-slate-50/80 backdrop-blur-md pb-2 pt-2">
        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1 gap-1 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${activeTab === 'details' ? 'bg-navy-900 text-amber-300 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Edit3 className="w-4 h-4" /> بيانات الدعوى
          </button>
          <button 
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${activeTab === 'documents' ? 'bg-navy-900 text-amber-300 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ClipboardList className="w-4 h-4" /> أوراق الدعوى
          </button>
          <button 
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${activeTab === 'sessions' ? 'bg-navy-900 text-amber-300 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <CalendarPlus className="w-4 h-4" /> الجلسات
          </button>
        </div>
      </div>

      {/* Tab Content: Details */}
      {activeTab === 'details' && (
      <div className="bg-transparent space-y-4 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Dynamic Fields from Schema (Grouped & Redesigned) */}
        <div className="space-y-6 pt-2">
          {[
            {
              title: '📌 بيانات أساسية',
              colorClass: 'text-blue-700 bg-blue-50/50 border-blue-100',
              keys: ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى', 'السنة', 'سنة', 'year', 'المحكمة', 'الدائرة']
            },
            {
              title: '👥 الأطراف والصفة',
              colorClass: 'text-emerald-700 bg-emerald-50/50 border-emerald-100',
              keys: ['المدعي', 'الطاعن', 'المستأنف', 'المدعى_عليه', 'المدعى عليه', 'المطعون ضده', 'المطعون', 'الصفة', 'صفة', 'موضوع الدعوى']
            },
            {
              title: '⚖️ الجلسة والقرار',
              colorClass: 'text-amber-700 bg-amber-50/50 border-amber-100',
              keys: ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة', 'نوع الجلسة', 'القرار', 'قرار الجلسة', 'مكان الملف', 'ملاحظات']
            },
            {
              title: '📜 بيانات الحكم',
              colorClass: 'text-rose-700 bg-rose-50/50 border-rose-100',
              keys: ['الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم']
            },
            {
              title: '📍 بيانات أخرى',
              colorClass: 'text-slate-700 bg-slate-50/50 border-slate-200',
              keys: ['المقر المختار', 'عنوان المدعى عليه']
            }
          ].map((group, idx, arr) => {
             const excludedFields = ['الصفة', 'صفة', 'مكان الملف', 'آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة', 'نوع الجلسة', 'القرار', 'قرار الجلسة'];
             let groupFields = schema.filter(f => f.visible && group.keys.includes(f.id) && !excludedFields.includes(f.id));
             if (idx === arr.length - 1) {
                const allConfiguredKeys = arr.flatMap(g => g.keys);
                const unmappedFields = schema.filter(f => f.visible && !allConfiguredKeys.includes(f.id) && !excludedFields.includes(f.id));
                groupFields = [...groupFields, ...unmappedFields];
             }
             
             const hasContent = groupFields.some(f => {
               const val = editData[f.id] || '';
               return isEditing || !isEmptyValue(val);
             });
             
             if (!hasContent) return null;

             const isExpanded = expandedGroups.includes(group.title);
             const toggleGroup = () => {
               if (isExpanded) {
                 setExpandedGroups(expandedGroups.filter(g => g !== group.title));
               } else {
                 setExpandedGroups([...expandedGroups, group.title]);
               }
             };

             return (
               <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
                  <button 
                    type="button"
                    onClick={toggleGroup}
                    className={`w-full px-4 py-3 font-black text-xs flex items-center justify-between gap-2 hover:opacity-90 transition-opacity ${group.colorClass} ${isExpanded ? 'border-b' : 'border-b-0'}`}
                  >
                     <div className="flex items-center gap-2">
                        {group.title}
                     </div>
                     <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {isExpanded && (
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 gap-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                     {groupFields.map(field => {
                        const val = editData[field.id] || '';
                        
                        // Smart conditional logic:
                        if (isEditing) {
                            const currentRole = editData['الصفة'] || '';
                            const isPlaintiffRole = currentRole.includes('طاعن') || currentRole.includes('مستأنف') || currentRole.includes('مدعي');
                            const isDefendantRole = currentRole.includes('مطعون') || currentRole.includes('مدعى عليه');
                            
                            if (field.id === 'المقر المختار' && !isPlaintiffRole) return null;
                            if (field.id === 'عنوان المدعى عليه' && !isPlaintiffRole) return null;
                            if (field.id === 'عنوان المدعي' && !isDefendantRole) return null;
                        }
                        
                        if (!isEditing && isEmptyValue(val)) return null;

                        // Skip rendering 'السنة' alone because we will inline it with 'رقم الدعوى'
                        if (['السنة', 'سنة', 'year'].includes(field.id)) return null;

                        const isDateField = field.type === 'date' || field.id.includes('تاريخ') || field.id.includes('جلسة');
                        const displayVal = localizeNumber(isDateField ? formatDateString(val) : val, settings?.numberFormat);
                        
                        let colSpan = 'col-span-2 md:col-span-2';
                        const shortFields = ['رقم الدعوى', 'السنة', 'سنة', 'year', 'رقم القضية', 'رقم_الدعوى', 'الرول', 'الدائرة', 'تصنيف الحكم'];
                        const longFields = ['ملاحظات', 'المنطوق', 'منطوق الحكم', 'موضوع الدعوى', 'الإجراءات الهامة والعاجلة'];

                        if (shortFields.includes(field.id)) colSpan = 'col-span-1 md:col-span-1';
                        if (longFields.includes(field.id) || field.type === 'textarea') colSpan = 'col-span-2 md:col-span-4';

                        if (field.id === 'الإجراءات الهامة والعاجلة' && !isEditing) {
                            return (
                              <div key={field.id} className="col-span-2 md:col-span-4 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 rounded-2xl p-4.5 space-y-3 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-gradient-to-b from-rose-500 to-amber-500"></div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                                    <label className="text-xs font-black text-rose-800">{field.label}</label>
                                  </div>
                                  <button 
                                    onClick={() => handleAddUrgentReminder(val)}
                                    className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-250 hover:text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200 transition shadow-sm cursor-pointer"
                                  >
                                    <Bell className="w-3.5 h-3.5" />
                                    <span>تذكير بموعد الإجراء</span>
                                  </button>
                                </div>
                                <div className="text-xs font-bold text-slate-800 pr-3 leading-relaxed whitespace-pre-wrap">
                                  {val}
                                </div>
                                {editData.urgentReminderDate && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg w-max mt-2">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>موعد التذكير: {localizeNumber(editData.urgentReminderDate, settings?.numberFormat)}</span>
                                  </div>
                                )}
                              </div>
                            );
                         }

                         const roleOptions = settings?.roles || ['طاعن', 'مطعون ضدنا', 'خصم مدخل'];
                         const sessionTypeOptions = settings?.sessionTypes || ['فحص', 'موضوع', 'للحكم', 'أول جلسة'];
                         const fileLocationOptions = settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي'];

                        return (
                          <div key={field.id} className={`space-y-1.5 ${colSpan}`}>
                            <label className="text-[11px] font-black text-slate-500 block">{field.label}</label>
                            {isEditing ? (
                              field.id === 'الصفة' || field.id === 'صفة' ? (
                                 <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                                    {roleOptions.map((opt, i) => (
                                      <button 
                                        key={opt} type="button" onClick={() => setEditData({...editData, [field.id]: opt})} 
                                        className={`flex-1 py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt ? (i === 0 ? 'bg-rose-500 text-white' : i === 1 ? 'bg-emerald-500 text-white' : 'bg-navy-900 text-white') : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                      >{opt}</button>
                                    ))}
                                 </div>
                              ) : field.id === 'نوع الجلسة' ? (
                                 <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                                    {sessionTypeOptions.map((opt, i) => (
                                      <button 
                                        key={opt} type="button" onClick={() => setEditData({...editData, [field.id]: opt})} 
                                        className={`flex-1 py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt ? (i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-emerald-500 text-white' : 'bg-navy-900 text-white') : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                      >{opt}</button>
                                    ))}
                                 </div>
                              ) : field.id === 'القرار' && settings?.decisions ? (
                                 <div className="space-y-2">
                                   <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-xl">
                                      {settings.decisions.slice(0, 8).map(opt => (
                                        <button 
                                          key={opt} type="button" onClick={() => setEditData({...editData, [field.id]: opt})} 
                                          className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
                                        >{opt}</button>
                                      ))}
                                   </div>
                                   <input type="text" placeholder="أو اكتب قرار آخر..." value={!settings.decisions.includes(val) && val ? val : ''} onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                                 </div>
                              ) : field.id === 'مكان الملف' ? (
                                 <div className="space-y-2">
                                   <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-xl">
                                      {fileLocationOptions.map(opt => (
                                        <button 
                                          key={opt} type="button" onClick={() => setEditData({...editData, [field.id]: opt})} 
                                          className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
                                        >{opt}</button>
                                      ))}
                                   </div>
                                   <input type="text" placeholder="أو اكتب مكان آخر..." value={!fileLocationOptions.includes(val) && val ? val : ''} onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                                 </div>
                               ) : field.id === 'تصنيف الدعوى' ? (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-xl">
                                       {[...(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']), 'أخرى'].map(opt => (
                                         <button 
                                           key={opt} type="button" onClick={() => setEditData({...editData, [field.id]: opt})} 
                                           className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt || (!(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']).includes(val) && val && opt === 'أخرى') ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
                                         >{opt}</button>
                                       ))}
                                    </div>
                                    {(!(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']).includes(val) || val === 'أخرى') && (
                                      <input 
                                        type="text" 
                                       placeholder="اكتب التصنيف هنا..." 
                                       value={val === 'أخرى' ? '' : val} 
                                       onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} 
                                       className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 mt-2" 
                                     />
                                   )}
                                 </div>
                              ) : field.type === 'textarea' ? (
                                 <textarea value={val} onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 resize-none transition" />
                              ) : field.type === 'date' || field.id.includes('تاريخ') || field.id.includes('جلسة') ? (
                                 <input type="date" value={val && getSafeDateObj(val) ? getSafeDateObj(val).toISOString().split('T')[0] : ''} onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                              ) : ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى'].includes(field.id) ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-[2]">
                                      <input type={field.type === 'number' ? 'number' : 'text'} value={val} list={`list-${field.id}`} onChange={(e) => {
                                          let v = e.target.value;
                                          if (field.type === 'number') v = v.replace(/[^\d]/g, '');
                                          setEditData({...editData, [field.id]: v});
                                      }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                                      <datalist id={`list-${field.id}`}>
                                        {getAutocompleteOptions(field.id).map((opt, i) => <option key={i} value={opt} />)}
                                      </datalist>
                                    </div>
                                    <div className="flex-[1] relative">
                                      <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">السنة</span>
                                      <input type={schema.find(f => f.id === 'السنة' || f.id === 'سنة' || f.id === 'year')?.type === 'number' ? 'number' : 'text'} value={editData['السنة'] || editData['سنة'] || editData['year'] || ''} list={`list-السنة`} onChange={(e) => {
                                          let v = e.target.value;
                                          if (schema.find(f => f.id === 'السنة' || f.id === 'سنة' || f.id === 'year')?.type === 'number') v = v.replace(/[^\d]/g, '');
                                          setEditData({...editData, ['السنة']: v});
                                      }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                                      <datalist id={`list-السنة`}>
                                        {getAutocompleteOptions('السنة').map((opt, i) => <option key={i} value={opt} />)}
                                      </datalist>
                                    </div>
                                  </div>
                              ) : (
                                  <>
                                    <input type={field.type === 'number' ? 'number' : 'text'} value={val} list={`list-${field.id}`} onChange={(e) => {
                                        let v = e.target.value;
                                        if (field.type === 'number') v = v.replace(/[^\d]/g, '');
                                        setEditData({...editData, [field.id]: v});
                                    }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                                    <datalist id={`list-${field.id}`}>
                                      {getAutocompleteOptions(field.id).map((opt, i) => <option key={i} value={opt} />)}
                                    </datalist>
                                  </>
                              )
                            ) : ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى'].includes(field.id) ? (
                                <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 flex items-center justify-center gap-1.5 min-h-[42px]" dir="ltr">
                                  <span>{localizeNumber(editData['السنة'] || editData['سنة'] || editData['year'] || '', settings?.numberFormat)}</span>
                                  <span className="text-slate-400">/</span>
                                  <span>{displayVal}</span>
                                </div>
                            ) : (
                              <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 whitespace-pre-wrap break-words min-h-[42px]" dir={isDateField ? "ltr" : "auto"}>
                                {displayVal}
                              </div>
                            )}
                            {/* Inject Joined Cases directly below Case Number if applicable */}
                            {['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى'].includes(field.id) && (
                               <div className="mt-2 space-y-2">
                                 {((editData.joinedCasesList && editData.joinedCasesList.length > 0) || legacyJoinedStr || isEditing) && (
                                   <div className="bg-indigo-50/40 rounded-xl p-2 border border-indigo-100">
                                      <h3 className="text-[10px] font-black text-indigo-800 mb-2 flex items-center gap-1.5"><Files className="w-3 h-3"/> الدعاوى المنضمة</h3>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                         {(editData.joinedCasesList || []).map((jc, idx) => (
                                            <div key={idx} className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                                               {localizeNumber(jc.no, settings?.numberFormat)} <span className="text-[9px] text-slate-400">/</span> {localizeNumber(jc.year, settings?.numberFormat)}
                                               {isEditing && (
                                                  <button onClick={() => {
                                                     const list = [...(editData.joinedCasesList || [])];
                                                     list.splice(idx, 1);
                                                     setEditData({...editData, joinedCasesList: list});
                                                  }} className="text-rose-400 hover:text-rose-600 transition ml-1">
                                                    <X className="w-3 h-3" />
                                                  </button>
                                               )}
                                            </div>
                                         ))}
                                         
                                         {legacyJoinedStr && !isEditing && (
                                            <div className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                                               {legacyJoinedStr}
                                            </div>
                                         )}
                                         
                                         {(!editData.joinedCasesList || editData.joinedCasesList.length === 0) && !legacyJoinedStr && !isEditing && (
                                           <span className="text-[10px] font-bold text-slate-400">لا توجد دعاوى منضمة.</span>
                                         )}
                                         
                                         {isEditing && (
                                            <div className="flex items-center gap-1 ml-auto">
                                               <input type="number" placeholder="رقم" value={newJoinedNo} onChange={e => setNewJoinedNo(e.target.value)} className="w-14 bg-white border border-indigo-200 shadow-sm rounded-md px-1.5 py-1 text-[10px] font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                                               <input type="number" placeholder="سنة" value={newJoinedYear} onChange={e => setNewJoinedYear(e.target.value)} className="w-12 bg-white border border-indigo-200 shadow-sm rounded-md px-1.5 py-1 text-[10px] font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                                               <button onClick={() => {
                                                  if(!newJoinedNo || !newJoinedYear) return;
                                                  const list = [...(editData.joinedCasesList || []), { no: newJoinedNo, year: newJoinedYear }];
                                                  setEditData({...editData, joinedCasesList: list});
                                                  setNewJoinedNo('');
                                                  setNewJoinedYear('');
                                               }} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm text-white px-2 py-1 rounded-md text-[10px] font-black transition">
                                                  +
                                               </button>
                                            </div>
                                         )}
                                      </div>
                                   </div>
                                 )}
                               </div>
                            )}
                          </div>
                        );
                     })}
                  </div>
                  )}
               </div>
             );
          })}
        </div>

        {/* Custom fields not in schema (legacy/extra) */}
        {(() => {
           const extraKeys = Object.keys(editData).filter(k => k !== 'id' && k !== 'sessions' && k !== 'documents' && k !== 'joinedCasesList' && !schema.find(s => s.id === k) && !['الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم', 'الرول', 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي', 'isImportant', 'procedures', 'urgentReminderDate', 'createdAt', 'updatedAt', 'userId'].includes(k));
           if (!isEditing || extraKeys.length === 0) return null;
           
           return (
             <div className="pt-6 border-t border-slate-100">
               <h3 className="text-xs font-black text-slate-400 mb-3">حقول إضافية غير مسجلة في الهيكلة:</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {extraKeys.map(key => (
                   <div key={key} className="flex gap-2">
                     <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400">{key}</span>
                        <input 
                           type="text"
                           value={editData[key] || ''}
                           onChange={(e) => setEditData({...editData, [key]: e.target.value})}
                           className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-navy-900"
                         />
                     </div>
                     <button 
                       onClick={() => {
                         const newData = {...editData};
                         delete newData[key];
                         setEditData(newData);
                       }} 
                       className="self-end pb-1 text-rose-400 hover:text-rose-600"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 ))}
               </div>
             </div>
           );
        })()}
      </div>
      )}

      {/* Tab Content: Sessions */}
      {activeTab === 'sessions' && (
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
               <CalendarPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-lg text-navy-900">سجل الجلسات</h2>
              <p className="text-[11px] text-slate-500 font-bold">تتابع الجلسات والقرارات</p>
            </div>
          </div>
          {canEditData && (
            <button 
              onClick={() => setIsAddSessionOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            >
              <CalendarPlus className="w-4 h-4" /> إضافة جلسة
            </button>
          )}
        </div>

        <div className="pt-2">
          {(!caseData.sessions || caseData.sessions.length === 0) ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
               <p className="text-xs font-bold text-slate-500">لا يوجد سجل جلسات مضاف يدوياً لهذه القضية.</p>
            </div>
          ) : (
            <div className="relative border-r-2 border-slate-200 space-y-6 pr-4 mr-2">
              {/* Hidden file input for sessions */}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,.pdf" 
                onChange={handleSessionFileUpload} 
              />
              {caseData.sessions.map((session, idx) => (
                <div key={session.id || idx} className="relative">
                  <div className="absolute -right-[23px] top-3 w-4 h-4 rounded-full bg-white border-2 border-amber-500 z-10"></div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 shadow-sm relative mr-2 transition hover:shadow-md flex flex-col gap-2">
                     
                     <div className="flex items-center gap-2 w-full flex-wrap justify-between">
                        {/* Right side (Fields) */}
                        <div className="flex items-center gap-2 flex-wrap">
                           {editingSessionIdx === idx ? (
                              <>
                                 {/* Roll Edit */}
                                 <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                                    <span className="text-[10px] font-black text-slate-500">رول:</span>
                                    <input
                                       type="text"
                                       value={editSessionData.roll ?? session.roll ?? ''}
                                       onChange={(e) => setEditSessionData({ ...editSessionData, roll: e.target.value })}
                                       className="w-8 text-[10px] font-black text-indigo-700 bg-transparent text-center focus:outline-none"
                                    />
                                 </div>
                                 
                                 {/* Date Edit */}
                                 <input
                                    type="date"
                                    value={editSessionData.date ?? session.date ?? ''}
                                    onChange={(e) => setEditSessionData({ ...editSessionData, date: e.target.value })}
                                    className="text-[10px] font-black text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 w-[110px] text-center focus:outline-none focus:border-amber-400"
                                 />
                                 
                                 {/* Type Edit */}
                                 <select
                                    value={editSessionData.type ?? session.type ?? 'فحص'}
                                    onChange={(e) => setEditSessionData({ ...editSessionData, type: e.target.value })}
                                    className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 focus:outline-none focus:border-emerald-400"
                                 >
                                    <option value="فحص">فحص</option>
                                    <option value="موضوع">موضوع</option>
                                 </select>
                                 
                                 {/* Decision Edit */}
                                 <input
                                    list="decisions-list"
                                    value={editSessionData.decision ?? session.decision ?? ''}
                                    onChange={(e) => setEditSessionData({ ...editSessionData, decision: e.target.value })}
                                    placeholder="القرار..."
                                    className="text-xs font-black text-navy-900 bg-white px-3 py-1 rounded-md border border-slate-200 w-[120px] focus:outline-none focus:border-amber-400"
                                 />
                              </>
                           ) : (
                              <>
                                 {/* Roll View */}
                                 {session.roll && (
                                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                                       <span className="text-[10px] font-black text-slate-500">رول:</span>
                                       <span className="text-[10px] font-black text-indigo-700">{session.roll}</span>
                                    </div>
                                 )}
                                 
                                 {/* Date View */}
                                 <div className="text-[11px] font-black text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 flex items-center gap-2">
                                    <CalendarPlus className="w-3.5 h-3.5 text-slate-400" />
                                    {formatDateString(session.date)}
                                 </div>
                                 
                                 {/* Type View */}
                                 <div className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-md border border-emerald-200">
                                    {session.type || 'فحص'}
                                 </div>
                                 
                                 {/* Decision View */}
                                 {session.decision && (
                                    <div className="text-xs font-black text-navy-900 bg-white px-3 py-1.5 rounded-md border border-slate-200 max-w-[200px] truncate" title={session.decision}>
                                       {session.decision}
                                    </div>
                                 )}

                                 {/* Judgment Badge View */}
                                 {session.hasJudgment && (session.judgment || session.shortJudgment) && (
                                    <div className={`text-[10px] font-black px-2 py-1.5 rounded-md border flex items-center gap-1 ${
                                       (() => {
                                          const res = (session.judgment && session.judgment.result) || session.judgmentClassification;
                                          const rc = res === 'صالح' ? 'emerald' : res === 'ضد' ? 'rose' : res === 'مختلط' ? 'indigo' : res === 'اعتبار' ? 'amber' : (res === 'وقف جزائي' || res === 'غير منه للخصومة') ? 'orange' : res === 'وقف تعليقي' ? 'purple' : res === 'خبراء' ? 'cyan' : res === 'حكم منه للخصومة' ? 'amber' : res === 'تمهيدي' ? 'indigo' : 'slate';
                                          return `bg-${rc}-50 text-${rc}-700 border-${rc}-200`;
                                       })()
                                    }`}>
                                       <Scale className="w-3 h-3" />
                                       {(session.judgment && session.judgment.type) || session.shortJudgment} {((session.judgment && session.judgment.result) || session.judgmentClassification) ? `- ${(session.judgment && session.judgment.result) || session.judgmentClassification}` : ''}
                                    </div>
                                 )}

                                 {/* Notes Bubble */}
                                 <div className="relative">
                                    <button 
                                       onClick={() => setActiveNoteSessionIdx(activeNoteSessionIdx === idx ? null : idx)}
                                       className={`p-1.5 rounded-md border transition flex items-center justify-center shadow-sm ${session.notes ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                       title={session.notes ? "استعراض/تعديل الملاحظات" : "إضافة ملاحظة"}
                                    >
                                       <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    {activeNoteSessionIdx === idx && (
                                       <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-[100]">
                                          <div className="flex items-center justify-between mb-2">
                                             <span className="text-[10px] font-black text-slate-500">ملاحظات الجلسة</span>
                                             <button onClick={() => setActiveNoteSessionIdx(null)} className="text-slate-400 hover:text-rose-500 transition"><X className="w-3 h-3" /></button>
                                          </div>
                                          <textarea
                                             autoFocus
                                             defaultValue={session.notes || ''}
                                             placeholder="اكتب ملاحظاتك هنا..."
                                             className="w-full text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-amber-400 min-h-[80px]"
                                             onBlur={async (e) => {
                                                if (e.target.value !== (session.notes || '')) {
                                                   const newSessions = [...caseData.sessions];
                                                   newSessions[idx] = { ...newSessions[idx], notes: e.target.value };
                                                   await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                                }
                                             }}
                                          />
                                       </div>
                                    )}
                                 </div>
                              </>
                           )}
                        </div>

                        {/* Left side (Actions) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                           {/* Attachment Indicator */}
                           {session.attachmentUrl && (
                              <a href={session.attachmentUrl} target="_blank" rel="noreferrer" className="bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 p-1 rounded transition flex items-center justify-center h-7 w-7 shadow-sm" title="عرض المرفق">
                                 <FileText className="w-3.5 h-3.5" />
                              </a>
                           )}
                           
                           {/* Attach Button */}
                           <button 
                              onClick={() => { setActiveSessionIdx(idx); fileInputRef.current?.click(); }}
                              disabled={isUploadingSessionFile && activeSessionIdx === idx}
                              className="bg-slate-100 border border-slate-200 text-slate-500 hover:text-navy-900 hover:bg-slate-200 p-1 rounded transition flex items-center justify-center h-7 w-7 shadow-sm disabled:opacity-50" 
                              title="إضافة مرفق للملف (صورة أو PDF)"
                           >
                              {(isUploadingSessionFile && activeSessionIdx === idx) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                           </button>

                           {/* Judgment Toggle */}
                           <button 
                              onClick={() => {
                                 setActiveJudgmentSessionIdx(activeJudgmentSessionIdx === idx ? null : idx);
                              }}
                              className={`p-1.5 rounded-md border transition flex items-center justify-center h-7 w-7 shadow-sm ${session.hasJudgment ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-navy-900'}`}
                              title={session.hasJudgment ? "استعراض/تعديل الحكم" : "إضافة حكم"}
                           >
                              <Scale className="w-3.5 h-3.5" />
                           </button>

                           {/* Matching rolls */}
                           {(() => {
                              const matchingRolls = rolls.filter(r => r.date === session.date);
                              if (matchingRolls.length === 0) return null;
                              return (
                                 <button
                                    onClick={() => openRollViewer(session.date)}
                                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 shadow-sm h-7"
                                    title="عرض الرول"
                                 >
                                    <BookOpen className="w-3.5 h-3.5" />
                                 </button>
                              );
                           })()}
                           
                           {/* Edit/Save Actions */}
                           {canEditData && editingSessionIdx === idx ? (
                              <>
                                 <button
                                    onClick={() => handleSaveSessionEdit(idx)}
                                    className="text-white hover:bg-emerald-600 bg-emerald-500 transition p-1 rounded h-7 w-7 flex items-center justify-center shadow-sm"
                                    title="حفظ"
                                 >
                                    <Save className="w-4 h-4" />
                                 </button>
                                 <button
                                    onClick={() => { setEditingSessionIdx(null); setEditSessionData({}); }}
                                    className="text-slate-500 hover:text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition p-1 rounded h-7 w-7 flex items-center justify-center shadow-sm"
                                    title="إلغاء"
                                 >
                                    <X className="w-4 h-4" />
                                 </button>
                              </>
                           ) : (
                              canEditData && (
                                 <button
                                    onClick={() => { setEditingSessionIdx(idx); setEditSessionData({ ...session }); }}
                                    className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 bg-white border border-transparent hover:border-amber-100 transition p-1 rounded h-7 w-7 flex items-center justify-center"
                                    title="تعديل الجلسة"
                                 >
                                    <Edit3 className="w-4 h-4" />
                                 </button>
                              )
                           )}

                           {/* Trash Icon */}
                           {canEditData && editingSessionIdx !== idx && (
                              <button
                                 onClick={async () => {
                                 const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذه الجلسة؟', 'delete_session');
                                 if (confirmed) {
                                    const newSessions = [...caseData.sessions];
                                    newSessions.splice(idx, 1);
                                    await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                    toast("تم حذف الجلسة", "info");
                                 }
                                 }}
                                 className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-white border border-transparent hover:border-rose-100 transition p-1 rounded h-7 w-7 flex items-center justify-center"
                                 title="حذف الجلسة"
                              >
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           )}
                        </div>
                     </div>

                     {/* Judgment Fields Block */}
                     {activeJudgmentSessionIdx === idx && (() => {
                        const resColorMap = { 'صالح':'emerald', 'ضد':'rose', 'مختلط':'indigo', 'اعتبار':'amber', 'وقف جزائي':'orange', 'وقف تعليقي':'purple', 'خبراء':'cyan', 'حكم منه للخصومة':'amber', 'غير منه للخصومة':'orange', 'تمهيدي':'indigo' };
                        const j = session.judgment || {};
                        
                        const JudgmentEditor = () => {
                          const initialCat = j.category || j._category || (session.decision?.includes('فحص') ? 'فحص' : '');
                          const initialRes = j.result || j._result || session.judgmentClassification || '';
                          const initialType = j.type || j._type || session.shortJudgment || '';
                          const initialVerd = j.fullVerdict || j._verdict || session.verdict || '';

                          const [cat, setCat]     = React.useState(initialCat);
                          const [res, setRes]     = React.useState(initialRes);
                          const [type, setType]   = React.useState(initialType);
                          const [verd, setVerd]   = React.useState(initialVerd);
                          const [final, setFinal] = React.useState(j.isFinal !== undefined ? j.isFinal : (j._isFinal || false));
                          
                          const [isEditing, setIsEditing] = React.useState(!session.hasJudgment);

                          React.useEffect(() => {
                            // 1. Dynamic Rules from Settings
                            if (settings?.judgmentDefaults?.length > 0) {
                               let matched = false;
                               const currentRole = String(caseData['الصفة'] || caseData['صفة'] || '');
                               
                               for (const rule of settings.judgmentDefaults) {
                                 const conds = rule.conditions || {};
                                 const roleMatch = !conds.role || currentRole.includes(conds.role) || conds.role === currentRole;
                                 const catMatch = !conds.category || cat === conds.category;
                                 const classMatch = !conds.classification || res === conds.classification;
                                 const typeMatch = !conds.type || type === conds.type;
                                 const sessionTypeMatch = !conds.sessionType || session.type === conds.sessionType;
                                 const decisionMatch = !conds.decision || session.decision === conds.decision;
                                 
                                 if (roleMatch && catMatch && classMatch && typeMatch && sessionTypeMatch && decisionMatch && (conds.role || conds.category || conds.classification || conds.type || conds.sessionType || conds.decision)) {
                                    const acts = rule.actions || {};
                                    if (acts.category && !cat) setCat(acts.category);
                                    if (acts.classification && !res) setRes(acts.classification);
                                    if (acts.type && !type) setType(acts.type);
                                    if (acts.text && !verd) setVerd(acts.text);
                                    matched = true;
                                    break;
                                 }
                               }
                            }
                          }, [cat, res, type, settings?.judgmentDefaults, caseData]);

                          const handleTypeChange = (newType) => {
                            setType(newType);
                            if (newType && settings?.judgmentTextMap?.[newType]) {
                               setVerd(settings.judgmentTextMap[newType]);
                            }
                          };
                          const [saving, setSaving] = React.useState(false);
                          const rc = resColorMap[res] || 'slate';
                          
                          const handleSave = async () => {
                            let currentRole = caseData['الصفة'] || caseData['صفة'] || '';
                            if (!currentRole.trim()) {
                              const promptRes = await showPrompt('تحديد الصفة ضروري', 'يرجى تحديد صفتنا في هذه الدعوى لحساب الإحصائيات بدقة (مثلاً: طاعن، مطعون ضدنا):');
                              if (promptRes?.trim()) {
                                currentRole = promptRes.trim();
                              } else {
                                toast('تنبيه: لم يتم تحديد الصفة! الإحصائيات ستتأثر ولن تكون دقيقة.', 'error');
                              }
                            }
                            
                            setSaving(true);
                            const newJudgmentObj = { category: cat, type, result: res, fullVerdict: verd, isFinal: final, recordedAt: new Date().toISOString().split('T')[0] };
                            const newSessions = [...caseData.sessions];
                            newSessions[idx] = { ...newSessions[idx], judgment: newJudgmentObj, shortJudgment: type, judgmentClassification: res, verdict: verd, hasJudgment: true };
                            
                            const payload = { sessions: newSessions };
                            if (currentRole !== (caseData['الصفة'] || caseData['صفة'])) {
                                payload['الصفة'] = currentRole;
                            }
                            
                            await saveCaseToFirebase(caseData.id, payload);
                            setSaving(false);
                            setIsEditing(false); // Switch back to view mode after saving
                          };

                          if (!isEditing) {
                            return (
                              <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 mt-1 shadow-sm relative group transition-all hover:border-indigo-200">
                                <div className="absolute left-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                  <button onClick={() => setIsEditing(true)} className="p-1.5 bg-white text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm border border-slate-200" title="تعديل بيانات الحكم">
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button onClick={async () => {
                                      const confirmed = await showConfirm('حذف الحكم', 'هل أنت متأكد من حذف هذا الحكم؟', 'delete_judgment');
                                      if (confirmed) {
                                         const newSessions = [...caseData.sessions];
                                         newSessions[idx] = { ...newSessions[idx], hasJudgment: false, judgment: null, shortJudgment: null, judgmentClassification: null, verdict: null };
                                         await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                         setActiveJudgmentSessionIdx(null);
                                      }
                                  }} className="p-1.5 bg-white text-slate-400 hover:text-rose-600 rounded-lg shadow-sm border border-slate-200" title="حذف الحكم">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setActiveJudgmentSessionIdx(null)} className="p-1.5 bg-white text-slate-400 hover:text-slate-600 rounded-lg shadow-sm border border-slate-200" title="إغلاق التفاصيل">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">⚖️ حكم مسجل</span>
                                  {final && <span className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">نهائي</span>}
                                  {res && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border bg-${rc}-50 text-${rc}-700 border-${rc}-200 mr-auto`}>{res}</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs mb-1">
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 block">فئة الحكم</span>
                                    <span className="font-bold text-slate-700">{cat || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 block">نوع الحكم</span>
                                    <span className="font-bold text-slate-700">{type || '-'}</span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold text-slate-400 block">المنطوق</span>
                                  <span className="font-bold text-slate-800 text-xs leading-relaxed">{verd || '-'}</span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-2 bg-rose-50/60 p-3 rounded-xl border border-rose-100 mt-1 shadow-sm">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] font-black text-rose-700">⚖️ بيانات الحكم</span>
                                {res && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border bg-${rc}-50 text-${rc}-700 border-${rc}-200`}>{res}</span>}
                              </div>
                              <div className="mb-2">
                                 <label className="text-[9px] font-bold text-slate-500 block mb-0.5">نوع الحكم</label>
                                <div>
                                  <input
                                    list={`jtype-${session.id}`}
                                    value={type}
                                    onChange={e => handleTypeChange(e.target.value)}
                                    placeholder="نوع الحكم..."
                                    className="w-full text-[10px] font-bold bg-white p-1.5 rounded-lg border border-rose-200 focus:outline-none focus:border-rose-400"
                                  />
                                  <datalist id={`jtype-${session.id}`}>
                                    {Object.keys(settings?.judgmentTextMap || {}).map(t => <option key={t} value={t}>{t}</option>)}
                                  </datalist>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">فئة الحكم</label>
                                  <select value={cat} onChange={e => { setCat(e.target.value); }} className="w-full text-[10px] font-bold bg-white p-1.5 rounded-lg border border-rose-200 focus:outline-none focus:border-rose-400">
                                    <option value="">-- اختر --</option>
                                    {(settings?.judgmentCategories || []).map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">تصنيف الحكم</label>
                                  <select value={res} onChange={e => { setRes(e.target.value); }} className="w-full text-[10px] font-bold bg-white p-1.5 rounded-lg border border-rose-200 focus:outline-none focus:border-rose-400">
                                    <option value="">-- اختر --</option>
                                    {(settings?.judgmentClassifications || []).map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block mb-0.5">منطوق الحكم كاملاً</label>
                                <textarea value={verd} onChange={e => setVerd(e.target.value)} placeholder="أكتب منطوق الحكم كاملاً..." className="w-full text-[10px] font-bold bg-white p-2 rounded-lg border border-rose-200 whitespace-pre-wrap focus:outline-none focus:border-rose-400 resize-none min-h-[50px]" rows={2} />
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-rose-100 mt-2">
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 cursor-pointer">
                                  <input type="checkbox" checked={final} onChange={e => setFinal(e.target.checked)} className="rounded accent-rose-600" />
                                  حكم نهائي في الدعوى
                                </label>
                                <div className="flex gap-2">
                                  <button onClick={() => {
                                      if (session.hasJudgment) setIsEditing(false);
                                      else setActiveJudgmentSessionIdx(null);
                                  }} disabled={saving} className="text-[10px] font-bold px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition disabled:opacity-50">
                                    إلغاء
                                  </button>
                                  <button onClick={handleSave} disabled={saving} className="text-[10px] font-black px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50">
                                    {saving ? '...' : '💾 حفظ الحكم'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        };
                        return <JudgmentEditor />;
                     })()}

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Tab Content: Documents */}
      {activeTab === 'documents' && (
        <CaseDocuments caseId={caseData.id} pastedFile={pastedFile} setPastedFile={setPastedFile} />
      )}
      
      {/* Add Session Modal */}
      <AddSessionModal 
        isOpen={isAddSessionOpen}
        onClose={() => setIsAddSessionOpen(false)}
        caseData={caseData}
      />

      <datalist id="decisions-list">
        {defaultDecisions.map((opt, i) => (
          <option key={i} value={opt} />
        ))}
      </datalist>

      {/* Alerts Modal */}
      <AlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        caseData={caseData}
      />

      <ProceduresModal 
        isOpen={isProceduresModalOpen}
        onClose={() => setIsProceduresModalOpen(false)}
        caseData={caseData}
        setCaseData={setEditData}
      />

      {/* Change Role Modal */}
      {isChangeRoleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy-900 px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-black text-lg text-amber-300">تغيير صفة الدعوى</h2>
              <button onClick={() => setIsChangeRoleModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-bold text-slate-500 mb-2">اختر التصنيف الجديد لهذه الدعوى:</p>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => setNewRole('طاعن')} className={`p-3 rounded-xl border text-sm font-black transition ${newRole === 'طاعن' ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>طاعن / مدعي (مهم جداً)</button>
                <button onClick={() => setNewRole('مطعون ضدنا')} className={`p-3 rounded-xl border text-sm font-black transition ${newRole === 'مطعون ضدنا' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>مطعون ضدنا / مدعى علينا</button>
                <button onClick={() => setNewRole('لا شأن')} className={`p-3 rounded-xl border text-sm font-black transition ${newRole === 'لا شأن' ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>لا شأن (غير نشطة)</button>
                <button onClick={() => setNewRole('خارج الاختصاص')} className={`p-3 rounded-xl border text-sm font-black transition ${newRole === 'خارج الاختصاص' ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>خارج الاختصاص (متابعة فقط)</button>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                <button onClick={() => setIsChangeRoleModalOpen(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition">إلغاء</button>
                <button 
                  onClick={async () => {
                    if(newRole === role) {
                      setIsChangeRoleModalOpen(false); return;
                    }
                    const confirmed = await showConfirm('تأكيد التعديل', `هل أنت متأكد من تغيير تصنيف الدعوى إلى "${newRole}"؟`, 'change_role');
                    if(confirmed) {
                      const roleFieldKey = Object.keys(caseData).find(k => k === 'الصفة' || k === 'صفة') || 'الصفة';
                      await saveCaseToFirebase(caseData.id, { [roleFieldKey]: newRole });
                      toast('تم تغيير تصنيف الدعوى بنجاح', 'success');
                      setIsChangeRoleModalOpen(false);
                    }
                  }} 
                  className="flex-1 py-2 bg-navy-900 text-amber-300 rounded-lg text-xs font-black hover:bg-navy-800 transition"
                >
                  حفظ التعديل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Location Modal */}
      {isChangeLocationModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-navy-900 px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-amber-300 text-sm">تغيير مكان الملف</h3>
              <button onClick={() => setIsChangeLocationModalOpen(false)} className="text-white/60 hover:text-white transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
               <div className="flex flex-wrap gap-2">
                 {['غير موجود', 'أصلي', 'مؤقت', 'شعبة الحفظ', 'شعبة الشغل', 'الأحكام', 'في البيت'].map(loc => (
                   <button 
                     key={loc}
                     onClick={() => setNewLocation(loc)}
                     className={`px-3 py-2 rounded-lg text-xs font-bold transition flex-1 ${newLocation === loc ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                   >
                     {loc}
                   </button>
                 ))}
               </div>
               <input 
                 type="text" 
                 value={!['غير موجود', 'أصلي', 'مؤقت', 'شعبة الحفظ', 'شعبة الشغل', 'الأحكام', 'في البيت'].includes(newLocation) ? newLocation : ''}
                 onChange={(e) => setNewLocation(e.target.value)}
                 placeholder="أو اكتب مكان آخر..."
                 className="w-full mt-2 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
               />
               
               <div className="mt-4 flex items-center gap-2">
                 <input type="checkbox" id="dontShowLocationConfirm" className="rounded text-indigo-600 focus:ring-indigo-500" />
                 <label htmlFor="dontShowLocationConfirm" className="text-[10px] font-bold text-slate-500 cursor-pointer">
                   عدم إظهار رسالة التأكيد مستقبلاً
                 </label>
               </div>
               
               <div className="pt-4 flex gap-2">
                 <button onClick={() => setIsChangeLocationModalOpen(false)} className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">إلغاء</button>
                 <button 
                   onClick={async () => {
                     const dontShow = document.getElementById('dontShowLocationConfirm')?.checked;
                     if (dontShow) {
                       localStorage.setItem('skipLocationConfirm', 'true');
                     }
                     
                     const shouldConfirm = localStorage.getItem('skipLocationConfirm') !== 'true';
                     
                     if (shouldConfirm) {
                       const confirmed = await showConfirm('تغيير مكان الملف', `هل أنت متأكد من تغيير مكان الملف إلى: ${newLocation}؟`, 'change_location');
                       if (!confirmed) return;
                     }
                     
                     try {
                        const locField = schema.find(f => f.id === 'مكان الملف') ? 'مكان الملف' : 'مكان الملف';
                        await saveCaseToFirebase(caseData.id, { [locField]: newLocation });
                        setEditData(prev => ({ ...prev, [locField]: newLocation }));
                        toast("تم تحديث مكان الملف بنجاح", "success");
                        setIsChangeLocationModalOpen(false);
                     } catch(e) {
                        toast("حدث خطأ", "error");
                     }
                   }}
                   className="flex-[2] py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition"
                 >
                   حفظ
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
