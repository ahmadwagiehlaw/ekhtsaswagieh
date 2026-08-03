import React, { useState } from 'react';
import { X, Save, Plus, Check, Trash2, MapPin } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { useNavigate } from 'react-router-dom';
import SmartAutocomplete from './SmartAutocomplete';

export default function AddCaseModal({ isOpen, onClose }) {
  const { schema, createNewCase, settings, cases, saveCaseToFirebase } = useAppContext();
  const { toast } = useUI();
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(['📌 بيانات أساسية']);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [createdCaseId, setCreatedCaseId] = useState(null);
  const [customLocation, setCustomLocation] = useState('');
  const [newDefName, setNewDefName] = useState('');
  const [activeDefId, setActiveDefId] = useState(null);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const savedCaseId = await createNewCase(formData);
      setIsSaving(false);
      if (savedCaseId) {
        setCreatedCaseId(savedCaseId);
        setShowLocationPrompt(true);
        toast("تمت إضافة القضية بنجاح!", "success");
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
              {[
                {
                  title: '📌 بيانات أساسية',
                  colorClass: 'text-blue-700 bg-blue-50/50 border-blue-100',
                  keys: ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى', 'السنة', 'سنة', 'year', 'دعاوى منضمة', 'المحكمة', 'الدائرة', 'المدعي', 'المدعى_عليه', 'المدعى عليه', 'الخصوم', 'مطعون ضدهم آخرين', 'الصفة', 'صفة', 'تصنيف الدعوى', 'موضوع الدعوى']
                },
                {
                  title: '⚖️ الجلسة والقرار',
                  colorClass: 'text-amber-700 bg-amber-50/50 border-amber-100',
                  keys: ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة', 'الرول', 'نوع الجلسة', 'القرار', 'قرار الجلسة', 'مكان الملف', 'ملاحظات']
                },
                {
                  title: '🏛️ بيانات الحكم وأول درجة',
                  colorClass: 'text-rose-700 bg-rose-50/50 border-rose-100',
                  keys: ['محكمة أول درجة', 'رقم دعوى أول درجة', 'سنة دعوى أول درجة', 'تاريخ حكم أول درجة', 'جلسة حكم أول درجة', 'منطوق حكم أول درجة', 'الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم', 'ملخص الطعن وتفاصيله', 'ملخص الطعن']
                },
                {
                  title: '📍 بيانات أخرى',
                  colorClass: 'text-slate-700 bg-slate-50/50 border-slate-200',
                  keys: ['المقر المختار', 'عنوان المدعى عليه', 'عنوان المدعي', 'تصنيف الدعوى']
                }
              ].map((group, idx, arr) => {
                 const excludedFields = ['الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم', 'الرول', 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي'];
                 let groupFields = schema.filter(f => f.visible && group.keys.includes(f.id) && !excludedFields.includes(f.id));
                 if (idx === arr.length - 1) {
                    const allConfiguredKeys = arr.flatMap(g => g.keys);
                    const unmappedFields = schema.filter(f => f.visible && !allConfiguredKeys.includes(f.id) && !excludedFields.includes(f.id));
                    groupFields = [...groupFields, ...unmappedFields];
                 }
                 
                 if (groupFields.length === 0) return null;
                 
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
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 gap-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                         {groupFields.map(field => {
                            const val = formData[field.id] || '';
                            
                            // Smart conditional logic:
                            const currentRole = formData['الصفة'] || '';
                            const isPlaintiffRole = currentRole.includes('طاعن') || currentRole.includes('مستأنف') || currentRole.includes('مدعي');
                            const isDefendantRole = currentRole.includes('مطعون') || currentRole.includes('مدعى عليه');
                            
                            if (field.id === 'المقر المختار' && !isPlaintiffRole) return null;
                            if (field.id === 'عنوان المدعى عليه' && !isPlaintiffRole) return null;
                            if (field.id === 'عنوان المدعي' && !isDefendantRole) return null;
                            if (['السنة', 'سنة', 'year', 'دعاوى منضمة', 'مطعون ضدهم آخرين'].includes(field.id)) return null;

                            return (
                              <div key={field.id} className={`${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                                <label className="text-[11px] font-black text-slate-500 block mb-1.5">{field.label}</label>
                                {field.type === 'textarea' ? (
                                  <textarea 
                                    value={val}
                                    onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
                                    rows={3}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 resize-none transition"
                                  />
                                ) : (field.type === 'date' && field.id !== 'نوع الجلسة') || field.id === 'آخر جلسة' || field.id === 'تاريخ آخر جلسة' || field.id === 'جلسة حكم أول درجة' ? (
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
                                    {['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى'].includes(field.id) ? (
                                       <div className="flex items-center gap-2 mb-2">
                                          <div className="flex-[2] relative">
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
                                          </div>
                                          <div className="flex-[1] relative">
                                            <span className="absolute -top-6 right-1 text-[10px] font-black text-slate-500 z-10">السنة</span>
                                            <SmartAutocomplete
                                              id="السنة"
                                              value={formData['السنة'] || formData['سنة'] || formData['year'] || ''}
                                              onChange={(v) => {
                                                  let finalV = v;
                                                  if (schema.find(f => f.id === 'السنة' || f.id === 'سنة' || f.id === 'year')?.type === 'number') finalV = finalV.replace(/[^\d]/g, '');
                                                  setFormData({...formData, ['السنة']: finalV});
                                              }}
                                              cases={cases}
                                              fieldPaths={['السنة', 'سنة', 'year']}
                                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition relative z-0"
                                            />
                                          </div>
                                          <div className="flex-[2] relative">
                                            <span className="absolute -top-6 right-1 text-[10px] font-black text-slate-500 z-10">دعاوى منضمة</span>
                                            <input
                                               type="text"
                                               value={formData['دعاوى منضمة'] || ''}
                                               onChange={(e) => setFormData({...formData, 'دعاوى منضمة': e.target.value})}
                                               className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition relative z-0"
                                               placeholder="مثال: 123 لسنة 2024"
                                            />
                                          </div>
                                       </div>
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

                                    {field.id === 'القرار' && settings?.decisions && (
                                       <div className="flex flex-wrap gap-1 mt-2">
                                         {settings.decisions.slice(0, 5).map(dec => (
                                           <button key={dec} type="button" onClick={() => setFormData({...formData, [field.id]: dec})} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 transition">{dec}</button>
                                         ))}
                                       </div>
                                    )}
                                    {(field.id === 'الصفة' || field.id === 'صفة') && (
                                       <div className="flex flex-wrap gap-1 mt-2">
                                         {(settings?.roles || ['طاعن', 'مطعون ضدنا', 'خصم مدخل']).map(s => (
                                           <button key={s} type="button" onClick={() => setFormData({...formData, [field.id]: s})} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 transition">{s}</button>
                                         ))}
                                       </div>
                                    )}
                                    {field.id === 'نوع الجلسة' && (
                                       <div className="flex flex-wrap gap-1 mt-2">
                                         {(settings?.sessionTypes || ['موضوع', 'فحص', 'للحكم', 'أول جلسة']).map(s => (
                                           <button key={s} type="button" onClick={() => setFormData({...formData, [field.id]: s})} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 transition">{s}</button>
                                         ))}
                                       </div>
                                    )}
                                    {field.id === 'مكان الملف' && (
                                       <div className="flex flex-wrap gap-1 mt-2">
                                         {(settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي']).map(s => (
                                           <button key={s} type="button" onClick={() => setFormData({...formData, [field.id]: s})} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 transition">{s}</button>
                                         ))}
                                       </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                         })}
                      </div>
                      )}
                      
                      {/* Defendants List inside first group */}
                      {isExpanded && group.title === '📌 بيانات أساسية' && (
                        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        </div>
                      )}
                   </div>
                 );
              })}
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

      </div>
    </div>
  );
}
