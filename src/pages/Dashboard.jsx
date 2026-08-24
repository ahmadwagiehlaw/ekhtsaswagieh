import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, TrendingUp, CalendarDays, AlertTriangle, Building2, Scale,
  PieChart, ClipboardList, CheckCircle2, ChevronLeft, Activity, Sparkles,
  Printer, Settings2, Eye, EyeOff, BarChart3, FileText, Clock, Gavel,
  ChevronRight, Calendar, LogOut, X, Star, Filter
} from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { calculateDashboardStats, computeMonthStats, computeMultiMonthStats } from '../utils/statsUtils';
import { getActiveMapping, resolveColor, isStopImpact, resolveImpact } from '../utils/statsMapping';
import { isAppellantRole, isAppelleeRole } from '../constants/roleHelpers';
import { autoDetermineRole } from '../utils/caseUtils';
import useDashboardStats from '../hooks/useDashboardStats';
import { useUI } from '../context/UIContext';
import { getSafeDateObj } from '../utils/dateUtils';
import BulkAssignTaskModal from '../components/BulkAssignTaskModal';

// Color helpers are now driven by settings.statsMapping via resolveColor()
// Fallback static map is used if settings not loaded yet
const FALLBACK_COLORS = {
  'صالح': '#10b981', 'ضد': '#ef4444', 'وقف جزائي': '#f97316', 'وقف والدولة مدعية': '#f97316',
  'اعتبار كأن لم تكن': '#8b5cf6', 'اعتبار': '#eab308',
  'تمهيدي': '#06b6d4', 'لا شأن بالحكم': '#94a3b8', 'لا شأن لنا بالحكم': '#94a3b8', 'غير مصنف': '#cbd5e1',
  'غير منه للخصومة': '#64748b', 'حكم غير منه للخصومة': '#64748b', 'حكم منه للخصومة': '#22c55e',
};

// ─────────────────────────────────────────────────────────────
// SVG Donut Chart
// ─────────────────────────────────────────────────────────────
import { DonutChart, TrendLine, TrendBadge } from '../components/ui/Charts';
import KPICard from '../components/ui/KPICard';

// ─────────────────────────────────────────────────────────────
// Print Report Modal
// ─────────────────────────────────────────────────────────────
import PrintReportModal from '../components/PrintReportModal';
import JudicialAgendaReportModal from '../components/JudicialAgendaReportModal';
// ─────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { cases, saveCaseToFirebase, saveBatchCasesToFirebase, settings, isEmployee, currentUser, currentUserName, logoutAdmin, globalTasks, saveGlobalTask, completeGlobalTask } = useAppContext();
  const navigate = useNavigate();
  const { showPrompt, toast, showConfirm } = useUI();

  const today = new Date();

  // Migration removed — moved to SettingsSystemTab as manual button

  const [searchQuery, setSearchQuery] = useState('');
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [isGlobalTaskModalOpen, setIsGlobalTaskModalOpen] = useState(false);
  const [adminTasksTab, setAdminTasksTab] = useState('pending');
  const [bottomTab, setBottomTab] = useState('priority');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  const [showQuickFilters, setShowQuickFilters] = useState(false);
  const [hiddenWidgets, setHiddenWidgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dash-hidden-v3') || '["entities","years"]'); } catch { return ['entities','years']; }
  });

  // Month selector state
  const [viewMonth, setViewMonth] = useState({ month: today.getMonth(), year: today.getFullYear() });

  const { stats } = useDashboardStats({ cases, settings, globalTasks });

  const prevViewMonth = useMemo(() => ({ month: viewMonth.month === 0 ? 11 : viewMonth.month - 1, year: viewMonth.month === 0 ? viewMonth.year - 1 : viewMonth.year }), [viewMonth]);
  const { selectedMonthStats, prevMonthStats } = useMemo(() => {
    const multi = computeMultiMonthStats(cases, settings, [viewMonth, prevViewMonth]);
    return {
      selectedMonthStats: multi[`${viewMonth.year}-${viewMonth.month}`] || { sessions: 0, casesAdded: 0, memos: 0, judgments: {} },
      prevMonthStats: multi[`${prevViewMonth.year}-${prevViewMonth.month}`] || { sessions: 0, casesAdded: 0, memos: 0, judgments: {} },
    };
  }, [cases, settings, viewMonth, prevViewMonth]);

  // Dynamic color resolver: reads from settings.statsMapping, falls back to FALLBACK_COLORS
  const activeMapping = useMemo(() => getActiveMapping(settings), [settings]);
  const getJColor = (name) => {
    const fromMapping = resolveColor(name, activeMapping);
    if (fromMapping && fromMapping !== '#cbd5e1') return fromMapping;
    // Fuzzy fallback from FALLBACK_COLORS
    for (const [k, v] of Object.entries(FALLBACK_COLORS)) {
      if (name === k || name.includes(k) || k.includes(name)) return v;
    }
    return '#94a3b8';
  };


  const displayedTasks = useMemo(() => {
    const allTasks = [];
    cases.forEach(c => { if (c.tasks) c.tasks.forEach(t => allTasks.push({ ...t, caseId: c.id, caseNum: c['رقم الدعوى'] || c.id, year: c['السنة'], type: 'case' })); });
    globalTasks.forEach(t => allTasks.push({ ...t, type: 'global', caseNum: t.linkedCases?.length ? `مرتبطة بـ ${t.linkedCases.length} ملفات` : 'مهمة عامة' }));
    return allTasks
      .filter(t => adminTasksTab === 'completed' ? t.status === 'completed' : t.status !== 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));
  }, [cases, globalTasks, adminTasksTab]);

  // Agenda popup modal state
  const [agendaModal, setAgendaModal] = useState({ isOpen: false, title: '', casesList: [] });

  // priorityCases: starred cases with upcoming session, appellant cases this month, or cases with tasks due in 7 days
  const priorityCases = useMemo(() => {
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    return cases.filter(c => {
      const role = String(c['الصفة'] || c['صفة'] || '').trim();
      if (role === 'لا شأن' || role === 'خارج الاختصاص') return false;
      const isAppellant = isAppellantRole(role, settings);
      const lastSessionStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || '';
      const lastSessionDate = getSafeDateObj(lastSessionStr);
      const hasUpcomingSession = lastSessionDate && lastSessionDate >= todayObj;
      const isStarred = !!c.isImportant;
      if (isStarred && hasUpcomingSession) return true;
      const currentMonth = todayObj.getMonth();
      const currentYear = todayObj.getFullYear();
      if (isAppellant && lastSessionDate && lastSessionDate.getMonth() === currentMonth && lastSessionDate.getFullYear() === currentYear) return true;
      const hasPendingTasks = c.tasks && c.tasks.some(t => t.status !== 'completed');
      if (hasPendingTasks && hasUpcomingSession && (lastSessionDate.getTime() - todayObj.getTime()) <= 7 * 24 * 60 * 60 * 1000) return true;
      return false;
    }).slice(0, 10);
  }, [cases]);

  const monthTabs = useMemo(() => {
    const tabs = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      tabs.push({ month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString('ar-EG', { month: 'short' }), isCurrent: i === 0 });
    }
    return tabs;
  }, []);

  const toggleWidget = (id) => {
    const next = hiddenWidgets.includes(id) ? hiddenWidgets.filter(w => w !== id) : [...hiddenWidgets, id];
    setHiddenWidgets(next);
    localStorage.setItem('dash-hidden-v3', JSON.stringify(next));
  };
  const isVisible = (id) => !hiddenWidgets.includes(id);

  
  // Quick Filter logic
  const handleQuickFilter = (type) => {
    let title = '';
    let filteredCases = [];
    const todayObj = new Date();
    todayObj.setHours(0,0,0,0);
    const currMonth = todayObj.getMonth();
    const currYear = todayObj.getFullYear();

    switch (type) {
      case 'memos':
        title = 'مذكرات الشهر';
        filteredCases = cases.filter(c => {
          const procs = Array.isArray(c.procedures) ? c.procedures : Object.values(c.procedures || {});
          return procs.some(p => {
             if (!p.title || (!p.title.includes('مذكرة') && !p.title.includes('مذكرات'))) return false;
             let dStr = p.date || p.createdAt;
             const d = getSafeDateObj(dStr);
             return d && d.getMonth() === currMonth && d.getFullYear() === currYear;
          });
        });
        break;
      case 'stop_appellant':
        title = 'الوقف الجزائي (طاعن/مدعي)';
        filteredCases = stats.criticalSuspended;
        break;
      case 'stop_appellee':
        title = 'الوقف (مطعون ضدنا)';
        filteredCases = cases.filter(c => {
          const role = String(c['الصفة'] || c['صفة'] || '').trim();
          const isAppellee = isAppelleeRole(role, settings);
          if (!isAppellee) return false;
          const s = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
          s.sort((a,b) => (getSafeDateObj(b.date)?.getTime() || 0) - (getSafeDateObj(a.date)?.getTime() || 0));
          const latest = s[0];
          if (!latest) return false;
          if (latest.hasJudgment) {
             const cAs = latest.judgmentClassification || latest.judgment?.result || '';
             return isStopImpact(cAs, activeMapping);
          }
          const dec = String(latest.decision || '').trim();
          return isStopImpact(dec, activeMapping);
        });
        break;
      case 'consideration':
        title = 'اعتبار الدعوى كأن لم تكن';
        filteredCases = stats.criticalConsidered;
        break;
      case 'judgments_this_month':
        title = 'أحكام الشهر';
        filteredCases = stats.judgedCases.filter(c => {
           const s = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
           const judged = s.find(s => s.hasJudgment);
           if (!judged) return false;
           const d = getSafeDateObj(judged.date);
           return d && d.getMonth() === currMonth && d.getFullYear() === currYear;
        });
        break;
      case 'bad_judgments_this_month':
        title = 'الأحكام الضد هذا الشهر';
        filteredCases = stats.criticalAgainst.filter(c => {
           const s = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
           const judged = s.find(s => s.hasJudgment);
           if (!judged) return false;
           const d = getSafeDateObj(judged.date);
           return d && d.getMonth() === currMonth && d.getFullYear() === currYear;
        });
        break;
      case 'next_session':
        // Find the absolute closest session date >= today
        let closestDate = null;
        const futureCases = [];
        cases.forEach(c => {
          const sList = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
          sList.forEach(s => {
             const d = getSafeDateObj(s.date);
             if (d && d >= todayObj) {
                if (!closestDate || d < closestDate) {
                   closestDate = d;
                   futureCases.length = 0; // reset
                   futureCases.push(c);
                } else if (d.getTime() === closestDate.getTime()) {
                   if (!futureCases.includes(c)) futureCases.push(c);
                }
             }
          });
        });
        filteredCases = futureCases;
        title = closestDate ? `جلسات قادمة (${closestDate.toLocaleDateString('ar-EG')})` : 'أقرب جلسة قادمة';
        break;
      default:
        break;
    }

    setAgendaModal({ isOpen: true, title, casesList: filteredCases });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/files?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleAdvancedSearch = (params) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
    navigate(`/files?${q.toString()}`);
  };

  const handleCompleteTask = async (taskType, caseId, taskId, notes) => {
    const now = new Date().toISOString();
    if (taskType === 'global') {
      const t = globalTasks.find(t => t.id === taskId);
      if (t) {
        await completeGlobalTask(taskId, notes);
        toast('تم تسجيل الإجراء بنجاح', 'success');
      }
      return;
    }
    const c = cases.find(c => c.id === caseId);
    if (!c) return;
    await saveCaseToFirebase(caseId, { tasks: c.tasks.map(t => t.id === taskId ? { ...t, status: 'completed', notes: notes || '', completedAt: now } : t) });
    toast('تم تسجيل الإجراء بنجاح', 'success');
  };

  const handleDeleteTaskAdmin = async (taskType, caseId, taskId) => {
    const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذه المهمة؟');
    if (!confirmed) return;
    const c = cases.find(c => c.id === caseId);
    if (!c) return;
    await saveCaseToFirebase(caseId, { tasks: c.tasks.filter(t => t.id !== taskId) });
    toast('تم الحذف بنجاح', 'success');
  };

  const userEmail = currentUser || '';
  const usernameOnly = userEmail.split('@')[0];

  const { pendingTasks, completedTasks } = useMemo(() => {
    if (!isEmployee) return { pendingTasks: [], completedTasks: [] };
    const isAssignedToMe = (assignee) => {
      if (!assignee) return false;
      const ass = assignee.toLowerCase().trim();
      return ass === userEmail.toLowerCase().trim() ||
             ass === usernameOnly.toLowerCase().trim() ||
             ass === (currentUserName || '').toLowerCase().trim();
    };

    const myTasks = [];
    cases.forEach(c => {
      if (c.tasks) c.tasks.forEach(t => {
        if (isAssignedToMe(t.assignee))
          myTasks.push({ ...t, caseId: c.id, caseNum: c['رقم الدعوى'] || c.id, year: c['السنة'], type: 'case', caseCover: c.coverImage });
      });
    });
    globalTasks.forEach(t => {
      if (isAssignedToMe(t.assignee)) {
        let caseNum = 'مهمة عامة', caseCover = null;
        if (t.linkedCases?.length > 0) {
          const fc = cases.find(c => c.id === t.linkedCases[0]);
          if (fc) { caseNum = t.linkedCases.length > 1 ? `مرتبطة بـ ${t.linkedCases.length} ملفات` : (fc['رقم الدعوى'] || 'ملف'); caseCover = fc.coverImage; }
        }
        myTasks.push({ ...t, type: 'global', caseNum, caseCover });
      }
    });
    
    const pTasks = myTasks.filter(t => t.status !== 'completed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const cTasks = myTasks.filter(t => t.status === 'completed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return { pendingTasks: pTasks, completedTasks: cTasks };
  }, [cases, globalTasks, currentUser, currentUserName, userEmail, usernameOnly, isEmployee]);

  if (isEmployee) {
    return (
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="bg-emerald-600 rounded-3xl p-6 relative overflow-hidden shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative z-10 text-white">
            <h1 className="text-3xl font-black mb-2">مرحباً، أ. {currentUserName} 👋</h1>
            <p className="text-sm font-bold text-emerald-100">إليك المهام المطلوبة منك اليوم</p>
          </div>
          <button onClick={() => logoutAdmin().then(() => navigate('/login'))} className="relative z-10 self-start md:self-center bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
            <LogOut className="w-4 h-4" /> تسجيل الخروج
          </button>
        </div>
        <form onSubmit={handleSearch} className="relative">
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="البحث السريع عن الملفات..."
            className="w-full bg-white border-2 border-slate-200 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:outline-none focus:border-emerald-500 transition shadow-sm text-navy-900" />
          <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white hover:bg-emerald-700 transition">
            <Search className="w-5 h-5" />
          </button>
        </form>

        <div className="flex items-center justify-between mb-3 mt-2 px-1">
          <h3 className="font-bold text-navy-900 text-sm">إحصائياتك السريعة</h3>
          <div className="bg-slate-200/70 p-1 rounded-lg flex text-[10px] font-bold">
            <button 
              onClick={() => setViewMonth({ month: today.getMonth(), year: today.getFullYear() })}
              className={`px-3 py-1.5 rounded-md transition-all ${viewMonth.month === today.getMonth() && viewMonth.year === today.getFullYear() ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900'}`}
            >
              الشهر الحالي
            </button>
            <button 
              onClick={() => {
                const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                setViewMonth({ month: prev.getMonth(), year: prev.getFullYear() });
              }}
              className={`px-3 py-1.5 rounded-md transition-all ${viewMonth.month !== today.getMonth() || viewMonth.year !== today.getFullYear() ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-900'}`}
            >
              الشهر السابق
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-3 mb-4">
          <div className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500">دعاوى جديدة</span>
                <span className="text-lg font-black text-navy-900 leading-none mt-1">{selectedMonthStats.casesAdded}</span>
              </div>
            </div>
            {selectedMonthStats.casesAdded !== prevMonthStats.casesAdded && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedMonthStats.casesAdded > prevMonthStats.casesAdded ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {selectedMonthStats.casesAdded > prevMonthStats.casesAdded ? '↑' : '↓'}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500">الملفات المتداولة</span>
                <span className="text-lg font-black text-navy-900 leading-none mt-1">{selectedMonthStats.sessions}</span>
              </div>
            </div>
            {selectedMonthStats.sessions !== prevMonthStats.sessions && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedMonthStats.sessions > prevMonthStats.sessions ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {selectedMonthStats.sessions > prevMonthStats.sessions ? '↑' : '↓'}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500">أحكام لصالحنا</span>
                <span className="text-lg font-black text-navy-900 leading-none mt-1">{selectedMonthStats.judgments.good}</span>
              </div>
            </div>
            {selectedMonthStats.judgments.good !== prevMonthStats.judgments.good && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedMonthStats.judgments.good > prevMonthStats.judgments.good ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {selectedMonthStats.judgments.good > prevMonthStats.judgments.good ? '↑' : '↓'}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <X className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500">أحكام ضدنا</span>
                <span className="text-lg font-black text-navy-900 leading-none mt-1">{selectedMonthStats.judgments.bad}</span>
              </div>
            </div>
            {selectedMonthStats.judgments.bad !== prevMonthStats.judgments.bad && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedMonthStats.judgments.bad > prevMonthStats.judgments.bad ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {selectedMonthStats.judgments.bad > prevMonthStats.judgments.bad ? '↑' : '↓'}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500">الوقف الجزائي</span>
                <span className="text-lg font-black text-navy-900 leading-none mt-1">{selectedMonthStats.judgments.penaltyStop}</span>
              </div>
            </div>
            {selectedMonthStats.judgments.penaltyStop !== prevMonthStats.judgments.penaltyStop && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedMonthStats.judgments.penaltyStop > prevMonthStats.judgments.penaltyStop ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {selectedMonthStats.judgments.penaltyStop > prevMonthStats.judgments.penaltyStop ? '↑' : '↓'}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-black text-navy-900 px-2 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" /> مهام قيد التنفيذ ({pendingTasks.length})
          </h2>
          {pendingTasks.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500 font-bold text-sm">لا توجد مهام جديدة مطلوبة منك حالياً.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingTasks.map(task => (
                <div key={task.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-4 gap-3">
                    <div className="flex gap-3">
                      {task.caseCover && (
                        <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                          <img src={task.caseCover} alt="Cover" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <span className={`text-[10px] font-black px-2 py-1 rounded-md mb-2 inline-block ${task.type === 'global' && !task.linkedCases?.length ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {task.type === 'global' && !task.linkedCases?.length ? 'مهمة عامة' : `رقم ${task.caseNum} ${task.year ? `لسنة ${task.year}` : ''}`}
                        </span>
                        <h3 className="font-black text-navy-900 text-sm leading-relaxed">{task.title}</h3>
                        {task.description && <p className="text-xs text-slate-500 font-bold mt-1 whitespace-pre-wrap">{task.description}</p>}
                      </div>
                    </div>
                    {task.type === 'case' && (
                      <button onClick={() => navigate(`/case/${task.caseId}`)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition shrink-0">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button onClick={async () => { const n = await showPrompt('تسجيل إجراء', 'ملاحظات (اختياري):'); if (n !== null) await handleCompleteTask(task.type, task.caseId, task.id, n); }}
                    className="w-full group bg-slate-50 border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-500 text-slate-500 hover:text-white font-black py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-lg active:scale-[0.98]">
                    <CheckCircle2 className="w-4 h-4" /> تأشير كـ "مُنجز"
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {completedTasks.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-slate-200">
            <h2 className="text-sm font-black text-slate-400 px-2">مهام تم إنجازها حديثاً</h2>
            {completedTasks.slice(0, 5).map(task => (
              <div key={task.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex justify-between items-center gap-3">
                <div>
                  <h3 className="font-black text-slate-600 text-xs line-through mb-1">{task.title}</h3>
                  {task.description && <p className="text-[10px] font-bold text-slate-400 mb-1 line-through line-clamp-1">{task.description}</p>}
                  <p className="text-[10px] font-bold text-slate-400">رقم {task.caseNum}</p>
                  {task.notes && <p className="text-[10px] font-bold text-emerald-600 mt-1 bg-emerald-50 px-2 py-1 rounded-md inline-block">{task.notes}</p>}
                </div>
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md shrink-0">تم التنفيذ</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const donutSegments = stats.topJudgments.map(([name, value]) => ({ name, value, color: getJColor(name) }));
  const donutTotal = donutSegments.reduce((s, d) => s + d.value, 0);
  const viewMonthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString('ar-EG', { month: 'long' });

  // ─── Consultant / Admin view ────────────────────────────────
  return (
    <div className="space-y-4 pb-24 animate-fade-in">

      {/* ── Search Bar Section (Darkest) ──────────────────────── */}
      <div className="bg-[#0a131c] rounded-3xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
        {/* Decorative lights */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl translate-x-10 -translate-y-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -translate-x-10 translate-y-10 pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم الدعوى أو الخصم..."
                className="w-full bg-slate-800/50 text-white placeholder-slate-400 border border-slate-700/50 rounded-xl py-3 pl-12 pr-12 text-sm font-bold focus:outline-none focus:border-amber-500/50 focus:bg-slate-800 transition-all" />
              <button type="submit" className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-amber-500 hover:text-amber-400 hover:bg-slate-700 transition">
                <Search className="w-5 h-5" />
              </button>
            </div>
            
            {/* Smart Search Icon Button */}
            <button type="button" onClick={() => setIsAdvancedSearchOpen(true)} className="w-12 h-[46px] bg-slate-800/80 hover:bg-slate-700 text-amber-400 rounded-xl flex items-center justify-center transition border border-slate-700 shadow-sm shrink-0" title="بحث ذكي">
              <Sparkles className="w-5 h-5" />
            </button>

            {/* Quick Filters Toggle Button */}
            <button type="button" onClick={() => setShowQuickFilters(!showQuickFilters)} className={`w-12 h-[46px] rounded-xl flex items-center justify-center transition border shadow-sm shrink-0 ${showQuickFilters ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'}`} title="الفلاتر السريعة">
              <Filter className="w-5 h-5" />
            </button>
          </form>

          {/* Quick Filters Row */}
          {showQuickFilters && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 animate-fade-in">
              <button type="button" onClick={() => handleQuickFilter('memos')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-700">مذكرات الشهر</button>
              <button type="button" onClick={() => handleQuickFilter('stop_appellant')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-700">وقف جزائي (طاعن)</button>
              <button type="button" onClick={() => handleQuickFilter('stop_appellee')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-700">وقف (مطعون ضده)</button>
              <button type="button" onClick={() => handleQuickFilter('consideration')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-700">الاعتبار</button>
              <button type="button" onClick={() => handleQuickFilter('judgments_this_month')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-slate-700">أحكام الشهر</button>
              <button type="button" onClick={() => handleQuickFilter('bad_judgments_this_month')} className="bg-slate-800 hover:bg-rose-900/50 text-rose-400 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-rose-900/50">أحكام ضد (الشهر)</button>
              <button type="button" onClick={() => handleQuickFilter('next_session')} className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 px-3 py-1.5 rounded-lg text-[10px] font-bold transition border border-amber-500/20">أقرب جلسة قادمة</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────────────── */}
            {/* ── B4: Stale Ongoing Alert ── */}
      {stats.staleOngoingCases?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm mb-4 cursor-pointer hover:bg-amber-100 transition"
             onClick={() => setAgendaModal({ isOpen: true, title: 'قضايا بدون جلسة قادمة محددة', casesList: stats.staleOngoingCases })}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-black text-amber-900 text-sm">تنبيه: قضايا متداولة بدون تاريخ جلسة قادمة</h3>
              <p className="text-xs font-bold text-amber-700 mt-0.5">يوجد {stats.staleOngoingCases.length} قضية متداولة لا تحتوي على جلسة مستقبلية محددة. اضغط للمراجعة.</p>
            </div>
          </div>
        </div>
      )}

      {stats.alerts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="w-full">
              <h3 className="font-black text-rose-900 mb-2 text-sm">⚠️ تنبيهات إجرائية هامة</h3>
              <div className="flex flex-col gap-1.5">
                {stats.alerts.map((a, i) => (
                  <div key={i} className="bg-white border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs font-bold flex justify-between items-center transition">
                    <button onClick={() => {
                      if (a.type === 'task_alert_group') {
                        navigate(`/files?q=&role=all&requiredTask=${a.ruleName}`);
                      } else {
                        navigate(`/case/${a.case.id}`);
                      }
                    }} className="flex-1 text-right hover:text-rose-900 truncate">
                      {a.type === 'task_alert_group' ? (
                        <span>({a.count}) ملف يتطلب مهمة: {a.ruleName}</span>
                      ) : (
                        <span>رقم {a.case['رقم الدعوى'] || a.case.id} | {a.ruleName}</span>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-rose-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {a.daysLeft < 0 ? `متأخر منذ ${Math.abs(a.daysLeft)} يوم` : a.daysLeft === 0 ? 'اليوم' : `باقي ${a.daysLeft} يوم`}
                      </span>
                      {a.type === 'task_alert_group' && (
                        <button
                          onClick={async () => {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            for (const tid of a.taskIds) {
                              const tObj = globalTasks.find(t => t.id === tid);
                              if (tObj) {
                                await saveGlobalTask({ ...tObj, snoozedUntil: tomorrow.toISOString() }, tid);
                              }
                            }
                            toast('تم تأجيل التنبيه للغد', 'success');
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded p-1.5 transition"
                          title="تأجيل للغد (Snooze)"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Monthly Matrix (مقارنة الأداء الشهري) ────────────── */}
      <div className="bg-[#1e293b] rounded-2xl p-4 shadow-sm border border-slate-700/50">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-black text-white">إحصائيات {viewMonthLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900/50 border border-slate-700/50 rounded-lg p-1">
              {monthTabs.map(tab => {
                const isSelected = tab.month === viewMonth.month && tab.year === viewMonth.year;
                return (
                  <button key={`${tab.year}-${tab.month}`}
                    onClick={() => setViewMonth({ month: tab.month, year: tab.year })}
                    className={`px-3 py-1 rounded-md text-[11px] font-black transition-all ${isSelected ? 'bg-amber-500 text-[#0f172a] shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                    {tab.label}
                    {tab.isCurrent && <span className="mr-1 text-[7px] opacity-70">●</span>}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowPrintModal(true)}
              className="flex items-center justify-center w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700/50">
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Side-by-side comparison cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { label: 'جلسات التداول', curr: selectedMonthStats.sessions, prev: prevMonthStats.sessions, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'مذكرات الدفاع', curr: selectedMonthStats.memos, prev: prevMonthStats.memos, icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'أحكام صادرة', curr: selectedMonthStats.judgments.total, prev: prevMonthStats.judgments.total, icon: Gavel, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(metric => {
            const diff = metric.curr - metric.prev;
            return (
              <div key={metric.label} className="bg-slate-900/50 rounded-xl p-3 border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-lg ${metric.bg} flex items-center justify-center shrink-0`}>
                    <metric.icon className={`w-4 h-4 ${metric.color}`} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">{metric.label}</span>
                    <span className={`text-xl font-black ${metric.color} leading-none`}>{metric.curr}</span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-[9px] text-slate-500 block">سابق: {metric.prev}</span>
                  {diff > 0 ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">▲ {diff}</span>
                   : diff < 0 ? <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">▼ {Math.abs(diff)}</span>
                   : <span className="text-[10px] text-slate-500 bg-slate-500/10 px-1.5 py-0.5 rounded">—</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Judgment detail chips - clickable */}
        {selectedMonthStats.judgments.total > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-700/30">
            {[
              { l: 'صالح', v: selectedMonthStats.judgments.good, cases: selectedMonthStats.judgments.lists.good, color: 'text-emerald-400' },
              { l: 'ضد', v: selectedMonthStats.judgments.bad, cases: selectedMonthStats.judgments.lists.bad, color: 'text-rose-400' },
              { l: 'مختلط', v: selectedMonthStats.judgments.mixed, cases: selectedMonthStats.judgments.lists.mixed, color: 'text-indigo-400' },
              { l: 'وقف', v: selectedMonthStats.judgments.stop, cases: selectedMonthStats.judgments.lists.stop, color: 'text-orange-400' },
              { l: 'اعتبار', v: selectedMonthStats.judgments.consideration, cases: selectedMonthStats.judgments.lists.consideration, color: 'text-yellow-400' },
              
            ].map(item => {
              const isCritical = (item.l === 'وقف' && stats.criticalSuspended.length > 0) || (item.l === 'اعتبار' && stats.criticalConsidered.length > 0);
              return (
              <button key={item.l} onClick={() => setAgendaModal({ isOpen: true, title: `أحكام (${item.l}) لشهر ${viewMonthLabel}`, casesList: item.cases })}
                className={`relative flex-1 min-w-[45px] bg-slate-900/20 hover:bg-slate-800 rounded-lg py-1.5 px-2 text-center border transition flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-sm active:scale-95 ${isCritical ? 'border-rose-500/30 hover:border-rose-500/60' : 'border-slate-700/20 hover:border-slate-600'}`}>
                {isCritical && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border border-slate-900"></span>
                  </span>
                )}
                <p className={`text-sm font-black ${item.color} leading-none`}>{item.v}</p>
                <p className="text-[9px] font-bold text-slate-400 leading-none">{item.l}</p>
              </button>
            )})}
          </div>
        )}
      </div>

      {/* ── KPI Cards (4 main judicial metrics) ──────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard
          icon={Calendar}
          label="القضايا النشطة"
          sublabel="جلسات قادمة (بعد اليوم)"
          value={stats.activeCasesCount}
          accentColor="#0ea5e9"
          bgFrom="from-sky-50" bgTo="to-blue-50/40"
          iconBg="bg-sky-100"
          border="border-sky-200"
          onClick={() => setAgendaModal({ isOpen: true, title: 'القضايا النشطة', casesList: stats.activeCases })}
          extra={
            stats.netTotal > 0 && (
              <p className="text-[9px] font-bold text-slate-400">
                {Math.round((stats.activeCasesCount / stats.netTotal) * 100)}% من إجمالي {stats.netTotal} ملف
              </p>
            )
          }
        />
        <KPICard
          icon={TrendingUp}
          label="إجمالي المتداول"
          sublabel="نشط · غير محجوز للحكم"
          value={stats.ongoingCount}
          accentColor="#d97706"
          bgFrom="from-amber-50" bgTo="to-orange-50/40"
          iconBg="bg-amber-100"
          border="border-amber-200"
          onClick={() => setAgendaModal({ isOpen: true, title: 'إجمالي المتداول', casesList: stats.ongoingCases })}
        extra={<p className="text-[9px] font-bold text-slate-400 mt-1">طاعن: {stats.ongoingAppellantCount || 0} · مطعون ضدنا: {stats.ongoingAppelleeCount || 0}</p>}
        />
        <KPICard
          icon={Clock}
          label="محجوز للحكم"
          sublabel="قرار الجلسة: للحكم"
          value={stats.reservedCount}
          accentColor="#7c3aed"
          bgFrom="from-violet-50" bgTo="to-purple-50/40"
          iconBg="bg-violet-100"
          border="border-violet-200"
          onClick={() => setAgendaModal({ isOpen: true, title: 'محجوز للحكم', casesList: stats.reservedCases })}
        />
        <KPICard
          icon={Scale}
          label="المحكوم فيها"
          sublabel="حكم مسجل"
          value={stats.judgedCount}
          accentColor="#059669"
          bgFrom="from-emerald-50" bgTo="to-green-50/40"
          iconBg="bg-emerald-100"
          border="border-emerald-200"
          onClick={() => setAgendaModal({ isOpen: true, title: 'المحكوم فيها', casesList: stats.judgedCases })}
          extra={
            stats.judgedCount > 0 && (
              <p className="text-[9px] font-bold text-slate-400">
                {Math.round((stats.judgedCount / (stats.netTotal || 1)) * 100)}% من الإجمالي
              </p>
            )
          }
        />
        <KPICard
          icon={Activity}
          label="متوسط مدة الفصل"
          sublabel="معدل أيام تداول الدعوى"
          value={Math.round(stats.avgResolutionDays || 0) + " يوم"}
          accentColor="#059669"
          bgFrom="from-emerald-50" bgTo="to-teal-50/40"
          iconBg="bg-emerald-100"
          border="border-emerald-200"
        />
      </div>

      {/* ── Charts Row ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Donut */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-slate-400" />
            <h3 className="font-black text-xs text-slate-600">توزيع الأحكام الكلي</h3>
          </div>
          {donutSegments.length > 0 ? (
            <div className="flex items-center justify-between gap-8 sm:gap-12">
              <div className="relative shrink-0">
                <DonutChart segments={donutSegments} size={130} thickness={22} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-navy-900">{donutTotal}</span>
                  <span className="text-[9px] font-bold text-slate-400">حكم</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 min-w-0 py-1">
                {donutSegments.slice(0, 7).map(seg => {
                  const isCritical = (isStopImpact(seg.name, activeMapping) && stats.criticalSuspended.length > 0) || (resolveImpact(seg.name, activeMapping) === 'consideration' && stats.criticalConsidered.length > 0);
                  return (
                  <div key={seg.name} className="flex items-center justify-between gap-2 relative">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 relative" style={{ backgroundColor: seg.color }}>
                        {isCritical && <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping"></span>}
                      </div>
                      <span className={`text-xs font-bold truncate ${isCritical ? 'text-rose-600' : 'text-slate-700'}`}>{seg.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-black text-slate-600">{seg.value}</span>
                      <span className="text-[9px] text-slate-400">({Math.round(seg.value / donutTotal * 100)}%)</span>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          ) : <p className="text-xs text-slate-400 font-bold text-center py-8">لا توجد أحكام مسجلة حتى الآن</p>}
        </div>

        {/* Performance Chart (Appellant vs Appellee) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="font-black text-xs text-slate-600">معدل الأداء (الصالح والضد)</h3>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Appellant Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-600">قضايا الطاعنين</span>
                <span className="text-[10px] font-black text-slate-400">{stats.performanceSplit.appellant.total} حكم</span>
              </div>
              <div className="h-4 flex rounded-full overflow-hidden bg-slate-100">
                {stats.performanceSplit.appellant.total > 0 ? (
                  <>
                    <div style={{ width: `${(stats.performanceSplit.appellant.good / stats.performanceSplit.appellant.total) * 100}%` }} className="bg-emerald-500 hover:opacity-90 transition-opacity relative group cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 transition-opacity">صالح: {stats.performanceSplit.appellant.good}</div>
                    </div>
                    <div style={{ width: `${(stats.performanceSplit.appellant.bad / stats.performanceSplit.appellant.total) * 100}%` }} className="bg-rose-500 hover:opacity-90 transition-opacity relative group cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 transition-opacity">ضد: {stats.performanceSplit.appellant.bad}</div>
                    </div>
                    <div style={{ width: `${(stats.performanceSplit.appellant.mixed / stats.performanceSplit.appellant.total) * 100}%` }} className="bg-blue-500 hover:opacity-90 transition-opacity relative group cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 transition-opacity">مختلط: {stats.performanceSplit.appellant.mixed}</div>
                    </div>
                    <div style={{ width: `${(stats.performanceSplit.appellant.procedural / stats.performanceSplit.appellant.total) * 100}%` }} className="bg-slate-300 hover:opacity-90 transition-opacity relative group cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 transition-opacity">إجرائي: {stats.performanceSplit.appellant.procedural}</div>
                    </div>
                  </>
                ) : <div className="w-full bg-slate-100"></div>}
              </div>
            </div>
            
            {/* Appellee Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-600">قضايا المطعون ضدهم</span>
                <span className="text-[10px] font-black text-slate-400">{stats.performanceSplit.appellee.total} حكم</span>
              </div>
              <div className="h-4 flex rounded-full overflow-hidden bg-slate-100">
                {stats.performanceSplit.appellee.total > 0 ? (
                  <>
                    <div style={{ width: `${(stats.performanceSplit.appellee.good / stats.performanceSplit.appellee.total) * 100}%` }} className="bg-emerald-500 hover:opacity-90 transition-opacity relative group cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 transition-opacity">صالح: {stats.performanceSplit.appellee.good}</div>
                    </div>
                    <div style={{ width: `${(stats.performanceSplit.appellee.bad / stats.performanceSplit.appellee.total) * 100}%` }} className="bg-rose-500 hover:opacity-90 transition-opacity relative group cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 transition-opacity">ضد: {stats.performanceSplit.appellee.bad}</div>
          {/* ── B2: Win/Loss Trend ── */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <h4 className="font-black text-slate-600 text-[11px] mb-3">اتجاه كسب/خسارة القضايا (6 شهور)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50/50 rounded-xl p-2 border border-emerald-100/50">
                <p className="text-[9px] font-bold text-emerald-600 mb-1">الأحكام الصالحة</p>
                <div className="h-8">
                  <TrendLine data={(stats.last6Months || []).map(d => ({ count: d.good }))} color="#10b981" />
                </div>
              </div>
              <div className="bg-rose-50/50 rounded-xl p-2 border border-rose-100/50">
                <p className="text-[9px] font-bold text-rose-600 mb-1">الأحكام الضد</p>
                <div className="h-8">
                  <TrendLine data={(stats.last6Months || []).map(d => ({ count: d.bad }))} color="#f43f5e" />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-2 px-2">
              {(stats.last6Months || []).map(m => (
                <span key={m.label} className="text-[8px] font-bold text-slate-400">{m.label}</span>
              ))}
            </div>
          </div>
                    </div>
                    <div style={{ width: `${(stats.performanceSplit.appellee.mixed / stats.performanceSplit.appellee.total) * 100}%` }} className="bg-blue-500 hover:opacity-90 transition-opacity relative group cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 transition-opacity">مختلط: {stats.performanceSplit.appellee.mixed}</div>
                    </div>
                    <div style={{ width: `${(stats.performanceSplit.appellee.procedural / stats.performanceSplit.appellee.total) * 100}%` }} className="bg-slate-300 hover:opacity-90 transition-opacity relative group cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] py-1 px-2 rounded font-bold whitespace-nowrap z-10 transition-opacity">إجرائي: {stats.performanceSplit.appellee.procedural}</div>
                    </div>
                  </>
                ) : <div className="w-full bg-slate-100"></div>}
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-3 pt-3">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[9px] font-bold text-slate-500">صالح</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[9px] font-bold text-slate-500">ضد</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[9px] font-bold text-slate-500">مختلط</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300"></div><span className="text-[9px] font-bold text-slate-500">إجرائي/أخرى</span></div>
            </div>
          </div>
        </div>
      </div>


      {/* ── Tabs Navigation ── */}
      <div className="flex flex-wrap gap-2 mb-4 bg-slate-100 p-1.5 rounded-2xl w-fit">
        {[
          { id: 'priority', icon: Star, label: 'أولوية المستشار' },
          
          { id: 'details', icon: PieChart, label: 'إحصائيات تفصيلية' },
          { id: 'tasks', icon: ClipboardList, label: 'تقارير الموظفين' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setBottomTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${bottomTab === tab.id ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500 hover:text-navy-900'}`}>
            <tab.icon className={`w-4 h-4 ${bottomTab === tab.id ? 'text-amber-500' : ''}`} /> {tab.label}
          </button>
        ))}
      </div>

      {bottomTab === 'priority' && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
              <div>
                <h3 className="font-black text-sm text-[#0f172a]">أولوية المستشار ⭐</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">الملفات المميزة بنجمة أو قضايا الطعن الجاري جلساتها هذا الشهر</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-3 py-1 rounded-full">{priorityCases.length} ملفات</span>
          </div>
          {priorityCases.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400 font-bold">لا توجد قضايا ذات أولوية حالياً.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {priorityCases.map(c => {
                const role = String(c['الصفة'] || c['صفة'] || '').trim();
                const lastSessionStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || '';
                return (
                  <div key={c.id} onClick={() => navigate(`/case/${c.id}`)}
                    className="border border-slate-200 hover:border-amber-200 bg-slate-50/40 p-3.5 rounded-2xl transition cursor-pointer flex justify-between gap-3 shadow-sm hover:shadow">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Star className={`w-3.5 h-3.5 shrink-0 ${c.isImportant ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                        <span className="text-xs font-black text-[#0f172a] truncate">رقم {c['رقم الدعوى']} لسنة {c['السنة']} ق</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isAppellantRole(role, settings) ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                          {isAppellantRole(role, settings) ? 'طاعن' : 'مطعون ضده'}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mt-1 truncate">الخصم: {c['المدعى_عليه'] || c['المدعى عليه'] || 'غير محدد'}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-[9px] text-slate-400 block">الجلسة القادمة</span>
                      <span className="text-xs font-black text-slate-700 block mt-0.5">{lastSessionStr || 'غير محدد'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}



      {bottomTab === 'details' && (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider">إحصائيات تفصيلية</h2>
            <button onClick={() => setShowCustomize(!showCustomize)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition ${showCustomize ? 'bg-[#0f172a] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              <Settings2 className="w-3.5 h-3.5" /> تخصيص
            </button>
          </div>
          {showCustomize && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-3 flex flex-wrap gap-2 animate-fade-in">
              {[
                { id: 'entities', label: 'الجهات رافعة الدعوى' },
                { id: 'years', label: 'توزيع الملفات بالسنة' },
                { id: 'judgment-list', label: 'قائمة تصنيف الأحكام' },
              ].map(w => (
                <button key={w.id} onClick={() => toggleWidget(w.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition border ${isVisible(w.id) ? 'bg-white border-slate-200 text-navy-900 shadow-sm' : 'bg-slate-100 border-transparent text-slate-400'}`}>
                  {isVisible(w.id) ? <Eye className="w-3.5 h-3.5 text-emerald-500" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {w.label}
                </button>
              ))}
            </div>
          )}
          <div className={`grid gap-3 ${[isVisible('entities'), isVisible('years'), isVisible('judgment-list')].filter(Boolean).length >= 2 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'}`}>
            {isVisible('entities') && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <h3 className="font-black text-xs text-slate-600">الجهات رافعة الدعوى</h3>
                </div>
                {stats.topOpponents.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topOpponents.map(([name, count], i) => {
                      const mx = stats.topOpponents[0][1];
                      return (
                        <div key={name} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <div className="flex items-center gap-1.5 overflow-hidden">
                              <span className="w-4 h-4 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] shrink-0">{i + 1}</span>
                              <span className="truncate text-navy-900">{name}</span>
                            </div>
                            <span className="text-slate-500 shrink-0 ml-2">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-l from-amber-400 to-amber-500 rounded-full" style={{ width: `${(count / mx) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-slate-400 font-bold text-center py-4">لا توجد بيانات</p>}
              </div>
            )}
            {isVisible('years') && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <h3 className="font-black text-xs text-slate-600">توزيع الملفات (بالسنة)</h3>
                </div>
                <div className="space-y-3">
                  {stats.topYears.map(([year, count]) => {
                    const mx = stats.topYears[0][1];
                    return (
                      <div key={year} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-navy-900">سنة {year}</span><span className="text-slate-500">{count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-l from-blue-400 to-indigo-500 rounded-full" style={{ width: `${(count / mx) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {isVisible('judgment-list') && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-slate-400" />
                  <h3 className="font-black text-xs text-slate-600">تصنيف الأحكام الكلية</h3>
                </div>
                {stats.topJudgments.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topJudgments.map(([name, count]) => {
                      const total = stats.topJudgments.reduce((s, c) => s + c[1], 0);
                      const pct = Math.round((count / total) * 100);
                      const color = getJColor(name);
                      const isCritical = (isStopImpact(name, activeMapping) && stats.criticalSuspended.length > 0) || (resolveImpact(name, activeMapping) === 'consideration' && stats.criticalConsidered.length > 0);
                      return (
                        <div key={name} className="space-y-1 relative">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full shrink-0 relative" style={{ backgroundColor: color }}>
                                {isCritical && <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping"></span>}
                              </div>
                              <span className={isCritical ? 'text-rose-600' : 'text-navy-900'}>{name}</span>
                            </div>
                            <span className="text-slate-500">{count} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isCritical ? 'bg-rose-500' : ''}`} style={{ width: `${pct}%`, backgroundColor: isCritical ? undefined : color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-xs text-slate-400 font-bold text-center py-4">لا توجد أحكام مسجلة</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {bottomTab === 'tasks' && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity className="w-6 h-6 text-indigo-600" />
              <div>
                <h2 className="font-black text-lg text-navy-900">تقارير أداء الموظفين</h2>
                <p className="text-[11px] font-bold text-slate-500">سجل بجميع المهام المنفذة مؤخراً</p>
              </div>
            </div>
            <button onClick={() => setIsGlobalTaskModalOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> إنشاء مهمة عامة
            </button>
          </div>
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
            {[['pending', 'مهام قيد التنفيذ'], ['completed', 'مهام تم تنفيذها']].map(([key, label]) => (
              <button key={key} onClick={() => setAdminTasksTab(key)}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${adminTasksTab === key ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-navy-900'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {(() => {
              const allTasks = [];
              cases.forEach(c => { if (c.tasks) c.tasks.forEach(t => allTasks.push({ ...t, caseId: c.id, caseNum: c['رقم الدعوى'] || c.id, year: c['السنة'], type: 'case' })); });
              globalTasks.forEach(t => allTasks.push({ ...t, type: 'global', caseNum: t.linkedCases?.length ? `مرتبطة بـ ${t.linkedCases.length} ملفات` : 'مهمة عامة' }));
              const displayed = allTasks
                .filter(t => adminTasksTab === 'completed' ? t.status === 'completed' : t.status !== 'completed')
                .sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));
              if (displayed.length === 0) return (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs font-bold text-slate-500">{adminTasksTab === 'completed' ? 'لم يتم تنفيذ أي مهام حتى الآن.' : 'لا توجد مهام قيد التنفيذ حالياً.'}</p>
                </div>
              );
              return displayed.map(task => {
                const d = new Date(task.completedAt || task.createdAt);
                return (
                  <div key={`${task.caseId}-${task.id}`} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between gap-4 hover:bg-slate-100 transition">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-navy-900 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">{task.assignee}</span>
                        <h4 className="font-black text-sm text-navy-900">{task.title}</h4>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 mb-2">رقم الدعوى: {task.caseNum} {task.year && `لسنة ${task.year}`}</p>
                      {task.notes && <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100 inline-block">ملاحظة: {task.notes}</p>}
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                      {task.status === 'completed' ? (
                        <>
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1 border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> تم التنفيذ</span>
                          <span className="text-[10px] font-bold text-slate-400">{d.toLocaleDateString('ar-EG')}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">قيد التنفيذ</span>
                          <span className="text-[10px] font-bold text-slate-400">{d.toLocaleDateString('ar-EG')}</span>
                          <button onClick={() => handleDeleteTaskAdmin(task.type, task.caseId, task.id)} className="text-[10px] font-bold text-rose-500 hover:text-white hover:bg-rose-500 px-2 py-1 rounded-md transition">حذف</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}


      <BulkAssignTaskModal isOpen={isGlobalTaskModalOpen} onClose={() => setIsGlobalTaskModalOpen(false)} selectedCases={[]} onClearSelection={() => { }} />
      {agendaModal.isOpen && (
        <JudicialAgendaReportModal
          title={agendaModal.title}
          casesList={agendaModal.casesList}
          onClose={() => setAgendaModal({ isOpen: false, title: '', casesList: [] })}
        />
      )}
      {showPrintModal && (
        <PrintReportModal
          stats={stats} settings={settings}
          selectedMonthStats={selectedMonthStats}
          selectedMonth={viewMonth.month} selectedYear={viewMonth.year}
          onClose={() => setShowPrintModal(false)}
        />
      )}

    </div>
  );
}
