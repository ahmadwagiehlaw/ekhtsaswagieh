import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Users, CalendarDays, AlertTriangle, Building2, Scale, Info, PieChart } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { getSafeDateObj } from '../utils/dateUtils';

export default function Dashboard() {
  const { cases } = useAppContext();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    let appellantCount = 0;
    let appelleeCount = 0;
    
    let judgedCount = 0; // المحكوم فيه
    let reservedCount = 0; // محجوز للحكم
    let ongoingCount = 0; // متداول

    let activeThisMonth = 0;
    let alerts = [];

    const opponentsCount = {}; // For Appellant cases only
    const yearCount = {};
    const judgmentsCount = {}; // For Judgment Classification

    const today = new Date();
    today.setHours(0,0,0,0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    cases.forEach(c => {
      const role = String(c['الصفة'] || c['صفة'] || '').trim();
      const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
      const isAppellee = role.includes('مطعون ضده') || role.includes('مستأنف ضده') || role.includes('مدعى عليه');
      
      if (isAppellant) appellantCount++;
      if (isAppellee) appelleeCount++;
      
      const year = c['السنة'] || c['سنة'] || c['year'] || 'غير محدد';
      yearCount[year] = (yearCount[year] || 0) + 1;

      const decision = String(c['القرار'] || c['قرار الجلسة'] || c['المنطوق'] || '');
      const lastSessionStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'] || '';
      const lastSessionDate = getSafeDateObj(lastSessionStr);

      // Status Logic
      const hasHukm = decision.includes('حكم') || decision.includes('للحكم');
      if (hasHukm && lastSessionDate) {
        if (lastSessionDate < today) {
          judgedCount++;
        } else {
          reservedCount++;
        }
      } else {
        ongoingCount++;
      }

      // Active this month
      if (lastSessionDate) {
        if (lastSessionDate.getMonth() === currentMonth && lastSessionDate.getFullYear() === currentYear) {
          if (!hasHukm || (hasHukm && lastSessionDate >= today)) {
             activeThisMonth++;
          }
        }
        
        // Alerts
        const isSuspended = decision.includes('وقف جزائي') || decision.includes('كأن لم يكن');
        const prevMonthDate = new Date(today);
        prevMonthDate.setMonth(today.getMonth() - 1);
        if (isSuspended) {
          if (
            (lastSessionDate.getMonth() === currentMonth && lastSessionDate.getFullYear() === currentYear) || 
            (lastSessionDate.getMonth() === prevMonthDate.getMonth() && lastSessionDate.getFullYear() === prevMonthDate.getFullYear())
          ) {
            alerts.push(c);
          }
        }
      }

      // Entities
      if (isAppellant) {
         let entity = String(c['المدعي'] || c['الطاعن'] || c['المستأنف'] || 'غير محدد').trim();
         if (entity) {
           opponentsCount[entity] = (opponentsCount[entity] || 0) + 1;
         }
      }

      // Judgments
      const decisionText = decision.toLowerCase();
      if (decisionText) {
        if (decisionText.includes('وقف')) {
          judgmentsCount['وقف'] = (judgmentsCount['وقف'] || 0) + 1;
        } else if (decisionText.includes('كأن لم') || decisionText.includes('اعتبار') || decisionText.includes('شطب') || decisionText.includes('ترك')) {
          judgmentsCount['شطب وكأن لم يكن'] = (judgmentsCount['شطب وكأن لم يكن'] || 0) + 1;
        } else if (decisionText.includes('عدم قبول')) {
          judgmentsCount['عدم قبول'] = (judgmentsCount['عدم قبول'] || 0) + 1;
        } else if (decisionText.includes('رفض')) {
          judgmentsCount['رفض'] = (judgmentsCount['رفض'] || 0) + 1;
        } else if (decisionText.includes('إلغاء') || decisionText.includes('قبول')) {
          judgmentsCount['قبول / إلغاء'] = (judgmentsCount['قبول / إلغاء'] || 0) + 1;
        } else if (decisionText.includes('إحالة')) {
          judgmentsCount['إحالة'] = (judgmentsCount['إحالة'] || 0) + 1;
        } else {
          judgmentsCount['أخرى'] = (judgmentsCount['أخرى'] || 0) + 1;
        }
      }
    });

    const topYears = Object.entries(yearCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const topOpponents = Object.entries(opponentsCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const topJudgments = Object.entries(judgmentsCount).sort((a,b) => b[1] - a[1]);

    return { 
      all: cases.length, 
      appellant: appellantCount, 
      appellee: appelleeCount, 
      judged: judgedCount,
      reserved: reservedCount,
      ongoing: ongoingCount,
      activeThisMonth,
      topYears,
      topOpponents,
      topJudgments,
      alerts
    };
  }, [cases]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/files?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(`/files`);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Search Header Hero */}
      <div className="bg-navy-900 rounded-3xl p-6 sm:p-10 text-center shadow-lg relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
         <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl -translate-x-10 translate-y-10"></div>
         
         <div className="relative z-10 space-y-6 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black text-white">إبحث في ملفاتك بذكاء</h2>
            <p className="text-sm font-bold text-slate-300">ابحث برقم الدعوى، الخصم، أو السنة للوصول السريع</p>
            
            <form onSubmit={handleSearch} className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث هنا..." 
                className="w-full bg-white/10 text-white placeholder-slate-400 border-2 border-white/20 rounded-2xl py-4 pl-4 pr-14 text-lg font-bold focus:outline-none focus:border-amber-400 focus:bg-white/20 transition-all backdrop-blur-sm"
              />
              <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white hover:bg-amber-600 transition">
                <Search className="w-5 h-5" />
              </button>
            </form>
         </div>
      </div>

      {/* Dashboard Stats */}
      <div className="space-y-6 animate-fade-in">
          {/* Alerts Section */}
          {stats.alerts.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-500 rounded-full opacity-10"></div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-black text-rose-900 mb-1">تنبيهات هامة!</h3>
                  <p className="text-xs font-bold text-rose-700 leading-relaxed mb-3">
                    يوجد لديك {stats.alerts.length} قضايا صدر فيها قرار "وقف جزائي" أو "كأن لم يكن" خلال الشهر الحالي أو الماضي، يرجى مراجعتها وتجديدها في الميعاد.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stats.alerts.map(c => (
                       <button 
                         key={c.id} 
                         onClick={() => navigate(`/case/${c.id}`)}
                         className="bg-white border border-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition shadow-sm"
                       >
                         {c['رقم الدعوى'] || c.id}
                       </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Scale className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-500">إجمالي القضايا</p>
              <p className="text-2xl font-black text-navy-900">{stats.all}</p>
            </div>
            
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-500">الجلسات المتداولة</p>
              <p className="text-2xl font-black text-navy-900">{stats.ongoing}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <CalendarDays className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-500">جلسات هذا الشهر</p>
              <p className="text-2xl font-black text-navy-900">{stats.activeThisMonth}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Building2 className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-500">قضايا الطاعنين</p>
              <p className="text-2xl font-black text-navy-900">{stats.appellant}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2 relative overflow-hidden">
               <div className="absolute -left-4 -top-4 w-16 h-16 bg-slate-50 rounded-full"></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">المحكوم فيه</p>
               <p className="text-xl font-black text-slate-700 relative z-10">{stats.judged}</p>
             </div>
             <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center space-y-2 relative overflow-hidden">
               <div className="absolute -left-4 -top-4 w-16 h-16 bg-slate-50 rounded-full"></div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">محجوز للحكم</p>
               <p className="text-xl font-black text-slate-700 relative z-10">{stats.reserved}</p>
             </div>
          </div>

          {/* Charts / Lists */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Top Opponents */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                <h3 className="font-black text-xs text-slate-600">الجهات رافعة الدعوى (قضايا الطاعنين)</h3>
              </div>
              <div className="space-y-3">
                {stats.topOpponents.length > 0 ? stats.topOpponents.map(([name, count], i) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="w-5 h-5 rounded-md bg-slate-50 text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</span>
                      <p className="text-xs font-bold text-navy-900 truncate" title={name}>{name}</p>
                    </div>
                    <span className="text-[10px] font-black text-slate-500 shrink-0 bg-slate-50 px-2 py-0.5 rounded-full mr-2">{count} ملف</span>
                  </div>
                )) : (
                  <p className="text-xs text-slate-400 font-bold text-center py-2">لا توجد بيانات كافية</p>
                )}
              </div>
            </div>

            {/* Active Years */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <h3 className="font-black text-xs text-slate-600">توزيع الملفات المتداولة (وفقاً للسنة)</h3>
              </div>
              <div className="space-y-3">
                {stats.topYears.map(([year, count]) => {
                  const max = Math.max(...stats.topYears.map(y => y[1]));
                  const width = `${(count / max) * 100}%`;
                  return (
                    <div key={year} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-navy-900">سنة {year}</span>
                        <span className="text-slate-500">{count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Judgments Breakdown */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-slate-400" />
                <h3 className="font-black text-xs text-slate-600">تحليل وتصنيف الأحكام</h3>
              </div>
              <div className="space-y-3">
                {stats.topJudgments.length > 0 ? stats.topJudgments.map(([name, count]) => {
                  const total = stats.topJudgments.reduce((acc, curr) => acc + curr[1], 0);
                  const width = `${(count / total) * 100}%`;
                  return (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-navy-900">{name}</span>
                        <span className="text-slate-500">{count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width }}></div>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-slate-400 font-bold text-center py-2">لا توجد بيانات كافية</p>
                )}
              </div>
            </div>

          </div>
        </div>
    </div>
  );
}
