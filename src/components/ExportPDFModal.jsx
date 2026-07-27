import React, { useState } from 'react';
import { X, Printer, Settings } from 'lucide-react';
import { useAppContext } from '../context/AppState';

export default function ExportPDFModal({ isOpen, onClose, data, defaultTitle = "تقرير القضايا" }) {
  const { schema, settings } = useAppContext();
  const [reportTitle, setReportTitle] = useState(defaultTitle);
  const [selectedFields, setSelectedFields] = useState(
    schema.filter(f => f.visible).map(f => f.id)
  );

  if (!isOpen) return null;

  const toggleField = (fieldId) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    );
  };

  const handlePrint = () => {
    // Generate a printable window
    const printWindow = window.open('', '', 'width=900,height=650');
    
    // Sort fields based on schema order to maintain consistency
    const activeSchema = schema.filter(f => selectedFields.includes(f.id));

    let tableHtml = `
      <table>
        <thead>
          <tr>
            <th>م</th>
            ${activeSchema.map(f => `<th>${f.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map((row, idx) => `
            <tr>
              <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
              ${activeSchema.map(f => `<td>${row[f.id] || '-'}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const htmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <title>${reportTitle}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body {
              font-family: 'Cairo', sans-serif;
              margin: 0;
              padding: 20mm;
              color: #0a131c;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #c9a65f;
              padding-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 900;
              color: #0a131c;
            }
            .header p {
              margin: 5px 0 0 0;
              font-size: 14px;
              font-weight: 700;
              color: #64748b;
            }
            .title {
              text-align: center;
              margin: 20px 0;
              font-size: 20px;
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px;
              text-align: right;
            }
            th {
              background-color: #f8fafc;
              font-weight: 900;
              color: #0f172a;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${settings.consultantName || 'المستشار أحمد وجيه'}</h1>
            <p>المحامي بالنقض والإدارية والدستورية العليا</p>
          </div>
          <div class="title">${reportTitle}</div>
          ${tableHtml}
          <div style="margin-top: 30px; text-align: left; font-size: 10px; color: #94a3b8;">
            تم الإصدار بتاريخ: ${new Date().toLocaleDateString('ar-EG')}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Give it a tiny bit of time to load the font before printing
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-navy-900 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-amber-300">
            <Printer className="w-5 h-5" />
            <h2 className="font-black text-lg">تصدير تقرير (PDF / طباعة)</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-5">
          
          <div>
            <label className="text-[11px] font-black text-slate-500 block mb-1.5">عنوان التقرير</label>
            <input 
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
              <Settings className="w-4 h-4 text-slate-400" />
              <label className="text-xs font-black text-navy-900">اختر الحقول المطلوب تضمينها</label>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {schema.filter(f => f.visible).map(field => (
                <label key={field.id} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={selectedFields.includes(field.id)}
                    onChange={() => toggleField(field.id)}
                    className="w-4 h-4 rounded text-navy-900 focus:ring-navy-900"
                  />
                  <span className="text-xs font-bold text-slate-600 group-hover:text-navy-900 transition">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="flex-1 bg-white border border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-100 transition"
          >
            إلغاء
          </button>
          <button 
            onClick={handlePrint}
            className="flex-[2] bg-navy-900 text-amber-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-navy-800 transition"
          >
            <Printer className="w-4 h-4" /> طباعة / تصدير PDF
          </button>
        </div>

      </div>
    </div>
  );
}
