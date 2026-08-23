import { getPrimaryValue } from './helpers';
import { 
  CASE_NO_KEYS, 
  YEAR_KEYS, 
  APPELLANT_KEYS, 
  APPELLEE_KEYS,
  SESSION_DATE_KEYS,
  DECISION_KEYS,
  LOCATION_KEYS,
  ROLE_KEYS
} from '../constants/caseFields';

/**
 * Standardizes case fields to their canonical names and converts legacy string arrays to objects/arrays.
 * @param {Array} cases 
 * @returns {Array} Updated cases
 */
export const migrateCasesSchema = (cases) => {
  return cases.map(c => {
    let updated = { ...c };
    
    // 1. Normalize Case No
    const caseNo = getPrimaryValue(updated, CASE_NO_KEYS);
    if (caseNo !== '') {
      updated['رقم الدعوى'] = caseNo;
      CASE_NO_KEYS.forEach(k => { if (k !== 'رقم الدعوى') delete updated[k]; });
    }

    // 2. Normalize Year
    const year = getPrimaryValue(updated, YEAR_KEYS);
    if (year !== '') {
      updated['السنة'] = year;
      YEAR_KEYS.forEach(k => { if (k !== 'السنة') delete updated[k]; });
    }

    // 3. Normalize Appellant
    const appellant = getPrimaryValue(updated, APPELLANT_KEYS);
    if (appellant !== '') {
      updated['الطاعن'] = appellant;
      APPELLANT_KEYS.forEach(k => { if (k !== 'الطاعن') delete updated[k]; });
    }

    // 4. Normalize Appellee
    const appellee = getPrimaryValue(updated, APPELLEE_KEYS);
    if (appellee !== '') {
      updated['المطعون ضده'] = appellee;
      APPELLEE_KEYS.forEach(k => { if (k !== 'المطعون ضده') delete updated[k]; });
    }

    // 5. Normalize Session Date
    const sessionDate = getPrimaryValue(updated, SESSION_DATE_KEYS);
    if (sessionDate !== '') {
      updated['آخر جلسة'] = sessionDate;
      SESSION_DATE_KEYS.forEach(k => { if (k !== 'آخر جلسة') delete updated[k]; });
    }

    // 6. Normalize Decision
    const decision = getPrimaryValue(updated, DECISION_KEYS);
    if (decision !== '') {
      updated['القرار'] = decision;
      DECISION_KEYS.forEach(k => { if (k !== 'القرار') delete updated[k]; });
    }

    // 7. Normalize Location
    const location = getPrimaryValue(updated, LOCATION_KEYS);
    if (location !== '') {
      updated['مكان الملف'] = location;
      LOCATION_KEYS.forEach(k => { if (k !== 'مكان الملف') delete updated[k]; });
    }

    // 8. Normalize Role
    const role = getPrimaryValue(updated, ROLE_KEYS);
    if (role !== '') {
      updated['الصفة'] = role;
      ROLE_KEYS.forEach(k => { if (k !== 'الصفة') delete updated[k]; });
    }
    
    // 9. DefendantsList / PlaintiffsList Arrays
    if (!updated.defendantsList || !Array.isArray(updated.defendantsList)) {
       updated.defendantsList = appellee ? [appellee] : [];
    }
    if (!updated.plaintiffsList || !Array.isArray(updated.plaintiffsList)) {
       updated.plaintiffsList = appellant ? [appellant] : [];
    }

    // 10. Paper files migration
    if (updated.paperFileContents && Array.isArray(updated.paperFileContents)) {
      updated.paperFileContents = updated.paperFileContents.map((file, idx) => {
        if (typeof file === 'string') {
          return {
            id: `legacy_${Date.now()}_${idx}`,
            name: file,
            addedAt: new Date().toISOString(),
            addedBy: 'النظام القديم',
            notes: ''
          };
        }
        return file;
      });
    }

    return updated;
  });
};
