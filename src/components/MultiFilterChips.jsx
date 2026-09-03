/**
 * MultiFilterChips - مكوّن فلتر متعدد القيم مع وضع الاستبعاد
 * - وضع التضمين (include): يُظهر فقط ما تم اختياره
 * - وضع الاستبعاد (exclude): يُظهر كل شيء ما عدا ما تم اختياره
 * القيمة المُرجعة:
 *   include: "فحص,موضوع"
 *   exclude: "exclude:فحص,موضوع"
 */
import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, ChevronDown, Ban } from 'lucide-react';

export default function MultiFilterChips({
  label,
  value,        // comma-separated OR "exclude:val1,val2"
  onChange,     // (newValue: string) => void
  options,      // [{ value, label }] or ['string', ...]
  allValue = 'all',
  allLabel = 'الكل',
  placeholder = 'إضافة...',
}) {
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef(null);

  // Detect exclude mode
  const isExclude = typeof value === 'string' && value.startsWith('exclude:');
  const rawVal = isExclude ? value.slice('exclude:'.length) : value;

  // Parse current chips
  const chips = rawVal && rawVal !== allValue
    ? rawVal.split(',').filter(v => v && v !== allValue)
    : [];

  // Normalize options
  const normalizedOptions = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  const availableOptions = normalizedOptions.filter(o => !chips.includes(o.value));

  const emitValue = (newChips, exclude) => {
    if (newChips.length === 0) { onChange(allValue); return; }
    const joined = newChips.join(',');
    onChange(exclude ? `exclude:${joined}` : joined);
  };

  const addChip = (val) => {
    if (!val || chips.includes(val)) return;
    emitValue([...chips, val], isExclude);
    setDropOpen(false);
  };

  const removeChip = (val) => {
    const newChips = chips.filter(c => c !== val);
    emitValue(newChips, isExclude);
  };

  const clearAll = () => onChange(allValue);

  const toggleMode = () => {
    // Switch between include/exclude keeping same chips
    emitValue(chips, !isExclude);
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasValues = chips.length > 0;

  // Colors based on mode
  const chipBg = isExclude
    ? 'bg-rose-100 text-rose-700 border-rose-200'
    : 'bg-indigo-100 text-indigo-700 border-indigo-200';
  const chipX = isExclude
    ? 'text-rose-400 hover:text-rose-700 hover:bg-rose-200'
    : 'text-indigo-400 hover:text-indigo-700 hover:bg-indigo-200';
  const addBtn = isExclude
    ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
    : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100';
  const containerBg = hasValues
    ? isExclude ? 'bg-rose-50 border-rose-200 shadow-sm' : 'bg-indigo-50 border-indigo-200 shadow-sm'
    : 'bg-white border-slate-200';

  return (
    <div className="flex flex-col gap-1.5" ref={dropRef}>
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-slate-500">{label}</label>
        <div className="flex items-center gap-1.5">
          {/* Mode toggle button — shown only when there are chips */}
          {hasValues && (
            <button
              type="button"
              onClick={toggleMode}
              title={isExclude ? 'التحويل لوضع التضمين (يُظهر المختار فقط)' : 'التحويل لوضع الاستبعاد (يُظهر الكل ما عدا المختار)'}
              className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border transition flex items-center gap-0.5 ${
                isExclude
                  ? 'bg-rose-100 text-rose-600 border-rose-200 hover:bg-rose-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Ban className="w-2.5 h-2.5" />
              {isExclude ? 'استبعاد' : 'تضمين'}
            </button>
          )}
          {hasValues && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[9px] font-bold text-rose-400 hover:text-rose-600 transition"
              title="مسح الكل"
            >
              مسح
            </button>
          )}
        </div>
      </div>

      <div className={`min-h-[38px] w-full rounded-xl border p-1.5 flex flex-wrap gap-1 items-center transition-all ${containerBg}`}>
        {/* Empty state */}
        {chips.length === 0 && (
          <span className="text-[10px] font-bold text-slate-400 px-1">{allLabel}</span>
        )}

        {/* Mode indicator badge */}
        {hasValues && (
          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
            isExclude ? 'bg-rose-200 text-rose-700' : 'bg-indigo-200 text-indigo-700'
          }`}>
            {isExclude ? '≠' : '='}
          </span>
        )}

        {/* Chips */}
        {chips.map(chip => {
          const opt = normalizedOptions.find(o => o.value === chip);
          return (
            <span
              key={chip}
              className={`flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-lg border ${chipBg}`}
            >
              {isExclude && <span className="opacity-60">لا</span>}
              {opt?.label || chip}
              <button
                type="button"
                onClick={() => removeChip(chip)}
                className={`w-3 h-3 rounded transition ${chipX}`}
                title="حذف"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}

        {/* Add button */}
        {availableOptions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropOpen(!dropOpen)}
              className={`flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-lg border transition ${addBtn}`}
              title={isExclude ? 'إضافة قيمة للاستبعاد' : 'إضافة قيمة للفلتر'}
            >
              <Plus className="w-3 h-3" />
              {chips.length === 0 && <span>{placeholder}</span>}
              <ChevronDown className={`w-3 h-3 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropOpen && (
              <div className="absolute top-full mt-1 right-0 z-50 bg-white rounded-xl shadow-lg border border-slate-200 min-w-[140px] overflow-hidden animate-in slide-in-from-top-1 duration-100">
                {availableOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => addChip(opt.value)}
                    className={`w-full text-right text-xs font-bold px-3 py-2 transition text-slate-700 border-b border-slate-100 last:border-0 ${
                      isExclude ? 'hover:bg-rose-50 hover:text-rose-700' : 'hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
