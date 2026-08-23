import React, { useState, useEffect } from 'react';
import { BarChart2, Printer, Search, FileText, Calendar, Filter, Download } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { formatDateString } from '../utils/dateUtils';
import SmartDocumentsTab from '../components/SmartDocumentsTab';

export default function Reports() {
  const { cases, settings, globalTasks, viewingTasks, PREDEFINED_TASKS } = useAppContext();
  
  const [activeTab, setActiveTab] = useState('documents');
  const [reportType, setReportType] = useState('memos'); // 'memos', 'judgments', 'prep'
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetDate, setTargetDate] = useState('');
  const [consultantName, setConsultantName] = useState(settings?.consultantName || 'أحمد وجيه');
  const [judgmentResultFilter, setJudgmentResultFilter] = useState(''); // '' = all
  const [taskTypeFilter, setTaskTypeFilter] = useState('');
  
  const [generatedData, setGeneratedData] = useState([]);

  // Generate Report
  const generateReport = () => {
    let results = [];
    
    // Memos report
    if (reportType === 'memos') {
      const monthStr = targetMonth.toString().padStart(2, '0');
      const targetPrefix = `${targetYear}-${monthStr}`;
      
      cases.forEach(c => {
        const procedures = Array.isArray(c.procedures) ? c.procedures : Object.values(c.procedures || {});
        procedures.forEach(proc => {
          if (proc.title?.includes('مذكرة') && proc.date?.startsWith(targetPrefix)) {
            const sessionDate = c['تاريخ الجلسة'] || c['أخر جلسة'] || c['آخر جلسة'] || '';
            results.push({
              id: c.id + proc.id,
              caseNumber: `${c['رقم الدعوى'] || c.id} لسنة ${c['السنة']}`,
              plaintiff: (c['المدعي'] || c['الطاعن']) || '',
              defendant: c['المطعون ضده'] || c['المطعون ضدنا'] || c['المدعى عليه'] || c['مدعى علينا'] || '',
              sessionDate: formatDateString(sessionDate),
              decision: c['القرار'] || '',
              notes: proc.notes || ''
            });
          }
        });
      });
      setGeneratedData(results);
      
    // Judgments report
    } else if (reportType === 'judgments') {
      const monthStr = targetMonth.toString().padStart(2, '0');
      const targetPrefix = `${targetYear}-${monthStr}`;
      const summary = { 'صالح': 0, 'ضد': 0, 'حكم منه للخصومة': 0, 'غير منه للخصومة': 0, 'تمهيدي': 0, 'غير مصنف': 0 };
      
      cases.forEach(c => {
        const role = String(c['الصفة'] || c['صفة'] || '').trim();
        // Ignore specific roles from stats completely
        if (role === 'لا شأن' || role === 'خارج الاختصاص') return;

        const appRole = settings?.roles?.[0] || 'طاعن';
        const isAppellant = role.includes(appRole) || role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
        const apeRole = settings?.roles?.[1] || 'مطعون ضدنا';
        const isAppellee = role.includes(apeRole) || role.includes('مطعون ضده') || role.includes('مطعون ضدنا') || role.includes('مستأنف ضده') || role.includes('مدعى عليه') || role.includes('مدعى علينا');

        const sessions = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
        sessions.forEach(s => {
          if (!s.hasJudgment) return;
          if (!s.date?.startsWith(targetPrefix)) return;
          // Read new structured judgment first, fallback to legacy
          let result = s.judgment?.result || s.judgmentClassification || 'غير مصنف';
          const type   = s.judgment?.type   || s.shortJudgment || '';
          
          // Old data mapping
          if (result === 'للصالح') result = 'صالح';
          if (result === 'للضد') result = 'ضد';
          if (result === 'إجرائي') result = 'تمهيدي';
          if (result === 'جزئي') result = 'غير منه للخصومة';

          if (judgmentResultFilter && result !== judgmentResultFilter) return;
          
          // Logic for win/loss computation
          let computeAs = result;
          if (result === 'حكم منه للخصومة') {
            if (isAppellee) computeAs = 'صالح';
            else if (isAppellant) computeAs = 'ضد';
          }
          
          // Increment the summary based on computeAs to affect Win/Loss stats accurately
          if (summary[computeAs] !== undefined) summary[computeAs]++; else summary['غير مصنف']++;
          
          results.push({
            id: c.id + s.id,
            caseNumber: `${c['رقم الدعوى'] || c.id} لسنة ${c['السنة']}`,
            plaintiff: (c['المدعي'] || c['الطاعن']) || '',
            defendant: c['المطعون ضده'] || c['المطعون ضدنا'] || c['المدعى عليه'] || c['مدعى علينا'] || '',
            sessionDate: formatDateString(s.date),
            decision: type,
            notes: result,
            judgmentResult: result,
            computeAs: computeAs, // passed down for UI coloring
            isFinal: s.judgment?.isFinal || false,
          });
        });
      });
      setGeneratedData(results);
      // Store summary for display
      setJudgmentSummary(summary);
      
    // Prep report
    } else if (reportType === 'prep') {
      if (!targetDate) return;
      cases.forEach(c => {
        const sessionDate = c['تاريخ الجلسة'] || c['أخر جلسة'] || c['آخر جلسة'] || '';
        if (sessionDate === targetDate) {
          results.push({
            id: c.id,
            caseNumber: `${c['رقم الدعوى'] || c.id} لسنة ${c['السنة']}`,
            plaintiff: (c['المدعي'] || c['الطاعن']) || '',
            defendant: c['المطعون ضده'] || c['المطعون ضدنا'] || c['المدعى عليه'] || c['مدعى علينا'] || '',
            sessionDate: formatDateString(sessionDate),
            decision: c['القرار'] || '',
            notes: ''
          });
        }
      });
      setGeneratedData(results);
    // Tasks report
    } else if (reportType === 'tasks') {
      if (!taskTypeFilter) return setGeneratedData([]);
      cases.forEach(c => {
        // filter by session date if provided
        const sessionDate = c['تاريخ الجلسة'] || c['أخر جلسة'] || c['آخر جلسة'] || '';
        if (targetDate && sessionDate !== targetDate) return;

        // check if this case has the required task
        const hasTask = globalTasks?.some(t => t.title === taskTypeFilter && t.linkedCases?.includes(c.id) && t.status === 'pending');
        if (hasTask) {
          results.push({
            id: c.id,
            caseNumber: `${c['رقم الدعوى'] || c.id} لسنة ${c['السنة']}`,
            plaintiff: (c['المدعي'] || c['الطاعن']) || '',
            defendant: c['المطعون ضده'] || c['المطعون ضدنا'] || c['المدعى عليه'] || c['مدعى علينا'] || '',
            sessionDate: formatDateString(sessionDate),
            decision: c['القرار'] || '',
            notes: globalTasks?.find(t => t.title === taskTypeFilter && t.linkedCases?.includes(c.id) && t.status === 'pending')?.assignee || ''
          });
        }
      });
      // Sort by session date then by case number
      results.sort((a, b) => {
        if (a.sessionDate && b.sessionDate && a.sessionDate !== b.sessionDate) {
          return new Date(a.sessionDate) - new Date(b.sessionDate);
        }
        return a.caseNumber.localeCompare(b.caseNumber);
      });
      setGeneratedData(results);
    // Viewing Tasks report
    } else if (reportType === 'viewing_tasks') {
      const vTasks = viewingTasks?.filter(t => t.status !== 'completed') || [];
      vTasks.forEach(t => {
        const linkedCase = cases.find(c => c.id === t.linkedCases?.[0]) || {};
        const sessionDate = t.caseContext?.date || linkedCase['تاريخ الجلسة'] || linkedCase['أخر جلسة'] || linkedCase['آخر جلسة'] || '';
        
        if (targetDate && sessionDate !== targetDate) return;

        const docsString = t.title.replace('مهمة إطلاع وتصوير:', '').trim() || t.title;

        results.push({
          id: t.id,
          caseNumber: linkedCase['رقم الدعوى'] ? `${linkedCase['رقم الدعوى']} لسنة ${linkedCase['السنة']}` : (t.caseContext?.roll ? `رول ${t.caseContext.roll}` : '---'),
          plaintiff: (linkedCase['المدعي'] || linkedCase['الطاعن']) || '',
          defendant: linkedCase['المطعون ضده'] || linkedCase['المطعون ضدنا'] || linkedCase['المدعى عليه'] || linkedCase['مدعى علينا'] || '',
          sessionDate: formatDateString(sessionDate),
          decision: t.caseContext?.decision || linkedCase['القرار'] || '',
          notes: docsString,
          status: t.status
        });
      });
      results.sort((a, b) => {
        if (a.sessionDate && b.sessionDate && a.sessionDate !== b.sessionDate) {
          return new Date(a.sessionDate) - new Date(b.sessionDate);
        }
        return a.caseNumber.localeCompare(b.caseNumber);
      });
      setGeneratedData(results);
    }
  };

  const [judgmentSummary, setJudgmentSummary] = useState(null);

  useEffect(() => {
    generateReport();
  }, [reportType, targetMonth, targetYear, targetDate, cases, judgmentResultFilter, taskTypeFilter, globalTasks, viewingTasks]);

  const handlePrint = () => {
    window.print();
  };

  const getMonthName = (monthNum) => {
    const months = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return months[monthNum] || '';
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      
      <div className="flex bg-slate-200/50 p-1 rounded-xl mb-2 no-print w-fit border border-slate-200">
        <button onClick={() => setActiveTab('documents')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'documents' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <FileText className="w-4 h-4" /> محرك الوثائق الذكي
        </button>
        <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'stats' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <BarChart2 className="w-4 h-4" /> التقارير والإحصائيات
        </button>
      </div>

      {activeTab === 'documents' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <SmartDocumentsTab />
        </div>
      ) : (
      <>
      {/* Controls Section (Hidden in Print) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 no-print animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-4 mb-6">
           <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <BarChart2 className="w-6 h-6 text-indigo-600" />
           </div>
           <div>
              <h2 className="text-navy-900 font-black text-xl">مركز التقارير والإحصائيات</h2>
              <p className="text-slate-500 text-sm font-bold mt-1">توليد وطباعة الكشوف والتقارير الديناميكية</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500">نوع التقرير</label>
            <select 
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="memos">كشف المذكرات المحررة</option>
              <option value="prep">كشف تحضير جلسة</option>
              <option value="judgments">كشف أحكام الشهر</option>
              <option value="tasks">كشف مهام الملفات</option>
              <option value="viewing_tasks">كشف مهام الإطلاع</option>
            </select>
          </div>

          {(reportType === 'memos' || reportType === 'judgments') && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500">الشهر</label>
                <select 
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i+1} value={i+1}>{getMonthName(i+1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500">السنة</label>
                <input 
                  type="number" 
                  value={targetYear}
                  onChange={(e) => setTargetYear(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          {reportType === 'judgments' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">فلتر النتيجة</label>
              <select
                value={judgmentResultFilter}
                onChange={e => setJudgmentResultFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">كل الأحكام</option>
                <option value="صالح">صالح</option>
                <option value="ضد">ضد</option>
                <option value="غير منه للخصومة">غير منه للخصومة</option>
                <option value="تمهيدي">تمهيدي</option>
                <option value="حكم منه للخصومة">حكم منه للخصومة</option>
              </select>
            </div>
          )}

          {(reportType === 'prep' || reportType === 'tasks' || reportType === 'viewing_tasks') && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">تاريخ الجلسة</label>
              <input 
                type="date" 
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {reportType === 'tasks' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500">نوع المهمة المطلوبة</label>
              <select
                value={taskTypeFilter}
                onChange={e => setTaskTypeFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">اختر المهمة...</option>
                {PREDEFINED_TASKS?.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500">اسم المستشار (للترويسة)</label>
            <input 
              type="text" 
              value={consultantName}
              onChange={(e) => setConsultantName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
           <button 
             onClick={handlePrint}
             className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
           >
             <Printer className="w-4 h-4" /> طباعة التقرير
           </button>
        </div>
      </div>

      {/* Report Preview (Printable Area) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print-area">
        
        {/* Document Header (For Print) */}
        <div className="p-8 border-b-2 border-slate-800 text-center relative">
           <div className="absolute top-8 right-8 text-right hidden print:block text-sm font-bold">
             <p>هيئة قضايا الدولة</p>
             <p>فرع اختصاص</p>
           </div>
           
           <h1 className="text-2xl font-black text-slate-900 mt-2 mb-3">
             {reportType === 'memos' && `كشف المذكرات المحررة عن شهر ${getMonthName(targetMonth)} سنة ${targetYear}`}
             {reportType === 'prep' && `كشف تحضير جلسة ${formatDateString(targetDate) || '---'}`}
             {reportType === 'judgments' && `كشف أحكام شهر ${getMonthName(targetMonth)} سنة ${targetYear}`}
             {reportType === 'tasks' && `كشف مهام (${taskTypeFilter || 'الكل'}) ${targetDate ? `لجلسة ${formatDateString(targetDate)}` : ''}`}
             {reportType === 'viewing_tasks' && `كشف مهام الإطلاع وتصوير المستندات ${targetDate ? `لجلسة ${formatDateString(targetDate)}` : ''}`}
           </h1>
           
           <p className="text-lg font-bold text-slate-700">
             اختصاص معالي المستشار / {consultantName}
           </p>
        </div>

        {/* Document Body */}
        <div className="p-8">
          {/* Judgment Summary Cards */}
          {reportType === 'judgments' && judgmentSummary && generatedData.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 no-print">
              {[{k:'صالح',c:'emerald'},{k:'ضد',c:'rose'},{k:'حكم منه للخصومة',c:'amber'},{k:'تمهيدي',c:'indigo'}].map(({k,c}) => (
                <div key={k} className={`bg-${c}-50 border border-${c}-200 rounded-xl p-3 text-center`}>
                  <p className={`text-2xl font-black text-${c}-700`}>{judgmentSummary[k] || 0}</p>
                  <p className={`text-xs font-bold text-${c}-600 mt-0.5`}>{k}</p>
                </div>
              ))}
            </div>
          )}

          {reportType === 'judgments' && generatedData.length === 0 ? (
             <div className="text-center py-12 text-slate-400 no-print">
               <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
               <p className="font-bold">لا توجد أحكام مسجلة في هذا الشهر</p>
               <p className="text-xs font-bold mt-1">تأكد من تسجيل بيانات الحكم في جلسات الدعاوى</p>
             </div>
          ) : reportType !== 'judgments' && generatedData.length === 0 ? (
             <div className="text-center py-12 text-slate-400 no-print">
               <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
               <p className="font-bold">لا توجد بيانات مطابقة لمعايير التقرير</p>
             </div>
          ) : (
            <table className="w-full text-right border-collapse border border-slate-800 report-table">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-800 p-2 font-black text-sm w-12 text-center">م</th>
                  <th className="border border-slate-800 p-2 font-black text-sm w-40">رقم الدعوى</th>
                  <th className="border border-slate-800 p-2 font-black text-sm">المدعي</th>
                  <th className="border border-slate-800 p-2 font-black text-sm">المدعى عليه</th>
                  <th className="border border-slate-800 p-2 font-black text-sm w-28 text-center">تاريخ الجلسة</th>
                  <th className="border border-slate-800 p-2 font-black text-sm w-36">{reportType === 'judgments' ? 'نوع الحكم' : (reportType === 'tasks' || reportType === 'viewing_tasks') ? 'القرار' : 'القرار'}</th>
                  <th className="border border-slate-800 p-2 font-black text-sm w-36">{reportType === 'judgments' ? 'النتيجة' : reportType === 'tasks' ? 'المكلف بها' : reportType === 'viewing_tasks' ? 'المستندات المطلوبة' : 'ملاحظات'}</th>
                </tr>
              </thead>
              <tbody>
                {generatedData.map((row, index) => (
                  <tr key={row.id}>
                    <td className="border border-slate-800 p-2 text-sm text-center font-bold">{index + 1}</td>
                    <td className="border border-slate-800 p-2 text-sm font-bold">{row.caseNumber}</td>
                    <td className="border border-slate-800 p-2 text-sm font-bold">{row.plaintiff}</td>
                    <td className="border border-slate-800 p-2 text-sm font-bold">{row.defendant}</td>
                    <td className="border border-slate-800 p-2 text-sm font-bold text-center">{row.sessionDate}</td>
                    <td className="border border-slate-800 p-2 text-sm font-bold">{row.decision}</td>
                    <td className={`border border-slate-800 p-2 text-sm font-black text-center ${
                      reportType === 'judgments' 
                        ? (row.computeAs === 'صالح' ? 'text-emerald-700 bg-emerald-50' : row.computeAs === 'ضد' ? 'text-rose-700 bg-rose-50' : row.computeAs === 'تمهيدي' ? 'text-indigo-700 bg-indigo-50' : 'text-amber-700 bg-amber-50')
                        : reportType === 'viewing_tasks' ? 'text-indigo-700 bg-indigo-50/30' : ''
                    }`}>{row.notes}</td>
                  </tr>
                ))}
                {reportType !== 'judgments' && [...Array(Math.max(0, 10 - generatedData.length))].map((_, i) => (
                  <tr key={`empty-${i}`} className="h-10">
                    {[...Array(7)].map((_,j) => <td key={j} className="border border-slate-800 p-2"></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 hidden print:flex justify-between items-end mt-12 text-sm font-bold">
           <div className="text-center">
             <p className="mb-8">المستشار</p>
             <p>{consultantName}</p>
           </div>
           <div className="text-center">
             <p className="mb-8">المستشار المشرف</p>
             <p>......................</p>
           </div>
           <div className="text-center">
             <p className="mb-8">نائب رئيس الهيئة و رئيس القسم</p>
             <p>......................</p>
           </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
