/**
 * SessionsRollTab - رول الجلسات الكامل
 * يستعرض جلسات يوم محدد مع إمكانية التعديل السريع،
 * الترحيل، وإضافة الإجراءات والمهام جماعياً.
 *
 * ✨ v2: Click-to-edit per cell — انقر مباشرة على أي حقل لتعديله
 *       Enter يحفظ، Escape يلغي، Tab ينتقل للحقل التالي
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Edit3, Check, X, ChevronRight, ChevronLeft, Search,
  CheckSquare, Square, ClipboardList, Bell, Eye, CopyPlus,
  Printer, ExternalLink, Save, RefreshCcw, AlertCircle, Plus, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Columns, Settings2, FileText, Camera
} from 'lucide-react';
import { printViewingTasksList } from '../utils/printViewingTasks';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { getSafeDateObj } from '../utils/dateUtils';
import BulkProcedureFromRollModal from './BulkProcedureFromRollModal';
import BulkViewingTaskModal from './BulkViewingTaskModal';
import BulkSessionRolloverModal from './BulkSessionRolloverModal';
import ExportPDFModal from './ExportPDFModal';
import QuickAddCaseModal from './QuickAddCaseModal';
import GlobalRollSearchModal from './GlobalRollSearchModal';
import GlobalTemplatePrintModal from './GlobalTemplatePrintModal';

const PREDEFINED_DECISIONS = [
  'للحكم','تصريح','للإعلان','للاطلاع','للإخطار',
  'لورود التقرير','لتنفيذ قرار الإعادة','للاستعلام',
  'استبعاد','إحالة للموضوع','آخر أجل','للمستندات','للمذكرات'
];

// Editable cell fields in order (for Tab navigation)
const CELL_FIELDS = ['الرول', 'نوع الجلسة', 'القرار', 'آخر جلسة', 'مكان الملف', 'الملاحظات'];

const FILE_LOCATION_OPTIONS = ['في المكتب', 'شعبة المحكمة', 'غير موجود', 'مؤقت', 'خارج الاختصاص'];

const getFieldVal = (obj, keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
};

/** Returns Tailwind classes for session type badge */
const getSessionTypeBadge = (type) => {
  if (!type) return 'bg-slate-100 text-slate-500';
  if (type.includes('فحص')) return 'bg-blue-100 text-blue-700';
  if (type.includes('موضوع')) return 'bg-amber-100 text-amber-700';
  if (type.includes('حكم')) return 'bg-rose-100 text-rose-700';
  if (type.includes('أول')) return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
};

/** Returns row background classes based on file location */
const getRowBg = (fileLocation, isSelected) => {
  if (isSelected) return 'bg-indigo-100';
  if (fileLocation === 'غير موجود') return 'bg-rose-100 hover:bg-rose-150';
  if (fileLocation === 'مؤقت') return 'bg-amber-100 hover:bg-amber-150';
  if (fileLocation === 'خارج الاختصاص') return 'bg-indigo-100 hover:bg-indigo-150';
  return 'hover:bg-slate-100/80';
};

export default function SessionsRollTab({ date, onDateChange, allCasesMap }) {
  const { cases, saveCaseToFirebase, settings, deleteCaseFromFirebase, globalTasks, viewingTasks } = useAppContext();
  const { showPrompt, toast, showConfirm } = useUI();
  const navigate = useNavigate();

  // Day cases derived from the date
  const dayCases = useMemo(() => {
    if (!date) return [];
    return (allCasesMap[date] || []).filter(c => {
      const decision = getFieldVal(c, ['القرار']);
      return !decision.includes('للحكم');
    });
  }, [date, allCasesMap]);

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ✨ Per-cell editing: { caseId: string, field: string } | null
  const [editingCell, setEditingCell] = useState(null);
  // Pending value for the cell being edited
  const [cellValue, setCellValue] = useState('');
  // Full row cache so we can save the whole row at once when needed
  const [rowCache, setRowCache] = useState({}); // { caseId: { ...editData } }

  const [searchQ, setSearchQ] = useState('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState('الكل'); // الوضع الافتراضي: الكل
  const searchRef = useRef(null);
  const [isBulkProcedureOpen, setIsBulkProcedureOpen] = useState(false);
  const [isBulkViewingOpen, setIsBulkViewingOpen] = useState(false);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [isRolloverOpen, setIsRolloverOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [slidePanelCaseId, setSlidePanelCaseId] = useState(null); // سلايد تفاصيل الدعوى

  const [sortConfig, setSortConfig] = useState({ key: 'الرول', direction: 'asc' });
  const [visibleCols, setVisibleCols] = useState({
    roll: true, caseName: true, plaintiff: true, defendant: true,
    type: true, decision: true, nextDate: true, notes: true,
    // أعمدة اختيارية إضافية
    fileLocation: false, role: false, caseClass: false, subject: false
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleCol = (key) => setVisibleCols(p => ({ ...p, [key]: !p[key] }));

  const filteredCases = useMemo(() => {
    let result = dayCases;
    
    // Filter by session type
    if (sessionTypeFilter !== 'الكل') {
      result = result.filter(c => {
        const type = getFieldVal(c, ['نوع الجلسة']) || '';
        return type.includes(sessionTypeFilter);
      });
    }

    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      result = result.filter(c =>
        [c['رقم الدعوى'], c['السنة'], c['المدعي'], c['المدعى_عليه'], c['القرار'], c['الرول']]
          .some(v => String(v || '').toLowerCase().includes(q))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let valA = getFieldVal(a, [sortConfig.key]) || '';
      let valB = getFieldVal(b, [sortConfig.key]) || '';
      
      if (sortConfig.key === 'الرول') {
        valA = Number(valA) || 999999;
        valB = Number(valB) || 999999;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [dayCases, searchQ, sessionTypeFilter, sortConfig]);

  const toggleSelect = (id) => {
    const n = new Set(selectedIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedIds(n);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredCases.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCases.map(c => c.id)));
  };

  const decisionOptions = settings?.decisions || PREDEFINED_DECISIONS;
  const currentCourtDegree = settings?.courtDegree || 'أول درجة';
  const isSupreme = currentCourtDegree === 'ثان درجة' || currentCourtDegree === 'عليا' || currentCourtDegree === 'الإدارية العليا';
  const sessionTypes = settings?.sessionTypes || (isSupreme ? ['فحص', 'موضوع'] : ['مفوضين', 'مرافعة']);
  const typeFahs = sessionTypes[0] || 'فحص';

  // '/' keyboard shortcut → focus search
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ─── Click-to-Edit helpers ────────────────────────────────────────────────

  /** Get the current live value for a field (from rowCache or from cObj) */
  const getLiveVal = useCallback((cObj, field) => {
    const cached = rowCache[cObj.id];
    if (cached && cached[field] !== undefined) return cached[field];
    if (field === 'آخر جلسة') return getFieldVal(cObj, ['آخر جلسة', 'تاريخ الجلسة']);
    return getFieldVal(cObj, [field]);
  }, [rowCache]);

  /** Open a specific cell for editing */
  const openCell = useCallback((cObj, field) => {
    // If another cell is open for a different case, save it first silently
    if (editingCell && editingCell.caseId !== cObj.id) {
      commitCell(editingCell.caseId, editingCell.field, cellValue, true);
    }
    const val = getLiveVal(cObj, field);
    setEditingCell({ caseId: cObj.id, field });
    setCellValue(field === 'آخر جلسة' ? (val || '') : (val || ''));
  }, [editingCell, cellValue, getLiveVal]);

  /** Commit a cell's value to rowCache (no Firebase call yet) */
  const commitCell = useCallback((caseId, field, value, silent = false) => {
    setRowCache(prev => ({
      ...prev,
      [caseId]: { ...(prev[caseId] || {}), [field]: value }
    }));
    setEditingCell(null);
    setCellValue('');
  }, []);

  /** Save entire row to Firebase */
  const saveRow = useCallback(async (cObj) => {
    const caseId = cObj.id;
    const pending = { ...(rowCache[caseId] || {}) };
    
    // Include current open cell value too
    if (editingCell && editingCell.caseId === caseId) {
      pending[editingCell.field] = cellValue;
      setEditingCell(null);
      setCellValue('');
    }

    if (Object.keys(pending).length === 0) return;

    setSavingId(caseId);
    try {
      const newData = { ...pending };
      const oldDate = getFieldVal(cObj, ['آخر جلسة', 'تاريخ الجلسة']);
      const newDate = newData['آخر جلسة'];

      // If session date changed, archive old session
      if (newDate && oldDate && newDate !== oldDate) {
        const snapshot = {
          id: Date.now().toString(),
          date: oldDate,
          decision: newData['القرار'] || getFieldVal(cObj, ['القرار']) || 'بدون قرار',
          type: newData['نوع الجلسة'] || getFieldVal(cObj, ['نوع الجلسة']) || typeFahs,
          roll: newData['الرول'] || getFieldVal(cObj, ['الرول']) || '',
          notes: newData['الملاحظات'] || '',
        };
        const existingSessions = [...(cObj.sessions || [])];
        existingSessions.push(snapshot);
        existingSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        newData.sessions = existingSessions;
        newData['الرول'] = '';
      }

      await saveCaseToFirebase(caseId, newData);
      // Clear row cache after successful save
      setRowCache(prev => { const n = { ...prev }; delete n[caseId]; return n; });
      toast('تم الحفظ ✓', 'success');
    } catch (err) {
      console.error(err);
      toast('فشل الحفظ', 'error');
    } finally {
      setSavingId(null);
    }
  }, [rowCache, editingCell, cellValue, saveCaseToFirebase, toast, typeFahs]);

  /** Handle key events in an editable cell */
  const handleCellKey = useCallback((e, cObj, field) => {
    if (e.key === 'Enter' && field !== 'الملاحظات') {
      e.preventDefault();
      // Commit current cell then save row
      commitCell(cObj.id, field, cellValue);
      // Save row immediately
      setTimeout(() => saveRow(cObj), 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
      setCellValue('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitCell(cObj.id, field, cellValue);
      // Move to next field in same row
      const idx = CELL_FIELDS.indexOf(field);
      const nextField = CELL_FIELDS[idx + (e.shiftKey ? -1 : 1)];
      if (nextField) {
        setTimeout(() => openCell(cObj, nextField), 0);
      } else {
        setTimeout(() => saveRow(cObj), 0);
      }
    }
  }, [cellValue, commitCell, saveRow, openCell]);

  /** Handle blur on a cell — auto-save to Firebase immediately */
  const handleCellBlur = useCallback((cObj, field) => {
    // Small delay to allow Tab/Enter keydown to fire first (avoid double-save)
    setTimeout(async () => {
      // If another cell is now active (Tab moved focus), skip
      if (editingCell && !(editingCell.caseId === cObj.id && editingCell.field === field)) return;

      // Build the pending data
      const pending = {
        ...(rowCache[cObj.id] || {}),
        [field]: cellValue,
      };

      setEditingCell(null);
      setCellValue('');

      if (Object.keys(pending).length === 0) return;

      // Save to Firebase automatically
      setSavingId(cObj.id);
      try {
        const newData = { ...pending };
        const oldDate = getFieldVal(cObj, ['آخر جلسة', 'تاريخ الجلسة']);
        const newDate = newData['آخر جلسة'];

        if (newDate && oldDate && newDate !== oldDate) {
          const snapshot = {
            id: Date.now().toString(),
            date: oldDate,
            decision: newData['القرار'] || getFieldVal(cObj, ['القرار']) || 'بدون قرار',
            type: newData['نوع الجلسة'] || getFieldVal(cObj, ['نوع الجلسة']) || typeFahs,
            roll: newData['الرول'] || getFieldVal(cObj, ['الرول']) || '',
            notes: newData['الملاحظات'] || '',
          };
          const existingSessions = [...(cObj.sessions || [])];
          existingSessions.push(snapshot);
          existingSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
          newData.sessions = existingSessions;
          newData['الرول'] = '';
        }

        await saveCaseToFirebase(cObj.id, newData);
        setRowCache(prev => { const n = { ...prev }; delete n[cObj.id]; return n; });
        // Silent save — no toast for single cell auto-save
      } catch (err) {
        console.error(err);
        toast('فشل الحفظ', 'error');
      } finally {
        setSavingId(null);
      }
    }, 120);
  }, [cellValue, editingCell, rowCache, saveCaseToFirebase, toast, typeFahs]);

  if (!date) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
        <p className="text-slate-400 font-bold text-sm">اختر يوماً من التقويم لعرض رول الجلسات</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center justify-between">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = getSafeDateObj(date);
              if (d) { d.setDate(d.getDate() - 1); onDateChange(d.toISOString().split('T')[0]); }
            }}
            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <div className="text-center">
            <input
              type="date"
              value={date}
              onChange={e => onDateChange(e.target.value)}
              className="text-sm font-black text-navy-900 bg-transparent border-none outline-none cursor-pointer text-center"
            />
            <p className="text-[10px] font-bold text-slate-400">{filteredCases.length} دعوى</p>
          </div>
          <button
            onClick={() => {
              const d = getSafeDateObj(date);
              if (d) { d.setDate(d.getDate() + 1); onDateChange(d.toISOString().split('T')[0]); }
            }}
            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center transition"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Session type filter — قراءة ديناميكية من بيانات اليوم */}
        {(() => {
          const uniqueTypes = ['الكل', ...Array.from(new Set(
            dayCases.map(c => getFieldVal(c, ['نوع الجلسة'])).filter(Boolean)
          ))];
          return (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
              {uniqueTypes.map(t => (
                <button
                  key={t}
                  onClick={() => setSessionTypeFilter(t)}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${
                    sessionTypeFilter === t ? 'bg-navy-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="بحث... (اضغط / للوصول السريع)"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onFocus={e => e.target.select()}
            className="bg-transparent text-xs font-bold text-navy-900 outline-none flex-1 w-full"
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} className="text-slate-300 hover:text-slate-500 transition">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-wrap relative">
          <button
            onClick={() => setShowColPicker(!showColPicker)}
            className="flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
          >
            <Columns className="w-3.5 h-3.5" /> الأعمدة
          </button>

          {showColPicker && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-20 flex flex-col gap-1">
              <p className="text-[9px] font-black text-slate-400 px-2 pb-1 border-b border-slate-100">أعمدة الجدول</p>
              {Object.entries({
                roll: 'الرول', caseName: 'الدعوى', plaintiff: 'المدعي',
                defendant: 'ضد', type: 'نوع الجلسة', decision: 'القرار',
                nextDate: 'الجلسة القادمة', notes: 'الملاحظات',
              }).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                  <input type="checkbox" checked={visibleCols[k]} onChange={() => toggleCol(k)}
                    className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs font-bold text-slate-700">{label}</span>
                </label>
              ))}
              <p className="text-[9px] font-black text-slate-400 px-2 py-1 border-t border-slate-100 mt-1">أعمدة إضافية</p>
              {Object.entries({
                fileLocation: 'مكان الملف',
                role: 'الصفة',
                caseClass: 'تصنيف الدعوى',
                subject: 'موضوع الدعوى',
              }).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-indigo-50 rounded cursor-pointer">
                  <input type="checkbox" checked={!!visibleCols[k]} onChange={() => toggleCol(k)}
                    className="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs font-bold text-indigo-700">{label}</span>
                  <span className="text-[8px] text-indigo-400 mr-auto">إضافي</span>
                </label>
              ))}
            </div>
          )}

          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center gap-1 bg-emerald-500 text-white hover:bg-emerald-600 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
          <button onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition">
            <Printer className="w-3.5 h-3.5" /> طباعة
          </button>
          <button onClick={() => {
            const vTasks = viewingTasks?.filter(t => t.status !== 'completed' && t.linkedCases?.some(id => filteredCases.find(c => c.id === id)));
            if(!vTasks || vTasks.length === 0) { toast('لا توجد مهام إطلاع معلقة للرول الحالي', 'error'); return; }
            printViewingTasksList(vTasks, cases, settings);
          }} className="flex items-center gap-1 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition">
            <Camera className="w-3.5 h-3.5" /> طباعة الإطلاع
          </button>
          {/* كشف ملفات: يفتح صفحة طباعة منظمة باسم المستشار وتاريخ الجلسة */}
          <button
            onClick={() => {
              const targetCases = selectedIds.size > 0
                ? filteredCases.filter(c => selectedIds.has(c.id))
                : filteredCases;
              const counselorName = settings?.counselorName || settings?.name || 'المستشار';
              const html = `
                <!DOCTYPE html><html dir="rtl" lang="ar">
                <head><meta charset="UTF-8"><title>كشف جلسة ${date}</title>
                <style>
                  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #1e293b; direction: rtl; }
                  h1 { font-size: 18px; font-weight: 900; margin-bottom: 4px; color: #0f172a; }
                  h2 { font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 16px; }
                  table { width: 100%; border-collapse: collapse; font-size: 12px; }
                  th { background: #0f172a; color: white; padding: 8px 10px; text-align: right; font-weight: 900; }
                  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
                  tr:nth-child(even) { background: #f8fafc; }
                  tr:hover { background: #f1f5f9; }
                  .badge { display:inline-block; padding: 2px 8px; border-radius: 99px; font-weight: 900; font-size:10px; }
                  @media print { body { margin: 10px; } }
                </style></head>
                <body>
                <h1>كشف جلسة السيد / ${counselorName}</h1>
                <h2>تاريخ الجلسة: ${date} — عدد الدعاوى: ${targetCases.length}</h2>
                <table>
                  <thead><tr>
                    <th>رقم</th><th>الرول</th><th>رقم الدعوى</th><th>المدعي</th><th>ضد</th><th>الصفة</th><th>نوع الجلسة</th><th>القرار</th><th>الجلسة القادمة</th><th>الملاحظات</th>
                  </tr></thead>
                  <tbody>
                    ${targetCases.map((c, i) => `
                      <tr>
                        <td>${i + 1}</td>
                        <td><strong>${c['الرول'] || ''}</strong></td>
                        <td dir="ltr">${c['رقم الدعوى'] || ''} / ${c['السنة'] || ''}</td>
                        <td>${c['المدعي'] || ''}</td>
                        <td>${c['المدعى_عليه'] || c['المدعى عليه'] || ''}</td>
                        <td>${c['الصفة'] || c['صفة'] || ''}</td>
                        <td>${c['نوع الجلسة'] || ''}</td>
                        <td>${c['القرار'] || ''}</td>
                        <td>${c['آخر جلسة'] || c['تاريخ الجلسة'] || ''}</td>
                        <td>${c['الملاحظات'] || ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                <script>window.onload = () => window.print();</script>
                </body></html>
              `;
              const win = window.open('', '_blank');
              win.document.write(html);
              win.document.close();
            }}
            className="flex items-center gap-1 bg-navy-900 text-amber-300 hover:bg-navy-800 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition"
            title={selectedIds.size > 0 ? `كشف المحدد (${selectedIds.size})` : 'كشف كامل للجلسة'}
          >
            <FileText className="w-3.5 h-3.5" />
            كشف ملفات{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      </div>

      {/* Bulk actions bar (shows when items selected) */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-xs font-black text-indigo-700">
            {selectedIds.size} ملف محدد
          </span>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setIsBulkProcedureOpen(true)}
              className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition"
            >
              <ClipboardList className="w-3.5 h-3.5" /> إضافة إجراء
            </button>
            <button
              onClick={() => setIsBulkViewingOpen(true)}
              className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-amber-600 transition"
            >
              <Eye className="w-3.5 h-3.5" /> مهمة إطلاع
            </button>
            <button
              onClick={() => setIsBulkProcedureOpen(true)}
              className="flex items-center gap-1 bg-rose-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-rose-600 transition"
            >
              <Bell className="w-3.5 h-3.5" /> تذكير
            </button>
            <button
              onClick={() => setIsRolloverOpen(true)}
              className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-slate-50 transition"
            >
              <CopyPlus className="w-3.5 h-3.5" /> ترحيل
            </button>
            <button
              onClick={() => setIsPrintViewOpen(true)}
              className="flex items-center gap-1 bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-indigo-600 transition"
            >
              <FileText className="w-3.5 h-3.5" /> وثائق
            </button>
            <button
              onClick={async () => {
                const confirmed = await showConfirm('تأكيد الحذف', `هل أنت متأكد من حذف ${selectedIds.size} دعوى/دعاوى؟\nتحذير: لا يمكن التراجع عن هذا!`);
                if (!confirmed) return;
                let count = 0;
                for (const id of selectedIds) {
                  const ok = await deleteCaseFromFirebase(id);
                  if (ok) count++;
                }
                toast(`تم حذف ${count} دعوى`, 'success');
                setSelectedIds(new Set());
              }}
              className="flex items-center gap-1 bg-red-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-red-800 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> حذف المحدد
            </button>
          </div>
          <button onClick={() => setSelectedIds(new Set())}
            className="mr-auto text-slate-400 hover:text-slate-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-200">
                <th className="px-3 py-2.5 w-10">
                  <button onClick={toggleAll} className="text-slate-400 hover:text-navy-900 transition">
                    {selectedIds.size === filteredCases.length && filteredCases.length > 0
                      ? <CheckSquare className="w-4 h-4 text-indigo-500" />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                {visibleCols.roll && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="الرول" label="الرول" width="w-16" />}
                {visibleCols.caseName && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="رقم الدعوى" label="الدعوى" />}
                {visibleCols.plaintiff && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="المدعي" label="المدعي" />}
                {visibleCols.defendant && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="المدعى_عليه" label="ضد" />}
                {visibleCols.role && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="الصفة" label="الصفة" width="w-20" />}
                {visibleCols.type && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="نوع الجلسة" label="نوع الجلسة" width="w-24" />}
                {visibleCols.decision && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="القرار" label="القرار" width="w-32" />}
                {visibleCols.nextDate && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="آخر جلسة" label="الجلسة القادمة" width="w-32" />}
                {visibleCols.fileLocation && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="مكان الملف" label="مكان الملف" width="w-24" />}
                {visibleCols.caseClass && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="تصنيف الدعوى" label="التصنيف" width="w-24" />}
                {visibleCols.subject && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="موضوع الدعوى" label="الموضوع" />}
                {visibleCols.notes && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="الملاحظات" label="الملاحظات" />}
                <th className="px-2 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <p className="text-sm font-bold text-slate-400">لا توجد جلسات في هذا اليوم</p>
                    {searchQ.trim() && (
                      <button
                        onClick={() => setIsGlobalSearchOpen(true)}
                        className="mt-4 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 mx-auto"
                      >
                        <Search className="w-4 h-4" /> البحث عن "{searchQ}" في كافة القضايا
                      </button>
                    )}
                  </td>
                </tr>
              ) : filteredCases.map((cObj, idx) => {
                const isSelected = selectedIds.has(cObj.id);
                const role = String(getFieldVal(cObj, ['الصفة', 'صفة']) || '');
                const isNoInterest = role === 'لا شأن';
                const fileLocation = getFieldVal(cObj, ['مكان الملف']);
                const isSaving = savingId === cObj.id;
                const hasPending = !!rowCache[cObj.id] && Object.keys(rowCache[cObj.id]).length > 0;

                const rowBg = getRowBg(fileLocation, isSelected);

                // Helper: is this cell currently being edited?
                const isCell = (field) => editingCell?.caseId === cObj.id && editingCell?.field === field;

                // Helper: get display value (from cache or live data)
                const displayVal = (field) => {
                  const cached = rowCache[cObj.id];
                  if (cached && cached[field] !== undefined) return cached[field];
                  if (field === 'آخر جلسة') return getFieldVal(cObj, ['آخر جلسة', 'تاريخ الجلسة']);
                  return getFieldVal(cObj, [field]);
                };

                return (
                  <tr
                    key={cObj.id}
                    className={`transition-colors ${rowBg} ${isNoInterest ? 'opacity-50 grayscale' : ''} ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2">
                      <button onClick={() => toggleSelect(cObj.id)} className="text-slate-400 hover:text-indigo-500 transition">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Roll number — editable */}
                    {visibleCols.roll && (
                      <td className="px-2 py-2 cursor-text w-16" onClick={() => !isCell('الرول') && openCell(cObj, 'الرول')} title="انقر للتعديل">
                        {isCell('الرول') ? (
                          <input
                            autoFocus
                            type="text"
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            onKeyDown={e => handleCellKey(e, cObj, 'الرول')}
                            onBlur={() => handleCellBlur(cObj, 'الرول')}
                            className="w-14 text-[11px] font-bold p-1 rounded border-2 border-indigo-400 text-center outline-none bg-white shadow-sm"
                          />
                        ) : (
                          <span className={`text-xs font-black ${hasPending && rowCache[cObj.id]?.['الرول'] !== undefined ? 'text-indigo-600' : 'text-slate-600'}`}>
                            {displayVal('الرول') || <span className="text-slate-300">—</span>}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Case number — opens slide panel */}
                    {visibleCols.caseName && (
                      <td className="px-2 py-2">
                        <div className="flex flex-col">
                          <button
                            onClick={() => setSlidePanelCaseId(cObj.id)}
                            className="text-xs font-black text-navy-900 hover:text-indigo-600 hover:underline transition text-right"
                            dir="rtl"
                            title="عرض تفاصيل الدعوى"
                          >
                            {cObj['رقم الدعوى']} <span className="text-slate-400 mx-0.5">/</span> {cObj['السنة']}
                          </button>
                        </div>
                      </td>
                    )}

                    {/* Plaintiff */}
                    {visibleCols.plaintiff && (
                      <td className="px-2 py-2">
                        <span className="text-[11px] font-bold text-slate-700 line-clamp-2" title={cObj['المدعي']}>{cObj['المدعي'] || '-'}</span>
                      </td>
                    )}

                    {/* Defendant */}
                    {visibleCols.defendant && (
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-700 line-clamp-2" title={cObj['المدعى_عليه']}>{cObj['المدعى_عليه'] || '-'}</span>
                          {role && !visibleCols.role && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isNoInterest ? 'bg-slate-100 text-slate-500' : 'bg-rose-100 text-rose-700'}`}>{role}</span>}
                        </div>
                      </td>
                    )}

                    {/* Role / الصفة — optional extra column */}
                    {visibleCols.role && (
                      <td className="px-2 py-2 w-20">
                        {role ? (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            role.includes('طاعن') ? 'bg-rose-100 text-rose-700' :
                            role.includes('مطعون') ? 'bg-emerald-100 text-emerald-700' :
                            role === 'لا شأن' ? 'bg-slate-100 text-slate-400' :
                            'bg-indigo-100 text-indigo-700'
                          }`}>{role}</span>
                        ) : <span className="text-slate-300 text-[9px]">-</span>}
                      </td>
                    )}

                    {/* Session type — editable, colored badge */}
                    {visibleCols.type && (
                      <td className="px-2 py-2 cursor-text w-24" onClick={() => !isCell('نوع الجلسة') && openCell(cObj, 'نوع الجلسة')} title="انقر للتعديل">
                        {isCell('نوع الجلسة') ? (
                          <select
                            autoFocus
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            onKeyDown={e => handleCellKey(e, cObj, 'نوع الجلسة')}
                            onBlur={() => handleCellBlur(cObj, 'نوع الجلسة')}
                            className="text-[10px] font-bold p-1 rounded border-2 border-indigo-400 w-full outline-none bg-white shadow-sm"
                          >
                            {sessionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${getSessionTypeBadge(displayVal('نوع الجلسة'))}`}>
                            {displayVal('نوع الجلسة') || <span className="text-slate-300 font-normal text-[9px]">انقر</span>}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Decision — editable */}
                    {visibleCols.decision && (
                      <td className="px-2 py-2 cursor-text w-32" onClick={() => !isCell('القرار') && openCell(cObj, 'القرار')} title="انقر للتعديل">
                        {isCell('القرار') ? (
                          <div>
                            <input
                              autoFocus
                              list={`dec-${cObj.id}`}
                              value={cellValue}
                              onChange={e => setCellValue(e.target.value)}
                              onKeyDown={e => handleCellKey(e, cObj, 'القرار')}
                              onBlur={() => handleCellBlur(cObj, 'القرار')}
                              className="w-full text-[10px] font-bold p-1 rounded border-2 border-amber-400 outline-none bg-white shadow-sm"
                              placeholder="القرار..."
                            />
                            <datalist id={`dec-${cObj.id}`}>
                              {decisionOptions.map(d => <option key={d} value={d} />)}
                            </datalist>
                          </div>
                        ) : (
                          <span className={`text-[11px] font-bold ${displayVal('القرار') ? 'text-amber-700' : 'text-slate-300 text-[9px] font-normal'}`}>
                            {displayVal('القرار') || 'انقر'}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Next session date — editable */}
                    {visibleCols.nextDate && (
                      <td className="px-2 py-2 cursor-text w-32" onClick={() => !isCell('آخر جلسة') && openCell(cObj, 'آخر جلسة')} title="انقر للتعديل">
                        {isCell('آخر جلسة') ? (
                          <input
                            autoFocus
                            type="date"
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            onKeyDown={e => handleCellKey(e, cObj, 'آخر جلسة')}
                            onBlur={() => handleCellBlur(cObj, 'آخر جلسة')}
                            className="text-[10px] font-bold p-1 rounded border-2 border-indigo-400 w-full outline-none bg-white shadow-sm"
                          />
                        ) : (
                          <span className={`text-[11px] font-bold ${displayVal('آخر جلسة') ? 'text-slate-600' : 'text-slate-300 text-[9px] font-normal'}`}>
                            {displayVal('آخر جلسة') || 'انقر'}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Notes — editable */}
                    {visibleCols.notes && (
                      <td className="px-2 py-2 cursor-text" onClick={() => !isCell('الملاحظات') && openCell(cObj, 'الملاحظات')} title="انقر للتعديل">
                        {isCell('الملاحظات') ? (
                          <input
                            autoFocus
                            type="text"
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); commitCell(cObj.id, 'الملاحظات', cellValue); setTimeout(() => saveRow(cObj), 0); }
                              else if (e.key === 'Escape') { setEditingCell(null); setCellValue(''); }
                              else if (e.key === 'Tab') { e.preventDefault(); commitCell(cObj.id, 'الملاحظات', cellValue); setTimeout(() => saveRow(cObj), 0); }
                            }}
                            onBlur={() => handleCellBlur(cObj, 'الملاحظات')}
                            className="w-full text-[10px] font-bold p-1 rounded border-2 border-indigo-400 outline-none bg-white shadow-sm"
                            placeholder="ملاحظات..."
                          />
                        ) : (
                          <span className="text-[10px] text-slate-500 line-clamp-1">
                            {displayVal('الملاحظات') || ''}
                          </span>
                        )}
                      </td>
                    )}

                    {/* مكان الملف — extra optional col, editable */}
                    {visibleCols.fileLocation && (
                      <td className="px-2 py-2 cursor-text w-28" onClick={() => !isCell('مكان الملف') && openCell(cObj, 'مكان الملف')} title="انقر للتعديل">
                        {isCell('مكان الملف') ? (
                          <select
                            autoFocus
                            value={cellValue}
                            onChange={e => setCellValue(e.target.value)}
                            onKeyDown={e => handleCellKey(e, cObj, 'مكان الملف')}
                            onBlur={() => handleCellBlur(cObj, 'مكان الملف')}
                            className="text-[10px] font-bold p-1 rounded border-2 border-indigo-400 w-full outline-none bg-white shadow-sm"
                          >
                            <option value="">— اختر —</option>
                            {(settings?.fileLocationOptions || FILE_LOCATION_OPTIONS).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer ${
                            fileLocation === 'غير موجود' ? 'bg-rose-100 text-rose-700' :
                            fileLocation === 'مؤقت' ? 'bg-amber-100 text-amber-700' :
                            fileLocation === 'خارج الاختصاص' ? 'bg-indigo-100 text-indigo-700' :
                            fileLocation ? 'bg-emerald-100 text-emerald-700' : 'text-slate-300 font-normal'
                          }`}>{fileLocation || 'انقر'}</span>
                        )}
                      </td>
                    )}

                    {/* تصنيف الدعوى — extra optional col */}
                    {visibleCols.caseClass && (
                      <td className="px-2 py-2 w-24">
                        <span className="text-[10px] font-bold text-slate-600">{cObj['تصنيف الدعوى'] || '-'}</span>
                      </td>
                    )}

                    {/* موضوع الدعوى — extra optional col */}
                    {visibleCols.subject && (
                      <td className="px-2 py-2">
                        <span className="text-[10px] text-slate-500 line-clamp-2">{cObj['موضوع الدعوى'] || '-'}</span>
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        {hasPending ? (
                          <>
                            <button
                              onClick={() => saveRow(cObj)}
                              disabled={isSaving}
                              className="w-7 h-7 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center justify-center transition disabled:opacity-50"
                              title="حفظ"
                            >
                              {isSaving
                                ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => {
                                setRowCache(prev => { const n = { ...prev }; delete n[cObj.id]; return n; });
                                if (editingCell?.caseId === cObj.id) { setEditingCell(null); setCellValue(''); }
                              }}
                              className="w-7 h-7 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg flex items-center justify-center transition"
                              title="إلغاء"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Copy from previous row */}
                            {idx > 0 && (
                              <button
                                onClick={() => {
                                  const prev = filteredCases[idx - 1];
                                  const copied = {
                                    'نوع الجلسة': getFieldVal(prev, ['نوع الجلسة']) || typeFahs,
                                    'آخر جلسة': getFieldVal(prev, ['آخر جلسة', 'تاريخ الجلسة']) || '',
                                    'القرار': getFieldVal(prev, ['القرار']) || '',
                                  };
                                  setRowCache(p => ({ ...p, [cObj.id]: { ...(p[cObj.id] || {}), ...copied } }));
                                }}
                                className="w-7 h-7 bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-600 rounded-lg flex items-center justify-center transition"
                                title="نسخ من السابق"
                              >
                                <RefreshCcw className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <BulkProcedureFromRollModal
        isOpen={isBulkProcedureOpen}
        onClose={() => setIsBulkProcedureOpen(false)}
        selectedCaseIds={selectedIds}
        cases={cases}
        sessionDate={date}
      />

      <BulkViewingTaskModal
        isOpen={isBulkViewingOpen}
        onClose={() => setIsBulkViewingOpen(false)}
        selectedCaseIds={selectedIds}
        cases={cases}
        sessionDate={date}
      />

      <BulkSessionRolloverModal
        isOpen={isRolloverOpen}
        onClose={() => setIsRolloverOpen(false)}
        initialDateKey={date}
        initialSelectedIds={Array.from(selectedIds)}
      />
      <ExportPDFModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        data={selectedIds.size > 0 ? filteredCases.filter(c => selectedIds.has(c.id)) : filteredCases}
        defaultTitle={`رول جلسات ${date}`}
      />
      <QuickAddCaseModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        prefillDate={date}
      />
      <GlobalRollSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        initialQuery={searchQ}
        sessionDate={date}
      />
      {isPrintViewOpen && (
        <GlobalTemplatePrintModal
          cases={filteredCases.filter(c => selectedIds.has(c.id))}
          sessionDate={date}
          onClose={() => setIsPrintViewOpen(false)}
        />
      )}

      {/* ── Slide Panel: تفاصيل الدعوى ── */}
      {slidePanelCaseId && (
        <div className="fixed inset-0 z-50 flex" dir="rtl">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSlidePanelCaseId(null)}
          />
          {/* Panel */}
          <div className="absolute top-0 left-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-left-4 duration-300">
            {/* Panel header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setSlidePanelCaseId(null)}
                className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
              <span className="text-sm font-black text-slate-700">تفاصيل الدعوى</span>
              <a
                href={`/case/${slidePanelCaseId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-auto text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> فتح في صفحة جديدة
              </a>
            </div>
            {/* Embedded case via iframe */}
            <iframe
              key={slidePanelCaseId}
              src={`/case/${slidePanelCaseId}`}
              className="flex-1 w-full border-none"
              title="تفاصيل الدعوى"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({ sortConfig, onSort, sortKey, label, width = '' }) {
  const isActive = sortConfig.key === sortKey;
  return (
    <th className={`px-2 py-2.5 ${width}`}>
      <button 
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 group"
      >
        <span className={`text-[11px] font-black transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'}`}>
          {label}
        </span>
        {isActive ? (
          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400 transition" />
        )}
      </button>
    </th>
  );
}
