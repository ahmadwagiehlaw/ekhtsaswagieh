import React from 'react';

// ─────────────────────────────────────────────────────────────
// SVG Donut Chart
// ─────────────────────────────────────────────────────────────
export const DonutChart = ({ segments, size = 130, thickness = 22 }) => {
  const radius = (size - thickness) / 2;
  const circum = 2 * Math.PI * radius;
  const total = segments.reduce((s, d) => s + (d.value || 0), 0);
  const cx = size / 2, cy = size / 2;
  if (total === 0) return null;
  let cum = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const pct = seg.value / total, dash = pct * circum, offset = -(cum * circum);
        cum += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={radius} fill="none" stroke={seg.color}
            strokeWidth={thickness} strokeDasharray={`${dash} ${circum}`} strokeDashoffset={offset}
            style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        );
      })}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────
// SVG Area trend line
// ─────────────────────────────────────────────────────────────
export const TrendLine = ({ data, color = '#f59e0b' }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 300, H = 72, P = 10;
  const gradId = `tg${color.replace('#', '')}`;
  const pts = data.map((d, i) => ({
    x: P + (i / (data.length - 1)) * (W - 2 * P),
    y: H - P - ((d.count / max) * (H - 2 * P))
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${pts.at(-1).x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="2" />)}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────
// SVG Multi-series trend line (shared Y-scale for real comparison)
// ─────────────────────────────────────────────────────────────
export const MultiTrendLine = ({ series }) => {
  if (!series || series.length === 0 || !series[0].data || series[0].data.length < 2) return null;
  const n = series[0].data.length;
  const allValues = series.flatMap(s => s.data);
  const max = Math.max(...allValues, 1);
  const W = 300, H = 110, P = 16;
  const toPoints = (data) => data.map((v, i) => ({
    x: P + (i / (n - 1)) * (W - 2 * P),
    y: H - P - ((v / max) * (H - 2 * P)),
    v
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
      {series.map((s, si) => {
        const pts = toPoints(s.data);
        const gradId = `mtl${si}${s.color.replace('#', '')}`;
        const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const area = `${line} L ${pts.at(-1).x.toFixed(1)} ${H - P} L ${pts[0].x.toFixed(1)} ${H - P} Z`;
        return (
          <g key={si}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradId})`} />
            <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={s.color} strokeWidth="2" />
                <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={s.color}>{p.v}</text>
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
};


// ─────────────────────────────────────────────────────────────
// Trend comparison badge
// ─────────────────────────────────────────────────────────────
export const TrendBadge = ({ current, prev, positiveIsGood = true, className = "mt-0.5" }) => {
  if (prev === undefined || prev === null) return null;
  const diff = current - prev;
  if (diff === 0) return <span className={`text-[10px] text-slate-400 font-bold ${className}`}>—</span>;
  const isUp = diff > 0;
  const isGood = positiveIsGood ? isUp : !isUp;
  return (
    <span className={`text-[10px] font-black ${className} ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
      {isUp ? '▲' : '▼'} {Math.abs(diff)}
    </span>
  );
};
