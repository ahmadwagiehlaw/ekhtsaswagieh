import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, FolderClosed, Plus, Clock, FileText, Upload, Download, Loader2, Info, Building2, Gavel, FileBox, X, CalendarDays, Printer, CheckSquare, Square, ClipboardList, AlertTriangle, Sparkles, MapPin, User, Files as FilesIcon, ArrowUpDown, SlidersHorizontal, Edit3, Trash2, Pin, PinOff } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import ExportPDFModal from '../components/ExportPDFModal';
import BulkAssignTaskModal from '../components/BulkAssignTaskModal';
import BulkEditCasesModal from '../components/BulkEditCasesModal';
import AdvancedSearchModal from '../components/AdvancedSearchModal';
import { formatDateString, getSafeDateObj } from '../utils/dateUtils';

export default function Files() {
  const { cases, schema, settings, deleteCaseFromFirebase } = useAppContext();
  const { toast, showConfirm } = useUI();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState([]);

  // Advanced Search Params
  const [advancedParams, setAdvancedParams] = useState(null);

  // Quick Filters
  const [showOngoingOnly, setShowOngoingOnly] = useState(false);
  const [showWithAttachmentsOnly, setShowWithAttachmentsOnly] = useState(false);
  const [showImportantOnly, setShowImportantOnly] = useState(false);
  const [showSessionlessOnly, setShowSessionlessOnly] = useState(false);
  const [showPastSessionsOnly, setShowPastSessionsOnly] = useState(false);
  const [isSelectionReportModalOpen, setIsSelectionReportModalOpen] = useState(false);

  // Sorting and collapsible states
  const [sortBy, setSortBy] = useState('none');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

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
        setSortBy(pinned.sortBy ?? 'none');
      }
    } catch (e) {}
  }, []);

  const handlePinFilters = () => {
    if (isPinned) {
      // Unpin: clear saved filters
      localStorage.removeItem('pinnedFilters');
      setIsPinned(false);
    } else {
      // Pin current filters
      const toSave = {
        roleFilter, showOngoingOnly, showWithAttachmentsOnly,
        showImportantOnly, showSessionlessOnly, showPastSessionsOnly, sortBy
      };
      localStorage.setItem('pinnedFilters', JSON.stringify(toSave));
      setIsPinned(true);
    }
  };

  const itemsPerPage = 20;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');

    // Check if it's an advanced search
    if (params.get('caseNo') || params.get('year') || params.get('opponentName') || params.get('decision') || params.get('sessionDateStart') || params.get('court') || params.get('location')) {
      const adv = {};
      for (const [key, value] of params.entries()) {
        if (key !== 'q') adv[key] = value;
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

  const filteredCases = useMemo(() => {
    let result = cases;

    if (roleFilter !== 'all') {
      result = result.filter(c => {
        const role = String(c['الصفة'] || c['صفة'] || '').trim();
        const appRole = settings?.roles?.[0] || 'طاعن';
        const apeRole = settings?.roles?.[1] || 'مطعون ضدنا';
        if (roleFilter === 'appellant') {
          return role.includes(appRole) || role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
        } else if (roleFilter === 'appellee') {
          return role.includes(apeRole) || role.includes('مطعون') || role.includes('مستأنف ضده') || role.includes('مدعى عليه') || role.includes('مدعى علينا');
        }
        return true;
      });
    }

    if (showSessionlessOnly) {
      result = result.filter(c => {
        const dateStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'];
        if (!dateStr) return true;
        const d = getSafeDateObj(dateStr);
        return !d;
      });
    }

    if (showImportantOnly) {
      result = result.filter(c => c.isImportant);
    }

    if (showPastSessionsOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result = result.filter(c => {
        const dateStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'];
        if (!dateStr) return false;
        const d = getSafeDateObj(dateStr);
        if (!d) return false;
        return d < today;
      });
    }

    if (showOngoingOnly) {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      result = result.filter(c => {
        const dateStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'];
        if (!dateStr) return false;
        const d = getSafeDateObj(dateStr);
        if (!d) return false;
        return d >= firstDayOfMonth;
      });
    }

    if (showWithAttachmentsOnly) {
      result = result.filter(c => c.documents && c.documents.length > 0);
    }

    if (advancedParams) {
      const { caseNo, year, opponentName, opponentRole, decision, sessionDateStart, sessionDateEnd, court, location } = advancedParams;

      result = result.filter(c => {
        // 1. Case No
        if (caseNo && !(c['رقم الدعوى'] || c['رقم القضية'] || c.id)?.toString().includes(caseNo)) return false;

        // 2. Year
        if (year && !(c['السنة'] || c['سنة'])?.toString().includes(year)) return false;

        // 3. Opponent
        if (opponentName) {
          const name = opponentName.toLowerCase();
          const appellant = (c['الطاعن'] || c['المدعي'] || c['المستأنف'] || '').toLowerCase();
          const appellee = (c['المطعون ضده'] || c['المدعى عليه'] || '').toLowerCase();

          if (opponentRole === 'appellant') {
            if (!appellant.includes(name)) return false;
          } else if (opponentRole === 'appellee') {
            if (!appellee.includes(name)) return false;
          } else {
            if (!appellant.includes(name) && !appellee.includes(name)) return false;
          }
        }

        // 4. Decision
        if (decision) {
          const caseDecision = (c['القرار'] || c['قرار الجلسة'] || c['المنطوق'] || '');
          if (decision === 'حكم') {
            if (!caseDecision.includes('حكم') && !caseDecision.includes('للحكم')) return false;
          } else if (decision === 'للحكم') {
            if (caseDecision !== 'للحكم' && caseDecision !== 'محجوز للحكم') return false;
          } else {
            if (!caseDecision.includes(decision)) return false;
          }
        }

        // 5. Session Date
        if (sessionDateStart || sessionDateEnd) {
          const caseDateStr = c['آخر جلسة'] || c['تاريخ الجلسة'];
          if (!caseDateStr) return false;
          const caseDate = getSafeDateObj(caseDateStr);
          if (!caseDate) return false;

          if (sessionDateStart && caseDate < new Date(sessionDateStart)) return false;
          if (sessionDateEnd && caseDate > new Date(sessionDateEnd)) return false;
        }

        // 6. Court
        if (court && c['المحكمة'] !== court) return false;

        // 7. Location
        if (location && c['مكان الملف'] !== location) return false;

        return true;
      });
    } else if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(c =>
        Object.values(c).some(val => String(val).toLowerCase().includes(query))
      );
    }

    return result;
  }, [cases, searchQuery, roleFilter, advancedParams, showOngoingOnly, showWithAttachmentsOnly, showImportantOnly, showSessionlessOnly]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, advancedParams, showOngoingOnly, showWithAttachmentsOnly, showImportantOnly, showSessionlessOnly, sortBy]);

  const getPrimaryValue = (cObj, possibleKeys) => {
    for (let k of possibleKeys) {
      if (cObj[k] !== undefined && cObj[k] !== null) return cObj[k];
    }
    return '';
  };

  const sortedCases = useMemo(() => {
    let result = [...filteredCases];
    if (sortBy === 'none') return result;

    const getCaseNumber = (c) => {
      const numStr = c['رقم الدعوى'] || c['رقم القضية'] || c['رقم_الدعوى'] || c.id || '';
      const parsed = parseInt(String(numStr).replace(/[^\d]/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    const getCaseYear = (c) => {
      const yrStr = c['السنة'] || c['سنة'] || '';
      const parsed = parseInt(String(yrStr).replace(/[^\d]/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    const getSessionDate = (c) => {
      const dStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'] || '';
      if (!dStr) return null;
      return getSafeDateObj(dStr);
    };

    result.sort((a, b) => {
      if (sortBy === 'appellant_asc') {
        const valA = getPrimaryValue(a, ['الطاعن', 'المدعي', 'المستأنف']);
        const valB = getPrimaryValue(b, ['الطاعن', 'المدعي', 'المستأنف']);
        return valA.localeCompare(valB, 'ar');
      }
      if (sortBy === 'appellant_desc') {
        const valA = getPrimaryValue(a, ['الطاعن', 'المدعي', 'المستأنف']);
        const valB = getPrimaryValue(b, ['الطاعن', 'المدعي', 'المستأنف']);
        return valB.localeCompare(valA, 'ar');
      }
      if (sortBy === 'number_asc') {
        const numA = getCaseNumber(a);
        const numB = getCaseNumber(b);
        return numA - numB;
      }
      if (sortBy === 'number_desc') {
        const numA = getCaseNumber(a);
        const numB = getCaseNumber(b);
        return numB - numA;
      }
      if (sortBy === 'year_desc') {
        const yrA = getCaseYear(a);
        const yrB = getCaseYear(b);
        return yrB - yrA;
      }
      if (sortBy === 'year_asc') {
        const yrA = getCaseYear(a);
        const yrB = getCaseYear(b);
        return yrA - yrB;
      }
      if (sortBy === 'date_desc') {
        const dA = getSessionDate(a);
        const dB = getSessionDate(b);
        if (!dA && !dB) return 0;
        if (!dA) return 1;
        if (!dB) return -1;
        return dB.getTime() - dA.getTime();
      }
      if (sortBy === 'date_asc') {
        const dA = getSessionDate(a);
        const dB = getSessionDate(b);
        if (!dA && !dB) return 0;
        if (!dA) return 1;
        if (!dB) return -1;
        return dA.getTime() - dB.getTime();
      }
      return 0;
    });

    return result;
  }, [filteredCases, sortBy]);

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

      <AdvancedSearchModal
        isOpen={isAdvancedSearchOpen}
        onClose={() => setIsAdvancedSearchOpen(false)}
        onSearch={handleAdvancedSearch}
      />

      {/* Filter & Actions Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm sticky top-[76px] z-30 no-print flex flex-col gap-3">

        <div className="flex flex-col-reverse sm:flex-row gap-3 items-center justify-between w-full">
          {/* Filters, Sorting & Print on the right (RTL start) */}
          <div className="flex gap-2 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap justify-start">
            {/* Filter Toggle Button */}
            <button
              onClick={() => {
                setIsFilterPanelOpen(!isFilterPanelOpen);
                setIsSortPanelOpen(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${isFilterPanelOpen || (roleFilter !== 'all' || showOngoingOnly || showPastSessionsOnly || showWithAttachmentsOnly || showImportantOnly || showSessionlessOnly)
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              title="خيارات الفلترة والتصفية"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>الفلترة</span>
              {isPinned && <Pin className="w-3 h-3 text-amber-500" />}
              {!isPinned && (roleFilter !== 'all' || showOngoingOnly || showPastSessionsOnly || showWithAttachmentsOnly || showImportantOnly || showSessionlessOnly) && (
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              )}
            </button>

            {/* Sort Toggle Button */}
            <button
              onClick={() => {
                setIsSortPanelOpen(!isSortPanelOpen);
                setIsFilterPanelOpen(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${isSortPanelOpen || sortBy !== 'none'
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              title="ترتيب المعروض"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>الترتيب</span>
              {sortBy !== 'none' && (
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              )}
            </button>

            {/* Print Button */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="bg-navy-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-navy-800 transition shadow-sm border border-navy-950"
              title="تصدير PDF وطباعة"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </button>
          </div>

          {/* Search on the left (RTL end) */}
          <div className="relative w-full sm:max-w-xs">
            <input
              id="search-cases-input"
              type="text"
              placeholder="بحث في القضايا..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-28 pr-10 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
            />

            <button
              type="button"
              onClick={() => setIsAdvancedSearchOpen(true)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition"
              title="البحث الذكي"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>

            <span className="absolute left-9 top-1/2 -translate-y-1/2 bg-indigo-100/80 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded font-black border border-indigo-200 pointer-events-none select-none">
              {filteredCases.length} ملف
            </span>

            {searchQuery || advancedParams ? (
              <button onClick={() => { setSearchQuery(''); setAdvancedParams(null); navigate('/files'); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {isFilterPanelOpen && (
          <div className="border-t border-slate-100 pt-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black text-slate-500">تصفية القضايا حسب:</h4>
              <div className="flex items-center gap-2">
                {/* PIN Button */}
                <button
                  onClick={handlePinFilters}
                  title={isPinned ? 'إلغاء تثبيت الفلاتر الحالية' : 'تثبيت الفلاتر الحالية (تبقى محفوظة)'}
                  className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border transition ${
                    isPinned
                      ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                >
                  {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  {isPinned ? 'إلغاء التثبيت' : 'تثبيت الفلاتر'}
                </button>
                {(roleFilter !== 'all' || showOngoingOnly || showPastSessionsOnly || showWithAttachmentsOnly || showImportantOnly || showSessionlessOnly) && (
                  <button
                    onClick={() => {
                      setRoleFilter('all');
                      setShowOngoingOnly(false);
                      setShowPastSessionsOnly(false);
                      setShowWithAttachmentsOnly(false);
                      setShowImportantOnly(false);
                      setShowSessionlessOnly(false);
                      if (isPinned) {
                        // Update pin to reflect cleared state
                        const toSave = { roleFilter: 'all', showOngoingOnly: false, showWithAttachmentsOnly: false, showImportantOnly: false, showSessionlessOnly: false, showPastSessionsOnly: false, sortBy };
                        localStorage.setItem('pinnedFilters', JSON.stringify(toSave));
                      }
                    }}
                    className="text-[10px] font-black text-rose-500 hover:text-rose-600 transition"
                  >
                    إعادة ضبط الفلاتر
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setRoleFilter(prev => prev === 'all' ? 'appellant' : prev === 'appellant' ? 'appellee' : 'all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${roleFilter === 'all' ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100' : roleFilter === 'appellant' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}
              >
                <User className="w-3.5 h-3.5" />
                <span>الصفة: {roleFilter === 'all' ? 'الكل' : roleFilter === 'appellant' ? (settings?.roles?.[0] || 'الطاعن') : (settings?.roles?.[1] || 'المطعون ضدنا')}</span>
              </button>

              <button
                onClick={() => setShowOngoingOnly(!showOngoingOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${showOngoingOnly ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>المتداول</span>
              </button>

              <button
                onClick={() => setShowPastSessionsOnly(!showPastSessionsOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${showPastSessionsOnly ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>جلسات سابقة</span>
              </button>

              <button
                onClick={() => setShowWithAttachmentsOnly(!showWithAttachmentsOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${showWithAttachmentsOnly ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <FileBox className="w-3.5 h-3.5" />
                <span>بها مرفقات</span>
              </button>

              <button
                onClick={() => setShowImportantOnly(!showImportantOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${showImportantOnly ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${showImportantOnly ? 'fill-amber-700' : ''}`} />
                <span>قضايا هامة</span>
              </button>

              <button
                onClick={() => setShowSessionlessOnly(!showSessionlessOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${showSessionlessOnly ? 'bg-slate-700 text-white border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <X className="w-3.5 h-3.5" />
                <span>بدون جلسة</span>
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

      {/* Grid of Folder-like Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 pt-2">
        {currentCases.map(c => {
          const caseNum = getPrimaryValue(c, ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']);
          const year = getPrimaryValue(c, ['السنة', 'سنة', 'year']);
          const appellant = getPrimaryValue(c, ['المدعي', 'الطاعن', 'المستأنف']);
          const appellee = getPrimaryValue(c, ['المدعى_عليه', 'المدعى عليه', 'المطعون ضده', 'المطعون']);
          const lastSession = getPrimaryValue(c, ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة']);
          const formattedLastSession = lastSession ? formatDateString(lastSession) : '';
          const decision = getPrimaryValue(c, ['القرار', 'قرار الجلسة', 'المنطوق']);
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
            const diffDays = Math.ceil((new Date(a.date) - new Date()) / (1000 * 60 * 60 * 24));
            return diffDays <= 3;
          });

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

              {/* Card Body */}
              <div className={`relative ${bgClass} border ${borderClass} rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 z-20 h-full flex flex-col group-hover:-translate-y-1 overflow-hidden ${cardOpacity} ${grayscale}`}>

                {/* Top Accent Line */}
                <div className={`absolute top-0 left-0 w-full h-1 z-10 bg-gradient-to-r from-${roleColor}-400 to-${roleColor}-500`}></div>

                {coverImageUrl && (
                  <div className="mb-4 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 aspect-[3/4] relative border-b border-slate-100 bg-slate-100 shrink-0 overflow-hidden">
                    <img src={coverImageUrl} alt="غلاف الملف" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-transparent to-transparent"></div>

                    {/* Tags over image */}
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border backdrop-blur-md shadow-sm ${isAppellant ? 'bg-rose-500/90 text-white border-rose-400' : isAppellee ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-amber-500/90 text-white border-amber-400'}`}>
                        {role || 'ملف دعوى'}
                      </span>
                      {fileLocation && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-white bg-black/50 px-2 py-1 rounded-lg backdrop-blur-md">
                          <MapPin className="w-3.5 h-3.5" /> {fileLocation}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Header: Number, Year, and Role */}
                <div className={`flex flex-col gap-3 mb-4 ${!coverImageUrl ? 'pt-1' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      {!coverImageUrl && (
                        <div className={`w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0`}>
                          <FolderClosed className={`w-5 h-5 text-${roleColor}-500`} />
                        </div>
                      )}
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
                        {!coverImageUrl && (
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border ${badgeBgClass}`}>
                              {role || 'ملف دعوى'}
                            </span>
                            {fileLocation && (
                              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                <MapPin className="w-3.5 h-3.5" /> {fileLocation}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Opponents & Details */}
                <div className="mt-auto space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-col gap-1 text-[11px] sm:text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold shrink-0 w-8">الطاعن:</span>
                      <span className="font-black text-navy-900 line-clamp-1 leading-relaxed" title={appellant}>{appellant || '---'}</span>
                    </div>
                    <div className="flex items-start gap-2 border-t border-slate-200/60 pt-1">
                      <span className="text-rose-500 font-bold shrink-0 w-8">ضد:</span>
                      <span className="font-bold text-slate-700 line-clamp-1 leading-relaxed" title={appellee}>{appellee || '---'}</span>
                    </div>
                  </div>

                  <div className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-xs ${isJudgment ? 'bg-rose-50 border-rose-100 text-rose-700 font-black' : 'bg-slate-50 border-slate-200 text-slate-700 font-bold'}`}>
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-70 shrink-0" />
                      <span className="truncate" dir="ltr">{formattedLastSession || 'لم تحدد'}</span>
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
            <span className="hidden sm:inline">تعديل البيانات</span>
            <span className="sm:hidden">تعديل</span>
          </button>
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">إسناد مهمة</span>
            <span className="sm:hidden">إسناد</span>
          </button>
          <button
            onClick={() => setIsSelectionReportModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">إنشاء تقرير</span>
            <span className="sm:hidden">تقرير</span>
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
            <span className="hidden sm:inline">حذف جماعي</span>
            <span className="sm:hidden">حذف</span>
          </button>
          <button
            onClick={() => setSelectedCaseIds([])}
            className="text-slate-300 hover:text-white p-2 rounded-xl transition bg-slate-800 hover:bg-slate-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
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

      <BulkEditCasesModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        selectedCases={selectedCaseIds}
        onClearSelection={() => setSelectedCaseIds([])}
      />

      <AdvancedSearchModal
        isOpen={isAdvancedSearchOpen}
        onClose={() => setIsAdvancedSearchOpen(false)}
        onSearch={handleAdvancedSearch}
      />
    </div>
  );
}
