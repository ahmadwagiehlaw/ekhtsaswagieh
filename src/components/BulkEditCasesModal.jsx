import React, { useState, useEffect } from 'react';
import { X, Edit3, Save, CheckSquare, Square, Gavel } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';

export default function BulkEditCasesModal({ isOpen, onClose, selectedCases, onClearSelection }) {
  const { settings, saveBatchCasesToFirebase, cases } = useAppContext();
  const { toast } = useUI();

  const [isSaving, setIsSaving] = useState(false);
  const [fieldsToUpdate, setFieldsToUpdate] = useState({
    fileLocation: false,
    role: false,
    sessionType: false,
    sessionDate: false,
    decision: false,
    judgmentCategory: false,
    judgmentResult: false,
    shortJudgment: false,
    verdict: false,
    isFinal: false
  });

  const [values, setValues] = useState({
    fileLocation: '',
    role: '',
    sessionType: '',
    sessionDate: '',
    decision: '',
    judgmentCategory: '',
    judgmentResult: '',
    shortJudgment: '',
    verdict: '',
    isFinal: false
  });

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setFieldsToUpdate({
        fileLocation: false,
        role: false,
        sessionType: false,
        sessionDate: false,
        decision: false,
        judgmentCategory: false,
        judgmentResult: false,
        shortJudgment: false,
        verdict: false,
        isFinal: false
      });
      setValues({
        fileLocation: '',
        role: '',
        sessionType: '',
        sessionDate: '',
        decision: '',
        judgmentCategory: '',
        judgmentResult: '',
        shortJudgment: '',
        verdict: '',
        isFinal: false
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleField = (field) => {
    setFieldsToUpdate(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleSave = async () => {
    const hasAnyFieldSelected = Object.values(fieldsToUpdate).some(v => v);
    if (!hasAnyFieldSelected) {
      toast('يرجى تحديد حقل واحد على الأقل لتعديله.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updates = [];

      selectedCases.forEach(caseId => {
        const caseData = cases.find(c => c.id === caseId);
        if (!caseData) return;

        const updateData = {};

        // 1. Direct fields
        if (fieldsToUpdate.fileLocation) {
          updateData['مكان الملف'] = values.fileLocation;
        }
        if (fieldsToUpdate.role) {
          updateData['الصفة'] = values.role;
          updateData['صفة'] = values.role;
        }
        if (fieldsToUpdate.sessionType) {
          updateData['نوع الجلسة'] = values.sessionType;
          updateData['نوع_الجلسة'] = values.sessionType;
        }

        // 2. Session and Judgment fields
        const hasSessionUpdate = fieldsToUpdate.sessionDate || fieldsToUpdate.decision || fieldsToUpdate.judgmentCategory || fieldsToUpdate.judgmentResult || fieldsToUpdate.shortJudgment || fieldsToUpdate.verdict || fieldsToUpdate.isFinal;

        if (hasSessionUpdate) {
          const sessionKey = Object.keys(caseData).find(k => k === 'آخر جلسة' || k === 'تاريخ الجلسة' || k === 'أخر جلسة') || 'آخر جلسة';
          const decisionKey = Object.keys(caseData).find(k => k === 'القرار' || k === 'قرار الجلسة' || k === 'المنطوق') || 'القرار';
          const judgmentKey = Object.keys(caseData).find(k => k === 'الحكم' || k === 'الحكم الصادر') || 'الحكم';
          const verdictKey = Object.keys(caseData).find(k => k === 'منطوق الحكم' || k === 'المنطوق') || 'منطوق الحكم';

          let sessions = [...(caseData.sessions || [])];
          let targetSession;

          if (fieldsToUpdate.sessionDate && values.sessionDate) {
            // Find existing session with exact date
            targetSession = sessions.find(s => s.date === values.sessionDate);
            if (!targetSession) {
              // Create new session
              targetSession = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
                date: values.sessionDate,
                createdAt: new Date().toISOString()
              };
              sessions.push(targetSession);
            }
          } else {
            // No new session date, update the latest session if available
            targetSession = sessions[0];
            if (!targetSession) {
              // Create a default session with current case session date or today's date
              const currentDateStr = caseData[sessionKey] || new Date().toISOString().split('T')[0];
              targetSession = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
                date: currentDateStr,
                createdAt: new Date().toISOString()
              };
              sessions.push(targetSession);
            }
          }

          // Update details
          if (fieldsToUpdate.decision) {
            targetSession.decision = values.decision;
          }
          
          let hasAnyJudgmentField = fieldsToUpdate.judgmentCategory || fieldsToUpdate.judgmentResult || fieldsToUpdate.shortJudgment || fieldsToUpdate.verdict || fieldsToUpdate.isFinal;
          if (hasAnyJudgmentField) {
             const existingJ = targetSession.judgment || {};
             const newJ = { ...existingJ };
             
             if (fieldsToUpdate.judgmentCategory) newJ.category = values.judgmentCategory;
             if (fieldsToUpdate.shortJudgment) newJ.type = values.shortJudgment;
             if (fieldsToUpdate.judgmentResult) newJ.result = values.judgmentResult;
             if (fieldsToUpdate.verdict) newJ.fullVerdict = values.verdict;
             if (fieldsToUpdate.isFinal) newJ.isFinal = values.isFinal;
             if (!newJ.recordedAt) newJ.recordedAt = new Date().toISOString().split('T')[0];
             
             targetSession.judgment = newJ;
             targetSession.hasJudgment = true;
             
             // Update legacy fields
             if (fieldsToUpdate.judgmentResult) targetSession.judgmentClassification = values.judgmentResult;
             if (fieldsToUpdate.shortJudgment) targetSession.shortJudgment = values.shortJudgment;
             if (fieldsToUpdate.verdict) targetSession.verdict = values.verdict;
          }

          // Sort sessions
          sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

          // Apply latest session back to main case fields
          updateData.sessions = sessions;
          if (sessions.length > 0) {
            updateData[sessionKey] = sessions[0].date;
            updateData[decisionKey] = sessions[0].decision || '';
            updateData[judgmentKey] = sessions[0].shortJudgment || '';
            updateData[verdictKey] = sessions[0].verdict || '';
          }
        }

        updates.push({ id: caseId, ...updateData });
      });

      // Save to firebase
      const success = await saveBatchCasesToFirebase(updates);
      if (success) {
        toast('تم تعديل الملفات بنجاح!', 'success');
        onClearSelection();
        onClose();
      } else {
        toast('حدث خطأ أثناء التعديل الجماعي للملفات.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast('حدث خطأ غير متوقع أثناء التعديل الجماعي.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const roleOptions = settings?.roles || ['طاعن', 'مطعون ضدنا', 'خصم مدخل'];
  const sessionTypeOptions = settings?.sessionTypes || ['موضوع', 'فحص', 'للحكم', 'أول جلسة'];
  const fileLocationOptions = settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي'];
  const decisionOptions = settings?.decisions || ['للحكم', 'تصريح', 'للإطلاع', 'للإعلان', 'آخر أجل'];

  const JUDGMENT_CATEGORIES = ['نهائي', 'حكم أول درجة', 'شق عاجل', 'فحص'];
  const JUDGMENT_RESULTS = [
    { value: 'صالح', label: 'صالح' },
    { value: 'ضد', label: 'ضد' },
    { value: 'حكم منه للخصومة', label: 'حكم منه للخصومة' },
    { value: 'غير منه للخصومة', label: 'غير منه للخصومة' },
    { value: 'تمهيدي', label: 'تمهيدي' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-lg text-navy-900">تعديل البيانات جماعياً</h2>
              <p className="text-[11px] font-bold text-slate-500">{selectedCases.length} ملف محدد</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* 1. مكان الملف */}
            <div className={`p-4 rounded-2xl border transition-all ${fieldsToUpdate.fileLocation ? 'bg-amber-50/20 border-amber-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-2">
                <button 
                  type="button"
                  onClick={() => toggleField('fileLocation')} 
                  className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer"
                >
                  {fieldsToUpdate.fileLocation ? (
                    <CheckSquare className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                  )}
                  <span>مكان الملف</span>
                </button>
              </div>
              
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="حدد أو اكتب مكان الملف..."
                  disabled={!fieldsToUpdate.fileLocation}
                  value={values.fileLocation}
                  onChange={e => setValues({ ...values, fileLocation: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition disabled:bg-slate-100 disabled:text-slate-400"
                />
                {fieldsToUpdate.fileLocation && (
                  <div className="flex flex-wrap gap-1">
                    {fileLocationOptions.map(opt => (
                      <button 
                        key={opt}
                        type="button"
                        onClick={() => setValues({ ...values, fileLocation: opt })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${values.fileLocation === opt ? 'bg-amber-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. الصفة */}
            <div className={`p-4 rounded-2xl border transition-all ${fieldsToUpdate.role ? 'bg-amber-50/20 border-amber-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-2">
                <button 
                  type="button"
                  onClick={() => toggleField('role')} 
                  className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer"
                >
                  {fieldsToUpdate.role ? (
                    <CheckSquare className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                  )}
                  <span>الصفة</span>
                </button>
              </div>

              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="حدد أو اكتب الصفة..."
                  disabled={!fieldsToUpdate.role}
                  value={values.role}
                  onChange={e => setValues({ ...values, role: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition disabled:bg-slate-100 disabled:text-slate-400"
                />
                {fieldsToUpdate.role && (
                  <div className="flex flex-wrap gap-1">
                    {roleOptions.map(opt => (
                      <button 
                        key={opt}
                        type="button"
                        onClick={() => setValues({ ...values, role: opt })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${values.role === opt ? 'bg-amber-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 3. نوع الجلسة */}
            <div className={`p-4 rounded-2xl border transition-all ${fieldsToUpdate.sessionType ? 'bg-amber-50/20 border-amber-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-2">
                <button 
                  type="button"
                  onClick={() => toggleField('sessionType')} 
                  className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer"
                >
                  {fieldsToUpdate.sessionType ? (
                    <CheckSquare className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                  )}
                  <span>نوع الجلسة</span>
                </button>
              </div>

              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="حدد أو اكتب نوع الجلسة..."
                  disabled={!fieldsToUpdate.sessionType}
                  value={values.sessionType}
                  onChange={e => setValues({ ...values, sessionType: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition disabled:bg-slate-100 disabled:text-slate-400"
                />
                {fieldsToUpdate.sessionType && (
                  <div className="flex flex-wrap gap-1">
                    {sessionTypeOptions.map(opt => (
                      <button 
                        key={opt}
                        type="button"
                        onClick={() => setValues({ ...values, sessionType: opt })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${values.sessionType === opt ? 'bg-amber-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 4. تاريخ الجلسة */}
            <div className={`p-4 rounded-2xl border transition-all ${fieldsToUpdate.sessionDate ? 'bg-amber-50/20 border-amber-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-2">
                <button 
                  type="button"
                  onClick={() => toggleField('sessionDate')} 
                  className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer"
                >
                  {fieldsToUpdate.sessionDate ? (
                    <CheckSquare className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                  )}
                  <span>تاريخ الجلسة</span>
                </button>
              </div>

              <input 
                type="date" 
                disabled={!fieldsToUpdate.sessionDate}
                value={values.sessionDate}
                onChange={e => setValues({ ...values, sessionDate: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            {/* 5. القرار */}
            <div className={`p-4 rounded-2xl border transition-all md:col-span-2 ${fieldsToUpdate.decision ? 'bg-amber-50/20 border-amber-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center justify-between mb-2">
                <button 
                  type="button"
                  onClick={() => toggleField('decision')} 
                  className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer"
                >
                  {fieldsToUpdate.decision ? (
                    <CheckSquare className="w-4.5 h-4.5 text-amber-500 shrink-0" />
                  ) : (
                    <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                  )}
                  <span>القرار</span>
                </button>
              </div>

              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="حدد أو اكتب القرار للجلسة..."
                  disabled={!fieldsToUpdate.decision}
                  value={values.decision}
                  onChange={e => setValues({ ...values, decision: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition disabled:bg-slate-100 disabled:text-slate-400"
                />
                {fieldsToUpdate.decision && (
                  <div className="flex flex-wrap gap-1">
                    {decisionOptions.map(opt => (
                      <button 
                        key={opt}
                        type="button"
                        onClick={() => setValues({ ...values, decision: opt })}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${values.decision === opt ? 'bg-amber-500 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* 6. بيانات الحكم (Comprehensive) */}
            <div className={`p-4 rounded-2xl border transition-all md:col-span-2 ${fieldsToUpdate.judgmentCategory || fieldsToUpdate.judgmentResult || fieldsToUpdate.shortJudgment || fieldsToUpdate.verdict || fieldsToUpdate.isFinal ? 'bg-rose-50/40 border-rose-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                <Gavel className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-black text-rose-900">تعديل بيانات الحكم</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <button type="button" onClick={() => toggleField('judgmentCategory')} className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer mb-2">
                    {fieldsToUpdate.judgmentCategory ? <CheckSquare className="w-4 h-4 text-rose-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span>فئة الحكم</span>
                  </button>
                  <select 
                    disabled={!fieldsToUpdate.judgmentCategory}
                    value={values.judgmentCategory}
                    onChange={e => setValues({ ...values, judgmentCategory: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">-- اختر الفئة --</option>
                    {JUDGMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Result */}
                <div>
                  <button type="button" onClick={() => toggleField('judgmentResult')} className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer mb-2">
                    {fieldsToUpdate.judgmentResult ? <CheckSquare className="w-4 h-4 text-rose-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span>تصنيف الحكم (النتيجة)</span>
                  </button>
                  <select 
                    disabled={!fieldsToUpdate.judgmentResult}
                    value={values.judgmentResult}
                    onChange={e => setValues({ ...values, judgmentResult: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">-- اختر التصنيف --</option>
                    {JUDGMENT_RESULTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                {/* Type */}
                <div>
                  <button type="button" onClick={() => toggleField('shortJudgment')} className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer mb-2">
                    {fieldsToUpdate.shortJudgment ? <CheckSquare className="w-4 h-4 text-rose-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span>نوع الحكم</span>
                  </button>
                  <input 
                    type="text" 
                    placeholder="مثال: رفض، قبول، شطب..."
                    disabled={!fieldsToUpdate.shortJudgment}
                    value={values.shortJudgment}
                    onChange={e => setValues({ ...values, shortJudgment: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
                
                {/* Final status */}
                <div>
                  <button type="button" onClick={() => toggleField('isFinal')} className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer mb-2">
                    {fieldsToUpdate.isFinal ? <CheckSquare className="w-4 h-4 text-rose-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span>حالة الحكم</span>
                  </button>
                  <label className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${values.isFinal && fieldsToUpdate.isFinal ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'} ${!fieldsToUpdate.isFinal && 'opacity-50 pointer-events-none'}`}>
                    <input type="checkbox" checked={values.isFinal} onChange={e => setValues({...values, isFinal: e.target.checked})} className="rounded text-indigo-600" />
                    هل هذا الحكم نهائي؟ (مستنفد درجات التقاضي)
                  </label>
                </div>

                {/* Verdict */}
                <div className="md:col-span-2">
                  <button type="button" onClick={() => toggleField('verdict')} className="flex items-center gap-2 text-xs font-black text-navy-900 select-none cursor-pointer mb-2">
                    {fieldsToUpdate.verdict ? <CheckSquare className="w-4 h-4 text-rose-500 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                    <span>منطوق الحكم كاملاً</span>
                  </button>
                  <textarea 
                    placeholder="اكتب منطوق الحكم كاملاً هنا..."
                    disabled={!fieldsToUpdate.verdict}
                    value={values.verdict}
                    onChange={e => setValues({ ...values, verdict: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
          >
            إلغاء
          </button>
          <button 
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] bg-navy-900 hover:bg-navy-800 text-amber-300 font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <Save className="w-4 h-4" /> حفظ التعديلات الجماعية
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
