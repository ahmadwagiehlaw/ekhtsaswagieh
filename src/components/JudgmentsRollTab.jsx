import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit3, Check, X, ChevronRight, ChevronLeft, AlertCircle,
  CheckSquare, Square, Camera, ExternalLink, Printer, Search, Image,
  ClipboardList, Bell, Eye, CopyPlus, Scale, Plus, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, Columns
} from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { getSafeDateObj } from '../utils/dateUtils';
import { uploadToR2 } from '../lib/r2';
import ExportPDFModal from './ExportPDFModal';
import BulkProcedureFromRollModal from './BulkProcedureFromRollModal';
import BulkSessionRolloverModal from './BulkSessionRolloverModal';
import BulkJudgmentRegistrationModal from './BulkJudgmentRegistrationModal';
import QuickAddCaseModal from './QuickAddCaseModal';
import GlobalRollSearchModal from './GlobalRollSearchModal';

const getFieldVal = (obj, keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
};

// Clipboard image paste hook
function usePasteImage(onImage) {
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) onImage(file);
        break;
      }
    }
  }, [onImage]);
  return handlePaste;
}

// Judgment image paste zone component
function ImagePasteZone({ caseId, sessionDate, caseData, onImageSaved }) {
  const { saveCaseToFirebase } = useAppContext();
  const { toast } = useUI();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const zoneRef = useRef(null);

  // Find existing verdict image for this session
  useEffect(() => {
    const docs = caseData?.documents || [];
    const existing = docs.find(d => d.type === 'منطوق حكم' && d.sessionDate === sessionDate);
    if (existing) setPreviewUrl(existing.url);
  }, [caseData, sessionDate]);

  const handleImage = useCallback(async (file) => {
    if (!file) return;
    setIsUploading(true);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      // let uploadToR2 handle the file name automatically
      const url = await uploadToR2(file);
      if (!url) throw new Error('Upload failed');

      // Save as document linked to this session
      const docs = Array.isArray(caseData?.documents)
        ? [...caseData.documents]
        : Object.values(caseData?.documents || {});

      const newDoc = {
        id: Date.now().toString(),
        title: `صورة منطوق حكم - ${sessionDate}`,
        url,
        type: 'منطوق حكم',
        fileType: 'image',
        date: sessionDate,
        sessionDate,
        createdAt: new Date().toISOString(),
      };

      // Remove old verdict image for same session if any
      const updatedDocs = docs.filter(d => !(d.type === 'منطوق حكم' && d.sessionDate === sessionDate));
      updatedDocs.push(newDoc);

      await saveCaseToFirebase(caseId, { documents: updatedDocs });
      setPreviewUrl(url);
      toast('تم رفع صورة المنطوق وحفظها في الملف!', 'success');
      onImageSaved && onImageSaved(url);
    } catch (err) {
      console.error(err);
      toast('فشل رفع الصورة.', 'error');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  }, [caseId, sessionDate, caseData, saveCaseToFirebase, toast, onImageSaved]);

  const handlePaste = usePasteImage(handleImage);
  const fileInputRef = useRef(null);

  return (
    <div
      ref={zoneRef}
      onPaste={handlePaste}
      tabIndex={0}
      className={`relative min-h-[56px] rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer outline-none transition
        ${isUploading ? 'border-amber-400 bg-amber-50' : previewUrl ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50 focus:border-indigo-400'}
      `}
      onClick={() => fileInputRef.current?.click()}
      title="اضغط هنا ثم Ctrl+V للصق صورة المنطوق، أو انقر لاختيار ملف"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files[0] && handleImage(e.target.files[0])}
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-1 p-2">
          <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[9px] font-bold text-amber-600">جاري الرفع...</span>
        </div>
      ) : previewUrl ? (
        <div className="relative w-full">
          <img src={previewUrl} alt="منطوق الحكم" className="max-h-16 w-full object-contain rounded-lg" />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition rounded-lg flex items-center justify-center opacity-0 hover:opacity-100">
            <span className="text-[9px] font-black text-white bg-black/50 px-2 py-1 rounded">استبدال</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1 p-2 pointer-events-none">
          <Camera className="w-4 h-4 text-slate-400" />
          <span className="text-[9px] font-bold text-slate-400 text-center">Ctrl+V</span>
        </div>
      )}
    </div>
  );
}

export default function JudgmentsRollTab({ date, onDateChange, allCasesMap }) {
  const { cases, saveCaseToFirebase, settings, deleteCaseFromFirebase } = useAppContext();
  const { showPrompt, toast } = useUI();
  const navigate = useNavigate();

  // Judgment cases for this date
  const judgmentCases = useMemo(() => {
    if (!date) return [];
    const all = allCasesMap[date] || [];
    return all.filter(c => {
      // Always include if this session already has a judgment
      const session = c.sessions?.find(s => s.date === date);
      if (session && session.hasJudgment) return true;

      const decision = getFieldVal(c, ['القرار']);
      return decision.includes('للحكم') || decision.includes('رفض') || decision.includes('حكم');
    });
  }, [date, allCasesMap]);

  const judgmentCategories = settings?.judgmentCategories || ['نهائي', 'حكم أول درجة', 'شق عاجل', 'فحص'];
  const judgmentClassifications = settings?.judgmentClassifications || ['صالح', 'ضد', 'حكم منه للخصومة', 'غير منه للخصومة', 'تمهيدي'];
  const roles = settings?.roles || ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص'];

  const [searchQ, setSearchQ] = useState('');
  const [sessionTypeFilter, setSessionTypeFilter] = useState('الكل');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkProcedureOpen, setIsBulkProcedureOpen] = useState(false);
  const [isRolloverOpen, setIsRolloverOpen] = useState(false);
  const [isBulkJudgmentOpen, setIsBulkJudgmentOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: 'الرول', direction: 'asc' });
  const [visibleCols, setVisibleCols] = useState({
    roll: true, caseName: true, plaintiff: true, defendant: true,
    sessionType: true, judgmentCategory: true, judgmentType: true, verdict: true, image: true
  });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleCol = (key) => setVisibleCols(p => ({ ...p, [key]: !p[key] }));

  const toggleSelect = (id) => {
    const n = new Set(selectedIds);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelectedIds(n);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredCases.length && filteredCases.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCases.map(c => c.id)));
  };

  const filteredCases = useMemo(() => {
    let result = judgmentCases;
    
    // Filter by session type
    if (sessionTypeFilter !== 'الكل') {
      result = result.filter(c => {
         const session = c.sessions?.find(s => s.date === date);
         const sType = session?.type || getFieldVal(c, ['نوع الجلسة']) || '';
         return sType.includes(sessionTypeFilter);
      });
    }

    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      result = result.filter(c =>
        [c['رقم الدعوى'], c['السنة'], c['المدعي'], c['المدعى_عليه'], c['الصفة']]
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
  }, [judgmentCases, searchQ, sessionTypeFilter, date, sortConfig]);

  const startEdit = (cObj) => {
    const session = cObj.sessions?.find(s => s.date === date);
    const j = session?.judgment || {};
    setEditingId(cObj.id);
    setEditData({
      _category: j.category || j._category || '',
      _result: j.result || j._result || session?.judgmentClassification || '',
      _type: j.type || j._type || session?.shortJudgment || '',
      _verdict: j.fullVerdict || j._verdict || session?.verdict || '',
      _isFinal: j.isFinal !== undefined ? j.isFinal : (j._isFinal || false),
      _role: getFieldVal(cObj, ['الصفة', 'صفة']) || '',
      _rollNumber: session?.rollNumber || j.rollNumber || '',
    });
  };

  // Apply auto-fill rules from settings
  const applyDefaultRules = useCallback((field, value, currentData) => {
    if (!settings?.judgmentDefaults?.length) return currentData;
    const newData = { ...currentData };
    for (const rule of settings.judgmentDefaults) {
      if (
        (rule.triggerField === 'category' && field === '_category' && value === rule.triggerValue) ||
        (rule.triggerField === 'classification' && field === '_result' && value === rule.triggerValue)
      ) {
        if (rule.setClassification && !newData._result) newData._result = rule.setClassification;
        if (rule.setType && !newData._type) newData._type = rule.setType;
        if (rule.setText && !newData._verdict) newData._verdict = rule.setText;
        break;
      }
    }
    return newData;
  }, [settings?.judgmentDefaults]);

  const saveJudgment = async (cObj) => {
    let role = editData._role.trim();

    // Prompt for role if missing
    if (!role) {
      const r = await showPrompt(
        'تحديد الصفة ضروري',
        'يرجى تحديد صفتنا في هذه الدعوى (مثال: طاعن، مطعون ضدنا):'
      );
      if (r?.trim()) {
        role = r.trim();
      } else {
        toast('تنبيه: لم يتم تحديد الصفة! الإحصائيات قد تتأثر.', 'error');
      }
    }

    setSavingId(cObj.id);
    try {
      const newJudgmentObj = {
        category: editData._category,
        type: editData._type,
        result: editData._result,
        fullVerdict: editData._verdict,
        isFinal: editData._isFinal,
        rollNumber: editData._rollNumber,
        recordedAt: new Date().toISOString().split('T')[0],
      };

      const existingSessions = [...(cObj.sessions || [])];
      const sIdx = existingSessions.findIndex(s => s.date === date);
      if (sIdx >= 0) {
        existingSessions[sIdx] = {
          ...existingSessions[sIdx],
          judgment: newJudgmentObj,
          shortJudgment: editData._type,
          judgmentClassification: editData._result,
          verdict: editData._verdict,
          rollNumber: editData._rollNumber,
          hasJudgment: true,
        };
      } else {
        existingSessions.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          date,
          judgment: newJudgmentObj,
          shortJudgment: editData._type,
          judgmentClassification: editData._result,
          verdict: editData._verdict,
          rollNumber: editData._rollNumber,
          hasJudgment: true,
        });
        existingSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      const payload = { sessions: existingSessions };
      if (role && role !== getFieldVal(cObj, ['الصفة', 'صفة'])) payload['الصفة'] = role;

      await saveCaseToFirebase(cObj.id, payload);
      toast('تم حفظ الحكم بنجاح ✅', 'success');
      setEditingId(null);
      setEditData({});
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء الحفظ.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (!date) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
        <p className="text-slate-400 font-bold text-sm">اختر يوماً من التقويم لعرض رول الأحكام</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center justify-between">
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
            <p className="text-[10px] font-bold text-rose-500">⚖️ {filteredCases.length} حكم</p>
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

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['الكل', 'موضوع', 'فحص'].map(t => (
              <button
                key={t}
                onClick={() => setSessionTypeFilter(t)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${
                  sessionTypeFilter === t
                    ? 'bg-white text-navy-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'الكل' ? 'كل الجلسات' : t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input type="text" placeholder="بحث في رول الأحكام..." value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="bg-transparent text-xs font-bold text-navy-900 outline-none flex-1 w-full" />
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap relative">
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
                defendant: 'ضد', sessionType: 'نوع الجلسة', judgmentCategory: 'فئة الحكم',
                judgmentType: 'نوع الحكم', verdict: 'المنطوق', image: 'صورة'
              }).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols[k]}
                    onChange={() => toggleCol(k)}
                    className="rounded text-rose-600 focus:ring-rose-500"
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
          <button onClick={() => window.open(`/day-roll/${date}/judgments`, '_blank')}
            className="flex items-center gap-1 bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition">
            <ExternalLink className="w-3.5 h-3.5" /> شاشة كاملة
          </button>
        </div>
      </div>

      {/* Bulk actions bar (shows when items selected) */}
      {selectedIds.size > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex flex-wrap gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-xs font-black text-rose-700">
            {selectedIds.size} ملف محدد
          </span>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setIsBulkJudgmentOpen(true)}
              className="flex items-center gap-1 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:bg-teal-700 transition"
            >
              <Scale className="w-3.5 h-3.5" /> تسجيل أحكام
            </button>
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
              onClick={async () => {
                if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} دعوى/دعاوى؟ لا يمكن التراجع عن هذا!`)) return;
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

      {/* Info tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center gap-2">
        <Camera className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-[10px] font-bold text-amber-700">
          في عمود "صورة المنطوق"، انقر على الخانة ثم اضغط <strong>Ctrl+V</strong> للصق صورة من الحافظة مباشرة، وستُرفع تلقائياً في ملف الدعوى!
        </p>
      </div>

      {filteredCases.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400 font-bold text-sm">لا توجد قضايا للحكم في هذا اليوم</p>
          <p className="text-slate-300 font-bold text-xs mt-1">القضايا التي قرارها "للحكم" ستظهر هنا</p>
          {searchQ.trim() && (
            <button
              onClick={() => setIsGlobalSearchOpen(true)}
              className="mt-4 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 mx-auto"
            >
              <Search className="w-4 h-4" /> البحث عن "{searchQ}" في كافة القضايا
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[900px]" dir="rtl">
              <thead>
                <tr className="bg-rose-50 border-b border-rose-100">
                  <th className="px-3 py-2.5 w-10">
                    <button onClick={toggleAll} className="text-rose-400 hover:text-rose-600 transition">
                      {selectedIds.size === filteredCases.length && filteredCases.length > 0
                        ? <CheckSquare className="w-4 h-4 text-rose-600" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  {visibleCols.caseName && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="رقم الدعوى" label="الدعوى" />}
                  {visibleCols.plaintiff && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="المدعي" label="المدعي" />}
                  {visibleCols.defendant && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="المدعى_عليه" label="ضد" />}
                  {visibleCols.sessionType && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="الصفة" label="الصفة" width="w-24" />}
                  {visibleCols.roll && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="الرول" label="الرول" width="w-16" />}
                  {visibleCols.judgmentCategory && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="_category" label="فئة الحكم" width="w-24" />}
                  {visibleCols.judgmentType && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="_type" label="نوع الحكم" width="w-24" />}
                  {visibleCols.verdict && <SortHeader sortConfig={sortConfig} onSort={handleSort} sortKey="_verdict" label="المنطوق" />}
                  {visibleCols.image && <th className="px-2 py-2.5 text-[10px] font-black text-rose-600 w-20 text-center">📸 صورة</th>}
                  <th className="px-2 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((cObj, idx) => {
                  const isEditing = editingId === cObj.id;
                  const isSelected = selectedIds.has(cObj.id);
                  const isSaving_ = savingId === cObj.id;
                  const role = String(getFieldVal(cObj, ['الصفة', 'صفة']) || '');
                  const missingRole = !role.trim();
                  const isNoInterest = role === 'لا شأن';
                  const session = cObj.sessions?.find(s => s.date === date);
                  const j = session?.judgment || {};
                  const hasJudgment = session?.hasJudgment;

                  return (
                    <tr
                      key={cObj.id}
                      className={`transition-colors ${isSelected ? 'bg-rose-50/40' : (isEditing ? 'bg-rose-50/20' : 'hover:bg-slate-50/60')} ${isNoInterest ? 'opacity-40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => toggleSelect(cObj.id)} className="text-slate-400 hover:text-rose-500 transition">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-rose-500" /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>

                      {/* Case */}
                      {visibleCols.caseName && (
                        <td className="px-2 py-2">
                          <button onClick={() => navigate(`/case/${cObj.id}`)}
                            className="text-[11px] font-black text-navy-900 hover:text-amber-600 transition text-right">
                            {getFieldVal(cObj, ['رقم الدعوى'])} / {getFieldVal(cObj, ['السنة'])}
                          </button>
                          {hasJudgment && (
                            <span className="block text-[9px] font-bold text-emerald-600">✓ تم تسجيل الحكم</span>
                          )}
                        </td>
                      )}

                      {/* Plaintiff */}
                      {visibleCols.plaintiff && (
                        <td className="px-2 py-2">
                          <p className="text-[10px] font-bold text-slate-700 line-clamp-1">{getFieldVal(cObj, ['المدعي'])}</p>
                        </td>
                      )}

                      {/* Defendant */}
                      {visibleCols.defendant && (
                        <td className="px-2 py-2">
                          <p className="text-[10px] font-bold text-slate-700 line-clamp-1">{getFieldVal(cObj, ['المدعى_عليه', 'ضد', 'المطعون ضده'])}</p>
                        </td>
                      )}

                      {/* Role / الصفة */}
                      {visibleCols.sessionType && (
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <select
                                value={editData._role}
                                onChange={e => setEditData(d => ({ ...d, _role: e.target.value }))}
                                className="w-full text-[10px] font-bold p-1 rounded border border-rose-200 bg-white"
                              >
                                <option value="">--اختر--</option>
                                {roles.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {missingRole && <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" title="الصفة غير محددة!" />}
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                role.includes('طاعن') ? 'bg-rose-100 text-rose-700' :
                                role.includes('مطعون') ? 'bg-emerald-100 text-emerald-700' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {role || <span className="text-amber-500">⚠️ غير محدد</span>}
                              </span>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Roll Number */}
                      {visibleCols.roll && (
                        <td className="px-2 py-2 text-center">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData._rollNumber}
                              onChange={e => setEditData(d => ({ ...d, _rollNumber: e.target.value }))}
                              placeholder="الرول"
                              className="w-full text-center text-[10px] font-bold p-1 rounded border border-rose-200 bg-white"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-700">{session?.rollNumber || j.rollNumber || '-'}</span>
                          )}
                        </td>
                      )}

                      {/* Category */}
                      {visibleCols.judgmentCategory && (
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <select
                              value={editData._category}
                              onChange={e => setEditData(d => applyDefaultRules('_category', e.target.value, { ...d, _category: e.target.value }))}
                              className="w-full text-[10px] font-bold p-1 rounded border border-rose-200 bg-white"
                            >
                              <option value="">- اختر -</option>
                              {judgmentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-700">{j.category || '-'}</span>
                          )}
                        </td>
                      )}

                      {/* Type */}
                      {visibleCols.judgmentType && (
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <div>
                              <input
                                list={`jtype-${cObj.id}`}
                                value={editData._type}
                                onChange={e => {
                                  const v = e.target.value;
                                  const map = settings?.judgmentTextMap || {};
                                  setEditData(d => ({ ...d, _type: v, _verdict: map[v] || d._verdict }));
                                }}
                                placeholder="نوع الحكم..."
                                className="w-full text-[10px] font-bold p-1 rounded border border-rose-200"
                              />
                              <datalist id={`jtype-${cObj.id}`}>
                                {Object.keys(settings?.judgmentTextMap || {}).map(t => <option key={t} value={t} />)}
                              </datalist>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-600">{j.type || '-'}</span>
                          )}
                        </td>
                      )}

                      {/* Verdict text */}
                      {visibleCols.verdict && (
                        <td className="px-2 py-2">
                          {isEditing ? (
                            <textarea
                              value={editData._verdict}
                              onChange={e => setEditData(d => ({ ...d, _verdict: e.target.value }))}
                              placeholder="المنطوق..."
                              rows={2}
                              className="w-full text-[10px] font-bold p-1 rounded border border-rose-200 resize-none min-w-[140px]"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-500 line-clamp-2">{j.fullVerdict || session?.verdict || '-'}</span>
                          )}
                        </td>
                      )}

                      {/* Image paste zone */}
                      {visibleCols.image && (
                        <td className="px-2 py-2">
                          <ImagePasteZone
                            caseId={cObj.id}
                            sessionDate={date}
                            caseData={cObj}
                          />
                        </td>
                      )}

                      {/* Actions */}
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => saveJudgment(cObj)}
                              disabled={isSaving_}
                              className="w-full flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black py-1.5 rounded-lg transition disabled:opacity-50"
                            >
                              {isSaving_ ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
                              حفظ
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditData({}); }}
                              className="w-full flex items-center justify-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-black py-1.5 rounded-lg transition"
                            >
                              <X className="w-3 h-3" /> إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(cObj)}
                            className="w-full flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black py-1.5 rounded-lg transition border border-rose-200"
                          >
                            <Edit3 className="w-3 h-3" /> تسجيل
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <BulkJudgmentRegistrationModal
        isOpen={isBulkJudgmentOpen}
        onClose={() => setIsBulkJudgmentOpen(false)}
        sessionDate={date}
        selectedCaseIds={selectedIds}
      />
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
        data={filteredCases}
        defaultTitle={`رول أحكام ${date}`}
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
        <span className={`text-[10px] font-black transition-colors ${isActive ? 'text-rose-600' : 'text-slate-500 group-hover:text-slate-700'}`}>
          {label}
        </span>
        {isActive ? (
          sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-rose-500" /> : <ArrowDown className="w-3 h-3 text-rose-500" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400 transition" />
        )}
      </button>
    </th>
  );
}
