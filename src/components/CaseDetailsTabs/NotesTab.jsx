import React, { useState } from 'react';
import { StickyNote, Plus, Edit2, Trash2, Pin, Calendar, X, Check } from 'lucide-react';
import { formatDateString } from '../../utils/dateUtils';

export default function NotesTab({ caseData, saveCaseToFirebase, showConfirm, showPrompt, toast }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentNote, setCurrentNote] = useState({ id: '', title: '', content: '', color: 'bg-amber-50', isPinned: false, date: '' });
  
  const notes = caseData?.notes || [];

  const pastelColors = [
    { value: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', label: 'أصفر' },
    { value: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-800', label: 'أزرق' },
    { value: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', label: 'وردي' },
    { value: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', label: 'أخضر' },
    { value: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', label: 'بنفسجي' },
  ];

  const handleSaveNote = async () => {
    if (!currentNote.content.trim()) {
      toast('لا يمكن حفظ ملاحظة فارغة', 'error');
      return;
    }

    let updatedNotes = [...notes];
    
    if (isEditing) {
      updatedNotes = updatedNotes.map(n => n.id === currentNote.id ? { ...currentNote } : n);
      toast('تم تعديل الملاحظة بنجاح', 'success');
    } else {
      updatedNotes.push({
        ...currentNote,
        id: `note_${Date.now()}`,
        date: new Date().toISOString()
      });
      toast('تمت إضافة الملاحظة بنجاح', 'success');
    }

    await saveCaseToFirebase(caseData.id, { notes: updatedNotes });
    setIsAdding(false);
    setIsEditing(false);
    setCurrentNote({ id: '', title: '', content: '', color: 'bg-amber-50', isPinned: false, date: '' });
  };

  const handleDeleteNote = async (noteId) => {
    const confirm = await showConfirm('حذف الملاحظة', 'هل أنت متأكد من حذف هذه الملاحظة نهائياً؟');
    if (!confirm) return;

    const updatedNotes = notes.filter(n => n.id !== noteId);
    await saveCaseToFirebase(caseData.id, { notes: updatedNotes });
    toast('تم حذف الملاحظة', 'success');
  };

  const handleTogglePin = async (note) => {
    const updatedNotes = notes.map(n => n.id === note.id ? { ...n, isPinned: !n.isPinned } : n);
    await saveCaseToFirebase(caseData.id, { notes: updatedNotes });
  };

  const openEditModal = (note) => {
    setCurrentNote({ ...note });
    setIsEditing(true);
    setIsAdding(true);
  };

  const getColorClasses = (colorValue) => {
    const colorObj = pastelColors.find(c => c.value === colorValue) || pastelColors[0];
    return `${colorObj.value} ${colorObj.border} ${colorObj.text}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black text-navy-900 flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-indigo-500" />
          ملاحظات الدعوى
        </h2>
        <button
          onClick={() => {
            setCurrentNote({ id: '', title: '', content: '', color: 'bg-amber-50', isPinned: false, date: '' });
            setIsEditing(false);
            setIsAdding(true);
          }}
          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> إضافة ملاحظة
        </button>
      </div>

      {notes.length === 0 && !isAdding ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
          <StickyNote className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-bold text-slate-500 mb-1">لا توجد ملاحظات</h3>
          <p className="text-sm text-slate-400">أضف ملاحظات سريعة لتذكر التفاصيل الهامة حول هذه الدعوى.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
            <div key={note.id} className={`relative rounded-2xl border p-4 shadow-sm group hover:shadow-md transition cursor-pointer flex flex-col ${getColorClasses(note.color)}`} onClick={() => openEditModal(note)}>
              {/* Note Header / Actions */}
              <div className="flex justify-between items-start mb-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}
                  className={`p-1.5 rounded-lg transition-colors ${note.isPinned ? 'bg-amber-400 text-white shadow-sm' : 'bg-white/50 text-slate-400 hover:bg-white hover:text-amber-500'}`}
                  title={note.isPinned ? "إلغاء التثبيت" : "تثبيت كـ (هام جداً)"}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); openEditModal(note); }} className="p-1.5 bg-white/50 hover:bg-white rounded-lg text-indigo-600 transition" title="تعديل">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }} className="p-1.5 bg-white/50 hover:bg-rose-500 hover:text-white rounded-lg text-rose-500 transition" title="حذف">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              {/* Note Content */}
              <div className="flex-1">
                {note.title && (
                  <h4 className="font-black text-sm mb-1.5 opacity-90">{note.title}</h4>
                )}
                <div className="whitespace-pre-wrap text-sm font-bold leading-relaxed mb-4">
                  {note.content}
                </div>
              </div>
              
              {/* Note Footer */}
              <div className="flex items-center gap-1 text-[10px] opacity-60 font-black mt-auto pt-3 border-t border-current border-opacity-10">
                <Calendar className="w-3 h-3" />
                {formatDateString(note.date)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsAdding(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 bg-navy-900 flex justify-between items-center">
              <h3 className="font-black text-amber-300 text-sm flex items-center gap-2">
                <StickyNote className="w-4 h-4" />
                {isEditing ? 'تعديل الملاحظة' : 'ملاحظة جديدة'}
              </h3>
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <input
                type="text"
                value={currentNote.title || ''}
                onChange={(e) => setCurrentNote({ ...currentNote, title: e.target.value })}
                placeholder="عنوان الملاحظة (اختياري)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-black text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              />
              <textarea
                value={currentNote.content}
                onChange={(e) => setCurrentNote({ ...currentNote, content: e.target.value })}
                placeholder="اكتب ملاحظتك هنا..."
                className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
                autoFocus
              ></textarea>
              
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-500">اللون:</span>
                  <div className="flex gap-1.5">
                    {pastelColors.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setCurrentNote({ ...currentNote, color: c.value })}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${c.value} ${currentNote.color === c.value ? 'border-indigo-500 scale-110' : 'border-transparent hover:scale-110'}`}
                        title={c.label}
                      ></button>
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={() => setCurrentNote({ ...currentNote, isPinned: !currentNote.isPinned })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition ${currentNote.isPinned ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  <Pin className="w-3.5 h-3.5" />
                  تثبيت كـ (هام)
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setIsAdding(false)} className="px-5 py-2.5 rounded-xl text-sm font-black text-slate-500 hover:bg-slate-200 transition">
                إلغاء
              </button>
              <button onClick={handleSaveNote} className="px-5 py-2.5 rounded-xl text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 transition">
                <Check className="w-4 h-4" /> حفظ الملاحظة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
