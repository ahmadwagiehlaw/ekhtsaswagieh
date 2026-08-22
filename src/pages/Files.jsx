import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, FolderClosed, Plus, Clock, FileText, Upload, Download, Loader2, Info, Building2, Gavel, FileBox, X, CalendarDays, Printer, CheckSquare, Square, ClipboardList, AlertTriangle, Sparkles, MapPin, User, Users, BookOpen, Files as FilesIcon, ArrowUpDown, SlidersHorizontal, Edit3, Trash2, Pin, PinOff, Eye, Camera, LayoutGrid, List, Sidebar } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import ExportPDFModal from '../components/ExportPDFModal';
import BulkAssignTaskModal from '../components/BulkAssignTaskModal';
import BulkViewingTaskModal from '../components/BulkViewingTaskModal';
import BulkEditCasesModal from '../components/BulkEditCasesModal';
import GlobalTemplatePrintModal from '../components/GlobalTemplatePrintModal';
import { formatDateString, getSafeDateObj } from '../utils/dateUtils';
import useCasesFilter from '../hooks/useCasesFilter';
import useCasesSort from '../hooks/useCasesSort';
import { printViewingTasksList } from '../utils/printViewingTasks';
import CaseDetails from './CaseDetails';

import useSessionState from '../hooks/useSessionState';
import useDebounce from '../hooks/useDebounce';

export default function Files() {
  const { cases, schema, settings, deleteCaseFromFirebase, saveCaseToFirebase, globalHideNoInterest, setGlobalHideNoInterest, globalTasks, viewingTasks } = useAppContext();
  const { toast, showConfirm } = useUI();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useSessionState('files_searchQuery', '');
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [roleFilter, setRoleFilter] = useSessionState('files_roleFilter', 'all');
  const [currentPage, setCurrentPage] = useSessionState('files_currentPage', 1);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBulkViewingOpen, setIsBulkViewingOpen] = useState(false);
  const [singleViewingCaseId, setSingleViewingCaseId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState([]);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [activeShoba, setActiveShoba] = useSessionState('files_activeShoba', 'متداول'); // 'all', 'متداول', 'حفظ'
  const [quickLocationEditId, setQuickLocationEditId] = useState(null);

  // Advanced Search Params
  const [advancedParams, setAdvancedParams] = useSessionState('files_advancedParams', null);

  // Quick Filters
  const [showOngoingOnly, setShowOngoingOnly] = useSessionState('files_showOngoingOnly', false);
  const [showWithAttachmentsOnly, setShowWithAttachmentsOnly] = useSessionState('files_showWithAttachmentsOnly', false);
  const [showImportantOnly, setShowImportantOnly] = useSessionState('files_showImportantOnly', false);
  const [showSessionlessOnly, setShowSessionlessOnly] = useSessionState('files_showSessionlessOnly', false);
  const [showPastSessionsOnly, setShowPastSessionsOnly] = useSessionState('files_showPastSessionsOnly', false);
  const [showMissingRoleOnly, setShowMissingRoleOnly] = useSessionState('files_showMissingRoleOnly', false);
  const [showJudgmentsOnly, setShowJudgmentsOnly] = useSessionState('files_showJudgmentsOnly', false);
  
  // New Brainstormed Filters
  const [locationFilter, setLocationFilter] = useSessionState('files_locationFilter', 'all'); // 'all', 'missing', 'temp', or specific location
  const [sessionTypeFilter, setSessionTypeFilter] = useSessionState('files_sessionTypeFilter', 'all'); // 'all', 'judgment', 'pleading', 'commissioners', 'review'
  const [decisionFilter, setDecisionFilter] = useSessionState('files_decisionFilter', '');
  const [quickDateFilter, setQuickDateFilter] = useSessionState('files_quickDateFilter', '');
  const [isDateSearchOpen, setIsDateSearchOpen] = useSessionState('files_isDateSearchOpen', false);
  const [isSelectionReportModalOpen, setIsSelectionReportModalOpen] = useState(false);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);

  // Sorting and collapsible states
  const [sortBy, setSortBy] = useSessionState('files_sortBy', 'none');
  const [isSortPanelOpen, setIsSortPanelOpen] = useSessionState('files_isSortPanelOpen', false);
  const [isPinned, setIsPinned] = useState(false);

  // New UX States
  const [viewMode, setViewMode] = useSessionState('files_viewMode', 'gallery'); // 'gallery' | 'list' | 'compact'
  const [quickPeekId, setQuickPeekId] = useState(null);

  // Ref for the main search input (used by "/" keyboard shortcut)
  const searchInputRef = useRef(null);

  // Load pinned filters from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pinnedFilters');
      if (saved) {
        const pinned = JSON.parse(saved);
        setIsPinned(true);
        setRoleFilter(pinned.roleFilter ?? 'all');
        setShowOngoingOnly(pinned.showOngoingOnly ?? false);
        setShowWithAttachmentsOnly(pinned.showWithAttachmentsOnly ?? false);
        setShowImportantOnly(pinned.showImportantOnly ?? false);
        setShowSessionlessOnly(pinned.showSessionlessOnly ?? false);
        setShowPastSessionsOnly(pinned.showPastSessionsOnly ?? false);
        setShowPastSessionsOnly(pinned.showPastSessionsOnly ?? false);
        setShowMissingRoleOnly(pinned.showMissingRoleOnly ?? false);
        setShowJudgmentsOnly(pinned.showJudgmentsOnly ?? false);
        setLocationFilter(pinned.locationFilter ?? 'all');
        setSessionTypeFilter(pinned.sessionTypeFilter ?? 'all');
        setDecisionFilter(pinned.decisionFilter ?? '');
        setQuickDateFilter(pinned.quickDateFilter ?? '');
        setSortBy(pinned.sortBy ?? 'none');
      }
    } catch (e) { }
  }, []);

  const handlePinFilters = () => {
    if (isPinned) {
      localStorage.removeItem('pinnedFilters');
      setIsPinned(false);
    } else {
      const toSave = {
        roleFilter, showOngoingOnly, showWithAttachmentsOnly,
        showImportantOnly, showSessionlessOnly, showPastSessionsOnly,
        showMissingRoleOnly,
        showJudgmentsOnly,
        locationFilter,
        sessionTypeFilter,
        decisionFilter,
        quickDateFilter, sortBy
      };
      localStorage.setItem('pinnedFilters', JSON.stringify(toSave));
      setIsPinned(true);
    }
  };


  // "/" keyboard shortcut — focus & select-all on the search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== '/') return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isEditable = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
      if (isEditable) return;
      e.preventDefault();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const itemsPerPage = 20;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const role = params.get('role');

    if (role && (role === 'appellant' || role === 'appellee' || role === 'all')) {
      setRoleFilter(role);
    }

    // Check if it's an advanced search
    if (params.get('caseNo') || params.get('year') || params.get('opponentName') || params.get('decision') || params.get('sessionDateStart') || params.get('court') || params.get('location') || params.get('requiredTask') || params.get('requiredTaskType')) {
      const adv = {};
      for (const [key, value] of params.entries()) {
        if (key !== 'q' && key !== 'role') adv[key] = value;
      }
      setAdvancedParams(adv);
      setSearchQuery(''); // Clear general search if advanced is used
    } else if (q) {
      setSearchQuery(q);
      setAdvancedParams(null);
    } else {
      setSearchQuery('');
      setAdvancedParams(null);
    }
  }, [location.search]);

  const { uniqueLocations, uniqueDates, filteredCases } = useCasesFilter({
    cases,
    settings,
    globalTasks,
    activeShoba,
    roleFilter,
    showSessionlessOnly,
    showJudgmentsOnly,
    showImportantOnly,
    showPastSessionsOnly,
    showOngoingOnly,
    showWithAttachmentsOnly,
    showMissingRoleOnly,
    locationFilter,
    sessionTypeFilter,
    decisionFilter,
    quickDateFilter,
    advancedParams,
    debouncedSearchQuery
  });

  const getPrimaryValue = (cObj, possibleKeys) => {
    for (let k of possibleKeys) {
      if (cObj[k] !== undefined && cObj[k] !== null) return cObj[k];
    }
    return '';
  };

  const { sortedCases } = useCasesSort({
    filteredCases,
    sortBy,
    quickDateFilter
  });

  const totalPages = Math.ceil(sortedCases.length / itemsPerPage);
  const currentCases = sortedCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAdvancedSearch = (params) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val) query.set(key, val);
    });
    navigate(`/files?${query.toString()}`);
  };

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    if (selectedCaseIds.includes(id)) {
      setSelectedCaseIds(selectedCaseIds.filter(i => i !== id));
    } else {
      setSelectedCaseIds([...selectedCaseIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCaseIds.length === currentCases.length && currentCases.length > 0) {
      setSelectedCaseIds([]);
    } else {
      setSelectedCaseIds(currentCases.map(c => c.id));
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in">

      {/* Tab bar for Shoba Filtering */}
      <div className="bg-slate-100 p-1 rounded-2xl flex items-center justify-between mb-4">
        <button
          onClick={() => setActiveShoba('متداول')}
          className={`flex-1 py-2 text-sm font-black rounded-xl transition ${activeShoba === 'متداول' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-white/50'}`}
        >
          المتداول
        </button>
        <button
          onClick={() => setActiveShoba('تحت_التحديد')}
          className={`flex-1 py-2 text-sm font-black rounded-xl transition ${activeShoba === 'تحت_التحديد' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-white/50'}`}
        >
          شعبة تحت التحديد
        </button>
        <button
          onClick={() => setActiveShoba('حفظ')}
          className={`flex-1 py-2 text-sm font-black rounded-xl transition ${activeShoba === 'حفظ' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-white/50'}`}
        >
          شعبة الحفظ
        </button>
        <button
          onClick={() => setActiveShoba('all')}
          className={`flex-1 py-2 text-sm font-black rounded-xl transition ${activeShoba === 'all' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:bg-white/50'}`}
        >
          الكل
        </button>
      </div>

      {/* Filter & Actions Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm sticky top-[76px] z-30 no-print flex flex-col gap-3">

        <div className="flex flex-col-reverse sm:flex-row gap-3 items-center justify-between w-full">
          {/* Filters, Sorting, View Modes & Actions on the right (RTL start) */}
          <div className="flex gap-2 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap justify-start">
            
            {/* Select All Toggle */}
            <button
              onClick={() => {
                if (selectedCaseIds.length === filteredCases.length && filteredCases.length > 0) {
                  setSelectedCaseIds([]);
                } else {
                  setSelectedCaseIds(filteredCases.map(c => c.id));
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border shrink-0 ${
                selectedCaseIds.length > 0 && selectedCaseIds.length === filteredCases.length
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title={selectedCaseIds.length === filteredCases.length && filteredCases.length > 0 ? "إلغاء تحديد الكل" : "تحديد الكل (المطابق للبحث)"}
            >
              {selectedCaseIds.length === filteredCases.length && filteredCases.length > 0 ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">تحديد الكل</span>
            </button>

            {/* View Modes Toggle */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-sm">
              <button
                onClick={() => setViewMode('gallery')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'gallery' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="وضع المعرض (البطاقات الكبيرة)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="وضع القائمة (للجرد السريع)"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'compact' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="وضع البطاقات المصغرة"
              >
                <FileBox className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Toggle Button */}
            <button
              onClick={() => {
                setIsSortPanelOpen(!isSortPanelOpen);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${isSortPanelOpen || sortBy !== 'none'
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              title="ترتيب المعروض"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">الترتيب</span>
              {sortBy !== 'none' && (
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              )}
            </button>

            {/* Print & Export Actions (Dropdown) */}
            <div className="relative">
              <button
                onClick={() => setIsPrintMenuOpen(!isPrintMenuOpen)}
                className="bg-navy-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-navy-800 transition shadow-sm border border-navy-950"
                title="خيارات الطباعة"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">طباعة</span>
              </button>
              
              {isPrintMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsPrintMenuOpen(false)}></div>
                  <div className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1 animate-in fade-in slide-in-from-top-2">
                    <button
                      onClick={() => {
                        setIsPrintMenuOpen(false);
                        const casesToPrint = selectedCaseIds.length > 0 ? cases.filter(c => selectedCaseIds.includes(c.id)) : filteredCases;
                        const vTasks = viewingTasks?.filter(t => t.status !== 'completed' && t.linkedCases?.some(id => casesToPrint.find(c => c.id === id)));
                        if(!vTasks || vTasks.length === 0) { toast('لا توجد مهام إطلاع معلقة للملفات المحددة', 'error'); return; }
                        printViewingTasksList(vTasks, cases, settings);
                      }}
                      className="w-full text-right px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <Camera className="w-4 h-4" /> طباعة مهام الإطلاع
                    </button>
                    <button
                      onClick={() => {
                        setIsPrintMenuOpen(false);
                        setIsExportModalOpen(true);
                      }}
                      className="w-full text-right px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <FileText className="w-4 h-4" /> تصدير القائمة (PDF)
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* Search on the left (RTL end) */}
          <div className="flex gap-2 w-full sm:w-auto flex-1 sm:max-w-md justify-end">
            {isDateSearchOpen || quickDateFilter ? (
              <div className="relative w-full sm:max-w-[150px] flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-xl px-1">
                <input
                  type="date"
                  title="تاريخ الجلسة"
                  value={quickDateFilter}
                  onChange={(e) => setQuickDateFilter(e.target.value)}
                  className="w-full bg-transparent py-2 px-1 text-xs font-bold text-navy-900 focus:outline-none"
                />
                <button
                  onClick={() => {
                    setQuickDateFilter('');
                    setIsDateSearchOpen(false);
                  }}
                  className="text-slate-400 hover:text-rose-500 transition p-1"
                  title="إلغاء بحث التاريخ"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsDateSearchOpen(true)}
                className="p-2 rounded-xl transition border bg-slate-50 border-slate-300 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                title="البحث بالتاريخ"
              >
                <CalendarDays className="w-5 h-5" />
              </button>
            )}
            <div className="relative w-full sm:flex-1 max-w-xs">
              <input
                ref={searchInputRef}
                id="search-cases-input"
                type="text"
                placeholder="بحث في القضايا... (اضغط / للبحث)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-28 pr-10 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />

              <button
                type="button"
                onClick={() => setIsAdvancedSearchOpen(!isAdvancedSearchOpen)}
                className={`absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded transition ${isAdvancedSearchOpen || (roleFilter !== 'all' || locationFilter !== 'all' || sessionTypeFilter !== 'all' || decisionFilter || quickDateFilter || showOngoingOnly || showImportantOnly || showJudgmentsOnly || showWithAttachmentsOnly || showSessionlessOnly || showMissingRoleOnly || showPastSessionsOnly) ? 'bg-indigo-500 text-white shadow-sm' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}
                title="البحث المتقدم"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>

              <span className="absolute left-9 top-1/2 -translate-y-1/2 bg-indigo-100/80 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded font-black border border-indigo-200 pointer-events-none select-none">
                {filteredCases.length} ملف
              </span>

              {searchQuery || advancedParams ? (
                <button onClick={() => { setSearchQuery(''); setAdvancedParams(null); setQuickDateFilter(''); navigate('/files'); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>
        </div>

        {/* Advanced Search Dropdown Panel */}
        {isAdvancedSearchOpen && (
          <div className="bg-slate-50 border-t border-slate-100 pt-4 pb-4 animate-in slide-in-from-top-2 duration-200 rounded-b-2xl mt-3 mx-[-12px] px-3 sm:mx-[-16px] sm:px-4">
            
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-sm font-black text-navy-900 flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-500" /> الفلاتر المتقدمة
              </h3>
              {(roleFilter !== 'all' || showOngoingOnly || showPastSessionsOnly || showWithAttachmentsOnly || showImportantOnly || showSessionlessOnly || showJudgmentsOnly || globalHideNoInterest !== 0 || quickDateFilter || locationFilter !== 'all' || sessionTypeFilter !== 'all' || decisionFilter) && (
                <button
                  onClick={() => {
                    setRoleFilter('all');
                    setShowOngoingOnly(false);
                    setShowPastSessionsOnly(false);
                    setShowWithAttachmentsOnly(false);
                    setShowImportantOnly(false);
                    setShowSessionlessOnly(false);
                    setShowMissingRoleOnly(false);
                    setShowJudgmentsOnly(false);
                    setLocationFilter('all');
                    setSessionTypeFilter('all');
                    setDecisionFilter('');
                    setQuickDateFilter('');
                    setGlobalHideNoInterest(0);
                    if (isPinned) {
                      const toSave = {
                        roleFilter: 'all', showOngoingOnly: false, showWithAttachmentsOnly: false,
                        showImportantOnly: false, showSessionlessOnly: false, showPastSessionsOnly: false,
                        showMissingRoleOnly: false, showJudgmentsOnly: false, locationFilter: 'all', sessionTypeFilter: 'all', decisionFilter: '',
                        quickDateFilter: '', sortBy
                      };
                      localStorage.setItem('pinnedFilters', JSON.stringify(toSave));
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-black text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition"
                >
                  مسح الفلاتر
                </button>
              )}
            </div>

            {/* Grid 5 dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500">تاريخ الجلسة</label>
                <select
                  value={quickDateFilter}
                  onChange={(e) => setQuickDateFilter(e.target.value)}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold border outline-none ${quickDateFilter ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-400'}`}
                >
                  <option value="">الكل</option>
                  {uniqueDates.map(dateStr => (
                    <option key={dateStr} value={dateStr}>{dateStr}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500">مكان الملف</label>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold border outline-none ${locationFilter !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-400'}`}
                >
                  <option value="all">الكل</option>
                  <option value="missing">مقيدة (غير موجود)</option>
                  <option value="temp">ملف مؤقت</option>
                  {uniqueLocations.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500">نوع الجلسة</label>
                <select
                  value={sessionTypeFilter}
                  onChange={(e) => setSessionTypeFilter(e.target.value)}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold border outline-none ${sessionTypeFilter !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-400'}`}
                >
                  <option value="all">الكل</option>
                  <option value="judgment">للحكم</option>
                  {settings?.sessionTypes?.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500">القرار / المنطوق</label>
                <input
                  type="text"
                  placeholder="كلمات مفتاحية..."
                  value={decisionFilter}
                  onChange={(e) => setDecisionFilter(e.target.value)}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold border outline-none ${decisionFilter ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'}`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500">الصفة</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={`w-full p-2.5 rounded-xl text-xs font-bold border outline-none ${roleFilter !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-700 focus:border-indigo-400'}`}
                >
                  <option value="all">الكل</option>
                  <option value="appellant">{settings?.roles?.[0] || 'الطاعن'}</option>
                  <option value="appellee">{settings?.roles?.[1] || 'المطعون ضدنا'}</option>
                  <option value="none">بدون صفة</option>
                </select>
              </div>
              
            </div>

            {/* Quick Filter Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowOngoingOnly(!showOngoingOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${showOngoingOnly ? 'bg-indigo-500 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                متداول
              </button>
              <button
                onClick={() => setShowJudgmentsOnly(!showJudgmentsOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${showJudgmentsOnly ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                سجل الأحكام
              </button>
              <button
                onClick={() => setShowImportantOnly(!showImportantOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border flex items-center gap-1.5 ${showImportantOnly ? 'bg-rose-500 text-white border-rose-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <Sparkles className="w-3.5 h-3.5" /> هامة
              </button>
              <button
                onClick={() => setShowWithAttachmentsOnly(!showWithAttachmentsOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border flex items-center gap-1.5 ${showWithAttachmentsOnly ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <FileBox className="w-3.5 h-3.5" /> بمرفقات
              </button>
              <button
                onClick={() => setShowSessionlessOnly(!showSessionlessOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${showSessionlessOnly ? 'bg-slate-700 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                بدون جلسة
              </button>
              <button
                onClick={() => setShowPastSessionsOnly(!showPastSessionsOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border flex items-center gap-1.5 ${showPastSessionsOnly ? 'bg-indigo-500 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <CalendarDays className="w-3.5 h-3.5" /> جلسات سابقة
              </button>
              <button
                onClick={() => setShowMissingRoleOnly(!showMissingRoleOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border flex items-center gap-1.5 ${showMissingRoleOnly ? 'bg-rose-500 text-white border-rose-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> مجهولة الصفة
              </button>
              
              <div className="flex-1"></div>
              
              <button
                onClick={() => {
                  const nextState = globalHideNoInterest === 2 ? 0 : globalHideNoInterest + 1;
                  setGlobalHideNoInterest(nextState);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border flex items-center gap-1.5 ${globalHideNoInterest > 0 ? 'bg-slate-700 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                {globalHideNoInterest === 0 ? <Eye className="w-3.5 h-3.5 text-indigo-500" /> : <PinOff className="w-3.5 h-3.5" />}
                <span>{globalHideNoInterest === 0 ? 'إظهار (لا شأن)' : globalHideNoInterest === 1 ? 'مخفي (لا شأن)' : 'مخفي (لا شأن والاختصاص)'}</span>
              </button>
            </div>

          </div>
        )}

        {/* Collapsible Sort Panel */}
        {isSortPanelOpen && (
          <div className="border-t border-slate-100 pt-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black text-slate-500">ترتيب القضايا حسب:</h4>
              {sortBy !== 'none' && (
                <button
                  onClick={() => setSortBy('none')}
                  className="text-[10px] font-black text-rose-500 hover:text-rose-600 transition"
                >
                  إلغاء الترتيب
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSortBy(prev => prev === 'appellant_asc' ? 'appellant_desc' : 'appellant_asc')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${sortBy.startsWith('appellant') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>أبجدي (اسم الطاعن) {sortBy === 'appellant_asc' ? '▲' : sortBy === 'appellant_desc' ? '▼' : ''}</span>
              </button>

              <button
                onClick={() => setSortBy(prev => prev === 'number_asc' ? 'number_desc' : 'number_asc')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${sortBy.startsWith('number') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>رقم الدعوى {sortBy === 'number_asc' ? '▲' : sortBy === 'number_desc' ? '▼' : ''}</span>
              </button>

              <button
                onClick={() => setSortBy(prev => prev === 'year_desc' ? 'year_asc' : 'year_desc')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${sortBy.startsWith('year') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>سنة الدعوى {sortBy === 'year_desc' ? '▼ الأحدث' : sortBy === 'year_asc' ? '▲ الأقدم' : ''}</span>
              </button>

              <button
                onClick={() => setSortBy(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${sortBy.startsWith('date') ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>تاريخ الجلسة {sortBy === 'date_desc' ? '▼ الأحدث' : sortBy === 'date_asc' ? '▲ الأقدم' : ''}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List / Grid of Cases */}
      <div className={`pt-2 ${
        viewMode === 'gallery' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6' :
        viewMode === 'compact' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3' :
        'flex flex-col gap-2'
      }`}>
        {currentCases.map(c => {
          const caseNum = getPrimaryValue(c, ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']);
          const year = getPrimaryValue(c, ['السنة', 'سنة', 'year']);
          const appellant = getPrimaryValue(c, ['المدعي', 'الطاعن', 'المستأنف']);
          const appellee = getPrimaryValue(c, ['المدعى_عليه', 'المدعى عليه', 'المطعون ضده', 'المطعون']);
          const lastSession = getPrimaryValue(c, ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة']);
          const formattedLastSession = lastSession ? formatDateString(lastSession) : '';
          const decision = getPrimaryValue(c, ['القرار', 'قرار الجلسة', 'المنطوق']);
          const sessionRoll = getPrimaryValue(c, ['الرول', 'رول الجلسة', 'رقم الرول']);
          const fileLocation = getPrimaryValue(c, ['مكان الملف']);

          const role = String(c['الصفة'] || c['صفة'] || '').trim();
          const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
          const isAppellee = role.includes('مطعون ضده') || role.includes('مطعون ضدنا') || role.includes('مستأنف ضده') || role.includes('مدعى عليه') || role.includes('مدعى علينا');
          const isNoInterest = role === 'لا شأن';
          const isOutOfJurisdiction = role === 'خارج الاختصاص';

          const joinedCasesStr = getPrimaryValue(c, ['دعاوى منضمة']);
          const hasJoinedCases = joinedCasesStr && joinedCasesStr.trim() !== '';

          const coverImageDoc = (c.documents || []).find(doc => doc.type === 'غلاف الملف' && doc.fileType === 'image');
          const coverImageUrl = coverImageDoc ? coverImageDoc.url : null;

          const isJudgment = String(decision).includes('حكم') || String(decision).includes('للحكم');

          // Card Color Logic based on role
          let roleColor = 'amber';
          let bgClass = `bg-white hover:bg-amber-50/30`;
          let borderClass = `border-amber-100 hover:border-amber-300`;
          let textClass = `text-amber-700`;
          let badgeBgClass = `bg-amber-50 text-amber-700 border-amber-200`;
          let cardOpacity = '';
          let grayscale = '';

          if (isAppellant) {
            roleColor = 'rose';
            bgClass = `bg-white hover:bg-rose-50/30`;
            borderClass = `border-rose-100 hover:border-rose-300`;
            textClass = `text-rose-700`;
            badgeBgClass = `bg-rose-50 text-rose-700 border-rose-200`;
          } else if (isAppellee) {
            roleColor = 'emerald';
            bgClass = `bg-white hover:bg-emerald-50/30`;
            borderClass = `border-emerald-100 hover:border-emerald-300`;
            textClass = `text-emerald-700`;
            badgeBgClass = `bg-emerald-50 text-emerald-700 border-emerald-200`;
          } else if (isOutOfJurisdiction) {
            roleColor = 'indigo';
            bgClass = `bg-indigo-50/10 hover:bg-indigo-50/30`;
            borderClass = `border-indigo-100 hover:border-indigo-300`;
            textClass = `text-indigo-700`;
            badgeBgClass = `bg-indigo-50 text-indigo-700 border-indigo-200`;
          } else if (isNoInterest) {
            roleColor = 'slate';
            bgClass = `bg-slate-50/50 hover:bg-slate-50`;
            borderClass = `border-slate-200 hover:border-slate-300`;
            textClass = `text-slate-500`;
            badgeBgClass = `bg-slate-100 text-slate-500 border-slate-300`;
            cardOpacity = 'opacity-60 hover:opacity-100';
            grayscale = 'grayscale';
          }

          const activeAlerts = (c.alerts || []).filter(a => !a.isDone);
          const hasUrgentAlert = activeAlerts.some(a => {
            const diffDays = Math.ceil((getSafeDateObj(a.date) - new Date()) / (1000 * 60 * 60 * 24));
            return diffDays <= 3;
          });

          const latestJudgmentSession = (c.sessions || [])
            .filter(s => s.hasJudgment && s.judgment)
            .sort((a, b) => getSafeDateObj(b.date) - getSafeDateObj(a.date))[0];
          const finalStampData = latestJudgmentSession ? latestJudgmentSession.judgment : null;
          let stampColor = 'indigo';
          if (finalStampData) {
            const res = finalStampData.result || '';
            // Determine stamp color based on result and role classification
            if (res.includes('ضد') || res.includes('إجرائي خطير') || (isAppellant && (res.includes('وقف جزائي') || res.includes('اعتبار')))) {
              stampColor = 'rose';
            } else if (res.includes('صالح') || (isAppellee && (res.includes('وقف جزائي') || res.includes('اعتبار')))) {
              stampColor = 'emerald';
            } else if (res.includes('مختلط')) {
              stampColor = 'amber';
            } else if (res.includes('لا شأن') || isNoInterest) {
              stampColor = 'slate';
            }
          }

          const isMissing = fileLocation === 'غير موجود';
          const isTemp = fileLocation === 'مؤقت';
          const isOut = fileLocation === 'خارج الاختصاص';

          let locationRibbon = null;
          if (!isNoInterest && fileLocation && fileLocation !== 'في المكتب') {
            if (isMissing) {
              locationRibbon = { text: 'غير موجود', color: 'bg-rose-600', textColor: 'text-white' };
            } else if (isTemp) {
              locationRibbon = { text: 'مؤقت', color: 'bg-amber-500', textColor: 'text-white' };
            } else if (isOut) {
              locationRibbon = { text: 'خارج الاختصاص', color: 'bg-indigo-600', textColor: 'text-white' };
            } else {
              locationRibbon = { text: fileLocation, color: 'bg-slate-700', textColor: 'text-white' };
            }
          }

          const hasViewingTask = viewingTasks?.some(t => t.status !== 'completed' && t.linkedCases?.includes(c.id));

          if (viewMode === 'list') {
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/case/${c.id}`)}
                className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${bgClass} ${borderClass} ${cardOpacity} ${grayscale}`}
              >
                 {/* Left Side: Checkbox, Important badge, Num, Year, Role */}
                 <div className="flex items-center gap-3 w-full sm:w-1/3">
                   <div onClick={(e) => toggleSelection(e, c.id)} className="z-30 shrink-0">
                     {selectedCaseIds.includes(c.id) ? (
                       <CheckSquare className="w-5 h-5 text-emerald-600 bg-white rounded shadow-sm" />
                     ) : (
                       <Square className="w-5 h-5 text-slate-300 bg-white rounded shadow-sm opacity-50 group-hover:opacity-100 transition-opacity" />
                     )}
                   </div>
                   
                   <div className="flex flex-col gap-1 w-full">
                     <div className="flex items-center gap-2">
                       {c.isImportant && <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />}
                       <span className="font-black text-navy-900 text-sm sm:text-base">{caseNum || 'بدون رقم'}</span>
                       {year && <span className="text-xs font-bold text-slate-400">لسنة {year}</span>}
                     </div>
                     <span className={`text-[10px] font-black w-fit px-1.5 py-0.5 rounded ${badgeBgClass}`}>
                       {role || 'ملف دعوى'}
                     </span>
                   </div>
                 </div>

                 {/* Middle: Opponents */}
                 <div className="flex flex-col text-[10px] sm:text-xs w-full sm:w-1/3 border-r sm:border-r-0 sm:border-x border-slate-200 px-3 py-1">
                   <div className="flex gap-1"><span className="text-emerald-600 font-bold shrink-0">الطاعن:</span><span className="font-black truncate">{appellant || '---'}</span></div>
                   <div className="flex gap-1"><span className="text-rose-500 font-bold shrink-0">ضد:</span><span className="font-bold truncate">{appellee || '---'}</span></div>
                 </div>

                 {/* Right: Date & Decision & Actions */}
                 <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-1/3">
                    <div className="flex flex-col gap-1 items-start sm:items-end w-full">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span dir="ltr">{formattedLastSession || 'لم تحدد'}</span>
                        {sessionRoll && <span className="text-[10px] bg-slate-100 px-1 rounded border">رول {sessionRoll}</span>}
                      </div>
                      {decision && (
                        <div className={`text-[10px] font-black px-2 py-0.5 rounded border max-w-full truncate ${isJudgment ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                          {decision}
                        </div>
                      )}
                    </div>

                    {/* Quick Peek Button */}
                    <button
                       onClick={(e) => {
                         e.stopPropagation();
                         setQuickPeekId(c.id);
                       }}
                       className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors shrink-0 z-30"
                       title="نظرة سريعة"
                    >
                       <Eye className="w-4 h-4" />
                    </button>
                 </div>
                 
                 {/* Urgent Alert absolute */}
                 {hasUrgentAlert && <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-pulse m-2"></div>}
                 
                 {/* Has Viewing Task absolute */}
                 {hasViewingTask && <div className="absolute top-0 right-3 w-2 h-2 bg-indigo-500 rounded-full m-2" title="مهمة إطلاع معلقة"></div>}
              </div>
            )
          }

          if (viewMode === 'compact') {
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/case/${c.id}`)}
                className={`group relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${bgClass} ${borderClass} ${cardOpacity} ${grayscale}`}
              >
                 {/* Checkbox */}
                 <div className="absolute top-3 left-3 z-30" onClick={(e) => toggleSelection(e, c.id)}>
                   {selectedCaseIds.includes(c.id) ? (
                     <CheckSquare className="w-5 h-5 text-emerald-600 bg-white rounded shadow-sm" />
                   ) : (
                     <Square className="w-5 h-5 text-slate-300 bg-white rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                   )}
                 </div>
                 
                 {hasUrgentAlert && <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>}

                 {/* Header */}
                 <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-black text-base text-navy-900 flex items-center gap-1.5">
                        {c.isImportant && <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        {caseNum || 'بدون رقم'}
                        {year && <span className="text-[10px] text-slate-400">لسنة {year}</span>}
                      </h3>
                      <span className={`inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded ${badgeBgClass}`}>{role || 'ملف دعوى'}</span>
                    </div>
                    <button
                       onClick={(e) => { e.stopPropagation(); setQuickLocationEditId(c.id); }}
                       className={`w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition mt-1 mr-4`}
                       title={`مكان الملف: ${fileLocation || 'لم يحدد'} (انقر للتغيير)`}
                     >
                       <MapPin className="w-3 h-3" />
                     </button>
                 </div>

                 {/* Opponents */}
                 <div className="flex flex-col gap-1 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3">
                   <div className="flex gap-1"><span className="text-emerald-600 font-bold shrink-0">الطاعن:</span><span className="font-black truncate">{appellant || '---'}</span></div>
                   <div className="flex gap-1"><span className="text-rose-500 font-bold shrink-0">ضد:</span><span className="font-bold truncate">{appellee || '---'}</span></div>
                 </div>

                 {/* Footer */}
                 <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1 font-bold text-slate-600">
                       <CalendarDays className="w-3 h-3" />
                       <span dir="ltr">{formattedLastSession || 'لم تحدد'}</span>
                    </div>
                    {decision && <span className={`truncate max-w-[120px] font-black ${isJudgment ? 'text-rose-600' : 'text-slate-600'}`}>{decision}</span>}
                 </div>
              </div>
            )
          }

          return (
            <div
              key={c.id}
              onClick={() => navigate(`/case/${c.id}`)}
              className="group relative cursor-pointer pt-4"
            >
              {/* Checkbox */}
              <div
                className="absolute top-1 left-2 z-30"
                onClick={(e) => toggleSelection(e, c.id)}
              >
                {selectedCaseIds.includes(c.id) ? (
                  <CheckSquare className="w-6 h-6 text-emerald-600 bg-white rounded-md shadow-sm" />
                ) : (
                  <Square className="w-6 h-6 text-slate-300 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>

              {/* Alert Badge */}
              {hasUrgentAlert && (
                <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm animate-pulse z-30 flex items-center gap-1 border-2 border-white">
                  <AlertTriangle className="w-3 h-3" /> هام
                </div>
              )}

              {/* Viewing Task Button / Badge */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasViewingTask) {
                    toast('هناك مهمة إطلاع مسجلة بالفعل. لا يمكنك إضافة مهمة جديدة إلا بعد حذف أو إنجاز المهمة الحالية.', 'error');
                  } else {
                    setSingleViewingCaseId(c.id);
                  }
                }}
                className={`absolute top-1/2 -right-2.5 -translate-y-1/2 p-1.5 rounded-full shadow-sm z-30 flex items-center justify-center border-2 border-white transition-all duration-300 ${hasViewingTask ? 'bg-indigo-600 text-white opacity-100' : 'bg-slate-100 text-slate-500 hover:bg-indigo-500 hover:text-white opacity-0 group-hover:opacity-100 hover:scale-110'}`}
                title={hasViewingTask ? "مهمة إطلاع معلقة (انقر للتنبيه)" : "إنشاء مهمة إطلاع جديدة"}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>

              {/* Card Body */}
              <div className={`relative ${bgClass} border ${borderClass} rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 z-20 h-full flex flex-col group-hover:-translate-y-1 overflow-hidden ${cardOpacity} ${grayscale}`}>

                {/* Judgment Ribbon (Top Left physically) */}
                {finalStampData && !isNoInterest && (
                  <div className={`absolute top-4 -left-8 w-32 -rotate-45 text-center py-1.5 shadow-md z-40 bg-${stampColor}-600 text-white`}>
                    <div className="text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 mt-0.5">{finalStampData.type || 'حكم'}</div>
                  </div>
                )}

                {/* File Location Ribbon (Top Right physically) */}
                {locationRibbon && (
                  <div className={`absolute top-4 -right-8 w-32 rotate-45 text-center py-1.5 text-[10px] font-black shadow-md z-40 ${locationRibbon.color} ${locationRibbon.textColor}`}>
                    {locationRibbon.text}
                  </div>
                )}

                {/* Top Accent Line */}
                <div className={`absolute top-0 left-0 w-full h-1 z-10 bg-gradient-to-r from-${roleColor}-400 to-${roleColor}-500`}></div>

                {/* Cover Area (Image or Beautiful CSS Fallback) */}
                <div className="mb-4 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 aspect-[3/4] relative border-b border-slate-100 shrink-0 overflow-hidden flex flex-col items-center justify-center bg-slate-50">
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="غلاف الملف" className="w-full h-full object-cover absolute inset-0 z-0" />
                  ) : (
                    <>
                      <div className={`absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200 z-0`}></div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 z-0"></div>
                      <div className={`absolute bottom-0 left-0 w-40 h-40 bg-${roleColor}-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 z-0`}></div>

                      <div className={`w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3 text-${roleColor}-500 ring-1 ring-black/5 z-10`}>
                        <Gavel className="w-7 h-7 opacity-80" />
                      </div>

                      <div className="text-center px-4 z-10">
                        <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">ملف دعوى</p>
                        <h4 className="text-xl font-black text-slate-700 tracking-tight">{caseNum || 'بدون رقم'}</h4>
                        {year && <p className="text-xs font-bold text-slate-500 mt-0.5">لسنة {year}</p>}
                      </div>
                    </>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-transparent to-transparent pointer-events-none z-10"></div>

                  {/* Tags over cover (always show) */}
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end z-20">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border backdrop-blur-md shadow-sm ${isAppellant ? 'bg-rose-500/90 text-white border-rose-400' : isAppellee ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-amber-500/90 text-white border-amber-400'}`}>
                      {role || 'ملف دعوى'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuickLocationEditId(c.id); }}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg border backdrop-blur-md shadow-sm transition ${fileLocation === 'غير موجود' ? 'bg-rose-500/90 text-white border-rose-400' :
                          fileLocation === 'مؤقت' ? 'bg-amber-500/90 text-white border-amber-400' :
                            fileLocation === 'في المكتب' ? 'bg-emerald-500/90 text-white border-emerald-400' :
                              fileLocation?.includes('شعبة') ? 'bg-slate-700/90 text-white border-slate-600' :
                                'bg-black/50 text-white border-white/20 hover:bg-black/70'
                        }`}
                      title={`مكان الملف: ${fileLocation || 'لم يحدد'} (انقر للتغيير)`}
                    >
                      {fileLocation === 'غير موجود' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                        fileLocation === 'مؤقت' ? <FilesIcon className="w-3.5 h-3.5" /> :
                          fileLocation === 'في المكتب' ? <CheckSquare className="w-3.5 h-3.5" /> :
                            fileLocation?.includes('شعبة') ? <FolderClosed className="w-3.5 h-3.5" /> :
                              <MapPin className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Header: Number, Year (Simplified since fallback is in the cover now) */}
                <div className={`flex flex-col gap-3 mb-4 pt-1`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div>
                        <h3 className="font-black text-lg sm:text-xl text-navy-900 leading-tight flex items-center gap-1.5 flex-wrap">
                          {c.isImportant && <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" title="دعوى هامة" />}
                          {caseNum || 'بدون رقم'}
                          {year && <span className="text-xs sm:text-sm font-bold text-slate-400 mr-1.5">لسنة {year}</span>}
                          {hasJoinedCases && (
                            <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 border border-indigo-200" title={`دعاوى منضمة: ${joinedCasesStr}`}>
                              <FilesIcon className="w-3 h-3" /> مجمعة
                            </span>
                          )}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opponents & Details */}
                <div className="mt-auto space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-col gap-1.5 text-[11px] sm:text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0 whitespace-nowrap">الطاعن:</span>
                      <span className="font-black text-navy-900 line-clamp-1 leading-relaxed" title={appellant}>{appellant || '---'}</span>
                    </div>
                    <div className="flex items-start gap-1.5 border-t border-slate-200/60 pt-1.5">
                      <span className="text-rose-500 font-bold shrink-0 whitespace-nowrap">ضد:</span>
                      <span className="font-bold text-slate-700 line-clamp-1 leading-relaxed" title={appellee}>{appellee || '---'}</span>
                    </div>
                  </div>

                  <div className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-xs ${isJudgment ? 'bg-rose-50 border-rose-100 text-rose-700 font-black' : 'bg-slate-50 border-slate-200 text-slate-700 font-bold'}`}>
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-70 shrink-0" />
                      <span className="truncate" dir="ltr">{formattedLastSession || 'لم تحدد'}</span>
                      {sessionRoll && (
                        <span className="bg-slate-200/50 text-slate-600 px-1.5 py-0.5 rounded text-[10px] mr-1 border border-slate-200 font-black shrink-0">
                          رول: {sessionRoll}
                        </span>
                      )}
                    </div>
                    {decision && (
                      <span className={`px-2 py-1 rounded shadow-sm shrink-0 mr-1 flex items-center gap-1 border truncate max-w-[90px] sm:max-w-[130px] ${isJudgment ? 'bg-rose-500 text-white border-rose-600' : 'bg-white border-slate-200 text-navy-900'}`}>
                        {isJudgment && <Gavel className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />}
                        {decision}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {currentCases.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <FolderClosed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">لا توجد قضايا مطابقة للبحث</p>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 pb-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {'<'}
          </button>
          <span className="text-xs font-bold text-navy-900">
            صفحة {currentPage} من {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {'>'}
          </button>
        </div>
      )}

      {/* Floating Action Bar for Bulk Selection */}
      {selectedCaseIds.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-navy-900 rounded-2xl shadow-2xl p-4 flex items-center gap-3 z-40 border border-slate-700 animate-in slide-in-from-bottom-10 fade-in w-11/12 max-w-md sm:max-w-2xl overflow-x-auto no-scrollbar">
          <div className="text-white text-xs sm:text-sm font-bold flex-1 min-w-[70px]">
            تم تحديد <span className="text-amber-300 font-black px-1">{selectedCaseIds.length}</span> ملف
          </div>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <Edit3 className="w-4 h-4" />
            <span>تعديل</span>
          </button>
          <button
            onClick={() => setIsPrintViewOpen(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>وثائق</span>
          </button>
          <button
            onClick={() => setIsBulkViewingOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <Eye className="w-4 h-4" />
            <span>مهمة إطلاع</span>
          </button>
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <ClipboardList className="w-4 h-4" />
            <span>إسناد</span>
          </button>

          <button
            onClick={async () => {
              const confirm = await showConfirm("تأكيد الحذف الجماعي", `هل أنت متأكد من حذف ${selectedCaseIds.length} ملف نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`);
              if (confirm) {
                let successCount = 0;
                for (const id of selectedCaseIds) {
                  const success = await deleteCaseFromFirebase(id);
                  if (success) successCount++;
                }
                setSelectedCaseIds([]);
                toast(`تم حذف ${successCount} ملف بنجاح!`, "success");
              }
            }}
            className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف</span>
          </button>
          <button
            onClick={() => setSelectedCaseIds([])}
            className="text-slate-300 hover:text-white p-2 rounded-xl transition bg-slate-800 hover:bg-slate-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Location Edit Modal */}
      {quickLocationEditId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setQuickLocationEditId(null)}>
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-navy-900 px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-amber-300 text-sm">تغيير مكان الملف</h3>
              <button onClick={() => setQuickLocationEditId(null)} className="text-white/60 hover:text-white transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {['غير موجود', 'أصلي', 'مؤقت', 'شعبة الحفظ', 'شعبة تحت التحديد', 'شعبة خاصة', 'شعبة الشغل', 'الأحكام', 'في البيت'].map(loc => {
                  const cData = cases.find(c => c.id === quickLocationEditId);
                  const isSelected = cData && (cData['مكان الملف'] === loc);
                  return (
                    <button
                      key={loc}
                      onClick={async () => {
                        try {
                          const archiveLocs = settings?.archiveLocations || ['شعبة الحفظ', 'الحفظ', 'حفظ'];
                          if (archiveLocs.includes(loc)) {
                            const decision = String(cData['القرار'] || cData['قرار الجلسة'] || cData['المنطوق'] || '');
                            const hasJudgment = decision.includes('حكم') || decision.includes('للحكم') || (cData.sessions && cData.sessions.some(s => s.judgment));
                            if (!hasJudgment) {
                              toast("لا يمكن حفظ قضية لم يصدر فيها حكم!", "error");
                              return;
                            }
                          }
                          const locField = schema.find(f => f.id === 'مكان الملف') ? 'مكان الملف' : 'مكان الملف';
                          const success = await saveCaseToFirebase(quickLocationEditId, { [locField]: loc });
                          if (success) {
                            toast("تم تحديث مكان الملف بنجاح", "success");
                            setQuickLocationEditId(null);
                          } else {
                            toast("حدث خطأ أثناء حفظ مكان الملف", "error");
                          }
                        } catch (e) {
                          toast("حدث خطأ غير متوقع", "error");
                        }
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition flex-1 ${isSelected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {loc}
                    </button>
                  );
                })}
              </div>
              <div className="pt-2 text-center text-[10px] text-slate-400 font-bold">
                سيتم حفظ التغيير فور النقر على المكان المطلوب
              </div>
            </div>
          </div>
        </div>
      )}

      <ExportPDFModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        data={filteredCases}
        defaultTitle="تقرير القضايا"
      />

      <ExportPDFModal
        isOpen={isSelectionReportModalOpen}
        onClose={() => setIsSelectionReportModalOpen(false)}
        data={cases.filter(c => selectedCaseIds.includes(c.id))}
        defaultTitle="تقرير القضايا المحددة"
      />

      <BulkAssignTaskModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        selectedCases={selectedCaseIds}
        onClearSelection={() => setSelectedCaseIds([])}
      />

      <BulkViewingTaskModal
        isOpen={isBulkViewingOpen}
        onClose={() => setIsBulkViewingOpen(false)}
        selectedCaseIds={new Set(selectedCaseIds)}
        cases={cases}
      />

      {singleViewingCaseId && (
        <BulkViewingTaskModal
          isOpen={!!singleViewingCaseId}
          onClose={() => setSingleViewingCaseId(null)}
          selectedCaseIds={new Set([singleViewingCaseId])}
          cases={cases}
        />
      )}

      <BulkEditCasesModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        selectedCases={selectedCaseIds}
        onClearSelection={() => setSelectedCaseIds([])}
      />

      {isPrintViewOpen && (
        <GlobalTemplatePrintModal
          cases={cases.filter(c => selectedCaseIds.includes(c.id))}
          sessionDate={formatDateString(new Date().toISOString())}
          onClose={() => setIsPrintViewOpen(false)}
        />
      )}

      {/* Quick Peek Side Panel */}
      {quickPeekId && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-navy-900/40 backdrop-blur-sm z-[60]"
            onClick={() => setQuickPeekId(null)}
          ></div>
          
          {/* Side Panel */}
          <div className="fixed top-0 bottom-0 left-0 w-full sm:w-[500px] lg:w-[650px] bg-slate-50 shadow-2xl z-[70] transform transition-transform duration-300 translate-x-0 flex flex-col animate-in slide-in-from-left">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shrink-0">
              <h2 className="font-black text-lg text-navy-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                نظرة سريعة على تفاصيل الدعوى
              </h2>
              <button
                onClick={() => setQuickPeekId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content (CaseDetails Modal) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative p-0 custom-scrollbar bg-slate-50">
               <CaseDetails isModal={true} modalCaseId={quickPeekId} onCloseModal={() => setQuickPeekId(null)} />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
