import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Camera, Settings, Plus, FileText, Upload, Circle, CheckSquare, Settings2, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import UploadDocumentModal from './UploadDocumentModal';

const DEFAULT_CHECKLIST = [
  'صحيفة الطعن', 'تقرير مفوضين', 'مذكرة دفاع', 'مذكرة ختامية', 
  'تقرير الخبراء', 'تعجيل من الوقف', 'مذكرة تكميلية', 'مذكرة رأي',
  'حافظة مستندات', 'مسودة حكم', 'فتح باب مرافعة', 'محضر الجلسة',
  'مستندات الخصم', 'مذكرات الخصم'
];

export default function CasePaperFileModal({ isOpen, onClose, caseData }) {
  const { saveCaseToFirebase, settings, saveSettingsToFirebase, viewingTasks, saveViewingTask, completeViewingTask, deleteViewingTask, currentUser } = useAppContext();
  const { toast } = useUI();

  const [activeUploadTask, setActiveUploadTask] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  if (!isOpen || !caseData) return null;

  const checklist = settings?.paperFileChecklist || DEFAULT_CHECKLIST;
  const paperFileContents = caseData.paperFileContents || [];

  const caseViewingTasks = viewingTasks?.filter(t => t.linkedCases?.includes(caseData.id)) || [];
  const pendingTasks = caseViewingTasks.filter(t => t.status !== 'completed');
  const completedTasks = caseViewingTasks.filter(t => t.status === 'completed');

  const toggleChecklistItem = async (item) => {
    let newContents = [...paperFileContents];
    if (newContents.includes(item)) {
      newContents = newContents.filter(i => i !== item);
    } else {
      newContents.push(item);
    }
    await saveCaseToFirebase(caseData.id, { paperFileContents: newContents });
  };

  const handleCompleteWithoutFile = async (task) => {
    await completeViewingTask(task.id, true);
    toast('تم إنجاز مهمة الإطلاع بنجاح', 'success');
  };

  const handleDeleteTask = async (taskId) => {
    if(window.confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
      await deleteViewingTask(taskId);
      toast('تم حذف المهمة', 'success');
    }
  }

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    const newList = [...checklist, newChecklistItem.trim()];
    await saveSettingsToFirebase({ paperFileChecklist: newList });
    setNewChecklistItem('');
  };

  const handleDeleteChecklistItem = async (item) => {
    const newList = checklist.filter(i => i !== item);
    await saveSettingsToFirebase({ paperFileChecklist: newList });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] max-w-4xl bg-slate-50 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-navy-900">أوراق الملف ومهام الإطلاع</h2>
              <p className="text-xs font-bold text-slate-500">رقم {caseData['رقم الدعوى']} لسنة {caseData['السنة']}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 hide-scrollbar flex flex-col lg:flex-row gap-6">
          
          {/* Right Column: Paper File Contents (Checklist) */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="font-black text-navy-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-600" />
                محتويات الملف الورقي
              </h3>
              <button 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                title="تعديل القائمة"
              >
                <Settings2 className="w-5 h-5" />
              </button>
            </div>

            {isSettingsOpen && (
              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in">
                <h4 className="text-xs font-black text-slate-600 mb-2">إدارة القائمة:</h4>
                <div className="flex gap-2 mb-3">
                  <input 
                    type="text"
                    value={newChecklistItem}
                    onChange={e => setNewChecklistItem(e.target.value)}
                    placeholder="إضافة عنصر جديد..."
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold"
                  />
                  <button onClick={handleAddChecklistItem} className="bg-indigo-600 text-white px-3 rounded-lg text-xs font-bold">إضافة</button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {checklist.map(item => (
                    <div key={item} className="flex justify-between items-center text-xs font-bold text-slate-600 p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200">
                      <span>{item}</span>
                      <button onClick={() => handleDeleteChecklistItem(item)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {checklist.map(item => {
                const isChecked = paperFileContents.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => toggleChecklistItem(item)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-right transition-all ${
                      isChecked 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-colors ${
                      isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'
                    }`}>
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-sm font-bold flex-1 truncate">{item}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Left Column: Viewing Tasks */}
          <div className="flex-[0.8] flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex-1">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <h3 className="font-black text-navy-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  مهام الإطلاع (للملف)
                </h3>
                <button 
                  onClick={async () => {
                    const taskObj = {
                      id: `viewing-${caseData.id}-${Date.now()}`,
                      title: 'مهمة إطلاع وتصوير مستندات',
                      status: 'pending',
                      type: 'viewing',
                      linkedCases: [caseData.id],
                      createdAt: new Date().toISOString(),
                      createdBy: currentUser || 'مجهول',
                    };
                    await saveViewingTask(taskObj);
                    toast('تم إضافة مهمة إطلاع جديدة', 'success');
                  }}
                  className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة مهمة
                </button>
              </div>

              {pendingTasks.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {pendingTasks.map(task => (
                    <div key={task.id} className="p-3 bg-amber-50 border border-amber-200 rounded-xl relative group">
                      <div className="flex justify-between items-start mb-2">
                         <h4 className="font-black text-sm text-amber-900">{task.title}</h4>
                         <button onClick={() => handleDeleteTask(task.id)} className="text-amber-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-4 h-4"/></button>
                      </div>
                      {task.notes && <p className="text-xs font-bold text-amber-700/80 mb-3">{task.notes}</p>}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button 
                          onClick={() => {
                            setActiveUploadTask(task);
                            setIsUploadModalOpen(true);
                          }}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <Upload className="w-4 h-4" /> إرفاق وإتمام
                        </button>
                        <button 
                          onClick={() => handleCompleteWithoutFile(task)}
                          className="flex-1 bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <CheckCircle2 className="w-4 h-4" /> إتمام فقط
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed mb-6">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">لا توجد مهام إطلاع معلقة</p>
                </div>
              )}

              {completedTasks.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-slate-500 mb-3 border-b border-slate-100 pb-1">مهام مكتملة</h4>
                  <div className="space-y-2">
                    {completedTasks.map(task => (
                      <div key={task.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center opacity-70">
                        <span className="text-xs font-bold text-slate-600 line-through truncate flex-1">{task.title}</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setActiveUploadTask(null);
        }}
        caseData={caseData}
        initialDocType="تصوير مستندات"
        onSuccess={async (newDoc) => {
          if (activeUploadTask) {
            await completeViewingTask(activeUploadTask.id, true);
          }
          // Also automatically check the paper checklist if matches
          const currentPaperFiles = caseData.paperFileContents || [];
          if (checklist.includes(newDoc.type) && !currentPaperFiles.includes(newDoc.type)) {
             await saveCaseToFirebase(caseData.id, { paperFileContents: [...currentPaperFiles, newDoc.type] });
          }
          toast("تم الإرفاق وإنجاز المهمة بنجاح", "success");
        }}
      />
    </div>
  );
}
