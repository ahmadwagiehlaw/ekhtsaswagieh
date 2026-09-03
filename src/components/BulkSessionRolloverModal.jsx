import React, { useState, useEffect } from 'react';
import { X, CalendarDays, CheckCircle2, ChevronRight, Save, RefreshCcw } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { getSafeDateObj, formatDateString } from '../utils/dateUtils';
import SmartDateInput from './SmartDateInput';

export default function BulkSessionRolloverModal({ isOpen, onClose, initialDateKey, initialSelectedIds }) {
  const { cases, saveBatchCasesToFirebase, settings } = useAppContext();
  const { toast } = useUI();
  
  const [sourceDate, setSourceDate] = useState(initialDateKey || '');
  const [targetDate, setTargetDate] = useState('');
  const [targetDecision, setTargetDecision] = useState('');
  const [targetSessionType, setTargetSessionType] = useState('');
  const sessionTypes = settings?.sessionTypes || ['موضوع', 'فحص', 'حكم', 'تحضير', 'خبير'];
  const [selectedCaseIds, setSelectedCaseIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  
  const dynamicDecisions = React.useMemo(() => {
    if (!cases) return [];
    const unique = new Set(settings?.decisions || []);
    cases.forEach(c => {
      const v = c['القرار'] || c['قرار الجلسة'] || c['المنطوق'];
      if (v && typeof v === 'string') unique.add(v.trim());
      if (c.sessions) {
        c.sessions.forEach(s => {
          if (s.decision) unique.add(s.decision.trim());
        });
      }
    });
    return Array.from(unique).filter(Boolean);
  }, [cases, settings]);
  useEffect(() => {
    if (isOpen) {
      if (initialDateKey) setSourceDate(initialDateKey);
      if (initialSelectedIds && initialSelectedIds.length > 0) {
        setSelectedCaseIds(initialSelectedIds);
      } else {
        setSelectedCaseIds([]);
      }
    }
  }, [isOpen]); // Only run when modal opens/closes to prevent overriding user changes if props change mid-way

  if (!isOpen) return null;

  // Find all cases matching the sourceDate
  const availableCases = cases.filter(c => {
    if (!sourceDate) return false;
    const lastSessionStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'] || '';
    const d = getSafeDateObj(lastSessionStr);
    if (!d) return false;
    const pad = n => n.toString().padStart(2, '0');
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return key === sourceDate;
  });


  const handleCopyFromPrevious = () => {
    try {
      const last = JSON.parse(window.sessionStorage.getItem('lastRolledSession'));
      if (last) {
        setTargetDate(last.date || '');
        setTargetDecision(last.decision || '');
        setTargetSessionType(last.type || '');
        toast("تم نسخ بيانات آخر ترحيل", "success");
      } else {
        toast("لا يوجد ترحيل سابق لنسخه", "error");
      }
    } catch(e) {}
  };

  const toggleSelection = (id) => {
    setSelectedCaseIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedCaseIds(availableCases.map(c => c.id));
  };

  const deselectAll = () => {
    setSelectedCaseIds([]);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (selectedCaseIds.length === 0) {
      toast("يرجى اختيار قضية واحدة على الأقل لترحيلها.", "error");
      return;
    }
    if (!targetDate) {
      toast("يرجى إدخال تاريخ الجلسة الجديدة.", "error");
      return;
    }

    setIsSaving(true);

    const updates = [];
    selectedCaseIds.forEach(id => {
      const caseData = cases.find(c => c.id === id);
      if (!caseData) return;

      const sessionKey = Object.keys(caseData).find(k => k === 'آخر جلسة' || k === 'تاريخ الجلسة' || k === 'أخر جلسة') || 'آخر جلسة';
      const decisionKey = Object.keys(caseData).find(k => k === 'القرار' || k === 'قرار الجلسة' || k === 'المنطوق') || 'القرار';

      const sessionTypeStr = targetSessionType || (caseData['نوع الجلسة'] || '');
      const existingSessions = caseData.sessions || [];
      const newSession = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        date: targetDate,
        decision: targetDecision,
        type: sessionTypeStr,
        notes: "تم الترحيل جماعياً",
        createdAt: new Date().toISOString()
      };

      const updatedSessions = [...existingSessions, newSession].sort((a, b) => new Date(b.date) - new Date(a.date));

      const updateData = {
        sessions: updatedSessions,
        [sessionKey]: targetDate
      };
      
      if (targetDecision) {
        updateData[decisionKey] = targetDecision;
      updateData['نوع الجلسة'] = sessionTypeStr;
      }

      updates.push({ id: caseData.id, ...updateData });
    });

    const success = await saveBatchCasesToFirebase(updates);
      window.sessionStorage.setItem('lastRolledSession', JSON.stringify({ date: targetDate, decision: targetDecision, type: targetSessionType }));
    setIsSaving(false);

    if (success) {
      setSelectedCaseIds([]);
      setTargetDate('');
      setTargetDecision('');
      toast("تم الترحيل المجمع بنجاح!", "success");
      onClose();
    } else {
      toast("حدث خطأ أثناء الترحيل المجمع.", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-amber-300">
            <CalendarDays className="w-5 h-5" />
            <h2 className="font-black text-lg">ترحيل جماعي للجلسات</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50">
          
          {/* Step 1: Source */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
            <label className="text-[11px] font-black text-slate-500 block mb-1.5">1. تاريخ الجلسة الحالية (مصدر القضايا)</label>
            <SmartDateInput 
              
              value={sourceDate}
              onChange={(e) => {
                setSourceDate(e.target.value);
                setSelectedCaseIds([]); // Reset selection on date change
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>

          {/* Step 2: Selection */}
          {sourceDate && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4 animate-in fade-in">
              <div className="flex justify-between items-center mb-3 border-b border-slate-100 pb-2">
                <label className="text-[11px] font-black text-slate-500 block">2. اختر القضايا المراد ترحيلها ({availableCases.length} قضية متاحة)</label>
                <div className="flex gap-2">
                   <button onClick={selectAll} className="text-[10px] font-bold text-navy-900 bg-amber-100 px-2 py-1 rounded hover:bg-amber-200">تحديد الكل</button>
                   <button onClick={deselectAll} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200">إلغاء</button>
                </div>
              </div>
              
              <div className="max-h-40 overflow-y-auto custom-scrollbar pr-2 space-y-1.5">
                {availableCases.length === 0 ? (
                  <p className="text-xs text-center text-slate-400 py-4 font-bold">لا توجد قضايا مسجلة في هذا التاريخ.</p>
                ) : (
                  availableCases.map(c => {
                    const caseNo = c['رقم الدعوى'] || c['رقم القضية'];
                    const year = c['السنة'] || c['سنة'];
                    const isChecked = selectedCaseIds.includes(c.id);
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => toggleSelection(c.id)}
                        className={`p-2 rounded-xl border flex items-center gap-3 cursor-pointer transition ${isChecked ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${isChecked ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'}`}>
                          {isChecked && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-[11px] font-black text-navy-900">دعوى {caseNo} لسنة {year}</p>
                          <p className="text-[9px] font-bold text-slate-500 truncate">{c['المدعي'] || c['الطاعن']} ضـد {c['المدعى_عليه']}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 3: Target */}
          {selectedCaseIds.length > 0 && (
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-sm animate-in fade-in">
              <label className="text-[11px] font-black text-amber-700 block mb-3 border-b border-amber-200 pb-2">3. إعدادات الترحيل لعدد ({selectedCaseIds.length}) قضية</label>
              
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold text-slate-600 block">تاريخ الجلسة الجديدة *</label>
                  <button type="button" onClick={() => setTargetDate(sourceDate)} className="text-[10px] text-amber-700 font-black bg-amber-50 px-2 py-0.5 rounded shadow-sm hover:bg-amber-100 transition flex items-center gap-1"><RefreshCcw className="w-3 h-3" />نفس جلسة اليوم</button>
                </div>
                <SmartDateInput 
                  
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                </div>
                <div className="flex flex-col md:flex-row gap-3">
<div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">القرار الموحد (اختياري)</label>
                  <datalist id="bulk-decisions-list">
  {dynamicDecisions.map(d => <option key={d} value={d} />)}
</datalist>
<input
  type="text"
  value={targetDecision}
                    list="bulk-decisions-list"
                    onChange={(e) => setTargetDecision(e.target.value)}
                    placeholder="مثال: تأجيل للاطلاع والرد"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-600 block mb-1">نوع الجلسة الموحد (اختياري)</label>
                <select
  value={targetSessionType}
  onChange={(e) => setTargetSessionType(e.target.value)}
  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
>
  <option value="">(افتراضي من الدعوى)</option>
  {settings?.sessionTypes ? settings.sessionTypes.map(t => (
    <option key={t} value={t}>{t}</option>
  )) : ['فحص', 'موضوع', 'مفوضين', 'مرافعة'].map(t => (
    <option key={t} value={t}>{t}</option>
  ))}
</select>
              </div>
              </div>
<button
                type="button"
                onClick={handleCopyFromPrevious}
                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-black transition mt-2 shadow-sm"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> نسخ من السابق
              </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 bg-white border border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-100 transition"
          >
            إلغاء
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || selectedCaseIds.length === 0 || !targetDate}
            className="flex-[2] bg-navy-900 text-amber-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-navy-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <><Save className="w-4 h-4" /> تنفيذ الترحيل الجماعي</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
