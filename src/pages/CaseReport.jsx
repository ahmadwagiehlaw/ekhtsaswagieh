import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppState';
import { Printer, ArrowLeft } from 'lucide-react';
import { formatDateString } from '../utils/dateUtils';

export default function CaseReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cases, settings } = useAppContext();

  const caseData = cases.find(c => c.id === id);

  if (!caseData) {
    return <div className="p-8 text-center text-slate-500 font-bold">جاري تحميل بيانات القضية...</div>;
  }

  const sessions = Array.isArray(caseData.sessions) ? caseData.sessions : Object.values(caseData.sessions || {});
  sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 animate-fade-in pb-20">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 no-print">
          <button
            onClick={() => navigate(`/case/${id}`)}
            className="bg-white text-slate-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-100 transition shadow-sm border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" /> رجوع للملف
          </button>

          <button
            onClick={() => window.print()}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-black hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> طباعة التقرير
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none p-8 print-area">
          {/* Header */}
          <div className="text-center border-b-2 border-slate-800 pb-6 mb-8 relative">
            <div className="absolute top-0 right-0 text-right text-sm font-bold hidden print:block">
              <p>هيئة قضايا الدولة</p>
              <p>فرع اختصاص</p>
            </div>

            {caseData.coverImage && (
              <img src={caseData.coverImage} alt="Cover" className="w-24 h-24 object-cover mx-auto mb-4 rounded-xl border border-slate-200" />
            )}

            <h1 className="text-2xl font-black text-navy-900 mt-2 mb-2">تقرير ملف دعوى</h1>
            <h2 className="text-xl font-bold text-slate-800">
              دعوى رقم {caseData['رقم الدعوى'] || ''} لسنة {caseData['السنة'] || ''}
            </h2>
            <p className="text-sm font-bold text-slate-500 mt-2">{settings?.departmentName || 'قسم الإدارية العليا'} / {settings?.consultantName || 'أحمد وجيه'}</p>
          </div>

          {/* Main Info */}
          <div className="grid grid-cols-2 gap-x-12 gap-y-6 mb-12">
            <div>
              <p className="text-xs font-black text-slate-500 mb-1">المدعي / الطاعن</p>
              <p className="text-lg font-bold text-navy-900">{caseData['المدعي'] || caseData['الطاعن'] || caseData['المدعى'] || caseData['مستأنف'] || caseData['المستأنف'] || '---'}</p>
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 mb-1">المدعى عليه / المطعون ضده</p>
              <p className="text-lg font-bold text-navy-900">{caseData['المطعون ضده'] || caseData['المدعى عليه'] || caseData['المدعي عليه'] || caseData['مدعى عليه'] || caseData['مدعي عليه'] || caseData['المطعون ضدنا'] || caseData['ضد'] || '---'}</p>
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 mb-1">موضوع الدعوى</p>
              <p className="text-sm font-bold text-navy-900 whitespace-pre-wrap">{caseData['موضوع الدعوى'] || '---'}</p>
            </div>
            <div>
              <p className="text-xs font-black text-slate-500 mb-1">مكان الملف (الشعبة)</p>
              <p className="text-sm font-bold text-navy-900">{caseData['مكان الملف'] || '---'}</p>
            </div>
          </div>

          {/* Sessions Timeline */}
          <div className="mb-12">
            <h3 className="text-lg font-black text-slate-800 border-b border-slate-200 pb-2 mb-6">التسلسل الزمني للجلسات</h3>
            {sessions.length > 0 ? (
              <table className="w-full text-right border-collapse border border-slate-800 report-table">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-800 p-3 font-black text-sm w-32">تاريخ الجلسة</th>
                    <th className="border border-slate-800 p-3 font-black text-sm">القرار / الحكم</th>
                    <th className="border border-slate-800 p-3 font-black text-sm">الملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id}>
                      <td className="border border-slate-800 p-3 text-sm font-bold">{formatDateString(s.date)}</td>
                      <td className="border border-slate-800 p-3 text-sm font-bold">
                        {s.hasJudgment ? (
                          <span className="text-indigo-700 font-black">
                            [حكم] {s.judgment?.type || s.shortJudgment || ''}
                            {s.judgment?.result && ` - ${s.judgment.result}`}
                          </span>
                        ) : (
                          s.decision || '---'
                        )}
                      </td>
                      <td className="border border-slate-800 p-3 text-sm">{s.notes || '---'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500 font-bold text-sm">لا توجد جلسات مسجلة.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
