import React from 'react';
import { FileText, Printer } from 'lucide-react';
import { getJColor } from '../utils/helpers';

export default function PrintReportModal({ stats, settings, selectedMonthStats, selectedMonth, selectedYear, onClose }) {
  const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  const consultantName = settings?.consultantName || 'المستشار';

  const handlePrint = () => {
    const content = document.getElementById('dash-print-content');
    if (!content) return;
    
    // Copy all styles from the parent window so Tailwind works perfectly in the print window
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(s => s.outerHTML)
      .join('\n');

    const pw = window.open('', '_blank', 'width=820,height=700');
    pw.document.write(`<!DOCTYPE html><html dir="rtl"><head>
      <meta charset="UTF-8"><title>تقرير - ${monthLabel}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
      ${styles}
      <style>
      @media print {
        body { padding: 20px !important; background: #fff !important; }
        /* Force browsers to print background colors and shadows */
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
      body { font-family: 'Cairo', sans-serif; background: #fff; padding: 28px; color: #0f172a; }
      .footer{text-align:center;font-size:10px;font-weight:700;color:#94a3b8;margin-top:30px;padding-top:15px;border-top:1px solid #e2e8f0;page-break-inside:avoid;}
      </style></head><body>
      ${content.innerHTML}
      <p class="footer">تم إنشاء هذا التقرير تلقائياً بواسطة منصة اختصاصي — ${new Date().toLocaleString('ar-EG')}</p>
      </body></html>`);
    pw.document.close();
    setTimeout(() => {
        pw.print();
        pw.close();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <h2 className="font-black text-navy-900">تقرير {monthLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 bg-[#0f172a] text-amber-400 px-4 py-2 rounded-xl text-sm font-black hover:bg-slate-800 transition shadow-sm">
              <Printer className="w-4 h-4" /> طباعة / PDF
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 text-lg font-black">×</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6" id="dash-print-content">
          <div className="text-center mb-5 pb-4 border-b-2 border-slate-900">
            <h1 className="text-2xl font-black text-slate-900">تقرير إحصائيات المكتب</h1>
            <p className="text-sm font-bold text-slate-500 mt-1">شهر {monthLabel}</p>
            <p className="text-xs font-black text-amber-600 mt-1">مكتب / {consultantName}</p>
          </div>
          <p className="text-sm font-black text-slate-900 mb-3 pb-2 border-b-2 border-slate-900">المؤشرات الرئيسية</p>
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { l: 'القضايا النشطة (قادمة)', v: stats.activeCasesCount },
              { l: 'إجمالي المتداول', v: stats.ongoingCount },
              { l: 'محجوز للحكم', v: stats.reservedCount },
              { l: 'المحكوم فيها', v: stats.judgedCount },
            ].map((s, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-slate-900">{s.v}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">{s.l}</p>
              </div>
            ))}
          </div>
          <p className="text-sm font-black text-slate-900 mb-3 pb-2 border-b-2 border-slate-900">إحصائيات {monthLabel}</p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-amber-600">{selectedMonthStats.sessions}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1">متداول الشهر</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-blue-600">{selectedMonthStats.memos}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1">مذكرات</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-emerald-600">{selectedMonthStats.judgments.total}</p>
              <p className="text-[10px] font-bold text-slate-500 mt-1">أحكام</p>
            </div>
          </div>
          {selectedMonthStats.judgments.total > 0 && (
            <>
              <p className="text-sm font-black text-slate-900 mb-3 pb-2 border-b-2 border-slate-900">تفصيل الأحكام</p>
              <div className="grid grid-cols-5 gap-2 mb-5">
                {[
                  { l: 'صالح', v: selectedMonthStats.judgments.good, c: '#10b981', bg: '#dcfce7' },
                  { l: 'ضد', v: selectedMonthStats.judgments.bad, c: '#ef4444', bg: '#fee2e2' },
                  { l: 'مختلط', v: selectedMonthStats.judgments.mixed, c: '#6366f1', bg: '#e0e7ff' },
                  { l: 'وقف', v: selectedMonthStats.judgments.stop, c: '#f97316', bg: '#ffedd5' },
                  { l: 'اعتبار', v: selectedMonthStats.judgments.consideration, c: '#eab308', bg: '#fef9c3' },
                  
                ].map((j, i) => (
                  <div key={i} className="rounded-xl p-3 text-center" style={{ backgroundColor: j.bg }}>
                    <p className="text-xl font-black" style={{ color: j.c }}>{j.v}</p>
                    <p className="text-[10px] font-bold text-slate-600 mt-1">{j.l}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          {stats.topJudgments.length > 0 && (
            <>
              <p className="text-sm font-black text-slate-900 mb-3 pb-2 border-b-2 border-slate-900">تصنيف الأحكام الكلية</p>
              <div className="space-y-2 mb-5">
                {stats.topJudgments.map(([name, count]) => {
                  const total = stats.topJudgments.reduce((s, c) => s + c[1], 0);
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span>{name}</span><span>{count} ({Math.round(count / total * 100)}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(count / total * 100)}%`, backgroundColor: getJColor(name) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {stats.topOpponents.length > 0 && (
            <>
              <p className="text-sm font-black text-slate-900 mb-3 pb-2 border-b-2 border-slate-900">أبرز الجهات رافعة الدعوى</p>
              <div className="space-y-1.5">
                {stats.topOpponents.map(([name, count], i) => (
                  <div key={i} className="flex justify-between items-center border border-slate-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-bold w-4">{i + 1}</span>
                      <span className="text-sm font-bold text-slate-900">{name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-500">{count} ملف</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
