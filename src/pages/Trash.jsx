import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, RotateCcw, AlertTriangle, ArrowRight, Gavel } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';
import { formatDateString } from '../utils/dateUtils';

export default function Trash() {
  const { deletedCases, restoreCaseFromFirebase, deleteCaseFromFirebase, isAdmin, currentUserPermissions } = useAppContext();
  
  const canDeleteData = isAdmin || currentUserPermissions?.canDeleteData;
  const { toast, showConfirm } = useUI();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRestore = async (id, e) => {
    e.stopPropagation();
    try {
      await restoreCaseFromFirebase(id);
      toast('تم استعادة الدعوى بنجاح', 'success');
    } catch (err) {
      toast('حدث خطأ أثناء الاستعادة', 'error');
    }
  };

  const handlePermanentDelete = async (id, e) => {
    e.stopPropagation();
    const confirmed = await showConfirm('تأكيد الحذف النهائي', 'هل أنت متأكد من حذف هذه الدعوى نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.');
    if (confirmed) {
      try {
        await deleteCaseFromFirebase(id, true);
        toast('تم حذف الدعوى نهائياً', 'success');
      } catch (err) {
        toast('حدث خطأ أثناء الحذف', 'error');
      }
    }
  };

  const handleEmptyTrash = async () => {
    if (deletedCases.length === 0) return;
    const confirmed = await showConfirm('إفراغ سلة المحذوفات', 'هل أنت متأكد من حذف جميع القضايا المحذوفة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.');
    if (confirmed) {
      setIsProcessing(true);
      try {
        for (const c of deletedCases) {
          await deleteCaseFromFirebase(c.id, true);
        }
        toast('تم إفراغ سلة المحذوفات بنجاح', 'success');
      } catch (err) {
        toast('حدث خطأ أثناء إفراغ السلة', 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300 relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/files')}
            className="p-2 bg-white text-slate-500 hover:text-navy-900 rounded-xl border border-slate-200 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-navy-900 tracking-tight flex items-center gap-2">
              <Trash2 className="w-6 h-6 text-rose-500" />
              سلة المحذوفات
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1">القضايا التي تم حذفها مؤخراً ({deletedCases.length})</p>
          </div>
        </div>

        {canDeleteData && deletedCases.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            disabled={isProcessing}
            className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2 border border-rose-200"
          >
            <Trash2 className="w-5 h-5" />
            إفراغ السلة بالكامل
          </button>
        )}
      </div>

      {deletedCases.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
            <Trash2 className="w-12 h-12 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-navy-900 mb-2">سلة المحذوفات فارغة</h3>
          <p className="text-slate-500 font-bold max-w-md">
            لم تقم بحذف أي قضايا مؤخراً.
          </p>
        </div>
      ) : (
        <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex gap-3 text-rose-700 text-sm font-bold shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>
            هذه القضايا تم حذفها ولن تظهر في الشاشة الرئيسية. يمكنك استعادتها أو حذفها نهائياً لتوفير المساحة.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {deletedCases.map((c) => (
          <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition group relative overflow-hidden flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <Gavel className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-lg font-black text-slate-400 truncate" dir="ltr">
                      {c['رقم الدعوى']} / {c['السنة']}
                    </h3>
                    <p className="text-xs font-bold text-slate-400 truncate">
                      تاريخ الحذف: {formatDateString(c.deletedAt) || 'غير معروف'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {(c['المدعي'] || c['الطاعن']) && (
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs font-bold text-slate-500">
                    <span>المدعي:</span>
                    <span className="truncate max-w-[150px]">{(c['المدعي'] || c['الطاعن'])}</span>
                  </div>
                )}
                {c['المدعى_عليه'] && (
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs font-bold text-slate-500">
                    <span>المدعى عليه:</span>
                    <span className="truncate max-w-[150px]">{c['المدعى_عليه']}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2 pt-4 border-t border-slate-100">
              <button
                onClick={(e) => handleRestore(c.id, e)}
                className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold py-2 rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                استعادة
              </button>
              {canDeleteData && (
                <button
                  onClick={(e) => handlePermanentDelete(c.id, e)}
                  className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2 rounded-xl text-sm transition flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف نهائي
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
