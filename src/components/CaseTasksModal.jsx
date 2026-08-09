import React, { useState } from 'react';
import { X, ClipboardList, CheckCircle2, Plus, Calendar, Trash2, FileText, Search, Eye, Bell, Camera, Edit3 } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { formatDateString } from '../utils/dateUtils';
import UploadDocumentModal from './UploadDocumentModal';

export default function CaseTasksModal({ isOpen, onClose, caseData }) {
  const { globalTasks, saveGlobalTask, deleteGlobalTask, completeGlobalTask, currentUser, settings, isAdmin, currentUserPermissions } = useAppContext();
  const { toast, showConfirm } = useUI();
  
  const canManageTasks = isAdmin || currentUserPermissions?.canManageTasks;

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [isAdding, setIsAdding] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeUploadTask, setActiveUploadTask] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    notes: '',
    assignee: '',
    dueDate: '',
    priority: 'normal', // 'normal' | 'important' | 'urgent'
    description: '',
  });

  if (!isOpen || !caseData) return null;

  const caseTasks = globalTasks.filter(t => t.linkedCases?.includes(caseData.id));
  const pendingTasks = caseTasks.filter(t => t.status === 'pending');
  const completedTasks = caseTasks.filter(t => t.status === 'completed');

  const displayTasks = activeTab === 'pending' ? pendingTasks : completedTasks;

  const handleAddTask = async (e) => {
    if (e) e.preventDefault();
    if (!newTask.title.trim()) {
      toast("يرجى كتابة عنوان المهمة", "error");
      return;
    }

    const taskObj = {
      id: editingTaskId || `task-${Date.now()}`,
      title: newTask.title,
      notes: newTask.notes,
      description: newTask.description || '',
      assignee: newTask.assignee || '',
      dueDate: newTask.dueDate || '',
      priority: newTask.priority,
      status: editingTaskId ? (globalTasks.find(t => t.id === editingTaskId)?.status || 'pending') : 'pending',
      type: editingTaskId ? (globalTasks.find(t => t.id === editingTaskId)?.type || newTask.type || 'general') : (newTask.type || 'general'),
      linkedCases: [caseData.id],
      createdAt: editingTaskId ? (globalTasks.find(t => t.id === editingTaskId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      createdBy: editingTaskId ? (globalTasks.find(t => t.id === editingTaskId)?.createdBy || currentUser) : (currentUser || 'مجهول'),
      caseContext: {
        roll: caseData['الرول'] || caseData['رول الجلسة'] || '',
        date: caseData['تاريخ الجلسة'] || '',
        decision: caseData['القرار'] || caseData['قرار الجلسة'] || ''
      }
    };

    const success = await saveGlobalTask(taskObj);
    if (success) {
      toast(editingTaskId ? "تم تعديل المهمة بنجاح" : "تمت إضافة المهمة بنجاح", "success");
      setNewTask({ title: '', notes: '', description: '', assignee: '', dueDate: '', priority: 'normal' });
      setIsAdding(false);
      setEditingTaskId(null);
      setActiveTab(taskObj.status === 'completed' ? 'completed' : 'pending');
    } else {
      toast("حدث خطأ أثناء إضافة المهمة", "error");
    }
  };

  const handleDelete = async (taskId) => {
    const confirmed = await showConfirm("تأكيد الحذف", "هل أنت متأكد من حذف هذه المهمة نهائياً؟");
    if (confirmed) {
      const success = await deleteGlobalTask(taskId);
      if (success) toast("تم حذف المهمة بنجاح", "success");
    }
  };

  const toggleTaskSelection = (taskId) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    const confirmed = await showConfirm("تأكيد الحذف الجماعي", `هل أنت متأكد من حذف ${selectedTaskIds.length} مهمة نهائياً؟`);
    if (confirmed) {
      let count = 0;
      for (const id of selectedTaskIds) {
        const success = await deleteGlobalTask(id);
        if (success) count++;
      }
      setSelectedTaskIds([]);
      toast(`تم حذف ${count} مهام بنجاح`, "success");
    }
  };

  const handleToggleStatus = async (task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending';
    const success = await completeGlobalTask(task.id, newStatus === 'completed');
    if (success) {
      toast(newStatus === 'completed' ? "تم إنجاز المهمة" : "تمت إعادة المهمة", "success");
    }
  };

  const getPriorityColors = (p) => {
    if (p === 'urgent') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (p === 'important') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };
  
  const getPriorityLabel = (p) => {
    if (p === 'urgent') return 'عاجلة';
    if (p === 'important') return 'هامة';
    return 'عادية';
  };

  const quickTemplates = [
    { label: 'إطلاع', icon: Eye, color: 'text-amber-500 bg-amber-50', value: `مهمة إطلاع: دعوى ${caseData['رقم الدعوى'] || ''} لسنة ${caseData['السنة'] || ''}` },
    { label: 'تصوير مستندات', icon: FileText, color: 'text-blue-500 bg-blue-50', value: `تصوير مستندات ملف: دعوى ${caseData['رقم الدعوى'] || ''} لسنة ${caseData['السنة'] || ''}` },
    { label: 'كتابة مذكرة', icon: ClipboardList, color: 'text-indigo-500 bg-indigo-50', value: `كتابة مذكرة: دعوى ${caseData['رقم الدعوى'] || ''} لسنة ${caseData['السنة'] || ''}` },
    { label: 'إعلان بالدعوى', icon: Bell, color: 'text-rose-500 bg-rose-50', value: `إعلان بالدعوى: دعوى ${caseData['رقم الدعوى'] || ''} لسنة ${caseData['السنة'] || ''}` },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] max-w-4xl bg-slate-50 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-navy-900">مهام الدعوى</h2>
              <p className="text-xs font-bold text-slate-500">رقم {caseData['رقم الدعوى']} لسنة {caseData['السنة']}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 hide-scrollbar">
          
          {canManageTasks && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="w-full bg-indigo-50/50 hover:bg-indigo-50 p-4 flex items-center justify-between transition-colors border-b border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-black text-indigo-700">{editingTaskId ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h3>
                </div>
              </button>
              
              {isAdding && (
                <div className="p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs font-bold text-slate-500 py-1.5 shrink-0">مهام سريعة:</span>
                    {quickTemplates.map((t, i) => (
                      <button 
                        key={i}
                        type="button"
                        onClick={() => setNewTask({...newTask, title: t.value, type: t.label === 'إطلاع' ? 'viewing' : 'general'})}
                        className={`flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-200 transition ${t.color}`}
                      >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAddTask} className="space-y-4">
                    <div>
                      <input 
                        type="text"
                        placeholder="عنوان المهمة (مثال: استخراج شهادة)..."
                        value={newTask.title}
                        onChange={e => setNewTask({...newTask, title: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <textarea
                        placeholder="وصف أو تفاصيل المهمة (اختياري)..."
                        value={newTask.description}
                        onChange={e => setNewTask({...newTask, description: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px]"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select 
                        value={newTask.assignee}
                        onChange={e => setNewTask({...newTask, assignee: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">إسناد إلى...</option>
                        {settings?.employees?.map(emp => (
                          <option key={emp.name} value={emp.name}>{emp.name}</option>
                        ))}
                      </select>
                      <input 
                        type="date"
                        value={newTask.dueDate}
                        onChange={e => setNewTask({...newTask, dueDate: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <select 
                        value={newTask.priority}
                        onChange={e => setNewTask({...newTask, priority: e.target.value})}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="normal">أولوية عادية</option>
                        <option value="important">أولوية هامة</option>
                        <option value="urgent">أولوية عاجلة</option>
                      </select>
                    </div>
                    <div>
                      <input 
                        type="text"
                        placeholder="ملاحظات تفصيلية (اختياري)..."
                        value={newTask.notes}
                        onChange={e => setNewTask({...newTask, notes: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setIsAdding(false);
                          setEditingTaskId(null);
                          setNewTask({ title: '', notes: '', assignee: '', dueDate: '', priority: 'normal' });
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
                      >
                        إلغاء
                      </button>
                      <button 
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-xs font-black shadow-sm transition"
                      >
                        حفظ المهمة
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 min-h-[40vh]">
            <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
              <button 
                onClick={() => setActiveTab('pending')}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition ${activeTab === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                قيد التنفيذ ({pendingTasks.length})
              </button>
              <button 
                onClick={() => setActiveTab('completed')}
                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition ${activeTab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                مكتملة ({completedTasks.length})
              </button>
            </div>

            {selectedTaskIds.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between mb-3 animate-in fade-in">
                  <span className="text-sm font-black text-indigo-700">تم تحديد {selectedTaskIds.length} مهام</span>
                  <button 
                    onClick={handleBulkDelete}
                    className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف المحدد
                  </button>
                </div>
              )}

            <div className="space-y-3">
              {displayTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-400">لا توجد مهام في هذه القائمة</p>
                </div>
              ) : (
                displayTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(task => (
                  <div key={task.id} className={`p-4 rounded-2xl border transition-all ${task.status === 'completed' ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md'} ${selectedTaskIds.includes(task.id) ? 'ring-2 ring-indigo-400' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {canManageTasks && (
                          <input 
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            onChange={() => toggleTaskSelection(task.id)}
                            className="mt-1.5 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        )}
                        <button 
                          onClick={() => canManageTasks ? handleToggleStatus(task) : null}
                          disabled={!canManageTasks}
                          className={`mt-1 shrink-0 ${!canManageTasks ? 'cursor-not-allowed opacity-50' : 'hover:scale-110 transition-transform'} ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
                        >
                          <CheckCircle2 className="w-6 h-6" />
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                              المكلف: {task.assignee || 'غير محدد'}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${getPriorityColors(task.priority)}`}>
                              {getPriorityLabel(task.priority)}
                            </span>
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                <Calendar className="w-3 h-3" /> {formatDateString(task.dueDate)}
                              </span>
                            )}
                          </div>
                          <h4 className={`font-black text-sm ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-navy-900'} leading-relaxed`}>
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-xs font-bold text-slate-500 mt-1 whitespace-pre-wrap">
                              {task.description}
                            </p>
                          )}
                          {task.notes && (
                            <p className="text-xs font-bold text-slate-500 mt-1 bg-slate-50 p-2 rounded border border-slate-100 inline-block">
                              {task.notes}
                            </p>
                          )}
                          {task.type === 'viewing' && task.status === 'pending' && canManageTasks && (
                            <button
                              onClick={() => {
                                setActiveUploadTask(task);
                                setIsUploadModalOpen(true);
                              }}
                              className="mt-2 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition border border-indigo-200"
                            >
                              <Camera className="w-3.5 h-3.5" /> إتمام وإرفاق المستندات
                            </button>
                          )}
                        </div>
                      </div>
                      {canManageTasks && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <button 
                            onClick={() => {
                              setEditingTaskId(task.id);
                              setNewTask({
                                title: task.title,
                                notes: task.notes || '',
                                assignee: task.assignee || '',
                                dueDate: task.dueDate || '',
                                priority: task.priority || 'normal'
                              });
                              setIsAdding(true);
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="تعديل المهمة"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(task.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="حذف المهمة">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
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
        onSuccess={async () => {
          if (activeUploadTask) {
            await completeGlobalTask(activeUploadTask.id, true);
            toast("تم الإرفاق وإنجاز المهمة بنجاح", "success");
          }
        }}
      />
    </div>
  );
}
