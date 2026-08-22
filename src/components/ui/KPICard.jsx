import React from 'react';

// ─────────────────────────────────────────────────────────────
// KPI Card component (gradient, icon, value)
// ─────────────────────────────────────────────────────────────
export default function KPICard({ icon: Icon, label, sublabel, value, accentColor, bgFrom, bgTo, iconBg, border, onClick, extra }) {
  return (
    <button onClick={onClick}
      className={`group relative overflow-hidden bg-gradient-to-br ${bgFrom} ${bgTo} rounded-2xl p-4 border ${border} shadow-sm
        flex flex-col gap-1 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-right w-full`}>
      <div className="absolute -left-5 -top-5 w-20 h-20 rounded-full opacity-10" style={{ backgroundColor: accentColor }} />
      <div className={`${iconBg} w-10 h-10 rounded-xl flex items-center justify-center shadow-sm mb-1 self-start`}>
        <Icon className="w-5 h-5" style={{ color: accentColor }} />
      </div>
      <p className="text-3xl font-black leading-none" style={{ color: accentColor }}>{value}</p>
      <p className="text-xs font-black text-slate-700 leading-tight">{label}</p>
      <p className="text-[10px] font-bold text-slate-400">{sublabel}</p>
      {extra && <div className="mt-1">{extra}</div>}
      <div className="absolute bottom-0 left-0 w-full h-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: accentColor }} />
    </button>
  );
}
