import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Edit3, X, Gavel, Trash2, CalendarPlus, ClipboardList, CheckCircle2, Bell, AlertTriangle, FileText, ExternalLink, BookOpen, Files, Hash, Paperclip, Scale, Loader2 } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import AddSessionModal from '../components/AddSessionModal';
import CaseDocuments from '../components/CaseDocuments';
import AlertsModal from '../components/AlertsModal';
import { formatDateString, getSafeDateObj } from '../utils/dateUtils';
import { localizeNumber } from '../utils/numberUtils';
import { uploadToR2 } from '../lib/r2';
import imageCompression from 'browser-image-compression';
import { useRef } from 'react';

export default function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cases, schema, isAdmin, saveCaseToFirebase, settings, rolls, checkDuplicateCase, deleteCaseFromFirebase } = useAppContext();
  const { toast, showConfirm, openRollViewer } = useUI();

  // In the new architecture, id is the document id, not the array index.
  const caseData = cases.find(c => c.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(caseData || {});
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'documents' | 'sessions' | 'tasks'
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [isChangeLocationModalOpen, setIsChangeLocationModalOpen] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [newLocation, setNewLocation] = useState('');
  
  // Session File Upload
  const fileInputRef = useRef(null);
  const [activeSessionIdx, setActiveSessionIdx] = useState(null);
  const [isUploadingSessionFile, setIsUploadingSessionFile] = useState(false);
  
  // Procedure state
  const procedureFileInputRef = useRef(null);
  const [newProcedure, setNewProcedure] = useState({ date: new Date().toISOString().split('T')[0], title: '', notes: '' });
  const [isAddingProcedure, setIsAddingProcedure] = useState(false);
  const [isUploadingProcedureFile, setIsUploadingProcedureFile] = useState(false);
  const [procedureAttachment, setProcedureAttachment] = useState(null); // { url, name }

  // Joined cases state
  const [newJoinedNo, setNewJoinedNo] = useState('');
  const [newJoinedYear, setNewJoinedYear] = useState('');

  // Extract unique values for autocomplete
  const defaultDecisions = settings?.decisions || [];
  const uniqueCourts = [...new Set(cases.map(c => c['المحكمة']).filter(Boolean))];
  const uniqueStages = [...new Set(cases.map(c => c['مرحلة التقاضي']).filter(Boolean))];
  const uniqueDepartments = [...new Set(cases.map(c => c['الدائرة']).filter(Boolean))];

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
  const caseRoll = getFieldValue(caseData, ['الرول']) || '';
  const role = getFieldValue(caseData, ['الصفة', 'صفة']) || '';
  const fileLocation = getFieldValue(caseData, ['مكان الملف']) || '';
  const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
  const isAppellee = role.includes('مطعون ضده') || role.includes('مستأنف ضده') || role.includes('مدعى عليه');
  const isNoInterest = role === 'لا شأن';
  const isOutOfJurisdiction = role === 'خارج الاختصاص';

  const joinedCasesArr = caseData.joinedCasesList || [];
  const legacyJoinedStr = getFieldValue(caseData, ['دعاوى منضمة']) || '';
  const hasJoinedCases = joinedCasesArr.length > 0 || legacyJoinedStr.trim() !== '';

  const isJudgment = String(decision).includes('حكم') || String(decision).includes('للحكم');

  let roleBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
  let accentLineClass = 'bg-amber-500';
  
  if (isAppellant) {
    roleBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    accentLineClass = 'bg-rose-500';
  } else if (isAppellee) {
    roleBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    accentLineClass = 'bg-emerald-500';
  } else if (isOutOfJurisdiction) {
    roleBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    accentLineClass = 'bg-indigo-500';
  } else if (isNoInterest) {
    roleBadgeClass = 'bg-slate-100 text-slate-500 border-slate-300';
    accentLineClass = 'bg-slate-400';
  }

  const coverImageDoc = (caseData.documents || []).find(doc => doc.type === 'غلاف الملف' && doc.fileType === 'image');
  const coverImageUrl = coverImageDoc ? coverImageDoc.url : null;

  const handleSave = async () => {
    if (!isAdmin) return;
    
    // Check for duplicate Case No + Year
    const newCaseNo = getFieldValue(editData, ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']);
    const newYear = getFieldValue(editData, ['السنة', 'سنة', 'year']);
    
    if (checkDuplicateCase(newCaseNo, newYear, caseData.id)) {
       toast("هذه الدعوى مسجلة بالفعل (رقم الدعوى والسنة مكرران)", "error");
       return;
    }
    
    try {
      await saveCaseToFirebase(caseData.id, editData);
      setIsEditing(false);
      toast("تم حفظ التعديلات بنجاح!", "success");
    } catch (error) {
      console.error(error);
      toast("حدث خطأ أثناء الحفظ.", "error");
    }
  };

  const handleDeleteCase = async () => {
    if (!isAdmin) return;
    const confirmed = await showConfirm("حذف الملف", "هل أنت متأكد من رغبتك في حذف هذا الملف بالكامل؟ لا يمكن التراجع عن هذا الإجراء.");
    if (confirmed) {
       const success = await deleteCaseFromFirebase(caseData.id);
       if (success) {
          toast("تم حذف الملف بنجاح.", "success");
          navigate('/', { replace: true });
       } else {
          toast("حدث خطأ أثناء حذف الملف.", "error");
       }
    }
  };

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

        {isAdmin ? (
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
              <button 
                onClick={handleDeleteCase}
                className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 shadow-sm flex items-center justify-center transition hover:bg-rose-100"
                title="حذف الملف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsEditing(true)}
                className="w-10 h-10 rounded-xl bg-navy-900 text-amber-300 shadow-sm flex items-center justify-center transition"
                title="تعديل الملف"
              >
                <Edit3 className="w-4 h-4" />
              </button>
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
          
          <div className="flex items-center gap-3 justify-center mt-1">
            <h1 className="text-2xl sm:text-3xl font-black text-navy-900 flex items-center gap-2 flex-wrap justify-center">
              دعوى رقم {localizeNumber(caseNo, settings?.numberFormat)} <span className="text-slate-400 font-bold text-lg">لسنة</span> {localizeNumber(year, settings?.numberFormat)}
              {hasJoinedCases && (
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-lg flex items-center gap-1 border border-indigo-200" title={`دعاوى منضمة: ${joinedCasesArr.map(c => `${localizeNumber(c.no, settings?.numberFormat)} لسنة ${localizeNumber(c.year, settings?.numberFormat)}`).join('، ')} ${legacyJoinedStr}`}>
                  <Files className="w-4 h-4" /> مجمعة
                </span>
              )}
            </h1>
            
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
            <div className={`mt-3 p-3 rounded-xl border flex flex-row items-center justify-center gap-4 flex-wrap ${isJudgment ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-amber-50/50 border-amber-100 text-amber-800'}`}>
              {caseRoll && (
                <div className="text-sm font-black flex items-center gap-1.5 shrink-0">
                  <Hash className="w-4 h-4 text-slate-500" />
                  رول: <span dir="ltr">{caseRoll}</span>
                </div>
              )}
              {caseRoll && lastSession && <div className="w-px h-4 bg-current opacity-20"></div>}
              {lastSession && (
                <button 
                  onClick={() => openRollViewer(lastSession)}
                  className="text-sm font-black flex items-center gap-1.5 shrink-0 hover:text-indigo-600 transition"
                  title="عرض رول الجلسة"
                >
                  📅 تاريخ الجلسة: <span dir="ltr">{lastSession}</span>
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                </button>
              )}
              {lastSession && decision && <div className="w-px h-4 bg-current opacity-20"></div>}
              {decision && (
                <p className="text-sm font-black text-center">
                  القرار: {decision}
                </p>
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
          <button 
            onClick={() => setActiveTab('procedures')}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${activeTab === 'procedures' ? 'bg-navy-900 text-amber-300 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ClipboardList className="w-4 h-4" /> الإجراءات
          </button>
        </div>
      </div>

      {/* Tab Content: Details */}
      {activeTab === 'details' && (
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
             <Gavel className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-lg text-navy-900">البيانات التفصيلية</h2>
            <p className="text-[11px] text-slate-500 font-bold">كل الحقول المسجلة في هيكل قاعدة البيانات</p>
          </div>
        </div>

        {/* Joined Cases Section */}
        {caseData.role === 'خارج الاختصاص' && (
        <div className="bg-indigo-50/40 rounded-xl p-4 border border-indigo-100 mb-6 mt-4">
           <h3 className="text-[11px] font-black text-indigo-800 mb-3 flex items-center gap-1.5"><Files className="w-4 h-4"/> الدعاوى المنضمة للملف</h3>
           <div className="flex flex-wrap gap-2">
              {(editData.joinedCasesList || []).map((jc, idx) => (
                 <div key={idx} className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                    {localizeNumber(jc.no, settings?.numberFormat)} <span className="text-[10px] text-slate-400">لسنة</span> {localizeNumber(jc.year, settings?.numberFormat)}
                    {isEditing && (
                       <button onClick={() => {
                          const list = [...(editData.joinedCasesList || [])];
                          list.splice(idx, 1);
                          setEditData({...editData, joinedCasesList: list});
                       }} className="text-rose-400 hover:text-rose-600 transition">
                         <X className="w-3 h-3" />
                       </button>
                    )}
                 </div>
              ))}
              
              {legacyJoinedStr && !isEditing && (
                 <div className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                    {legacyJoinedStr}
                 </div>
              )}
              
              {(!editData.joinedCasesList || editData.joinedCasesList.length === 0) && !legacyJoinedStr && !isEditing && (
                <span className="text-[10px] font-bold text-slate-400">لا توجد دعاوى منضمة.</span>
              )}
           </div>
           
           {isEditing && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-indigo-100/50 max-w-sm">
                 <input type="number" placeholder="رقم الدعوى" value={newJoinedNo} onChange={e => setNewJoinedNo(e.target.value)} className="w-24 bg-white border border-indigo-200 shadow-sm rounded-lg px-2 py-1.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                 <input type="number" placeholder="السنة" value={newJoinedYear} onChange={e => setNewJoinedYear(e.target.value)} className="w-20 bg-white border border-indigo-200 shadow-sm rounded-lg px-2 py-1.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                 <button onClick={() => {
                    if(!newJoinedNo || !newJoinedYear) return;
                    
                    const list = [...(editData.joinedCasesList || []), { no: newJoinedNo, year: newJoinedYear }];
                    
                    setEditData({
                       ...editData,
                       joinedCasesList: list
                    });
                    
                    setNewJoinedNo('');
                    setNewJoinedYear('');
                 }} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm text-white px-3 py-1.5 rounded-lg text-[10px] font-black transition">
                    إضافة الدعوى
                 </button>
              </div>
           )}
        </div>
        )}

        {/* Dynamic Fields from Schema (Grouped & Redesigned) */}
        <div className="space-y-6 pt-2">
          {[
            {
              title: '📌 بيانات أساسية',
              colorClass: 'text-blue-700 bg-blue-50/50 border-blue-100',
              keys: ['الرول', 'رقم الدعوى', 'رقم القضية', 'رقم_الدعوى', 'السنة', 'سنة', 'year', 'المحكمة', 'الدائرة', 'مرحلة التقاضي', 'الإجراءات الهامة والعاجلة']
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
              keys: ['المقر المختار', 'عنوان المدعى عليه'] // and any unmapped fields
            }
          ].map((group, idx, arr) => {
             const excludedFields = ['الصفة', 'صفة', 'مكان الملف', 'آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة', 'نوع الجلسة', 'القرار', 'قرار الجلسة'];
             
             // Find matching visible fields
             let groupFields = schema.filter(f => f.visible && group.keys.includes(f.id) && !excludedFields.includes(f.id));
             
             // If it's the last group ("بيانات أخرى"), include any unmapped visible fields
             if (idx === arr.length - 1) {
                const allConfiguredKeys = arr.flatMap(g => g.keys);
                const unmappedFields = schema.filter(f => f.visible && !allConfiguredKeys.includes(f.id) && !excludedFields.includes(f.id));
                groupFields = [...groupFields, ...unmappedFields];
             }
             
             // Only render this block if there are visible fields that have data (when not editing) or if editing
             const hasContent = groupFields.some(f => {
               const val = editData[f.id] || '';
               return isEditing || (val !== null && val !== '');
             });
             
             if (!hasContent) return null;

             return (
               <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className={`px-4 py-2.5 border-b font-black text-xs flex items-center gap-2 ${group.colorClass}`}>
                     {group.title}
                  </div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 gap-y-5">
                     {groupFields.map(field => {
                        const val = editData[field.id] || '';
                        if (!isEditing && (val === null || val === '')) return null;

                        const isDateField = field.type === 'date' || field.id.includes('تاريخ') || field.id.includes('جلسة');
                        const displayVal = localizeNumber(isDateField ? formatDateString(val) : val, settings?.numberFormat);
                        
                        let colSpan = 'col-span-2 md:col-span-2'; // Default medium
                        const shortFields = ['رقم الدعوى', 'السنة', 'سنة', 'year', 'رقم القضية', 'رقم_الدعوى', 'الرول', 'الدائرة', 'تصنيف الحكم'];
                        const longFields = ['ملاحظات', 'المنطوق', 'منطوق الحكم', 'موضوع الدعوى', 'الإجراءات الهامة والعاجلة'];

                        if (shortFields.includes(field.id)) colSpan = 'col-span-1 md:col-span-1';
                        if (longFields.includes(field.id) || field.type === 'textarea') colSpan = 'col-span-2 md:col-span-4';

                        return (
                          <div key={field.id} className={`space-y-1.5 ${colSpan}`}>
                            <label className="text-[11px] font-black text-slate-500 block">{field.label}</label>
                            {isEditing ? (
                              field.id === 'الصفة' || field.id === 'صفة' ? (
                                 <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                                    {['طاعن', 'مطعون ضده', 'خصم مدخل'].map(opt => (
                                      <button 
                                        key={opt} type="button" onClick={() => setEditData({...editData, [field.id]: opt})} 
                                        className={`flex-1 py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt ? (opt === 'طاعن' ? 'bg-rose-500 text-white' : opt === 'مطعون ضده' ? 'bg-emerald-500 text-white' : 'bg-navy-900 text-white') : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                      >{opt}</button>
                                    ))}
                                 </div>
                              ) : field.id === 'نوع الجلسة' ? (
                                 <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                                    {['فحص', 'موضوع', 'حكم', 'خبير'].map(opt => (
                                      <button 
                                        key={opt} type="button" onClick={() => setEditData({...editData, [field.id]: opt})} 
                                        className={`flex-1 py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt ? 'bg-amber-500 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
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
                                      {['غير موجود', 'أصلي', 'مؤقت', 'شعبة الحفظ', 'شعبة الشغل', 'الأحكام', 'في البيت'].map(opt => (
                                        <button 
                                          key={opt} type="button" onClick={() => setEditData({...editData, [field.id]: opt})} 
                                          className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
                                        >{opt}</button>
                                      ))}
                                   </div>
                                   <input type="text" placeholder="أو اكتب مكان آخر..." value={!['غير موجود', 'أصلي', 'مؤقت', 'شعبة الحفظ', 'شعبة الشغل', 'الأحكام', 'في البيت'].includes(val) ? val : ''} onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                                 </div>
                              ) : field.type === 'textarea' ? (
                                 <textarea value={val} onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 resize-none transition" />
                              ) : field.type === 'date' || field.id.includes('تاريخ') || field.id.includes('جلسة') ? (
                                 <input type="date" value={val && getSafeDateObj(val) ? getSafeDateObj(val).toISOString().split('T')[0] : ''} onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                              ) : (
                                 <>
                                   <input type="text" value={val} list={`list-${field.id}`} onChange={(e) => setEditData({...editData, [field.id]: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                                   {(field.id === 'المحكمة') && (
                                      <datalist id={`list-${field.id}`}>
                                        {uniqueCourts.map((opt, i) => <option key={i} value={opt} />)}
                                      </datalist>
                                   )}
                                   {(field.id === 'الدائرة') && (
                                      <datalist id={`list-${field.id}`}>
                                        {uniqueDepartments.map((opt, i) => <option key={i} value={opt} />)}
                                      </datalist>
                                   )}
                                   {(field.id === 'مرحلة التقاضي') && (
                                      <datalist id={`list-${field.id}`}>
                                        {uniqueStages.map((opt, i) => <option key={i} value={opt} />)}
                                      </datalist>
                                   )}
                                 </>
                              )
                            ) : (
                              <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 whitespace-pre-wrap break-words min-h-[42px]" dir={isDateField ? "ltr" : "auto"}>
                                {displayVal}
                              </div>
                            )}
                          </div>
                        );
                     })}
                  </div>
               </div>
             );
          })}
        </div>

        {/* Custom fields not in schema (legacy/extra) */}
        {isEditing && (
          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-xs font-black text-slate-400 mb-3">حقول إضافية غير مسجلة في الهيكلة:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.keys(editData).filter(k => k !== 'id' && k !== 'sessions' && k !== 'documents' && k !== 'joinedCasesList' && !schema.find(s => s.id === k)).map(key => (
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
        )}
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
          {isAdmin && (
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
                           {/* Roll */}
                           <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                              <span className="text-[10px] font-black text-slate-500">رول:</span>
                              <input
                                 type="text"
                                 defaultValue={session.roll || ''}
                                 className="w-8 text-[10px] font-black text-indigo-700 bg-transparent text-center focus:outline-none"
                                 onBlur={async (e) => {
                                    if (e.target.value !== (session.roll || '')) {
                                       const newSessions = [...caseData.sessions];
                                       newSessions[idx] = { ...newSessions[idx], roll: e.target.value };
                                       await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                    }
                                 }}
                              />
                           </div>
                           
                           {/* Date */}
                           <input
                              type="date"
                              defaultValue={session.date}
                              className="text-[10px] font-black text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 w-[110px] text-center focus:outline-none focus:border-amber-400"
                              onBlur={async (e) => {
                                 if (e.target.value !== session.date && e.target.value) {
                                    const newSessions = [...caseData.sessions];
                                    newSessions[idx] = { ...newSessions[idx], date: e.target.value };
                                    await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                 }
                              }}
                           />
                           
                           {/* Type */}
                           <select
                              defaultValue={session.type || 'فحص'}
                              className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 focus:outline-none focus:border-emerald-400"
                              onBlur={async (e) => {
                                 if (e.target.value !== (session.type || 'فحص')) {
                                    const newSessions = [...caseData.sessions];
                                    newSessions[idx] = { ...newSessions[idx], type: e.target.value };
                                    await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                 }
                              }}
                           >
                              <option value="فحص">فحص</option>
                              <option value="موضوع">موضوع</option>
                           </select>
                           
                           {/* Decision */}
                           <input
                              list="decisions-list"
                              defaultValue={session.decision || ''}
                              placeholder="القرار..."
                              className="text-xs font-black text-navy-900 bg-white px-3 py-1 rounded-md border border-slate-200 w-[120px] focus:outline-none focus:border-amber-400"
                              onBlur={async (e) => {
                                 if (e.target.value !== (session.decision || '')) {
                                    const newSessions = [...caseData.sessions];
                                    newSessions[idx] = { ...newSessions[idx], decision: e.target.value };
                                    await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                 }
                              }}
                           />
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
                              onClick={async () => {
                                 const newSessions = [...caseData.sessions];
                                 newSessions[idx] = { ...newSessions[idx], hasJudgment: !session.hasJudgment };
                                 await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                              }}
                              className={`p-1 rounded border transition flex items-center justify-center h-7 w-7 shadow-sm ${session.hasJudgment ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-navy-900'}`}
                              title={session.hasJudgment ? "إلغاء حقول الحكم" : "إضافة بيانات الحكم"}
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
                           
                           {/* Trash Icon */}
                           {isAdmin && (
                              <button
                                 onClick={async () => {
                                 const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذه الجلسة؟');
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
                     {session.hasJudgment && (
                        <div className="flex flex-col gap-2 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 mt-1 animate-in fade-in slide-in-from-top-2 shadow-sm">
                           <div className="flex gap-2">
                              <input 
                                 type="text" 
                                 placeholder="تصنيف الحكم (صالح، ضد...)" 
                                 defaultValue={session.judgmentClassification || ''}
                                 className="w-1/3 text-[10px] font-bold text-rose-800 bg-white p-2 rounded-md border border-rose-200 focus:outline-none focus:border-rose-400" 
                                 onBlur={async (e) => {
                                    if (e.target.value !== (session.judgmentClassification || '')) {
                                       const newSessions = [...caseData.sessions];
                                       newSessions[idx] = { ...newSessions[idx], judgmentClassification: e.target.value };
                                       await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                    }
                                 }}
                              />
                              <input 
                                 type="text" 
                                 placeholder="الحكم (وقف جزائي، رفض، إلغاء...)" 
                                 defaultValue={session.shortJudgment || ''}
                                 className="flex-1 text-[10px] font-bold text-rose-800 bg-white p-2 rounded-md border border-rose-200 focus:outline-none focus:border-rose-400" 
                                 onBlur={async (e) => {
                                    if (e.target.value !== (session.shortJudgment || '')) {
                                       const newSessions = [...caseData.sessions];
                                       newSessions[idx] = { ...newSessions[idx], shortJudgment: e.target.value };
                                       await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                    }
                                 }}
                              />
                           </div>
                           <textarea 
                              placeholder="منطوق الحكم كامل..." 
                              defaultValue={session.verdict || ''}
                              className="w-full text-[10px] font-bold text-rose-800 bg-white p-2 rounded-md border border-rose-200 whitespace-pre-wrap focus:outline-none focus:border-rose-400 resize-none min-h-[40px]" 
                              onBlur={async (e) => {
                                 if (e.target.value !== (session.verdict || '')) {
                                    const newSessions = [...caseData.sessions];
                                    newSessions[idx] = { ...newSessions[idx], verdict: e.target.value };
                                    await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                 }
                              }}
                           />
                        </div>
                     )}

                     <textarea 
                        placeholder="ملاحظات الجلسة..."
                        className="w-full text-[10px] font-bold text-slate-600 bg-white p-2 rounded-lg border border-slate-200 whitespace-pre-wrap focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none min-h-[40px]"
                        defaultValue={session.notes}
                        onBlur={async (e) => {
                           if (e.target.value !== session.notes) {
                              const newSessions = [...caseData.sessions];
                              newSessions[idx] = { ...newSessions[idx], notes: e.target.value };
                              await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                           }
                        }}
                     />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Tab Content: Procedures */}
      {activeTab === 'procedures' && (
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
               <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-lg text-navy-900">سجل الإجراءات</h2>
              <p className="text-[11px] text-slate-500 font-bold">تسجيل ومتابعة الإجراءات المتخذة في الملف</p>
            </div>
          </div>
        </div>

        <div className="pt-2 space-y-4">
          {(!caseData.procedures || caseData.procedures.length === 0) ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
               <p className="text-xs font-bold text-slate-500">لا توجد إجراءات مسجلة في هذا الملف.</p>
            </div>
          ) : (
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {caseData.procedures.sort((a, b) => new Date(b.date) - new Date(a.date)).map((proc, idx) => (
                <div key={proc.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                  </div>
                  {/* Card */}
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md mb-2 inline-block">
                        {formatDateString(proc.date)}
                      </div>
                      {isAdmin && (
                        <button 
                          onClick={async () => {
                            const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الإجراء؟');
                            if (confirmed) {
                              const newProcs = caseData.procedures.filter(p => p.id !== proc.id);
                              await saveCaseToFirebase(caseData.id, { procedures: newProcs });
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 mt-6">
              <h4 className="text-sm font-black text-navy-900 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> تسجيل إجراء جديد
              </h4>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="date" 
                    value={newProcedure.date}
                    onChange={e => setNewProcedure({...newProcedure, date: e.target.value})}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 flex-[1]"
                  />
                  <input 
                    type="text" 
                    placeholder="اسم الإجراء (مثال: إيداع مذكرة دفاع، تقديم حافظة...)" 
                    value={newProcedure.title}
                    onChange={e => setNewProcedure({...newProcedure, title: e.target.value})}
                    className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 flex-[3]"
                  />
                </div>
                <textarea 
                  placeholder="ملاحظات تفصيلية (اختياري)..."
                  value={newProcedure.notes}
                  onChange={e => setNewProcedure({...newProcedure, notes: e.target.value})}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400 min-h-[60px] resize-none"
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
                  
                  <button 
                    onClick={async () => {
                      if(!newProcedure.title || !newProcedure.date) {
                        toast('يرجى إدخال اسم وتاريخ الإجراء.', 'error');
                        return;
                      }
                      setIsAddingProcedure(true);
                      
                      const newProcObj = {
                        id: Date.now().toString(),
                        title: newProcedure.title,
                        date: newProcedure.date,
                        notes: newProcedure.notes,
                        attachmentUrl: procedureAttachment?.url || null,
                        attachmentName: procedureAttachment?.name || null,
                        createdAt: new Date().toISOString()
                      };
                      
                      const updatedProcedures = [...(caseData.procedures || []), newProcObj];
                      
                      // Also add to documents if there is an attachment
                      let updatedDocuments = caseData.documents || [];
                      if (procedureAttachment) {
                         updatedDocuments = [...updatedDocuments, {
                            id: Date.now().toString() + '_doc',
                            title: `مرفق إجراء: ${newProcedure.title}`,
                            url: procedureAttachment.url,
                            type: 'other',
                            createdAt: new Date().toISOString()
                         }];
                      }
                      
                      await saveCaseToFirebase(caseData.id, { procedures: updatedProcedures, documents: updatedDocuments });
                      setNewProcedure({ date: new Date().toISOString().split('T')[0], title: '', notes: '' });
                      setProcedureAttachment(null);
                      setIsAddingProcedure(false);
                      toast('تم حفظ الإجراء بنجاح', 'success');
                    }}
                    disabled={isAddingProcedure || isUploadingProcedureFile}
                    className="w-full sm:w-auto bg-indigo-600 text-white shadow-sm font-black px-8 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {isAddingProcedure ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ الإجراء'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      {/* Tab Content: Documents */}
      {activeTab === 'documents' && (
        <CaseDocuments caseId={caseData.id} />
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
                <button onClick={() => setNewRole('مطعون ضده')} className={`p-3 rounded-xl border text-sm font-black transition ${newRole === 'مطعون ضده' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>مطعون ضده / مدعى عليه</button>
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
                    const confirmed = await showConfirm('تأكيد التعديل', `هل أنت متأكد من تغيير تصنيف الدعوى إلى "${newRole}"؟`);
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
                       const confirmed = await showConfirm('تغيير مكان الملف', `هل أنت متأكد من تغيير مكان الملف إلى: ${newLocation}؟`);
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
