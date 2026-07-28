import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Users, CalendarDays, AlertTriangle, Building2, Scale, Info, PieChart, ClipboardList, CheckCircle2, ChevronLeft, CalendarPlus, Activity, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { getSafeDateObj } from '../utils/dateUtils';
import { useUI } from '../context/UIContext';
import AdvancedSearchModal from '../components/AdvancedSearchModal';
import BulkAssignTaskModal from '../components/BulkAssignTaskModal';

export default function Dashboard() {
  const { cases, isEmployee, currentUser, saveCaseToFirebase, settings, globalTasks, saveGlobalTask } = useAppContext();
  const navigate = useNavigate();
  const { showPrompt, toast } = useUI();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [isGlobalTaskModalOpen, setIsGlobalTaskModalOpen] = useState(false);
  const [adminTasksTab, setAdminTasksTab] = useState('pending'); // 'pending' or 'completed'

  const stats = useMemo(() => {
    let appellantCount = 0;
    let appelleeCount = 0;

    let judgedCount = 0; // المحكوم فيه
    let reservedCount = 0; // محجوز للحكم
    let ongoingCount = 0; // متداول

    let noInterestCount = 0; // لا شأن
    let outOfJurisdictionCount = 0; // خارج الاختصاص

    let activeThisMonth = 0;
    let alerts = [];

    const opponentsCount = {}; // For Appellant cases only
    const yearCount = {};
    const judgmentsCount = {}; // For Judgment Classification

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    cases.forEach(c => {
      const role = String(c['الصفة'] || c['صفة'] || '').trim();
      
      if (role === 'لا شأن') noInterestCount++;
      if (role === 'خارج الاختصاص') outOfJurisdictionCount++;
      
      // Ignore these two types from all dashboard statistics
      if (role === 'لا شأن' || role === 'خارج الاختصاص') return;

      const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
      const isAppellee = role.includes('مطعون ضده') || role.includes('مستأنف ضده') || role.includes('مدعى عليه');

      const lastSessionStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'] || '';
      const lastSessionDate = getSafeDateObj(lastSessionStr);

      let isOngoingForEntity = false;
      if (lastSessionDate) {
        if (lastSessionDate >= today || (lastSessionDate.getMonth() === currentMonth && lastSessionDate.getFullYear() === currentYear)) {
          isOngoingForEntity = true;
        }
      }

      if (isOngoingForEntity) {
        if (isAppellant) appellantCount++;
        if (isAppellee) appelleeCount++;
      }

      const year = c['السنة'] || c['سنة'] || c['year'] || 'غير محدد';
      yearCount[year] = (yearCount[year] || 0) + 1;

      const decision = String(c['القرار'] || c['قرار الجلسة'] || c['المنطوق'] || '');

      // Status Logic
      const hasHukm = decision.includes('حكم') || decision.includes('للحكم');
      if (hasHukm && lastSessionDate) {
        if (lastSessionDate < today) {
          judgedCount++;
        } else {
          reservedCount++;
        }
      } else {
        ongoingCount++;
      }

      // Active this month
      if (lastSessionDate) {
        if (lastSessionDate.getMonth() === currentMonth && lastSessionDate.getFullYear() === currentYear) {
          if (!hasHukm || (hasHukm && lastSessionDate >= today)) {
            activeThisMonth++;
          }
        }

        // Alerts Engine
        if (decision.includes('وقف جزائي') && lastSessionDate) {
          const diffTime = Math.abs(today - lastSessionDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= 30 && diffDays <= 45) {
            alerts.push({
              type: 'critical_suspension',
              case: c,
              daysPassed: diffDays,
              daysLeft: 45 - diffDays
            });
          }
        }
      }

      // Entities
      if (isAppellant) {
        let entity = String(c['المدعي'] || c['الطاعن'] || c['المستأنف'] || 'غير محدد').trim();
        if (entity) {
          opponentsCount[entity] = (opponentsCount[entity] || 0) + 1;
        }
      }

      // Judgments
      const decisionText = decision.toLowerCase();
      if (decisionText) {
        if (decisionText.includes('وقف')) {
          judgmentsCount['وقف'] = (judgmentsCount['وقف'] || 0) + 1;
        } else if (decisionText.includes('كأن لم') || decisionText.includes('اعتبار') || decisionText.includes('شطب') || decisionText.includes('ترك')) {
          judgmentsCount['شطب وكأن لم يكن'] = (judgmentsCount['شطب وكأن لم يكن'] || 0) + 1;
        } else if (decisionText.includes('عدم قبول')) {
          judgmentsCount['عدم قبول'] = (judgmentsCount['عدم قبول'] || 0) + 1;
        } else if (decisionText.includes('رفض')) {
          judgmentsCount['رفض'] = (judgmentsCount['رفض'] || 0) + 1;
        } else if (decisionText.includes('إلغاء') || decisionText.includes('قبول')) {
          judgmentsCount['قبول / إلغاء'] = (judgmentsCount['قبول / إلغاء'] || 0) + 1;
        } else if (decisionText.includes('إحالة')) {
          judgmentsCount['إحالة'] = (judgmentsCount['إحالة'] || 0) + 1;
        } else {
          judgmentsCount['أخرى'] = (judgmentsCount['أخرى'] || 0) + 1;
        }
      }
    });

    const topYears = Object.entries(yearCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topOpponents = Object.entries(opponentsCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topJudgments = Object.entries(judgmentsCount).sort((a, b) => b[1] - a[1]);

    return {
      all: cases.length,
      netTotal: cases.length - noInterestCount - outOfJurisdictionCount,
      noInterest: noInterestCount,
      outOfJurisdiction: outOfJurisdictionCount,
      appellant: appellantCount,
      appellee: appelleeCount,
      judged: judgedCount,
      reserved: reservedCount,
      ongoing: ongoingCount,
      activeThisMonth,
      topOpponents,
      topYears,
      topJudgments,
      alerts
    };
  }, [cases]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/files?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleAdvancedSearch = (params) => {
    // Navigate with URL params for advanced search
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val) query.set(key, val);
    });
    navigate(`/files?${query.toString()}`);
  };

  const handleCompleteTask = async (taskType, caseId, taskId, notes) => {
    const now = new Date().toISOString();
    
    if (taskType === 'global') {
      const taskToUpdate = globalTasks.find(t => t.id === taskId);
      if (taskToUpdate) {
        await saveGlobalTask(taskId, { ...taskToUpdate, status: 'completed', notes: notes || '', completedAt: now });
        toast('تم تسجيل الإجراء بنجاح', 'success');
      }
      return;
    }

    const caseToUpdate = cases.find(c => c.id === caseId);
    if (!caseToUpdate) return;

    const updatedTasks = caseToUpdate.tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: 'completed', notes: notes || '', completedAt: now };
      }
      return t;
    });

    await saveCaseToFirebase(caseId, { tasks: updatedTasks });
    toast('تم تسجيل الإجراء بنجاح', 'success');
  };

  const handleDeleteTaskAdmin = async (taskType, caseId, taskId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المهمة نهائياً؟')) return;
    if (taskType === 'global') {
      await deleteGlobalTask(taskId);
      toast('تم الحذف بنجاح', 'success');
      return;
    }
    const caseToUpdate = cases.find(c => c.id === caseId);
    if (!caseToUpdate) return;
    const updatedTasks = caseToUpdate.tasks.filter(t => t.id !== taskId);
    await saveCaseToFirebase(caseId, { tasks: updatedTasks });
    toast('تم الحذف بنجاح', 'success');
  };

  if (isEmployee) {
    const myTasks = [];
    cases.forEach(c => {
      if (c.tasks) {
        c.tasks.forEach(t => {
          if (t.assignee === currentUser) {
            myTasks.push({ ...t, caseId: c.id, caseNum: c['رقم الدعوى'] || c.id, year: c['السنة'], type: 'case', caseCover: c.coverImage });
          }
        });
      }
    });

    globalTasks.forEach(t => {
      if (t.assignee === currentUser) {
        // If linked to cases, find the first case to show cover image or info
        let caseNum = 'مهمة عامة';
        let caseCover = null;
        if (t.linkedCases && t.linkedCases.length > 0) {
          const firstCase = cases.find(c => c.id === t.linkedCases[0]);
          if (firstCase) {
             caseNum = t.linkedCases.length > 1 ? `مرتبطة بـ ${t.linkedCases.length} ملفات` : (firstCase['رقم الدعوى'] || 'ملف');
             caseCover = firstCase.coverImage;
          }
        }
        myTasks.push({ ...t, type: 'global', caseNum, caseCover });
      }
    });

    const pendingTasks = myTasks.filter(t => t.status !== 'completed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const completedTasks = myTasks.filter(t => t.status === 'completed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return (
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="bg-emerald-600 rounded-3xl p-6 relative overflow-hidden shadow-sm">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
          <div className="relative z-10 text-white">
            <h1 className="text-3xl font-black mb-2">مرحباً، أ. {currentUser} 👋</h1>
            <p className="text-sm font-bold text-emerald-100">إليك المهام المطلوبة منك اليوم</p>
          </div>
        </div>

        {/* Employee Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث السريع عن الملفات (رقم الدعوى، الخصم، أو السنة)..."
            className="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-sm sm:text-base font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition shadow-sm text-navy-900"
          />
          <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white hover:bg-emerald-700 transition shadow-sm">
            <Search className="w-5 h-5" />
          </button>
        </form>

        <div className="space-y-4">
          <h2 className="text-lg font-black text-navy-900 px-2 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            مهام قيد التنفيذ ({pendingTasks.length})
          </h2>

          {pendingTasks.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500 font-bold text-sm">
              لا توجد مهام جديدة مطلوبة منك حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingTasks.map(task => (
                <div key={task.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 flex flex-col">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div className="flex gap-3">
                      {task.caseCover && (
                         <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center">
                            <img src={task.caseCover} alt="Cover" className="w-full h-full object-cover" />
                         </div>
                      )}
                      <div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-md mb-2 inline-block ${task.type === 'global' && !task.linkedCases?.length ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {task.type === 'global' && !task.linkedCases?.length ? 'مهمة عامة' : `رقم ${task.caseNum} ${task.year ? `لسنة ${task.year}` : ''}`}
                        </span>
                        <h3 className="font-black text-navy-900 text-sm leading-relaxed">{task.title}</h3>
                      </div>
                    </div>
                    {task.type === 'case' && (
                      <button onClick={() => navigate(`/case/${task.caseId}`)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-navy-900 hover:bg-slate-100 transition shrink-0">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      const notes = await showPrompt('تسجيل إجراء', 'اكتب ملاحظات حول تنفيذ هذه المهمة (اختياري):');
                      if (notes !== null) {
                        await handleCompleteTask(task.type, task.caseId, task.id, notes);
                      }
                    }}
                    className="w-full group bg-slate-50 border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-500 text-slate-500 hover:text-white font-black py-3 rounded-xl text-sm transition-all duration-300 flex items-center justify-center gap-3 mt-4 shadow-sm hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98]"
                  >
                    <div className="w-6 h-6 rounded-full border-2 border-slate-400 group-hover:border-white bg-white/50 group-hover:bg-transparent flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                      <CheckCircle2 className="w-4 h-4 text-transparent group-hover:text-white transition-colors" />
                    </div>
                    <span className="group-hover:-translate-x-1 transition-transform">تأشير كـ "مُنجز"</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <h2 className="text-sm font-black text-slate-400 px-2">مهام تم إنجازها حديثاً</h2>
            <div className="space-y-2">
              {completedTasks.slice(0, 5).map(task => (
                <div key={task.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-black text-slate-600 text-xs mb-1 line-through">{task.title}</h3>
                    <p className="text-[10px] font-bold text-slate-400">رقم {task.caseNum}</p>
                    {task.notes && <p className="text-[10px] font-bold text-emerald-600 mt-1 bg-emerald-50 px-2 py-1 rounded-md inline-block">ملاحظة: {task.notes}</p>}
                  </div>
                  <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md shrink-0">
                    تم التنفيذ
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">

      {/* Search Header Hero */}
      <div className="bg-navy-900 rounded-3xl p-6 sm:p-10 text-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -translate-x-10 translate-y-10"></div>

        <div className="relative z-10 space-y-6 max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-white"> البحث العام</h2>
          <p className="text-sm font-bold text-slate-300">ابحث برقم الدعوى، الخصم، أو السنة للوصول السريع</p>

          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث هنا..."
              className="w-full bg-white/10 text-white placeholder-slate-400 border-2 border-white/20 rounded-2xl py-4 pl-14 pr-24 text-lg font-bold focus:outline-none focus:border-amber-400 focus:bg-white/20 transition-all backdrop-blur-sm"
            />
            
            <button 
              type="button" 
              onClick={() => setIsAdvancedSearchOpen(true)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-amber-300 hover:bg-white/20 transition"
              title="بحث متقدم (ذكي)"
            >
              <Sparkles className="w-5 h-5" />
            </button>

            <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white hover:bg-amber-600 transition">
              <Search className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="space-y-6 animate-fade-in">
        {/* Alerts Section */}
        {stats.alerts.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-500 rounded-full opacity-10"></div>
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-black text-rose-900 mb-1">تنبيهات هامة!</h3>
                <p className="text-xs font-bold text-rose-700 leading-relaxed mb-3">
                  تنبيه عاجل: قضايا صدر فيها قرار "وقف جزائي" ومر عليها أكثر من 30 يوماً! يرجى التعجيل فوراً قبل انقضاء مهلة الـ 45 يوماً.
                </p>
                <div className="flex flex-col gap-2">
                  {stats.alerts.map(a => (
                    <button
                      key={a.case.id}
                      onClick={() => navigate(`/case/${a.case.id}`)}
                      className="bg-white border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs font-bold hover:bg-rose-100 transition shadow-sm text-right flex justify-between items-center"
                    >
                      <span>رقم {a.case['رقم الدعوى'] || a.case.id}</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                        مر {a.daysPassed} يوم (باقي {a.daysLeft} أيام)
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Scale className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-500">صافي القضايا النشطة</p>
            <p className="text-2xl font-black text-navy-900">{stats.netTotal}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-500">الجلسات المتداولة</p>
            <p className="text-2xl font-black text-navy-900">{stats.ongoing}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <CalendarDays className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-500">جلسات هذا الشهر</p>
            <p className="text-2xl font-black text-navy-900">{stats.activeThisMonth}</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Building2 className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-500">قضايا الطاعنين</p>
            <p className="text-2xl font-black text-navy-900">{stats.appellant}</p>
          </div>
        </div>

        {/* Ignored Cases Stats */}
        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200 border-dashed flex justify-between items-center opacity-70">
              <span className="text-xs font-bold text-slate-500">لا شأن</span>
              <span className="text-sm font-black text-slate-700">{stats.noInterest}</span>
           </div>
           <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-200 border-dashed flex justify-between items-center opacity-70">
              <span className="text-xs font-bold text-slate-500">خارج الاختصاص</span>
              <span className="text-sm font-black text-slate-700">{stats.outOfJurisdiction}</span>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Status Chart */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center relative overflow-hidden h-full min-h-[90px]">
            <div className="flex items-end justify-around w-full h-full px-4 border-b border-slate-100 pb-2">
              <div className="flex flex-col items-center gap-1.5 group w-20">
                <span className="text-base font-black text-slate-500 group-hover:text-amber-600 transition-colors">{stats.ongoing}</span>
                <div 
                  className="w-full bg-amber-200 rounded-t-sm transition-all duration-1000 group-hover:bg-amber-400"
                  style={{ height: `${(stats.ongoing / Math.max(stats.ongoing, stats.judged, stats.reserved, 1)) * 100}%`, minHeight: '8px' }}
                ></div>
                <span className="text-xs font-bold text-slate-600 text-center mt-1 leading-none">متداول</span>
              </div>
              
              <div className="flex flex-col items-center gap-1.5 group w-20">
                <span className="text-base font-black text-slate-500 group-hover:text-indigo-600 transition-colors">{stats.reserved}</span>
                <div 
                  className="w-full bg-indigo-200 rounded-t-sm transition-all duration-1000 group-hover:bg-indigo-400"
                  style={{ height: `${(stats.reserved / Math.max(stats.ongoing, stats.judged, stats.reserved, 1)) * 100}%`, minHeight: '8px' }}
                ></div>
                <span className="text-xs font-bold text-slate-600 text-center mt-1 leading-none">محجوز للحكم</span>
              </div>
              
              <div className="flex flex-col items-center gap-1.5 group w-20">
                <span className="text-base font-black text-slate-500 group-hover:text-emerald-600 transition-colors">{stats.judged}</span>
                <div 
                  className="w-full bg-emerald-200 rounded-t-sm transition-all duration-1000 group-hover:bg-emerald-400"
                  style={{ height: `${(stats.judged / Math.max(stats.ongoing, stats.judged, stats.reserved, 1)) * 100}%`, minHeight: '8px' }}
                ></div>
                <span className="text-xs font-bold text-slate-600 text-center mt-1 leading-none">المحكوم فيه</span>
              </div>
            </div>
          </div>

          {/* Entity Indicator */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center relative overflow-hidden h-full min-h-[90px]">
            <div className="w-full flex-1 flex flex-col justify-center gap-4 mt-2">
              <div className="w-full flex h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                <div 
                  className="bg-emerald-500 h-full flex items-center justify-center text-xs text-white font-bold transition-all duration-1000" 
                  style={{ width: `${(stats.appellant / (stats.appellant + stats.appellee || 1)) * 100}%` }}
                ></div>
                <div 
                  className="bg-rose-500 h-full flex items-center justify-center text-xs text-white font-bold transition-all duration-1000" 
                  style={{ width: `${(stats.appellee / (stats.appellant + stats.appellee || 1)) * 100}%` }}
                ></div>
              </div>
              
              <div className="w-full flex justify-between text-xs font-black">
                 <span className="text-emerald-700">طاعن ({stats.appellant})</span>
                 <span className="text-rose-700">مطعون ضده ({stats.appellee})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Charts / Lists */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Top Opponents */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h3 className="font-black text-xs text-slate-600">الجهات رافعة الدعوى (قضايا الطاعنين)</h3>
            </div>
            <div className="space-y-3">
              {stats.topOpponents.length > 0 ? stats.topOpponents.map(([name, count], i) => (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-5 h-5 rounded-md bg-slate-50 text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <p className="text-xs font-bold text-navy-900 truncate" title={name}>{name}</p>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 shrink-0 bg-slate-50 px-2 py-0.5 rounded-full mr-2">{count} ملف</span>
                </div>
              )) : (
                <p className="text-xs text-slate-400 font-bold text-center py-2">لا توجد بيانات كافية</p>
              )}
            </div>
          </div>

          {/* Active Years */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <h3 className="font-black text-xs text-slate-600">توزيع الملفات المتداولة (وفقاً للسنة)</h3>
            </div>
            <div className="space-y-3">
              {stats.topYears.map(([year, count]) => {
                const max = Math.max(...stats.topYears.map(y => y[1]));
                const width = `${(count / max) * 100}%`;
                return (
                  <div key={year} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-navy-900">سنة {year}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Judgments Breakdown */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-slate-400" />
              <h3 className="font-black text-xs text-slate-600">تحليل وتصنيف الأحكام</h3>
            </div>
            <div className="space-y-3">
              {stats.topJudgments.length > 0 ? stats.topJudgments.map(([name, count]) => {
                const total = stats.topJudgments.reduce((acc, curr) => acc + curr[1], 0);
                const width = `${(count / total) * 100}%`;
                return (
                  <div key={name} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-navy-900">{name}</span>
                      <span className="text-slate-500">{count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width }}></div>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-xs text-slate-400 font-bold text-center py-2">لا توجد بيانات كافية</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Admin Employee Performance Report */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4 animate-fade-in mt-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="font-black text-lg text-navy-900">تقارير أداء الموظفين</h2>
              <p className="text-[11px] font-bold text-slate-500">سجل بجميع المهام المنفذة مؤخراً</p>
            </div>
          </div>
          <button 
            onClick={() => setIsGlobalTaskModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
          >
            <ClipboardList className="w-4 h-4" /> إنشاء مهمة عامة
          </button>
        </div>

        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setAdminTasksTab('pending')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${adminTasksTab === 'pending' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-navy-900'}`}
          >
            مهام قيد التنفيذ
          </button>
          <button 
            onClick={() => setAdminTasksTab('completed')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${adminTasksTab === 'completed' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-navy-900'}`}
          >
            مهام تم تنفيذها
          </button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {(() => {
            const allTasks = [];
            cases.forEach(c => {
              if (c.tasks) {
                c.tasks.forEach(t => {
                  allTasks.push({
                    ...t,
                    caseId: c.id,
                    caseNum: c['رقم الدعوى'] || c.id,
                    year: c['السنة'],
                    type: 'case'
                  });
                });
              }
            });
            globalTasks.forEach(t => {
              allTasks.push({ ...t, type: 'global', caseNum: t.linkedCases?.length ? `مرتبطة بـ ${t.linkedCases.length} ملفات` : 'مهمة عامة' });
            });

            const displayedTasks = allTasks
              .filter(t => adminTasksTab === 'completed' ? t.status === 'completed' : t.status !== 'completed')
              .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

            if (displayedTasks.length === 0) {
              return (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs font-bold text-slate-500">
                    {adminTasksTab === 'completed' ? 'لم يتم تنفيذ أي مهام حتى الآن.' : 'لا توجد مهام قيد التنفيذ حالياً.'}
                  </p>
                </div>
              );
            }

            return displayedTasks.map(task => {
              const d = new Date(task.completedAt || task.createdAt);
              const dateStr = d.toLocaleDateString('ar-EG');
              const timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={`${task.caseId}-${task.id}`} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between gap-4 transition hover:bg-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-navy-900 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">{task.assignee}</span>
                      <h4 className="font-black text-sm text-navy-900">{task.title}</h4>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 mb-2">رقم الدعوى: {task.caseNum} {task.year && `لسنة ${task.year}`}</p>
                    {task.notes && (
                      <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100 inline-block">
                        ملاحظة: {task.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                    {task.status === 'completed' ? (
                      <>
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1 border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3" /> تم التنفيذ
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {dateStr} - {timeStr}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md flex items-center gap-1 border border-amber-100">
                          قيد التنفيذ
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {dateStr} - {timeStr}
                        </span>
                        <button 
                          onClick={() => handleDeleteTaskAdmin(task.type, task.caseId, task.id)}
                          className="mt-2 text-[10px] font-bold text-rose-500 hover:text-white hover:bg-rose-500 px-2 py-1 rounded-md transition"
                        >
                          حذف المهمة
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            });
          })()}
        </div>

        {isAdvancedSearchOpen && (
          <AdvancedSearchModal
            isOpen={isAdvancedSearchOpen}
            onClose={() => setIsAdvancedSearchOpen(false)}
            onSearch={handleAdvancedSearch}
          />
        )}

        <BulkAssignTaskModal
          isOpen={isGlobalTaskModalOpen}
          onClose={() => setIsGlobalTaskModalOpen(false)}
          selectedCases={[]}
          onClearSelection={() => {}}
        />
      </div>
    </div>
  );
}
