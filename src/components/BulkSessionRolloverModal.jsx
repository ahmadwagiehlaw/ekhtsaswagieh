import React, { useState, useEffect } from 'react';
import { X, CalendarDays, CheckCircle2, ChevronRight, Save } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { getSafeDateObj, formatDateString } from '../utils/dateUtils';

export default function BulkSessionRolloverModal({ isOpen, onClose, initialDateKey }) {
  const { cases, saveBatchCasesToFirebase } = useAppContext();
  const { toast } = useUI();
  
  const [sourceDate, setSourceDate] = useState(initialDateKey || '');
  const [targetDate, setTargetDate] = useState('');
  const [targetDecision, setTargetDecision] = useState('');
  const [selectedCaseIds, setSelectedCaseIds] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && initialDateKey) {
      setSourceDate(initialDateKey);
    }
  }, [isOpen, initialDateKey]);

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

      const existingSessions = caseData.sessions || [];
      const newSession = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        date: targetDate,
        decision: targetDecision,
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
      }

      updates.push({ id: caseData.id, data: updateData });
    });

    const success = await saveBatchCasesToFirebase(updates);
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
            <input 
              type="date"
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
                          <p className="text-[9px] font-bold text-slate-500 truncate">{c['المدعي']} ضـد {c['المدعى_عليه']}</p>
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
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">تاريخ الجلسة الجديدة *</label>
                  <input 
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">القرار الموحد (اختياري)</label>
                  <input 
                    type="text"
                    value={targetDecision}
                    onChange={(e) => setTargetDecision(e.target.value)}
                    placeholder="مثال: تأجيل للاطلاع والرد"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                  />
                </div>
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
