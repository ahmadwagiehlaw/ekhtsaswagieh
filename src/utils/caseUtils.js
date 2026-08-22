// src/utils/caseUtils.js
import { 
  SESSION_DATE_KEYS, 
  DECISION_KEYS, 
  CASE_NO_KEYS, 
  YEAR_KEYS, 
  ROLE_KEYS, 
  APPELLANT_KEYS, 
  APPELLEE_KEYS,
  LOCATION_KEYS,
  IS_FINAL_KEYS,
  JUDGMENT_KEYS,
  SESSION_TYPE_KEYS,
  ROLL_KEYS
} from '../constants/caseFields';
import { isAppellantRole, isAppelleeRole } from '../constants/roleHelpers';
import { getSafeDateObj } from './dateUtils';

export const getFieldVal = (data, keys) => {
  if (!data) return '';
  for (let k of keys) {
    if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
       return data[k];
    }
  }
  return '';
};

export const getSessionDate = (caseData) => getFieldVal(caseData, SESSION_DATE_KEYS);
export const getCaseDecision = (caseData) => getFieldVal(caseData, DECISION_KEYS);
export const getCaseRole = (caseData) => getFieldVal(caseData, ROLE_KEYS);
export const getCaseNo = (caseData) => getFieldVal(caseData, CASE_NO_KEYS);
export const getCaseYear = (caseData) => getFieldVal(caseData, YEAR_KEYS);
export const getAppellantName = (caseData) => getFieldVal(caseData, APPELLANT_KEYS);
export const getAppelleeName = (caseData) => getFieldVal(caseData, APPELLEE_KEYS);
export const getFileLocation = (caseData) => getFieldVal(caseData, LOCATION_KEYS);
export const getSessionType = (caseData) => getFieldVal(caseData, SESSION_TYPE_KEYS);
export const getCaseRoll = (caseData) => getFieldVal(caseData, ROLL_KEYS);

/**
 * Synchronizes the root level fields with the latest session in the sessions array.
 * @param {Object} caseData - The case object
 * @returns {Object} A new case object with synced root fields
 */
export const syncSessionRootFields = (caseData) => {
  const newCaseData = { ...caseData };
  const sortedSessions = [...(newCaseData.sessions || [])].sort((a, b) => getSafeDateObj(b.date) - getSafeDateObj(a.date));
  
  const rootSessionKey = Object.keys(newCaseData).find(k => SESSION_DATE_KEYS.includes(k)) || 'آخر جلسة';
  const rootDecisionKey = Object.keys(newCaseData).find(k => DECISION_KEYS.includes(k)) || 'القرار';
  const rootRollKey = Object.keys(newCaseData).find(k => ROLL_KEYS.includes(k)) || 'الرول';
  const rootTypeKey = Object.keys(newCaseData).find(k => SESSION_TYPE_KEYS.includes(k)) || 'نوع الجلسة';

  if (sortedSessions.length > 0) {
    newCaseData[rootSessionKey] = sortedSessions[0].date;
    newCaseData[rootDecisionKey] = sortedSessions[0].decision || '';
    newCaseData[rootRollKey] = sortedSessions[0].roll || '';
    newCaseData[rootTypeKey] = sortedSessions[0].type || '';
  } else {
    // Optionally clear them if no sessions exist, or leave them. Let's clear them to prevent desync.
    newCaseData[rootSessionKey] = '';
    newCaseData[rootDecisionKey] = '';
    newCaseData[rootRollKey] = '';
    newCaseData[rootTypeKey] = '';
  }
  return newCaseData;
};

/**
 * Calculates the dynamic litigation stage based on case properties and sessions.
 * @param {Object} caseData - The case object
 * @param {Object} settings - Global app settings
 * @returns {string} The computed litigation stage
 */
export const calculateLitigationStage = (caseData, settings = {}) => {
  const fileLocation = getFileLocation(caseData);
  const decision = getCaseDecision(caseData);
  const judgment = getFieldVal(caseData, JUDGMENT_KEYS);
  const isFinalJudgment = getFieldVal(caseData, IS_FINAL_KEYS);
  
  // Also check sessions for recent decisions/judgments
  let hasSessionJudgment = false;
  let latestSessionDecision = '';
  const role = getCaseRole(caseData);
  
  const isAppellant = isAppellantRole(role, settings);
  const isAppellee = isAppelleeRole(role, settings);

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
