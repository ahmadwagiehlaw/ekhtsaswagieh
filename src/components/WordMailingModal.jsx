import React, { useState } from 'react';
import { X, FileText, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useUI } from '../context/UIContext';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import { getSafeDateObj } from '../utils/dateUtils';

// Helper to safely get field values
const getFieldVal = (obj, keys) => {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
};

export default function WordMailingModal({ isOpen, onClose, selectedCases, sessionDate }) {
  const { toast } = useUI();
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!file) {
      toast('الرجاء اختيار قالب وورد (docx) أولاً', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onerror = () => {
        throw new Error('فشل قراءة الملف');
      };
      
      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const zip = new PizZip(content);
          
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
          });

          // Prepare the cases data for the template
          const mappedCases = selectedCases.map(c => {
            const session = c.sessions?.find(s => s.date === sessionDate) || {};
            const j = session.judgment || {};
            
            return {
              'رقم_الدعوى': getFieldVal(c, ['رقم الدعوى', 'رقم الطعن']) || '',
              'السنة': getFieldVal(c, ['السنة']) || '',
              'المدعي': getFieldVal(c, ['المدعي', 'الطاعن']) || '',
              'المدعى_عليه': getFieldVal(c, ['المدعى_عليه', 'المطعون ضده', 'ضد']) || '',
              'الصفة': getFieldVal(c, ['الصفة', 'صفة']) || '',
              'نوع_الحكم': j.type || j._type || session.shortJudgment || '',
              'فئة_الحكم': j.category || j._category || session.judgmentCategory || '',
              'تصنيف_الحكم': j.result || j._result || session.judgmentClassification || '',
              'المنطوق': j.fullVerdict || j._verdict || session.verdict || '',
              'القرار': getFieldVal(c, ['القرار']) || '',
              'تاريخ_الجلسة': sessionDate || '',
            };
          });

          // Render the document (replace all occurrences of {fields} and {#cases}...{/cases} loop)
          doc.render({
            cases: mappedCases,
            // Also provide a flat list of variables representing the FIRST case selected, 
            // just in case they didn't use a {#cases} loop and only selected 1 case.
            ...(mappedCases[0] || {})
          });

          const blob = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });

          saveAs(blob, `شهادات_مجمعة_${sessionDate.replace(/\//g, '-')}.docx`);
          toast('تم إنشاء مستند الوورد بنجاح! 🎉', 'success');
          onClose();
        } catch (error) {
          console.error(error);
          if (error.properties && error.properties.errors) {
            console.log('Docxtemplater Errors:', error.properties.errors);
          }
          toast('حدث خطأ أثناء معالجة القالب. تأكد من صحة علامات الأقواس المتعرجة.', 'error');
        } finally {
          setIsProcessing(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      toast('حدث خطأ غير متوقع', 'error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-800">توليد مستندات وورد (Mail Merge)</h3>
              <p className="text-[10px] font-bold text-slate-500">تم تحديد {selectedCases.length} دعوى</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-1.5 rounded-lg transition-colors border border-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Instructions Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-right">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-blue-800">تعليمات تجهيز القالب (.docx)</h4>
              <p className="text-[10px] font-bold text-blue-700 leading-relaxed">
                لكي يتعرف التطبيق على الأماكن التي يجب ملؤها ببيانات الدعوى، يرجى كتابة المتغيرات بين أقواس متعرجة داخل القالب (مثال: {'{رقم_الدعوى}'}، {'{السنة}'}، {'{المدعي}'}، {'{المنطوق}'}).
              </p>
              <p className="text-[10px] font-bold text-emerald-700 bg-emerald-100/50 p-2 rounded-lg mt-2 border border-emerald-200/50 leading-relaxed">
                <strong>ملاحظة هامة:</strong> لطباعة جميع الدعاوى في ملف واحد، أضف {'{#cases}'} في أعلى القالب، و {'{/cases}'} في أسفله. يمكنك إضافة فاصل صفحات (Page Break) بينهما لتكون كل دعوى في صفحة مستقلة.
              </p>
            </div>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="text-[11px] font-black text-slate-700 block mb-2">اختر قالب الوورد (.docx)</label>
            <div className="relative">
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="word-template-upload"
              />
              <label
                htmlFor="word-template-upload"
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  file ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {file ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-blue-500 mb-2" />
                    <span className="text-sm font-black text-blue-700">{file.name}</span>
                    <span className="text-[10px] font-bold text-blue-500 mt-1">{(file.size / 1024).toFixed(1)} KB</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <span className="text-xs font-bold text-slate-600">انقر لاختيار ملف، أو اسحب الملف وأفلته هنا</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-1">يدعم صيغة .docx فقط</span>
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={!file || isProcessing}
            className={`flex-1 font-bold text-sm py-2.5 rounded-xl shadow-sm transition-all flex justify-center items-center gap-2 ${
              !file || isProcessing
                ? 'bg-blue-300 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري المعالجة...
              </>
            ) : (
              'توليد الملف الجاهز للطباعة'
            )}
          </button>
          <button
            onClick={onClose}
            className="px-6 font-bold text-sm text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 py-2.5 rounded-xl transition-all"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
