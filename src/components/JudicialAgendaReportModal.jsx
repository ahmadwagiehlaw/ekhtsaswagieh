import React from 'react';
import { Scale, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function JudicialAgendaReportModal({ title, casesList, onClose }) {
  const navigate = useNavigate();
  const handlePrint = () => {
    const pw = window.open('', '_blank', 'width=820,height=700');
    pw.document.write(`<!DOCTYPE html><html dir="rtl"><head>
      <meta charset="UTF-8"><title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body{font-family:'Cairo',sans-serif;direction:rtl;padding:25px;color:#0f172a}
        .hdr{text-align:center;border-bottom:2px solid #b45309;padding-bottom:12px;margin-bottom:20px}
        .hdr h1{font-size:20px;font-weight:900;color:#1e3a8a}
        .hdr p{font-size:12px;font-weight:700;color:#b45309;margin-top:4px}
        .card{border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin-bottom:12px;page-break-inside:avoid}
        .num{font-size:14px;font-weight:900;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:4px}
        .ftr{text-align:center;font-size:9px;color:#94a3b8;margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px}
      </style>
    </head><body>
      <div class="hdr"><h1>${title}</h1><p>أجندة القضايا الحية</p></div>
      ${casesList.map(c => `<div class="card">
        <span class="num">رقم ${c['رقم الدعوى']||''} لسنة ${c['السنة']||''} ق</span>
        <p style="font-size:12px;font-weight:800;margin-top:8px">الطاعن: ${c['المدعي']||'غير محدد'}</p>
        <p style="font-size:11px;font-weight:700;color:#64748b">الموضوع: ${c['موضوع الدعوى']||'غير محدد'}</p>
        <p style="font-size:11px;background:#f8fafc;border-right:3px solid #cbd5e1;padding:8px;margin-top:6px">${c['القرار']||'لا يوجد قرار'}</p>
      </div>`).join('')}
      <p class="ftr">تم الإنشاء: ${new Date().toLocaleString('ar-EG')}</p>
    </body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 600);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 no-print">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b bg-[#0a131c] text-white shrink-0">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            <h2 className="font-black text-base text-white">{title} ({casesList.length})</h2>
          </div>
          <div className="flex items-center gap-2">
            {casesList.length > 0 && (
              <button onClick={handlePrint} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-[#0a131c] px-3.5 py-2 rounded-xl text-xs font-black transition">
                <Printer className="w-3.5 h-3.5" /> طباعة الأجندة
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white text-xl font-black">×</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-0 bg-slate-50">
          {casesList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-bold text-sm">لا توجد قضايا مطابقة لهذا التصنيف حالياً.</div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-xs font-black text-slate-500">رقم الدعوى</th>
                  <th className="p-3 text-xs font-black text-slate-500">الخصم / الموكل</th>
                  <th className="p-3 text-xs font-black text-slate-500">تاريخ الجلسة</th>
                  <th className="p-3 text-xs font-black text-slate-500 w-1/3">القرار / المنطوق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {casesList.map(c => (
                  <tr key={c.id} onClick={() => { onClose(); navigate(`/case/${c.id}`); }} className="hover:bg-amber-50/50 cursor-pointer transition bg-white group">
                    <td className="p-3">
                      <span className="text-xs font-black text-[#0f172a]">رقم {c['رقم الدعوى']}</span>
                      <span className="text-[10px] text-slate-500 block">لسنة {c['السنة']} ق</span>
                    </td>
                    <td className="p-3">
                      <p className="text-[11px] font-black text-slate-700">{c['المدعي'] || c['الطاعن'] || 'غير محدد'}</p>
                      <p className="text-[10px] text-slate-500">{c['المدعى_عليه'] || c['المدعى عليه'] || 'غير محدد'}</p>
                    </td>
                    <td className="p-3 text-[11px] font-bold text-slate-600">
                      {c['آخر جلسة'] || c['تاريخ الجلسة'] || ''}
                    </td>
                    <td className="p-3">
                      <p className="text-[11px] font-bold text-slate-700">{c['القرار'] || 'لا يوجد قرار'}</p>
                      <span className="text-[10px] text-amber-600 opacity-0 group-hover:opacity-100 transition block mt-1">عرض التفاصيل &larr;</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
