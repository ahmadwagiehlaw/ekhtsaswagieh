import React, { useState, useEffect } from 'react';
import { BarChart2, Printer, Search, FileText, Calendar, Filter, Download } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { formatDateString } from '../utils/dateUtils';

export default function Reports() {
  const { cases, settings } = useAppContext();
  
  const [reportType, setReportType] = useState('memos'); // 'memos', 'judgments', 'prep', 'custom'
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetDate, setTargetDate] = useState(''); // For specific date reports like session prep
  const [consultantName, setConsultantName] = useState(settings?.consultantName || 'م. أحمد وجيه');
  
  const [generatedData, setGeneratedData] = useState([]);

  // Generate Report
  const generateReport = () => {
    let results = [];
    
    if (reportType === 'memos') {
      const monthStr = targetMonth.toString().padStart(2, '0');
      const targetPrefix = `${targetYear}-${monthStr}`;
      
      cases.forEach(c => {
        const procedures = Array.isArray(c.procedures) ? c.procedures : Object.values(c.procedures || {});
        procedures.forEach(proc => {
          if (proc.title?.includes('مذكرة') && proc.date?.startsWith(targetPrefix)) {
            // Find session date
            const sessionDate = c['تاريخ الجلسة'] || c['أخر جلسة'] || c['آخر جلسة'] || '';
            const decision = c['القرار'] || '';
            
            results.push({
              id: c.id + proc.id,
              caseNumber: `${c['رقم الدعوى'] || c.id} لسنة ${c['السنة']}`,
              plaintiff: c['المدعي'] || '',
              defendant: c['المطعون ضده'] || c['المدعى عليه'] || '',
              sessionDate: formatDateString(sessionDate),
              decision: decision,
              notes: proc.notes || ''
            });
          }
        });
      });
      setGeneratedData(results);
    } else if (reportType === 'prep') {
      // Session prep
      if (!targetDate) return;
      cases.forEach(c => {
        const sessionDate = c['تاريخ الجلسة'] || c['أخر جلسة'] || c['آخر جلسة'] || '';
        if (sessionDate === targetDate) {
          results.push({
            id: c.id,
            caseNumber: `${c['رقم الدعوى'] || c.id} لسنة ${c['السنة']}`,
            plaintiff: c['المدعي'] || '',
            defendant: c['المطعون ضده'] || c['المدعى عليه'] || '',
            sessionDate: formatDateString(sessionDate),
            decision: c['القرار'] || '',
            notes: ''
          });
        }
      });
      setGeneratedData(results);
    }
  };

  useEffect(() => {
    generateReport();
  }, [reportType, targetMonth, targetYear, targetDate, cases]);

  const handlePrint = () => {
    window.print();
  };

  const getMonthName = (monthNum) => {
    const months = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return months[monthNum] || '';
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      
      {/* Controls Section (Hidden in Print) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 no-print">
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
              <option value="judgments">الإحصائية الشهرية (قريباً)</option>
            </select>
          </div>

          {reportType === 'memos' && (
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

          {reportType === 'prep' && (
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
           </h1>
           
           <p className="text-lg font-bold text-slate-700">
             اختصاص معالي المستشار / {consultantName}
           </p>
        </div>

        {/* Document Body */}
        <div className="p-8">
          {reportType === 'judgments' ? (
             <div className="text-center py-12 text-slate-400 no-print">
               <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
               <p className="font-bold">سيتم تفعيل هذه الإحصائية بعد الانتهاء من حقول الأحكام</p>
             </div>
          ) : generatedData.length === 0 ? (
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
                  <th className="border border-slate-800 p-2 font-black text-sm w-28 text-center">أخر جلسة</th>
                  <th className="border border-slate-800 p-2 font-black text-sm w-32">القرار</th>
                  <th className="border border-slate-800 p-2 font-black text-sm w-40">ملاحظات</th>
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
                    <td className="border border-slate-800 p-2 text-sm font-bold text-slate-600">{row.notes}</td>
                  </tr>
                ))}
                {/* Empty rows to match the image layout */}
                {[...Array(Math.max(0, 10 - generatedData.length))].map((_, i) => (
                  <tr key={`empty-${i}`} className="h-10">
                    <td className="border border-slate-800 p-2"></td>
                    <td className="border border-slate-800 p-2"></td>
                    <td className="border border-slate-800 p-2"></td>
                    <td className="border border-slate-800 p-2"></td>
                    <td className="border border-slate-800 p-2"></td>
                    <td className="border border-slate-800 p-2"></td>
                    <td className="border border-slate-800 p-2"></td>
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
    </div>
  );
}
