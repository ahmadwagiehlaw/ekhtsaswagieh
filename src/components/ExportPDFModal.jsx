import React, { useState, useEffect } from 'react';
import { X, Printer, Settings } from 'lucide-react';
import { useAppContext } from '../context/AppState';

export default function ExportPDFModal({ isOpen, onClose, data, defaultTitle = "تقرير القضايا" }) {
  const { schema, settings } = useAppContext();
  const [reportTitle, setReportTitle] = useState(() => {
    return localStorage.getItem('reportDefaultTitle') || defaultTitle;
  });

  // Load selected fields from localStorage or schema defaults
  const [selectedFields, setSelectedFields] = useState(() => {
    try {
      const saved = localStorage.getItem('reportSelectedFields');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return schema.filter(f => f.visible).map(f => f.id);
  });

  const [consultantName, setConsultantName] = useState(() => {
    const saved = localStorage.getItem('reportConsultantName');
    if (saved) return saved;
    return settings?.consultantName
      ? (settings.consultantName.startsWith('مستشار')
        ? settings.consultantName
        : `مستشار ${settings?.consultantName || 'أحمد وجيه'}`)
      : `مستشار ${settings?.consultantName || 'أحمد وجيه'}`;
  });

  const [consultantSub, setConsultantSub] = useState(() => {
    const saved = localStorage.getItem('reportConsultantSub');
    if (saved !== null && saved !== undefined) return saved;
    return 'المستشار بقسم بالإدارية العليا  (أ) ';
  });

  const [showSavedIndicator, setShowSavedIndicator] = useState(false);

  // Save Defaults
  const handleSaveDefaults = () => {
    localStorage.setItem('reportDefaultTitle', reportTitle);
    localStorage.setItem('reportConsultantName', consultantName);
    localStorage.setItem('reportConsultantSub', consultantSub);
    localStorage.setItem('reportSelectedFields', JSON.stringify(selectedFields));
    setShowSavedIndicator(true);
    setTimeout(() => {
      setShowSavedIndicator(false);
    }, 2000);
  };

  // Handle schema loading if no saved selection exists
  useEffect(() => {
    const saved = localStorage.getItem('reportSelectedFields');
    if (!saved && schema && schema.length > 0) {
      setSelectedFields(schema.filter(f => f.visible).map(f => f.id));
    }
  }, [schema]);

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
            <th class="serial">م</th>
            ${activeSchema.map(f => `<th>${f.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map((row, idx) => `
            <tr>
              <td class="serial">${idx + 1}</td>
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
              padding: 15mm;
              color: #0f172a;
              background-color: #ffffff;
            }
            .report-header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 3px double #0f172a;
              padding-bottom: 12px;
              margin-bottom: 25px;
            }
            .right-header {
              text-align: right;
            }
            .right-header h1 {
              margin: 0 0 4px 0;
              font-size: 22px;
              font-weight: 900;
              color: #0f172a;
            }
            .date-badge {
              font-size: 10px;
              color: #64748b;
              font-weight: bold;
            }
            .left-header {
              text-align: left;
            }
            .consultant-title {
              font-size: 15px;
              font-weight: bold;
              color: #0f172a;
              margin-bottom: 2px;
            }
            .consultant-sub {
              font-size: 10px;
              color: #64748b;
              font-weight: bold;
              max-width: 250px;
              line-height: 1.4;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 10px;
              text-align: right;
              line-height: 1.5;
            }
            th {
              background-color: #0f172a;
              color: #ffffff;
              font-weight: 900;
              font-size: 11px;
              border: 1px solid #0f172a;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            td.serial, th.serial {
              text-align: center;
              font-weight: bold;
              width: 35px;
            }
            td.serial {
              background-color: #f8fafc;
            }
            @media print {
              body { padding: 0; background-color: #fff; }
              .no-print { display: none !important; }
            }
            @page { margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="no-print" style="position: fixed; top: 15px; left: 15px; z-index: 9999;">
            <button onclick="window.close()" style="background: #e11d48; color: #fff; padding: 10px 20px; border: none; border-radius: 8px; font-weight: 900; font-size: 14px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: 'Cairo', sans-serif;">
              إغلاق وعودة للتطبيق ✕
            </button>
          </div>
          <div class="report-header-container">
            <div class="right-header">
              <h1>${reportTitle}</h1>
              <span class="date-badge">تم الإصدار بتاريخ: ${new Date().toLocaleDateString('ar-EG')}</span>
            </div>
            <div class="left-header">
              ${consultantName ? `<div class="consultant-title">${consultantName}</div>` : ''}
              ${consultantSub ? `<div class="consultant-sub">${consultantSub}</div>` : ''}
            </div>
          </div>
          ${tableHtml}
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
            <label className="text-[11px] font-black text-slate-500 block mb-1.5">اسم المستشار</label>
            <input
              type="text"
              value={consultantName}
              onChange={(e) => setConsultantName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
            />
          </div>

          <div>
            <label className="text-[11px] font-black text-slate-500 block mb-1.5">صفة المستشار (عنوان فرعي)</label>
            <input
              type="text"
              value={consultantSub}
              onChange={(e) => setConsultantSub(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 transition"
              placeholder="مثال: المستشار بقسم بالإدارية العليا  (أ) "
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-400" />
                <label className="text-xs font-black text-navy-900">اختر الحقول المطلوب تضمينها</label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFields(schema.filter(f => f.visible).map(f => f.id))}
                  className="text-[10px] text-indigo-600 font-bold hover:underline bg-indigo-50 px-2 py-0.5 rounded"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFields([])}
                  className="text-[10px] text-rose-600 font-bold hover:underline bg-rose-50 px-2 py-0.5 rounded"
                >
                  إلغاء الكل
                </button>
              </div>
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2.5 shrink-0">
          {showSavedIndicator && (
            <div className="text-center text-xs font-black text-emerald-600 animate-fade-in bg-emerald-50 py-1.5 rounded-lg border border-emerald-200">
              تم حفظ الإعدادات كافتراضية بنجاح!
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl hover:bg-slate-100 transition text-xs"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSaveDefaults}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition text-xs"
            >
              حفظ كافتراضي
            </button>
            <button
              onClick={handlePrint}
              className="flex-[2] bg-navy-900 text-amber-300 font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md hover:bg-navy-800 transition text-xs"
            >
              <Printer className="w-4 h-4" /> طباعة / تصدير PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
