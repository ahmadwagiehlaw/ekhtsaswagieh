import { format, parseISO, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * Checks if a value is likely an Excel serial date number.
 * Excel stores dates as sequential serial numbers. 
 * E.g., Jan 1 1900 is 1. Jan 1 2024 is ~45292.
 */
const isExcelSerialDate = (value) => {
  if (value === null || value === undefined || value === '') return false;
  // If it's already a valid ISO date string, it's not a bare excel serial
  if (typeof value === 'string' && value.includes('-')) return false;
  
  const num = Number(value);
  // Valid modern dates in Excel usually fall between 30000 (1982) and 60000 (2064)
  return !isNaN(num) && num > 30000 && num < 70000;
};

/**
 * Converts an Excel serial date to a JS Date object.
 */
const excelToDate = (serial) => {
  // Excel epoch is Jan 1, 1900, but it incorrectly assumes 1900 is a leap year (bug).
  // So we subtract 25569 days (difference between 1900 and 1970) and multiply by ms/day.
  // We use UTC to avoid local timezone offset issues shifting the day.
  const unixTimestamp = (serial - 25569) * 86400 * 1000;
  return new Date(unixTimestamp);
};

/**
 * Safely parses and formats a date value from the database.
 * Handles normal date strings and Excel serial numbers.
 * @param {string|number} value - The date value to format
 * @param {string} formatStr - The date-fns format string (default: from settings or 'dd/MM/yyyy')
 * @returns {string} The formatted date string, or the original value if it can't be parsed.
 */
export const formatDateString = (value, formatStr) => {
  if (!value) return '';
  
  const activeFormat = formatStr || localStorage.getItem('dateFormat') || 'dd/MM/yyyy';

  try {
    let dateObj;

    if (isExcelSerialDate(value)) {
      dateObj = excelToDate(Number(value));
    } else {
      // Try parsing as ISO
      dateObj = new Date(value);
    }

    if (isValid(dateObj)) {
      return format(dateObj, activeFormat, { locale: ar });
    }
  } catch (e) {
    console.warn('Failed to format date:', value);
  }

  // Fallback to returning the original value
  return String(value);
};

/**
 * Extracts a standard Date object from any database date value.
 * Useful for sorting or comparisons.
 */
export const getSafeDateObj = (value) => {
  if (!value) return null;
  if (isExcelSerialDate(value)) {
    return excelToDate(Number(value));
  }
  const d = new Date(value);
  return isValid(d) ? d : null;
};
