import React, { useState, useEffect, useRef } from 'react';
import { Bell, Calendar, ClipboardList, AlertTriangle, CheckCircle2, ChevronLeft, Camera, Check, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useNavigate } from 'react-router-dom';
import { parseISO, isAfter, isBefore, addDays, format, isToday, isTomorrow, startOfDay } from 'date-fns';

export default function NotificationCenter() {
  const { cases, globalTasks, completeGlobalTask, deleteGlobalTask, viewingTasks, completeViewingTask, deleteViewingTask } = useAppContext();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Handle click outside to close
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const notifs = [];
    const today = startOfDay(new Date());
    const next3Days = addDays(today, 3);

    cases.forEach(c => {
      // 1. Urgent Reminders
      if (c.urgentReminderDate) {
        const rDate = parseISO(c.urgentReminderDate);
        if (isBefore(rDate, next3Days)) {
           notifs.push({
              id: `reminder-${c.id}`,
              type: 'reminder',
              title: 'تذكير عاجل',
              desc: `إجراء عاجل للدعوى ${c['رقم الدعوى']}`,
              date: rDate,
              link: `/case/${c.id}`
           });
        }
      }
    });

    const isViewingTask = (t) => t.type === 'viewing';

    // 3. Global Tasks (Pending & Due Soon) — المهام العادية فقط
    globalTasks.forEach(task => {
      if (task.status !== 'completed' && task.dueDate && !isViewingTask(task)) {
        const tDate = parseISO(task.dueDate);
        if (isBefore(tDate, next3Days) || isBefore(tDate, today)) {
          const isOverdue = isBefore(tDate, today);
          notifs.push({
            id: `task-${task.id}`,
            taskId: task.id,
            type: isOverdue ? 'overdue' : 'task',
            title: isOverdue ? 'مهمة متأخرة' : 'مهمة قريبة',
            desc: task.title,
            date: tDate,
            link: `/tasks`
          });
        }
      }
    });

    // Sort by date
    notifs.sort((a, b) => a.date - b.date);
    setNotifications(notifs);
  }, [cases, globalTasks, viewingTasks]);

  const getRelativeDateStr = (dateObj) => {
    if (isToday(dateObj)) return 'اليوم';
    if (isTomorrow(dateObj)) return 'غداً';
    return format(dateObj, 'yyyy-MM-dd');
  };

  const getIcon = (type) => {
    switch (type) {
      case 'session': return <Calendar className="w-4 h-4 text-indigo-500" />;
      case 'reminder': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'task': return <ClipboardList className="w-4 h-4 text-emerald-500" />;
      case 'viewing_group': return <Camera className="w-4 h-4 text-indigo-500" />;
      default: return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isOpen ? 'bg-white/20 text-white' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
        title="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {notifications.length > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center bg-rose-500 text-white text-[9px] font-black rounded-full border-2 border-navy-900 animate-pulse">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-slate-50 p-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800">التنبيهات والمواعيد</h3>
            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">
              {notifications.length} جديد
            </span>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm font-black text-slate-600">كل شيء على ما يرام!</p>
                <p className="text-xs font-bold text-slate-400 mt-1">لا توجد تنبيهات عاجلة أو جلسات قريبة.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notif) => (
                  <div key={notif.id} className="w-full text-right p-3 sm:p-4 hover:bg-slate-50 transition flex items-start gap-3 group border-b border-slate-50 last:border-0">
                    <div className="mt-0.5 p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                      {getIcon(notif.type)}
                    </div>
                    
                    <button 
                      className="flex-1 text-right"
                      onClick={() => {
                        setIsOpen(false);
                        navigate(notif.link);
                      }}
                    >
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-black text-slate-800">{notif.title}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isToday(notif.date) ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`} dir="ltr">
                          {getRelativeDateStr(notif.date)}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 leading-snug pr-1">
                        {notif.desc}
                      </p>
                    </button>

                    {(notif.type === 'task' || notif.type === 'overdue' || notif.type === 'viewing_group') ? (
                      <div className="flex flex-col gap-1 self-center shrink-0">
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (notif.type === 'viewing_group') {
                               const tasksToComplete = viewingTasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate.split('T')[0] === notif.date.toISOString().split('T')[0]);
                               for (let t of tasksToComplete) {
                                  await completeViewingTask(t.id, true);
                               }
                            } else {
                               await completeGlobalTask(notif.taskId, 'تم إنجازها من التنبيهات');
                            }
                          }}
                          className="p-1.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-lg transition" 
                          title="إنجاز"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (notif.type === 'viewing_group') {
                               const tasksToDelete = viewingTasks.filter(t => t.status !== 'completed' && t.dueDate && t.dueDate.split('T')[0] === notif.date.toISOString().split('T')[0]);
                               for (let t of tasksToDelete) {
                                  await deleteViewingTask(t.id);
                               }
                            } else {
                               await deleteGlobalTask(notif.taskId);
                            }
                          }}
                          className="p-1.5 bg-rose-100 text-rose-600 hover:bg-rose-200 rounded-lg transition"
                          title="تجاهل / حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setIsOpen(false);
                          navigate(notif.link);
                        }}
                        className="self-center shrink-0 p-2"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 border-t border-slate-50">
            <button 
              onClick={() => {
                setIsOpen(false);
                navigate('/agenda');
              }}
              className="w-full py-2 text-xs font-black text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
            >
              عرض الأجندة بالكامل
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
