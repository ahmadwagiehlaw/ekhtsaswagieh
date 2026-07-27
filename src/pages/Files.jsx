import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, FolderClosed, Plus, Clock, FileText, Upload, Download, Loader2, Info, Building2, Gavel, FileBox, X, CalendarDays, Printer } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import ExportPDFModal from '../components/ExportPDFModal';
import { formatDateString, getSafeDateObj } from '../utils/dateUtils';

export default function Files() {
  const { cases, schema } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const itemsPerPage = 20;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
    }
  }, [location.search]);

  const filteredCases = useMemo(() => {
    let result = cases;

    if (roleFilter !== 'all') {
      result = result.filter(c => {
        const role = String(c['الصفة'] || c['صفة'] || '').trim();
        if (roleFilter === 'appellant') {
          return role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
        } else if (roleFilter === 'appellee') {
          return role.includes('مطعون ضده') || role.includes('مستأنف ضده') || role.includes('مدعى عليه');
        }
        return true;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(c => 
        Object.values(c).some(val => String(val).toLowerCase().includes(query))
      );
    }

    return result;
  }, [cases, searchQuery, roleFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const currentCases = filteredCases.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getPrimaryValue = (cObj, possibleKeys) => {
    for (let k of possibleKeys) {
      if (cObj[k] !== undefined && cObj[k] !== null) return cObj[k];
    }
    return '';
  };

  return (
    <div className="space-y-4 pb-20 animate-fade-in">
      <ExportPDFModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        casesToExport={filteredCases}
        schema={schema}
        title="تقرير القضايا"
      />

      {/* Filter & Actions Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm sticky top-[76px] z-30 no-print flex flex-col sm:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <input 
            type="text" 
            placeholder="بحث في القضايا..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-3 pr-10 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
          />
          {searchQuery ? (
             <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
               <X className="w-4 h-4" />
             </button>
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 w-full sm:w-auto">
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">كل الصفات</option>
            <option value="appellant">طاعنين / مدعين</option>
            <option value="appellee">مطعون ضدهم</option>
          </select>
          <button 
             onClick={() => setIsExportModalOpen(true)}
             className="bg-navy-900 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-navy-800 transition"
             title="تصدير PDF"
          >
             <Printer className="w-4 h-4" /> 
             <span className="hidden sm:inline">طباعة</span>
          </button>
        </div>
      </div>

      {/* Results Meta */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-slate-500">
           يعرض <span className="text-navy-900">{currentCases.length}</span> من <span className="text-navy-900">{filteredCases.length}</span> ملف
        </p>
      </div>

      {/* Grid of Folder-like Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
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
          const isAppellee = role.includes('مطعون ضده') || role.includes('مستأنف ضده') || role.includes('مدعى عليه');

          const isJudgment = String(decision).includes('حكم') || String(decision).includes('للحكم');
          
          // Folder Tab Color Logic based on role
          const folderColorClass = isAppellant 
            ? 'bg-rose-500 border-rose-600' 
            : isAppellee 
              ? 'bg-emerald-500 border-emerald-600' 
              : 'bg-amber-500 border-amber-600';

          const folderBg = isAppellant 
            ? 'bg-rose-50/30 border-rose-200' 
            : isAppellee 
              ? 'bg-emerald-50/30 border-emerald-200' 
              : 'bg-amber-50/30 border-amber-200';

          return (
            <div 
              key={c.id}
              onClick={() => navigate(`/case/${c.id}`)}
              className="group relative cursor-pointer pt-4"
            >
              {/* Folder Tab */}
              <div className={`absolute top-0 right-4 h-6 px-4 rounded-t-xl border-t border-x ${folderColorClass} flex items-center justify-center shadow-sm z-10 transition-transform group-hover:-translate-y-1`}>
                 <span className="text-[10px] font-black text-white">{role || 'ملف دعوى'}</span>
              </div>

              {/* Folder Body */}
              <div className={`relative ${folderBg} border rounded-2xl rounded-tr-none p-5 shadow-sm hover:shadow-md transition-all duration-300 z-20 h-full flex flex-col group-hover:-translate-y-1`}>
                
                {/* Header: Number & Year */}
                <div className="flex items-start justify-between mb-4 border-b border-black/5 pb-3">
                  <div className="flex items-center gap-2">
                    <FolderClosed className={`w-6 h-6 ${isAppellant ? 'text-rose-600' : isAppellee ? 'text-emerald-600' : 'text-amber-600'}`} />
                    <div>
                      <h3 className="font-black text-lg text-navy-900 leading-tight">
                         {caseNum || 'بدون رقم'} {year ? <span className="text-sm font-bold text-slate-500">لسنة {year}</span> : ''}
                      </h3>
                    </div>
                  </div>
                  {fileLocation && (
                    <span className="px-2 py-1 rounded-md text-[9px] font-black bg-white border border-slate-200 text-slate-600 shadow-sm shrink-0">
                      📂 {fileLocation}
                    </span>
                  )}
                </div>

                {/* Opponents */}
                <div className="flex-grow space-y-3">
                  <div className="bg-white/60 rounded-xl p-3 flex items-center gap-2 text-xs border border-white">
                    <span className={`font-black truncate ${isAppellant ? 'text-navy-900' : 'text-slate-600'}`} title={appellant}>
                      {appellant || '-'}
                    </span>
                    <span className="text-slate-400 font-black shrink-0">×</span>
                    <span className={`font-black truncate ${!isAppellant ? 'text-navy-900' : 'text-slate-600'}`} title={appellee}>
                      {appellee || '-'}
                    </span>
                  </div>

                  {/* Session & Decision */}
                  {(decision || formattedLastSession) && (
                    <div className={`rounded-xl p-3 flex items-center justify-between gap-3 border ${isJudgment ? 'bg-rose-100/50 border-rose-200' : 'bg-white/80 border-white'}`}>
                      {formattedLastSession && (
                        <p className={`text-[11px] font-black flex items-center gap-1 shrink-0 ${isJudgment ? 'text-rose-700' : 'text-slate-700'}`}>
                          📅 <span dir="ltr">{formattedLastSession}</span>
                        </p>
                      )}
                      {decision && (
                        <p className={`text-[11px] font-extrabold truncate text-left ${isJudgment ? 'text-rose-900' : 'text-navy-900'}`}>
                          📋 {decision}
                        </p>
                      )}
                    </div>
                  )}
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
    </div>
  );
}
