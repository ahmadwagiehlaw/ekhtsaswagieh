import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FileText, ChevronLeft, Gavel, Clock, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppState';

// Helper to get a field value from multiple possible keys
function getField(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
}

// Highlight matching text
function Highlight({ text, query }) {
  if (!query || !text) return <span>{text || '—'}</span>;
  const str = String(text);
  const idx = str.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{str}</span>;
  return (
    <span>
      {str.slice(0, idx)}
      <mark className="bg-amber-200 text-amber-900 font-black rounded px-0.5">{str.slice(idx, idx + query.length)}</mark>
      {str.slice(idx + query.length)}
    </span>
  );
}

export default function GlobalCaseSearchPanel({ isOpen, onClose, onSelectCase }) {
  const { cases } = useAppContext();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef(null);

  // Reset query when panel opens and focus the input
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Filtered results — search across case number, year, names, court
  const results = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) return [];
    const q = debouncedQuery.toLowerCase();
    return cases.filter(c => {
      const caseNo  = String(getField(c, ['رقم الدعوى', 'رقم القضية']) || '').toLowerCase();
      const year    = String(getField(c, ['السنة', 'سنة']) || '').toLowerCase();
      const appName = String(getField(c, ['المدعي', 'الطاعن', 'المستأنف']) || '').toLowerCase();
      const applee  = String(getField(c, ['المدعى عليه', 'المطعون ضده', 'المدعى_عليه']) || '').toLowerCase();
      const court   = String(getField(c, ['المحكمة', 'اسم المحكمة']) || '').toLowerCase();
      return caseNo.includes(q) || year.includes(q) || appName.includes(q) || applee.includes(q) || court.includes(q);
    }).slice(0, 30);
  }, [cases, debouncedQuery]);

  const handleOpenCase = (caseObj) => {
    if (onSelectCase) {
      onSelectCase(caseObj.id);
    }
  };

  // Role badge styling
  const getRoleBadge = (c) => {
    const role = String(c['الصفة'] || c['صفة'] || '').trim();
    if (!role) return null;
    const isApp  = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
    const isAppee = role.includes('مطعون') || role.includes('مدعى عليه');
    const cls = isApp
      ? 'bg-rose-100 text-rose-700 border-rose-200'
      : isAppee
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-amber-100 text-amber-700 border-amber-200';
    return <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${cls} shrink-0`}>{role}</span>;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] transition-all duration-300 ${
          isOpen ? 'bg-navy-900/40 backdrop-blur-[2px]' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-[61] w-full max-w-[400px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out`}
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="بحث في الدعاوى"
      >
        {/* Header */}
        <div
          className="bg-navy-900 px-4 flex items-center gap-3 shrink-0"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)', paddingBottom: '12px' }}
        >
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ابحث في جميع الدعاوى..."
              className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 pr-10 pl-9 text-sm font-bold text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
              dir="rtl"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition shrink-0"
            title="إغلاق (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hint bar */}
        <div className="bg-navy-900/95 px-4 pb-3 shrink-0 flex items-center gap-2">
          <kbd className="text-[10px] font-black bg-white/10 text-amber-300 border border-white/20 px-1.5 py-0.5 rounded">Esc</kbd>
          <span className="text-[11px] text-slate-400 font-bold">للإغلاق</span>
          <span className="mx-1 text-slate-600">·</span>
          <span className="text-[11px] text-slate-400 font-bold">
            {results.length > 0
              ? `${results.length} نتيجة`
              : debouncedQuery
              ? 'لا توجد نتائج'
              : 'ابدأ الكتابة للبحث'}
          </span>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100" dir="rtl">

          {/* Empty state — no query yet */}
          {!debouncedQuery && (
            <div className="flex flex-col items-center justify-center h-full pb-24 text-center px-6 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-amber-50 flex items-center justify-center shadow-sm">
                <Search className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-black text-navy-900 mb-1">بحث شامل في الدعاوى</p>
                <p className="text-xs text-slate-400 font-bold leading-relaxed">
                  ابحث برقم الدعوى، السنة، اسم الطاعن،<br />المطعون ضده، أو اسم المحكمة
                </p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center mt-1">
                {['رقم الدعوى', 'اسم الطاعن', 'المحكمة', 'السنة'].map(label => (
                  <span key={label} className="text-[11px] font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full border border-slate-200">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {debouncedQuery && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full pb-24 text-center px-6 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <FileText className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-black text-slate-500">لا توجد نتائج لـ "{debouncedQuery}"</p>
              <p className="text-xs text-slate-400 font-bold">جرّب البحث برقم الدعوى أو اسم الطاعن</p>
            </div>
          )}

          {/* Results list */}
          {results.map(c => {
            const caseNo  = getField(c, ['رقم الدعوى', 'رقم القضية']);
            const year    = getField(c, ['السنة', 'سنة']);
            const appName = getField(c, ['المدعي', 'الطاعن', 'المستأنف']);
            const applee  = getField(c, ['المدعى عليه', 'المطعون ضده', 'المدعى_عليه']);
            const dec     = getField(c, ['القرار', 'قرار الجلسة', 'المنطوق']);
            const sess    = getField(c, ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة']);
            const isJudgment = String(dec).includes('حكم') || String(dec).includes('للحكم');

            return (
              <button
                key={c.id}
                onClick={() => handleOpenCase(c)}
                className="w-full text-right px-4 py-3.5 hover:bg-amber-50/60 active:bg-amber-100 transition group flex items-start gap-3"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition ${
                  isJudgment
                    ? 'bg-rose-100 group-hover:bg-rose-200'
                    : 'bg-indigo-50 group-hover:bg-indigo-100'
                }`}>
                  {isJudgment
                    ? <Gavel className="w-4 h-4 text-rose-600" />
                    : <FileText className="w-4 h-4 text-indigo-500" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-navy-900">
                      <Highlight text={caseNo} query={debouncedQuery} />
                      {' '}لسنة{' '}
                      <Highlight text={year} query={debouncedQuery} />
                    </span>
                    {getRoleBadge(c)}
                  </div>

                  {appName && (
                    <p className="text-[11px] text-slate-600 font-bold truncate mt-0.5">
                      الطاعن: <Highlight text={appName} query={debouncedQuery} />
                    </p>
                  )}
                  {applee && (
                    <p className="text-[11px] text-slate-400 font-bold truncate">
                      ضد: <Highlight text={applee} query={debouncedQuery} />
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {dec && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        isJudgment
                          ? 'bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {dec}
                      </span>
                    )}
                    {sess && (
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {sess}
                      </span>
                    )}
                  </div>
                </div>

                {/* Chevron arrow */}
                <ChevronLeft className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition shrink-0 mt-1.5" />
              </button>
            );
          })}

          {results.length === 30 && (
            <div className="py-3 text-center text-[11px] text-slate-400 font-bold bg-slate-50">
              يتم عرض أول 30 نتيجة — دقق البحث لتضييق النتائج
            </div>
          )}
          {results.length > 0 && results.length < 30 && (
            <div className="py-3 text-center text-[11px] text-slate-400 font-bold">
              {results.length} نتيجة إجمالاً
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-4 py-2.5 flex items-center justify-between"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
        >
          <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            البحث يشمل {cases.length} دعوى
          </span>
          <button
            onClick={onClose}
            className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition"
          >
            إغلاق الإطار
          </button>
        </div>
      </div>
    </>
  );
}
