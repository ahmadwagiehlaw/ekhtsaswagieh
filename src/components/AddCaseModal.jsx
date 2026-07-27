import React, { useState } from 'react';
import { X, Save, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useNavigate } from 'react-router-dom';

export default function AddCaseModal({ isOpen, onClose }) {
  const { schema, createNewCase } = useAppContext();
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const success = await createNewCase(formData);
    setIsSaving(false);
    if (success) {
      setFormData({});
      onClose();
    } else {
      alert("حدث خطأ أثناء حفظ القضية");
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
          <form id="add-case-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {schema.filter(f => f.visible).map((field) => (
              <div key={field.id} className={`${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                <label className="text-[11px] font-black text-slate-500 block mb-1.5">{field.label}</label>
                {field.type === 'textarea' ? (
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
                  <input 
                    type="text"
                    value={formData[field.id] || ''}
                    onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
                  />
                )}
              </div>
            ))}
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
