import React, { useState } from 'react';
import { X, ClipboardList, CheckCircle2, Plus, Trash2, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useGeneralTasks } from '../hooks/useGeneralTasks';
import { useUI } from '../context/UIContext';
import { formatDateString } from '../utils/dateUtils';

export default function GlobalTasksModal({ isOpen, onClose }) {
  const { completeTask, uncompleteTask, saveTask, deleteTask } = useGeneralTasks();
  const { globalTasks, PREDEFINED_TASKS, settings, isAdmin, currentUser, currentUserPermissions } = useAppContext();
  const canManageTasks = isAdmin || currentUserPermissions?.canManageTasks;
  const { toast, showConfirm } = useUI();
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    assignee: '',
    dueDate: '',
    priority: 'normal', // 'normal' | 'important' | 'urgent'
    type: 'general', // 'general' | 'case'
    caseId: '', // optional
    description: '',
  });

  if (!isOpen) return null;

  const handleSaveTask = async () => {
    if (!newTask.title.trim()) {
      toast('يرجى إدخال عنوان المهمة', 'error');
      return;
    }
    
    try {
      await saveGlobalTask({
         ...newTask,
         status: 'pending',
         createdAt: new Date().toISOString(),
         createdBy: currentUser || 'مجهول'
      });
      toast('تمت إضافة المهمة بنجاح', 'success');
      setIsAdding(false);
      setNewTask({ title: '', assignee: '', dueDate: '', priority: 'normal', type: 'general', caseId: '', description: '' });
    } catch (e) {
      toast('حدث خطأ أثناء إضافة المهمة', 'error');
    }
  };

  const handleToggleStatus = async (task) => {
    try {
      if (task.status !== 'completed') {
        await completeGlobalTask(task.id, '');
      } else {
        await saveGlobalTask({
          ...task,
          status: 'pending',
          completedAt: null
        }, task.id);
      }
    } catch (e) {
      toast('حدث خطأ', 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('حذف المهمة', 'هل أنت متأكد من حذف هذه المهمة؟', 'delete_task');
    if (confirmed) {
      const success = await deleteTask(id, true);
      if (success) toast('تم الحذف بنجاح', 'success');
    }
  };

  const pendingTasks = globalTasks.filter(t => t.status !== 'completed');
  const completedTasks = globalTasks.filter(t => t.status === 'completed');

  const displayTasks = activeTab === 'pending' ? pendingTasks : completedTasks;

  const getPriorityColors = (p) => {
    if (p === 'urgent') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (p === 'important') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-blue-50 text-blue-600 border-blue-200';
  };

  const getPriorityLabel = (p) => {
    if (p === 'urgent') return 'عاجل جداً';
    if (p === 'important') return 'هام';
    return 'عادية';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl h-[85vh] sm:h-auto sm:max-h-[85vh] border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-navy-900 px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-indigo-300" />
             </div>
             <div>
                <h2 className="text-white font-black text-lg">المهام والتكليفات</h2>
                <p className="text-indigo-200 text-xs font-bold mt-0.5">سجل المهام للإدارة والمستشار</p>
             </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">
             <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Task Form (Inline) */}
        {isAdding && canManageTasks && (
          <div className="bg-indigo-50/50 p-5 border-b border-indigo-100 shrink-0 space-y-3">
            <h3 className="font-black text-indigo-900 text-sm">مهمة جديدة</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-[2] relative">
                <input 
                   type="text" 
                   list="global-predefined-tasks"
                   placeholder="وصف المهمة (مثال: إعلان صحيفة...)" 
                   value={newTask.title}
                   onChange={e => setNewTask({...newTask, title: e.target.value})}
                   className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="global-predefined-tasks">
                  {PREDEFINED_TASKS?.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <select 
                 value={newTask.assignee}
                 onChange={e => setNewTask({...newTask, assignee: e.target.value})}
                 className="flex-1 bg-white border border-indigo-200 rounded-xl px-4 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                 <option value="">إسناد إلى...</option>
                 <option value="المستشار">المستشار</option>
                 {settings?.employees?.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <textarea
                placeholder="تفاصيل أو وصف المهمة (اختياري)..."
                value={newTask.description}
                onChange={e => setNewTask({...newTask, description: e.target.value})}
                className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px]"
                rows={2}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
               <div className="flex-1 flex gap-2">
                 <select 
                    value={newTask.priority}
                    onChange={e => setNewTask({...newTask, priority: e.target.value})}
                    className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 >
                    <option value="normal">أولوية عادية</option>
                    <option value="important">مهمة</option>
                    <option value="urgent">عاجلة جداً</option>
                 </select>
                 <input 
                    type="date"
                    value={newTask.dueDate}
                    onChange={e => setNewTask({...newTask, dueDate: e.target.value})}
                    className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 />
               </div>
               <div className="flex gap-2">
                  <button onClick={() => setIsAdding(false)} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition">
                     إلغاء
                  </button>
                  <button onClick={handleSaveTask} className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 shadow-sm hover:bg-indigo-700 transition">
                     حفظ المهمة
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* Tabs and Actions */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveTab('pending')}
               className={`px-4 py-2 rounded-lg text-xs font-black transition ${activeTab === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               قيد التنفيذ ({pendingTasks.length})
             </button>
             <button 
               onClick={() => setActiveTab('completed')}
               className={`px-4 py-2 rounded-lg text-xs font-black transition ${activeTab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               مكتملة ({completedTasks.length})
             </button>
          </div>
          {canManageTasks && !isAdding && (
             <button 
               onClick={() => setIsAdding(true)}
               className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition"
             >
               <Plus className="w-4 h-4" /> إضافة مهمة
             </button>
          )}
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-3">
          {displayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
               <ClipboardList className="w-12 h-12 mb-3 opacity-20" />
               <p className="font-bold text-sm">لا توجد مهام في هذه القائمة.</p>
            </div>
          ) : (
            displayTasks.map(task => (
               <div key={task.id} className={`bg-white p-4 rounded-2xl border transition-all ${task.status === 'completed' ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-200 hover:shadow-sm'}`}>
                  <div className="flex items-start justify-between gap-4">
                     <div className="flex items-start gap-3 flex-1">
                        <button 
                           onClick={() => canManageTasks || task.assignee === currentUser ? handleToggleStatus(task) : null}
                           disabled={!canManageTasks && task.assignee !== currentUser}
                           className={`shrink-0 mt-0.5 rounded-full transition-colors ${(canManageTasks || task.assignee === currentUser) ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
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
                           <h4 className={`text-sm font-black ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-navy-900'} leading-tight`}>
                             {task.title}
                           </h4>
                           {task.description && (
                             <p className="text-xs font-bold text-slate-500 mt-1 whitespace-pre-wrap">
                               {task.description}
                             </p>
                           )}
                        </div>
                     </div>
                     {canManageTasks && (
                        <button onClick={() => handleDelete(task.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
                           <Trash2 className="w-4 h-4" />
                        </button>
                     )}
                  </div>
               </div>
            ))
          )}
        </div>
        
      </div>
    </div>
  );
}
