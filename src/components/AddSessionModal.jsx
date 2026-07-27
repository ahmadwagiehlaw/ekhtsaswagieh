import React, { useState } from 'react';
import { X, Save, CalendarPlus } from 'lucide-react';
import { useAppContext } from '../context/AppState';

export default function AddSessionModal({ isOpen, onClose, caseData }) {
  const { saveCaseToFirebase } = useAppContext();
  const [sessionDate, setSessionDate] = useState('');
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !caseData) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sessionDate) {
      alert("يرجى إدخال تاريخ الجلسة");
      return;
    }
    
    setIsSaving(true);
    
    // Create new session object
    const newSession = {
      id: Date.now().toString(),
      date: sessionDate,
      decision: decision,
      notes: notes,
      createdAt: new Date().toISOString()
    };

    // Update case data
    const existingSessions = caseData.sessions || [];
    const updatedSessions = [...existingSessions, newSession].sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first

    const updateData = {
      sessions: updatedSessions,
    };

    // Also update main fields to reflect the latest session for stats and list view
    // Find the schema keys used for lastSession and decision
    const sessionKey = Object.keys(caseData).find(k => k === 'آخر جلسة' || k === 'تاريخ الجلسة' || k === 'أخر جلسة') || 'آخر جلسة';
    const decisionKey = Object.keys(caseData).find(k => k === 'القرار' || k === 'قرار الجلسة' || k === 'المنطوق') || 'القرار';

    updateData[sessionKey] = sessionDate;
    if (decision) {
      updateData[decisionKey] = decision;
    }

    const success = await saveCaseToFirebase(caseData.id, updateData);
    setIsSaving(false);
    
    if (success) {
      setSessionDate('');
      setDecision('');
      setNotes('');
      onClose();
    } else {
      alert("حدث خطأ أثناء حفظ الجلسة");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-amber-500 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-white">
            <CalendarPlus className="w-5 h-5" />
            <h2 className="font-black text-lg">إضافة جلسة جديدة</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6">
          <form id="add-session-form" onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1.5">تاريخ الجلسة *</label>
              <input 
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1.5">القرار</label>
              <input 
                type="text"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                placeholder="مثال: التأجيل للاطلاع، للحكم، إلخ"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-500 block mb-1.5">ملاحظات إضافية</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="أي ملاحظات حول الجلسة..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none transition"
              />
            </div>

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
            form="add-session-form"
            disabled={isSaving}
            className="flex-[2] bg-amber-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-amber-600 transition disabled:opacity-50"
          >
            {isSaving ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <><Save className="w-4 h-4" /> حفظ الجلسة</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
