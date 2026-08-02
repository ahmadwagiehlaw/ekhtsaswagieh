/**
 * SessionsRollTab - رول الجلسات الكامل
 * يستعرض جلسات يوم محدد مع إمكانية التعديل السريع،
 * الترحيل، وإضافة الإجراءات والمهام جماعياً.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit3, Check, X, ChevronRight, ChevronLeft, Search,
  CheckSquare, Square, ClipboardList, Bell, Eye, CopyPlus,
  Printer, ExternalLink, Save, RefreshCcw, AlertCircle, Plus, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Columns, Settings2, FileText
} from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { getSafeDateObj } from '../utils/dateUtils';
import BulkProcedureFromRollModal from './BulkProcedureFromRollModal';
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

const getFieldVal = (obj, keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
};

export default function SessionsRollTab({ date, onDateChange, allCasesMap }) {
  const { cases, saveCaseToFirebase, settings, deleteCaseFromFirebase } = useAppContext();
  const { showPrompt, toast } = useUI();
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
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchQ, setSearchQ] = useState('');
  const [isBulkProcedureOpen, setIsBulkProcedureOpen] = useState(false);
  const [isHoveredSession, setIsHoveredSession] = useState(null);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);
  const [isRolloverOpen, setIsRolloverOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: 'الرول', direction: 'asc' });
  const [visibleCols, setVisibleCols] = useState({
    roll: true, caseName: true, plaintiff: true, defendant: true,
    type: true, decision: true, nextDate: true, notes: true
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
        // Numeric sort for roll number
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
  }, [dayCases, searchQ, sortConfig]);

  const toggleSelect = (id) => {
    const n = new Set(selectedIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedIds(n);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredCases.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCases.map(c => c.id)));
  };

  const startEdit = (cObj) => {
    const session = cObj.sessions?.find(s => s.date === date);
    setEditingId(cObj.id);
    setEditData({
      'الرول': getFieldVal(cObj, ['الرول']) || '',
      'نوع الجلسة': getFieldVal(cObj, ['نوع الجلسة']) || typeFahs,
      'آخر جلسة': getFieldVal(cObj, ['آخر جلسة', 'تاريخ الجلسة']) || '',
      'القرار': getFieldVal(cObj, ['القرار']) || session?.decision || '',
      'الملاحظات': getFieldVal(cObj, ['الملاحظات']) || session?.notes || '',
    });
  };

  const saveEdit = async (cObj) => {
    const newData = { ...editData };
    const oldDate = getFieldVal(cObj, ['آخر جلسة', 'تاريخ الجلسة']);
    const newDate = newData['آخر جلسة'];

    if (newDate && oldDate && newDate !== oldDate) {
      const snapshot = {
        id: Date.now().toString(),
        date: oldDate,
        decision: newData['القرار'] || getFieldVal(cObj, ['القرار']) || 'بدون قرار',
        type: getFieldVal(cObj, ['نوع الجلسة']) || typeFahs,
        roll: getFieldVal(cObj, ['الرول']) || '',
        notes: newData['الملاحظات'] || '',
      };
      // Sort existing sessions + new snapshot by date
      const existingSessions = [...(cObj.sessions || [])];
      existingSessions.push(snapshot);
      existingSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      newData.sessions = existingSessions;
      newData['الرول'] = '';
    }

    await saveCaseToFirebase(cObj.id, newData);
    setEditingId(null);
    setEditData({});
    toast('تم حفظ التعديل بنجاح', 'success');
  };

  const decisionOptions = settings?.decisions || PREDEFINED_DECISIONS;
  const sessionTypes = settings?.sessionTypes || ['فحص', 'موضوع', 'للحكم', 'أول جلسة'];
  const typeFahs = sessionTypes[0] || 'فحص';
  const typeMawdoo = sessionTypes[1] || 'موضوع';

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
            <p className="text-[10px] font-bold text-slate-400">{filteredCases.length} جلسة</p>
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

        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="بحث في الرول..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="bg-transparent text-xs font-bold text-navy-900 outline-none flex-1 w-full"
          />
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
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-20 flex flex-col gap-1">
              {Object.entries({
                roll: 'الرول', caseName: 'الدعوى', plaintiff: 'المدعي',
                defendant: 'ضد', type: 'نوع الجلسة', decision: 'القرار',
                nextDate: 'الجلسة القادمة', notes: 'الملاحظات'
              }).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols[k]}
                    onChange={() => toggleCol(k)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-700">{label}</span>
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
          <button onClick={() => window.open(`/day-roll/${date}`, '_blank')}
            className="flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition">
            <ExternalLink className="w-3.5 h-3.5" /> شاشة كاملة
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
              onClick={() => setIsBulkProcedureOpen(true)}
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
                if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} دعوى/دعاوى؟\nتحذير: لا يمكن التراجع عن هذا!`)) return;
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
              <tr className="bg-slate-50 border-b border-slate-200">
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
                {visibleCols.type && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="نوع الجلسة" label="نوع الجلسة" width="w-20" />}
                {visibleCols.decision && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="القرار" label="القرار" width="w-28" />}
                {visibleCols.nextDate && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="آخر جلسة" label="الجلسة القادمة" width="w-28" />}
                {visibleCols.notes && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="الملاحظات" label="الملاحظات" />}
                <th className="px-2 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
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
                const isEditing = editingId === cObj.id;
                const isSelected = selectedIds.has(cObj.id);
                const role = String(getFieldVal(cObj, ['الصفة', 'صفة']) || '');
                const isNoInterest = role === 'لا شأن';

                return (
                  <tr
                    key={cObj.id}
                    className={`transition-colors ${isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/60'} ${isNoInterest ? 'opacity-50' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2">
                      <button onClick={() => toggleSelect(cObj.id)} className="text-slate-400 hover:text-indigo-500 transition">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>

                    {/* Roll number */}
                    {visibleCols.roll && (
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input type="text" value={editData['الرول']} onChange={e => setEditData({...editData, 'الرول': e.target.value})}
                            className="w-14 text-[11px] font-bold p-1 rounded border border-slate-300 text-center" />
                        ) : (
                          <span className="text-xs font-black text-slate-600">
                            {getFieldVal(cObj, ['الرول']) || <span className="text-slate-300">-</span>}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Case number */}
                    {visibleCols.caseName && (
                      <td className="px-2 py-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-navy-900" dir="rtl">
                            {cObj['رقم الدعوى']} <span className="text-slate-400 mx-0.5">/</span> {cObj['السنة']}
                          </span>
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
                          {role && <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${isNoInterest ? 'bg-slate-100 text-slate-500' : 'bg-rose-100 text-rose-700'}`}>{role}</span>}
                        </div>
                      </td>
                    )}

                    {/* Session type */}
                    {visibleCols.type && (
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <select value={editData['نوع الجلسة']} onChange={e => setEditData({...editData, 'نوع الجلسة': e.target.value})}
                            className="text-[10px] font-bold p-1 rounded border border-slate-300 w-full">
                            {sessionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-600">
                            {getFieldVal(cObj, ['نوع الجلسة']) || '-'}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Decision */}
                    {visibleCols.decision && (
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <div>
                            <input
                              list={`dec-${cObj.id}`}
                              value={editData['القرار']}
                              onChange={e => setEditData({...editData, 'القرار': e.target.value})}
                              className="w-full text-[10px] font-bold p-1 rounded border border-amber-300"
                              placeholder="القرار..."
                            />
                            <datalist id={`dec-${cObj.id}`}>
                              {decisionOptions.map(d => <option key={d} value={d} />)}
                            </datalist>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-amber-700">
                            {getFieldVal(cObj, ['القرار']) || '-'}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Next session date */}
                    {visibleCols.nextDate && (
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input type="date" value={editData['آخر جلسة']}
                            onChange={e => setEditData({...editData, 'آخر جلسة': e.target.value})}
                            className="text-[10px] font-bold p-1 rounded border border-slate-300 w-full" />
                        ) : (
                          <span className="text-[11px] font-bold text-slate-600">
                            {getFieldVal(cObj, ['آخر جلسة', 'تاريخ الجلسة']) || '-'}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Notes */}
                    {visibleCols.notes && (
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <input type="text" value={editData['الملاحظات']}
                            onChange={e => setEditData({...editData, 'الملاحظات': e.target.value})}
                            className="w-full text-[10px] font-bold p-1 rounded border border-slate-300"
                            placeholder="ملاحظات..." />
                        ) : (
                          <span className="text-[10px] text-slate-500 line-clamp-1">
                            {getFieldVal(cObj, ['الملاحظات']) || ''}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(cObj)}
                              className="w-7 h-7 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center justify-center transition">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setEditingId(null); setEditData({}); }}
                              className="w-7 h-7 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg flex items-center justify-center transition">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(cObj)}
                              className="w-7 h-7 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 rounded-lg flex items-center justify-center transition">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {/* Copy from previous */}
                            {idx > 0 && (
                              <button
                                onClick={() => {
                                  startEdit(cObj);
                                  const prev = filteredCases[idx - 1];
                                  setTimeout(() => setEditData(d => ({
                                    ...d,
                                    'نوع الجلسة': getFieldVal(prev, ['نوع الجلسة']) || typeFahs,
                                    'آخر جلسة': getFieldVal(prev, ['آخر جلسة', 'تاريخ الجلسة']) || '',
                                    'القرار': getFieldVal(prev, ['القرار']) || '',
                                  })), 0);
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
      <BulkSessionRolloverModal
        isOpen={isRolloverOpen}
        onClose={() => setIsRolloverOpen(false)}
        initialDateKey={date}
        initialSelectedIds={Array.from(selectedIds)}
      />
      <ExportPDFModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        data={dayCases}
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
