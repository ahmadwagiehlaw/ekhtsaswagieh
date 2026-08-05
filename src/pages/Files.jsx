import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, FolderClosed, Plus, Clock, FileText, Upload, Download, Loader2, Info, Building2, Gavel, FileBox, X, CalendarDays, Printer, CheckSquare, Square, ClipboardList, AlertTriangle, Sparkles, MapPin, User, Files as FilesIcon, ArrowUpDown, SlidersHorizontal, Edit3, Trash2, Pin, PinOff } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import ExportPDFModal from '../components/ExportPDFModal';
import BulkAssignTaskModal from '../components/BulkAssignTaskModal';
import BulkEditCasesModal from '../components/BulkEditCasesModal';
import AdvancedSearchModal from '../components/AdvancedSearchModal';
import GlobalTemplatePrintModal from '../components/GlobalTemplatePrintModal';
import { formatDateString, getSafeDateObj } from '../utils/dateUtils';
import useSessionState from '../hooks/useSessionState';

export default function Files() {
  const { cases, schema, settings, deleteCaseFromFirebase, saveCaseToFirebase, globalHideNoInterest, setGlobalHideNoInterest, globalTasks } = useAppContext();
  const { toast, showConfirm } = useUI();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useSessionState('files_searchQuery', '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [roleFilter, setRoleFilter] = useSessionState('files_roleFilter', 'all');
  const [currentPage, setCurrentPage] = useSessionState('files_currentPage', 1);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState([]);
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
  const [showRecentlyModifiedOnly, setShowRecentlyModifiedOnly] = useSessionState('files_showRecentlyModifiedOnly', false);
  const [showRecentlyViewedOnly, setShowRecentlyViewedOnly] = useSessionState('files_showRecentlyViewedOnly', false);
  const [showRecentlyAddedOnly, setShowRecentlyAddedOnly] = useSessionState('files_showRecentlyAddedOnly', false);
  const [quickDateFilter, setQuickDateFilter] = useSessionState('files_quickDateFilter', '');
  const [isSelectionReportModalOpen, setIsSelectionReportModalOpen] = useState(false);
  const [isPrintViewOpen, setIsPrintViewOpen] = useState(false);

  // Sorting and collapsible states
  const [sortBy, setSortBy] = useSessionState('files_sortBy', 'none');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useSessionState('files_isFilterPanelOpen', false);
  const [isSortPanelOpen, setIsSortPanelOpen] = useSessionState('files_isSortPanelOpen', false);
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
        setShowRecentlyModifiedOnly(pinned.showRecentlyModifiedOnly ?? false);
        setShowRecentlyViewedOnly(pinned.showRecentlyViewedOnly ?? false);
        setShowRecentlyAddedOnly(pinned.showRecentlyAddedOnly ?? false);
        setQuickDateFilter(pinned.quickDateFilter ?? '');
        setSortBy(pinned.sortBy ?? 'none');
      }
    } catch (e) {}
  }, []);

  const handlePinFilters = () => {
    if (isPinned) {
      localStorage.removeItem('pinnedFilters');
      setIsPinned(false);
    } else {
      const toSave = {
        roleFilter, showOngoingOnly, showWithAttachmentsOnly,
        showImportantOnly, showSessionlessOnly, showPastSessionsOnly, 
        showRecentlyModifiedOnly, showRecentlyViewedOnly, showRecentlyAddedOnly, 
        quickDateFilter, sortBy
      };
      localStorage.setItem('pinnedFilters', JSON.stringify(toSave));
      setIsPinned(true);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const itemsPerPage = 20;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const role = params.get('role');

    if (role && (role === 'appellant' || role === 'appellee' || role === 'all')) {
      setRoleFilter(role);
    }

    // Check if it's an advanced search
    if (params.get('caseNo') || params.get('year') || params.get('opponentName') || params.get('decision') || params.get('sessionDateStart') || params.get('court') || params.get('location')) {
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

  const filteredCases = useMemo(() => {
    let result = cases;

    // 1. Shoba Filter
    const archiveLocations = settings?.archiveLocations || ['شعبة الحفظ', 'الحفظ', 'حفظ'];
    
    const isSpecialLocation = (loc) => {
       if (!loc) return false;
       if (archiveLocations.includes(loc)) return false;
       return loc.includes('شعبة') || loc.includes('تحت التحديد') || loc.includes('القسم');
    };

    if (activeShoba === 'متداول') {
      result = result.filter(c => {
         const loc = String(c['مكان الملف'] || '').trim();
         return !archiveLocations.includes(loc) && !isSpecialLocation(loc);
      });
    } else if (activeShoba === 'تحت_التحديد') {
      result = result.filter(c => {
         const loc = String(c['مكان الملف'] || '').trim();
         return isSpecialLocation(loc);
      });
    } else if (activeShoba === 'حفظ') {
      result = result.filter(c => {
         const loc = String(c['مكان الملف'] || '').trim();
         return archiveLocations.includes(loc);
      });
    }

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

    if (showRecentlyViewedOnly) {
      result = result.filter(c => {
        if (!c.lastViewedAt) return false;
        const diffDays = (new Date() - new Date(c.lastViewedAt)) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      });
    }
    
    if (showRecentlyModifiedOnly) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter(c => {
         if (!c.updatedAt) return false;
         return new Date(c.updatedAt) >= sevenDaysAgo;
      });
    }

    if (showRecentlyAddedOnly) {
      result = result.filter(c => {
        let createdDate = c.createdAt ? new Date(c.createdAt) : null;
        if (!createdDate) {
          const timestampStr = c.id?.split('_')[0];
          if (timestampStr && timestampStr.length >= 13 && !isNaN(timestampStr)) {
            createdDate = new Date(Number(timestampStr));
          }
        }
        if (!createdDate || isNaN(createdDate.getTime())) return false;
        const diffDays = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      });
    }

    if (quickDateFilter) {
      result = result.filter(c => {
        const dStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'];
        if (!dStr) return false;
        const d = getSafeDateObj(dStr);
        if (!d) return false;
        const pad = n => n.toString().padStart(2, '0');
        const dISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        return dISO === quickDateFilter;
      });
    }

    if (advancedParams) {
      const { caseNo, year, opponentName, opponentRole, decision, sessionDateStart, sessionDateEnd, court, location, requiredTask } = advancedParams;

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

        // Required Task
        if (requiredTask) {
           const hasRequiredTask = globalTasks.some(t => t.status === 'pending' && t.title === requiredTask && t.linkedCases?.includes(c.id));
           if (!hasRequiredTask) return false;
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
    } else if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(c => {
        const srchStr = `${c['رقم الدعوى'] || ''} ${c['السنة'] || ''} ${c['المدعي'] || ''} ${c['الطاعن'] || ''} ${c['المدعى عليه'] || ''} ${c['المطعون ضده'] || ''} ${c.id || ''}`.toLowerCase();
        return srchStr.includes(q);
      });
    }

    return result;
  }, [cases, debouncedSearchQuery, roleFilter, advancedParams, showOngoingOnly, showWithAttachmentsOnly, showImportantOnly, showSessionlessOnly, showPastSessionsOnly, showRecentlyModifiedOnly, showRecentlyViewedOnly, showRecentlyAddedOnly, quickDateFilter, activeShoba, settings]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, roleFilter, advancedParams, showOngoingOnly, showWithAttachmentsOnly, showImportantOnly, showSessionlessOnly, showPastSessionsOnly, showRecentlyModifiedOnly, showRecentlyViewedOnly, showRecentlyAddedOnly, quickDateFilter, sortBy, activeShoba]);

  const getPrimaryValue = (cObj, possibleKeys) => {
    for (let k of possibleKeys) {
      if (cObj[k] !== undefined && cObj[k] !== null) return cObj[k];
    }
    return '';
  };

  const sortedCases = useMemo(() => {
    let result = [...filteredCases];

    const getSessionRoll = (c) => {
      const rollStr = c['الرول'] || c['رول الجلسة'] || c['رقم الرول'] || '';
      const parsed = parseInt(String(rollStr).replace(/[^\d]/g, ''), 10);
      return isNaN(parsed) ? 999999 : parsed;
    };

    if (quickDateFilter) {
      result.sort((a, b) => getSessionRoll(a) - getSessionRoll(b));
    }

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
        const diff = dB.getTime() - dA.getTime();
        if (diff === 0) return getSessionRoll(a) - getSessionRoll(b);
        return diff;
      }
      if (sortBy === 'date_asc') {
        const dA = getSessionDate(a);
        const dB = getSessionDate(b);
        if (!dA && !dB) return 0;
        if (!dA) return 1;
        if (!dB) return -1;
        const diff = dA.getTime() - dB.getTime();
        if (diff === 0) return getSessionRoll(a) - getSessionRoll(b);
        return diff;
      }

      return 0;
    });

    return result;
  }, [filteredCases, sortBy, quickDateFilter]);

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

            {/* Hide 'No Interest' Toggle */}
            <button
              onClick={() => setGlobalHideNoInterest(!globalHideNoInterest)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${
                globalHideNoInterest ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="إخفاء أو إظهار ملفات (لا شأن)"
            >
              {globalHideNoInterest ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              <span>إخفاء (لا شأن)</span>
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
          <div className="flex gap-2 w-full sm:w-auto flex-1 sm:max-w-md justify-end">
            <div className="relative w-full sm:max-w-[130px]">
              <input
                type="date"
                title="تاريخ الجلسة"
                value={quickDateFilter}
                onChange={(e) => setQuickDateFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 px-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
              />
            </div>
            <div className="relative w-full sm:flex-1 max-w-xs">
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
              <button onClick={() => { setSearchQuery(''); setAdvancedParams(null); setQuickDateFilter(''); navigate('/files'); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            ) : (
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            )}
          </div>
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
                      setShowRecentlyModifiedOnly(false);
                      setShowRecentlyViewedOnly(false);
                      setShowRecentlyAddedOnly(false);
                      setQuickDateFilter('');
                      if (isPinned) {
                        // Update pin to reflect cleared state
                        const toSave = { 
                          roleFilter: 'all', showOngoingOnly: false, showWithAttachmentsOnly: false, 
                          showImportantOnly: false, showSessionlessOnly: false, showPastSessionsOnly: false, 
                          showRecentlyModifiedOnly: false, showRecentlyViewedOnly: false, showRecentlyAddedOnly: false, 
                          quickDateFilter: '', sortBy 
                        };
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
                onClick={() => setShowRecentlyViewedOnly(!showRecentlyViewedOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${showRecentlyViewedOnly ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>استعرضتها مؤخراً</span>
              </button>

              <button
                onClick={() => setShowRecentlyModifiedOnly(!showRecentlyModifiedOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${showRecentlyModifiedOnly ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>عدلتها مؤخراً</span>
              </button>

              <button
                onClick={() => setShowRecentlyAddedOnly(!showRecentlyAddedOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm border ${showRecentlyAddedOnly ? 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>أُضيفت مؤخراً</span>
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
            const diffDays = Math.ceil((new Date(a.date) - new Date()) / (1000 * 60 * 60 * 24));
            return diffDays <= 3;
          });

          const latestJudgmentSession = (c.sessions || [])
            .filter(s => s.hasJudgment && s.judgment)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
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

                {coverImageUrl && (
                  <div className="mb-4 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 aspect-[3/4] relative border-b border-slate-100 bg-slate-100 shrink-0 overflow-hidden">
                    <img src={coverImageUrl} alt="غلاف الملف" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-transparent to-transparent"></div>

                    {/* Tags over image */}
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border backdrop-blur-md shadow-sm ${isAppellant ? 'bg-rose-500/90 text-white border-rose-400' : isAppellee ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-amber-500/90 text-white border-amber-400'}`}>
                        {role || 'ملف دعوى'}
                      </span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setQuickLocationEditId(c.id); }}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border backdrop-blur-md shadow-sm transition ${
                          fileLocation === 'غير موجود' ? 'bg-rose-500/90 text-white border-rose-400' :
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
                            <button 
                              onClick={(e) => { e.stopPropagation(); setQuickLocationEditId(c.id); }}
                              className={`w-6 h-6 flex items-center justify-center rounded border shadow-sm transition ${
                                fileLocation === 'غير موجود' ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' :
                                fileLocation === 'مؤقت' ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' :
                                fileLocation === 'في المكتب' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' :
                                fileLocation?.includes('شعبة') ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100' :
                                'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
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
                        )}
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
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <ClipboardList className="w-4 h-4" />
            <span>إسناد</span>
          </button>
          <button
            onClick={() => setIsSelectionReportModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 transition shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>تقرير</span>
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
                         } catch(e) {
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

      {isPrintViewOpen && (
        <GlobalTemplatePrintModal
          cases={cases.filter(c => selectedCaseIds.includes(c.id))}
          sessionDate={formatDateString(new Date().toISOString())}
          onClose={() => setIsPrintViewOpen(false)}
        />
      )}
    </div>
  );
}
