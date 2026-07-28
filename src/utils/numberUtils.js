/**
 * Converts English numerals to Arabic numerals or vice versa based on preference
 * @param {string|number} number - The number to convert
 * @param {string} format - 'ar' for Arabic (١٢٣), 'en' for English (123)
 * @returns {string} The localized number string
 */
export const localizeNumber = (number, format = 'en') => {
  if (number === null || number === undefined) return '';
  const str = number.toString();
  
  if (format === 'ar') {
    return str.replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x0660 - 0x0030));
  }
  
  // Convert from Arabic back to English if needed (fallback)
  if (format === 'en') {
    return str.replace(/[٠-٩]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x0660 + 0x0030));
  }
  
  return str;
};
