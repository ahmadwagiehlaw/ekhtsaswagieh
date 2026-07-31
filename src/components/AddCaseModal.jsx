import React, { useState } from 'react';
import { X, Save, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { useNavigate } from 'react-router-dom';

export default function AddCaseModal({ isOpen, onClose }) {
  const { schema, createNewCase, settings, cases } = useAppContext();
  const { toast } = useUI();
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(['📌 بيانات أساسية']);
  const navigate = useNavigate();

  const getAutocompleteOptions = (fieldId) => {
    if (!cases) return [];
    const values = cases
      .map(c => c[fieldId])
      .filter(val => val && typeof val === 'string' && val.trim() !== '')
      .map(val => val.trim());
    return [...new Set(values)];
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const success = await createNewCase(formData);
      setIsSaving(false);
      if (success) {
        setFormData({});
        toast("تمت إضافة القضية بنجاح!", "success");
        onClose();
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
          <form id="add-case-form" onSubmit={handleSubmit} className="space-y-4">
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
                            if (['السنة', 'سنة', 'year'].includes(field.id)) return null;

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
                                ) : field.type === 'date' || field.id.includes('تاريخ') || field.id.includes('جلسة') ? (
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
                                            <input type={field.type === 'number' ? 'number' : 'text'} value={val} list={`list-add-${field.id}`} onChange={(e) => {
                                                let v = e.target.value;
                                                if (field.type === 'number') v = v.replace(/[^\d]/g, '');
                                                setFormData({...formData, [field.id]: v});
                                            }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition" />
                                            <datalist id={`list-add-${field.id}`}>
                                              {getAutocompleteOptions(field.id).map((opt, i) => <option key={i} value={opt} />)}
                                            </datalist>
                                          </div>
                                          <div className="flex-[1] relative">
                                            <span className="absolute -top-6 right-1 text-[10px] font-black text-slate-500">السنة</span>
                                            <input type={schema.find(f => f.id === 'السنة' || f.id === 'سنة' || f.id === 'year')?.type === 'number' ? 'number' : 'text'} value={formData['السنة'] || formData['سنة'] || formData['year'] || ''} list={`list-add-السنة`} onChange={(e) => {
                                                let v = e.target.value;
                                                if (schema.find(f => f.id === 'السنة' || f.id === 'سنة' || f.id === 'year')?.type === 'number') v = v.replace(/[^\d]/g, '');
                                                setFormData({...formData, ['السنة']: v});
                                            }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition" />
                                            <datalist id={`list-add-السنة`}>
                                              {getAutocompleteOptions('السنة').map((opt, i) => <option key={i} value={opt} />)}
                                            </datalist>
                                          </div>
                                       </div>
                                    ) : (
                                       <input 
                                         type={field.type === 'number' ? 'number' : 'text'}
                                         value={val}
                                         list={`list-add-${field.id}`}
                                         onChange={(e) => {
                                             let v = e.target.value;
                                             if (field.type === 'number') v = v.replace(/[^\d]/g, '');
                                             setFormData({...formData, [field.id]: v});
                                         }}
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
                   </div>
                 );
              })}
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

      </div>
    </div>
  );
}
