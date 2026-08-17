import React, { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { formatDateString } from '../utils/dateUtils';

export default function CertificatePrintView({ cases, sessionDate, template, onClose, repeatForDefendants = false }) {
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
  const processTemplate = (c, defendantOverride = null) => {
    let html = template?.content || '<div class="p-8 text-center text-red-500 font-bold">خطأ: لا يوجد قالب محدد</div>';
    
    const latestSessionDate = formatDateString(c.sessions && c.sessions.length > 0 ? c.sessions[0].date : getFieldVal(c, ['تاريخ الجلسة']));
    
    const legacyAppellee = getFieldVal(c, ['المدعى_عليه', 'المدعى عليه', 'المدعي عليه', 'مدعى علينا', 'المطعون ضده', 'المطعون ضدنا', 'المطعون ضدها', 'ضد', 'مدعى عليه', 'مدعي عليه']);
    const legacyAddress = getFieldVal(c, ['عنوان المدعى عليه', 'عنوان المدعي عليه', 'عنوان المطعون ضده', 'عنوان_المدعى_عليه']);
    const legacyChosenAddress = getFieldVal(c, ['المقر المختار', 'المقر_المختار']);
    
    const effectiveDefendants = (c.defendantsList && c.defendantsList.length > 0) 
      ? c.defendantsList 
      : ((legacyAppellee || legacyAddress || legacyChosenAddress) 
          ? [{ id: 'legacy', name: legacyAppellee || '', address: legacyAddress || '', chosenAddress: legacyChosenAddress || '' }] 
          : []);

    let finalDefendantName = '';
    let finalDefendantAddress = '';
    let finalChosenAddress = '';
    
    if (defendantOverride) {
      finalDefendantName = defendantOverride.name || '';
      finalDefendantAddress = defendantOverride.address || '';
      finalChosenAddress = defendantOverride.chosenAddress || '';
    } else {
      finalDefendantName = effectiveDefendants.length > 0 ? effectiveDefendants.map(d => d.name).join(' و ') : legacyAppellee;
      finalDefendantAddress = effectiveDefendants.length > 0 ? effectiveDefendants.map(d => d.address).filter(Boolean).join(' و ') : legacyAddress;
      finalChosenAddress = effectiveDefendants.length > 0 ? effectiveDefendants.map(d => d.chosenAddress).filter(Boolean).join(' و ') : legacyChosenAddress;
    }

    // Define mappings from template variables to case data
    const variables = {
      '{{رقم_الدعوى}}': getFieldVal(c, ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']) || '',
      '{{السنة}}': getFieldVal(c, ['السنة', 'سنة', 'year', 'عام']) || '',
      '{{المدعي}}': getFieldVal(c, ['المدعي', 'الطاعن', 'المدعى', 'مستأنف', 'المستأنف', 'المدعي_1', 'المدعون']) || '',
      '{{المدعى_عليه}}': finalDefendantName || getFieldVal(c, ['المدعى_عليه', 'المدعى عليه', 'المدعي عليه', 'مدعى علينا', 'المطعون ضده', 'المطعون ضدنا', 'المطعون ضدها', 'ضد', 'مدعى عليه', 'مدعي عليه']) || '',
      '{{المدعي_عليه}}': finalDefendantName || getFieldVal(c, ['المدعى_عليه', 'المدعى عليه', 'المدعي عليه', 'مدعى علينا', 'المطعون ضده', 'المطعون ضدنا', 'المطعون ضدها', 'ضد']) || '',
      '{{المطعون_ضده}}': finalDefendantName || getFieldVal(c, ['المطعون ضده', 'المطعون ضدنا', 'المطعون ضدها', 'المدعى_عليه', 'المدعى عليه']) || '',
      '{{الجلسة_الحالية}}': latestSessionDate || formatDateString(sessionDate) || '',
      '{{آخر_جلسة}}': latestSessionDate || formatDateString(sessionDate) || formatDateString(getFieldVal(c, ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة'])) || '',
      '{{تاريخ_الجلسة}}': latestSessionDate || formatDateString(sessionDate) || '',
      '{{القرار}}': getFieldVal(c, ['القرار', 'قرار الجلسة', 'المنطوق', 'منطوق الجلسة']) || '',
      '{{نوع_الجلسة}}': getFieldVal(c, ['نوع الجلسة', 'نوع_الجلسة']) || '',
      '{{اسم_المستشار}}': settings?.consultantName || '',
      '{{المحكمة}}': getFieldVal(c, ['المحكمة', 'اسم المحكمة']) || '',
      '{{الدائرة}}': getFieldVal(c, ['الدائرة', 'رقم الدائرة']) || '',
      '{{الصفة}}': getFieldVal(c, ['الصفة', 'صفتنا', 'الصفة_القانونية']) || '',
      '{{الملاحظات}}': getFieldVal(c, ['الملاحظات', 'ملاحظات', 'ملاحظة']) || '',
      '{{رقم_الحفظ}}': getFieldVal(c, ['رقم الحفظ', 'رقم_الحفظ']) || '',
      '{{حكم_تمهيدي}}': getFieldVal(c, ['حكم تمهيدي', 'التمهيدي', 'حكم_تمهيدي']) || '',
      '{{منطوق_الحكم}}': getFieldVal(c, ['منطوق الحكم', 'المنطوق', 'منطوق_الحكم']) || '',
      '{{تصنيف_الحكم}}': getFieldVal(c, ['تصنيف الحكم', 'تصنيف_الحكم', 'نوع الحكم']) || '',
      '{{الرول}}': getFieldVal(c, ['الرول', 'رول الجلسة', 'رول_الجلسة']) || '',
      '{{تصنيف_الدعوى}}': getFieldVal(c, ['تصنيف الدعوى', 'تصنيف_الدعوى']) || '',
      '{{موضوع_الدعوى}}': getFieldVal(c, ['موضوع الدعوى', 'موضوع_الدعوى', 'ملخص الطعن']) || '',
      '{{عنوان_المدعي}}': getFieldVal(c, ['عنوان المدعي', 'عنوان الطاعن', 'عنوان_المدعي']) || '',
      '{{عنوان_المدعى_عليه}}': finalDefendantAddress || getFieldVal(c, ['عنوان المدعى عليه', 'عنوان المدعي عليه', 'عنوان المطعون ضده', 'عنوان_المدعى_عليه']) || '',
      '{{عنوان_المدعي_عليه}}': finalDefendantAddress || '',
      '{{المقر_المختار}}': finalChosenAddress || getFieldVal(c, ['المقر المختار', 'المقر_المختار']) || '',
      '{{مكان_الملف}}': getFieldVal(c, ['مكان الملف', 'مكان_الملف']) || '',
      '{{طلبات_المدعي}}': getFieldVal(c, ['طلبات المدعي', 'طلبات الطاعن', 'طلبات_المدعي']) || '',
      '{{منطوق_حكم_أول_درجة}}': getFieldVal(c, ['منطوق حكم أول درجة', 'منطوق_حكم_أول_درجة']) || '',
      '{{حكم_أول_درجة}}': getFieldVal(c, ['حكم محكمة أول درجة', 'حكم_أول_درجة']) || '',
      '{{محكمة_أول_درجة}}': getFieldVal(c, ['محكمة أول درجة', 'محكمة_أول_درجة']) || '',
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
        {cases.map((c, i) => {
          const legacyAppellee = getFieldVal(c, ['المدعى_عليه', 'المدعى عليه', 'مدعى علينا', 'المطعون ضده', 'المطعون ضدنا', 'المطعون ضدها', 'ضد']);
          const legacyAddress = getFieldVal(c, ['عنوان المدعى عليه', 'عنوان المطعون ضده', 'عنوان_المدعى_عليه']);
          const legacyChosenAddress = getFieldVal(c, ['المقر المختار', 'المقر_المختار']);
          
          const effectiveDefendants = (c.defendantsList && c.defendantsList.length > 0) 
            ? c.defendantsList 
            : ((legacyAppellee || legacyAddress || legacyChosenAddress) 
                ? [{ id: 'legacy', name: legacyAppellee || '', address: legacyAddress || '', chosenAddress: legacyChosenAddress || '' }] 
                : []);
                
          if (repeatForDefendants && effectiveDefendants.length > 0) {
            return effectiveDefendants.map((def, defIdx) => (
              <div key={`${c.id}-${def.id || defIdx}`} className={`w-full min-h-[297mm] p-12 relative bg-white print:p-8 print:[break-after:page] ${(i > 0 || defIdx > 0) ? 'border-t-4 border-slate-200 print:border-none' : ''}`}>
                <div 
                  className="w-full h-full font-cairo" 
                  dangerouslySetInnerHTML={{ __html: processTemplate(c, def) }}
                />
              </div>
            ));
          }

          return (
            <div key={c.id} className={`w-full min-h-[297mm] p-12 relative bg-white print:p-8 print:[break-after:page] ${i > 0 ? 'border-t-4 border-slate-200 print:border-none' : ''}`}>
              {/* Dynamic Template Content */}
              <div 
                className="w-full h-full font-cairo" 
                dangerouslySetInnerHTML={{ __html: processTemplate(c) }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
