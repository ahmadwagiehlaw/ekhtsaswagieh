import React, { useState, useEffect } from 'react';
import { X, ClipboardList, CheckCircle2, Plus, Trash2, Calendar, Search, Files } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { formatDateString } from '../utils/dateUtils';
import { useLocation } from 'react-router-dom';

export default function Tasks() {
  const { globalTasks, saveGlobalTask, deleteGlobalTask, settings, isAdmin, currentUser, cases, currentUserPermissions } = useAppContext();
  
  const canManageTasks = isAdmin || currentUserPermissions?.canManageTasks;
  const { toast, showConfirm } = useUI();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [isAdding, setIsAdding] = useState(false);
  const [isCaseSelectOpen, setIsCaseSelectOpen] = useState(false);
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    assignee: '',
    dueDate: '',
    priority: 'normal', // 'normal' | 'important' | 'urgent'
    type: 'general', // 'general' | 'case'
    caseId: '', // optional
    linkedCases: [] // array of case IDs
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const caseId = params.get('caseId');
    if (caseId) {
       setIsAdding(true);
       setNewTask(prev => ({ ...prev, linkedCases: [caseId] }));
    }
  }, [location.search]);

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
      setNewTask({ title: '', assignee: '', dueDate: '', priority: 'normal', type: 'general', caseId: '' });
    } catch (e) {
      toast('حدث خطأ أثناء إضافة المهمة', 'error');
    }
  };

  const handleToggleStatus = async (task) => {
    try {
      await saveGlobalTask({
         ...task,
         status: task.status === 'completed' ? 'pending' : 'completed',
         completedAt: task.status !== 'completed' ? new Date().toISOString() : null
      }, task.id);
    } catch (e) {
      toast('حدث خطأ', 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('حذف المهمة', 'هل أنت متأكد من حذف هذه المهمة؟', 'delete_task');
    if (confirmed) {
      const success = await deleteGlobalTask(id);
      if (success) toast('تم الحذف بنجاح', 'success');
    }
  };

  const pendingTasks = globalTasks.filter(t => t.status !== 'completed' && (t.title?.toLowerCase().includes(searchQuery.toLowerCase()) || t.assignee?.toLowerCase().includes(searchQuery.toLowerCase())));
  const completedTasks = globalTasks.filter(t => t.status === 'completed' && (t.title?.toLowerCase().includes(searchQuery.toLowerCase()) || t.assignee?.toLowerCase().includes(searchQuery.toLowerCase())));

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
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-4 mb-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
           </div>
           <div>
              <h2 className="text-navy-900 font-black text-xl">المهام والتكليفات</h2>
              <p className="text-slate-500 text-sm font-bold mt-1">إدارة مهام فريق العمل والملفات</p>
           </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="ابحث في المهام..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-10 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

        {/* Add Task Form (Inline) */}
        {isAdding && canManageTasks && (
          <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden mt-4">
            <div className="bg-indigo-50 px-5 py-4 border-b border-indigo-100">
              <h3 className="font-black text-indigo-900">إضافة مهمة جديدة</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <input 
                   type="text" 
                   placeholder="وصف المهمة (مثال: إعلان صحيفة...)" 
                   value={newTask.title}
                   onChange={e => setNewTask({...newTask, title: e.target.value})}
                   className="flex-[2] bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select 
                   value={newTask.assignee}
                   onChange={e => setNewTask({...newTask, assignee: e.target.value})}
                   className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                   <option value="">إسناد إلى...</option>
                   <option value="المستشار">المستشار</option>
                   {settings?.employees?.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                 <div className="flex-1 flex gap-3">
                   <select 
                      value={newTask.priority}
                      onChange={e => setNewTask({...newTask, priority: e.target.value})}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   >
                      <option value="normal">أولوية عادية</option>
                      <option value="important">مهمة</option>
                      <option value="urgent">عاجلة جداً</option>
                   </select>
                   <input 
                      type="date"
                      value={newTask.dueDate}
                      onChange={e => setNewTask({...newTask, dueDate: e.target.value})}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   />
                 </div>
                 
                 <div className="flex-1 relative">
                    <button
                      type="button"
                      onClick={() => setIsCaseSelectOpen(true)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 text-right flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500 transition hover:bg-slate-100"
                    >
                      <span>
                        {newTask.linkedCases?.length > 0 
                          ? `مرتبطة بـ (${newTask.linkedCases.length}) ملفات` 
                          : 'مهمة عامة (انقر لربط ملفات)'}
                      </span>
                      <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                 </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                  <button onClick={() => setIsAdding(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition">
                     إلغاء
                  </button>
                  <button onClick={handleSaveTask} className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-indigo-600 shadow-sm hover:bg-indigo-700 transition">
                     حفظ المهمة
                  </button>
              </div>
            </div>
          </div>
        )}

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs and Actions */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
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
        <div className="p-5 bg-slate-50/50 min-h-[400px] space-y-3">
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
                            <h4 className={`text-sm sm:text-base font-black ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-navy-900'}`}>
                               {task.title}
                            </h4>
                            {task.linkedCases && task.linkedCases.length > 0 && (
                               <div className="mt-3 flex flex-wrap gap-1.5">
                                 {task.linkedCases.map(caseId => {
                                   const linkedCase = cases.find(c => c.id === caseId);
                                   if (!linkedCase) return null;
                                   return (
                                     <span key={caseId} className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg">
                                       رقم {linkedCase['رقم الدعوى']} لسنة {linkedCase['السنة']}
                                     </span>
                                   );
                                 })}
                               </div>
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
      {/* Case Selection Modal */}
      {isCaseSelectOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm" onClick={() => setIsCaseSelectOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Files className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-navy-900">ربط الدعاوى بالمهمة</h2>
                  <p className="text-xs font-bold text-slate-500">اختر الملفات المرتبطة بهذه المهمة</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCaseSelectOpen(false)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="ابحث برقم الدعوى، الخصوم، أو السنة..."
                  value={caseSearchQuery}
                  onChange={(e) => setCaseSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-4 pr-10 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-2 overflow-y-auto flex-1">
              {cases.filter(c => {
                if (!caseSearchQuery) return true;
                const q = caseSearchQuery.toLowerCase();
                return (c['رقم الدعوى']?.toString().includes(q)) || 
                       (c['السنة']?.toString().includes(q)) ||
                       (c['المدعي']?.toLowerCase().includes(q)) ||
                       (c['المطعون ضده']?.toLowerCase().includes(q));
              }).map(c => {
                const isSelected = newTask.linkedCases?.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (isSelected) {
                        setNewTask({...newTask, linkedCases: newTask.linkedCases.filter(id => id !== c.id)});
                      } else {
                        setNewTask({...newTask, linkedCases: [...(newTask.linkedCases || []), c.id]});
                      }
                    }}
                    className={`w-full text-right p-3 mb-1 rounded-xl border flex items-center justify-between transition ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:bg-slate-50'}`}
                  >
                    <div>
                      <h4 className={`text-sm font-black ${isSelected ? 'text-indigo-900' : 'text-navy-900'}`}>
                        رقم {c['رقم الدعوى'] || c.id} لسنة {c['السنة']}
                      </h4>
                      <p className="text-xs font-bold text-slate-500 mt-1">
                        {c['المدعي']} ضد {c['المطعون ضده']}
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
               <button 
                  onClick={() => setIsCaseSelectOpen(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-black shadow-sm transition"
               >
                  تأكيد الاختيار ({newTask.linkedCases?.length || 0})
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
