import React, { useState, useMemo } from 'react';
import { X, Save, Plus, Check, Trash2, MapPin, Settings2 } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { useNavigate } from 'react-router-dom';
import SmartAutocomplete from './SmartAutocomplete';
import FieldOptionsManager from './FieldOptionsManager';
import StrictSelectField from './StrictSelectField';
import * as CASE_FIELDS from '../constants/caseFields';

export default function AddCaseModal({ isOpen, onClose }) {
  const { schema, createNewCase, cases, saveCaseToFirebase, settings } = useAppContext();
  const { toast } = useUI();
  const [formData, setFormData] = useState({
    joinedCasesList: [],
    defendantsList: []
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('📌 بيانات أساسية');
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [createdCaseId, setCreatedCaseId] = useState(null);
  const [customLocation, setCustomLocation] = useState('');
  const [newDefName, setNewDefName] = useState('');
  const [newPlaintName, setNewPlaintName] = useState('');
  const [activeDefId, setActiveDefId] = useState(null);
  const [newJoinedNo, setNewJoinedNo] = useState('');
  const [newJoinedYear, setNewJoinedYear] = useState('');
  const [managingField, setManagingField] = useState(null);
  const navigate = useNavigate();

  const currentCourtDegree = settings?.courtDegree || 'أول درجة';
  const isSupreme = currentCourtDegree === 'ثان درجة' || currentCourtDegree === 'عليا';
  const sessionTypeOptions = isSupreme ? ['فحص', 'موضوع'] : ['مفوضين', 'مرافعة'];

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const dataToSave = { ...formData };
    
    if (dataToSave.defendantsList && dataToSave.defendantsList.length > 0) {
      const names = dataToSave.defendantsList.map(d => d.name).filter(Boolean);
      const combined = names.length > 1 ? `${names[0]} وآخرين` : names[0] || '';
      dataToSave['المطعون ضده'] = combined;
      const firstWithAddress = dataToSave.defendantsList.find(d => d.address);
      if (firstWithAddress) dataToSave['عنوان المدعى عليه'] = firstWithAddress.address;
      const firstWithChosenAddress = dataToSave.defendantsList.find(d => d.chosenAddress);
      if (firstWithChosenAddress) dataToSave['المقر المختار'] = firstWithChosenAddress.chosenAddress;
    }
    
    if (dataToSave.plaintiffsList && dataToSave.plaintiffsList.length > 0) {
      const pNames = dataToSave.plaintiffsList.map(p => p.name).filter(Boolean);
      const pCombined = pNames.length > 1 ? `${pNames[0]} وآخرين` : pNames[0] || '';
      dataToSave['المدعي'] = pCombined;
    }
    

    
    if (dataToSave.joinedCasesList && dataToSave.joinedCasesList.length > 0) {
       dataToSave['دعاوى منضمة'] = dataToSave.joinedCasesList.map(jc => `${jc.no} لسنة ${jc.year}`).join('، ');
    }
    try {
      const savedCaseId = await createNewCase(dataToSave);
      setIsSaving(false);
      if (savedCaseId) {
        if (dataToSave['مكان الملف'] && String(dataToSave['مكان الملف']).trim() !== '') {
          // User already selected the location in the form, skip the prompt
          toast("تمت إضافة القضية بنجاح!", "success");
          setFormData({});
          onClose();
        } else {
          setCreatedCaseId(savedCaseId);
          setShowLocationPrompt(true);
          toast("تمت إضافة القضية بنجاح!", "success");
        }
      } else {
        toast("حدث خطأ أثناء حفظ القضية", "error");
      }
    } catch (error) {
      setIsSaving(false);
      if (error.message === 'DUPLICATE_CASE') {
        toast("هذه الدعوى مسجلة بالفعل (رقم الدعوى والسنة مكرران)", "error");
      } else {
        toast("حدث خطأ غير متوقع", "error");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-amber-300">
            <Plus className="w-5 h-5" />
            <h2 className="font-black text-lg">إضافة قضية جديدة</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {showLocationPrompt ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner mb-2">
                <Check className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-navy-900">تم الحفظ بنجاح!</h2>
              <p className="text-slate-500 font-bold text-lg">{settings?.userTitle === 'المستشارة' ? 'أين الملف الآن معاليكي؟' : 'أين الملف الآن معاليك؟'}</p>
              
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {Array.from(new Set([...(settings?.fileLocations || []), 'في المكتب', 'بالمحكمة', 'غير موجود', 'مؤقت', 'خارج الاختصاص'])).map(loc => (
                  <button 
                    key={loc}
                    onClick={async () => {
                      setIsSaving(true);
                      await saveCaseToFirebase(createdCaseId, { 'مكان الملف': loc });
                      setIsSaving(false);
                      toast("تم تحديث مكان الملف بنجاح!", "success");
                      setFormData({});
                      setShowLocationPrompt(false);
                      onClose();
                    }}
                    className={`px-4 py-3 rounded-xl font-bold text-sm shadow-sm transition hover:-translate-y-1 ${loc === 'غير موجود' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : loc === 'مؤقت' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : loc === 'خارج الاختصاص' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {loc}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-4 w-full max-w-sm">
                <input 
                  type="text" 
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="مكان آخر..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                />
                <button
                  onClick={async () => {
                    if (!customLocation.trim()) return;
                    setIsSaving(true);
                    await saveCaseToFirebase(createdCaseId, { 'مكان الملف': customLocation.trim() });
                    setIsSaving(false);
                    toast("تم تحديث مكان الملف بنجاح!", "success");
                    setFormData({});
                    setShowLocationPrompt(false);
                    setCustomLocation('');
                    onClose();
                  }}
                  disabled={!customLocation.trim() || isSaving}
                  className="bg-navy-900 text-amber-300 px-4 py-3 rounded-xl font-bold hover:bg-navy-800 transition disabled:opacity-50"
                >
                  حفظ
                </button>
              </div>
              
              <button 
                onClick={() => {
                  setFormData({});
                  setShowLocationPrompt(false);
                  onClose();
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold transition mt-4"
              >
                تخطي ومتابعة لاحقاً
              </button>
            </div>
          ) : (
          <form id="add-case-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Tabs Header */}
              <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide">
                {[
                  {
                    title: '📌 بيانات أساسية',
                    colorClass: 'text-blue-700 bg-blue-50/50 border-blue-100',
                    keys: [...CASE_FIELDS.CASE_NO_KEYS, ...CASE_FIELDS.YEAR_KEYS, 'دعاوى منضمة', 'المحكمة', 'الدائرة', ...CASE_FIELDS.APPELLANT_KEYS, ...CASE_FIELDS.APPELLEE_KEYS, 'الخصوم', 'مطعون ضدهم آخرين', ...CASE_FIELDS.ROLE_KEYS, ...CASE_FIELDS.LOCATION_KEYS]
                  },
                  {
                    title: '⚖️ الجلسة والقرار',
                    colorClass: 'text-amber-700 bg-amber-50/50 border-amber-100',
                    keys: [...CASE_FIELDS.SESSION_DATE_KEYS, ...CASE_FIELDS.ROLL_KEYS, ...CASE_FIELDS.SESSION_TYPE_KEYS, ...CASE_FIELDS.DECISION_KEYS, 'ملاحظات']
                  },
                  {
                    title: '📑 بيانات فنية',
                    colorClass: 'text-indigo-700 bg-indigo-50/50 border-indigo-100',
                    keys: [...CASE_FIELDS.CLASSIFICATION_KEYS, ...CASE_FIELDS.SUBJECT_KEYS, 'طلبات المدعي']
                  },
                  {
                    title: '🏛️ بيانات الحكم وأخرى',
                    colorClass: 'text-rose-700 bg-rose-50/50 border-rose-100',
                    keys: [...CASE_FIELDS.COURT_FIRST_NAME_KEYS, 'رقم دعوى أول درجة', 'سنة دعوى أول درجة', 'تاريخ حكم أول درجة', 'جلسة حكم أول درجة', 'منطوق حكم أول درجة', ...CASE_FIELDS.JUDGMENT_KEYS, 'تصنيف الحكم', 'نوع الحكم', 'المنطوق', 'منطوق الحكم', 'ملخص الطعن وتفاصيله', 'ملخص الطعن', 'المقر المختار', 'عنوان المدعى عليه', 'عنوان المدعي']
                  }
                ].map((group) => (
                  <button
                    key={group.title}
                    type="button"
                    onClick={() => setActiveTab(group.title)}
                    className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-black text-xs transition-all border ${
                      activeTab === group.title
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {group.title}
                  </button>
                ))}
              </div>

              {/* Active Tab Content */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 animate-in fade-in zoom-in duration-200 min-h-[400px]">
                {[
                  {
                    title: '📌 بيانات أساسية',
                    colorClass: 'text-blue-700 bg-blue-50/50 border-blue-100',
                    keys: [...CASE_FIELDS.CASE_NO_KEYS, ...CASE_FIELDS.YEAR_KEYS, 'دعاوى منضمة', 'المحكمة', 'الدائرة', ...CASE_FIELDS.APPELLANT_KEYS, ...CASE_FIELDS.APPELLEE_KEYS, 'الخصوم', 'مطعون ضدهم آخرين', ...CASE_FIELDS.ROLE_KEYS, ...CASE_FIELDS.LOCATION_KEYS]
                  },
                  {
                    title: '⚖️ الجلسة والقرار',
                    colorClass: 'text-amber-700 bg-amber-50/50 border-amber-100',
                    keys: [...CASE_FIELDS.SESSION_DATE_KEYS, ...CASE_FIELDS.ROLL_KEYS, ...CASE_FIELDS.SESSION_TYPE_KEYS, ...CASE_FIELDS.DECISION_KEYS, 'ملاحظات']
                  },
                  {
                    title: '📑 بيانات فنية',
                    colorClass: 'text-indigo-700 bg-indigo-50/50 border-indigo-100',
                    keys: [...CASE_FIELDS.CLASSIFICATION_KEYS, ...CASE_FIELDS.SUBJECT_KEYS, 'طلبات المدعي']
                  },
                  {
                    title: '🏛️ بيانات الحكم وأخرى',
                    colorClass: 'text-rose-700 bg-rose-50/50 border-rose-100',
                    keys: [...CASE_FIELDS.COURT_FIRST_NAME_KEYS, 'رقم دعوى أول درجة', 'سنة دعوى أول درجة', 'تاريخ حكم أول درجة', 'جلسة حكم أول درجة', 'منطوق حكم أول درجة', ...CASE_FIELDS.JUDGMENT_KEYS, 'تصنيف الحكم', 'نوع الحكم', 'المنطوق', 'منطوق الحكم', 'ملخص الطعن وتفاصيله', 'ملخص الطعن', 'المقر المختار', 'عنوان المدعى عليه', 'عنوان المدعي']
                  }
                ].map((group, idx, arr) => {
                  if (group.title !== activeTab) return null;

                  const excludedFields = [...CASE_FIELDS.JUDGMENT_KEYS, 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم', ...CASE_FIELDS.ROLL_KEYS, 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي'];
                  let groupFields = schema.filter(f => f.visible && group.keys.includes(f.id));
                  
                  if (idx === arr.length - 1) {
                     const allConfiguredKeys = arr.flatMap(g => g.keys);
                     const unmappedFields = schema.filter(f => f.visible && !allConfiguredKeys.includes(f.id));
                     groupFields = [...groupFields, ...unmappedFields];
                  }
                  
                  if (groupFields.length === 0) return null;

                  return (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-5">
                         {groupFields.map(field => {
                            const val = formData[field.id] || '';
                            
                            // Smart conditional logic:
                            const currentRole = formData['الصفة'] || '';
                            const isPlaintiffRole = currentRole.includes('طاعن') || currentRole.includes('مستأنف') || currentRole.includes('مدعي');
                            const isDefendantRole = currentRole.includes('مطعون') || currentRole.includes('مدعى عليه');
                            
                            if (field.id === 'المقر المختار' && !isPlaintiffRole) return null;
                            if (field.id === 'عنوان المدعى عليه' && !isPlaintiffRole) return null;
                            if (field.id === 'عنوان المدعي' && !isDefendantRole) return null;
                            if (['السنة', 'سنة', 'year', 'دعاوى منضمة', 'مطعون ضدهم آخرين', 'المدعى_عليه', 'المدعى عليه', 'المقر المختار', 'عنوان المدعى عليه', 'عنوان المدعي', 'المدعي', 'الصفة', 'صفة'].includes(field.id)) return null;
                            
                            const isFullWidthField = field.type === 'textarea' || CASE_FIELDS.CASE_NO_KEYS.includes(field.id);
                            
                            return (
                              <div key={field.id} className={`${isFullWidthField ? 'md:col-span-2' : ''}`}>
                                {!['القرار', 'الصفة', 'مكان الملف', 'نوع الجلسة', 'تصنيف الحكم', 'نوع الحكم', ...CASE_FIELDS.CASE_NO_KEYS].includes(field.id) && (
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <label className="text-[11px] font-black text-slate-500 block">{field.label}</label>
                                  </div>
                                )}
                                {field.type === 'textarea' ? (
                                  <textarea 
                                    value={val}
                                    onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
                                    rows={3}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 resize-none transition"
                                  />
                                ) : (field.type === 'date') || field.id === 'آخر جلسة' || field.id === 'تاريخ آخر جلسة' || field.id === 'جلسة حكم أول درجة' ? (
                                  <input 
                                    type="date"
                                    value={val}
                                    onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
                                  />
                                ) : field.id === 'تصنيف الدعوى' ? (
                                   <div className="space-y-2">
                                     <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 rounded-xl">
                                        {[...(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']), 'أخرى'].map(opt => (
                                          <button 
                                            key={opt} type="button" onClick={() => setFormData({...formData, [field.id]: opt})} 
                                            className={`px-3 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === opt || (!(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']).includes(val) && val && opt === 'أخرى') ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
                                          >{opt}</button>
                                        ))}
                                     </div>
                                     {(!(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']).includes(val) || val === 'أخرى') && (
                                       <input 
                                         type="text" 
                                         placeholder="اكتب التصنيف هنا..." 
                                         value={val === 'أخرى' ? '' : val} 
                                         onChange={(e) => setFormData({...formData, [field.id]: e.target.value})} 
                                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition mt-2" 
                                       />
                                     )}
                                   </div>
                                ) : (
                                  <div>
                                    {CASE_FIELDS.CASE_NO_KEYS.includes(field.id) ? (
                                          <div className="w-full pt-5">
                                            {/* 1. Case No & Year */}
                                            <div className="grid grid-cols-12 gap-2 w-full mb-4">
                                              <div className="col-span-8 sm:col-span-6 relative">
                                                <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">رقم الدعوى</span>
                                                <SmartAutocomplete
                                                  id="رقم الدعوى"
                                                  value={formData['رقم الدعوى'] || formData['رقم القضية'] || formData['رقم_الدعوى'] || ''}
                                                  onChange={(v) => {
                                                      let finalV = v.replace(/[^\d]/g, '');
                                                      setFormData({...formData, 'رقم الدعوى': finalV});
                                                  }}
                                                  cases={cases}
                                                  fieldPaths={['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']}
                                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
                                                />
                                              </div>
                                              <div className="col-span-4 sm:col-span-6 relative">
                                                <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">السنة</span>
                                                <SmartAutocomplete
                                                  id="السنة"
                                                  value={formData['السنة'] || formData['سنة'] || formData['year'] || ''}
                                                  onChange={(v) => {
                                                      let finalV = v.replace(/[^\d]/g, '');
                                                      setFormData({...formData, 'السنة': finalV});
                                                  }}
                                                  cases={cases}
                                                  fieldPaths={['السنة', 'سنة', 'year']}
                                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition z-0"
                                                />
                                              </div>
                                            </div>
                                            
                                            {/* 2. Plaintiffs List */}
                                            <div className="mt-2 pt-2">
                                              <label className="text-xs font-black text-slate-500 block mb-3">المدعين / الطاعنين</label>
                                              <div className="space-y-3">
                                                {(formData.plaintiffsList || []).map((plaint, idx) => (
                                                  <div key={plaint.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative group">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                      <div className="flex-1">
                                                        <input 
                                                          type="text" 
                                                          value={plaint.name} 
                                                          onChange={e => {
                                                            const list = [...(formData.plaintiffsList || [])];
                                                            list[idx].name = e.target.value;
                                                            setFormData({ ...formData, plaintiffsList: list });
                                                          }}
                                                          placeholder="اسم المدعي"
                                                          className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                                        />
                                                      </div>
                                                      <div className="flex items-center gap-1.5">
                                                        <button 
                                                          type="button"
                                                          onClick={() => {
                                                            const list = [...(formData.plaintiffsList || [])];
                                                            list.splice(idx, 1);
                                                            setFormData({ ...formData, plaintiffsList: list });
                                                          }}
                                                          className="p-1.5 text-slate-400 hover:text-rose-600 bg-white rounded-lg border border-slate-200"
                                                        >
                                                          <Trash2 className="w-4 h-4" />
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                                <div className="flex items-center gap-2 mt-2">
                                                  <input 
                                                    type="text" 
                                                    value={newPlaintName} 
                                                    onChange={e => setNewPlaintName(e.target.value)} 
                                                    placeholder="اسم المدعي الجديد..." 
                                                    className="flex-1 bg-white border border-indigo-200 shadow-sm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                                  />
                                                  <button 
                                                    type="button"
                                                    onClick={() => {
                                                      if (!newPlaintName.trim()) return;
                                                      const newList = [...(formData.plaintiffsList || []), { id: Date.now().toString(), name: newPlaintName }];
                                                      setFormData({ ...formData, plaintiffsList: newList });
                                                      setNewPlaintName('');
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition whitespace-nowrap"
                                                  >
                                                    + إضافة
                                                  </button>
                                                </div>
                                              </div>
                                            </div>

                                            {/* 3. Defendants List */}
                                            <div className="mt-2 border-t border-slate-100 pt-4">
                                              <label className="text-xs font-black text-slate-500 block mb-3">المدعى عليهم / المطعون ضدهم الآخرين</label>
                                              <div className="space-y-3">
                                                {(formData.defendantsList || []).map((def, idx) => (
                                                  <div key={def.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative group">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                      <div className="flex-1">
                                                        <input 
                                                          type="text" 
                                                          value={def.name} 
                                                          onChange={e => {
                                                            const list = [...(formData.defendantsList || [])];
                                                            list[idx].name = e.target.value;
                                                            setFormData({ ...formData, defendantsList: list });
                                                          }}
                                                          placeholder="اسم المدعى عليه"
                                                          className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                                        />
                                                      </div>
                                                      <div className="flex items-center gap-1.5">
                                                        <button 
                                                          type="button"
                                                          onClick={() => setActiveDefId(activeDefId === def.id ? null : def.id)}
                                                          className="text-[10px] bg-white border border-indigo-200 text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-50 font-bold flex items-center gap-1"
                                                        >
                                                          <MapPin className="w-3 h-3" /> {activeDefId === def.id ? 'إخفاء العناوين' : 'إضافة/تعديل العناوين'}
                                                        </button>
                                                        <button 
                                                          type="button"
                                                          onClick={() => {
                                                            const list = [...(formData.defendantsList || [])];
                                                            list.splice(idx, 1);
                                                            setFormData({ ...formData, defendantsList: list });
                                                          }}
                                                          className="p-1.5 text-slate-400 hover:text-rose-600 bg-white rounded-lg border border-slate-200"
                                                        >
                                                          <Trash2 className="w-4 h-4" />
                                                        </button>
                                                      </div>
                                                    </div>
                                                    
                                                    {activeDefId === def.id && (
                                                      <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                                        <div>
                                                          <label className="text-[10px] font-bold text-slate-400 block mb-1">عنوان المدعى عليه</label>
                                                          <textarea
                                                            value={def.address || ''}
                                                            onChange={e => {
                                                              const list = [...(formData.defendantsList || [])];
                                                              list[idx].address = e.target.value;
                                                              setFormData({ ...formData, defendantsList: list });
                                                            }}
                                                            placeholder="العنوان..."
                                                            rows={2}
                                                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:border-indigo-400 resize-none"
                                                          />
                                                        </div>
                                                        <div>
                                                          <label className="text-[10px] font-bold text-slate-400 block mb-1">المقر المختار</label>
                                                          <textarea
                                                            value={def.chosenAddress || ''}
                                                            onChange={e => {
                                                              const list = [...(formData.defendantsList || [])];
                                                              list[idx].chosenAddress = e.target.value;
                                                              setFormData({ ...formData, defendantsList: list });
                                                            }}
                                                            placeholder="المقر المختار..."
                                                            rows={2}
                                                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:border-indigo-400 resize-none"
                                                          />
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}

                                                <div className="flex items-center gap-2 mt-2">
                                                  <input 
                                                    type="text" 
                                                    value={newDefName} 
                                                    onChange={e => setNewDefName(e.target.value)} 
                                                    placeholder="اسم المدعى عليه الجديد..." 
                                                    className="flex-1 bg-white border border-indigo-200 shadow-sm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                                  />
                                                  <button 
                                                    type="button"
                                                    onClick={() => {
                                                      if (!newDefName.trim()) return;
                                                      const newList = [...(formData.defendantsList || []), { id: Date.now().toString(), name: newDefName, address: '', chosenAddress: '' }];
                                                      setFormData({ ...formData, defendantsList: newList });
                                                      setNewDefName('');
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition whitespace-nowrap"
                                                  >
                                                    + إضافة
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            {/* 4. Joined Cases and Role (الصفة) */}
                                            <div className="grid grid-cols-12 gap-2 w-full mt-3">
                                              {/* Joined Cases */}
                                              <div className="col-span-12 sm:col-span-7 md:col-span-8 bg-indigo-50/40 rounded-xl p-3 border border-indigo-100 relative">
                                                <label className="text-[10px] font-black text-indigo-800 mb-2 block">الدعاوى المنضمة</label>
                                                <div className="flex flex-wrap items-center gap-2">
                                                  {(formData.joinedCasesList || []).map((jc, jcIdx) => (
                                                    <div key={jcIdx} className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                                                      {jc.no} <span className="text-[10px] text-slate-400">/</span> {jc.year}
                                                      <button type="button" onClick={() => {
                                                        const list = [...(formData.joinedCasesList || [])];
                                                        list.splice(jcIdx, 1);
                                                        setFormData({ ...formData, joinedCasesList: list });
                                                      }} className="text-rose-400 hover:text-rose-600 transition ml-1">
                                                        <X className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>
                                                  ))}

                                                  <div className="flex items-center gap-1.5">
                                                    <input type="number" placeholder="رقم" value={newJoinedNo} onChange={e => setNewJoinedNo(e.target.value)} className="w-16 bg-white border border-indigo-200 shadow-sm rounded-lg px-2 py-1.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                                                    <input type="number" placeholder="سنة" value={newJoinedYear} onChange={e => setNewJoinedYear(e.target.value)} className="w-14 bg-white border border-indigo-200 shadow-sm rounded-lg px-2 py-1.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                                                    <button type="button" onClick={() => {
                                                      if (!newJoinedNo || !newJoinedYear) return;
                                                      const list = [...(formData.joinedCasesList || []), { no: newJoinedNo, year: newJoinedYear }];
                                                      setFormData({ ...formData, joinedCasesList: list });
                                                      setNewJoinedNo('');
                                                      setNewJoinedYear('');
                                                    }} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm text-white px-2.5 py-1.5 rounded-lg text-xs font-black transition">
                                                      + إضافة
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Role (الصفة) */}
                                              <div className="col-span-12 sm:col-span-5 md:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-3 relative">
                                                <StrictSelectField
                                                  label="الصفة"
                                                  value={formData['الصفة'] || formData['صفة'] || ''}
                                                  options={['طاعنين أو مدعين', 'مطعون ضدنا أو مدعى علينا', 'لا شأن', 'خارج الاختصاص']}
                                                  onChange={(v) => setFormData({...formData, 'الصفة': v})}
                                                />
                                              </div>
                                            </div>
                                          </div>

                                        ) : field.id === 'نوع الجلسة' ? (
                                        <div className="flex bg-slate-100 p-1 rounded-xl w-full mt-1">
                                          {(settings?.courtDegree === 'إدارية عليا' || settings?.courtDegree === 'عليا' || settings?.courtDegree === 'ثان درجة' ? ['فحص', 'موضوع'] : ['مفوضين', 'مرافعة']).map((t, i) => (
                                            <button
                                              key={t} type="button" onClick={() => setFormData({...formData, [field.id]: t})}
                                              className={`flex-1 py-2 px-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all shadow-sm ${val === t ? (i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-emerald-500 text-white' : 'bg-navy-900 text-white') : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
                                            >{t}</button>
                                          ))}
                                        </div>
                                    ) : ['القرار', 'مكان الملف', 'تصنيف الحكم', 'نوع الحكم'].includes(field.id) ? (
                                        <StrictSelectField
                                          label={field.label}
                                          value={val}
                                          options={
                                            field.id === 'القرار' ? (settings?.decisions || []) :
                                            field.id === 'مكان الملف' ? (settings?.fileLocations || []) :
                                            field.id === 'تصنيف الحكم' ? (settings?.judgmentCategories || ['قطعي', 'تمهيدي']) :
                                            field.id === 'نوع الحكم' ? (settings?.judgmentTypes || ['قبول', 'رفض']) : []
                                          }
                                          onChange={(v) => setFormData({...formData, [field.id]: v})}
                                          onManage={() => {
                                            const keyMap = { 
                                              'القرار': 'decisions', 
                                              'مكان الملف': 'fileLocations', 
                                              'تصنيف الحكم': 'judgmentCategories',
                                              'نوع الحكم': 'judgmentTypes'
                                            };
                                            setManagingField({ key: keyMap[field.id], title: field.label });
                                          }}
                                        />
                                    ) : (
                                       <SmartAutocomplete
                                         id={field.id}
                                         value={val}
                                         onChange={(v) => {
                                             let finalV = v;
                                             if (field.type === 'number') finalV = finalV.replace(/[^\d]/g, '');
                                             setFormData({...formData, [field.id]: finalV});
                                         }}
                                         cases={cases}
                                         fieldPaths={[field.id]}
                                         className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
                                       />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                   </div>
                  );
                })}
              </div>
          </form>
          )}
        </div>

        {/* Footer */}
        {!showLocationPrompt && (
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
            form="add-case-form"
            disabled={isSaving}
            className="flex-[2] bg-navy-900 text-amber-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-navy-800 transition disabled:opacity-50"
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <><Save className="w-4 h-4" /> حفظ القضية</>
            )}
          </button>
        </div>
        )}
        <FieldOptionsManager 
          isOpen={!!managingField} 
          onClose={() => setManagingField(null)} 
          fieldKey={managingField?.key} 
          title={managingField?.title} 
        />
      </div>
    </div>
  );
}
