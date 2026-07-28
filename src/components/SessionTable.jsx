import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Upload, Edit3, Gavel, Settings2, Copy, Maximize2, CheckSquare, Square, Save, CopyPlus, RefreshCcw } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { uploadToR2 } from '../lib/r2';
import QuickEditCaseModal from './QuickEditCaseModal';

const ALL_COLUMNS = [
  { id: 'الرول', label: 'الرول', defaultVisible: true },
  { id: 'رقم الدعوى', label: 'الدعوى', defaultVisible: true },
  { id: 'المدعي', label: 'المدعي', defaultVisible: true },
  { id: 'ضد', label: 'ضد', defaultVisible: true },
  { id: 'نوع الجلسة', label: 'نوع الجلسة', defaultVisible: true },
  { id: 'تاريخ الجلسة', label: 'الجلسة القادمة', defaultVisible: true },
  { id: 'القرار', label: 'القرار', defaultVisible: true },
  { id: 'الحكم', label: 'الحكم', defaultVisible: false },
  { id: 'تصنيف الحكم', label: 'تصنيف الحكم', defaultVisible: false },
  { id: 'منطوق الحكم', label: 'منطوق الحكم', defaultVisible: false },
];

const PREDEFINED_DECISIONS = ['للحكم', 'تصريح', 'للإعلان', 'للاطلاع', 'للإخطار', 'لورود التقرير', 'لتنفيذ قرار الإعادة', 'للاستعلام', 'استبعاد', 'إحالة للموضوع', 'رفض'];

export default function SessionTable({ dayCases, date }) {
  const navigate = useNavigate();
  const { saveCaseToFirebase, settings } = useAppContext();
  
  const defaultDecisions = settings?.decisions || PREDEFINED_DECISIONS;

  // View state
  const [filterDecision, setFilterDecision] = useState(null); // 'للحكم' or null
  const [filterType, setFilterType] = useState(null); // 'فحص', 'موضوع', or null
  const [sortField, setSortField] = useState('الرول');
  const [sortOrder, setSortOrder] = useState('asc');
  
  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState(
    ALL_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultVisible }), {})
  );
  const [showColSettings, setShowColSettings] = useState(false);

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
    'نوع الجلسة': 'فحص'
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

  const filteredCases = useMemo(() => {
    let result = [...dayCases];
    if (filterDecision === 'للحكم') {
      result = result.filter(c => getFieldValueLocal(c, ['القرار'])?.includes('للحكم'));
    }
    if (filterType) {
      result = result.filter(c => getFieldValueLocal(c, ['نوع الجلسة']) === filterType || getFieldValueLocal(c, ['نوع الدعوى']) === filterType);
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
  }, [dayCases, filterDecision, filterType, sortField, sortOrder]);

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
        setBulkData(prev => ({...prev, 'نوع الجلسة': getFieldValueLocal(firstCase, ['نوع الجلسة']) || 'فحص'}));
    }
  };

  const toggleSelectAll = () => {
    if (selectedCaseIds.size === filteredCases.length) {
      setSelectedCaseIds(new Set());
    } else {
      const allIds = new Set(filteredCases.map(c => c.id));
      setSelectedCaseIds(allIds);
      if (filteredCases.length > 0) {
        setBulkData(prev => ({...prev, 'نوع الجلسة': getFieldValueLocal(filteredCases[0], ['نوع الجلسة']) || 'فحص'}));
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
             type: getFieldValueLocal(cObj, ['نوع الجلسة']) || 'فحص',
             roll: getFieldValueLocal(cObj, ['الرول']) || ''
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
        setBulkData({ 'تاريخ الجلسة': '', 'القرار': '', 'نوع الجلسة': 'فحص' });
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
    setEditData({
      'الرول': getFieldValueLocal(cObj, ['الرول']) || '',
      'نوع الجلسة': getFieldValueLocal(cObj, ['نوع الجلسة']) || 'فحص',
      'آخر جلسة': getFieldValueLocal(cObj, ['آخر جلسة', 'تاريخ الجلسة']) || '',
      'القرار': getFieldValueLocal(cObj, ['القرار']) || '',
      'الحكم': getFieldValueLocal(cObj, ['الحكم']) || '',
      'تصنيف الحكم': getFieldValueLocal(cObj, ['تصنيف الحكم']) || '',
      'منطوق الحكم': getFieldValueLocal(cObj, ['منطوق الحكم']) || '',
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
        type: getFieldValueLocal(cObj, ['نوع الجلسة']) || 'فحص',
        roll: getFieldValueLocal(cObj, ['الرول']) || ''
      };
      newData.sessions = [...(cObj.sessions || []), snapshot];
      newData['الرول'] = ''; 
    }
    
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
        'نوع الجلسة': getFieldValueLocal(prevCase, ['نوع الجلسة']) || 'فحص',
        'آخر جلسة': getFieldValueLocal(prevCase, ['آخر جلسة', 'تاريخ الجلسة']) || '',
        'القرار': getFieldValueLocal(prevCase, ['القرار']) || '',
      }));
    }
  };

  const handleFileUpload = async (e, cObj) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const url = await uploadToR2(file);
      const newDoc = {
        id: Date.now().toString(),
        name: file.name,
        type: 'حكم',
        fileType: file.type.startsWith('image/') ? 'image' : 'pdf',
        url: url,
        date: new Date().toISOString(),
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
      };
      const existingDocs = cObj.documents || [];
      await saveCaseToFirebase(cObj.id, {
        documents: [...existingDocs, newDoc]
      });
      alert('تم رفع ملف الحكم وإضافته بنجاح لمرفقات القضية!');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الرفع.');
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
              }
            }}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border flex items-center gap-1 ${filterDecision === 'للحكم' ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
          >
            <Gavel className="w-3 h-3" />
            للحكم فقط
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1"></div>
          <button 
            onClick={() => setFilterType(filterType === 'فحص' ? null : 'فحص')}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border ${filterType === 'فحص' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
          >
            فحص
          </button>
          <button 
            onClick={() => setFilterType(filterType === 'موضوع' ? null : 'موضوع')}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition border ${filterType === 'موضوع' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shadow-inner' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
          >
            موضوع
          </button>
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
                onClick={() => setBulkData({...bulkData, 'نوع الجلسة': bulkData['نوع الجلسة'] === 'فحص' ? 'موضوع' : 'فحص'})}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
              >
                <RefreshCcw className="w-3 h-3" />
                {bulkData['نوع الجلسة'] || 'فحص'}
              </button>
              
              <input 
                type="date" 
                value={bulkData['تاريخ الجلسة']} 
                onChange={e => setBulkData({...bulkData, 'تاريخ الجلسة': e.target.value})}
                className="text-xs font-bold p-1.5 rounded-lg border border-indigo-200 bg-white focus:outline-none focus:border-indigo-400"
              />
              <input 
                type="text" 
                placeholder="القرار" 
                value={bulkData['القرار']} 
                onChange={e => setBulkData({...bulkData, 'القرار': e.target.value})}
                className="text-xs font-bold p-1.5 rounded-lg border border-indigo-200 bg-white focus:outline-none focus:border-indigo-400 w-48"
              />
              <button 
                onClick={handleBulkSave}
                disabled={isBulkSaving}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-black transition disabled:opacity-50"
              >
                {isBulkSaving ? 'جاري الحفظ...' : <><Save className="w-4 h-4" /> تطبيق التحديث</>}
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
        <table className="w-full text-right border-collapse min-w-[800px]">
          <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 w-10 text-center no-print">
                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600 transition">
                  {selectedCaseIds.size === filteredCases.length && filteredCases.length > 0 ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              {visibleColumns['الرول'] && (
                <th onClick={() => handleSort('الرول')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition text-center w-12">
                  الرول {sortField === 'الرول' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns['رقم الدعوى'] && (
                <th onClick={() => handleSort('رقم الدعوى')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  الدعوى {sortField === 'رقم الدعوى' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns['المدعي'] && (
                <th onClick={() => handleSort('المدعي')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  المدعي {sortField === 'المدعي' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns['ضد'] && (
                <th onClick={() => handleSort('المدعى_عليه')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  ضد {sortField === 'المدعى_عليه' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns['نوع الجلسة'] && (
                <th onClick={() => handleSort('نوع الجلسة')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  نوع الجلسة {sortField === 'نوع الجلسة' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns['تاريخ الجلسة'] && (
                <th onClick={() => handleSort('آخر جلسة')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  الجلسة القادمة {sortField === 'آخر جلسة' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns['القرار'] && (
                <th onClick={() => handleSort('القرار')} className="px-3 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200 transition">
                  القرار {sortField === 'القرار' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
              )}
              {visibleColumns['الحكم'] && (
                <th className="px-3 py-2 text-[10px] font-black text-rose-700 bg-rose-50 border-b border-slate-200">الحكم</th>
              )}
              {visibleColumns['تصنيف الحكم'] && (
                <th className="px-3 py-2 text-[10px] font-black text-rose-700 bg-rose-50 border-b border-slate-200">تصنيف الحكم</th>
              )}
              {visibleColumns['منطوق الحكم'] && (
                <th className="px-3 py-2 text-[10px] font-black text-rose-700 bg-rose-50 border-b border-slate-200">منطوق الحكم</th>
              )}
              <th className="px-2 py-2 text-[10px] font-black text-slate-600 border-b border-slate-200 w-28 text-center no-print">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCases.map((cObj, idx) => {
              const isEditing = editingCaseId === cObj.id;
              const isSelected = selectedCaseIds.has(cObj.id);
              
              return (
                <tr key={cObj.id} className={`hover:bg-slate-50 transition group ${isSelected ? 'bg-indigo-50/50' : ''}`}>
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
                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-700 truncate max-w-[120px]">{getFieldValueLocal(cObj, ['المدعى_عليه', 'المطعون ضده'])}</td>
                  )}
                  
                  {visibleColumns['نوع الجلسة'] && (
                    <td className="px-3 py-2.5 text-[10px] font-bold text-slate-700">
                      {isEditing ? (
                         <button 
                           onClick={() => setEditData({...editData, 'نوع الجلسة': editData['نوع الجلسة'] === 'فحص' ? 'موضوع' : 'فحص'})}
                           className="flex items-center justify-center gap-1 w-full p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 focus:outline-none"
                         >
                           <RefreshCcw className="w-3 h-3 text-slate-400" />
                           {editData['نوع الجلسة'] || 'فحص'}
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
                        <div className="flex flex-col gap-1.5">
                           <textarea 
                            value={editData['القرار'] || ''} 
                            onChange={e => setEditData({...editData, 'القرار': e.target.value})}
                            className="w-full text-[10px] font-bold p-1 rounded border border-amber-300 bg-white focus:border-amber-600 outline-none resize-none"
                            rows={2}
                          />
                          <div className="flex flex-wrap gap-1">
                            {defaultDecisions.slice(0, 6).map((opt, i) => (
                              <button 
                                key={i}
                                type="button" 
                                onClick={() => setEditData({...editData, 'القرار': opt})} 
                                className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${editData['القرار'] === opt ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        getFieldValueLocal(cObj, ['القرار'])
                      )}
                    </td>
                  )}
                  
                  {visibleColumns['الحكم'] && (
                    <td className="px-3 py-2.5 bg-rose-50/30">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={editData['الحكم'] || ''} 
                          onChange={e => setEditData({...editData, 'الحكم': e.target.value})}
                          className="w-full text-[10px] font-bold p-1 rounded border border-rose-200 bg-white focus:border-rose-500 outline-none"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-rose-800">{getFieldValueLocal(cObj, ['الحكم'])}</span>
                      )}
                    </td>
                  )}
                  
                  {visibleColumns['تصنيف الحكم'] && (
                    <td className="px-3 py-2.5 bg-rose-50/30">
                      {isEditing ? (
                        <input 
                          type="text" 
                          value={editData['تصنيف الحكم'] || ''} 
                          onChange={e => setEditData({...editData, 'تصنيف الحكم': e.target.value})}
                          className="w-full text-[10px] font-bold p-1 rounded border border-rose-200 bg-white focus:border-rose-500 outline-none"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-rose-800">{getFieldValueLocal(cObj, ['تصنيف الحكم'])}</span>
                      )}
                    </td>
                  )}
                  
                  {visibleColumns['منطوق الحكم'] && (
                    <td className="px-3 py-2.5 bg-rose-50/30 relative">
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <textarea 
                            value={editData['منطوق الحكم'] || ''} 
                            onChange={e => setEditData({...editData, 'منطوق الحكم': e.target.value})}
                            className="w-full text-[10px] font-bold p-1 rounded border border-rose-200 bg-white resize-none focus:border-rose-500 outline-none"
                            rows={2}
                          />
                          <div className="flex items-center gap-1">
                            <label className="cursor-pointer flex-1 flex items-center justify-center gap-1 text-[9px] font-black bg-white border border-rose-200 text-rose-600 px-2 py-1 rounded hover:bg-rose-50 transition">
                              <Upload className="w-3 h-3" />
                              {isUploading ? 'جاري الرفع...' : 'مرفق'}
                              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,image/*" onChange={(e) => handleFileUpload(e, cObj)} disabled={isUploading} />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-800 line-clamp-3">{getFieldValueLocal(cObj, ['منطوق الحكم'])}</span>
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
    </div>
  );
}
