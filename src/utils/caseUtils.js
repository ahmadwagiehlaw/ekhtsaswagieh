// src/utils/caseUtils.js

export const getFieldVal = (data, keys) => {
  if (!data) return '';
  for (let k of keys) {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
       return data[k];
    }
  }
  return '';
};

/**
 * Calculates the dynamic litigation stage based on case properties and sessions.
 * @param {Object} caseData - The case object
 * @returns {string} The computed litigation stage
 */
export const calculateLitigationStage = (caseData) => {

  const fileLocation = getFieldVal(caseData, ['مكان الملف']);
  const decision = getFieldVal(caseData, ['القرار', 'قرار الجلسة', 'المنطوق']);
  const judgment = getFieldVal(caseData, ['الحكم', 'منطوق الحكم', 'حكم']);
  const isFinalJudgment = getFieldVal(caseData, ['نهائي', 'بات', 'حكم نهائي']);
  
  // Also check sessions for recent decisions/judgments
  let hasSessionJudgment = false;
  let latestSessionDecision = '';
  const role = getFieldVal(caseData, ['الصفة', 'صفة']) || '';
  
  const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
  const isAppellee = role.includes('مطعون ضده') || role.includes('مطعون ضدنا') || role.includes('مستأنف ضده') || role.includes('مدعى عليه') || role.includes('مدعى علينا');

  // Extract latest session and latest judgment session
  const sortedSessions = [...(caseData.sessions || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestSession = sortedSessions[0];
  
  const latestJudgmentSession = sortedSessions.filter(s => s.hasJudgment && s.judgment)[0];
  const stampData = latestJudgmentSession ? latestJudgmentSession.judgment : null;
  const judgmentType = stampData ? stampData.type : '';
  const hasFinalJudgment = stampData ? stampData.isFinal : false;



  // Rule 2: Referral
  if (judgmentType === 'عدم اختصاص وإحالة' || judgmentType === 'إحالة للنيابة' || judgmentType === 'إعادة للمحكمة المختصة' || judgmentType === 'عدم اختصاص واحالة') {
    return 'شعبة المحال';
  }

  // Rule 3 & 4: Judgment states
  if (String(decision).includes('للحكم')) {
    if (hasFinalJudgment) {
      return 'محكوم فيها';
    }
    // Check if the session is in the future
    if (latestSession && new Date(latestSession.date) > new Date()) {
      return 'محجوز للحكم';
    }
  }

  // Rule 5 & 6: Procedural states
  if (judgmentType === 'وقف جزائي') {
    if (isAppellant) {
      return 'موقوف جزائياً والدولة مدعية';
    } else {
      return 'شعبة الأحكام'; // Appellee
    }
  }

  if (judgmentType === 'ندب خبير' || judgmentType === 'وقف تعليقي' || judgmentType === 'تكليف خبير') {
    return 'شعبة الأحكام';
  }

  // Rule 7: Past session inquiry
  if (latestSession) {
    const sessionDate = new Date(latestSession.date);
    const now = new Date();
    // Normalize to start of day
    sessionDate.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    
    const diffTime = Math.abs(now - sessionDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (sessionDate < now && diffDays > 30 && !String(decision).includes('للحكم')) {
      return 'استعلام';
    }
  }

  // Default Fallback Rule 8: Ongoing
  return 'متداول';
};
