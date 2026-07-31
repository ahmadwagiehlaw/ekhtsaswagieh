import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';

const currentYear = new Date().getFullYear();

export default function QuickAddCaseModal({ isOpen, onClose, prefillDate }) {
  const { createNewCase, checkDuplicateCase, settings, cases } = useAppContext();
  const { toast } = useUI();

  const [formData, setFormData] = useState({
    'رقم الدعوى': '',
    'السنة': '',
    'المدعي': '',
    'المدعى_عليه': '',
    'الصفة': '',
    'القرار': '',
    'آخر جلسة': prefillDate || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const roles = settings?.roles || ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص'];
  const decisions = settings?.decisions || ['للحكم', 'تصريح', 'للإعلان', 'للاطلاع', 'آخر أجل'];

  const plaintiffsList = React.useMemo(() => {
    if (!cases) return [];
    const set = new Set();
    cases.forEach(c => {
      if (c['المدعي']) set.add(c['المدعي']);
    });
    return Array.from(set);
  }, [cases]);

  const defendantsList = React.useMemo(() => {
    if (!cases) return [];
    const set = new Set();
    cases.forEach(c => {
      if (c['المدعى_عليه']) set.add(c['المدعى_عليه']);
    });
    return Array.from(set);
  }, [cases]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'رقم الدعوى' || field === 'السنة') {
      setDuplicateWarning(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const caseNo = formData['رقم الدعوى'].trim();
    const year = formData['السنة'].trim();

    if (!caseNo || !year) {
      toast('رقم الدعوى والسنة مطلوبان', 'error');
      return;
    }

    if (checkDuplicateCase(caseNo, year)) {
      setDuplicateWarning(true);
      return;
    }

    setIsSaving(true);
    try {
      const caseData = {
        ...formData,
        createdAt: new Date().toISOString(),
      };
      // Add session if date is provided
      if (formData['آخر جلسة']) {
        caseData.sessions = [{
          id: Date.now().toString(),
          date: formData['آخر جلسة'],
          decision: formData['القرار'],
          createdAt: new Date().toISOString(),
        }];
      }
      await createNewCase(caseData);
      toast('تم إضافة الدعوى بنجاح ✅', 'success');
      // Reset and close
      setFormData({
        'رقم الدعوى': '',
        'السنة': '',
        'المدعي': '',
        'المدعى_عليه': '',
        'الصفة': '',
        'القرار': '',
        'آخر جلسة': prefillDate || '',
      });
      onClose();
    } catch (err) {
      if (err.message === 'DUPLICATE_CASE') {
        setDuplicateWarning(true);
      } else {
        toast('حدث خطأ أثناء الحفظ', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-emerald-50 px-6 py-4 flex items-center justify-between border-b border-emerald-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-emerald-900">إضافة دعوى سريعة</h2>
              <p className="text-xs font-bold text-emerald-600">إضافة دعوى بالبيانات الأساسية</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-slate-600 transition shadow-sm border border-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-3 overflow-y-auto">

          {duplicateWarning && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-bold text-amber-700">هذه الدعوى موجودة بالفعل! راجع رقم الدعوى والسنة.</p>
            </div>
          )}

          {/* Case number + year */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">رقم الدعوى *</label>
              <input
                type="text"
                value={formData['رقم الدعوى']}
                onChange={e => handleChange('رقم الدعوى', e.target.value)}
                placeholder="رقم الدعوى"
                className="w-full text-sm font-bold p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">السنة *</label>
              <input
                type="text"
                value={formData['السنة']}
                onChange={e => handleChange('السنة', e.target.value)}
                placeholder={String(currentYear)}
                className="w-full text-sm font-bold p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition outline-none text-center"
                required
              />
            </div>
          </div>

          {/* Plaintiff + Defendant */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">المدعي / الطاعن</label>
              <input
                type="text"
                list="plaintiffs-list"
                value={formData['المدعي']}
                onChange={e => handleChange('المدعي', e.target.value)}
                placeholder="اسم المدعي"
                className="w-full text-sm font-bold p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition outline-none"
              />
              <datalist id="plaintiffs-list">
                {plaintiffsList.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">المدعى عليه / المطعون ضده</label>
              <input
                type="text"
                list="defendants-list"
                value={formData['المدعى_عليه']}
                onChange={e => handleChange('المدعى_عليه', e.target.value)}
                placeholder="اسم المدعى عليه"
                className="w-full text-sm font-bold p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition outline-none"
              />
              <datalist id="defendants-list">
                {defendantsList.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
          </div>

          {/* Role + Decision */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">الصفة</label>
              <select
                value={formData['الصفة']}
                onChange={e => handleChange('الصفة', e.target.value)}
                className="w-full text-sm font-bold p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition outline-none"
              >
                <option value="">-- اختر --</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">قرار الجلسة</label>
              <select
                value={formData['القرار']}
                onChange={e => handleChange('القرار', e.target.value)}
                className="w-full text-sm font-bold p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition outline-none"
              >
                <option value="">-- اختر --</option>
                {decisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Session date */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 block">تاريخ الجلسة</label>
            <input
              type="date"
              value={formData['آخر جلسة']}
              onChange={e => handleChange('آخر جلسة', e.target.value)}
              className="w-full text-sm font-bold p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 transition outline-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 shrink-0 flex gap-2">
          <button
            onClick={onClose}
            type="button"
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] px-4 py-2.5 bg-emerald-600 text-white text-sm font-black rounded-xl hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Plus className="w-4 h-4" /> إضافة الدعوى</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
