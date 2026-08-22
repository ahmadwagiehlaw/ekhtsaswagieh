import { useMemo } from 'react';
import { getSafeDateObj } from '../utils/dateUtils';
import { getCaseNo, getCaseYear, getSessionDate, getAppellantName, getCaseRoll } from '../utils/caseUtils';

const getPrimaryValue = (cObj, possibleKeys) => {
  for (let k of possibleKeys) {
    if (cObj[k] !== undefined && cObj[k] !== null) return cObj[k];
  }
  return '';
};

export default function useCasesSort({ filteredCases, sortBy, quickDateFilter }) {
  
  const sortedCases = useMemo(() => {
    let result = [...filteredCases];

    const getSessionRollNumber = (c) => {
      const rollStr = getCaseRoll(c);
      const parsed = parseInt(String(rollStr).replace(/[^\d]/g, ''), 10);
      return isNaN(parsed) ? 999999 : parsed;
    };

    if (quickDateFilter) {
      result.sort((a, b) => getSessionRollNumber(a) - getSessionRollNumber(b));
    }

    if (sortBy === 'none') return result;

    const getCaseNumberParsed = (c) => {
      const numStr = getCaseNo(c) || c.id || '';
      const parsed = parseInt(String(numStr).replace(/[^\d]/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    const getCaseYearParsed = (c) => {
      const yrStr = getCaseYear(c);
      const parsed = parseInt(String(yrStr).replace(/[^\d]/g, ''), 10);
      return isNaN(parsed) ? 0 : parsed;
    };

    const getSessionDateObj = (c) => {
      const dStr = getSessionDate(c);
      if (!dStr) return null;
      return getSafeDateObj(dStr);
    };

    result.sort((a, b) => {
      if (sortBy === 'appellant_asc') {
        const valA = getAppellantName(a);
        const valB = getAppellantName(b);
        return valA.localeCompare(valB, 'ar');
      }
      if (sortBy === 'appellant_desc') {
        const valA = getAppellantName(a);
        const valB = getAppellantName(b);
        return valB.localeCompare(valA, 'ar');
      }
      if (sortBy === 'number_asc') {
        return getCaseNumberParsed(a) - getCaseNumberParsed(b);
      }
      if (sortBy === 'number_desc') {
        return getCaseNumberParsed(b) - getCaseNumberParsed(a);
      }
      if (sortBy === 'year_desc') {
        return getCaseYearParsed(b) - getCaseYearParsed(a);
      }
      if (sortBy === 'year_asc') {
        return getCaseYearParsed(a) - getCaseYearParsed(b);
      }
      if (sortBy === 'date_desc') {
        const dA = getSessionDateObj(a);
        const dB = getSessionDateObj(b);
        if (!dA && !dB) return 0;
        if (!dA) return 1;
        if (!dB) return -1;
        const diff = dB.getTime() - dA.getTime();
        if (diff === 0) return getSessionRollNumber(a) - getSessionRollNumber(b);
        return diff;
      }
      if (sortBy === 'date_asc') {
        const dA = getSessionDateObj(a);
        const dB = getSessionDateObj(b);
        if (!dA && !dB) return 0;
        if (!dA) return 1;
        if (!dB) return -1;
        const diff = dA.getTime() - dB.getTime();
        if (diff === 0) return getSessionRollNumber(a) - getSessionRollNumber(b);
        return diff;
      }
      return 0;
    });

    return result;
  }, [filteredCases, sortBy, quickDateFilter]);

  return { sortedCases };
}
