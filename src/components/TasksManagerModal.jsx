import React, { useState, useEffect, useMemo } from 'react';
import { X, ClipboardList, CheckCircle2, Plus, Trash2, Calendar, Search, Files, Printer, Camera, Edit, FolderOpen, Folder, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { formatDateString } from '../utils/dateUtils';
import { useLocation } from 'react-router-dom';
import UploadDocumentModal from './UploadDocumentModal';

const EgyptianDateInput = ({ value, onChange, className }) => {
  const inputRef = React.useRef(null);
  
  const displayValue = useMemo(() => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (!isNaN(d)) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    } catch(e){}
    return value;
  }, [value]);

  const handleClick = (e) => {
    e.preventDefault();
    if (inputRef.current) {
      try {
        if (typeof inputRef.current.showPicker === 'function') {
          inputRef.current.showPicker();
        } else {
          inputRef.current.focus();
        }
      } catch (err) {
        inputRef.current.focus();
      }
    }
  };

  return (
    <div 
      className={`relative flex items-center justify-between cursor-pointer ${className}`}
      onClick={handleClick}
    >
      <span className={!value ? 'text-slate-400' : 'text-navy-900'}>
        {displayValue || 'DD/MM/YYYY'}
      </span>
      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
      
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        onChange={onChange}
        className="absolute bottom-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />
    </div>
  );
};

export default function TasksManagerModal({ isOpen, onClose }) {
  const { globalTasks, saveGlobalTask, completeGlobalTask, PREDEFINED_TASKS, deleteGlobalTask, settings, isAdmin, currentUser, currentUserName, cases, currentUserPermissions,
    viewingTasks, saveViewingTask, deleteViewingTask, completeViewingTask } = useAppContext();

  const canManageTasks = isAdmin || currentUserPermissions?.canManageTasks;
  const { toast, showConfirm } = useUI();
  const location = useLocation();

  const [activeMainTab, setActiveMainTab] = useState('general'); // 'general' | 'viewing'
  const [activeSubTab, setActiveSubTab] = useState('pending'); // 'pending' | 'completed'

  const userEmail = currentUser || '';
  const usernameOnly = userEmail.split('@')[0];
  const isAssignedToMe = (assignee) => {
    if (!assignee) return false;
    const ass = assignee.toLowerCase().trim();
    return ass === userEmail.toLowerCase().trim() ||
           ass === usernameOnly.toLowerCase().trim() ||
           ass === (currentUserName || '').toLowerCase().trim();
  };

  const [isAdding, setIsAdding] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isCaseSelectOpen, setIsCaseSelectOpen] = useState(false);
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeUploadTask, setActiveUploadTask] = useState(null);
  const [activeUploadCase, setActiveUploadCase] = useState(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Grouping state
  const [expandedGroups, setExpandedGroups] = useState({});
  const [bulkEditGroup, setBulkEditGroup] = useState(null);
  const [bulkEditNewDate, setBulkEditNewDate] = useState('');

  const [newTask, setNewTask] = useState({
    title: '',
    assignee: '',
    dueDate: '',
    sessionDate: '',
    priority: 'normal',
    type: 'general',
    caseId: '',
    linkedCases: [],
    notes: '',
    description: ''
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const caseId = params.get('caseId');
    if (caseId) {
      setIsAdding(true);
      setNewTask(prev => ({ ...prev, linkedCases: [caseId] }));
    }
  }, [location.search]);

  const handleEditTask = (task) => {
    setEditingTaskId(task.id);
    setNewTask({
      title: task.title || '',
      assignee: task.assignee || '',
      dueDate: task.dueDate || '',
      sessionDate: task.sessionDate || task.caseContext?.date || '',
      priority: task.priority || 'normal',
      type: task.type || 'general',
      caseId: task.caseId || '',
      linkedCases: task.linkedCases || [],
      notes: task.notes || '',
      description: task.description || ''
    });
    setIsAdding(true);
    // If editing from viewing tab stay in viewing tab
    setActiveMainTab(activeMainTab);
  };

  const handleSaveTask = async () => {
    if (!newTask.title.trim() && activeMainTab !== 'viewing') {
      toast('يرجى إدخال عنوان المهمة', 'error');
      return;
    }
    if (activeMainTab === 'viewing' && newTask.linkedCases.length === 0) {
      toast('يجب ربط ملف واحد على الأقل بمهمة الاطلاع', 'error');
      return;
    }

    try {
      if (activeMainTab === 'viewing') {
        // ─── مهمة إطلاع — نظام مستقل ───
        const taskToSave = { ...newTask, type: 'viewing', title: 'إطلاع وتصوير مستندات' };
        if (editingTaskId) {
          const existingTask = viewingTasks.find(t => t.id === editingTaskId);
          await saveViewingTask({ ...existingTask, ...taskToSave, updatedAt: new Date().toISOString() });
          toast('تم تعديل مهمة الإطلاع بنجاح', 'success');
        } else {
          await saveViewingTask({ ...taskToSave, id: `viewing-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString(), createdBy: currentUser || 'مجهول' });
          toast('تمت إضافة مهمة الإطلاع بنجاح', 'success');
        }
      } else {
        // ─── مهمة عادية — نظام مستقل ───
        const taskToSave = { ...newTask, type: 'general' };
        if (editingTaskId) {
          const existingTask = globalTasks.find(t => t.id === editingTaskId);
          await saveGlobalTask({ ...existingTask, ...taskToSave, updatedAt: new Date().toISOString() }, editingTaskId);
          toast('تم تعديل المهمة بنجاح', 'success');
        } else {
          await saveGlobalTask({ ...taskToSave, status: 'pending', createdAt: new Date().toISOString(), createdBy: currentUser || 'مجهول' });
          toast('تمت إضافة المهمة بنجاح', 'success');
        }
      }
      setIsAdding(false);
      setEditingTaskId(null);
      setNewTask({ title: '', assignee: '', dueDate: '', sessionDate: '', priority: 'normal', type: 'general', caseId: '', linkedCases: [], notes: '', description: '' });
    } catch (e) {
      toast('حدث خطأ أثناء حفظ المهمة', 'error');
    }
  };

  const handleToggleStatus = async (task) => {
    try {
      if (activeMainTab === 'viewing') {
        await completeViewingTask(task.id, task.status !== 'completed');
      } else {
        if (task.status !== 'completed') {
          await completeGlobalTask(task.id, task.notes);
        } else {
          await saveGlobalTask({ ...task, status: 'pending', completedAt: null }, task.id);
        }
      }
    } catch (e) {
      toast('حدث خطأ', 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذه المهمة نهائياً؟', 'delete_task');
    if (confirmed) {
      let success;
      if (activeMainTab === 'viewing') {
        success = await deleteViewingTask(id);
      } else {
        success = await deleteGlobalTask(id);
      }
      if (success) toast('تم حذف المهمة بنجاح', 'success');
    }
  };

  const toggleTaskSelection = (taskId) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const handleToggleFolderSelection = (e, taskIdsInFolder) => {
    e.stopPropagation();
    const allSelected = taskIdsInFolder.every(id => selectedTaskIds.includes(id));
    if (allSelected) {
      setSelectedTaskIds(prev => prev.filter(id => !taskIdsInFolder.includes(id)));
    } else {
      setSelectedTaskIds(prev => [...new Set([...prev, ...taskIdsInFolder])]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    const confirmed = await showConfirm("تأكيد الحذف الجماعي", `هل أنت متأكد من حذف ${selectedTaskIds.length} مهمة نهائياً؟`);
    if (confirmed) {
      let count = 0;
      for (const id of selectedTaskIds) {
        let success;
        if (activeMainTab === 'viewing') {
          success = await deleteViewingTask(id);
        } else {
          success = await deleteGlobalTask(id);
        }
        if (success) count++;
      }
      setSelectedTaskIds([]);
      toast(`تم حذف ${count} مهام بنجاح`, "success");
    }
  };

  const handleBulkComplete = async () => {
    if (selectedTaskIds.length === 0) return;
    const confirmed = await showConfirm("تأكيد الإنجاز", `هل أنت متأكد من تسجيل ${selectedTaskIds.length} مهام كمكتملة؟`);
    if (confirmed) {
      let count = 0;
      for (const id of selectedTaskIds) {
        if (activeMainTab === 'viewing') {
          const t = viewingTasks.find(task => task.id === id);
          if (t && t.status !== 'completed') { await completeViewingTask(id, true); count++; }
        } else {
          const t = globalTasks.find(task => task.id === id);
          if (t && t.status !== 'completed') { await completeGlobalTask(id, t.notes); count++; }
        }
      }
      setSelectedTaskIds([]);
      toast(`تم إنجاز ${count} مهام بنجاح`, "success");
    }
  };

  // 1. Filtering Logic Update
  const generalTasks = globalTasks.filter(t =>
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.assignee?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredViewingTasks = viewingTasks.filter(t =>
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.assignee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTaskList = activeMainTab === 'general' ? generalTasks : filteredViewingTasks;
  const displayTasks = activeTaskList.filter(t => activeSubTab === 'pending' ? t.status !== 'completed' : t.status === 'completed');

  const pendingCount = activeTaskList.filter(t => t.status !== 'completed').length;
  const completedCount = activeTaskList.filter(t => t.status === 'completed').length;

  // 2. Grouping Logic for Viewing Tasks
  const getTaskSessionDate = (t) => t.sessionDate || t.caseContext?.date || 'بدون تاريخ محدد';
  
  const groupedViewingTasks = useMemo(() => {
    if (activeMainTab !== 'viewing') return {};
    return displayTasks.reduce((acc, task) => {
      const d = getTaskSessionDate(task);
      if (!acc[d]) acc[d] = [];
      acc[d].push(task);
      return acc;
    }, {});
  }, [displayTasks, activeMainTab]);

  const handleBulkEditSessionDate = async () => {
    if (!bulkEditGroup || !bulkEditNewDate) return;
    const tasksToUpdate = groupedViewingTasks[bulkEditGroup];
    if (!tasksToUpdate) return;
    let count = 0;
    for (const t of tasksToUpdate) {
      await saveViewingTask({ ...t, sessionDate: bulkEditNewDate });
      count++;
    }
    toast(`تم تحديث تاريخ الجلسة لـ ${count} ملفات بنجاح`, 'success');
    setBulkEditGroup(null);
    setBulkEditNewDate('');
  };

  const handlePrintViewingTasks = () => {
    if (viewingTasks.length === 0) {
      toast('لا توجد مهام إطلاع للطباعة', 'error');
      return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>كشف مهام الاطلاع والتصوير</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; }
            h1 { text-align: center; font-size: 24px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 10px; text-align: center; }
            th { background-color: #f1f5f9; font-weight: bold; }
            .date { text-align: left; font-size: 14px; margin-bottom: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body dir="rtl">
          <div class="no-print" style="position: fixed; top: 15px; left: 15px; z-index: 9999;">
            <button onclick="window.close()" style="background: #e11d48; color: #fff; padding: 10px 20px; border: none; border-radius: 8px; font-weight: 900; font-size: 14px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: 'Cairo', sans-serif;">
              إغلاق وعودة للتطبيق ✕
            </button>
          </div>
          <h1>كشف مهام الاطلاع والتصوير</h1>
          <div class="date">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
          <table>
            <thead>
              <tr>
                <th>م</th>
                <th>رقم الدعوى والسنة</th>
                <th>الرول</th>
                <th>تاريخ الجلسة</th>
                <th>القرار</th>
                <th>المطلوب (الملاحظات)</th>
              </tr>
            </thead>
            <tbody>
              ${viewingTasks.map((t, idx) => {
                const linkedCase = t.linkedCases?.length > 0 ? cases.find(c => c.id === t.linkedCases[0]) : null;
                const caseNo = linkedCase ? `${linkedCase['رقم الدعوى']} لسنة ${linkedCase['السنة']}` : '---';
                const ctx = t.caseContext || {};
                const roll = ctx.roll || '---';
                const sDate = t.sessionDate || ctx.date || '---';
                const decision = ctx.decision || '---';
                
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${caseNo}</td>
                    <td>${roll}</td>
                    <td>${sDate}</td>
                    <td>${decision}</td>
                    <td>${t.notes || '---'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] max-w-5xl bg-slate-50 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-navy-900">المهام والتكليفات</h2>
              <p className="text-xs font-bold text-slate-500">إدارة مهام فريق العمل والملفات</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Tabs */}
        <div className="flex bg-white border-b border-slate-200 px-6 pt-2 shrink-0">
          <button
            onClick={() => { setActiveMainTab('general'); setIsAdding(false); }}
            className={`px-6 py-3 font-black text-sm border-b-2 transition-colors ${activeMainTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            المهام العادية
          </button>
          <button
            onClick={() => { setActiveMainTab('viewing'); setIsAdding(false); }}
            className={`px-6 py-3 font-black text-sm border-b-2 transition-colors ${activeMainTab === 'viewing' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            مهام الإطلاع والتصوير
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 hide-scrollbar">
          <div className="space-y-4">
            
            {/* Search */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
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

            {/* Add/Edit Task Form (Inline) */}
            {isAdding && canManageTasks && (
              <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden mt-4 animate-in slide-in-from-top-4">
                <div className="bg-indigo-50 px-5 py-4 border-b border-indigo-100 flex items-center justify-between">
                  <h3 className="font-black text-indigo-900">{editingTaskId ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h3>
                  {activeMainTab === 'viewing' && <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded">مهمة إطلاع وتصوير</span>}
                </div>
                <div className="p-5 space-y-4">
                  {/* Row 1 */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    {activeMainTab !== 'viewing' && (
                      <div className="flex-[2] relative">
                        <input 
                          type="text"
                          list="predefined-tasks-list"
                          placeholder="عنوان المهمة (مثال: استخراج شهادة)"
                          value={newTask.title}
                          onChange={e => setNewTask({...newTask, title: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <datalist id="predefined-tasks-list">
                          {PREDEFINED_TASKS?.map(t => <option key={t} value={t} />)}
                        </datalist>
                      </div>
                    )}
                    <select
                      value={newTask.assignee}
                      onChange={e => setNewTask({ ...newTask, assignee: e.target.value })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">إسناد إلى (المكلف)...</option>
                      <option value="المستشار">المستشار</option>
                      {settings?.employees?.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                    </select>
                  </div>
                  
                  {activeMainTab !== 'viewing' && (
                    <div className="mb-4">
                      <textarea
                        placeholder="تفاصيل أو وصف المهمة..."
                        value={newTask.description}
                        onChange={e => setNewTask({...newTask, description: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px]"
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Row 2 */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">تاريخ الجلسة (إن وجد)</label>
                      <EgyptianDateInput
                        value={newTask.sessionDate}
                        onChange={e => setNewTask({ ...newTask, sessionDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex-1 flex gap-3">
                      {activeMainTab !== 'viewing' && (
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">الأولوية</label>
                          <select
                            value={newTask.priority}
                            onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="normal">أولوية عادية</option>
                            <option value="important">مهمة</option>
                            <option value="urgent">عاجلة جداً</option>
                          </select>
                        </div>
                      )}
                      {activeMainTab !== 'viewing' && (
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">موعد التنفيذ (Due Date)</label>
                          <EgyptianDateInput
                            value={newTask.dueDate}
                            onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 relative">
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">الملفات المرتبطة</label>
                      <button
                        type="button"
                        onClick={() => setIsCaseSelectOpen(true)}
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-right flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-indigo-500 transition hover:bg-slate-100 ${newTask.linkedCases?.length > 0 ? 'text-indigo-700' : 'text-slate-500'}`}
                      >
                        <span>
                          {newTask.linkedCases?.length > 0
                            ? `مرتبطة بـ (${newTask.linkedCases.length}) ملفات`
                            : 'انقر لربط ملفات بالمهمة'}
                        </span>
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </div>
                    {activeMainTab === 'viewing' && (
                      <div className="flex-[2]">
                         <label className="block text-[10px] font-bold text-slate-500 mb-1">المطلوب (ملاحظات)</label>
                         <input 
                          type="text"
                          placeholder="المطلوب تصويره..."
                          value={newTask.notes}
                          onChange={e => setNewTask({...newTask, notes: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => { setIsAdding(false); setEditingTaskId(null); }} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition">
                      إلغاء
                    </button>
                    <button onClick={handleSaveTask} className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-indigo-600 shadow-sm hover:bg-indigo-700 transition">
                      {editingTaskId ? 'حفظ التعديلات' : 'إضافة المهمة'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content Area */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-4">
              {/* Sub-Tabs and Actions */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 flex-wrap gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveSubTab('pending')}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition ${activeSubTab === 'pending' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    قيد التنفيذ ({pendingCount})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('completed')}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition ${activeSubTab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    مكتملة ({completedCount})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {activeMainTab === 'viewing' && (
                    <button
                      onClick={handlePrintViewingTasks}
                      className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-100 transition border border-amber-200"
                    >
                      <Printer className="w-4 h-4" /> طباعة الكشف
                    </button>
                  )}
                  {canManageTasks && !isAdding && (
                    <button
                      onClick={() => {
                        setEditingTaskId(null);
                        setNewTask({ title: '', assignee: '', dueDate: '', sessionDate: '', priority: 'normal', type: 'general', caseId: '', linkedCases: [], notes: '' });
                        setIsAdding(true);
                      }}
                      className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> إضافة مهمة
                    </button>
                  )}
                </div>
              </div>

                {selectedTaskIds.length > 0 && (
                  <div className="mx-6 my-3 bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between animate-in fade-in">
                    <span className="text-sm font-black text-indigo-700">تم تحديد {selectedTaskIds.length} مهام</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleBulkComplete}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        إنجاز المحدد
                      </button>
                      <button 
                        onClick={handleBulkDelete}
                        className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف المحدد
                      </button>
                    </div>
                  </div>
                )}

              {/* Task List */}
              <div className="p-5 bg-slate-50/50 min-h-[400px]">
                {displayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <ClipboardList className="w-12 h-12 mb-3 opacity-20" />
                    <p className="font-bold text-sm">لا توجد مهام في هذه القائمة.</p>
                  </div>
                ) : (
                  <>
                    {/* General Tasks View */}
                    {activeMainTab === 'general' && (
                      <div className="space-y-3">
                        {displayTasks.map(task => (
                          <div key={task.id} className={`p-4 rounded-2xl border transition-all ${task.status === 'completed' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md'} ${selectedTaskIds.includes(task.id) ? 'ring-2 ring-indigo-400' : ''}`}>
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                              <div className="flex items-start gap-3 flex-1 w-full">
                                {canManageTasks && (
                                  <input 
                                    type="checkbox"
                                    checked={selectedTaskIds.includes(task.id)}
                                    onChange={() => toggleTaskSelection(task.id)}
                                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                                  />
                                )}
                                <button
                                  onClick={() => canManageTasks || isAssignedToMe(task.assignee) ? handleToggleStatus(task) : null}
                                  disabled={!canManageTasks && !isAssignedToMe(task.assignee)}
                                  className={`shrink-0 rounded-full transition-colors ${(canManageTasks || isAssignedToMe(task.assignee)) ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
                                >
                                  <CheckCircle2 className="w-6 h-6" />
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    {task.assignee && (
                                      <span className="text-[10px] font-black px-2 py-0.5 rounded-lg border bg-slate-50 text-slate-600 border-slate-200">
                                        المكلف: {task.assignee}
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${getPriorityColors(task.priority)}`}>
                                      {getPriorityLabel(task.priority)}
                                    </span>
                                    {task.dueDate && (
                                      <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg border ${task.status !== 'completed' && new Date(task.dueDate) < new Date() ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                        <Calendar className="w-3 h-3" /> موعد التنفيذ: {formatDateString(task.dueDate)}
                                      </span>
                                    )}
                                  </div>
                                  
                                  <h4 className={`text-base font-black ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-navy-900'} leading-tight mt-1`}>
                                    {task.title}
                                  </h4>
                                  {task.description && (
                                    <p className="text-sm font-bold text-slate-500 mt-1 whitespace-pre-wrap">
                                      {task.description}
                                    </p>
                                  )}
                                  
                                  {task.linkedCases && task.linkedCases.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {task.linkedCases.map(caseId => {
                                        const linkedCase = cases.find(c => c.id === caseId);
                                        if (!linkedCase) return null;
                                        return (
                                          <span key={caseId} className="text-[10px] font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-100 px-2 py-1 rounded-lg">
                                            ملف: {linkedCase['رقم الدعوى']} لسنة {linkedCase['السنة']}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1 sm:self-start self-end">
                                {canManageTasks && (
                                  <>
                                    <button onClick={() => handleEditTask(task)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition" title="تعديل">
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(task.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="حذف">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Viewing Tasks Folders View */}
                    {activeMainTab === 'viewing' && (
                      <div className="space-y-4">
                        {Object.entries(groupedViewingTasks).sort(([dateA], [dateB]) => {
                           if (dateA === 'بدون تاريخ محدد') return 1;
                           if (dateB === 'بدون تاريخ محدد') return -1;
                           return new Date(dateB) - new Date(dateA); // Descending
                        }).map(([dateGroup, tasksInGroup]) => (
                          <div key={dateGroup} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            {/* Folder Header */}
                            <div 
                              className="bg-slate-50 px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition select-none"
                              onClick={() => setExpandedGroups(prev => ({...prev, [dateGroup]: !prev[dateGroup]}))}
                            >
                              <div className="flex items-center gap-3">
                                {canManageTasks && (
                                  <input
                                    type="checkbox"
                                    checked={tasksInGroup.every(t => selectedTaskIds.includes(t.id))}
                                    onChange={(e) => handleToggleFolderSelection(e, tasksInGroup.map(t => t.id))}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                                    title="تحديد الكل"
                                  />
                                )}
                                <div className={`cursor-pointer w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${expandedGroups[dateGroup] ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                                  {expandedGroups[dateGroup] ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                                </div>
                                <div className="cursor-pointer">
                                  <h3 className="text-sm font-black text-navy-900">
                                    تاريخ الجلسة: {dateGroup !== 'بدون تاريخ محدد' ? formatDateString(dateGroup) : dateGroup}
                                  </h3>
                                  <p className="text-xs font-bold text-slate-500">{tasksInGroup.length} ملفات / مهام</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {canManageTasks && dateGroup !== 'بدون تاريخ محدد' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBulkEditGroup(dateGroup);
                                      setBulkEditNewDate(dateGroup);
                                    }}
                                    className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition border border-indigo-100"
                                  >
                                    تعديل التاريخ
                                  </button>
                                )}
                                <div className="text-slate-400 cursor-pointer">
                                  {expandedGroups[dateGroup] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                              </div>
                            </div>

                            {/* Bulk Edit Date Inline Form */}
                            {bulkEditGroup === dateGroup && (
                              <div className="bg-indigo-50 p-4 border-t border-indigo-100 flex items-center gap-3">
                                <label className="text-xs font-black text-indigo-900 shrink-0">تغيير تاريخ هذه المجموعة إلى:</label>
                                <EgyptianDateInput 
                                  value={bulkEditNewDate}
                                  onChange={(e) => setBulkEditNewDate(e.target.value)}
                                  className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                />
                                <button onClick={handleBulkEditSessionDate} className="bg-indigo-600 text-white text-xs font-black px-4 py-1.5 rounded-lg shadow-sm hover:bg-indigo-700">تأكيد التعديل</button>
                                <button onClick={() => setBulkEditGroup(null)} className="text-slate-500 text-xs font-bold px-3 py-1.5 hover:bg-slate-200 rounded-lg">إلغاء</button>
                              </div>
                            )}

                            {/* Folder Content (Compact Rows) */}
                            {expandedGroups[dateGroup] && (
                              <div className="divide-y divide-slate-100">
                                {tasksInGroup.map(task => (
                                  <div key={task.id} className={`flex items-center justify-between p-3 transition hover:bg-slate-50 ${selectedTaskIds.includes(task.id) ? 'bg-indigo-50/50' : ''}`}>
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      {canManageTasks && (
                                        <input 
                                          type="checkbox"
                                          checked={selectedTaskIds.includes(task.id)}
                                          onChange={() => toggleTaskSelection(task.id)}
                                          className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                                        />
                                      )}
                                      <button
                                        onClick={() => canManageTasks || isAssignedToMe(task.assignee) ? handleToggleStatus(task) : null}
                                        disabled={!canManageTasks && !isAssignedToMe(task.assignee)}
                                        className={`shrink-0 rounded-full transition-colors ${(canManageTasks || isAssignedToMe(task.assignee)) ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
                                      >
                                        <CheckCircle2 className="w-5 h-5" />
                                      </button>
                                      
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 flex-1 min-w-0 overflow-hidden">
                                        <div className="flex items-center gap-2 shrink-0">
                                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600">
                                            <Eye className="w-3 h-3" />
                                          </div>
                                          {task.linkedCases && task.linkedCases.length > 0 ? (
                                            task.linkedCases.map(caseId => {
                                              const linkedCase = cases.find(c => c.id === caseId);
                                              return linkedCase ? (
                                                <span key={caseId} className="text-xs font-black text-navy-900 truncate">
                                                  ملف {linkedCase['رقم الدعوى']}/{linkedCase['السنة']}
                                                </span>
                                              ) : null;
                                            })
                                          ) : (
                                            <span className="text-xs font-black text-navy-900 truncate">{task.title}</span>
                                          )}
                                          
                                          {task.assignee && (
                                            <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                              المكلف: {task.assignee}
                                            </span>
                                          )}
                                        </div>
                                        
                                        {task.notes && (
                                          <div className="text-[11px] font-bold text-slate-500 truncate flex-1 bg-amber-50/50 px-2 py-1 rounded">
                                            {task.notes}
                                          </div>
                                        )}
                                      </div>
                                      {task.description && (
                                        <div className="w-full text-xs font-bold text-slate-500 mt-1 pl-8 whitespace-pre-wrap">
                                          {task.description}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 mr-4">
                                      {task.status === 'pending' && task.linkedCases?.length > 0 && canManageTasks && (
                                        <button
                                          onClick={() => {
                                            setActiveUploadTask(task);
                                            setActiveUploadCase(cases.find(c => c.id === task.linkedCases[0]));
                                            setIsUploadModalOpen(true);
                                          }}
                                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1.5 rounded transition"
                                        >
                                          <Camera className="w-3.5 h-3.5" /> إرفاق
                                        </button>
                                      )}
                                      {canManageTasks && (
                                        <>
                                          <button onClick={() => handleEditTask(task)} className="text-slate-400 hover:text-indigo-600 transition p-1" title="تعديل">
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                          <button onClick={() => handleDelete(task.id)} className="text-slate-400 hover:text-rose-600 transition p-1" title="حذف">
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
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
                        setNewTask({ ...newTask, linkedCases: newTask.linkedCases.filter(id => id !== c.id) });
                      } else {
                        let newSessionDate = newTask.sessionDate;
                        if (!newSessionDate && c['تاريخ الجلسة']) {
                           newSessionDate = c['تاريخ الجلسة'];
                        }
                        setNewTask({ ...newTask, linkedCases: [...(newTask.linkedCases || []), c.id], sessionDate: newSessionDate });
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

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setActiveUploadTask(null);
          setActiveUploadCase(null);
        }}
        caseData={activeUploadCase}
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
