import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Filter, ChevronRight, ChevronLeft, Gavel, Printer, Zap, CheckCircle2, CalendarX2, CopyPlus } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isPast, isToday, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { useAppContext } from '../context/AppState';
import ExportPDFModal from '../components/ExportPDFModal';
import BulkSessionRolloverModal from '../components/BulkSessionRolloverModal';
import SessionTable from '../components/SessionTable';
import { getSafeDateObj } from '../utils/dateUtils';

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const ARABIC_DAYS_LONG = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

export default function Agenda() {
  const { cases } = useAppContext();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [filterMode, setFilterMode] = useState('none');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'list'
  const [singleDateSearch, setSingleDateSearch] = useState('');
  const [sessionTypeSearch, setSessionTypeSearch] = useState('');

  const getFieldValue = (obj, keys) => {
    for (let key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return '';
  };

  const handleSearch = () => {
    if (singleDateSearch) {
      setFilterMode('singleDate');
      const d = parseISO(singleDateSearch);
      if (d && !isNaN(d)) {
        setCurrentDate(d);
        setSelectedDateKey(singleDateSearch);
      }
    } else {
      if (sessionTypeSearch) {
        setFilterMode('all');
      } else {
        setFilterMode('none');
      }
    }
    if (activeTab !== 'calendar') {
      setActiveTab('filter');
    }
  };

  const handleResetSearch = () => {
    setSingleDateSearch('');
    setSessionTypeSearch('');
    setFilterMode('none');
  };

  const SearchControls = () => (
    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-2 mb-4">
      <div className="flex items-center gap-2 flex-1 w-full">
        <input 
          type="date" 
          value={singleDateSearch} 
          onChange={e => setSingleDateSearch(e.target.value)} 
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900" 
        />
        <select
          value={sessionTypeSearch}
          onChange={e => setSessionTypeSearch(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900"
        >
          <option value="">كل الجلسات</option>
          <option value="فحص">فحص</option>
          <option value="موضوع">موضوع</option>
          <option value="للحكم">للحكم</option>
        </select>
      </div>
      <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 shrink-0">
        <button 
          onClick={handleResetSearch}
          className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs transition"
        >
          مسح
        </button>
        <button 
          onClick={handleSearch}
          className="bg-navy-900 hover:bg-navy-800 text-amber-300 font-bold px-6 py-2 rounded-xl text-xs transition shadow-sm flex-1 sm:flex-none flex items-center justify-center gap-2"
        >
          بحث
        </button>
      </div>
    </div>
  );

  const sessionsMap = useMemo(() => {
    const map = {};
    cases.forEach(cObj => {
      if (sessionTypeSearch) {
        if (sessionTypeSearch === 'للحكم') {
          if (getFieldValue(cObj, ['القرار']) !== 'للحكم') return;
        } else {
          if (getFieldValue(cObj, ['نوع الجلسة']) !== sessionTypeSearch) return;
        }
      }

      const dStr = getFieldValue(cObj, ['آخر جلسة','أخر جلسة','اخر جلسة','تاريخ الجلسة']);
      if (!dStr) return;
      const d = getSafeDateObj(dStr);
      if (!d) return;
      // Use local ISO format to avoid timezone shifts
      const pad = n => n.toString().padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (!map[key]) map[key] = [];
      map[key].push(cObj);
    });
    return map;
  }, [cases, sessionTypeSearch]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const monthSessionKeys = Object.keys(sessionsMap).filter(k => k.startsWith(format(currentDate, "yyyy-MM")));
  const monthSessionFiles = monthSessionKeys.reduce((acc, k) => acc + sessionsMap[k].length, 0);

  const filteredKeys = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const allKeys = Object.keys(sessionsMap).sort();

    if (filterMode === 'today') {
      const key = format(today, 'yyyy-MM-dd');
      return sessionsMap[key] ? [key] : [];
    } else if (filterMode === 'thisWeek') {
      const start = startOfWeek(today);
      const end = endOfWeek(today);
      return allKeys.filter(k => {
        const d = parseISO(k);
        return d >= start && d <= end;
      });
    } else if (filterMode === 'currentMonth') {
      const prefix = format(today, 'yyyy-MM');
      return allKeys.filter(k => k.startsWith(prefix));
    } else if (filterMode === 'nextSession') {
      const future = allKeys.filter(k => parseISO(k) >= today).sort();
      return future.length ? [future[0]] : [];
    } else if (filterMode === 'prevSession') {
      const past = allKeys.filter(k => parseISO(k) < today).sort().reverse();
      return past.length ? [past[0]] : [];
    } else if (filterMode === 'singleDate') {
      return singleDateSearch && sessionsMap[singleDateSearch] ? [singleDateSearch] : [];
    } else if (filterMode === 'all') {
      return allKeys;
    } else if (filterMode === 'range') {
      return allKeys.filter(k => {
        if (dateRange.from && k < dateRange.from) return false;
        if (dateRange.to && k > dateRange.to) return false;
        return true;
      });
    }
    return [];
  }, [filterMode, dateRange, singleDateSearch, sessionsMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5 gap-1 no-print">
        <button onClick={() => setActiveTab('calendar')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${activeTab === 'calendar' ? 'bg-navy-900 text-amber-300 shadow' : 'text-slate-500 hover:text-navy-900'}`}>
          <CalendarDays className="w-4 h-4" /><span>التقويم الشهري</span>
        </button>
        <button onClick={() => setActiveTab('filter')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${activeTab === 'filter' ? 'bg-navy-900 text-amber-300 shadow' : 'text-slate-500 hover:text-navy-900'}`}>
          <Filter className="w-4 h-4" /><span>الفلترة الذكية</span>
        </button>
      </div>

      {activeTab === 'calendar' && (
        <div className="space-y-3">
          <SearchControls />
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-navy-900 text-white px-4 py-3 flex items-center justify-between">
              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition active:scale-95">
                <ChevronRight className="w-4 h-4 text-amber-300" />
              </button>
              <div className="text-center">
                <h2 className="font-black text-base text-white">{ARABIC_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                <p className="text-[10px] text-amber-300 font-bold mt-0.5">
                  {monthSessionKeys.length > 0 ? `${monthSessionKeys.length} يوم جلسة • ${monthSessionFiles} ملف هذا الشهر` : 'لا توجد جلسات مسجلة هذا الشهر'}
                </p>
              </div>
              <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition active:scale-95">
                <ChevronLeft className="w-4 h-4 text-amber-300" />
              </button>
            </div>

            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
              {ARABIC_DAYS_LONG.map((d, i) => (
                <div key={d} className={`text-center py-2 text-[10px] font-black ${i===0 || i===6 ? 'text-rose-600' : 'text-slate-500'}`}>{d.substring(0,3)}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0 border-b border-slate-100">
              {days.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayCases = sessionsMap[dateKey] || [];
                const hasSession = dayCases.length > 0;
                const isSelected = selectedDateKey === dateKey;
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const past = isPast(day) && !isToday(day);
                const weekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <div 
                    key={dateKey} 
                    onClick={() => hasSession && setSelectedDateKey(dateKey)}
                    className={`relative h-12 border-b border-l border-slate-100 flex flex-col items-center justify-center transition-all select-none ${hasSession ? 'cursor-pointer hover:bg-amber-50 active:bg-amber-100' : 'cursor-default bg-slate-50/30'} ${isSelected ? 'bg-amber-50 ring-2 ring-inset ring-amber-400' : ''} ${!isCurrentMonth ? 'opacity-30' : ''}`}
                  >
                    <span className={`text-xs font-black leading-none ${isToday(day) ? 'w-6 h-6 rounded-full bg-navy-900 text-amber-300 flex items-center justify-center' : ''} ${!isToday(day) && weekend ? 'text-rose-500' : ''} ${!isToday(day) && !weekend && past ? 'text-slate-400' : ''} ${!isToday(day) && !weekend && !past ? 'text-slate-800' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    {hasSession && (
                      <span className={`absolute bottom-1 right-1/2 translate-x-1/2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center ${past ? 'bg-slate-300 text-slate-600' : 'bg-amber-400 text-navy-900'}`}>
                        {dayCases.length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selectedDateKey && sessionsMap[selectedDateKey] && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-400 rounded-xl flex items-center justify-center">
                    <Gavel className="w-4 h-4 text-navy-900" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-navy-900">جلسات يوم {format(parseISO(selectedDateKey), 'yyyy-MM-dd')}</h3>
                    <p className="text-[11px] text-amber-700 font-bold">{sessionsMap[selectedDateKey].length} ملف قضائي</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.open(`/day-roll/${selectedDateKey}`, '_blank')} className="text-xs font-black bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition" title="فتح الرول كامل في نافذة مستقلة">
                    استعراض الشاشة كاملة
                  </button>
                  <button onClick={() => setSelectedDateKey(null)} className="text-slate-400 hover:text-slate-700 p-1"><CalendarX2 className="w-5 h-5"/></button>
                </div>
              </div>
              
              <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex gap-2">
                <button onClick={() => setViewMode('table')} className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-navy-900 text-amber-300' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}>رول جلسة (جدول)</button>
                <button onClick={() => setViewMode('list')} className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-navy-900 text-amber-300' : 'bg-white border text-slate-500 hover:bg-slate-100'}`}>العرض العادي (بطاقات)</button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {viewMode === 'table' ? (
                  <SessionTable dayCases={sessionsMap[selectedDateKey]} date={selectedDateKey} />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sessionsMap[selectedDateKey].map((cObj, idx) => {
                      const role = String(getFieldValue(cObj, ['الصفة']) || '').trim();
                      const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
                      const isAppellee = role.includes('مطعون ضده') || role.includes('مستأنف ضده') || role.includes('مدعى عليه');
                      const isNoInterest = role === 'لا شأن';
                      const isOutOfJurisdiction = role === 'خارج الاختصاص';

                      let badgeClass = 'bg-amber-100 text-amber-800';
                      let containerClass = 'p-3 flex items-start justify-between gap-3 hover:bg-slate-50 transition';
                      
                      if (isAppellant) badgeClass = 'bg-rose-100 text-rose-800';
                      else if (isAppellee) badgeClass = 'bg-emerald-100 text-emerald-800';
                      else if (isOutOfJurisdiction) badgeClass = 'bg-indigo-100 text-indigo-800';
                      else if (isNoInterest) {
                        badgeClass = 'bg-slate-200 text-slate-700';
                        containerClass += ' opacity-60 grayscale hover:opacity-100 hover:grayscale-0';
                      }

                      return (
                      <div key={cObj.id} className={containerClass}>
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-navy-900 text-amber-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{idx+1}</span>
                            <div className="min-w-0">
                                <p className="text-xs font-black text-navy-900 leading-snug">
                                    دعوى {getFieldValue(cObj, ['رقم الدعوى'])} لسنة {getFieldValue(cObj, ['السنة'])}
                                    {role && <span className={`mr-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>{role}</span>}
                                </p>
                                <p className="text-[11px] text-slate-600 font-bold mt-0.5 truncate"><span className="text-slate-400">المدعي:</span> {getFieldValue(cObj, ['المدعي'])}</p>
                                <p className="text-[11px] text-slate-600 font-bold truncate"><span className="text-slate-400">ضد:</span> {getFieldValue(cObj, ['المدعى_عليه'])}</p>
                                <p className="text-[11px] text-amber-700 font-bold mt-1 truncate">📋 {getFieldValue(cObj, ['القرار'])}</p>
                            </div>
                        </div>
                        <button onClick={() => navigate(`/case/${cObj.id}`)} className="shrink-0 bg-navy-900 hover:bg-navy-700 text-amber-300 text-[10px] font-black px-2.5 py-1.5 rounded-lg transition">عرض</button>
                      </div>
                    )})}
                  </div>
                )}
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100 no-print flex gap-2">
                <button onClick={() => setIsRolloverModalOpen(true)} className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-navy-900 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm">
                  <CopyPlus className="w-4 h-4" /> ترحيل مجمع
                </button>
                <button onClick={() => setIsExportModalOpen(true)} className="flex-1 bg-navy-900 hover:bg-navy-800 text-amber-300 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-sm">
                  <Printer className="w-4 h-4" /> طباعة الرول
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'filter' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <p className="text-xs font-black text-navy-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> فلترة سريعة
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                {id: 'today', label: 'اليوم'},
                {id: 'thisWeek', label: 'هذا الأسبوع'},
                {id: 'currentMonth', label: 'الشهر الحالي'},
                {id: 'nextSession', label: 'أقرب جلسة قادمة'},
                {id: 'prevSession', label: 'أقرب جلسة سابقة'}
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => setFilterMode(f.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${filterMode === f.id ? 'bg-navy-900 text-amber-300 border-navy-900' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3 mb-3 mt-3">
            <p className="text-xs font-black text-navy-900 flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-navy-900" /> بحث بتاريخ محدد وتصنيف الجلسة
            </p>
            <SearchControls />
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <p className="text-xs font-black text-navy-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-navy-900" /> فلترة بنطاق تاريخ
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-500">من تاريخ</label>
                <input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-500">إلى تاريخ</label>
                <input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-navy-900" />
              </div>
            </div>
            <button onClick={() => setFilterMode('range')} className="w-full bg-navy-900 hover:bg-navy-800 text-amber-300 font-bold py-2.5 rounded-xl text-xs transition shadow-sm">
              عرض النتائج
            </button>
          </div>

          <div className="space-y-2">
            {filterMode !== 'none' && filteredKeys.length === 0 ? (
               <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
                 <CalendarX2 className="w-8 h-8 text-slate-300 mx-auto" />
                 <p className="text-sm font-bold text-slate-500">لا توجد جلسات مطابقة لهذا الفلتر</p>
               </div>
            ) : filterMode !== 'none' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between mb-3">
                <span className="text-xs font-black text-amber-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  {filteredKeys.length} يوم جلسة • {filteredKeys.reduce((a,k)=>a+sessionsMap[k].length,0)} ملف
                </span>
              </div>
            )}
            
            {filteredKeys.map(key => {
              const d = parseISO(key);
              const past = isPast(d) && !isToday(d);
              return (
                <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                   <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 ${past ? 'bg-slate-50' : 'bg-emerald-50'}`}>
                      <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl ${past ? 'bg-slate-200 text-slate-600' : 'bg-emerald-500 text-white'} flex items-center justify-center font-black text-sm`}>
                              {format(d, 'd')}
                          </div>
                          <div>
                              <p className="text-xs font-black text-navy-900">{format(d, 'yyyy-MM-dd')}</p>
                              <p className={`text-[11px] font-bold ${past ? 'text-slate-400' : 'text-emerald-700'}`}>{sessionsMap[key].length} ملف قضائي</p>
                          </div>
                      </div>
                      <button onClick={() => { setActiveTab('calendar'); setCurrentDate(d); setSelectedDateKey(key); }} className="text-[10px] font-black bg-navy-900 text-amber-300 px-2.5 py-1.5 rounded-xl flex items-center gap-1">التقويم</button>
                   </div>
                   <div className="divide-y divide-slate-100">
                     {sessionsMap[key].slice(0,3).map((cObj) => (
                       <div key={cObj.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                         <div className="min-w-0 flex-1">
                           <p className="text-xs font-black text-navy-900 truncate">دعوى {getFieldValue(cObj, ['رقم الدعوى'])} لسنة {getFieldValue(cObj, ['السنة'])}</p>
                           <p className="text-[11px] text-slate-500 font-bold truncate">{getFieldValue(cObj, ['المدعي'])}</p>
                         </div>
                         <button onClick={() => navigate(`/case/${cObj.id}`)} className="shrink-0 bg-slate-100 text-navy-900 text-[10px] font-black px-2 py-1.5 rounded-lg">عرض</button>
                       </div>
                     ))}
                     {sessionsMap[key].length > 3 && (
                       <div className="px-4 py-2 text-[11px] font-bold text-slate-400 text-center">+ {sessionsMap[key].length - 3} ملفات أخرى</div>
                     )}
                   </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <ExportPDFModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        data={selectedDateKey ? sessionsMap[selectedDateKey] : []} 
        defaultTitle={selectedDateKey ? `رول جلسات ${selectedDateKey}` : "تقرير الجلسات"} 
      />
      <BulkSessionRolloverModal 
        isOpen={isRolloverModalOpen} 
        onClose={() => setIsRolloverModalOpen(false)} 
        initialDateKey={selectedDateKey} 
      />
    </div>
  );
}
