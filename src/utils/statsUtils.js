import { getSafeDateObj, formatDateString } from './dateUtils';

export function calculateDashboardStats(cases, settings) {
  let appellantCount = 0;
  let appelleeCount = 0;

  let judgedCount = 0; // المحكوم فيه
  let reservedCount = 0; // محجوز للحكم
  let ongoingCount = 0; // متداول

  let noInterestCount = 0; // لا شأن
  let outOfJurisdictionCount = 0; // خارج الاختصاص

  let activeThisMonth = 0;
  let alerts = [];

  const opponentsCount = {}; // For Appellant cases only
  const yearCount = {};
  const judgmentsCount = {}; // For Judgment Classification

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  cases.forEach(c => {
    const role = String(c['الصفة'] || c['صفة'] || '').trim();
    
    if (role === 'لا شأن') noInterestCount++;
    if (role === 'خارج الاختصاص') outOfJurisdictionCount++;
    
    // Ignore these two types from all dashboard statistics
    if (role === 'لا شأن' || role === 'خارج الاختصاص') return;

    const appRole = settings?.roles?.[0] || 'طاعن';
    const isAppellant = role.includes(appRole) || role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
    const apeRole = settings?.roles?.[1] || 'مطعون ضدنا';
    const isAppellee = role.includes(apeRole) || role.includes('مطعون ضده') || role.includes('مطعون ضدنا') || role.includes('مستأنف ضده') || role.includes('مدعى عليه') || role.includes('مدعى علينا');

    const lastSessionStr = c['آخر جلسة'] || c['تاريخ الجلسة'] || c['أخر جلسة'] || '';
    const lastSessionDate = getSafeDateObj(lastSessionStr);

    let isOngoingForEntity = false;
    if (lastSessionDate) {
      if (lastSessionDate >= today || (lastSessionDate.getMonth() === currentMonth && lastSessionDate.getFullYear() === currentYear)) {
        isOngoingForEntity = true;
      }
    }

    if (isOngoingForEntity) {
      if (isAppellant) appellantCount++;
      if (isAppellee) appelleeCount++;
    }

    const year = c['السنة'] || c['سنة'] || c['year'] || 'غير محدد';
    yearCount[year] = (yearCount[year] || 0) + 1;

    // Use sessions to determine judgment accurately
    const sessions = Array.isArray(c.sessions) ? c.sessions : Object.values(c.sessions || {});
    // Sort sessions by date descending
    sessions.sort((a, b) => {
      const da = getSafeDateObj(a.date);
      const db = getSafeDateObj(b.date);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime();
    });

    const latestJudgmentSession = sessions.find(s => s.hasJudgment);
    const hasHukm = !!latestJudgmentSession;
    const decision = String(c['القرار'] || c['قرار الجلسة'] || c['المنطوق'] || '');
    
    const deadlineRules = settings?.deadlineRules || [];

    if (hasHukm) {
      const hukmDate = getSafeDateObj(latestJudgmentSession.date);
      if (hukmDate && hukmDate < today) {
        judgedCount++;
      } else {
        reservedCount++;
      }
      
      let result = latestJudgmentSession.judgment?.result || latestJudgmentSession.judgmentClassification || 'غير مصنف';
      
      // Old data mapping
      if (result === 'للصالح') result = 'صالح';
      if (result === 'للضد') result = 'ضد';
      if (result === 'إجرائي') result = 'تمهيدي';
      if (result === 'جزئي') result = 'غير منه للخصومة';

      let computeAs = result;
      if (result === 'حكم منه للخصومة') {
        if (isAppellee) computeAs = 'صالح';
        else if (isAppellant) computeAs = 'ضد';
      }
      
      judgmentsCount[computeAs] = (judgmentsCount[computeAs] || 0) + 1;
      
      // Check for post-judgment deadlines (e.g. appeal)
      if (hukmDate) {
        const diffTime = Math.abs(today - hukmDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        deadlineRules.forEach(rule => {
           if (!rule.name.includes('الطعن')) return;
           const targetRole = rule.targetRole || 'طاعنين';
           if ((targetRole === 'طاعنين' && !isAppellant) || (targetRole === 'مطعون ضدنا' && !isAppellee)) return;
           
           const maxDays = parseInt(rule.days || 60);
           // Alert if within 15 days of deadline
           if (diffDays <= maxDays && diffDays >= (maxDays - 15)) {
              alerts.push({
                 type: 'deadline_alert',
                 case: c,
                 ruleName: rule.name,
                 daysPassed: diffDays,
                 daysLeft: maxDays - diffDays
              });
           }
        });
      }

    } else {
      ongoingCount++;
      
      // Check for ongoing deadlines (e.g. Waqf)
      if (lastSessionDate) {
         const diffTime = Math.abs(today - lastSessionDate);
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         
         deadlineRules.forEach(rule => {
            if (!rule.name.includes('وقف') || !decision.includes('وقف جزائي')) return;
            const targetRole = rule.targetRole || 'طاعنين';
            if ((targetRole === 'طاعنين' && !isAppellant) || (targetRole === 'مطعون ضدنا' && !isAppellee)) return;
            
            const triggerAfter = parseInt(rule.triggerAfterDays || 30);
            const daysWindow = parseInt(rule.days || 15);
            
            if (diffDays >= triggerAfter && diffDays <= (triggerAfter + daysWindow)) {
               alerts.push({
                  type: 'deadline_alert',
                  case: c,
                  ruleName: rule.name,
                  daysPassed: diffDays,
                  daysLeft: (triggerAfter + daysWindow) - diffDays
               });
            }
         });
      }
    }

    // Active this month
    if (lastSessionDate) {
      if (lastSessionDate.getMonth() === currentMonth && lastSessionDate.getFullYear() === currentYear) {
        if (!hasHukm || (hasHukm && getSafeDateObj(latestJudgmentSession.date) >= today)) {
          activeThisMonth++;
        }
      }
    }

    // Entities
    if (isAppellant) {
      let entity = String(c['المدعي'] || c['الطاعن'] || c['المستأنف'] || 'غير محدد').trim();
      if (entity) {
        opponentsCount[entity] = (opponentsCount[entity] || 0) + 1;
      }
    }
  });

  const topYears = Object.entries(yearCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topOpponents = Object.entries(opponentsCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topJudgments = Object.entries(judgmentsCount).sort((a, b) => b[1] - a[1]);

  return {
    all: cases.length,
    netTotal: cases.length - noInterestCount - outOfJurisdictionCount,
    noInterest: noInterestCount,
    outOfJurisdiction: outOfJurisdictionCount,
    appellant: appellantCount,
    appellee: appelleeCount,
    judged: judgedCount,
    reserved: reservedCount,
    ongoing: ongoingCount,
    activeThisMonth,
    topOpponents,
    topYears,
    topJudgments,
    alerts
  };
}
