import React, { useState, useRef } from 'react';
import { BookOpen, Upload, Trash2, Edit3, Calendar, FileText, X, ExternalLink, Gavel, RotateCw } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { uploadToR2, deleteFromR2 } from '../lib/r2';
import { formatDateString } from '../utils/dateUtils';
import imageCompression from 'browser-image-compression';

export default function RollsLibrary() {
  const { rolls, cases, saveRollToFirebase, deleteRollFromFirebase, isAdmin, currentUser, settings, currentUserPermissions } = useAppContext();
  
  const canManageRolls = isAdmin || currentUserPermissions?.canManageRolls;
  const { toast, showConfirm } = useUI();
  
  const rollTypes = settings?.rollTypes || ['رول جلسة', 'حصر الفحص', 'حصر الموضوع', 'رول أحكام'];
  const currentCourtDegree = settings?.courtDegree || 'أول درجة';
  const isSupreme = currentCourtDegree === 'ثان درجة' || currentCourtDegree === 'عليا' || currentCourtDegree === 'الإدارية العليا';
  const sessionTypes = settings?.sessionTypes || (isSupreme ? ['فحص', 'موضوع'] : ['مفوضين', 'مرافعة', 'حكم']);
  const baseTypeDefault = rollTypes[0] || 'رول جلسة';
  const typeFahs = sessionTypes[0] || 'فحص';
  const typeMawdoo = sessionTypes[1] || 'موضوع';

  const [selectedFile, setSelectedFile] = useState(null);
  const [rollDate, setRollDate] = useState('');
  const [baseType, setBaseType] = useState(baseTypeDefault);
  const [circuitType, setCircuitType] = useState(typeFahs);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Viewer State
  const [viewingRoll, setViewingRoll] = useState(null);
  const [activeViewerTab, setActiveViewerTab] = useState('pdf'); // 'pdf' or 'cases'
  const [rotation, setRotation] = useState(0);
  const [listFilter, setListFilter] = useState('الكل');
  const [monthFilter, setMonthFilter] = useState('الكل');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingRoll, setEditingRoll] = useState(null);

  const getFieldValue = (obj, keys) => {
    for (let key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !rollDate) {
      toast('يرجى تحديد الملف والتاريخ', 'error');
      return;
    }

    const finalRollType = `${baseType} - ${circuitType}`;

    setIsUploading(true);
    try {
      let fileToUpload = selectedFile;

      // Compress image if it's an image
      if (fileToUpload.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };
        fileToUpload = await imageCompression(fileToUpload, options);
      }

      const url = await uploadToR2(fileToUpload, 'ekhtsasi-light-files');
      
      const newRoll = {
        id: Date.now().toString(),
        url,
        date: rollDate,
        type: finalRollType,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser || 'مجهول'
      };

      await saveRollToFirebase(newRoll.id, newRoll);
      
      toast('تم حفظ الرول بنجاح', 'success');
      setSelectedFile(null);
      setRollDate('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploadModalOpen(false);
    } catch (error) {
      console.error(error);
      toast(`حدث خطأ أثناء الرفع: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!rollDate) {
      toast('يرجى تحديد التاريخ', 'error');
      return;
    }
    const finalRollType = `${baseType} - ${circuitType}`;
    
    setIsUploading(true);
    try {
      const updatedRoll = {
        ...editingRoll,
        date: rollDate,
        type: finalRollType
      };
      await saveRollToFirebase(editingRoll.id, updatedRoll);
      toast('تم تعديل بيانات الرول بنجاح', 'success');
      setEditingRoll(null);
      setRollDate('');
      setBaseType(baseTypeDefault);
      setCircuitType(typeFahs);
    } catch (err) {
      toast('حدث خطأ أثناء التعديل', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (roll) => {
    const confirmed = await showConfirm('حذف الرول', 'هل أنت متأكد من حذف هذا الرول نهائياً؟');
    if (!confirmed) return;

    try {
      await deleteFromR2(roll.url, 'ekhtsasi-light-files');
      await deleteRollFromFirebase(roll.id);
      toast('تم حذف الرول بنجاح', 'info');
      if (viewingRoll?.id === roll.id) setViewingRoll(null);
    } catch (error) {
      console.error(error);
      toast('حدث خطأ أثناء الحذف', 'error');
    }
  };

  // Extract user cases for the viewing date
  const userCasesForDate = viewingRoll ? cases.filter(c => {
    const caseSessionDateRaw = getFieldValue(c, ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة']);
    const caseSessionDate = formatDateString(caseSessionDateRaw);
    return caseSessionDate === viewingRoll.date;
  }) : [];

  const sortedRolls = [...rolls].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const availableMonths = [...new Set(sortedRolls.map(r => r.date.substring(0, 7)))];

  const filteredRolls = sortedRolls.filter(r => {
    let typeMatch = true;
    if (listFilter !== 'الكل') {
      if (listFilter === 'رولات الجلسات') typeMatch = r.type.includes('جلسة');
      else if (listFilter === 'الأحكام') typeMatch = r.type.includes('حصر') || r.type.includes('أحكام');
      else typeMatch = r.type === listFilter;
    }
    
    let monthMatch = true;
    if (monthFilter !== 'الكل') {
      monthMatch = r.date.substring(0, 7) === monthFilter;
    }
    
    return typeMatch && monthMatch;
  });

  const getFriendlyMonthName = (monthKey) => {
    const [year, month] = monthKey.split('-');
    const months = {
      '01': 'يناير',
      '02': 'فبراير',
      '03': 'مارس',
      '04': 'أبريل',
      '05': 'مايو',
      '06': 'يونيو',
      '07': 'يوليو',
      '08': 'أغسطس',
      '09': 'سبتمبر',
      '10': 'أكتوبر',
      '11': 'نوفمبر',
      '12': 'ديسمبر'
    };
    const monthName = months[month] || month;
    return `${monthName} ${year}`;
  };

  // Group filtered rolls by month key (YYYY-MM)
  const rollsByMonth = {};
  filteredRolls.forEach(roll => {
    const monthKey = roll.date.substring(0, 7);
    if (!rollsByMonth[monthKey]) {
      rollsByMonth[monthKey] = [];
    }
    rollsByMonth[monthKey].push(roll);
  });

  const sortedMonthKeys = Object.keys(rollsByMonth).sort((a, b) => b.localeCompare(a));

  const getRollStyle = (type) => {
    const isJudgment = type.includes('حصر') || type.includes('أحكام');
    const isFahs = type.includes(typeFahs);
    const isMawdoo = type.includes('موضوع');

    let theme = { 
       base: '', 
       iconBg: '', 
       iconColor: '', 
       textColor: '',
       btnBg: '',
       icon: isJudgment ? <Gavel className="w-8 h-8" /> : <Calendar className="w-8 h-8" /> 
    };

    if (isFahs) {
        theme.iconBg = 'bg-amber-100';
        theme.iconColor = 'text-amber-600';
        theme.textColor = 'text-amber-700';
        theme.btnBg = 'bg-amber-50 hover:bg-amber-100 text-amber-700';
        theme.accent = 'bg-amber-500';
        theme.border = 'border-amber-200';
    } else if (isMawdoo) {
        theme.iconBg = 'bg-emerald-100';
        theme.iconColor = 'text-emerald-600';
        theme.textColor = 'text-emerald-700';
        theme.btnBg = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700';
        theme.accent = 'bg-emerald-500';
        theme.border = 'border-emerald-200';
    } else {
        theme.iconBg = 'bg-indigo-100';
        theme.iconColor = 'text-indigo-600';
        theme.textColor = 'text-indigo-700';
        theme.btnBg = 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700';
        theme.accent = 'bg-indigo-500';
        theme.border = 'border-indigo-200';
    }

    if (isJudgment) {
        if (isFahs) {
             theme.base = `bg-amber-50/70 border-2 border-amber-200 hover:bg-amber-50/90 hover:border-amber-400`;
             theme.iconBg = 'bg-amber-100/80';
             theme.textColor = 'text-amber-900';
             theme.btnBg = 'bg-white border border-amber-200 hover:bg-amber-100 text-amber-700';
             theme.accent = 'bg-amber-500';
             theme.iconColor = 'text-amber-600';
        } else if (isMawdoo) {
             theme.base = `bg-emerald-50/70 border-2 border-emerald-200 hover:bg-emerald-50/90 hover:border-emerald-400`;
             theme.iconBg = 'bg-emerald-100/80';
             theme.textColor = 'text-emerald-900';
             theme.btnBg = 'bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700';
             theme.accent = 'bg-emerald-500';
             theme.iconColor = 'text-emerald-600';
        } else {
             theme.base = `bg-rose-50/70 border-2 border-rose-200 hover:bg-rose-50/90 hover:border-rose-400`;
             theme.iconBg = 'bg-rose-100/80';
             theme.textColor = 'text-rose-900';
             theme.btnBg = 'bg-white border border-rose-200 hover:bg-rose-100 text-rose-700';
             theme.accent = 'bg-rose-500';
             theme.iconColor = 'text-rose-600';
        }
    } else {
        if (isFahs) {
             theme.base = `bg-amber-50/20 border-2 border-amber-200 hover:bg-amber-50/45 hover:border-amber-400`;
        } else if (isMawdoo) {
             theme.base = `bg-emerald-50/20 border-2 border-emerald-200 hover:bg-emerald-50/45 hover:border-emerald-400`;
        } else {
             theme.base = `bg-white border-2 ${theme.border} hover:bg-slate-50 hover:border-indigo-400`;
        }
    }

    return theme;
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
               <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-lg text-navy-900">مكتبة الرولات</h2>
              <p className="text-[11px] text-slate-500 font-bold">حفظ واستعراض رولات الجلسات وحصر الأحكام</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex bg-slate-100 p-1.5 rounded-xl self-start sm:self-auto w-full sm:w-auto overflow-x-auto">
              <button 
                onClick={() => setListFilter('الكل')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${listFilter === 'الكل' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500 hover:text-navy-900'}`}
              >
                الكل
              </button>
              <button 
                onClick={() => setListFilter('رولات الجلسات')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${listFilter === 'رولات الجلسات' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500 hover:text-navy-900'}`}
              >
                رولات الجلسات
              </button>
              <button 
                onClick={() => setListFilter('الأحكام')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all whitespace-nowrap ${listFilter === 'الأحكام' ? 'bg-white shadow-sm text-navy-900' : 'text-slate-500 hover:text-navy-900'}`}
              >
                الأحكام والحصر
              </button>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              <span className="text-xs font-bold text-slate-400 shrink-0">الشهر:</span>
              <button
                onClick={() => setMonthFilter('الكل')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 border ${monthFilter === 'الكل' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
              >
                الكل
              </button>
              {availableMonths.map(m => (
                <button
                  key={m}
                  onClick={() => setMonthFilter(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 border ${monthFilter === m ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          
          {canManageRolls && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center mt-3 sm:mt-0"
            >
              <Upload className="w-4 h-4" /> إضافة رول
            </button>
          )}
        </div>
      </div>

      {/* Upload/Edit Modal */}
      {canManageRolls && (isUploadModalOpen || editingRoll) && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-black text-navy-900 flex items-center gap-2">
                {editingRoll ? <Edit3 className="w-4 h-4 text-indigo-600" /> : <Upload className="w-4 h-4 text-indigo-600" />}
                {editingRoll ? 'تعديل بيانات الرول' : 'إضافة رول جديد'}
              </h3>
              <button 
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setEditingRoll(null);
                  setRollDate('');
                  setBaseType(baseTypeDefault);
                  setCircuitType(typeFahs);
                }} 
                className="text-slate-400 hover:text-rose-500 transition bg-white rounded-full p-1 border border-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500">تاريخ الرول</label>
                <input 
                  type="date"
                  value={rollDate}
                  onChange={e => setRollDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-navy-900"
                />
              </div>
              
              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <label className="text-xs font-bold text-slate-500">نوع الرول</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[baseTypeDefault, rollTypes[3] || 'حصر أحكام'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBaseType(type)}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all border flex-1 ${baseType === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 flex-1">
                  <label className="text-xs font-bold text-slate-500">الدائرة</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[typeFahs, typeMawdoo].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setCircuitType(type)}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all border flex-1 ${circuitType === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {!editingRoll && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500">اختر الملف (صورة أو PDF)</label>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={e => setSelectedFile(e.target.files[0])}
                    accept="image/*,.pdf"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-navy-900 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {selectedFile && (
                    <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                      <FileText className="w-3 h-3" /> تم تحديد: {selectedFile.name}
                    </p>
                  )}
                </div>
              )}
              
              <button
                onClick={editingRoll ? handleSaveEdit : handleUpload}
                disabled={isUploading || (!editingRoll && !selectedFile)}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
              >
                {isUploading ? <span className="animate-spin text-lg">⏳</span> : (editingRoll ? <Edit3 className="w-4 h-4" /> : <Upload className="w-4 h-4" />)}
                {isUploading ? 'جاري الحفظ...' : (editingRoll ? 'حفظ التعديلات' : 'حفظ الرول')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rolls List Grouped by Month */}
      <div className="space-y-8 animate-fade-in">
        {sortedMonthKeys.map(monthKey => (
          <div key={monthKey} className="space-y-4">
            {/* Month Header / Divider */}
            <div className="flex items-center gap-3 no-print">
              <h3 className="font-black text-xs sm:text-sm text-indigo-700 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-xl shrink-0 shadow-sm">
                {getFriendlyMonthName(monthKey)}
              </h3>
              <div className="h-[1px] bg-slate-200 w-full rounded"></div>
            </div>

            {/* Grid for this month's rolls */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {rollsByMonth[monthKey].map(roll => {
                const style = getRollStyle(roll.type);
                return (
                  <div key={roll.id} className={`rounded-2xl p-4 shadow-sm hover:shadow-md transition relative group flex flex-col items-center text-center overflow-hidden ${style.base}`}>
                    {/* Top color accent */}
                    <div className={`absolute top-0 inset-x-0 h-1.5 ${style.accent}`}></div>
                    
                    {canManageRolls && (
                      <div className="absolute top-3 right-3 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition z-10">
                        <button
                          onClick={() => {
                            const parts = roll.type.split(' - ');
                            setBaseType(parts[0] || baseTypeDefault);
                            setCircuitType(parts[1] || typeFahs);
                            setRollDate(roll.date);
                            setEditingRoll(roll);
                          }}
                          className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition shadow-sm"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(roll)}
                          className="bg-rose-50 text-rose-500 p-1.5 rounded-lg hover:bg-rose-500 hover:text-white transition shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 transition mt-2 ${style.iconBg} ${style.iconColor}`}>
                      {style.icon}
                    </div>
                    
                    <h4 className={`font-black text-xs sm:text-sm mb-1 ${style.textColor}`}>{roll.type}</h4>
                    <p className={`text-sm sm:text-xl font-black flex items-center justify-center gap-1.5 tracking-tight ${style.textColor}`}>
                       {roll.date}
                    </p>
                    
                    <button
                      onClick={() => {
                        setViewingRoll(roll);
                        setRotation(0);
                      }}
                      className={`mt-4 w-full font-bold py-2.5 rounded-xl text-xs transition ${style.btnBg}`}
                    >
                      استعراض الرول
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {filteredRolls.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">لا توجد رولات مطابقة للبحث</p>
          </div>
        )}
      </div>

      {/* Viewer Modal */}
      {viewingRoll && (
        <div className="fixed inset-0 bg-navy-900/95 backdrop-blur-md z-50 flex flex-col p-2 sm:p-4 animate-in fade-in duration-200">
          
          {/* Top Header & Tabs */}
          <div className="bg-white rounded-t-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-slate-200">
            <div className="flex items-center justify-between sm:justify-start gap-4 mb-3 sm:mb-0">
              <div className="font-black text-navy-900 text-sm md:text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                {viewingRoll.type} - {viewingRoll.date}
              </div>
              <button onClick={() => setViewingRoll(null)} className="sm:hidden p-2 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center gap-2 self-center sm:self-auto bg-slate-100 p-1 rounded-xl">
              {activeViewerTab === 'pdf' && (
                <button 
                  onClick={() => setRotation(r => r + 90)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm ml-2"
                  title="تدوير الملف"
                >
                  <RotateCw className="w-3.5 h-3.5" /> تدوير
                </button>
              )}
              <button 
                onClick={() => setActiveViewerTab('pdf')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeViewerTab === 'pdf' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-navy-900'}`}
              >
                ملف الرول
              </button>
              <button 
                onClick={() => setActiveViewerTab('cases')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${activeViewerTab === 'cases' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-navy-900'}`}
              >
                قضايا هذا اليوم
                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md text-[10px] ml-1">{userCasesForDate.length}</span>
              </button>
            </div>

            <button onClick={() => setViewingRoll(null)} className="hidden sm:flex p-2 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-600 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="bg-slate-200 flex-1 rounded-b-2xl overflow-hidden relative shadow-inner">
            
            {activeViewerTab === 'cases' && (
              <div className="h-full bg-slate-50 p-4 sm:p-6 overflow-y-auto w-full max-w-3xl mx-auto">
                <h3 className="font-black text-navy-900 mb-4 text-center text-lg">كشاف القضايا المجدولة لك في {viewingRoll.date}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userCasesForDate.length > 0 ? (
                    userCasesForDate.map(c => {
                      const caseNo = getFieldValue(c, ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']);
                      const year = getFieldValue(c, ['السنة', 'سنة', 'year']);
                      return (
                        <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition">
                          <div className="font-black text-base text-navy-900 mb-2">دعوى {caseNo} لسنة {year}</div>
                          <div className="text-xs font-bold text-slate-600 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            {getFieldValue(c, ['المدعي', 'الطاعن'])}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                      <p className="text-sm font-bold text-slate-400">لا توجد قضايا مجدولة لك في هذا التاريخ.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeViewerTab === 'pdf' && (
              <div className="w-full h-full relative flex items-center justify-center">
                <div 
                  style={{ 
                    transform: `rotate(${rotation}deg)`, 
                    width: rotation % 180 !== 0 ? '100vh' : '100%', 
                    height: rotation % 180 !== 0 ? '100vw' : '100%',
                    transition: 'transform 0.3s ease-in-out'
                  }} 
                  className="absolute flex items-center justify-center"
                >
                  {viewingRoll.url.toLowerCase().endsWith('.pdf') ? (
                    <iframe 
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingRoll.url)}&embedded=true`} 
                      className="w-full h-full border-0 absolute inset-0"
                      title="Roll Viewer"
                    />
                  ) : (
                    <div className="w-full h-full absolute inset-0 flex items-center justify-center p-4 overflow-auto bg-slate-100/50">
                      <img src={viewingRoll.url} alt="Roll" className="max-w-full max-h-full object-contain rounded-xl shadow-sm" />
                    </div>
                  )}
                </div>
                <a 
                  href={viewingRoll.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="absolute bottom-6 right-6 z-10 bg-navy-900 text-white px-5 py-3 rounded-2xl text-sm font-black shadow-2xl hover:bg-navy-800 flex items-center gap-2 hover:-translate-y-1 transition-all border border-slate-700"
                >
                  <ExternalLink className="w-5 h-5" /> فتح في نافذة مستقلة
                </a>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
