import { getSafeDateObj } from './dateUtils';
import { getSessionDate, getCaseRole, getCaseDecision } from './caseUtils';
import { isAppellantRole, isAppelleeRole, isNoInterestRole, isOutOfJurisdictionRole } from '../constants/roleHelpers';
import { getActiveMapping, resolveImpact, isStopImpact, evaluateSessionRule } from './statsMapping';

function addToJudgments(target, computeAs, mapping, c = null, settings = {}) {
  const entry = mapping.find(m => m.value === computeAs);
  if (entry && entry.dashboardVisible === false) {
    return; // Ignore completely
  }

  target.total++;
  let impact = entry ? entry.impact : resolveImpact(computeAs, mapping);

  // Enforce Appellant constraint for Stop and Consideration
  if (impact === 'stop' || impact === 'consideration') {
    const role = c ? getCaseRole(c) : '';
    const isAppel = isAppellantRole(role, settings);
    if (!isAppel) {
       // If the state is not the appellant, it shouldn't be counted in the negative "وقف مدعين" buckets.
       // Redirect to 'other' unless they explicitly mapped it to 'good' in evaluateSessionRule (which isn't used here).
       impact = 'other';
    }
  }

  if (impact === 'good')          { target.good++;          if (c) target.lists.good.push(c); }
  else if (impact === 'bad')      { target.bad++;           if (c) target.lists.bad.push(c); }
  else if (impact === 'stop')     {
    target.stop++;
    target.penaltyStop = (target.penaltyStop || 0) + 1;
    if (c) target.lists.stop.push(c);
  }
  else if (impact === 'consideration') { target.consideration++; if (c) target.lists.consideration.push(c); }
  else if (impact === 'mixed')    { target.mixed = (target.mixed || 0) + 1; if (c) target.lists.mixed.push(c); }
  else if (impact === 'ignore')   { target.total--; }
  else                             target.other++;
}

const emptyJudgments = () =>
  ({ total: 0, good: 0, bad: 0, stop: 0, penaltyStop: 0, consideration: 0, other: 0, mixed: 0, lists: { good: [], bad: [], stop: [], consideration: [], mixed: [] } });

// ─────────────────────────────────────────────────────────────
// computeMonthStats: returns per-month stats for any month/year
// Used by Dashboard for the interactive month-selector
// ─────────────────────────────────────────────────────────────
// computeMonthStats moved below
export function calculateCaseAlerts(c, settings) {
  if (!c || !settings?.deadlineRules) return [];
  const alerts = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const role = getCaseRole(c);
  const isAppellant = isAppellantRole(role);
  const isAppellee  = isAppelleeRole(role);
  const mapping = getActiveMapping(settings);

  const deadlineRules = settings.deadlineRules || [];

  const hasHukm = c.judgments && c.judgments.length > 0;
  if (hasHukm) {
    const sorted = [...c.judgments].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
    const latest = sorted[0];
    const hukmDate = getSafeDateObj(latest.date);
    if (hukmDate) {
      const diffTime = Math.abs(today - hukmDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      deadlineRules.forEach(rule => {
        if (!rule.name.includes('الطعن')) return;
        const targetRole = rule.targetRole || 'طاعنين';
        if ((targetRole === 'طاعنين' && !isAppellant) || (targetRole === 'مطعون ضده' && !isAppellee)) return;
        const maxDays = parseInt(rule.days || 60);
        if (diffDays <= maxDays && diffDays >= (maxDays - 15)) {
          alerts.push({ type: 'deadline_alert', case: c, ruleName: rule.name, daysPassed: diffDays, daysLeft: maxDays - diffDays });
        }
      });
    }
  } else {
    const lastSessionDate = getSafeDateObj(getSessionDate(c));
    const deadlineDecision = getCaseDecision(c);
    if (lastSessionDate) {
      const diffTime = Math.abs(today - lastSessionDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // Check if decision contains any stop-impact value
      const hasStopDecision = mapping
        .filter(m => m.impact === 'stop')
        .some(m => deadlineDecision.includes(m.value));
      deadlineRules.forEach(rule => {
        if (!rule.name.includes('تعجيل') || !hasStopDecision) return;
        const targetRole = rule.targetRole || 'طاعنين';
        if ((targetRole === 'طاعنين' && !isAppellant) || (targetRole === 'مطعون ضده' && !isAppellee)) return;
        const triggerAfter = parseInt(rule.triggerAfterDays || 30);
        const daysWindow   = parseInt(rule.days || 15);
        if (diffDays >= triggerAfter && diffDays <= (triggerAfter + daysWindow)) {
          alerts.push({ type: 'deadline_alert', case: c, ruleName: rule.name, daysPassed: diffDays, daysLeft: (triggerAfter + daysWindow) - diffDays });
        }
      });
    }
  }
  return alerts;
}

// ─────────────────────────────────────────────────────────────
// calculateDashboardStats: full dashboard aggregation
// ─────────────────────────────────────────────────────────────
export function calculateDashboardStats(cases, settings) {
  let activeCasesCount    = 0;
  let ongoingCount        = 0;
  let ongoingAppellantCount = 0;
  let ongoingAppelleeCount = 0;
  let staleOngoingCases = [];
  let totalResolutionDays = 0;
  let resolvedCasesCount = 0;
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

  const mapping = getActiveMapping(settings);

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
    last6Months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('ar-EG', { month: 'short' }), count: 0, good: 0, bad: 0 });
  }

  cases.forEach(c => {
    const role = getCaseRole(c);

    if (isNoInterestRole(role) || isOutOfJurisdictionRole(role)) return;

    const isAppellant = isAppellantRole(role, settings);
    const isAppellee  = isAppelleeRole(role, settings);

    const lastSessionStr  = getSessionDate(c);
    const lastSessionDate = getSafeDateObj(lastSessionStr);

    const year = c['السنة'] || c['سنة'] || c['year'] || 'غير محدد';
    yearCount[year] = (yearCount[year] || 0) + 1;

    const sessions = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});

    sessions.forEach(s => {
      const sDate = getSafeDateObj(s.date);
      if (!sDate) return;
      const sMonth = sDate.getMonth(), sYear = sDate.getFullYear();
      const slot = last6Months.find(m => m.month === sMonth && m.year === sYear);
      if (slot) {
        slot.count++;
        const rule = evaluateSessionRule({ ...c, ...s }, mapping);
        if (rule) {
          if (rule.impact === 'good') slot.good++;
          if (rule.impact === 'bad') slot.bad++;
        }
      }
    });

    sessions.sort((a, b) => {
      const da = getSafeDateObj(a.date), db = getSafeDateObj(b.date);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return db.getTime() - da.getTime();
    });

    const latestSession = sessions[0];
    const latestJudgmentSession = sessions.find(s => {
      if (s.hasJudgment) return true;
      const dec = String(s.decision || '').trim();
      const type = String(s.type || '').trim();
      if ((dec.includes('رفض') || dec.includes('قبول')) && type.includes(settings?.sessionTypes?.[0] || 'فحص')) return true;
      return false;
    });
    const hasHukm = !!latestJudgmentSession;

    const lastDecisionRaw = String(
      latestSession?.decision || latestSession?.['القرار'] || latestSession?.['قرار'] || ''
    ).trim();
    const isDecidedForJudgment = lastDecisionRaw.includes('للحكم') || (String(c['القرار'] || '').includes('للحكم'));

    const deadlineDecision = String(c['القرار'] || c['قرار الجلسة'] || c['المنطوق'] || '');
    const deadlineRules    = settings?.deadlineRules || [];

    let computeAs = 'غير مصنف';
    
    if (hasHukm) {
      const hukmDate = getSafeDateObj(latestJudgmentSession.date);
      judgedCount++;
      judgedCases.push(c);
      if (sessions.length > 0) {
        const firstSession = sessions[sessions.length - 1];
        const dateFromSystem = c['تاريخ رفع الدعوى'] || c['تاريخ الإيداع'] || c['تاريخ قيد الدعوى'];
        let firstDate = getSafeDateObj(dateFromSystem);
        if (hukmDate && firstDate && hukmDate >= firstDate) {
          totalResolutionDays += (hukmDate - firstDate) / (1000 * 60 * 60 * 24);
          resolvedCasesCount++;
        }
      }

      // New dynamic rule-based evaluation
      const evalContext = { ...c, ...(latestJudgmentSession || {}) };
      let rule = evaluateSessionRule(evalContext, mapping);
      
      // Fallback if no rule matches
      if (!rule) {
        if (latestJudgmentSession.hasJudgment) {
          computeAs = latestJudgmentSession.judgmentClassification || latestJudgmentSession.judgment?.result || 'غير محدد';
        } else {
          const dec = String(latestJudgmentSession.decision || '').trim();
          if (dec.includes('صالح')) {
            computeAs = isAppellant ? 'صالح' : isAppellee ? 'ضد' : 'مختلط';
          } else if (dec.includes('مرفوض')) {
            computeAs = isAppellant ? 'ضد' : isAppellee ? 'صالح' : 'مختلط';
          }
        }
        rule = mapping.find(m => m.value === computeAs);
      } else {
        computeAs = rule.value;
      }
      
      const impact = rule ? rule.impact : 'procedural';
      
      if (impact === 'ignore') {
        // completely ignore this case in judgment stats
        judgedCount--;
        judgedCases.pop(); // remove from judged array we pushed to earlier
        return; // skip the rest of the loop for this case
      }
      
      const dashboardVisible = rule ? (rule.dashboardVisible !== false) : true;
      if (dashboardVisible) {
        judgmentsCount[computeAs] = (judgmentsCount[computeAs] || 0) + 1;
      }
      
      const countInPerf = rule ? rule.countsInPerformance : false;
      const roleKey = isAppellant ? 'appellant' : 'appellee';

      if (countInPerf) {
        performanceSplit[roleKey].total++;
        if (impact === 'good')  performanceSplit[roleKey].good++;
        else if (impact === 'bad')   performanceSplit[roleKey].bad++;
        else if (impact === 'mixed') performanceSplit[roleKey].mixed++;
        else                         performanceSplit[roleKey].procedural++;
      }

      // Critical cases: bad or stop impacts
      if (impact === 'bad')  { criticalAgainst.push(c); }
      if (impact === 'stop') { criticalSuspended.push(c); }
      if (impact === 'consideration') { criticalConsidered.push(c); }

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
      reservedCount++;
      reservedCases.push(c);

    } else {
      ongoingCount++;
      ongoingCases.push(c);
      if (isAppellant) ongoingAppellantCount++;
      if (isAppellee) ongoingAppelleeCount++;
      const isForInquiry = deadlineDecision.includes('للاستعلام') || lastDecisionRaw.includes('للاستعلام');
      if (!lastSessionDate || isForInquiry) staleOngoingCases.push(c);

      // Deadline alerts (وقف جزائي) — detect any stop-impact value in decision text
      if (lastSessionDate) {
        const hasStopDecision = mapping
          .filter(m => m.impact === 'stop')
          .some(m => deadlineDecision.includes(m.value) || lastDecisionRaw.includes(m.value));

        if (hasStopDecision) {
          const diffTime = Math.abs(today - lastSessionDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          deadlineRules.forEach(rule => {
            if (!rule.name.includes('وقف')) return;
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
    }

    // ── Critical Judgments (for ongoing cases — session-level detection) ──
    if (!hasHukm) {
      const evalContext = { ...c, ...(latestSession || {}) };
      // Fallback: copy last decision into 'القرار' so rules targeting 'القرار' work on ongoing cases too
      if (!evalContext['القرار'] && lastDecisionRaw) {
          evalContext['القرار'] = lastDecisionRaw;
      }
      
      let rule = evaluateSessionRule(evalContext, mapping);
      const impact = rule ? rule.impact : 'procedural';

      if (isAppellant && impact === 'stop')    criticalSuspended.push(c);
      if (isAppellant && impact === 'consideration')   criticalConsidered.push(c);
      
      // Fallback for substring matching if rule didn't explicitly hit
      if (impact !== 'stop' && impact !== 'consideration') {
          const hasStopDecision = mapping.filter(m => m.impact === 'stop').some(m => lastDecisionRaw.includes(m.value) || deadlineDecision.includes(m.value));
          const hasConsideration = mapping.filter(m => m.impact === 'consideration').some(m => lastDecisionRaw.includes(m.value) || deadlineDecision.includes(m.value));
          if (isAppellant && hasStopDecision)    criticalSuspended.push(c);
          if (isAppellant && hasConsideration)   criticalConsidered.push(c);
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

    // Month-level session counts
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
      // We are appellant — opponent is the appellee/defendant
      const entity = String(c['المطعون ضده'] || c['المدعى_عليه'] || c['المدعى عليه'] || '').trim();
      if (entity) opponentsCount[entity] = (opponentsCount[entity] || 0) + 1;
    } else if (isAppellee) {
      // We are appellee — opponent is the appellant/plaintiff
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
    ongoingAppellantCount,
    ongoingAppelleeCount,
    staleOngoingCases,
    avgResolutionDays: resolvedCasesCount > 0 ? totalResolutionDays / resolvedCasesCount : 0
  };
}


// ─────────────────────────────────────────────────────────────
// computeMultiMonthStats & computeMonthStats
// ─────────────────────────────────────────────────────────────
export function computeMultiMonthStats(cases, settings, monthsList) {
  const memoCalcMode = settings?.memoCalculationMode || 'session_date';
  const mapping = getActiveMapping(settings);

  const buckets = {};
  monthsList.forEach(({ month, year }) => {
    buckets[`${year}-${month}`] = { sessions: 0, memos: 0, casesAdded: 0, judgments: emptyJudgments() };
  });

  const findBucket = (d) => {
    if (!d) return null;
    return buckets[`${d.getFullYear()}-${d.getMonth()}`] || null;
  };

  cases.forEach(c => {
    const role = getCaseRole(c);
    if (isNoInterestRole(role) || isOutOfJurisdictionRole(role)) return;
    const isAppellant = isAppellantRole(role, settings);
    const isAppellee  = isAppelleeRole(role, settings);

    const createdAtDate = getSafeDateObj(c.createdAt || c.timestamp || '');
    const createdBucket = findBucket(createdAtDate);
    if (createdBucket) createdBucket.casesAdded++;

    const rawSessions = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});

    rawSessions.forEach(s => {
      const sDate = getSafeDateObj(s.date);
      const bucket = findBucket(sDate);
      if (!bucket) return;
      bucket.sessions++;

      if (s.hasJudgment) {
        const computeAs = s.judgmentClassification || s.judgment?.result || 'غير مصنف';
        addToJudgments(bucket.judgments, computeAs, mapping, c, settings);
      } else {
        const dec = String(s.decision || '').trim();
        const type = String(s.type || '').trim();
        if (dec.includes('رفض') && type.includes(settings?.sessionTypes?.[0] || 'فحص')) {
          const computeAs = isAppellant ? 'ضد' : isAppellee ? 'صالح' : 'ضد';
          addToJudgments(bucket.judgments, computeAs, mapping, c, settings);
        } else if (dec.includes('قبول') && type.includes(settings?.sessionTypes?.[0] || 'فحص')) {
          const computeAs = isAppellant ? 'صالح' : isAppellee ? 'ضد' : 'صالح';
          addToJudgments(bucket.judgments, computeAs, mapping, c, settings);
        }
      }
    });

    const procedures = Array.isArray(c.procedures) ? c.procedures : Object.values(c.procedures || {});
    procedures.forEach(p => {
      if (p.title && (p.title.includes('مذكرة') || p.title.includes('مذكرات'))) {
        let targetDateStr = memoCalcMode === 'session_date' ? p.date : p.createdAt;
        if (!targetDateStr) targetDateStr = p.date || p.createdAt;
        const bucket = findBucket(getSafeDateObj(targetDateStr));
        if (bucket) bucket.memos++;
      }
    });
  });

  return buckets;
}

export function computeMonthStats(cases, settings, targetMonth, targetYear) {
  const buckets = computeMultiMonthStats(cases, settings, [{ month: targetMonth, year: targetYear }]);
  return buckets[`${targetYear}-${targetMonth}`];
}
