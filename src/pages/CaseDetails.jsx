import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Edit3, X, Gavel, Trash2, CalendarPlus, ClipboardList, CheckCircle2, Bell, AlertTriangle, FileText, ExternalLink, BookOpen, Files, Hash, Paperclip, Scale, Loader2, Plus, Star, MessageSquare, Printer, FolderOpen, History, MapPin, Camera } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import AddSessionModal from '../components/AddSessionModal';
import CaseDocuments from '../components/CaseDocuments';
import AlertsModal from '../components/AlertsModal';
import CaseTasksModal from '../components/CaseTasksModal';
import BulkViewingTaskModal from '../components/BulkViewingTaskModal';
import GlobalTemplatePrintModal from '../components/GlobalTemplatePrintModal';
import ProceduresModal from '../components/ProceduresModal';
import FieldOptionsManager from '../components/FieldOptionsManager';
import StrictSelectField from '../components/StrictSelectField';
import { formatDateString, getSafeDateObj } from '../utils/dateUtils';
import { localizeNumber } from '../utils/numberUtils';
import { calculateLitigationStage } from '../utils/caseUtils';
import { calculateDashboardStats } from '../utils/statsUtils';
import { uploadToR2 } from '../lib/r2';
import imageCompression from 'browser-image-compression';
import { useRef } from 'react';
import SmartAutocomplete from '../components/SmartAutocomplete';
import CaseInfoTab from '../components/CaseDetailsTabs/CaseInfoTab';
import SessionsTab from '../components/CaseDetailsTabs/SessionsTab';


export default function CaseDetails({ isModal, modalCaseId, onCloseModal }) {
  const { id: paramId } = useParams();
  const id = isModal ? modalCaseId : paramId;
  const navigate = useNavigate();
  const { cases, schema, isAdmin, saveCaseToFirebase, settings, rolls, checkDuplicateCase, deleteCaseFromFirebase, restoreCaseFromFirebase, saveSettingsToFirebase, saveGlobalTask, globalTasks, currentUser, currentUserPermissions } = useAppContext();

  const roleOptions = settings?.roles || ['طاعن', 'مطعون ضدنا', 'خصم مدخل'];
  const currentCourtDegree = settings?.courtDegree || 'أول درجة';
  const isSupreme = currentCourtDegree === 'ثان درجة' || currentCourtDegree === 'عليا' || currentCourtDegree === 'الإدارية العليا';
  const sessionTypeOptions = settings?.sessionTypes || (isSupreme ? ['فحص', 'موضوع'] : ['مفوضين', 'مرافعة', 'حكم']);
  const typeFahs = sessionTypeOptions[0] || 'فحص';
  const fileLocationOptions = settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي'];

  const canEditData = isAdmin || currentUserPermissions?.canEditData;
  const canDeleteData = isAdmin || currentUserPermissions?.canDeleteData;
  const { toast, showConfirm, openRollViewer, showPrompt } = useUI();

  // In the new architecture, id is the document id, not the array index.
  const caseData = cases.find(c => c.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(caseData || {});
  const [activeDetailTab, setActiveDetailTab] = useState('📌 بيانات أساسية');
  const [managingField, setManagingField] = useState(null);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isCaseTasksModalOpen, setIsCaseTasksModalOpen] = useState(false);
  const [isViewingTaskModalOpen, setIsViewingTaskModalOpen] = useState(false);
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
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Track Recently Viewed Cases
  React.useEffect(() => {
    if (caseData?.id) {
      try {
        const stored = localStorage.getItem('recentlyViewedCases');
        let viewed = stored ? JSON.parse(stored) : [];
        viewed = viewed.filter(id => id !== caseData.id);
        viewed.unshift(caseData.id);
        if (viewed.length > 50) viewed = viewed.slice(0, 50);
        localStorage.setItem('recentlyViewedCases', JSON.stringify(viewed));
      } catch (e) {
        console.error('Error saving recently viewed case', e);
      }
    }
  }, [caseData?.id]);

  // Auto-migration for legacy sessions
  React.useEffect(() => {
    if (caseData?.id && (!caseData.sessions || caseData.sessions.length === 0)) {
      const getFieldValue = (obj, keys) => {
        for (let key of keys) {
          if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') return obj[key];
        }
        return '';
      };
      
      const lastSessionRaw = getFieldValue(caseData, ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة']);
      const decision = getFieldValue(caseData, ['القرار', 'قرار الجلسة', 'المنطوق']);
      const caseRoll = getFieldValue(caseData, ['الرول']);
      const sessionType = getFieldValue(caseData, ['نوع الجلسة', 'نوع_الجلسة']);
      
      if (lastSessionRaw || decision) {
        // We have legacy flat fields but no sessions array, perform migration
        const migratedSession = {
          id: Date.now().toString() + '_migrated',
          date: lastSessionRaw || new Date().toISOString().split('T')[0],
          decision: decision || '',
          roll: caseRoll || '',
          type: sessionType || '',
          notes: 'جلسة مستوردة تلقائياً من البيانات القديمة',
          createdAt: new Date().toISOString()
        };
        saveCaseToFirebase(caseData.id, { sessions: [migratedSession] });
      }
    }
  }, [caseData, caseData?.id, saveCaseToFirebase]);

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

  // Defendants state
  const [newDefName, setNewDefName] = useState('');
  const [activeDefId, setActiveDefId] = useState(null);

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

  const caseStats = React.useMemo(() => calculateDashboardStats(caseData ? [caseData] : [], settings), [caseData, settings]);

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
  
  const legacyAppellee = getFieldValue(caseData, ['المدعى_عليه', 'المدعى عليه', 'المطعون ضده', 'المطعون']);
  const legacyAddress = getFieldValue(caseData, ['عنوان المدعى عليه', 'عنوان المطعون ضده']);
  const legacyChosenAddress = getFieldValue(caseData, ['المقر المختار']);
  
  const effectiveDefendants = (caseData.defendantsList && caseData.defendantsList.length > 0) 
    ? caseData.defendantsList 
    : ((legacyAppellee || legacyAddress || legacyChosenAddress) 
        ? [{ id: 'legacy', name: legacyAppellee || '', address: legacyAddress || '', chosenAddress: legacyChosenAddress || '' }] 
        : []);
        
  const appellee = effectiveDefendants.length > 0 ? effectiveDefendants.map(d => d.name).join(' وآخرين') : '';
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

  const dynamicAlerts = caseStats.alerts;

  const coverImageDoc = (caseData.documents || []).find(doc => doc.type === 'غلاف الملف' && doc.fileType === 'image');
  const coverImageUrl = coverImageDoc ? coverImageDoc.url : null;

  const handleSaveSessionEdit = async (idx) => {
    const newSessions = [...caseData.sessions];
    newSessions[idx] = { ...newSessions[idx], ...editSessionData };
    // Sort descending by date
    newSessions.sort((a, b) => getSafeDateObj(b.date) - getSafeDateObj(a.date));

    const updateData = { sessions: newSessions };

    const sessionKey = Object.keys(caseData).find(k => k === 'آخر جلسة' || k === 'تاريخ الجلسة' || k === 'أخر جلسة') || 'آخر جلسة';
    const decisionKey = Object.keys(caseData).find(k => k === 'القرار' || k === 'قرار الجلسة' || k === 'المنطوق') || 'القرار';
    const rollKey = Object.keys(caseData).find(k => k === 'الرول') || 'الرول';
    const typeKey = Object.keys(caseData).find(k => k === 'نوع الجلسة' || k === 'نوع_الجلسة') || 'نوع الجلسة';

    if (newSessions.length > 0) {
      updateData[sessionKey] = newSessions[0].date;
      updateData[decisionKey] = newSessions[0].decision || '';
      updateData[rollKey] = newSessions[0].roll || '';
      updateData[typeKey] = newSessions[0].type || '';
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
    .sort((a, b) => getSafeDateObj(b.date) - getSafeDateObj(a.date))[0];

  const litigationStage = calculateLitigationStage(caseData, caseData.sessions || []);
  const caseDecision = caseData['القرار'] || '';
  const isWaqfGazai = caseDecision.includes('وقف جزائي') || litigationStage.includes('موقوف جزائياً') || latestJudgmentSession?.judgment?.result?.includes('وقف جزائي') || latestJudgmentSession?.judgment?.category?.includes('وقف جزائي');

  let finalStampData = latestJudgmentSession ? latestJudgmentSession.judgment : null;
  if (!finalStampData && isWaqfGazai) {
    finalStampData = { type: 'حكم إجرائي', result: 'وقف جزائي' };
  }

  let stampColor = 'indigo';

  if (finalStampData) {
    const res = finalStampData.result || '';
    if (res.includes('ضد') || res.includes('إجرائي خطير') || (isAppellant && (res.includes('وقف جزائي') || res.includes('اعتبار')))) {
      stampColor = 'rose';
    } else if (res.includes('صالح') || (isAppellee && (res.includes('وقف جزائي') || res.includes('اعتبار')))) {
      stampColor = 'emerald';
    } else if (res.includes('مختلط')) {
      stampColor = 'amber';
    } else if (res.includes('لا شأن') || isNoInterest) {
      stampColor = 'slate';
    }
  }
  const content = (
    <div className={`space-y-4 mx-auto pb-6 animate-in fade-in zoom-in-95 duration-300 ${isModal ? 'max-w-full' : 'max-w-3xl'}`}>
      {/* Header */}
      <div className={`bg-white border-b border-slate-200 sticky top-0 z-50 px-4 py-3 shadow-sm flex items-center justify-between no-print ${isModal ? 'rounded-t-3xl' : ''}`}>
        <button
          onClick={isModal ? onCloseModal : () => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition active:scale-95"
        >
          {isModal ? <X className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
        </button>

        <div className="flex-1 text-center font-black text-sm text-navy-900 mx-2 truncate">
          تفاصيل الدعوى
        </div>

        <button
          onClick={() => navigate(`/case/${id}/report`)}
          className="w-10 h-10 ml-2 rounded-xl bg-indigo-50 text-indigo-600 shadow-sm flex items-center justify-center transition hover:bg-indigo-100"
          title="طباعة التقرير الفردي"
        >
          <Printer className="w-5 h-5" />
        </button>

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
                  onClick={() => {
                    const baseEditData = { ...caseData };
                    if (!baseEditData.defendantsList || baseEditData.defendantsList.length === 0) {
                      baseEditData.defendantsList = JSON.parse(JSON.stringify(effectiveDefendants));
                    }
                    setEditData(baseEditData);
                    setIsEditing(true);
                  }}
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

      {/* Dynamic Alerts Banner */}
      {dynamicAlerts.length > 0 && (
        <div className="mx-4 sm:mx-0 flex flex-col gap-2">
          {dynamicAlerts.map((alert, idx) => (
            <div key={idx} className="bg-rose-50 border border-rose-200 rounded-xl p-3 shadow-sm flex items-start gap-3 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500 opacity-5 rounded-bl-full pointer-events-none"></div>
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 relative z-10" />
              <div className="relative z-10">
                <h4 className="font-black text-rose-900 text-sm mb-1">
                  تنبيه إجرائي: {alert.ruleName}
                </h4>
                <p className="text-xs font-bold text-rose-700">
                  لقد مر {alert.daysPassed} يوم. متبقي {alert.daysLeft} يوم. يرجى الانتباه!
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

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

        {/* Judgment Ribbon (Top Left physically) */}
        {finalStampData && !isNoInterest && (
          <div className={`absolute top-5 -left-9 w-36 -rotate-45 text-center py-1.5 shadow-md z-40 bg-${stampColor}-600 text-white`}>
            <div className="text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 mt-0.5">{finalStampData.type || 'حكم'}</div>
          </div>
        )}

        {/* File Location Ribbon (Top Right physically) */}
        {fileLocation && fileLocation !== 'في المكتب' && (
          <div className={`absolute top-5 -right-9 w-36 rotate-45 text-center py-1.5 shadow-md z-40 ${
            fileLocation === 'غير موجود' ? 'bg-rose-600 text-white' :
            fileLocation === 'مؤقت' ? 'bg-amber-500 text-white' :
            fileLocation === 'خارج الاختصاص' ? 'bg-indigo-600 text-white' :
            'bg-slate-700 text-white'
          }`}>
            <div className="text-[11px] font-black leading-none">{fileLocation}</div>
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
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shadow-sm flex items-center gap-1 ${litigationStage === 'استعلام' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                litigationStage.includes('موقوف جزائياً') ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' :
                  litigationStage === 'شعبة المحال' || litigationStage === 'شعبة الأحكام' || litigationStage === 'الشعبة' ? 'bg-slate-100 text-slate-700 border-slate-300' :
                    'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
              <CheckCircle2 className="w-3 h-3" />
              {litigationStage}
            </div>
            {/* Small File Location Icon Button */}
            {fileLocation ? (
              <button
                onClick={() => { setNewLocation(fileLocation); setIsChangeLocationModalOpen(true); }}
                className={`w-7 h-7 flex items-center justify-center rounded-lg border shadow-sm transition ${
                  fileLocation === 'غير موجود' ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 animate-pulse' :
                  fileLocation === 'مؤقت' ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' :
                  fileLocation === 'في المكتب' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' :
                  fileLocation.includes('شعبة') ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100' :
                  'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                }`}
                title={`مكان الملف: ${fileLocation} (انقر للتغيير)`}
              >
                {fileLocation === 'غير موجود' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                 fileLocation === 'مؤقت' ? <Files className="w-3.5 h-3.5" /> :
                 fileLocation === 'في المكتب' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 fileLocation.includes('شعبة') ? <FolderOpen className="w-3.5 h-3.5" /> :
                 <MapPin className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <button
                onClick={() => { setNewLocation(''); setIsChangeLocationModalOpen(true); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg border bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600 transition shadow-sm"
                title="تحديد مكان الملف"
              >
                <MapPin className="w-3.5 h-3.5" />
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
                  <Files className="w-4 h-4" /> منضمة
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

            {/* Viewing Task Button */}
            <button
              onClick={() => {
                const hasViewingTask = globalTasks?.some(t => t.type === 'viewing' && t.status !== 'completed' && t.linkedCases?.includes(caseData.id));
                if (hasViewingTask) {
                  toast('تم العثور على مهمة إطلاع حالية، جاري فتح سجل المهام...', 'success');
                  setIsCaseTasksModalOpen(true);
                } else {
                  setIsViewingTaskModalOpen(true);
                }
              }}
              className="relative p-2 rounded-xl transition bg-indigo-50 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
              title="إنشاء مهمة إطلاع جديدة"
            >
              <Camera className="w-5 h-5" />
            </button>

            {/* Case Task Button */}
            <button
              onClick={() => setIsCaseTasksModalOpen(true)}
              className="relative p-2 rounded-xl transition bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-indigo-600"
              title="إدارة مهام وسجل إجراءات هذا الملف"
            >
              <ClipboardList className="w-5 h-5" />
            </button>

            {/* Procedures Modal Button */}
            <button
              onClick={() => setIsProceduresModalOpen(true)}
              className="relative p-2 rounded-xl transition bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-indigo-600"
              title="سجل الإجراءات"
            >
              <History className="w-5 h-5" />
            </button>

            {/* Alerts Button in Header */}
            <button
              onClick={() => setIsAlertsOpen(true)}
              className={`relative p-2 rounded-xl transition ${caseData.alerts && caseData.alerts.some(a => !a.isDone)
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
        <CaseInfoTab
          activeDetailTab={activeDetailTab}
          setActiveDetailTab={setActiveDetailTab}
          schema={schema}
          editData={editData}
          setEditData={setEditData}
          isEditing={isEditing}
          settings={settings}
          cases={cases}
          effectiveDefendants={effectiveDefendants}
          activeDefId={activeDefId}
          setActiveDefId={setActiveDefId}
          newDefName={newDefName}
          setNewDefName={setNewDefName}
          newJoinedNo={newJoinedNo}
          setNewJoinedNo={setNewJoinedNo}
          newJoinedYear={newJoinedYear}
          setNewJoinedYear={setNewJoinedYear}
          caseData={caseData}
          handleAddUrgentReminder={handleAddUrgentReminder}
          setManagingField={setManagingField}
          isEmptyValue={isEmptyValue}
          legacyJoinedStr={legacyJoinedStr}
        />
)}

      {/* Tab Content: Sessions */}
      {activeTab === 'sessions' && (
        <SessionsTab
          caseData={caseData}
          canEditData={canEditData}
          settings={settings}
          rolls={rolls}
          sessionTypeOptions={sessionTypeOptions}
          isAddSessionOpen={isAddSessionOpen}
          setIsAddSessionOpen={setIsAddSessionOpen}
          fileInputRef={fileInputRef}
          handleSessionFileUpload={handleSessionFileUpload}
          editingSessionIdx={editingSessionIdx}
          setEditingSessionIdx={setEditingSessionIdx}
          editSessionData={editSessionData}
          setEditSessionData={setEditSessionData}
          activeSessionIdx={activeSessionIdx}
          setActiveSessionIdx={setActiveSessionIdx}
          isUploadingSessionFile={isUploadingSessionFile}
          activeJudgmentSessionIdx={activeJudgmentSessionIdx}
          setActiveJudgmentSessionIdx={setActiveJudgmentSessionIdx}
          activeNoteSessionIdx={activeNoteSessionIdx}
          setActiveNoteSessionIdx={setActiveNoteSessionIdx}
          handleSaveSessionEdit={handleSaveSessionEdit}
          openRollViewer={openRollViewer}
          saveCaseToFirebase={saveCaseToFirebase}
          showConfirm={showConfirm}
          toast={toast}
          showPrompt={showPrompt}
        />
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

      {/* Viewing Task Modal */}
      {isViewingTaskModalOpen && (
        <BulkViewingTaskModal
          isOpen={isViewingTaskModalOpen}
          onClose={() => setIsViewingTaskModalOpen(false)}
          selectedCaseIds={new Set([caseData.id])}
          cases={cases}
        />
      )}

      {/* Case Tasks Modal */}
      <CaseTasksModal
        isOpen={isCaseTasksModalOpen}
        onClose={() => setIsCaseTasksModalOpen(false)}
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
                    if (newRole === role) {
                      setIsChangeRoleModalOpen(false); return;
                    }
                    const confirmed = await showConfirm('تأكيد التعديل', `هل أنت متأكد من تغيير تصنيف الدعوى إلى "${newRole}"؟`, 'change_role');
                    if (confirmed) {
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
                      const archiveLocs = settings?.archiveLocations || ['شعبة الحفظ', 'الحفظ', 'حفظ'];
                      if (archiveLocs.includes(newLocation)) {
                        // Verify if case has judgment
                        const decision = String(caseData['القرار'] || caseData['قرار الجلسة'] || caseData['المنطوق'] || '');
                        const hasJudgment = decision.includes('حكم') || decision.includes('للحكم') || (caseData.sessions && caseData.sessions.some(s => s.judgment));
                        if (!hasJudgment) {
                          toast("لا يمكن حفظ قضية لم يصدر فيها حكم!", "error");
                          return;
                        }
                      }
                      const locField = schema.find(f => f.id === 'مكان الملف') ? 'مكان الملف' : 'مكان الملف';
                      await saveCaseToFirebase(caseData.id, { [locField]: newLocation });
                      setEditData(prev => ({ ...prev, [locField]: newLocation }));
                      toast("تم تحديث مكان الملف بنجاح", "success");
                      setIsChangeLocationModalOpen(false);
                    } catch (e) {
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

      {/* Floating Document Button */}
      <button
        onClick={() => setIsPrintModalOpen(true)}
        className="fixed bottom-24 left-6 md:left-12 w-14 h-14 bg-indigo-500 text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-indigo-600 hover:-translate-y-1 transition-all z-40 print:hidden animate-in fade-in zoom-in"
        title="إنشاء وثائق"
      >
        <FileText className="w-6 h-6" />
      </button>

      {/* Floating Documents Tab Button */}
      <button
        onClick={() => {
          setActiveTab('documents');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="fixed bottom-6 left-6 md:left-12 w-14 h-14 bg-amber-500 text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-amber-600 hover:-translate-y-1 transition-all z-40 print:hidden animate-in fade-in zoom-in"
        title="مجلد المستندات والمرفقات"
      >
        <FolderOpen className="w-6 h-6" />
      </button>

      {/* Document Print Modal */}
      {isPrintModalOpen && (
        <GlobalTemplatePrintModal
          cases={[caseData]}
          sessionDate={formatDateString(new Date().toISOString())}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {managingField && (
        <FieldOptionsManager
          fieldKey={managingField}
          isOpen={true}
          onClose={() => setManagingField(null)}
        />
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-slate-50 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-y-auto custom-scrollbar relative">
           {content}
        </div>
      </div>
    );
  }

  return content;
}
