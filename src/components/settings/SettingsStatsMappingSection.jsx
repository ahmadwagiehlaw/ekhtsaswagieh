import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw, Activity } from 'lucide-react';
import { DEFAULT_STATS_MAP } from '../../utils/statsMapping';

const IMPACT_OPTIONS = [
  { value: 'good',          label: '✅ إيجابي (لصالحنا)',      color: '#10b981' },
  { value: 'bad',           label: '❌ سلبي (ضدنا)',            color: '#ef4444' },
  { value: 'stop',          label: '🟠 وقف / إنذار خطير',      color: '#f97316' },
  { value: 'mixed',         label: '🔵 مختلط',                  color: '#3b82f6' },
  { value: 'consideration', label: '🟣 اعتبار كأن لم تكن',      color: '#8b5cf6' },
  { value: 'procedural',    label: '⚪ إجرائي محايد',           color: '#94a3b8' },
  { value: 'ignore',        label: '🚫 تجاهل (لا يُحسب)',       color: '#cbd5e1' },
];

const IMPACT_COLORS = Object.fromEntries(IMPACT_OPTIONS.map(o => [o.value, o.color]));

export default function SettingsStatsMappingSection({ mapping, setMapping }) {
  const [newValue, setNewValue] = useState('');
  const [draggedIdx, setDraggedIdx] = useState(null);

  const handleDragStart = (e, idx) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    // Small hack to ensure drag image is somewhat clean
    e.dataTransfer.setDragImage(e.target, 20, 20);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    
    const newMap = [...mapping];
    const draggedItem = newMap[draggedIdx];
    newMap.splice(draggedIdx, 1);
    newMap.splice(idx, 0, draggedItem);
    
    setDraggedIdx(idx);
    setMapping(newMap);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const updateEntry = (idx, key, val) => {
    const updated = [...mapping];
    updated[idx] = { ...updated[idx], [key]: val };
    // Auto-set color when impact changes
    if (key === 'impact') {
      updated[idx].color = IMPACT_COLORS[val] || '#94a3b8';
    }
    setMapping(updated);
  };

  const removeEntry = (idx) => {
    setMapping(mapping.filter((_, i) => i !== idx));
  };

  const addEntry = () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    if (mapping.find(m => m.value === trimmed)) return; // no duplicates
    setMapping([...mapping, { value: trimmed, impact: 'procedural', color: '#94a3b8', label: trimmed, countsInPerformance: false }]);
    setNewValue('');
  };

  const resetToDefault = () => {
    setMapping([...DEFAULT_STATS_MAP]);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <p className="text-xs font-bold text-slate-500">
            حدد كيف يؤثر كل تصنيف في إحصائيات لوحة القيادة — اللون والوزن والظهور في شريط الأداء
          </p>
        </div>
        <button
          onClick={resetToDefault}
          className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all"
        >
          <RotateCcw className="w-3 h-3" />
          استعادة الافتراضي
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {IMPACT_OPTIONS.map(o => (
          <span key={o.value} className="text-[9px] font-black px-2 py-1 rounded-full border" style={{ color: o.color, borderColor: o.color + '40', backgroundColor: o.color + '15' }}>
            {o.label}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="space-y-2">
        {/* Table Head */}
        <div className="grid grid-cols-[15px_1fr_1fr_1.2fr_40px_70px_70px_28px] gap-2 px-2 items-center text-center">
          <span />
          <span className="text-[9px] font-black text-slate-400 text-right">قيمة التصنيف</span>
          <span className="text-[9px] font-black text-slate-400">الحقل المصدر</span>
          <span className="text-[9px] font-black text-slate-400">التأثير الإحصائي</span>
          <span className="text-[9px] font-black text-slate-400">اللون</span>
          <span className="text-[9px] font-black text-slate-400">شريط الأداء؟</span>
          <span className="text-[9px] font-black text-slate-400">الداشبورد؟</span>
          <span />
        </div>

        {/* Rows */}
        {mapping.map((entry, idx) => {
          const impactColor = IMPACT_COLORS[entry.impact] || '#94a3b8';
          return (
            <div
              key={idx}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`grid grid-cols-[15px_1fr_1fr_1.2fr_40px_70px_70px_28px] gap-2 items-center bg-white border rounded-xl px-3 py-2 shadow-sm transition-all ${draggedIdx === idx ? 'opacity-50' : 'hover:border-indigo-200'}`}
              style={{ borderColor: impactColor + '30' }}
            >
              <div className="cursor-move text-slate-300 hover:text-slate-500 font-black" title="اسحب لترتيب القاعدة">⋮⋮</div>
              {/* Value */}
              <input
                value={entry.value}
                onChange={e => updateEntry(idx, 'value', e.target.value)}
                className="text-[11px] font-black text-navy-900 bg-transparent outline-none border-b border-transparent focus:border-indigo-300 transition"
                placeholder="اسم التصنيف"
              />

              {/* Source Field */}
              <select
                value={entry.sourceField || 'تصنيف الحكم'}
                onChange={e => updateEntry(idx, 'sourceField', e.target.value)}
                className="text-[10px] font-bold rounded-lg border border-slate-200 px-1.5 py-1 outline-none focus:border-indigo-400 bg-slate-50 transition"
              >
                <option value="تصنيف الحكم">تصنيف الحكم</option>
                <option value="فئة الحكم">فئة الحكم</option>
                <option value="نوع الحكم">نوع الحكم</option>
                <option value="القرار">القرار</option>
                <option value="الحكم">الحكم</option>
                <option value="قرار الجلسة">قرار الجلسة</option>
              </select>

              {/* Impact */}
              <select
                value={entry.impact}
                onChange={e => updateEntry(idx, 'impact', e.target.value)}
                className="text-[10px] font-bold rounded-lg border px-1.5 py-1 outline-none focus:border-indigo-400 transition"
                style={{ borderColor: impactColor + '60', backgroundColor: impactColor + '10', color: impactColor }}
              >
                {IMPACT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Color picker */}
              <div className="relative">
                <input
                  type="color"
                  value={entry.color}
                  onChange={e => updateEntry(idx, 'color', e.target.value)}
                  className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  title="اختر لوناً"
                />
              </div>

              {/* Counts in performance */}
              <button
                onClick={() => updateEntry(idx, 'countsInPerformance', !entry.countsInPerformance)}
                className={`text-[9px] font-black px-2 py-1 rounded-lg border transition-all ${
                  entry.countsInPerformance
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                {entry.countsInPerformance ? '✓ نعم' : '— لا'}
              </button>

              {/* Dashboard Visible */}
              <button
                onClick={() => updateEntry(idx, 'dashboardVisible', entry.dashboardVisible === false ? true : false)}
                className={`text-[9px] font-black px-2 py-1 rounded-lg border transition-all ${
                  entry.dashboardVisible !== false
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                    : 'bg-slate-50 text-slate-400 border-slate-200'
                }`}
              >
                {entry.dashboardVisible !== false ? '✓ نعم' : '— لا'}
              </button>

              {/* Delete */}
              <button
                onClick={() => removeEntry(idx)}
                className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add new */}
      <div className="flex gap-2 items-center bg-slate-50 border border-dashed border-slate-300 rounded-xl px-3 py-2.5">
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addEntry()}
          placeholder="أضف قيمة تصنيف جديدة..."
          className="flex-1 text-[11px] font-bold bg-transparent outline-none text-navy-900 placeholder:text-slate-400"
        />
        <button
          onClick={addEntry}
          className="flex items-center gap-1 text-[10px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
        >
          <Plus className="w-3 h-3" />
          إضافة
        </button>
      </div>

      {/* Info note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
          💡 أي قيمة تصنيف غير مُعرَّفة هنا ستُعامَل تلقائياً كـ <strong>إجرائي محايد</strong> — لن تختفي أو تسبب أخطاء.
        </p>
      </div>
    </div>
  );
}
