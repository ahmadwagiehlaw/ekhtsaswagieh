// ─────────────────────────────────────────────────────────────
// statsMapping.js
// Central mapping engine for judgment classification statistics.
// Instead of hardcoded string comparisons, the system reads this
// mapping to determine how each classification value impacts stats.
// ─────────────────────────────────────────────────────────────

/**
 * Impact types:
 *  good         → صالح (لصالحنا) — يُحسب في good
 *  bad          → ضد (ضدنا)      — يُحسب في bad
 *  stop         → وقف جزائي      — يُحسب في stop / penaltyStop
 *  mixed        → مختلط           — يُحسب في mixed
 *  consideration→ اعتبار/اعتبار كأن لم تكن — يُحسب في consideration
 *  procedural   → إجرائي محايد   — يُحسب في other
 *  ignore       → لا يُحسب إطلاقاً في الإحصائيات
 */
export const DEFAULT_STATS_MAP = [
  { value: 'صالح',               impact: 'good',          color: '#10b981', label: 'أحكام لصالحنا',       countsInPerformance: true  , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'ضد',                  impact: 'bad',           color: '#ef4444', label: 'أحكام ضدنا',           countsInPerformance: true  , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'مختلط',              impact: 'mixed',          color: '#3b82f6', label: 'أحكام مختلطة',         countsInPerformance: true  , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'وقف جزائي',          impact: 'stop',          color: '#f97316', label: 'وقف جزائي',            countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'وقف والدولة مدعية', impact: 'stop',          color: '#f97316', label: 'وقف (الدولة مدعية)',   countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'اعتبار',             impact: 'consideration', color: '#eab308', label: 'اعتبار كأن لم تكن',    countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'اعتبار كأن لم تكن', impact: 'consideration', color: '#8b5cf6', label: 'اعتبار كأن لم تكن',    countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'تمهيدي',             impact: 'procedural',    color: '#06b6d4', label: 'أحكام تمهيدية',        countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'حكم منه للخصومة',   impact: 'procedural',    color: '#22c55e', label: 'منه للخصومة',          countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'حكم غير منه للخصومة', impact: 'procedural', color: '#64748b', label: 'غير منه للخصومة',      countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'لا شأن لنا بالحكم', impact: 'ignore',        color: '#94a3b8', label: 'لا شأن بالحكم',        countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
  { value: 'لا شأن بالحكم',     impact: 'ignore',        color: '#94a3b8', label: 'لا شأن بالحكم',        countsInPerformance: false , sourceField: 'تصنيف الحكم', dashboardVisible: true},
];

/**
 * Get the active mapping: from settings if configured, else default.
 * @param {object} settings — the app settings object from Firebase
 * @returns {Array} — the active stats mapping array
 */
export function getActiveMapping(settings) {
  if (settings?.statsMapping && settings.statsMapping.length > 0) {
    return settings.statsMapping;
  }
  return DEFAULT_STATS_MAP;
}

/**
 * Resolve the impact of a judgment classification value.
 * @param {string} value — e.g. 'صالح', 'وقف جزائي'
 * @param {Array}  mapping — the active stats mapping array
 * @returns {string} — impact type: 'good' | 'bad' | 'stop' | 'mixed' | 'consideration' | 'procedural' | 'ignore'
 */
export function resolveImpact(value, mapping) {
  if (!value) return 'procedural';
  const entry = mapping.find(m => m.value === value);
  return entry ? entry.impact : 'procedural';
}

/**
 * Resolve the display color for a judgment classification value.
 * @param {string} value — e.g. 'صالح'
 * @param {Array}  mapping — the active stats mapping array
 * @returns {string} — hex color string
 */
export function resolveColor(value, mapping) {
  if (!value) return '#cbd5e1';
  const entry = mapping.find(m => m.value === value);
  return entry ? entry.color : '#cbd5e1';
}

/**
 * Check if a value is considered "critical" (bad or stop) — affects alerts.
 * @param {string} value
 * @param {Array}  mapping
 * @returns {boolean}
 */
export function isCriticalImpact(value, mapping) {
  const impact = resolveImpact(value, mapping);
  return impact === 'bad' || impact === 'stop';
}

/**
 * Check if a value is a "stop" type (وقف جزائي variants).
 * @param {string} value
 * @param {Array}  mapping
 * @returns {boolean}
 */
export function isStopImpact(value, mapping) {
  return resolveImpact(value, mapping) === 'stop';
}

/**
 * Evaluates a session against the stats mapping rules top-to-bottom.
 * Returns the first matched rule.
 * @param {object} session - The session object to evaluate (can also pass a case object containing target fields)
 * @param {Array} mapping - The active stats mapping array
 * @returns {object|null} - The matched rule or null
 */
export function evaluateSessionRule(session, mapping) {
  if (!session || !mapping) return null;
  for (const rule of mapping) {
    const field = rule.sourceField || 'تصنيف الحكم';
    // For backward compatibility, check judgmentClassification if field is تصنيف الحكم
    let val = session[field];
    if (field === 'تصنيف الحكم' && session.judgmentClassification) {
        val = session.judgmentClassification;
    }
    // Also check judgment.result if field is الحكم
    if (field === 'الحكم' && session.judgment && session.judgment.result) {
        val = session.judgment.result;
    }

    if (val && String(val).trim() === String(rule.value).trim()) {
      return rule;
    }
  }
  return null;
}
