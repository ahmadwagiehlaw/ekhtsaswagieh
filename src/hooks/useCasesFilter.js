import { useMemo } from 'react';
import { getSafeDateObj } from '../utils/dateUtils';
import { getSessionDate, getCaseDecision, getFileLocation, getAppellantName, getAppelleeName, getSessionType } from '../utils/caseUtils';

export default function useCasesFilter({
  cases,
  settings,
  globalTasks,
  activeShoba,
  roleFilter,
  showSessionlessOnly,
  showJudgmentsOnly,
  showImportantOnly,
  showPastSessionsOnly,
  showOngoingOnly,
  showWithAttachmentsOnly,
  showMissingRoleOnly,
  locationFilter,
  sessionTypeFilter,
  decisionFilter,
  quickDateFilter,
  advancedParams,
  debouncedSearchQuery
}) {

  const uniqueLocations = useMemo(() => {
    const locs = new Set();
    cases.forEach(c => {
      const loc = String(getFileLocation(c)).trim();
      if (loc && loc !== '-' && loc !== 'مقيدة' && loc !== 'غير موجود' && loc !== 'ملف مؤقت') {
        locs.add(loc);
      }
    });
    return Array.from(locs).sort();
  }, [cases]);

  const uniqueDates = useMemo(() => {
    const dates = new Set();
    cases.forEach(c => {
      const dStr = getSessionDate(c);
      if (dStr) {
        const d = getSafeDateObj(dStr);
        if (d) {
          const pad = n => n.toString().padStart(2, '0');
          dates.add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
        }
      }
    });
    return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
  }, [cases]);

  const filteredCases = useMemo(() => {
    let result = cases;

    // 1. Shoba Filter
    const archiveLocations = settings?.archiveLocations || ['شعبة الحفظ', 'الحفظ', 'حفظ'];

    const isSpecialLocation = (loc) => {
      if (!loc) return false;
      if (archiveLocations.includes(loc)) return false;
      return loc === 'شعبة تحت التحديد' || loc === 'تحت التحديد';
    };

    if (activeShoba === 'متداول') {
      result = result.filter(c => {
        const loc = String(getFileLocation(c)).trim();
        return !archiveLocations.includes(loc) && !isSpecialLocation(loc);
      });
    } else if (activeShoba === 'تحت_التحديد') {
      result = result.filter(c => {
        const loc = String(getFileLocation(c)).trim();
        return isSpecialLocation(loc);
      });
    } else if (activeShoba === 'حفظ') {
      result = result.filter(c => {
        const loc = String(getFileLocation(c)).trim();
        return archiveLocations.includes(loc);
      });
    }

    if (roleFilter && roleFilter !== 'all') {
      const roles = roleFilter.split(',').filter(x => x && x !== 'all');
      if (roles.length > 0) {
        result = result.filter(c => {
          const role = String(c['الصفة'] || c['صفة'] || '').trim();
          const appRole = settings?.roles?.[0] || 'طاعن';
          const apeRole = settings?.roles?.[1] || 'مطعون ضدنا';
          return roles.some(r => {
            if (r === 'appellant') return role.includes(appRole) || role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
            if (r === 'appellee') return role.includes(apeRole) || role.includes('مطعون') || role.includes('مستأنف ضده') || role.includes('مدعى عليه') || role.includes('مدعى علينا');
            if (r === 'none') return !role || role === '-' || role === '---' || role === 'غير محدد';
            return false;
          });
        });
      }
    }

    if (showSessionlessOnly) {
      result = result.filter(c => {
        const dateStr = getSessionDate(c);
        if (!dateStr) return true;
        const d = getSafeDateObj(dateStr);
        return !d;
      });
    }

    if (showJudgmentsOnly) {
      result = result.filter(c => {
        const fileLocation = String(getFileLocation(c)).trim();
        if (fileLocation === 'الأحكام') return true;
        const decision = String(getCaseDecision(c)).trim();
        if (decision.includes('حكم نهائي وبات')) return true;
        return false;
      });
    }

    if (showImportantOnly) {
      result = result.filter(c => c.isImportant);
    }

    if (showPastSessionsOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      result = result.filter(c => {
        const dateStr = getSessionDate(c);
        if (!dateStr) return false;
        const d = getSafeDateObj(dateStr);
        if (!d) return false;
        return d < today;
      });
    }

    if (showOngoingOnly) {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      result = result.filter(c => {
        const dateStr = getSessionDate(c);
        if (!dateStr) return false;
        const d = getSafeDateObj(dateStr);
        if (!d) return false;
        return d >= firstDayOfMonth;
      });
    }

    if (showWithAttachmentsOnly) {
      result = result.filter(c => c.documents && c.documents.length > 0);
    }

    if (showMissingRoleOnly) {
      result = result.filter(c => {
        const appellant = String(getAppellantName(c)).trim();
        const appellee = String(getAppelleeName(c)).trim();
        return !appellant || appellant === '-' || !appellee || appellee === '-';
      });
    }

    // ── Multi-value filters with exclude: support ──────────────────────────

    if (locationFilter && locationFilter !== 'all') {
      const isExclude = locationFilter.startsWith('exclude:');
      const rawVal = isExclude ? locationFilter.slice('exclude:'.length) : locationFilter;
      const locs = rawVal.split(',').filter(x => x && x !== 'all');
      if (locs.length > 0) {
        result = result.filter(c => {
          const loc = String(getFileLocation(c)).trim();
          const matches = locs.some(l => {
            if (l === 'missing') return loc === 'غير موجود' || loc === 'مقيدة' || loc === '';
            if (l === 'temp') return loc === 'ملف مؤقت';
            return loc === l;
          });
          return isExclude ? !matches : matches;
        });
      }
    }

    if (sessionTypeFilter && sessionTypeFilter !== 'all') {
      const isExclude = sessionTypeFilter.startsWith('exclude:');
      const rawVal = isExclude ? sessionTypeFilter.slice('exclude:'.length) : sessionTypeFilter;
      const types = rawVal.split(',').filter(x => x && x !== 'all');
      if (types.length > 0) {
        result = result.filter(c => {
          const decision = String(getCaseDecision(c)).trim();
          const sessionType = String(getSessionType(c)).trim();
          const matches = types.some(t => {
            if (t === 'judgment') return decision.includes('للحكم') || decision.includes('حكم') || sessionType.includes('حكم');
            return sessionType.includes(t) || decision.includes(t);
          });
          return isExclude ? !matches : matches;
        });
      }
    }

    if (decisionFilter) {
      const qs = decisionFilter.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
      if (qs.length > 0) {
        result = result.filter(c => {
          const decision = String(getCaseDecision(c)).toLowerCase();
          return qs.some(q => decision.includes(q));
        });
      }
    }

    if (quickDateFilter && quickDateFilter !== 'all') {
      const isExclude = quickDateFilter.startsWith('exclude:');
      const rawVal = isExclude ? quickDateFilter.slice('exclude:'.length) : quickDateFilter;
      const dates = rawVal.split(',').filter(Boolean);
      if (dates.length > 0) {
        result = result.filter(c => {
          const dStr = getSessionDate(c);
          if (!dStr) return isExclude;
          const d = getSafeDateObj(dStr);
          if (!d) return isExclude;
          const pad = n => n.toString().padStart(2, '0');
          const dISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          const matches = dates.includes(dISO);
          return isExclude ? !matches : matches;
        });
      }
    }

    // ── Advanced search params ─────────────────────────────────────────────

    if (advancedParams) {
      const { caseNo, year, opponentName, opponentRole, decision, sessionDateStart, sessionDateEnd, court, location, requiredTask, requiredTaskType } = advancedParams;

      result = result.filter(c => {
        // 1. Case No
        if (caseNo && !(c['رقم الدعوى'] || c['رقم القضية'] || c.id)?.toString().includes(caseNo)) return false;

        // 2. Year
        if (year && !(c['السنة'] || c['سنة'])?.toString().includes(year)) return false;

        // 3. Opponent
        if (opponentName) {
          const name = opponentName.toLowerCase();
          const appellant = (c['الطاعن'] || c['المدعي'] || c['المستأنف'] || '').toLowerCase();
          const appellee = (c['المطعون ضده'] || c['المدعى عليه'] || '').toLowerCase();

          if (opponentRole === 'appellant') {
            if (!appellant.includes(name)) return false;
          } else if (opponentRole === 'appellee') {
            if (!appellee.includes(name)) return false;
          } else {
            if (!appellant.includes(name) && !appellee.includes(name)) return false;
          }
        }

        // 4. Decision
        if (decision) {
          const caseDecision = getCaseDecision(c);
          if (decision === 'حكم') {
            if (!caseDecision.includes('حكم') && !caseDecision.includes('للحكم')) return false;
          } else if (decision === 'للحكم') {
            if (caseDecision !== 'للحكم' && caseDecision !== 'محجوز للحكم') return false;
          } else {
            if (!caseDecision.includes(decision)) return false;
          }
        }

        // Required Task
        if (requiredTask) {
          const hasRequiredTask = globalTasks.some(t => t.status === 'pending' && t.title === requiredTask && t.linkedCases?.includes(c.id));
          if (!hasRequiredTask) return false;
        }
        if (requiredTaskType) {
          const hasRequiredTaskType = globalTasks.some(t => t.status === 'pending' && t.type === requiredTaskType && t.linkedCases?.includes(c.id));
          if (!hasRequiredTaskType) return false;
        }

        // 5. Session Date
        if (sessionDateStart || sessionDateEnd) {
          const caseDateStr = getSessionDate(c);
          if (!caseDateStr) return false;
          const caseDate = getSafeDateObj(caseDateStr);
          if (!caseDate) return false;

          if (sessionDateStart && caseDate < new Date(sessionDateStart)) return false;
          if (sessionDateEnd && caseDate > new Date(sessionDateEnd)) return false;
        }

        // 6. Court
        if (court && c['المحكمة'] !== court) return false;

        // 7. Location
        if (location && getFileLocation(c) !== location) return false;

        return true;
      });
    } else if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(c => {
        const caseNo = c['رقم الدعوى'] || c['رقم القضية'] || c['رقم_الدعوى'] || '';
        const year = c['السنة'] || c['سنة'] || c['year'] || '';
        const appellant = c['الطاعن'] || c['المدعي'] || c['المستأنف'] || '';
        const appellee = c['المطعون ضده'] || c['المدعى عليه'] || '';
        const decision = getCaseDecision(c);
        const sessionType = getSessionType(c);
        const fileLocation = getFileLocation(c);

        return [caseNo, year, appellant, appellee, decision, sessionType, fileLocation]
          .some(v => String(v || '').toLowerCase().includes(q));
      });
    }

    return result;
  }, [
    cases, settings, globalTasks, activeShoba,
    roleFilter, showOngoingOnly, showWithAttachmentsOnly,
    locationFilter,
    sessionTypeFilter,
    decisionFilter,
    quickDateFilter,
    showSessionlessOnly, showJudgmentsOnly, showImportantOnly,
    showPastSessionsOnly, showMissingRoleOnly, advancedParams, debouncedSearchQuery
  ]);

  return { uniqueLocations, uniqueDates, filteredCases };
}
