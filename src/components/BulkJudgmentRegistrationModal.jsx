import React, { useState, useEffect } from 'react';
import { X, Save, Scale } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { formatDateString } from '../utils/dateUtils';

export default function BulkJudgmentRegistrationModal({ isOpen, onClose, sessionDate, selectedCaseIds }) {
  const { cases, settings, saveBatchCasesToFirebase } = useAppContext();
  const { toast } = useUI();
  
  const [formData, setFormData] = useState({
    _category: '',
    _result: '',
    _type: '',
    _verdict: '',
    _isFinal: false,
    _role: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        _category: '',
        _result: '',
        _type: '',
        _verdict: '',
        _isFinal: false,
        _role: ''
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const applyDefaultRules = (field, value, currentData) => {
    if (!settings?.judgmentDefaults?.length) return currentData;
    const newData = { ...currentData };
    
    for (const rule of settings.judgmentDefaults) {
      const conds = rule.conditions || {};
      const roleMatch = !conds.role || (currentData._role && currentData._role.includes(conds.role)) || conds.role === currentData._role;
      const catMatch = !conds.category || newData._category === conds.category;
      const classMatch = !conds.classification || newData._result === conds.classification;
      const typeMatch = !conds.type || newData._type === conds.type;
      
      if (roleMatch && catMatch && classMatch && typeMatch && (conds.role || conds.category || conds.classification || conds.type)) {
        const acts = rule.actions || {};
        if (acts.category && !newData._category) newData._category = acts.category;
        if (acts.classification && !newData._result) newData._result = acts.classification;
        if (acts.type && !newData._type) newData._type = acts.type;
        if (acts.text && !newData._verdict) newData._verdict = acts.text;
        break; // apply only the first fully matching rule
      }
    }
    return newData;
  };

  const handleFieldChange = (field, value) => {
    let newData = { ...formData, [field]: value };
    if (field === '_category' || field === '_result') {
      newData = applyDefaultRules(field, value, newData);
    }
    setFormData(newData);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedCaseIds || selectedCaseIds.size === 0) {
      toast("يرجى اختيار قضية واحدة على الأقل.", "error");
      return;
    }

    setIsSaving(true);
    const updates = [];

    selectedCaseIds.forEach(id => {
      const caseData = cases.find(c => c.id === id);
      if (!caseData) return;

      const sessions = caseData.sessions ? [...caseData.sessions] : [];
      const sessionIndex = sessions.findIndex(s => s.date === sessionDate);

      const jData = {
        category: formData._category,
        result: formData._result,
        type: formData._type,
        fullVerdict: formData._verdict,
        isFinal: formData._isFinal,
        recordedAt: new Date().toISOString().split('T')[0],
        timestamp: Date.now()
      };

      if (sessionIndex >= 0) {
        sessions[sessionIndex] = {
          ...sessions[sessionIndex],
          judgment: jData,
          shortJudgment: jData.type,
          judgmentClassification: jData.result,
          verdict: jData.fullVerdict,
          hasJudgment: true,
          hasSession: false,
          decision: jData.fullVerdict || sessions[sessionIndex].decision
        };
      } else {
        sessions.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          date: sessionDate,
          decision: jData.fullVerdict,
          judgment: jData,
          shortJudgment: jData.type,
          judgmentClassification: jData.result,
          verdict: jData.fullVerdict,
          hasJudgment: true,
          hasSession: false,
          createdAt: new Date().toISOString()
        });
        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      const updateData = { sessions };
      // Also update latest judgment info on the root level if this is the latest session
      if (sessions[0].date === sessionDate) {
        updateData['القرار'] = jData._verdict;
        updateData['آخر جلسة'] = sessionDate;
        updateData['المنطوق'] = jData._verdict;
      }
      
      // Update role if provided
      if (formData._role) {
        updateData['الصفة'] = formData._role;
      }

      updates.push({ id: caseData.id, ...updateData });
    });

    const success = await saveBatchCasesToFirebase(updates);
    setIsSaving(false);
    
    if (success) {
      toast("تم تسجيل الأحكام الجماعية بنجاح", "success");
      onClose();
    } else {
      toast("حدث خطأ أثناء الحفظ", "error");
    }
  };

  const judgmentCategories = settings?.judgmentCategories || ['نهائي', 'حكم أول درجة', 'شق عاجل', 'فحص'];
  const judgmentClassifications = settings?.judgmentClassifications || ['صالح', 'ضد', 'حكم منه للخصومة', 'غير منه للخصومة', 'تمهيدي'];
  // Always use the 4 correct roles regardless of what's saved in Firebase
  const CORRECT_ROLES = ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص'];
  const roles = (settings?.roles?.length >= 3) ? settings.roles : CORRECT_ROLES;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-rose-50 px-6 py-4 flex items-center justify-between border-b border-rose-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-rose-900">تسجيل أحكام جماعي</h2>
              <p className="text-xs font-bold text-rose-600">
                تسجيل بيانات الحكم لـ {selectedCaseIds?.size || 0} قضايا محددة (رول {formatDateString(sessionDate)})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition shadow-sm border border-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
          {/* Role - FIRST and most important field */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-600 block">الصفة <span className="text-rose-500 font-black">(مهم)</span></label>
            <select
              value={formData._role}
              onChange={e => handleFieldChange('_role', e.target.value)}
              className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition outline-none"
            >
              <option value="">اختر الصفة (اختياري - يحدد صفة جميع القضايا)</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 block">فئة الحكم</label>
              <select
                value={formData._category}
                onChange={e => handleFieldChange('_category', e.target.value)}
                className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition outline-none"
              >
                <option value="">–– فئة الحكم ––</option>
                {judgmentCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-600 block">تصنيف الحكم</label>
              <select
                value={formData._result}
                onChange={e => handleFieldChange('_result', e.target.value)}
                className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition outline-none"
              >
                <option value="">–– التصنيف ––</option>
                {judgmentClassifications.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-600 block">نوع الحكم</label>
            <input
              type="text"
              value={formData._type}
              onChange={e => handleFieldChange('_type', e.target.value)}
              placeholder="مثال: رفض الطعن، وقف تنفيذي، إلخ..."
              className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-600 block">منطوق الحكم</label>
            <textarea
              value={formData._verdict}
              onChange={e => handleFieldChange('_verdict', e.target.value)}
              placeholder="اكتب منطوق الحكم كاملاً هنا..."
              className="w-full text-sm font-bold p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition outline-none resize-none h-24"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isFinalCheckboxBulk"
              checked={formData._isFinal}
              onChange={e => handleFieldChange('_isFinal', e.target.checked)}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
            />
            <label htmlFor="isFinalCheckboxBulk" className="text-sm font-bold text-slate-700 select-none cursor-pointer">
              هذا الحكم نهائي وبات
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              type="button"
              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || selectedCaseIds?.size === 0}
              className="flex-[2] px-4 py-3 bg-rose-600 text-white text-sm font-black rounded-xl hover:bg-rose-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  حفظ وتسجيل للجميع
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
