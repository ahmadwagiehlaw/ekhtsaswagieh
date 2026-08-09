import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isPast, isToday, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { CalendarDays, ChevronRight, ChevronLeft, Gavel, Printer, CalendarX2, CopyPlus, ClipboardList, ListFilter, FileText, Zap, X, BookOpen, Settings2, Camera } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import ExportPDFModal from '../components/ExportPDFModal';
import BulkSessionRolloverModal from '../components/BulkSessionRolloverModal';
import SessionTable from '../components/SessionTable';
import SessionsRollTab from '../components/SessionsRollTab';
import JudgmentsRollTab from '../components/JudgmentsRollTab';
import GlobalTemplatePrintModal from '../components/GlobalTemplatePrintModal';
import FieldOptionsManager from '../components/FieldOptionsManager';
import { getSafeDateObj } from '../utils/dateUtils';
import { printViewingTasksList } from '../utils/printViewingTasks';
import { useUI } from '../context/UIContext';
import useSessionState from '../hooks/useSessionState';

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const ARABIC_DAYS_LONG = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

// ──────────────────────────────────────────────────────────────────
//  Defined OUTSIDE Agenda to prevent remount on every state change
// ──────────────────────────────────────────────────────────────────

function EditableCell({ caseObj, field, displayValue, inputType, datalistId, editingCell, editingValue, setEditingValue, startEdit, commitEdit, cancelEdit }) {
  const isEditing = editingCell?.caseId === caseObj.id && editingCell?.field === field;
  if (isEditing) {
    return (
      <input
        autoFocus
        type={inputType || 'text'}
        list={datalistId}
        value={editingValue}
        onChange={e => setEditingValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
        className="border-b-2 border-indigo-500 bg-white text-xs font-bold text-navy-900 px-1 py-0.5 rounded outline-none focus:bg-indigo-50 transition min-w-[80px]"
      />
    );
  }
  return (
    <span
      onClick={() => startEdit(caseObj.id, field, String(displayValue || ''))}
      className="cursor-pointer hover:bg-indigo-50 rounded px-1 py-0.5 transition text-xs font-bold text-navy-900"
      title="انقر للتعديل"
    >
      {displayValue || <span className="text-slate-300 italic text-[10px]">—</span>}
    </span>
  );
}

function CaseCard({ caseObj, idx, globalTasks, getFieldValue, settings, editingCell, editingValue, setEditingValue, startEdit, commitEdit, cancelEdit, navigate, openFieldManager }) {
  const role = String(getFieldValue(caseObj, ['الصفة','صفة']) || '').trim();
  const decision = String(getFieldValue(caseObj, ['القرار']) || '').trim();
  const nextSession = String(getFieldValue(caseObj, ['تاريخ الجلسة']) || '').trim();
  const casePendingTasks = globalTasks.filter(t => t.status === 'pending' && t.linkedCases?.includes(caseObj.id));
  const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
  const isAppellee = role.includes('مطعون') || role.includes('مدعى عليه');
  let roleBadge = 'bg-amber-100 text-amber-800';
  if (isAppellant) roleBadge = 'bg-rose-100 text-rose-800';
  else if (isAppellee) roleBadge = 'bg-emerald-100 text-emerald-800';
  const DECISIONS = settings?.decisions || ['للحكم','للإعلان','للاطلاع','لورود التقرير','موضوع','تحضير','تصريح','استبعاد'];
  const isEditingThis = editingCell?.caseId === caseObj.id;

  return (
    <div className={`px-4 py-3 transition ${isEditingThis ? 'bg-indigo-50/40' : 'hover:bg-slate-50/70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-navy-900 text-amber-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{idx+1}</span>
          <div className="min-w-0 flex-1 space-y-1">
            {/* Case number + role */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-black text-navy-900">
                دعوى {getFieldValue(caseObj, ['رقم الدعوى'])} لسنة {getFieldValue(caseObj, ['السنة'])}
              </p>
              {role && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleBadge}`}>{role}</span>}
            </div>
            {/* Parties */}
            <p className="text-[11px] text-slate-500 font-bold truncate">
              {getFieldValue(caseObj, ['المدعي','الطاعن'])} ← {getFieldValue(caseObj, ['المدعى عليه','المطعون ضده','المدعى_عليه'])}
            </p>
            {/* Inline editable fields */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 items-center pt-0.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-bold shrink-0 flex items-center gap-0.5">
                  القرار:
                  <button type="button" onClick={(e) => { e.stopPropagation(); openFieldManager('decisions', 'القرار'); }} className="text-slate-300 hover:text-indigo-600">
                    <Settings2 className="w-3 h-3" />
                  </button>
                </span>
                <EditableCell
                  caseObj={caseObj} field="القرار" displayValue={decision}
                  datalistId={`decisions-agenda-${caseObj.id}`}
                  editingCell={editingCell} editingValue={editingValue}
                  setEditingValue={setEditingValue} startEdit={startEdit}
                  commitEdit={commitEdit} cancelEdit={cancelEdit}
                />
                <datalist id={`decisions-agenda-${caseObj.id}`}>
                  {DECISIONS.map((d, i) => <option key={i} value={d} />)}
                </datalist>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-bold shrink-0">الجلسة القادمة:</span>
                <EditableCell
                  caseObj={caseObj} field="تاريخ الجلسة" displayValue={nextSession}
                  inputType="date"
                  editingCell={editingCell} editingValue={editingValue}
                  setEditingValue={setEditingValue} startEdit={startEdit}
                  commitEdit={commitEdit} cancelEdit={cancelEdit}
                />
              </div>
            </div>
            {/* Pending tasks */}
            {casePendingTasks.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {casePendingTasks.map(t => (
                  <span key={t.id} className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                    <FileText className="w-2.5 h-2.5 shrink-0" />{t.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate(`/case/${caseObj.id}`)}
          className="shrink-0 bg-navy-900 hover:bg-navy-700 text-amber-300 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition mt-0.5">
          عرض
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
//  Main Component
// ──────────────────────────────────────────────────────────────────
export default function Agenda() {
  const { cases, globalTasks = [], settings, saveCaseToFirebase } = useAppContext();
  const { toast } = useUI();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useSessionState('agenda_activeTab', 'calendar');
  const [currentDate, setCurrentDate] = useState(() => {
    try {
      const storedKey = window.sessionStorage.getItem('agenda_selectedDateKey');
      if (storedKey) { const p = JSON.parse(storedKey); if (p) return new Date(p); }
    } catch (e) {}
    return new Date();
  });
  const [selectedDateKey, setSelectedDateKey] = useSessionState('agenda_selectedDateKey', null);
  const [calendarView, setCalendarView] = useSessionState('agenda_calendarView', 'month');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [calendarTaskFilter, setCalendarTaskFilter] = useSessionState('agenda_calTaskFilter', '');
  const [viewMode, setViewMode] = useSessionState('agenda_viewMode', 'table');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [managingField, setManagingField] = useState(null);
  const [isDocEngineOpen, setIsDocEngineOpen] = useState(false);
  const [tableFilteredCases, setTableFilteredCases] = useState(null);
  const [printDocType, setPrintDocType] = useState('roll');
  const [printOptions, setPrintOptions] = useState({
    title: '', showConsultant: true,
    consultantName: settings?.consultantName || '',
    showRole: true, showDecision: true, showTasks: true, showRoll: false,
  });

  // Inline edit state
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  const getFieldValue = useCallback((obj, keys) => {
    for (let key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    return '';
  }, []);

  const startEdit = useCallback((caseId, field, currentVal) => {
    setEditingCell({ caseId, field });
    setEditingValue(currentVal);
  }, []);

  const commitEdit = useCallback(async () => {
    if (!editingCell) return;
    const { caseId, field } = editingCell;
    const caseObj = cases.find(c => c.id === caseId);
    if (caseObj && String(caseObj[field] || '') !== String(editingValue)) {
      try {
        await saveCaseToFirebase({ ...caseObj, [field]: editingValue }, caseId);
        toast('تم الحفظ', 'success');
      } catch (e) { toast('حدث خطأ في الحفظ', 'error'); }
    }
    setEditingCell(null);
  }, [editingCell, editingValue, cases, saveCaseToFirebase, toast]);

  const cancelEdit = useCallback(() => setEditingCell(null), []);

  // All sessions map
  const allSessionsMap = useMemo(() => {
    const map = {};
    cases.forEach(cObj => {
      const dStr = getFieldValue(cObj, ['آخر جلسة','أخر جلسة','اخر جلسة','تاريخ الجلسة']);
      if (!dStr) return;
      const d = getSafeDateObj(dStr);
      if (!d) return;
      const pad = n => n.toString().padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (!map[key]) map[key] = [];
      map[key].push(cObj);
    });
    return map;
  }, [cases, getFieldValue]);

  const selectedDateCases = useMemo(() => {
    if (!selectedDateKey) return [];
    return allSessionsMap[selectedDateKey] || [];
  }, [allSessionsMap, selectedDateKey]);

  const selectedDateTasks = useMemo(() => {
    const taskTitles = new Set();
    selectedDateCases.forEach(cObj => {
      globalTasks.filter(t => t.status === 'pending' && t.linkedCases?.includes(cObj.id)).forEach(t => {
        if (t.title.startsWith('إطلاع وتصوير:')) taskTitles.add('إطلاع وتصوير (مخصص)');
        else taskTitles.add(t.title);
      });
    });
    return [...taskTitles].sort();
  }, [selectedDateCases, globalTasks]);

  const filteredDateCases = useMemo(() => {
    if (!calendarTaskFilter) return selectedDateCases;
    if (calendarTaskFilter === '__any__') return selectedDateCases.filter(c => globalTasks.some(t => t.status === 'pending' && t.linkedCases?.includes(c.id)));
    return selectedDateCases.filter(c => globalTasks.some(t => {
      if (!t.linkedCases?.includes(c.id) || t.status !== 'pending') return false;
      if (calendarTaskFilter === 'إطلاع وتصوير (مخصص)') return t.title.startsWith('إطلاع وتصوير:');
      return t.title === calendarTaskFilter;
    }));
  }, [selectedDateCases, calendarTaskFilter, globalTasks]);

  const casesWithTasksCount = useMemo(() =>
    selectedDateCases.filter(c => globalTasks.some(t => t.status === 'pending' && t.linkedCases?.includes(c.id))).length,
    [selectedDateCases, globalTasks]
  );

  const days = useMemo(() => {
    if (calendarView === 'week') return eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });
    const ms = startOfMonth(currentDate);
    return eachDayOfInterval({ start: startOfWeek(ms), end: endOfWeek(endOfMonth(ms)) });
  }, [currentDate, calendarView]);

  const monthSessionKeys = Object.keys(allSessionsMap).filter(k => k.startsWith(format(currentDate, 'yyyy-MM')));
  const monthSessionFiles = monthSessionKeys.reduce((acc, k) => acc + allSessionsMap[k].length, 0);

  const goToSession = (dir) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const keys = Object.keys(allSessionsMap).sort();
    const target = dir === 'next' ? keys.find(k => k >= todayStr) : [...keys].reverse().find(k => k < todayStr);
    if (target) { setCurrentDate(parseISO(target)); setSelectedDateKey(target); }
  };

  const handlePrint = () => {
    setIsPrintModalOpen(false);
    const pw = window.open('', '_blank', 'width=1100,height=850');
    if (!pw) { toast('يرجى السماح بالنوافذ المنبثقة', 'error'); return; }
    const casesToPrint = viewMode === 'table' ? (tableFilteredCases || filteredDateCases) : filteredDateCases;
    const title = printOptions.title || `كشف جلسة ${selectedDateKey}`;
    const consultant = printOptions.showConsultant && printOptions.consultantName ? `<div class="consultant">السيد المستشار / ${printOptions.consultantName}</div>` : '';
    const getCaseTasks = (c) => globalTasks.filter(t => t.status === 'pending' && t.linkedCases?.includes(c.id));
    let body = '';
    if (printDocType === 'roll') {
      let rows = '';
      casesToPrint.forEach((c, i) => {
        const tasks = getCaseTasks(c);
        const taskHtml = tasks.length ? tasks.map(t => `<span class="task-badge">${t.title}</span>`).join(' ') : '—';
        rows += `<tr><td>${i+1}</td>${printOptions.showRoll?`<td><strong>${getFieldValue(c,['رقم الرول','الرول'])||'—'}</strong></td>`:''}<td><strong>${getFieldValue(c,['رقم الدعوى'])} / ${getFieldValue(c,['السنة'])}</strong></td><td>${getFieldValue(c,['المدعي','الطاعن'])||'—'}</td><td>${getFieldValue(c,['المدعى عليه','المطعون ضده','المدعى_عليه'])||'—'}</td>${printOptions.showRole?`<td>${getFieldValue(c,['الصفة','صفة'])||'—'}</td>`:''} ${printOptions.showDecision?`<td class="decision">${getFieldValue(c,['القرار'])||'—'}</td>`:''} ${printOptions.showTasks?`<td>${taskHtml}</td>`:''}</tr>`;
      });
      body = `<h1>${title}</h1>${consultant}<div class="meta">تاريخ الجلسة: <strong>${selectedDateKey}</strong> &nbsp;|&nbsp; عدد الملفات: <strong>${casesToPrint.length}</strong>${calendarTaskFilter?` &nbsp;|&nbsp; المهمة: <strong>${calendarTaskFilter==='__any__'?'بها مهام':calendarTaskFilter}</strong>`:''}</div><table><thead><tr><th>م</th>${printOptions.showRoll?'<th>الرول</th>':''}<th>الدعوى</th><th>المدعي</th><th>المدعى عليه</th>${printOptions.showRole?'<th>الصفة</th>':''}${printOptions.showDecision?'<th>القرار</th>':''}${printOptions.showTasks?'<th>المهام</th>':''}</tr></thead><tbody>${rows}</tbody></table>`;
    } else {
      casesToPrint.forEach((c, i) => {
        const tasks = getCaseTasks(c);
        const taskItems = tasks.length ? tasks.map(t => `<li class="task-item">☐ ${t.title}${t.assignee?` — ${t.assignee}`:''}${t.dueDate?` (قبل ${t.dueDate})`:''}</li>`).join('') : '<li class="no-task-item">لا توجد مهام معلقة</li>';
        body += `<div class="case-page ${i>0?'page-break':''}"><div class="case-header"><div class="case-header-top"><div><div class="case-num">دعوى رقم ${getFieldValue(c,['رقم الدعوى'])} لسنة ${getFieldValue(c,['السنة'])}</div><div class="case-date">جلسة: ${selectedDateKey}</div></div><div class="case-badge">${getFieldValue(c,['الصفة','صفة'])||'—'}</div></div>${printOptions.showConsultant&&printOptions.consultantName?`<div class="case-consultant">المستشار: ${printOptions.consultantName}</div>`:''}</div><div class="case-body"><div class="info-grid"><div class="info-block"><span class="info-label">المدعي / الطاعن</span><span class="info-value">${getFieldValue(c,['المدعي','الطاعن'])||'—'}</span></div><div class="info-block"><span class="info-label">المدعى عليه</span><span class="info-value">${getFieldValue(c,['المدعى عليه','المطعون ضده','المدعى_عليه'])||'—'}</span></div>${printOptions.showDecision?`<div class="info-block"><span class="info-label">قرار الجلسة</span><span class="info-value decision-val">${getFieldValue(c,['القرار'])||'—'}</span></div>`:''}<div class="info-block"><span class="info-label">المحكمة</span><span class="info-value">${getFieldValue(c,['المحكمة','اسم المحكمة'])||'—'}</span></div></div>${printOptions.showTasks?`<div class="tasks-section"><div class="tasks-title">📋 المهام المطلوبة</div><ul class="tasks-list">${taskItems}</ul></div>`:''}</div><div class="case-footer">الملف ${i+1} من ${casesToPrint.length} — ${title}</div></div>`;
      });
    }
    const css = `@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');*{box-sizing:border-box}body{font-family:'Cairo',sans-serif;padding:20px;color:#1e293b;direction:rtl}.pb{margin-bottom:16px}.pb button{padding:8px 20px;background:#0f172a;color:white;border:none;border-radius:8px;cursor:pointer;font-family:Cairo;font-weight:bold;font-size:14px}h1{text-align:center;font-size:22px;font-weight:900;margin-bottom:4px;color:#0f172a}.consultant{text-align:center;font-size:15px;font-weight:700;color:#475569;margin-bottom:6px}.meta{text-align:center;font-size:12px;font-weight:600;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:right}th{background:#0f172a;color:#fbbf24;font-weight:900;font-size:11px}tr:nth-child(even) td{background:#f8fafc}.decision{color:#b45309;font-weight:700}.task-badge{display:inline-block;background:#dbeafe;color:#1e40af;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin:1px}.case-page{max-width:760px;margin:0 auto 40px;border:2px solid #0f172a;border-radius:12px;overflow:hidden}.page-break{page-break-before:always;margin-top:0}.case-header{background:#0f172a;color:white;padding:16px 20px}.case-header-top{display:flex;justify-content:space-between;align-items:flex-start}.case-num{font-size:18px;font-weight:900;color:#fbbf24}.case-date{font-size:12px;color:#94a3b8;margin-top:2px}.case-consultant{font-size:12px;color:#cbd5e1;margin-top:6px;border-top:1px solid #334155;padding-top:6px}.case-badge{background:#fbbf24;color:#0f172a;font-size:12px;font-weight:900;padding:4px 12px;border-radius:20px;white-space:nowrap}.case-body{padding:16px 20px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}.info-block{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}.info-label{display:block;font-size:10px;font-weight:900;color:#64748b;margin-bottom:4px}.info-value{display:block;font-size:13px;font-weight:700;color:#0f172a}.decision-val{color:#b45309}.tasks-section{border:2px solid #dbeafe;border-radius:10px;padding:12px 16px;background:#f0f7ff}.tasks-title{font-size:13px;font-weight:900;color:#1e40af;margin-bottom:8px}.tasks-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}.task-item{font-size:12px;font-weight:700;color:#1e293b;background:white;border:1px solid #bfdbfe;border-radius:6px;padding:6px 10px}.no-task-item{font-size:12px;color:#94a3b8;font-weight:600}.case-footer{background:#f1f5f9;border-top:1px solid #e2e8f0;padding:8px 20px;font-size:10px;color:#94a3b8;font-weight:600}@media print{body{padding:0}.pb{display:none}.case-page{border-radius:0}}`;
    pw.document.write(`<html dir="rtl" lang="ar"><head><title>${title}</title><style>${css}</style></head><body><div class="pb"><button onclick="window.print()">🖨️ طباعة</button></div>${body}</body><script>window.onload=()=>setTimeout(()=>window.print(),600);<\/script></html>`);
    pw.document.close();
  };

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════
  const hasSelectedSession = selectedDateKey && selectedDateCases.length > 0;
  const d = hasSelectedSession ? parseISO(selectedDateKey) : null;
  const dayName = d ? ARABIC_DAYS_LONG[d.getDay()] : '';
  const isPastDate = d ? (isPast(d) && !isToday(d)) : false;
  const DECISIONS = settings?.decisions || ['للحكم','للإعلان','للاطلاع','لورود التقرير','موضوع','تحضير','تصريح','استبعاد'];

  return (
    <div className="space-y-4">
      {/* ── 3-Tab bar ── */}
      <div className="flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 gap-1 no-print flex-wrap">
        <button onClick={() => setActiveTab('calendar')} className={`flex-1 min-w-[80px] py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${activeTab==='calendar' ? 'bg-navy-900 text-amber-300 shadow' : 'text-slate-500 hover:text-navy-900'}`}><CalendarDays className="w-4 h-4" /><span>التقويم</span></button>
        <button onClick={() => setActiveTab('sessions')} className={`flex-1 min-w-[80px] py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${activeTab==='sessions' ? 'bg-navy-900 text-amber-300 shadow' : 'text-slate-500 hover:text-navy-900'}`}><ClipboardList className="w-4 h-4" /><span>رول الجلسات</span></button>
        <button onClick={() => setActiveTab('judgments')} className={`flex-1 min-w-[80px] py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${activeTab==='judgments' ? 'bg-rose-600 text-white shadow' : 'text-slate-500 hover:text-rose-600'}`}><Gavel className="w-4 h-4" /><span>رول الأحكام</span></button>
      </div>

      {/* ── Calendar Tab ── */}
      {activeTab === 'calendar' && (
        <div className="space-y-3">
          {/* CalendarControls */}
          <div className="bg-white rounded-2xl p-2 sm:p-3 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {[
                { label: 'الشهر الحالي', action: () => { setCalendarView('month'); setCurrentDate(new Date()); }, active: calendarView==='month' && currentDate.getMonth()===new Date().getMonth() && currentDate.getFullYear()===new Date().getFullYear() },
                { label: 'الشهر القادم', action: () => { setCalendarView('month'); setCurrentDate(addMonths(new Date(), 1)); }, active: calendarView==='month' && currentDate.getMonth()===addMonths(new Date(),1).getMonth() && currentDate.getFullYear()===addMonths(new Date(),1).getFullYear() },
                { label: 'الشهر السابق', action: () => { setCalendarView('month'); setCurrentDate(subMonths(new Date(), 1)); }, active: calendarView==='month' && currentDate.getMonth()===subMonths(new Date(),1).getMonth() && currentDate.getFullYear()===subMonths(new Date(),1).getFullYear() },
              ].map(b => (
                <button key={b.label} onClick={b.action} className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${b.active ? 'bg-navy-900 text-amber-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{b.label}</button>
              ))}
              <div className="h-4 w-px bg-slate-200 mx-1" />
              <button onClick={() => { setCalendarView('week'); setCurrentDate(new Date()); }} className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${calendarView==='week' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>أسبوعي</button>
              <div className="h-4 w-px bg-slate-200 mx-1" />
              <button onClick={() => goToSession('next')} className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition">أقرب جلسة قادمة ←</button>
              <button onClick={() => goToSession('prev')} className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-50 text-slate-600 hover:bg-slate-200 border border-slate-200 transition">→ أقرب جلسة سابقة</button>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block mx-1" />
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 sm:mr-auto">
              <span className="text-[10px] font-bold text-slate-400">انتقال سريع:</span>
              <input type="date" onChange={e => { if (e.target.value) { setCurrentDate(new Date(e.target.value)); setSelectedDateKey(e.target.value); }}} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-navy-900 w-full sm:w-[130px]" />
            </div>
          </div>

          {/* Calendar Grid — hidden when session is selected */}
          {!hasSelectedSession ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-navy-900 text-white px-4 py-3 flex items-center justify-between">
                <button onClick={() => setCurrentDate(calendarView==='week' ? addDays(currentDate,7) : addMonths(currentDate,1))} className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition"><ChevronRight className="w-4 h-4 text-amber-300" /></button>
                <div className="text-center">
                  <h2 className="font-black text-base">{calendarView==='week' ? 'الأسبوع الحالي' : `${ARABIC_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}</h2>
                  <p className="text-[10px] text-amber-300 font-bold mt-0.5">{monthSessionKeys.length > 0 ? `${monthSessionKeys.length} يوم جلسة • ${monthSessionFiles} ملف` : 'لا توجد جلسات هذا الشهر'}</p>
                </div>
                <button onClick={() => setCurrentDate(calendarView==='week' ? subDays(currentDate,7) : subMonths(currentDate,1))} className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition"><ChevronLeft className="w-4 h-4 text-amber-300" /></button>
              </div>
              <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                {ARABIC_DAYS_LONG.map((day, i) => <div key={day} className={`text-center py-2 text-[10px] font-black ${i===0||i===6?'text-rose-600':'text-slate-500'}`}>{day.substring(0,3)}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0 border-b border-slate-100">
                {days.map(day => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayCases = allSessionsMap[dateKey] || [];
                  const hasSession = dayCases.length > 0;
                  const isSelected = selectedDateKey === dateKey;
                  const isCurrentMonthDay = day.getMonth() === currentDate.getMonth();
                  const past = isPast(day) && !isToday(day);
                  const weekend = day.getDay() === 0 || day.getDay() === 6;
                  const dayTaskCount = hasSession ? dayCases.filter(c => globalTasks.some(t => t.status==='pending' && t.linkedCases?.includes(c.id))).length : 0;
                  return (
                    <div key={dateKey} onClick={() => hasSession && setSelectedDateKey(dateKey)}
                      className={`relative h-14 border-b border-l border-slate-100 flex flex-col items-center justify-center transition-all select-none ${hasSession ? 'cursor-pointer hover:bg-amber-50 active:bg-amber-100' : 'cursor-default bg-slate-50/30'} ${isSelected ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''} ${!isCurrentMonthDay ? 'opacity-30' : ''}`}>
                      <span className={`text-xs font-black leading-none ${isToday(day) ? 'w-6 h-6 rounded-full bg-navy-900 text-amber-300 flex items-center justify-center' : ''} ${!isToday(day)&&weekend?'text-rose-500':''} ${!isToday(day)&&!weekend&&past?'text-slate-400':''} ${!isToday(day)&&!weekend&&!past?'text-slate-800':''}`}>{format(day,'d')}</span>
                      {hasSession && <span className={`absolute bottom-1 right-1/2 translate-x-1/2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center ${past ? 'bg-slate-300 text-slate-600' : 'bg-amber-400 text-navy-900'}`}>{dayCases.length}</span>}
                      {dayTaskCount > 0 && <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-indigo-500" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <button onClick={() => { setSelectedDateKey(null); setCalendarTaskFilter(''); }}
              className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-slate-300 rounded-2xl py-3 text-xs font-bold text-slate-500 hover:text-navy-900 hover:border-navy-900 hover:bg-slate-50 transition">
              <CalendarDays className="w-4 h-4" />عرض التقويم ({ARABIC_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()})
            </button>
          )}

          {/* ═══ Smart Session Panel ═══ */}
          {hasSelectedSession && (
            <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-3 duration-300">

              {/* Header */}
              <div className={`px-5 py-4 flex items-center justify-between flex-wrap gap-3 ${isPastDate ? 'bg-slate-800' : 'bg-gradient-to-l from-indigo-900 to-navy-900'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center ${isPastDate ? 'bg-slate-700 border-slate-600' : 'bg-indigo-700/50 border-indigo-500/40'} border`}>
                    <span className="text-lg font-black text-amber-300 leading-none">{format(d, 'd')}</span>
                    <span className="text-[9px] font-bold text-slate-400">{ARABIC_MONTHS[d.getMonth()].substring(0,3)}</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{dayName} — {selectedDateKey}</h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      {selectedDateCases.length} ملف قضائي
                      {casesWithTasksCount > 0 && <span className="mr-2 bg-amber-400 text-navy-900 text-[10px] font-black px-2 py-0.5 rounded-full">{casesWithTasksCount} بها مهام</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setActiveTab('sessions')} className="text-[11px] font-black bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />رول الجلسة</button>
                  <button onClick={() => setIsRolloverModalOpen(true)} className="text-[11px] font-black bg-amber-400 hover:bg-amber-300 text-navy-900 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"><CopyPlus className="w-3.5 h-3.5" />ترحيل</button>
                  <button onClick={() => setIsDocEngineOpen(true)} className="text-[11px] font-black bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />محرك الوثائق</button>
                  <button onClick={() => { setSelectedDateKey(null); setCalendarTaskFilter(''); }} className="text-slate-400 hover:text-white p-1 transition"><X className="w-5 h-5" /></button>
                </div>
              </div>

              {/* Task Filter Bar */}
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 flex items-center gap-1 ml-1 shrink-0"><ListFilter className="w-3.5 h-3.5" /> فلترة بالمهمة:</span>
                <button onClick={() => setCalendarTaskFilter('')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${!calendarTaskFilter ? 'bg-navy-900 text-amber-300 border-navy-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>الكل ({selectedDateCases.length})</button>
                {casesWithTasksCount > 0 && <button onClick={() => setCalendarTaskFilter(calendarTaskFilter==='__any__' ? '' : '__any__')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${calendarTaskFilter==='__any__' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}><Zap className="w-3 h-3 inline ml-1" />بها مهام ({casesWithTasksCount})</button>}
                {selectedDateTasks.map(taskTitle => {
                  const count = selectedDateCases.filter(c => globalTasks.some(t => { if (!t.linkedCases?.includes(c.id)||t.status!=='pending') return false; if (taskTitle==='إطلاع وتصوير (مخصص)') return t.title.startsWith('إطلاع وتصوير:'); return t.title===taskTitle; })).length;
                  return <button key={taskTitle} onClick={() => setCalendarTaskFilter(taskTitle===calendarTaskFilter ? '' : taskTitle)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${calendarTaskFilter===taskTitle ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'}`}>{taskTitle} <span className={`mr-1 text-[10px] font-black px-1.5 py-0.5 rounded-full ${calendarTaskFilter===taskTitle ? 'bg-white/20 text-white' : 'bg-indigo-200 text-indigo-800'}`}>{count}</span></button>;
                })}
              </div>

              {/* View + Print toolbar */}
              <div className="bg-white border-b border-slate-100 px-4 py-2 flex items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  <button onClick={() => setViewMode('table')} className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition ${viewMode==='table' ? 'bg-navy-900 text-amber-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>جدول</button>
                  <button onClick={() => setViewMode('list')} className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition ${viewMode==='list' ? 'bg-navy-900 text-amber-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>بطاقات</button>
                </div>
                <div className="flex items-center gap-2">
                  {filteredDateCases.length !== selectedDateCases.length && <span className="text-[10px] text-indigo-600 font-black bg-indigo-50 px-2 py-1 rounded-lg">{filteredDateCases.length} من {selectedDateCases.length}</span>}
                  <button onClick={() => {
                    const currentCases = viewMode === 'table' ? (tableFilteredCases || filteredDateCases) : filteredDateCases;
                    const vTasks = globalTasks?.filter(t => t.type === 'viewing' && t.status !== 'completed' && t.linkedCases?.some(id => currentCases.find(c => c.id === id)));
                    if(!vTasks || vTasks.length === 0) { toast('لا توجد مهام إطلاع معلقة للرول الحالي', 'error'); return; }
                    printViewingTasksList(vTasks, cases, settings);
                  }} className="flex items-center gap-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-xl text-[11px] font-black transition shadow-sm"><Camera className="w-3.5 h-3.5" /> طباعة الإطلاع</button>
                  <button onClick={() => { setPrintOptions(p => ({...p, title: `كشف جلسة ${selectedDateKey}`})); setIsPrintModalOpen(true); }} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-black transition shadow-sm"><Printer className="w-3.5 h-3.5" />طباعة الكشف</button>
                </div>
              </div>

              {/* Cases List — NO max-height, full display */}
              <div className="bg-white">
                {filteredDateCases.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-bold text-sm"><CalendarX2 className="w-8 h-8 mx-auto mb-2 opacity-40" />لا توجد ملفات مطابقة</div>
                ) : viewMode === 'table' ? (
                  <SessionTable dayCases={filteredDateCases} date={selectedDateKey} onFilteredCasesChange={setTableFilteredCases} />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredDateCases.map((cObj, idx) => (
                      <CaseCard
                        key={cObj.id}
                        caseObj={cObj} idx={idx}
                        globalTasks={globalTasks} getFieldValue={getFieldValue}
                        settings={settings}
                        editingCell={editingCell} editingValue={editingValue}
                        setEditingValue={setEditingValue}
                        startEdit={startEdit} commitEdit={commitEdit} cancelEdit={cancelEdit}
                        navigate={navigate} openFieldManager={(key, title) => setManagingField({ key, title })}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && <SessionsRollTab date={selectedDateKey} onDateChange={(d) => { setSelectedDateKey(d); setCurrentDate(parseISO(d)); }} allCasesMap={allSessionsMap} />}
      {activeTab === 'judgments' && <JudgmentsRollTab date={selectedDateKey} onDateChange={(d) => { setSelectedDateKey(d); setCurrentDate(parseISO(d)); }} allCasesMap={allSessionsMap} />}

      {/* Modals */}
      <ExportPDFModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} data={selectedDateKey ? (allSessionsMap[selectedDateKey]||[]) : []} defaultTitle={selectedDateKey ? `رول جلسات ${selectedDateKey}` : 'تقرير الجلسات'} />
      <BulkSessionRolloverModal isOpen={isRolloverModalOpen} onClose={() => setIsRolloverModalOpen(false)} initialDateKey={selectedDateKey} />
      {isDocEngineOpen && <GlobalTemplatePrintModal cases={filteredDateCases} sessionDate={selectedDateKey} onClose={() => setIsDocEngineOpen(false)} />}
      <FieldOptionsManager isOpen={!!managingField} onClose={() => setManagingField(null)} fieldKey={managingField?.key} title={managingField?.title} />

      {/* Print Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="bg-navy-900 px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-black text-white flex items-center gap-2"><Printer className="w-5 h-5 text-amber-300" />خيارات الطباعة — {selectedDateKey}</h2>
              <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div><label className="text-xs font-black text-slate-700 block mb-1">عنوان الكشف</label>
                <input type="text" value={printOptions.title} onChange={e => setPrintOptions(p => ({...p, title: e.target.value}))} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-navy-900 outline-none focus:ring-2 focus:ring-navy-900" /></div>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"><input type="checkbox" checked={printOptions.showConsultant} onChange={e => setPrintOptions(p=>({...p,showConsultant:e.target.checked}))} className="w-4 h-4 rounded" /><span className="text-xs font-black text-slate-700">إظهار اسم المستشار</span></label>
              {printOptions.showConsultant && <input type="text" value={printOptions.consultantName} onChange={e => setPrintOptions(p=>({...p,consultantName:e.target.value}))} placeholder="اسم المستشار..." className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold outline-none" />}
              <div className="grid grid-cols-2 gap-2.5">
                {[{key:'showRole',label:'الصفة'},{key:'showDecision',label:'القرار'},{key:'showTasks',label:'المهام المعلقة'},{key:'showRoll',label:'رقم الرول'}].map(f => (
                  <label key={f.key} className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition"><input type="checkbox" checked={printOptions[f.key]} onChange={e => setPrintOptions(p=>({...p,[f.key]:e.target.checked}))} className="w-4 h-4 rounded" /><span className="text-xs font-bold text-slate-700">إظهار {f.label}</span></label>
                ))}
              </div>
              <div>
                <p className="text-xs font-black text-slate-700 mb-2">نوع المستند</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button onClick={() => setPrintDocType('roll')} className={`p-3.5 rounded-2xl border-2 text-right transition ${printDocType==='roll' ? 'border-navy-900 bg-navy-50' : 'border-slate-200 hover:border-slate-300'}`}><ClipboardList className={`w-5 h-5 mb-1.5 ${printDocType==='roll'?'text-navy-900':'text-slate-400'}`} /><p className={`text-xs font-black ${printDocType==='roll'?'text-navy-900':'text-slate-600'}`}>كشف رول</p><p className="text-[10px] text-slate-400 font-bold mt-0.5">جدول موحد</p></button>
                  <button onClick={() => setPrintDocType('perCase')} className={`p-3.5 rounded-2xl border-2 text-right transition ${printDocType==='perCase' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}><FileText className={`w-5 h-5 mb-1.5 ${printDocType==='perCase'?'text-indigo-600':'text-slate-400'}`} /><p className={`text-xs font-black ${printDocType==='perCase'?'text-indigo-700':'text-slate-600'}`}>مستند لكل ملف</p><p className="text-[10px] text-slate-400 font-bold mt-0.5">ورقة مستقلة</p></button>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-bold text-slate-600 space-y-0.5">
                <p>📄 سيتم طباعة: <strong>{filteredDateCases.length} ملف</strong></p>
                {calendarTaskFilter && <p>🔍 مفلتر بـ: <strong>{calendarTaskFilter==='__any__'?'الملفات بها مهام':calendarTaskFilter}</strong></p>}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <button onClick={handlePrint} className="w-full bg-navy-900 hover:bg-navy-800 text-amber-300 font-black py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow"><Printer className="w-4 h-4" />طباعة الكشف الآن</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
