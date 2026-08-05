import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppState';
import { Printer, ArrowRight, Gavel } from 'lucide-react';
import { getSafeDateObj } from '../utils/dateUtils';
import SessionTable from '../components/SessionTable';

export default function DayRoll() {
  const { date } = useParams();
  const { cases, settings } = useAppContext();
  const navigate = useNavigate();

  const getFieldValue = (obj, keys) => {
    for (let key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return '';
  };

  const dayCases = useMemo(() => {
    const list = [];
    cases.forEach(cObj => {
      const dStr = getFieldValue(cObj, ['آخر جلسة','أخر جلسة','اخر جلسة','تاريخ الجلسة']);
      if (!dStr) return;
      const d = getSafeDateObj(dStr);
      if (!d) return;
      const pad = n => n.toString().padStart(2, '0');
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (key === date) {
        list.push(cObj);
      }
    });
    return list;
  }, [cases, date]);

  const handlePrint = () => {
    window.print();
  };

  if (!date) return <div className="p-8 text-center">تاريخ غير صالح</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans" dir="rtl">
      
      {/* Header (No Print) */}
      <div className="flex items-center justify-between mb-6 no-print bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.close()} 
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition"
          >
            <ArrowRight className="w-5 h-5 text-slate-700" />
          </button>
          <div>
            <h1 className="font-black text-xl text-navy-900 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-amber-500" />
              رول جلسات يوم {date}
            </h1>
            <p className="text-xs font-bold text-slate-500 mt-1">{dayCases.length} ملف قضائي</p>
          </div>
        </div>
        <button 
          onClick={handlePrint}
          className="bg-navy-900 hover:bg-navy-800 text-amber-300 font-bold px-5 py-2.5 rounded-xl text-sm transition shadow-sm flex items-center gap-2"
        >
          <Printer className="w-4 h-4" /> طباعة الرول
        </button>
      </div>

      {/* Printable Area */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
        
        <div className="hidden print:block text-center mb-8 border-b-2 border-navy-900 pb-4">
          <h1 className="font-black text-2xl text-navy-900 mb-2">رول الجلسات</h1>
          <h2 className="font-bold text-lg text-slate-700">مستشار {settings?.consultantName || 'أحمد وجيه'}</h2>
          <p className="text-sm font-bold mt-2 bg-slate-100 inline-block px-4 py-1 rounded-lg">تاريخ الجلسة: {date}</p>
        </div>

        {dayCases.length > 0 ? (
          <div className="print-mode-table">
            <SessionTable dayCases={dayCases} date={date} />
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 no-print">
            <p className="text-sm font-bold text-slate-500">لا توجد قضايا مجدولة في هذا التاريخ</p>
          </div>
        )}

      </div>
    </div>
  );
}
