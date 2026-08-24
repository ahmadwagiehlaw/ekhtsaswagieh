import React, { useState, useEffect } from 'react';
import { X, Save, Settings } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import JudgmentRulesSection from './JudgmentRulesSection';

export default function JudgmentRulesModal({ isOpen, onClose }) {
  const { settings, saveSettingsToFirebase } = useAppContext();
  const { toast } = useUI();
  
  const [localJudgmentDefaults, setLocalJudgmentDefaults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalJudgmentDefaults(settings?.judgmentDefaults || []);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsProcessing(true);
    await saveSettingsToFirebase({
      ...settings,
      judgmentDefaults: localJudgmentDefaults
    });
    setIsProcessing(false);
    toast('تم حفظ قواعد التعبئة بنجاح', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-50 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="bg-white px-6 py-4 border-b border-slate-200 rounded-t-2xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-navy-900">قواعد التعبئة التلقائية للأحكام</h2>
              <p className="text-[11px] font-bold text-slate-500">إدارة القواعد وتعديلها سريعاً للرجوع للإدخال</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6" dir="rtl">
          <JudgmentRulesSection
            localJudgmentDefaults={localJudgmentDefaults}
            setLocalJudgmentDefaults={setLocalJudgmentDefaults}
            localRoles={settings?.roles || []}
            localJudgmentCategories={settings?.judgmentCategories || []}
            localJudgmentClassifications={settings?.judgmentClassifications || []}
            localJudgmentTypes={settings?.judgmentTypes || []}
            localSessionTypes={settings?.sessionTypes || []}
            localDecisions={settings?.decisions || []}
          />
        </div>

        <div className="bg-white p-4 border-t border-slate-200 rounded-b-2xl shrink-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-100 transition">
            إلغاء
          </button>
          <button 
            onClick={handleSave}
            disabled={isProcessing}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {isProcessing ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
}
