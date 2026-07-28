import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Edit3, X, Gavel, Trash2, CalendarPlus, ClipboardList, CheckCircle2, Bell, AlertTriangle, FileText, ExternalLink, BookOpen } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import AddSessionModal from '../components/AddSessionModal';
import CaseDocuments from '../components/CaseDocuments';
import AlertsModal from '../components/AlertsModal';
import { formatDateString, getSafeDateObj } from '../utils/dateUtils';

export default function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cases, schema, isAdmin, saveCaseToFirebase, settings, rolls } = useAppContext();
  const { toast, showConfirm, openRollViewer } = useUI();

  // In the new architecture, id is the document id, not the array index.
  const caseData = cases.find(c => c.id === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(caseData || {});
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'documents' | 'sessions' | 'tasks'
  
  // Task state
  const [newTask, setNewTask] = useState({ assignee: '', title: '' });
  const [isAddingTask, setIsAddingTask] = useState(false);

  // Extract unique values for autocomplete
  const defaultDecisions = settings?.decisions || [];
  const uniqueCourts = [...new Set(cases.map(c => c['المحكمة']).filter(Boolean))];

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
  const role = getFieldValue(caseData, ['الصفة', 'صفة']) || '';
  const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
  const isJudgment = String(decision).includes('حكم') || String(decision).includes('للحكم');

  const coverImageDoc = (caseData.documents || []).find(doc => doc.type === 'غلاف الملف' && doc.fileType === 'image');
  const coverImageUrl = coverImageDoc ? coverImageDoc.url : null;

  const handleSave = async () => {
    if (!isAdmin) return;
    try {
      await saveCaseToFirebase(caseData.id, editData);
      setIsEditing(false);
      toast("تم حفظ التعديلات بنجاح!", "success");
    } catch (error) {
      console.error(error);
      toast("حدث خطأ أثناء الحفظ.", "error");
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
            <button 
              onClick={() => setIsEditing(true)}
              className="w-10 h-10 rounded-xl bg-navy-900 text-amber-300 shadow-sm flex items-center justify-center transition"
            >
              <Edit3 className="w-4 h-4" />
            </button>
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
            <div className={`absolute top-0 left-0 w-full h-1 ${isAppellant ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
          </div>
        ) : (
          <div className={`h-2 w-full ${isAppellant ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
        )}
        
        <div className={`text-center space-y-4 ${coverImageUrl ? 'p-5 pt-2' : 'p-5'}`}>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
             {role && (
               <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${isAppellant ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                 {role}
               </span>
             )}
             {isJudgment && (
               <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 shadow-sm flex items-center gap-1">
                 ⚖️ للحكم
               </span>
             )}
          </div>
          
          <div className="flex items-center gap-3 justify-center mt-1">
            <h1 className="text-2xl sm:text-3xl font-black text-navy-900">
              دعوى رقم {caseNo} <span className="text-slate-400 font-bold text-lg">لسنة</span> {year}
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
             <span className={`text-sm sm:text-base ${isAppellant ? 'text-blue-700 font-black' : 'text-navy-900 font-bold'}`}>
               {appellant || '---'}
             </span>
             <span className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-slate-400 text-[10px] font-black shrink-0">
               X
             </span>
             <span className={`text-sm sm:text-base ${!isAppellant ? 'text-amber-700 font-black' : 'text-navy-900 font-bold'}`}>
               {appellee || '---'}
             </span>
          </div>

          {(decision || lastSession) && (
            <div className={`mt-3 p-3 rounded-xl border flex flex-row items-center justify-center gap-4 flex-wrap ${isJudgment ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-amber-50/50 border-amber-100 text-amber-800'}`}>
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
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${activeTab === 'tasks' ? 'bg-navy-900 text-amber-300 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <ClipboardList className="w-4 h-4" /> المهام
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

        {/* Dynamic Fields from Schema */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {schema.filter(f => {
             const hiddenFields = ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى', 'السنة', 'سنة', 'year', 'المدعي', 'الطاعن', 'المستأنف', 'المدعى_عليه', 'المدعى عليه', 'المطعون ضده', 'المطعون', 'آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة', 'القرار', 'قرار الجلسة', 'المنطوق', 'الصفة', 'صفة', 'المقر المختار', 'عنوان المدعى عليه'];
             return f.visible && !hiddenFields.includes(f.id);
          }).map((field) => {
            const val = editData[field.id] || '';
            if (!isEditing && (val === null || val === '')) return null;

            const isDateField = field.type === 'date' || field.id.includes('تاريخ') || field.id.includes('جلسة');
            const displayVal = isDateField ? formatDateString(val) : val;
            
            let colSpan = 'md:col-span-2';
            if (field.id === 'الرول' || field.id.includes('رقم') || field.id === 'السنة') colSpan = 'md:col-span-1 col-span-2';
            else if (isDateField || field.id.includes('محكمة') || field.id.includes('دائرة')) colSpan = 'md:col-span-1 col-span-2';
            else if (field.id === 'مكان الملف' || field.type === 'textarea' || field.id.includes('ملاحظات')) colSpan = 'md:col-span-4 col-span-4';
            else if (field.id === 'الصفة' || field.id === 'صفة' || field.id === 'القرار') colSpan = 'md:col-span-4 col-span-4';

            return (
              <div key={field.id} className={`space-y-1.5 ${colSpan}`}>
                <label className="text-[11px] font-black text-slate-500 block">{field.label}</label>
                {isEditing ? (
                  field.id === 'الصفة' || field.id === 'صفة' ? (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {['طاعن', 'مطعون ضده', 'خصم مدخل'].map(opt => (
                        <button 
                          key={opt}
                          type="button" 
                          onClick={() => setEditData({...editData, [field.id]: opt})} 
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${val === opt ? (opt === 'طاعن' ? 'bg-rose-500 text-white' : opt === 'مطعون ضده' ? 'bg-emerald-500 text-white' : 'bg-navy-900 text-white') : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : field.id === 'القرار' && settings?.decisions ? (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {settings.decisions.slice(0, 10).map(opt => (
                        <button 
                          key={opt}
                          type="button" 
                          onClick={() => setEditData({...editData, [field.id]: opt})} 
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${val === opt ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {opt}
                        </button>
                      ))}
                      <input 
                        type="text" 
                        placeholder="أو اكتب قرار آخر..."
                        value={!settings.decisions.includes(val) && val ? val : ''}
                        onChange={(e) => setEditData({...editData, [field.id]: e.target.value})}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
                      />
                    </div>
                  ) : field.id === 'نوع الجلسة' ? (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {['فحص', 'موضوع', 'حكم', 'خبير'].map(opt => (
                        <button 
                          key={opt}
                          type="button" 
                          onClick={() => setEditData({...editData, [field.id]: opt})} 
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${val === opt ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : field.id === 'مكان الملف' ? (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {['غير موجود', 'أصلي', 'مؤقت', 'شعبة الحفظ', 'شعبة الشغل', 'الأحكام', 'في البيت'].map(opt => (
                        <button 
                          key={opt}
                          type="button" 
                          onClick={() => setEditData({...editData, [field.id]: opt})} 
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${val === opt ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {opt}
                        </button>
                      ))}
                      {/* Allow custom input if they type something not in the options */}
                      <input 
                        type="text" 
                        placeholder="أو اكتب مكان آخر..."
                        value={!['غير موجود', 'أصلي', 'مؤقت', 'شعبة الحفظ', 'شعبة الشغل', 'الأحكام', 'في البيت'].includes(val) ? val : ''}
                        onChange={(e) => setEditData({...editData, [field.id]: e.target.value})}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
                      />
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea 
                      value={val}
                      onChange={(e) => setEditData({...editData, [field.id]: e.target.value})}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 resize-none mt-1"
                    />
                  ) : field.type === 'date' || field.id.includes('تاريخ') || field.id.includes('جلسة') ? (
                    <input 
                      type="date"
                      value={val && getSafeDateObj(val) ? getSafeDateObj(val).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditData({...editData, [field.id]: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 mt-1"
                    />
                  ) : (
                    <>
                      <input 
                        type="text"
                        value={val}
                        list={`list-${field.id}`}
                        onChange={(e) => setEditData({...editData, [field.id]: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 mt-1"
                      />
                      {(field.id === 'القرار' || field.id === 'قرار الجلسة' || field.id === 'المنطوق') && (
                        <div className="mt-2">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {defaultDecisions.map((opt, i) => (
                              <button 
                                key={i}
                                type="button" 
                                onClick={() => setEditData({...editData, [field.id]: opt})} 
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${val === opt ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          <datalist id={`list-${field.id}`}>
                            {defaultDecisions.map((opt, i) => <option key={i} value={opt} />)}
                          </datalist>
                        </div>
                      )}
                      {(field.id === 'المحكمة' || field.id === 'الدائرة') && (
                        <datalist id={`list-${field.id}`}>
                          {uniqueCourts.map((opt, i) => <option key={i} value={opt} />)}
                        </datalist>
                      )}
                    </>
                  )
                ) : (
                  <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 whitespace-pre-wrap break-words min-h-[42px] mt-1" dir={isDateField ? "ltr" : "auto"}>
                    {displayVal}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Additional Secondary Fields */}
        <div className="pt-6 border-t border-slate-100 mt-4">
          <h3 className="text-xs font-black text-slate-400 mb-3">بيانات إضافية:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schema.filter(f => ['المقر المختار', 'عنوان المدعى عليه'].includes(f.id)).map(field => {
              const val = editData[field.id] || '';
              if (!isEditing && (val === null || val === '')) return null;
              
              return (
                <div key={field.id} className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-500 block">{field.label}</label>
                  {isEditing ? (
                    <input 
                      type="text"
                      value={val}
                      onChange={(e) => setEditData({...editData, [field.id]: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
                    />
                  ) : (
                    <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 whitespace-pre-wrap break-words min-h-[42px]">
                      {val}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Custom fields not in schema (legacy/extra) */}
        {isEditing && (
          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-xs font-black text-slate-400 mb-3">حقول إضافية غير مسجلة في الهيكلة:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.keys(editData).filter(k => k !== 'id' && k !== 'sessions' && !schema.find(s => s.id === k)).map(key => (
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
              {caseData.sessions.map((session, idx) => (
                <div key={session.id || idx} className="relative">
                  <div className="absolute -right-[23px] top-1 w-4 h-4 rounded-full bg-white border-2 border-amber-500 z-10"></div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm relative mr-2 transition hover:shadow-md">
                     <span className="absolute top-4 left-4 text-[10px] font-black text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100" dir="ltr">
                        {session.date}
                     </span>
                     <h4 className="text-sm font-black text-navy-900 mb-2">{session.decision || 'بدون قرار'}</h4>
                     
                     {/* Check for matching rolls */}
                     {(() => {
                        const matchingRolls = rolls.filter(r => r.date === session.date);
                        if (matchingRolls.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-2 mt-2 mb-2">
                            <button
                                onClick={() => openRollViewer(session.date)}
                                className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                            >
                                <FileText className="w-3 h-3" /> عرض الرول
                            </button>
                          </div>
                        );
                     })()}

                     {session.notes && (
                       <p className="text-xs font-bold text-slate-600 bg-white p-2 rounded-lg border border-slate-100 mt-2 whitespace-pre-wrap">
                         {session.notes}
                       </p>
                     )}
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
                         className="mt-2 text-[10px] font-bold text-rose-500 hover:text-rose-700"
                       >
                         حذف الجلسة
                       </button>
                     )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Tab Content: Tasks */}
      {activeTab === 'tasks' && (
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
               <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-lg text-navy-900">المهام والتكليفات</h2>
              <p className="text-[11px] text-slate-500 font-bold">إسناد المهام للموظفين ومتابعتها</p>
            </div>
          </div>
        </div>

        <div className="pt-2 space-y-4">
          {(!caseData.tasks || caseData.tasks.length === 0) ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
               <p className="text-xs font-bold text-slate-500">لا توجد مهام مسندة في هذا الملف.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {caseData.tasks.map((task, idx) => (
                <div key={task.id || idx} className={`p-4 rounded-xl border ${task.status === 'completed' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-100 mb-2 inline-block">
                        المكلف: {task.assignee}
                      </span>
                      <h4 className={`text-sm font-black ${task.status === 'completed' ? 'text-emerald-900 line-through opacity-70' : 'text-navy-900'}`}>
                        {task.title}
                      </h4>
                    </div>
                    {task.status === 'completed' ? (
                      <div className="flex items-center gap-1 text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" /> تم التنفيذ
                      </div>
                    ) : (
                      <div className="text-amber-600 bg-amber-50 px-2 py-1 rounded-md text-[10px] font-bold border border-amber-200">
                        قيد التنفيذ
                      </div>
                    )}
                  </div>
                  {task.notes && (
                    <p className="text-xs font-bold text-slate-600 bg-white p-2 rounded-lg border border-slate-100 mt-2">
                      ملاحظة التنفيذ: {task.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
              <h4 className="text-xs font-black text-navy-900 mb-3">إسناد مهمة جديدة:</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <select 
                  value={newTask.assignee} 
                  onChange={e => setNewTask({...newTask, assignee: e.target.value})}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 flex-[1]"
                >
                  <option value="">اختر الموظف...</option>
                  {settings?.employees?.map(emp => (
                    <option key={emp.name} value={emp.name}>{emp.name}</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  placeholder="وصف المهمة (مثال: تصوير الملف، إعلان الصحيفة...)" 
                  value={newTask.title}
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 flex-[3]"
                />
                <button 
                  onClick={async () => {
                    if(!newTask.assignee || !newTask.title) {
                      toast('يرجى اختيار الموظف وكتابة وصف المهمة.', 'error');
                      return;
                    }
                    setIsAddingTask(true);
                    const taskObj = {
                      id: Date.now().toString(),
                      assignee: newTask.assignee,
                      title: newTask.title,
                      status: 'pending',
                      notes: '',
                      createdAt: new Date().toISOString()
                    };
                    const updatedTasks = [...(caseData.tasks || []), taskObj];
                    await saveCaseToFirebase(caseData.id, { tasks: updatedTasks });
                    setNewTask({ assignee: '', title: '' });
                    setIsAddingTask(false);
                  }}
                  disabled={isAddingTask}
                  className="bg-navy-900 text-white font-bold px-4 py-2 rounded-xl text-xs flex-[1] disabled:opacity-50"
                >
                  {isAddingTask ? 'جاري الحفظ...' : 'حفظ وإسناد'}
                </button>
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

      {/* Alerts Modal */}
      <AlertsModal
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        caseData={caseData}
      />


    </div>
  );
}
