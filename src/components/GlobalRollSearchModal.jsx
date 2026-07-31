import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Plus, CalendarPlus } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';

export default function GlobalRollSearchModal({ isOpen, onClose, initialQuery, sessionDate }) {
  const { cases, saveCaseToFirebase } = useAppContext();
  const { toast } = useUI();
  
  const [searchQ, setSearchQ] = useState(initialQuery || '');
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQ(initialQuery || '');
    }
  }, [isOpen, initialQuery]);

  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toLowerCase();
    return cases.filter(c =>
      [c['رقم الدعوى'], c['السنة'], c['المدعي'], c['المدعى_عليه'], c['الرول']]
        .some(v => String(v || '').toLowerCase().includes(q))
    ).slice(0, 20); // Limit to 20 results for performance
  }, [cases, searchQ]);

  const handleAddToRoll = async (cObj) => {
    setAddingId(cObj.id);
    try {
      const newData = { ...cObj };
      const sessions = newData.sessions || [];
      
      // Check if already in roll
      if (sessions.some(s => s.date === sessionDate)) {
        toast('هذه الدعوى موجودة بالفعل في رول هذا اليوم', 'error');
        setAddingId(null);
        return;
      }
      
      // Add new session
      sessions.push({
        id: Date.now().toString(),
        date: sessionDate,
        createdAt: new Date().toISOString()
      });
      newData.sessions = sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      await saveCaseToFirebase(cObj.id, newData);
      toast('تم إضافة الدعوى للرول بنجاح', 'success');
      onClose();
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء إضافة الدعوى', 'error');
    } finally {
      setAddingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">البحث الشامل وإضافة للرول</h2>
              <p className="text-xs font-bold text-slate-500">
                إضافة دعوى من قاعدة البيانات لرول يوم {sessionDate}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-slate-600 transition shadow-sm border border-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="ابحث برقم الدعوى، السنة، أو اسم الخصم..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="bg-transparent text-sm font-bold text-navy-900 outline-none flex-1 w-full"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {searchQ.trim() ? 'لا توجد نتائج مطابقة لبحثك' : 'اكتب للبحث في كافة القضايا'}
              </div>
            ) : (
              searchResults.map(c => {
                const alreadyInRoll = (c.sessions || []).some(s => s.date === sessionDate);
                return (
                  <div key={c.id} className="flex items-center justify-between bg-white border border-slate-100 shadow-sm rounded-xl p-3 hover:border-indigo-100 transition">
                    <div>
                      <div className="font-black text-slate-700 text-sm">
                        {c['رقم الدعوى']} لسنة {c['السنة']}
                      </div>
                      <div className="text-xs font-bold text-slate-500 mt-1">
                        {c['المدعي']} <span className="text-rose-400 mx-1">ضد</span> {c['المدعى_عليه']}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddToRoll(c)}
                      disabled={alreadyInRoll || addingId === c.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        alreadyInRoll 
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {addingId === c.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-700 rounded-full animate-spin" />
                      ) : alreadyInRoll ? (
                        'موجودة بالرول'
                      ) : (
                        <><CalendarPlus className="w-3.5 h-3.5" /> إضافة للرول</>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
