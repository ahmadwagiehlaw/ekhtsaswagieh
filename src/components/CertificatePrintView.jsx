import React, { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { useAppContext } from '../context/AppState';

export default function CertificatePrintView({ cases, sessionDate, template, onClose }) {
  const { settings } = useAppContext();
  
  const getFieldVal = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return '';
  };

  const handlePrint = () => {
    window.print();
  };

  // Function to inject case data into the template string
  const processTemplate = (c) => {
    let html = template?.content || '<div class="p-8 text-center text-red-500 font-bold">خطأ: لا يوجد قالب محدد</div>';
    
    // Define mappings from template variables to case data
    const variables = {
      '{{رقم_الدعوى}}': getFieldVal(c, ['رقم الدعوى']) || '',
      '{{السنة}}': getFieldVal(c, ['السنة']) || '',
      '{{المدعي}}': getFieldVal(c, ['المدعي']) || '',
      '{{ضد}}': getFieldVal(c, ['المطعون ضده', 'ضد', 'المطعون ضدنا', 'المدعى عليه', 'مدعى علينا']) || '',
      '{{الجلسة_الحالية}}': sessionDate || '',
      '{{القرار}}': getFieldVal(c, ['القرار']) || '',
      '{{نوع_الجلسة}}': getFieldVal(c, ['نوع الجلسة']) || '',
      '{{اسم_المستشار}}': settings?.consultantName || 'أحمد وجيه',
      '{{المحكمة}}': getFieldVal(c, ['المحكمة']) || '',
      '{{الدائرة}}': getFieldVal(c, ['الدائرة']) || '',
      '{{الصفة}}': getFieldVal(c, ['الصفة']) || '',
      '{{الملاحظات}}': getFieldVal(c, ['الملاحظات']) || '',
      '{{رقم_الحفظ}}': getFieldVal(c, ['رقم الحفظ']) || '',
      '{{حكم_تمهيدي}}': getFieldVal(c, ['حكم تمهيدي', 'التمهيدي']) || '',
      '{{منطوق_الحكم}}': getFieldVal(c, ['المنطوق']) || '',
      '{{تصنيف_الحكم}}': getFieldVal(c, ['تصنيف الحكم']) || '',
      '{{الرول}}': getFieldVal(c, ['الرول']) || '',
    };

    // Replace all occurrences of each variable
    for (const [key, value] of Object.entries(variables)) {
      // Use regex with global flag to replace all occurrences
      const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
      html = html.replace(regex, value);
    }
    return html;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-500 flex flex-col items-center overflow-y-auto">
      {/* Non-printable UI header */}
      <div className="w-full bg-slate-800 text-white p-4 flex justify-between items-center sticky top-0 print:hidden z-10 shadow-lg">
        <div>
          <h2 className="font-bold">معاينة الطباعة - {template?.name || 'مستندات'}</h2>
          <p className="text-xs text-slate-300">تم تجهيز {cases.length} مستند (صفحة لكل دعوى)</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition">
            <Printer className="w-4 h-4"/> طباعة / حفظ PDF
          </button>
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition">
            <X className="w-5 h-5"/>
          </button>
        </div>
      </div>

      {/* Printable Area - Rendered for A4 */}
      <div className="w-full max-w-[210mm] print:w-full print:max-w-none print:m-0 mx-auto my-8 print:my-0 shadow-2xl print:shadow-none bg-white">
        {cases.map((c, i) => (
          <div key={c.id} className={`w-full min-h-[297mm] p-12 relative bg-white print:p-8 print:[break-after:page] ${i > 0 ? 'border-t-4 border-slate-200 print:border-none' : ''}`}>
            {/* Dynamic Template Content */}
            <div 
              className="w-full h-full font-cairo" 
              dangerouslySetInnerHTML={{ __html: processTemplate(c) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
