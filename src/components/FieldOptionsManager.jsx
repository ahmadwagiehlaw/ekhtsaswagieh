import React, { useState, useEffect } from 'react';
import { X, Settings2, Plus, Trash2, Edit2, GripVertical, Check } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';

export default function FieldOptionsManager({ fieldKey, title, isOpen, onClose, defaultOptions = [] }) {
  const { settings, saveSettingsToFirebase } = useAppContext();
  const { toast } = useUI();
  
  const [options, setOptions] = useState([]);
  const [newOption, setNewOption] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize from settings when opened
  useEffect(() => {
    if (isOpen && settings) {
      // Use settings array if defined, otherwise fallback to defaultOptions
      setOptions(settings[fieldKey] !== undefined ? settings[fieldKey] : defaultOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fieldKey]);

  if (!isOpen) return null;

  const handleAdd = () => {
    const val = newOption.trim();
    if (!val) return;
    if (options.includes(val)) {
      toast('هذا الخيار موجود بالفعل', 'error');
      return;
    }
    setOptions([...options, val]);
    setNewOption('');
  };

  const handleRemove = (idx) => {
    const newOptions = [...options];
    newOptions.splice(idx, 1);
    setOptions(newOptions);
  };

  const startEdit = (idx, val) => {
    setEditingIndex(idx);
    setEditValue(val);
  };

  const saveEdit = (idx) => {
    const val = editValue.trim();
    if (!val) return;
    if (options.includes(val) && options[idx] !== val) {
      toast('هذا الخيار موجود بالفعل', 'error');
      return;
    }
    const newOptions = [...options];
    newOptions[idx] = val;
    setOptions(newOptions);
    setEditingIndex(null);
  };

  const handleSaveToSettings = async () => {
    setIsSaving(true);
    try {
      await saveSettingsToFirebase({ ...settings, [fieldKey]: options });
      toast('تم حفظ الخيارات بنجاح!', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-100 px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-200">
              <Settings2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-black text-navy-900 text-sm">إدارة الخيارات</h3>
              <p className="text-[10px] font-bold text-slate-500">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
          
          <div className="flex gap-2 mb-6">
            <input 
              type="text" 
              value={newOption}
              onChange={e => setNewOption(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="إضافة خيار جديد..."
              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:ring-2 focus:ring-indigo-600 outline-none transition shadow-sm"
            />
            <button 
              onClick={handleAdd}
              className="w-12 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center rounded-xl transition shadow-sm"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {options.length === 0 ? (
              <p className="text-center text-xs font-bold text-slate-400 py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                لا توجد خيارات حالياً. أضف خياراتك الأولى بالأعلى.
              </p>
            ) : (
              options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-sm group">
                  <div className="w-6 h-6 flex items-center justify-center text-slate-300 cursor-move">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  
                  {editingIndex === idx ? (
                    <div className="flex-1 flex gap-2">
                      <input 
                        type="text"
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(idx); if (e.key === 'Escape') setEditingIndex(null); }}
                        className="flex-1 bg-slate-50 border-b-2 border-indigo-600 px-2 py-1 text-xs font-bold text-navy-900 outline-none"
                      />
                      <button onClick={() => saveEdit(idx)} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingIndex(null)} className="text-slate-400 p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-xs font-bold text-slate-700 px-2">{opt}</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(idx, opt)} className="w-7 h-7 rounded bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleRemove(idx)} className="w-7 h-7 rounded bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 p-4 shrink-0 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-3 rounded-xl text-xs transition"
          >
            إلغاء
          </button>
          <button 
            onClick={handleSaveToSettings}
            disabled={isSaving}
            className="flex-[2] bg-navy-900 hover:bg-navy-800 disabled:bg-slate-400 text-amber-300 font-black py-3 rounded-xl text-xs transition shadow-sm"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات في الإعدادات'}
          </button>
        </div>

      </div>
    </div>
  );
}
