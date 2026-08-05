import React from 'react';
import { Settings2 } from 'lucide-react';

export default function StrictSelectField({ label, value, options = [], onChange, onManage, placeholder = 'اختر...' }) {
  // Determine layout based on number of options.
  // If options are few (e.g., <= 6), use toggle buttons. Otherwise, use a styled native select.
  const isToggleView = options.length <= 6;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-[11px] font-black text-slate-500 block">{label}</label>
        {onManage && (
          <button 
            type="button" 
            onClick={onManage}
            className="text-slate-400 hover:text-indigo-600 transition"
            title="إدارة الخيارات"
          >
            <Settings2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {isToggleView ? (
        <div className="flex flex-wrap gap-2">
          {options.map(opt => (
            <button 
              key={opt} 
              type="button" 
              onClick={() => onChange(opt)}
              className={`flex-1 min-w-[70px] py-2.5 px-2 text-xs font-bold rounded-xl transition-all shadow-sm ${
                value === opt 
                  ? 'bg-indigo-600 text-white shadow-md scale-[1.02] border-transparent' 
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt}
            </button>
          ))}
          {options.length === 0 && (
             <span className="text-xs text-slate-400 font-bold py-2">لا توجد خيارات...</span>
          )}
        </div>
      ) : (
        <div className="relative">
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900 appearance-none transition cursor-pointer"
          >
            <option value="" disabled>{placeholder}</option>
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 left-0 flex items-center px-3 pointer-events-none">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      )}
    </div>
  );
}
