import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Upload, Edit3, Gavel, Settings2, Copy, Maximize2, CheckSquare, Square, Save, CopyPlus, RefreshCcw, Search, Settings, Plus, Trash2, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { uploadToR2 } from '../lib/r2';
import QuickEditCaseModal from './QuickEditCaseModal';
import GlobalTemplatePrintModal from './GlobalTemplatePrintModal';

const ALL_COLUMNS = [
  { id: 'الرول', label: 'الرول', defaultVisible: true },
  { id: 'رقم الدعوى', label: 'الدعوى', defaultVisible: true },
  { id: 'المدعي', label: 'المدعي', defaultVisible: true },
  { id: 'ضد', label: 'ضد', defaultVisible: true },
  { id: 'نوع الجلسة', label: 'نوع الجلسة', defaultVisible: true },
  { id: 'تاريخ الجلسة', label: 'الجلسة القادمة', defaultVisible: true },
  { id: 'القرار', label: 'القرار', defaultVisible: true },
  { id: 'الحكم', label: 'الحكم', defaultVisible: false },
  { id: 'منطوق الحكم', label: 'منطوق الحكم', defaultVisible: false },
  { id: 'الملاحظات', label: 'الملاحظات', defaultVisible: true },
];

// ─── Judgment Data ───────────────────────────────────────────────

const JUDGMENT_TYPES = {
  'حكم منه للخصومة': ['اعتبار كأن لم تكن', 'سقوط الخصومة', 'انقضاء الخصومة', 'شطب'],
  'غير منه للخصومة': ['وقف جزائي', 'وقف تعليقي', 'إحالة للموضوع', 'إحالة لمحكمة أخرى'],
  'تمهيدي': ['ندب خبير','تكليف خبير','إعادة للمحكمة المختصة','إحالة للنيابة','تعجيل من الوقف'],
  'صالح': ['رفض الدعوى','عدم القبول شكلاً','عدم جواز نظر الدعوى','عدم الاختصاص','انتفاء قرار','إلغاء القرار','تعويض','رفض الطعن','قبول الطعن','عدم القبول موضوعاً','تعديل الحكم المطعون فيه','رفض (دائرة فحص)','قبول طعن (إحالة للموضوع)','وقف تنفيذي','رفض الشق العاجل', 'رفض'],
  'ضد': ['رفض الدعوى','عدم القبول شكلاً','عدم جواز نظر الدعوى','عدم الاختصاص','انتفاء قرار','إلغاء القرار','تعويض','رفض الطعن','قبول الطعن','عدم القبول موضوعاً','تعديل الحكم المطعون فيه','رفض (دائرة فحص)','قبول طعن (إحالة للموضوع)','وقف تنفيذي','رفض الشق العاجل', 'رفض'],
};

const JUDGMENT_RESULTS = [
  { value: 'صالح',  label: 'صالح',  color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'ضد',    label: 'ضد',    color: 'text-rose-700 bg-rose-50 border-rose-200' },
  { value: 'حكم منه للخصومة',   label: 'حكم منه للخصومة',   color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'غير منه للخصومة',   label: 'غير منه للخصومة',   color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { value: 'تمهيدي', label: 'تمهيدي', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
];

const getResultStyle = (result) => {
  const r = JUDGMENT_RESULTS.find(x => x.value === result);
  return r ? r.color : 'text-slate-600 bg-slate-50 border-slate-200';
};

const PREDEFINED_DECISIONS = ['للحكم', 'تصريح', 'للإعلان', 'للاطلاع', 'للإخطار', 'لورود التقرير', 'لتنفيذ قرار الإعادة', 'للاستعلام', 'استبعاد', 'إحالة للموضوع', 'رفض'];

export default function SessionTable({ dayCases, date, onDateClick }) {
  const { saveCaseToFirebase, settings, currentUser, cases } = useAppContext();
  const { showPrompt, toast } = useUI();
  const navigate = useNavigate();
  
  const typeFahs = settings?.sessionTypes?.[0] || 'فحص';
  const typeMawdoo = settings?.sessionTypes?.[1] || 'موضوع';
  const JUDGMENT_CATEGORIES = settings?.judgmentCategories || ['نهائي', 'حكم أول درجة', 'شق عاجل', 'فحص'];

  const defaultDecisions = settings?.decisions || PREDEFINED_DECISIONS;
  const [isManageDecisionsOpen, setIsManageDecisionsOpen] = useState(false);
  const [newDecisionOption, setNewDecisionOption] = useState('');
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);

  // View state
  const [filterDecision, setFilterDecision] = useState(null); // 'للحكم' or null
  const [filterType, setFilterType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('الرول');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState(
    ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultVisible }), {})
  );
  const [showColSettings, setShowColSettings] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Edit state
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [editData, setEditData] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Bulk Edit state
  const [selectedCaseIds, setSelectedCaseIds] = useState(new Set());
  const [bulkData, setBulkData] = useState({
    'تاريخ الجلسة': '',
    'القرار': '',
    'نوع الجلسة': typeFahs
  });
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Quick Edit Modal
  const [quickEditCaseId, setQuickEditCaseId] = useState(null);

  const getFieldValueLocal = (obj, keys) => {
    for (let key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return '';
  };

  const uniqueShortJudgments = useMemo(() => {
    const set = new Set();
    cases?.forEach(c => c.sessions?.forEach(s => { if (s.shortJudgment) set.add(s.shortJudgment) }));
    return [...set];
  }, [cases]);

  const uniqueClassifications = useMemo(() => {
    const set = new Set();
    cases?.forEach(c => c.sessions?.forEach(s => { if (s.judgmentClassification) set.add(s.judgmentClassification) }));
    return [...set];
  }, [cases]);

  const filteredCases = useMemo(() => {
    let result = [...dayCases];
    if (filterDecision === 'للحكم') {
      result = result.filter(c => getFieldValueLocal(c, ['القرار'])?.includes('للحكم'));
    } else {
      // If not specifically asking for 'للحكم', hide those cases so we only see active sessions
      result = result.filter(c => !getFieldValueLocal(c, ['القرار'])?.includes('للحكم'));
    }
    if (filterType) {
      result = result.filter(c => getFieldValueLocal(c, ['نوع الجلسة']) === filterType || getFieldValueLocal(c, ['نوع الدعوى']) === filterType);
    }
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => {
        return ALL_COLUMNS.some(col => {
          if (!visibleColumns[col.id]) return false;
          const val = getFieldValueLocal(c, [col.id, ...(col.id === 'ضد' ? ['المدعى_عليه', 'المطعون ضده', 'المطعون ضدنا', 'مدعى علينا'] : []), ...(col.id === 'تاريخ الجلسة' ? ['آخر جلسة'] : [])]);
          return String(val).toLowerCase().includes(q);
        });
      });
    }
    
    result.sort((a, b) => {
      let valA = getFieldValueLocal(a, [sortField]);
      let valB = getFieldValueLocal(b, [sortField]);
      if (sortField === 'رقم الدعوى' || sortField === 'الرول') {
        const numA = parseInt(valA) || 0;
        const numB = parseInt(valB) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
      valA = String(valA || '');
      valB = String(valB || '');
      return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    
    return result;
  }, [dayCases, filterDecision, filterType, sortField, sortOrder, searchQuery, visibleColumns]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleSelection = (id) => {
    const newSel = new Set(selectedCaseIds);
    if (newSel.has(id)) newSel.delete(id);
    else newSel.add(id);
    setSelectedCaseIds(newSel);
    
    // Set default session type for bulk actions to match the first selected case
    if (!newSel.has(id) && newSel.size === 0) return;
    const firstSelectedId = Array.from(newSel)[0];
    const firstCase = dayCases.find(c => c.id === firstSelectedId);
    if (firstCase) {
        setBulkData(prev => ({...prev, 'نوع الجلسة': getFieldValueLocal(firstCase, ['نوع الجلسة']) || typeFahs}));
    }
  };

  const toggleSelectAll = () => {
    if (selectedCaseIds.size === filteredCases.length) {
      setSelectedCaseIds(new Set());
    } else {
      const allIds = new Set(filteredCases.map(c => c.id));
      setSelectedCaseIds(allIds);
      if (filteredCases.length > 0) {
        setBulkData(prev => ({...prev, 'نوع الجلسة': getFieldValueLocal(filteredCases[0], ['نوع الجلسة']) || typeFahs}));
      }
    }
  };

  const handleBulkSave = async () => {
    if (selectedCaseIds.size === 0) return;
    setIsBulkSaving(true);
    try {
      const updates = [];
      for (let id of selectedCaseIds) {
        const cObj = dayCases.find(c => c.id === id);
        if (!cObj) continue;
        
        const payload = {};
        if (bulkData['تاريخ الجلسة']) payload['آخر جلسة'] = bulkData['تاريخ الجلسة'];
        if (bulkData['القرار']) payload['القرار'] = bulkData['القرار'];
        if (bulkData['نوع الجلسة']) payload['نوع الجلسة'] = bulkData['نوع الجلسة'];
        
        const oldDate = getFieldValueLocal(cObj, ['آخر جلسة', 'تاريخ الجلسة']);
        
        // Snapshot logic for Forwarding
        if (payload['آخر جلسة'] && oldDate && payload['آخر جلسة'] !== oldDate) {
          const snapshot = {
             id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
             date: oldDate,
             decision: payload['القرار'] || getFieldValueLocal(cObj, ['القرار']) || 'بدون قرار',
             type: getFieldValueLocal(cObj, ['نوع الجلسة']) || typeFahs,
             roll: getFieldValueLocal(cObj, ['الرول']) || '',
             notes: getFieldValueLocal(cObj, ['الملاحظات']) || ''
          };
          payload.sessions = [...(cObj.sessions || []), snapshot];
          payload['الرول'] = '';
        }
        
        if (Object.keys(payload).length > 0) {
          updates.push(saveCaseToFirebase(id, payload));
        }
      }
      if (updates.length > 0) {
        await Promise.all(updates);
        setBulkData({ 'تاريخ الجلسة': '', 'القرار': '', 'نوع الجلسة': typeFahs });
      }
      setSelectedCaseIds(new Set());
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء التحديث الجماعي');
    }
    setIsBulkSaving(false);
  };

  const startEditing = (e, cObj) => {
    e.stopPropagation();
    setEditingCaseId(cObj.id);
    const session = cObj.sessions?.find(s => s.date === date);
    // Support both new structured judgment and legacy fields
    const j = session?.judgment || {};
    setEditData({
      'الرول': getFieldValueLocal(cObj, ['الرول']) || '',
      'نوع الجلسة': getFieldValueLocal(cObj, ['نوع الجلسة']) || typeFahs,
      'آخر جلسة': getFieldValueLocal(cObj, ['آخر جلسة', 'تاريخ الجلسة']) || '',
      'القرار': getFieldValueLocal(cObj, ['القرار']) || '',
      'الملاحظات': getFieldValueLocal(cObj, ['الملاحظات']) || '',
      // New structured judgment fields
      '_judgmentCategory': j.category || '',
      '_judgmentType': j.type || session?.shortJudgment || '',
      '_judgmentResult': j.result || session?.judgmentClassification || '',
      'منطوق الحكم': j.fullVerdict || session?.verdict || '',
      '_isFinalJudgment': j.isFinal || false,
    });
  };

  const cancelEditing = (e) => {
    e?.stopPropagation();
    setEditingCaseId(null);
    setEditData({});
  };

  const saveEditing = async (e, cObj) => {
    e?.stopPropagation();
    const newData = { ...editData };
    
    const oldDate = getFieldValueLocal(cObj, ['آخر جلسة', 'تاريخ الجلسة']);
    const newDate = newData['آخر جلسة'];
    
    // Snapshot logic for Forwarding
    if (newDate && oldDate && newDate !== oldDate) {
      const snapshot = {
        id: Date.now().toString(),
        date: oldDate,
        decision: newData['القرار'] || getFieldValueLocal(cObj, ['القرار']) || 'بدون قرار',
        type: getFieldValueLocal(cObj, ['نوع الجلسة']) || typeFahs,
        roll: getFieldValueLocal(cObj, ['الرول']) || '',
        notes: newData['الملاحظات'] || getFieldValueLocal(cObj, ['الملاحظات']) || ''
      };
      newData.sessions = [...(cObj.sessions || []), snapshot];
      newData['الرول'] = ''; 
    }

    // Judgment saving logic for current session (new structured format)
    const hasJudgmentData = !!(newData['_judgmentCategory'] || newData['_judgmentType'] || newData['_judgmentResult'] || newData['منطوق الحكم']);
    
    // Apply Dynamic Rules if missing result or type
    if (hasJudgmentData && settings?.judgmentDefaults?.length > 0) {
       for (const rule of settings.judgmentDefaults) {
         const conds = rule.conditions || {};
         const currentRole = getFieldValueLocal(cObj, ['الصفة', 'صفة']) || '';
         const roleMatch = !conds.role || currentRole.includes(conds.role) || conds.role === currentRole;
         const catMatch = !conds.category || newData['_judgmentCategory'] === conds.category;
         const classMatch = !conds.classification || newData['_judgmentResult'] === conds.classification;
         const typeMatch = !conds.type || newData['_judgmentType'] === conds.type;
         const sessionTypeMatch = !conds.sessionType || newData['نوع الجلسة'] === conds.sessionType;
         const decisionMatch = !conds.decision || newData['القرار'] === conds.decision;
         
         if (roleMatch && catMatch && classMatch && typeMatch && sessionTypeMatch && decisionMatch && (conds.role || conds.category || conds.classification || conds.type || conds.sessionType || conds.decision)) {
           const acts = rule.actions || {};
           if (acts.category && !newData['_judgmentCategory']) newData['_judgmentCategory'] = acts.category;
           if (acts.classification && !newData['_judgmentResult']) newData['_judgmentResult'] = acts.classification;
           if (acts.type && !newData['_judgmentType']) newData['_judgmentType'] = acts.type;
           if (acts.text && !newData['منطوق الحكم']) newData['منطوق الحكم'] = acts.text;
           break;
         }
       }
    }

    if (hasJudgmentData) {
      let currentRole = getFieldValueLocal(cObj, ['الصفة', 'صفة']) || '';
      if (!currentRole.trim()) {
        const promptRes = await showPrompt('تحديد الصفة ضروري', 'يرجى تحديد صفتنا في هذه الدعوى لحساب الإحصائيات بدقة (مثلاً: طاعن، مطعون ضدنا):');
        if (promptRes?.trim()) {
          currentRole = promptRes.trim();
          newData['الصفة'] = currentRole;
        } else {
          toast('تنبيه: لم يتم تحديد الصفة! الإحصائيات ستتأثر ولن تكون دقيقة.', 'error');
        }
      }

      const newJudgmentObj = {
        category: newData['_judgmentCategory'] || '',
        type: newData['_judgmentType'] || '',
        result: newData['_judgmentResult'] || '',
        fullVerdict: newData['منطوق الحكم'] || '',
        isFinal: newData['_isFinalJudgment'] || false,
        recordedAt: new Date().toISOString().split('T')[0],
      };
      // Also write legacy fields for backward compatibility with Reports
      const sessionIndex = (newData.sessions || cObj.sessions || []).findIndex(s => s.date === date);
      let updatedSessions = [...(newData.sessions || cObj.sessions || [])];
      
      if (sessionIndex >= 0) {
        updatedSessions[sessionIndex] = {
          ...updatedSessions[sessionIndex],
          judgment: newJudgmentObj,
          shortJudgment: newData['_judgmentType'],
          judgmentClassification: newData['_judgmentResult'],
          verdict: newData['منطوق الحكم'] || '',
          hasJudgment: true,
        };
      } else {
        updatedSessions.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          date: date,
          judgment: newJudgmentObj,
          shortJudgment: newData['_judgmentType'],
          judgmentClassification: newData['_judgmentResult'],
          verdict: newData['منطوق الحكم'] || '',
          hasJudgment: true,
        });
      }
      newData.sessions = updatedSessions;
    }
    
    // Clean up internal edit state keys before saving
    delete newData['_judgmentCategory'];
    delete newData['_judgmentType'];
    delete newData['_judgmentResult'];
    delete newData['_isFinalJudgment'];
    delete newData['منطوق الحكم'];
    
    await saveCaseToFirebase(cObj.id, newData);
    setEditingCaseId(null);
    setEditData({});
  };

  const copyAllFromPrevious = (idx, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (idx > 0) {
      const prevCase = filteredCases[idx - 1];
      setEditData(prev => ({ 
        ...prev, 
        'نوع الجلسة': getFieldValueLocal(prevCase, ['نوع الجلسة']) || typeFahs,
        'آخر جلسة': getFieldValueLocal(prevCase, ['آخر جلسة', 'تاريخ الجلسة']) || '',
        'القرار': getFieldValueLocal(prevCase, ['القرار']) || '',
      }));
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      {/* Filters and Settings */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 no-print">
        <div className="flex flex-wrap gap-2 items-center">
          <button 
            onClick={() => {
              const newFilter = filterDecision === 'للحكم' ? null : 'للحكم';
              setFilterDecision(newFilter);
              if (newFilter === 'للحكم') {
                setVisibleColumns(prev => ({ ...prev, 'الحكم': true, 'تصنيف الحكم': true, 'منطوق الحكم': true }));
              } else {
                setVisibleColumns(prev => ({ ...prev, 'الحكم': false, 'تصنيف الحكم': false, 'منطوق الحكم': false }));
              }
            }}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border flex items-center gap-1 ${filterDecision === 'للحكم' ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
          >
            <Gavel className="w-3 h-3" />
            قضايا للحكم
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1"></div>
          <button 
            onClick={() => setFilterType(filterType === typeFahs ? null : typeFahs)}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border ${filterType === typeFahs ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
          >
            {typeFahs}
          </button>
          <button 
            onClick={() => setFilterType(filterType === typeMawdoo ? null : typeMawdoo)}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border ${filterType === typeMawdoo ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
          >
            {typeMawdoo}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
              <Search className="w-3 h-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="بحث في الجدول..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 sm:w-56 text-[10px] font-bold py-1.5 pr-8 pl-6 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-0 flex items-center pl-2 text-slate-400 hover:text-rose-500 transition"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <div className="relative">
          <button 
            onClick={() => setShowColSettings(!showColSettings)}
            className="text-[10px] font-black px-3 py-1.5 rounded-lg transition border bg-white text-slate-600 border-slate-200 hover:bg-slate-100 flex items-center gap-1"
          >
            <Settings2 className="w-3 h-3" /> إعدادات الحقول
          </button>
          {showColSettings && (
            <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-50">
              <p className="text-[9px] font-black text-slate-400 mb-2 border-b pb-1">أظهر/أخفِ الحقول</p>
              <div className="space-y-1">
                {ALL_COLUMNS.map(col => (
                  <label key={col.id} className="flex items-center gap-2 text-[10px] font-bold text-slate-700 cursor-pointer p-1 hover:bg-slate-50 rounded">
                    <input 
                      type="checkbox" 
                      checked={visibleColumns[col.id]}
                      onChange={() => setVisibleColumns(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                      className="rounded border-slate-300 text-navy-900 focus:ring-navy-900"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
           <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.1, 1.5))} className="px-2 py-1 hover:bg-slate-100 text-slate-600 font-black text-[10px] border-l border-slate-200" title="تكبير">+</button>
           <span className="px-2 py-1 text-[10px] font-bold text-slate-500 bg-slate-50">{Math.round(zoomLevel * 100)}%</span>
           <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.1, 0.7))} className="px-2 py-1 hover:bg-slate-100 text-slate-600 font-black text-[10px] border-r border-slate-200" title="تصغير">-</button>
        </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCaseIds.size > 0 && (
        <div className="flex flex-col bg-indigo-50 border border-indigo-200 rounded-xl p-3 shadow-inner animate-in fade-in slide-in-from-top-2 no-print gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-indigo-800 bg-indigo-100 px-2 py-1 rounded">تم تحديد ({selectedCaseIds.size}) قضية</span>
              <span className="text-[10px] font-bold text-indigo-600">ترحيل وتحديث جماعي:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={() => setBulkData({...bulkData, 'نوع الجلسة': bulkData['نوع الجلسة'] === typeFahs ? typeMawdoo : typeFahs})}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
              >
                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${bulkData['نوع الجلسة'] === typeMawdoo ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${bulkData['نوع الجلسة'] === typeMawdoo ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                {bulkData['نوع الجلسة'] || typeFahs}
              </button>
              
              <input 
                type="date" 
                value={bulkData['تاريخ الجلسة']} 
                onChange={e => setBulkData({...bulkData, 'تاريخ الجلسة': e.target.value})}
                className="text-xs font-bold p-1.5 rounded-lg border border-indigo-200 bg-white focus:outline-none focus:border-indigo-400"
              />
              <div className="relative flex items-center gap-1">
                <input 
                  list="decisions-list"
                  placeholder="القرار" 
                  value={bulkData['القرار']} 
                  onChange={e => setBulkData({...bulkData, 'القرار': e.target.value})}
                  className="text-xs font-bold p-1.5 rounded-lg border border-indigo-200 bg-white focus:outline-none focus:border-indigo-400 w-48"
                />
                <button 
                  onClick={() => setIsManageDecisionsOpen(true)}
                  className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                  title="إعدادات القرارات السريعة"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              <button 
                onClick={handleBulkSave}
                disabled={isBulkSaving}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-black transition disabled:opacity-50"
              >
                {isBulkSaving ? 'جاري الحفظ...' : <><Save className="w-4 h-4" /> تطبيق التحديث</>}
              </button>
              <div className="w-px h-6 bg-indigo-200 mx-1"></div>
              <button
                onClick={() => setIsPrintViewOpen(true)}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                <FileText className="w-3.5 h-3.5" /> استخراج شهادات
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5 mt-1 border-t border-indigo-100 pt-2">
            <span className="text-[10px] font-bold text-slate-500 ml-2 mt-1">قرارات سريعة:</span>
            {defaultDecisions.map((opt, i) => (
              <button 
                key={i}
                type="button" 
                onClick={() => setBulkData({...bulkData, 'القرار': opt})} 
                className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${bulkData['القرار'] === opt ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto border rounded-xl border-slate-200 bg-white shadow-sm min-h-[300px]">
        <table className="w-full text-right border-collapse min-w-[800px]" style={{ zoom: zoomLevel }}>
          <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 w-10 text-center no-print">
                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600 transition">
                  {selectedCaseIds.size === filteredCases.length && filteredCases.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              {visibleColumns['الرول'] && (
                <th onClick={() => handleSort('الرول')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition text-center w-12">
                  <div className="resize-x overflow-hidden max-w-full inline-block pb-1">الرول {sortField === 'الرول' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </th>
              )}
              {visibleColumns['رقم الدعوى'] && (
                <th onClick={() => handleSort('رقم الدعوى')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  <div className="resize-x overflow-hidden max-w-full min-w-[80px] inline-block pb-1">الدعوى {sortField === 'رقم الدعوى' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </th>
              )}
              {visibleColumns['المدعي'] && (
                <th onClick={() => handleSort('المدعي')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  <div className="resize-x overflow-hidden max-w-full min-w-[120px] inline-block pb-1">المدعي {sortField === 'المدعي' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </th>
              )}
              {visibleColumns['ضد'] && (
                <th onClick={() => handleSort('المدعى_عليه')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  <div className="resize-x overflow-hidden max-w-full min-w-[120px] inline-block pb-1">ضد {sortField === 'المدعى_عليه' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </th>
              )}
              {visibleColumns['نوع الجلسة'] && (
                <th onClick={() => handleSort('نوع الجلسة')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  <div className="resize-x overflow-hidden max-w-full inline-block pb-1">نوع الجلسة {sortField === 'نوع الجلسة' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </th>
              )}
              {visibleColumns['تاريخ الجلسة'] && (
                <th onClick={() => handleSort('آخر جلسة')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  <div className="resize-x overflow-hidden max-w-full min-w-[90px] inline-block pb-1">الجلسة القادمة {sortField === 'آخر جلسة' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </th>
              )}
              {visibleColumns['القرار'] && (
                <th onClick={() => handleSort('القرار')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  <div className="resize-x overflow-hidden max-w-full min-w-[150px] inline-block pb-1">القرار {sortField === 'القرار' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </th>
              )}
              {visibleColumns['الحكم'] && (
                <th className="px-3 py-2 text-[10px] font-black text-rose-700 bg-rose-50 border-b border-slate-200">
                  <div className="resize-x overflow-hidden max-w-full min-w-[120px] inline-block pb-1">الحكم</div>
                </th>
              )}
              {visibleColumns['منطوق الحكم'] && (
                <th className="px-3 py-2 text-[10px] font-black text-rose-700 bg-rose-50 border-b border-slate-200">
                  <div className="resize-x overflow-hidden max-w-full min-w-[200px] inline-block pb-1">منطوق الحكم</div>
                </th>
              )}
              {visibleColumns['الملاحظات'] && (
                <th onClick={() => handleSort('الملاحظات')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition text-center min-w-[150px]">
                  <div className="resize-x overflow-hidden max-w-full min-w-[150px] inline-block pb-1">ملاحظات الجلسة {sortField === 'الملاحظات' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
                </th>
              )}
              <th className="px-2 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 w-28 text-center no-print">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCases.map((cObj, idx) => {
              const isSelected = selectedCaseIds.has(cObj.id);
              const isEditing = editingCaseId === cObj.id;
              
              return (
                <tr 
                  key={cObj.id} 
                  className={`group transition-colors border-b border-slate-100 even:bg-slate-50/50 odd:bg-white hover:bg-indigo-50/30 ${isSelected ? 'bg-indigo-50/50' : ''}`}
                >
                  <td className="px-3 py-2.5 text-center align-middle no-print">
                    <button onClick={() => toggleSelection(cObj.id)} className="text-slate-300 hover:text-indigo-600 transition">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  {visibleColumns['الرول'] && (
                    <td className="px-3 py-2.5 text-[11px] font-black text-navy-900 text-center bg-slate-50/50">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={editData['الرول'] || ''} 
                          onChange={e => setEditData({...editData, 'الرول': e.target.value})}
                          className="w-10 text-center text-[10px] font-bold p-1 rounded border border-slate-300 bg-white focus:border-navy-900 outline-none mx-auto block"
                        />
                      ) : (
                        getFieldValueLocal(cObj, ['الرول']) || '-'
                      )}
                    </td>
                  )}
                  
                  {visibleColumns['رقم الدعوى'] && (
                    <td className="px-3 py-2.5 text-xs font-black text-navy-900 cursor-pointer hover:text-indigo-600" onClick={() => !isEditing && navigate(`/case/${cObj.id}`)}>
                      {getFieldValueLocal(cObj, ['رقم الدعوى'])} / {getFieldValueLocal(cObj, ['السنة'])}
                    </td>
                  )}
                  {visibleColumns['المدعي'] && (
                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{getFieldValueLocal(cObj, ['المدعي'])}</td>
                  )}
                  {visibleColumns['ضد'] && (
                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{getFieldValueLocal(cObj, ['المدعى_عليه', 'المطعون ضده', 'المطعون ضدنا', 'مدعى علينا'])}</td>
                  )}
                  
                  {visibleColumns['نوع الجلسة'] && (
                    <td className="px-3 py-2.5 text-[10px] font-bold text-slate-700">
                      {isEditing ? (
                         <button 
                           onClick={() => setEditData({...editData, 'نوع الجلسة': editData['نوع الجلسة'] === typeFahs ? typeMawdoo : typeFahs})}
                           className="flex items-center justify-center gap-1 w-full p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 focus:outline-none"
                         >
                           <RefreshCcw className="w-3 h-3 text-slate-400" />
                           {editData['نوع الجلسة'] || typeFahs}
                         </button>
                      ) : (
                        getFieldValueLocal(cObj, ['نوع الجلسة'])
                      )}
                    </td>
                  )}
                  
                  {visibleColumns['تاريخ الجلسة'] && (
                    <td className="px-3 py-2.5 text-[10px] font-bold text-slate-700">
                      {isEditing ? (
                         <input 
                          type="date" 
                          value={editData['آخر جلسة'] || ''} 
                          onChange={e => setEditData({...editData, 'آخر جلسة': e.target.value})}
                          className="w-full text-[10px] font-bold p-1 rounded border border-slate-300 bg-white focus:border-navy-900 outline-none"
                        />
                      ) : (
                        getFieldValueLocal(cObj, ['آخر جلسة', 'تاريخ الجلسة'])
                      )}
                    </td>
                  )}
                  
                  {visibleColumns['القرار'] && (
                    <td className="px-3 py-2.5 text-[10px] font-bold text-amber-800 line-clamp-2 min-w-[200px]">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                           <input 
                            list="decisions-list"
                            value={editData['القرار'] || ''} 
                            onChange={e => setEditData({...editData, 'القرار': e.target.value})}
                            className="w-full text-[10px] font-bold p-1 rounded border border-amber-300 bg-white focus:border-amber-600 outline-none"
                            placeholder="القرار..."
                          />
                          <button 
                            onClick={() => setIsManageDecisionsOpen(true)}
                            className="p-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition"
                            title="إعدادات القرارات السريعة"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        getFieldValueLocal(cObj, ['القرار'])
                      )}
                    </td>
                  )}

                  {visibleColumns['الحكم'] && (
                    <td className="px-3 py-2.5 bg-rose-50/30 min-w-[260px]">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          {/* Row 1: Category + Result */}
                          <div className="flex gap-1">
                            <select
                              value={editData['_judgmentCategory'] || ''}
                              onChange={e => setEditData({...editData, '_judgmentCategory': e.target.value, '_judgmentType': ''})}
                              className="flex-1 text-[10px] font-bold p-1 rounded border border-rose-200 bg-white focus:border-rose-500 outline-none"
                            >
                              <option value="">-- فئة --</option>
                              {JUDGMENT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <select
                              value={editData['_judgmentResult'] || ''}
                              onChange={e => setEditData({...editData, '_judgmentResult': e.target.value})}
                              className="flex-1 text-[10px] font-bold p-1 rounded border border-rose-200 bg-white focus:border-rose-500 outline-none"
                            >
                              <option value="">-- النتيجة --</option>
                              {JUDGMENT_RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </div>
                          {/* Row 2: Type */}
                          <select
                            value={editData['_judgmentType'] || ''}
                            onChange={e => setEditData({...editData, '_judgmentType': e.target.value})}
                            className="w-full text-[10px] font-bold p-1 rounded border border-rose-200 bg-white focus:border-rose-500 outline-none"
                          >
                            <option value="">-- نوع الحكم --</option>
                            {(JUDGMENT_TYPES[editData['_judgmentCategory']] || []).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          {/* Row 3: Final checkbox */}
                          <label className="flex items-center gap-1 text-[9px] font-bold text-rose-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editData['_isFinalJudgment'] || false}
                              onChange={e => setEditData({...editData, '_isFinalJudgment': e.target.checked})}
                              className="rounded"
                            />
                            حكم نهائي في الدعوى
                          </label>
                        </div>
                      ) : (() => {
                        const session = cObj.sessions?.find(s => s.date === date);
                        const j = session?.judgment;
                        const typeLabel = j?.type || session?.shortJudgment || '';
                        const result = j?.result || session?.judgmentClassification || '';
                        if (!typeLabel && !result) return null;
                        return (
                          <div className="flex flex-col gap-0.5">
                            {typeLabel && <span className="text-[10px] font-black text-rose-800">{typeLabel}</span>}
                            {result && (
                              <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded border w-fit ${getResultStyle(result)}`}>
                                {result}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  
                  {visibleColumns['منطوق الحكم'] && (
                    <td className="px-3 py-2.5 bg-rose-50/30 relative min-w-[200px]">
                      {isEditing ? (
                        <textarea 
                          value={editData['منطوق الحكم'] || ''} 
                          onChange={e => setEditData({...editData, 'منطوق الحكم': e.target.value})}
                          className="w-full text-[10px] font-bold p-1 rounded border border-rose-200 bg-white resize-none focus:border-rose-500 outline-none"
                          rows={3}
                          placeholder="منطوق الحكم كاملاً..."
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-700 line-clamp-3" title={cObj.sessions?.find(s => s.date === date)?.judgment?.fullVerdict || cObj.sessions?.find(s => s.date === date)?.verdict || ''}>
                           {cObj.sessions?.find(s => s.date === date)?.judgment?.fullVerdict || cObj.sessions?.find(s => s.date === date)?.verdict || ''}
                        </span>
                      )}
                    </td>
                  )}

                  {visibleColumns['الملاحظات'] && (
                    <td className="px-3 py-2.5 text-[10px] font-bold text-slate-700">
                      {isEditing ? (
                        <textarea 
                          value={editData['الملاحظات'] || ''} 
                          onChange={e => setEditData({...editData, 'الملاحظات': e.target.value})}
                          className="w-full text-[10px] font-bold p-1 rounded border border-slate-300 bg-white focus:border-navy-900 outline-none resize-none"
                          rows={2}
                          placeholder="ملاحظات..."
                        />
                      ) : (
                        <span className="line-clamp-2">{getFieldValueLocal(cObj, ['الملاحظات'])}</span>
                      )}
                    </td>
                  )}
                  
                  <td className="px-2 py-2.5 text-center no-print align-middle">
                    {isEditing ? (
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-1 w-full justify-center">
                           <button onClick={(e) => saveEditing(e, cObj)} title="حفظ" className="flex-1 h-6 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center hover:bg-emerald-200"><Check className="w-3 h-3" /></button>
                           <button onClick={cancelEditing} title="إلغاء" className="flex-1 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200"><X className="w-3 h-3" /></button>
                        </div>
                        {idx > 0 && (
                          <button onClick={(e) => copyAllFromPrevious(idx, e)} title="نسخ الجلسة من السابق (نوع، تاريخ، قرار)" className="w-full flex items-center justify-center gap-1 bg-amber-100 text-amber-700 hover:bg-amber-200 px-2 py-1 rounded text-[9px] font-black transition">
                            <CopyPlus className="w-3 h-3" /> نسخ من السابق
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={(e) => startEditing(e, cObj)} title="تعديل سريع" className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-navy-900 hover:text-amber-300 flex items-center justify-center transition">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setQuickEditCaseId(cObj.id)} title="تعديل شامل" className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-amber-400 hover:text-navy-900 flex items-center justify-center transition">
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredCases.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-xs font-bold text-slate-400">
                  لا توجد نتائج مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {quickEditCaseId && (
        <QuickEditCaseModal 
          isOpen={!!quickEditCaseId} 
          onClose={() => setQuickEditCaseId(null)} 
          caseData={dayCases.find(c => c.id === quickEditCaseId)} 
        />
      )}

      {isPrintViewOpen && (
        <GlobalTemplatePrintModal
          cases={filteredCases.filter(c => selectedCaseIds.has(c.id))}
          sessionDate={date}
          onClose={() => setIsPrintViewOpen(false)}
        />
      )}

      <datalist id="decisions-list">
        {defaultDecisions.map((opt, i) => (
          <option key={i} value={opt} />
        ))}
      </datalist>
      <datalist id="short-judgments-list">
        {uniqueShortJudgments.map((opt, i) => <option key={`sh-${i}`} value={opt} />)}
      </datalist>
      <datalist id="judgment-classifications-list">
        {uniqueClassifications.map((opt, i) => <option key={`jc-${i}`} value={opt} />)}
      </datalist>

      {isManageDecisionsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-navy-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-500" />
                إعدادات قائمة القرارات
              </h3>
              <button onClick={() => setIsManageDecisionsOpen(false)} className="text-slate-400 hover:text-rose-500 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={newDecisionOption}
                  onChange={(e) => setNewDecisionOption(e.target.value)}
                  placeholder="إضافة قرار جديد..."
                  className="flex-1 text-xs font-bold p-2 rounded-xl border border-slate-200 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDecisionOption.trim() !== '') {
                      const updated = [...defaultDecisions, newDecisionOption.trim()];
                      if(saveSettingsToFirebase) saveSettingsToFirebase({ decisions: updated });
                      setNewDecisionOption('');
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (newDecisionOption.trim() !== '') {
                      const updated = [...defaultDecisions, newDecisionOption.trim()];
                      if(saveSettingsToFirebase) saveSettingsToFirebase({ decisions: updated });
                      setNewDecisionOption('');
                    }
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-xl transition"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {defaultDecisions.map((opt, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 group hover:border-amber-200 transition">
                    <span className="text-xs font-bold text-slate-700">{opt}</span>
                    <button 
                      onClick={() => {
                        const updated = defaultDecisions.filter((_, idx) => idx !== i);
                        if(saveSettingsToFirebase) saveSettingsToFirebase({ decisions: updated });
                      }}
                      className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
