import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppState';
import { getActivityLogsRef } from '../lib/firebase';
import { onSnapshot, query, orderBy, limit, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Download, Trash2, ShieldAlert, Activity, ArrowRight, CheckCircle2, AlertTriangle, FileEdit } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { parseISO, isBefore, subMonths } from 'date-fns';
import { useAuth } from '../context/AuthContext';

export default function AuditLogs() {
  const { isAdmin } = useAppContext();
  const { userData } = useAuth();
  const tenantId = userData?.tenantId;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('الكل');

  useEffect(() => {
    if (!isAdmin || !tenantId) return;
    
    setLoading(true);
    const q = query(getActivityLogsRef(tenantId), orderBy('timestamp', 'desc'), limit(1000));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setLogs(data);
      setLoading(false);
    });

    return () => unsub();
  }, [isAdmin, tenantId]);

  if (!isAdmin) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-slate-500 min-h-screen bg-slate-50">
        <ShieldAlert className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-black text-navy-900">غير مصرح لك بالوصول</h2>
        <p className="mt-2 text-sm font-bold">هذه الصفحة مخصصة للمدير (المستشار) فقط.</p>
        <Link to="/" className="mt-6 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  const handleExport = () => {
    const exportData = logs.map(l => ({
      'التاريخ': new Date(l.timestamp).toLocaleDateString('ar-EG'),
      'الوقت': new Date(l.timestamp).toLocaleTimeString('ar-EG'),
      'المستخدم': l.user,
      'البريد الإلكتروني': l.email,
      'العملية': l.action,
      'القسم': l.entity,
      'التفاصيل': l.details
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجل النشاطات");
    XLSX.writeFile(wb, `سجل_النشاطات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleCleanOldLogs = async () => {
    if (!tenantId) return;
    if (!window.confirm("هل أنت متأكد من حذف جميع السجلات الأقدم من 3 شهور؟ لا يمكن التراجع عن هذه الخطوة.")) return;
    
    try {
      setLoading(true);
      const threeMonthsAgo = subMonths(new Date(), 3).toISOString();
      const allLogsSnap = await getDocs(getActivityLogsRef(tenantId));
      
      const batch = writeBatch(db);
      let deletedCount = 0;
      
      allLogsSnap.forEach((docSnap) => {
        const log = docSnap.data();
        if (log.timestamp && isBefore(parseISO(log.timestamp), parseISO(threeMonthsAgo))) {
          batch.delete(docSnap.ref);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        await batch.commit();
        alert(`تم حذف ${deletedCount} سجل قديم بنجاح.`);
      } else {
        alert("لا توجد سجلات أقدم من 3 شهور لحذفها.");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء محاولة حذف السجلات.");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = filterAction === 'الكل' ? logs : logs.filter(l => l.action.includes(filterAction));

  const getActionStyle = (action) => {
    if (action.includes('إضافة')) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (action.includes('حذف')) return "bg-rose-100 text-rose-700 border-rose-200";
    if (action.includes('إنجاز')) return "bg-indigo-100 text-indigo-700 border-indigo-200";
    return "bg-amber-100 text-amber-700 border-amber-200";
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-50/50 pb-20 p-4 sm:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy-900 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Activity className="w-6 h-6" />
            </div>
            سجل النشاطات (مراقبة الموظفين)
          </h1>
          <p className="text-slate-500 font-bold mt-2 text-sm">
            يتم تسجيل أحدث 1000 عملية يقوم بها الموظفون في النظام.
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-navy-900 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 transition text-sm shadow-sm"
          >
            <Download className="w-4 h-4" /> تصدير لإكسيل
          </button>
          <button
            onClick={handleCleanOldLogs}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 px-4 py-2.5 rounded-xl font-bold hover:bg-rose-100 transition text-sm shadow-sm"
          >
            <Trash2 className="w-4 h-4" /> تنظيف (+3 شهور)
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex gap-2 overflow-x-auto scrollbar-hide">
          {['الكل', 'إضافة', 'تعديل', 'إنجاز', 'حذف'].map(f => (
            <button
              key={f}
              onClick={() => setFilterAction(f)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${filterAction === f ? 'bg-navy-900 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-4 px-6 text-xs font-black text-slate-400 w-48">التاريخ والوقت</th>
                  <th className="py-4 px-6 text-xs font-black text-slate-400">المستخدم</th>
                  <th className="py-4 px-6 text-xs font-black text-slate-400">القسم</th>
                  <th className="py-4 px-6 text-xs font-black text-slate-400">العملية</th>
                  <th className="py-4 px-6 text-xs font-black text-slate-400">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400 font-bold text-sm">
                      <div className="animate-pulse flex flex-col items-center gap-3">
                        <Activity className="w-8 h-8 opacity-20" />
                        جاري جلب السجلات...
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400 font-bold text-sm">
                      لا توجد سجلات نشاط مسجلة.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const dateObj = new Date(log.timestamp);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition group">
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-navy-900">{dateObj.toLocaleDateString('ar-EG')}</span>
                            <span className="text-xs font-bold text-slate-400">{dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                              {log.user?.charAt(0)}
                            </div>
                            <span className="text-sm font-bold text-navy-900">{log.user}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm font-bold text-slate-600">{log.entity}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getActionStyle(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm font-bold text-slate-600 line-clamp-2" title={log.details}>
                            {log.details}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
