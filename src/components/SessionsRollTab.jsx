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
  Printer, ExternalLink, Save, RefreshCcw, AlertCircle
} from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { getSafeDateObj } from '../utils/dateUtils';
import BulkProcedureFromRollModal from './BulkProcedureFromRollModal';
import BulkSessionRolloverModal from './BulkSessionRolloverModal';
import ExportPDFModal from './ExportPDFModal';

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
  const { cases, saveCaseToFirebase, settings } = useAppContext();
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
  const [isRolloverOpen, setIsRolloverOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const filteredCases = useMemo(() => {
    if (!searchQ.trim()) return dayCases;
    const q = searchQ.toLowerCase();
    return dayCases.filter(c =>
      [c['رقم الدعوى'], c['السنة'], c['المدعي'], c['المدعى_عليه'], c['القرار'], c['الرول']]
        .some(v => String(v || '').toLowerCase().includes(q))
    );
  }, [dayCases, searchQ]);

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
      'نوع الجلسة': getFieldVal(cObj, ['نوع الجلسة']) || 'فحص',
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
        type: getFieldVal(cObj, ['نوع الجلسة']) || 'فحص',
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
        <div className="flex items-center gap-1.5 flex-wrap">
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
                <th className="px-2 py-2.5 text-[11px] font-black text-slate-500 w-12">الرول</th>
                <th className="px-2 py-2.5 text-[11px] font-black text-slate-500">الدعوى</th>
                <th className="px-2 py-2.5 text-[11px] font-black text-slate-500">المدعي</th>
                <th className="px-2 py-2.5 text-[11px] font-black text-slate-500">ضد</th>
                <th className="px-2 py-2.5 text-[11px] font-black text-slate-500 w-20">نوع الجلسة</th>
                <th className="px-2 py-2.5 text-[11px] font-black text-slate-500 w-28">القرار</th>
                <th className="px-2 py-2.5 text-[11px] font-black text-slate-500 w-28">الجلسة القادمة</th>
                <th className="px-2 py-2.5 text-[11px] font-black text-slate-500">الملاحظات</th>
                <th className="px-2 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <p className="text-sm font-bold text-slate-400">لا توجد جلسات في هذا اليوم</p>
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

                    {/* Case number */}
                    <td className="px-2 py-2">
                      <button onClick={() => navigate(`/case/${cObj.id}`)}
                        className="text-[11px] font-black text-navy-900 hover:text-amber-600 transition text-right">
                        {getFieldVal(cObj, ['رقم الدعوى'])} / {getFieldVal(cObj, ['السنة'])}
                      </button>
                      {role && !isNoInterest && (
                        <div className={`text-[9px] font-bold mt-0.5 px-1.5 py-0.5 rounded-full inline-block ${
                          role.includes('طاعن') ? 'bg-rose-100 text-rose-700' :
                          role.includes('مطعون') ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-600'}`}>
                          {role}
                        </div>
                      )}
                    </td>

                    {/* Plaintiff */}
                    <td className="px-2 py-2">
                      <span className="text-[11px] font-bold text-slate-700 line-clamp-1">
                        {getFieldVal(cObj, ['المدعي'])}
                      </span>
                    </td>

                    {/* Defendant */}
                    <td className="px-2 py-2">
                      <span className="text-[11px] font-bold text-slate-600 line-clamp-1">
                        {getFieldVal(cObj, ['المدعى_عليه', 'ضد', 'المطعون ضده'])}
                      </span>
                    </td>

                    {/* Session type */}
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

                    {/* Decision */}
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

                    {/* Next session date */}
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

                    {/* Notes */}
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
                                    'نوع الجلسة': getFieldVal(prev, ['نوع الجلسة']) || 'فحص',
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
    </div>
  );
}
