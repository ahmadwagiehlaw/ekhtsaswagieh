import { getSafeDateObj } from './dateUtils';



function addToJudgments(target, computeAs, c = null) {
  target.total++;
  if (computeAs === 'صالح')                                  { target.good++; if(c) target.lists.good.push(c); }
  else if (computeAs === 'ضد')                               { target.bad++; if(c) target.lists.bad.push(c); }
  else if (computeAs === 'وقف جزائي') {
    target.stop++; if(c) target.lists.stop.push(c);
    target.penaltyStop = (target.penaltyStop || 0) + 1;
  }
  
  else if (computeAs === 'اعتبار' || computeAs === 'اعتبار كأن لم تكن') { target.consideration++; if(c) target.lists.consideration.push(c); }
  else if (computeAs === 'مختلط')                            { target.mixed = (target.mixed || 0) + 1; if(c) target.lists.mixed.push(c); }
  else                                                        target.other++;
}

const emptyJudgments = () =>
  ({ total: 0, good: 0, bad: 0, stop: 0, penaltyStop: 0, consideration: 0, other: 0, mixed: 0, lists: { good: [], bad: [], stop: [], consideration: [], mixed: [] } });

// ─────────────────────────────────────────────────────────────
// computeMonthStats: returns per-month stats for any month/year
// Used by Dashboard for the interactive month-selector
// ─────────────────────────────────────────────────────────────
export function computeMonthStats(cases, settings, targetMonth, targetYear) {
  const appRole = settings?.roles?.[0] || 'طاعن';
  const apeRole = settings?.roles?.[1] || 'مطعون ضدنا';
  let sessions   = 0;
  let memos      = 0;
  let casesAdded = 0;
  let judgments  = emptyJudgments();

  const memoCalcMode = settings?.memoCalculationMode || 'session_date';

  cases.forEach(c => {
    const role = String(c['الصفة'] || c['صفة'] || '').trim();
    if (role === 'لا شأن' || role === 'خارج الاختصاص') return;

    if (role.includes('لا شأن') || role.includes('خارج الاختصاص')) return;

    // Flexible role check (طاعن / مدعي / مستأنف) vs (مطعون ضدنا / مدعى عليه / مستأنف ضده)
    const isAppellant = role.includes('طاعن') || role.includes('مدعي') || role.includes('مستأنف') || role.includes(appRole);
    const isAppellee  = role.includes('مطعون ضد') || role.includes('مدعى علي') || role.includes(apeRole);

    const createdAtDate = getSafeDateObj(c.createdAt || c.timestamp || '');
    if (createdAtDate && createdAtDate.getMonth() === targetMonth && createdAtDate.getFullYear() === targetYear) {
      casesAdded++;
    }

    const rawSessions = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
    
    // Calculate sessions
    rawSessions.forEach(s => {
      const sDate = getSafeDateObj(s.date);
      if (!sDate) return;
      if (sDate.getMonth() !== targetMonth || sDate.getFullYear() !== targetYear) return;
      sessions++;
    });

    // Calculate memos from procedures
    const procedures = Array.isArray(c.procedures) ? c.procedures : Object.values(c.procedures || {});
    procedures.forEach(p => {
       if (p.title && (p.title.includes('مذكرة') || p.title.includes('مذكرات'))) {
          let targetDateStr = memoCalcMode === 'session_date' ? p.date : p.createdAt;
          if (!targetDateStr) targetDateStr = p.date || p.createdAt;
          const dObj = getSafeDateObj(targetDateStr);
          if (dObj && dObj.getMonth() === targetMonth && dObj.getFullYear() === targetYear) {
             memos++;
          }
       }
    });

    // Calculate judgments
    rawSessions.forEach(s => {
      // Must match the month!
      const sDate = getSafeDateObj(s.date);
      if (!sDate) return;
      if (sDate.getMonth() !== targetMonth || sDate.getFullYear() !== targetYear) return;

      if (s.hasJudgment) {
        const computeAs = s.judgmentClassification || s.judgment?.result || 'غير مصنف';
        addToJudgments(judgments, computeAs, c);
      } else {
        // Implicit examination judgments if not explicitly recorded
        const dec = String(s.decision || '').trim();
        const type = String(s.type || '').trim();
        if (dec.includes('رفض') && type.includes('فحص')) {
          const computeAs = isAppellant ? 'ضد' : isAppellee ? 'صالح' : 'ضد';
          addToJudgments(judgments, computeAs, c);
        } else if (dec.includes('قبول') && type.includes('فحص')) {
          const computeAs = isAppellant ? 'صالح' : isAppellee ? 'ضد' : 'صالح';
          addToJudgments(judgments, computeAs, c);
        }
      }
    });
  });

  return { sessions, memos, casesAdded, judgments };
}

// ─────────────────────────────────────────────────────────────
// calculateDashboardStats: full dashboard aggregation
// ─────────────────────────────────────────────────────────────
export function calculateDashboardStats(cases, settings, globalTasks = []) {
  const appRole = settings?.roles?.[0] || 'طاعن';
  const apeRole = settings?.roles?.[1] || 'مطعون ضدنا';

  let activeCasesCount    = 0;
  let ongoingCount        = 0;
  let reservedCount       = 0;
  let judgedCount         = 0;
  let appellantCount      = 0;
  let appelleeCount       = 0;
  let activeThisMonth     = 0;
  let prevMonthActive     = 0;
  let alerts              = [];
  
  const activeCases       = [];
  const ongoingCases      = [];
  const reservedCases     = [];
  const judgedCases       = [];

  const opponentsCount = {};
  const yearCount      = {};
  const judgmentsCount = {};
  const performanceSplit = { appellant: { good: 0, bad: 0, mixed: 0, procedural: 0, total: 0 }, appellee: { good: 0, bad: 0, mixed: 0, procedural: 0, total: 0 } };
  const criticalSuspended = [];
  const criticalConsidered = [];
  const criticalAgainst = [];

  const today        = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = today.getMonth();
  const currentYear  = today.getFullYear();
  const prevMonth    = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // Last 6 months for trend chart (oldest → newest)
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    last6Months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('ar-EG', { month: 'short' }), count: 0 });
  }

  cases.forEach(c => {
    const role = String(c['الصفة'] || c['صفة'] || '').trim();

    if (role === 'لا شأن' || role === 'خارج الاختصاص') return;

    if (role.includes('لا شأن') || role.includes('خارج الاختصاص')) return;

    // Flexible role check (طاعن / مدعي / مستأنف) vs (مطعون ضدنا / مدعى عليه / مستأنف ضده)
    const isAppellant = role.includes('طاعن') || role.includes('مدعي') || role.includes('مستأنف') || role.includes(appRole);
    const isAppellee  = role.includes('مطعون ضد') || role.includes('مدعى علي') || role.includes(apeRole);

    // "آخر جلسة" field = next scheduled / most-recent session date
    const lastSessionStr  = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'] || '';
    const lastSessionDate = getSafeDateObj(lastSessionStr);

    const year = c['السنة'] || c['سنة'] || c['year'] || 'غير محدد';
    yearCount[year] = (yearCount[year] || 0) + 1;

    // ── Loop over all recorded sessions ──────────────────────
    const sessions = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});

    sessions.forEach(s => {
      const sDate = getSafeDateObj(s.date);
      if (!sDate) return;
      const sMonth = sDate.getMonth(), sYear = sDate.getFullYear();

      // 6-month trend
      const slot = last6Months.find(m => m.month === sMonth && m.year === sYear);
      if (slot) slot.count++;
    });

    // ── Sort sessions (most recent first) for status logic ───
    sessions.sort((a, b) => {
      const da = getSafeDateObj(a.date), db = getSafeDateObj(b.date);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return db.getTime() - da.getTime();
    });

    // Latest recorded session (for decision text)
    const latestSession        = sessions[0];
    // Latest session with hasJudgment=true (judgment entered) or implicit judgment (فحص)
    const latestJudgmentSession = sessions.find(s => {
      if (s.hasJudgment) return true;
      const dec = String(s.decision || '').trim();
      const type = String(s.type || '').trim();
      if ((dec.includes('رفض') || dec.includes('قبول')) && type.includes('فحص')) return true;
      return false;
    });
    const hasHukm              = !!latestJudgmentSession;

    // Last session's decision / قرار
    const lastDecisionRaw = String(
      latestSession?.decision || latestSession?.['القرار'] || latestSession?.['قرار'] || ''
    ).trim();
    const isDecidedForJudgment = lastDecisionRaw.includes('للحكم');

    const deadlineDecision = String(c['القرار'] || c['قرار الجلسة'] || c['المنطوق'] || '');
    const deadlineRules    = settings?.deadlineRules || [];

    // ── Status classification ────────────────────────────────
    let computeAs = 'غير مصنف';
    
    if (hasHukm) {
      // Judgment has been recorded by the user
      const hukmDate = getSafeDateObj(latestJudgmentSession.date);
      judgedCount++;
      judgedCases.push(c); // Count as judged regardless of date (judgment was recorded)

      // Overall judgment distribution
      if (latestJudgmentSession.hasJudgment) {
        computeAs = latestJudgmentSession.judgmentClassification || latestJudgmentSession.judgment?.result || 'غير مصنف';
      } else {
        const dec = String(latestJudgmentSession.decision || '').trim();
        if (dec.includes('رفض')) {
          computeAs = isAppellant ? 'ضد' : isAppellee ? 'صالح' : 'ضد';
        } else if (dec.includes('قبول')) {
          computeAs = isAppellant ? 'صالح' : isAppellee ? 'ضد' : 'صالح';
        }
      }
      
      judgmentsCount[computeAs] = (judgmentsCount[computeAs] || 0) + 1;
      
      const roleKey = isAppellant ? 'appellant' : 'appellee';
      performanceSplit[roleKey].total++;
      if (computeAs === 'صالح') performanceSplit[roleKey].good++;
      else if (computeAs === 'ضد') performanceSplit[roleKey].bad++;
      else if (computeAs === 'مختلط') performanceSplit[roleKey].mixed++;
      else performanceSplit[roleKey].procedural++;

      if (computeAs === 'ضد') { criticalAgainst.push(c); }

      // Deadline alerts (طعن window)
      if (hukmDate) {
        const diffTime = Math.abs(today - hukmDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        deadlineRules.forEach(rule => {
          if (!rule.name.includes('الطعن')) return;
          const targetRole = rule.targetRole || 'طاعنين';
          if ((targetRole === 'طاعنين' && !isAppellant) || (targetRole === 'مطعون ضدنا' && !isAppellee)) return;
          const maxDays = parseInt(rule.days || 60);
          if (diffDays <= maxDays && diffDays >= (maxDays - 15)) {
            alerts.push({ type: 'deadline_alert', case: c, ruleName: rule.name, daysPassed: diffDays, daysLeft: maxDays - diffDays });
          }
        });
      }

    } else if (isDecidedForJudgment) {
      // No judgment recorded yet, but last decision says "للحكم"
      // = محجوز للحكم
      reservedCount++;
      reservedCases.push(c);

    } else {
      // Active ongoing case (has sessions, not reserved, not judged)
      // = إجمالي المتداول
      ongoingCount++;
      ongoingCases.push(c);

      // Deadline alerts (وقف جزائي)
      if (lastSessionDate) {
        const diffTime = Math.abs(today - lastSessionDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        deadlineRules.forEach(rule => {
          if (!rule.name.includes('وقف') || !deadlineDecision.includes('وقف جزائي')) return;
          const targetRole = rule.targetRole || 'طاعنين';
          if ((targetRole === 'طاعنين' && !isAppellant) || (targetRole === 'مطعون ضدنا' && !isAppellee)) return;
          const triggerAfter = parseInt(rule.triggerAfterDays || 30);
          const daysWindow   = parseInt(rule.days || 15);
          if (diffDays >= triggerAfter && diffDays <= (triggerAfter + daysWindow)) {
            alerts.push({ type: 'deadline_alert', case: c, ruleName: rule.name, daysPassed: diffDays, daysLeft: (triggerAfter + daysWindow) - diffDays });
          }
        });
      }
    }

    // ── القضايا النشطة: cases with FUTURE session date ──────
    if (lastSessionDate && lastSessionDate > today) {
      activeCasesCount++;
      activeCases.push(c);
    }

    // ── Appellant / Appellee active counts ───────────────────
    if (!hasHukm) {
      if (isAppellant) appellantCount++;
      if (isAppellee)  appelleeCount++;
    }

    // ── Critical Appellant Judgments (وقف جزائي / اعتبار كأن لم يكن) ──────
    const isCriticalSuspended = isAppellant && (
      (hasHukm && computeAs === 'وقف جزائي') ||
      (!hasHukm && (lastDecisionRaw.includes('وقف جزائي') || deadlineDecision.includes('وقف جزائي')))
    );

    const isCriticalConsidered = isAppellant && (
      (hasHukm && (computeAs === 'اعتبار' || computeAs === 'اعتبار كأن لم تكن')) ||
      (!hasHukm && (lastDecisionRaw.includes('اعتبار') || deadlineDecision.includes('اعتبار')))
    );

    if (isCriticalSuspended) { criticalSuspended.push(c); }
    if (isCriticalConsidered) { criticalConsidered.push(c); }

    // Month-level session counts (for trend badge on header)
    if (lastSessionDate) {
      const lm = lastSessionDate.getMonth(), ly = lastSessionDate.getFullYear();
      const isThisMonth = (lm === currentMonth && ly === currentYear);
      const isPrevMonth = (lm === prevMonth && ly === prevMonthYear);
      const notJudgedYet = !hasHukm || (hasHukm && (getSafeDateObj(latestJudgmentSession.date) || new Date(0)) >= today);
      if (isThisMonth && notJudgedYet) activeThisMonth++;
      if (isPrevMonth && notJudgedYet) prevMonthActive++;
    }

    // Opponent entity counting
    if (isAppellant) {
      const entity = String(c['المدعي'] || c['الطاعن'] || c['المستأنف'] || '').trim();
      if (entity) opponentsCount[entity] = (opponentsCount[entity] || 0) + 1;
    }
  });



  const topYears     = Object.entries(yearCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topOpponents = Object.entries(opponentsCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topJudgments = Object.entries(judgmentsCount).sort((a, b) => b[1] - a[1]);

  return {
    netTotal: cases.length,
    activeCasesCount,
    ongoingCount,
    reservedCount,
    judgedCount,
    activeCases,
    ongoingCases,
    reservedCases,
    judgedCases,
    appellantCount,
    appelleeCount,
    activeThisMonth,
    prevMonthActive,
    topOpponents,
    topYears,
    topJudgments,
    judgmentsCount,
    alerts,
    last6Months,
    criticalSuspended,
    criticalConsidered,
    criticalAgainst,
    performanceSplit,
  };
}
