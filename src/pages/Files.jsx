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
import { getPrimaryValue } from '../utils/helpers';
import CaseDetails from './CaseDetails';
import CaseCard from '../components/ui/CaseCard';
import useSessionState from '../hooks/useSessionState';
import useDebounce from '../hooks/useDebounce';

export default function Files() {
  const { cases, schema, deleteCaseFromFirebase, saveCaseToFirebase, globalHideNoInterest, setGlobalHideNoInterest, settings, globalTasks, viewingTasks } = useAppContext();
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
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 10);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const clearAllFilters = () => {
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
    setSearchQuery('');
    setAdvancedParams(null);
    navigate('/files');
    if (isPinned) {
      const toSave = {
        roleFilter: 'all', showOngoingOnly: false, showWithAttachmentsOnly: false,
        showImportantOnly: false, showSessionlessOnly: false, showPastSessionsOnly: false,
        showMissingRoleOnly: false, showJudgmentsOnly: false, locationFilter: 'all', sessionTypeFilter: 'all', decisionFilter: '',
        quickDateFilter: '', sortBy
      };
      localStorage.setItem('pinnedFilters', JSON.stringify(toSave));
    }
  };

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

  const { sortedCases } = useCasesSort({
    filteredCases,
    sortBy,
    quickDateFilter
  });

  const totalPages = Math.ceil(sortedCases.length / itemsPerPage);
  
  // Prevent empty pages when filters reduce results
  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearchQuery, advancedParams, activeShoba, roleFilter,
    showSessionlessOnly, showJudgmentsOnly, showImportantOnly,
    showPastSessionsOnly, showOngoingOnly, showWithAttachmentsOnly,
    showMissingRoleOnly, locationFilter, sessionTypeFilter,
    decisionFilter, quickDateFilter, setCurrentPage
  ]);
  
  // Prevent out of bounds if cases are deleted
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage, setCurrentPage]);

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
            
            {/* Selection Group */}
            <div className="flex items-center rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
              
              {/* Select Page Toggle */}
              <button
                onClick={() => {
                  const pageIds = currentCases.map(c => c.id);
                  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedCaseIds.includes(id));
                  if (allPageSelected) {
                    setSelectedCaseIds(prev => prev.filter(id => !pageIds.includes(id)));
                  } else {
                    setSelectedCaseIds(prev => Array.from(new Set([...prev, ...pageIds])));
                  }
                }}
                className={`px-3 py-2 text-xs font-black transition-all flex items-center gap-1.5 border-l border-slate-200 ${
                  currentCases.length > 0 && currentCases.every(c => selectedCaseIds.includes(c.id))
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
                title="تحديد الصفحة الحالية"
              >
                {currentCases.length > 0 && currentCases.every(c => selectedCaseIds.includes(c.id)) ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">الصفحة</span>
              </button>

              {/* Select All Toggle */}
              <button
                onClick={() => {
                  if (selectedCaseIds.length === sortedCases.length && sortedCases.length > 0) {
                    setSelectedCaseIds([]);
                  } else {
                    setSelectedCaseIds(sortedCases.map(c => c.id));
                  }
                }}
                className={`px-3 py-2 text-xs font-black transition-all flex items-center gap-1.5 ${
                  selectedCaseIds.length === sortedCases.length && sortedCases.length > 0
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
                title="تحديد كل النتائج في جميع الصفحات"
              >
                {selectedCaseIds.length === sortedCases.length && sortedCases.length > 0 ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">الكل</span>
              </button>
            </div>

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
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-36 pr-10 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />

              <button
                type="button"
                onClick={() => setIsAdvancedSearchOpen(!isAdvancedSearchOpen)}
                className={`absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 h-7 rounded transition ${isAdvancedSearchOpen || (roleFilter !== 'all' || locationFilter !== 'all' || sessionTypeFilter !== 'all' || decisionFilter || quickDateFilter || showOngoingOnly || showImportantOnly || showJudgmentsOnly || showWithAttachmentsOnly || showSessionlessOnly || showMissingRoleOnly || showPastSessionsOnly) ? 'bg-indigo-500 text-white shadow-sm' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}
                title="البحث المتقدم"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold whitespace-nowrap hidden sm:inline">بحث متقدم</span>
              </button>

              <span className="absolute left-9 sm:left-24 top-1/2 -translate-y-1/2 bg-indigo-100/80 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded font-black border border-indigo-200 pointer-events-none select-none hidden sm:block">
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
              {(roleFilter !== 'all' || showOngoingOnly || showPastSessionsOnly || showWithAttachmentsOnly || showImportantOnly || showSessionlessOnly || showMissingRoleOnly || showJudgmentsOnly || globalHideNoInterest !== 0 || quickDateFilter || locationFilter !== 'all' || sessionTypeFilter !== 'all' || decisionFilter || searchQuery) && (
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-1.5 rounded-lg text-xs font-black text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 transition flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" /> مسح الفلاتر
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
        {currentCases.map(c => (
            <CaseCard 
              key={c.id}
              c={c}
              viewMode={viewMode}
              selectedCaseIds={selectedCaseIds}
              toggleSelection={toggleSelection}
              navigate={navigate}
              setQuickPeekId={setQuickPeekId}
              setQuickLocationEditId={setQuickLocationEditId}
              setSingleViewingCaseId={setSingleViewingCaseId}
              viewingTasks={viewingTasks}
              toast={toast}
            />
        ))}
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
