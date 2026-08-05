import React, { useState, useEffect } from 'react';
import { X, Save, Edit3, Settings2 } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { useNavigate } from 'react-router-dom';
import FieldOptionsManager from './FieldOptionsManager';
import StrictSelectField from './StrictSelectField';

export default function QuickEditCaseModal({ isOpen, onClose, caseData }) {
  const { schema, saveCaseToFirebase, settings, cases } = useAppContext();
  const { toast } = useUI();
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [managingField, setManagingField] = useState(null);
  const navigate = useNavigate();

  const currentCourtDegree = settings?.courtDegree || 'أول درجة';
  const isSupreme = currentCourtDegree === 'ثان درجة' || currentCourtDegree === 'عليا' || currentCourtDegree === 'الإدارية العليا';
  const sessionTypeOptions = isSupreme ? ['فحص', 'موضوع', 'حكم'] : ['مفوضين', 'مرافعة', 'حكم'];

  const getAutocompleteOptions = (fieldId) => {
    if (!cases) return [];
    const values = cases
      .map(c => c[fieldId])
      .filter(val => val && typeof val === 'string' && val.trim() !== '')
      .map(val => val.trim());
    return [...new Set(values)];
  };

  useEffect(() => {
    if (caseData && isOpen) {
      setFormData(caseData);
    }
  }, [caseData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const success = await saveCaseToFirebase(formData.id, formData);
      setIsSaving(false);
      if (success) {
        toast("تم تعديل القضية بنجاح!", "success");
        onClose();
      } else {
        toast("حدث خطأ أثناء حفظ التعديلات", "error");
      }
    } catch (error) {
      setIsSaving(false);
      toast("حدث خطأ غير متوقع", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-amber-300">
            <Edit3 className="w-5 h-5" />
            <h2 className="font-black text-lg">تعديل شامل للدعوى</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <form id="quick-edit-case-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {schema.filter(f => f.visible && !['الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم'].includes(f.id)).map((field) => {
              const isStrictField = ['القرار', 'الصفة', 'صفة', 'مكان الملف', 'نوع الجلسة', 'تصنيف الحكم', 'نوع الحكم'].includes(field.id);
              
              return (
                <div key={field.id} className={`${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                  {!isStrictField && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="text-[11px] font-black text-slate-500 block">{field.label}</label>
                    </div>
                  )}

                  {isStrictField ? (
                    <StrictSelectField
                      label={field.label}
                      value={formData[field.id] || ''}
                      options={
                        field.id === 'القرار' ? (settings?.decisions || []) :
                        field.id === 'مكان الملف' ? (settings?.fileLocations || []) :
                        field.id === 'نوع الجلسة' ? sessionTypeOptions :
                        field.id === 'تصنيف الحكم' ? (settings?.judgmentCategories || ['قطعي', 'تمهيدي']) :
                        field.id === 'نوع الحكم' ? (settings?.judgmentTypes || ['قبول', 'رفض']) :
                        (field.id === 'الصفة' || field.id === 'صفة') ? (settings?.roles || ['طاعن', 'مطعون ضدنا', 'خصم مدخل']) : []
                      }
                      onChange={(v) => setFormData({...formData, [field.id]: v})}
                      onManage={() => {
                        const keyMap = { 
                          'القرار': 'decisions', 
                          'مكان الملف': 'fileLocations', 
                          'نوع الجلسة': 'sessionTypes',
                          'تصنيف الحكم': 'judgmentCategories',
                          'نوع الحكم': 'judgmentTypes',
                          'الصفة': 'roles',
                          'صفة': 'roles'
                        };
                        setManagingField({ key: keyMap[field.id], title: field.label });
                      }}
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea 
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 resize-none transition"
                    />
                  ) : field.type === 'date' ? (
                    <input 
                      type="date"
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
                    />
                  ) : (
                    <div>
                      <input 
                        type="text"
                        value={formData[field.id] || ''}
                        list={`list-edit-${field.id}`}
                        onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
                      />
                      <datalist id={`list-edit-${field.id}`}>
                        {getAutocompleteOptions(field.id).map((opt, i) => <option key={i} value={opt} />)}
                      </datalist>
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
            form="quick-edit-case-form"
            disabled={isSaving}
            className="flex-[2] bg-navy-900 text-amber-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-navy-800 transition disabled:opacity-50"
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <><Save className="w-4 h-4" /> حفظ التعديلات</>
            )}
          </button>
        </div>
      </div>

      <FieldOptionsManager 
        isOpen={!!managingField} 
        onClose={() => setManagingField(null)} 
        fieldKey={managingField?.key} 
        title={managingField?.title} 
      />
    </div>
  );
}
