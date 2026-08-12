import React, { useState, useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import { useAppContext } from '../context/AppState';

export default function QuickScratchpad() {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState(() => { 
    try { 
      return JSON.parse(localStorage.getItem('dash-scratchpad-notes') || '[]'); 
    } catch { 
      return []; 
    } 
  });
  const [newNote, setNewNote] = useState('');

  const { settings } = useAppContext();
  const isLeft = settings?.scratchpadPosition === 'left';

  useEffect(() => { 
    localStorage.setItem('dash-scratchpad-notes', JSON.stringify(notes)); 
  }, [notes]);

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes([{ id: Date.now().toString(), text: newNote.trim(), reminderDate: '', createdAt: new Date().toISOString() }, ...notes]);
    setNewNote('');
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <>
      {/* ── Pull-out Tab (Bookmark style) ── */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-1/2 -translate-y-1/2 z-40 transition-all duration-300 flex items-center justify-center 
          bg-amber-500 hover:bg-amber-600 text-white shadow-xl hover:shadow-2xl
          border-y border-amber-600/50 hover:border-amber-400
          ${isLeft ? 'border-r' : 'border-l'}
          ${isOpen 
            ? (isLeft ? 'left-[320px] rounded-r-none rounded-l-xl w-10 h-16' : 'right-[320px] rounded-l-none rounded-r-xl w-10 h-16')
            : (isLeft ? 'left-0 rounded-r-xl rounded-l-none w-10 h-20 opacity-90 hover:opacity-100 hover:w-12' : 'right-0 rounded-l-xl rounded-r-none w-10 h-20 opacity-90 hover:opacity-100 hover:w-12')}
        `}
        title="مفكرة التنبيهات السريعة"
      >
        <FileText className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Slide-over Panel ── */}
      <div 
        className={`fixed top-0 ${isLeft ? 'left-0 border-r' : 'right-0 border-l'} h-full w-80 max-w-[85vw] bg-slate-50 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col border-slate-200
          ${isOpen ? 'translate-x-0' : (isLeft ? '-translate-x-full' : 'translate-x-full')}
        `}
      >
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between mt-12 md:mt-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-sm text-slate-700">مفكرة التنبيهات السريعة</h3>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col h-full flex-1 overflow-hidden">
          <div className="flex items-center justify-between pb-3 mb-3">
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">حفظ محلي</span>
          </div>
          
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newNote} 
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
              placeholder="اكتب ملاحظة سريعة..." 
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition" 
            />
            <button onClick={addNote} className="bg-amber-500 hover:bg-amber-600 text-white font-black px-4 py-2 rounded-xl text-xs transition">إضافة</button>
          </div>
          
          <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar pb-20">
            {notes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <FileText className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400 font-bold">لا توجد ملاحظات.<br/>اكتب ملاحظتك بالأعلى.</p>
              </div>
            ) : notes.map(note => {
              const isAlert = note.reminderDate && note.reminderDate <= todayStr;
              return (
                <div key={note.id} className={`p-3 rounded-xl border flex flex-col gap-2 transition hover:shadow-md ${isAlert ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <p className={`text-xs font-bold flex-1 leading-relaxed ${isAlert ? 'text-rose-900' : 'text-slate-700'}`}>
                      {isAlert && '⏰ '}{note.text}
                    </p>
                    <button onClick={() => setNotes(notes.filter(n => n.id !== note.id))} className="text-slate-300 hover:text-rose-500 hover:bg-rose-100 w-6 h-6 rounded-md flex items-center justify-center transition font-black text-sm shrink-0">×</button>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-1">
                    <span className="text-[9px] font-bold text-slate-400">{new Date(note.createdAt).toLocaleDateString('ar-EG')}</span>
                    <input 
                      type="date" 
                      value={note.reminderDate || ''} 
                      onChange={e => setNotes(notes.map(n => n.id === note.id ? {...n, reminderDate: e.target.value} : n))}
                      className={`border rounded-lg px-2 py-1 text-[10px] font-bold outline-none transition ${isAlert ? 'border-rose-300 bg-rose-50 text-rose-700 focus:border-rose-500' : 'border-slate-200 text-slate-600 bg-slate-50 focus:border-amber-400'}`} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* ── Backdrop for mobile ── */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
