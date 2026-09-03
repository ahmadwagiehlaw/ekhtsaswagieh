import React, { useState, useEffect } from 'react';

export default function SmartDateInput({ value, onChange, className, id, placeholder = "يوم/شهر/سنة أو يوم/شهر", ...props }) {
  const [displayValue, setDisplayValue] = useState(value || '');

  useEffect(() => {
    if (value && value !== displayValue) {
      // value is expected to be YYYY-MM-DD
      const parts = value.split('-');
      if (parts.length === 3) {
        setDisplayValue(`${parts[2]}/${parts[1]}/${parts[0]}`); // DD/MM/YYYY
      } else {
        setDisplayValue(value);
      }
    } else if (!value) {
      setDisplayValue('');
    }
  }, [value]);

  const triggerChange = (valStr) => {
    onChange({ target: { value: valStr } });
  };

  const handleBlur = () => {
    let val = displayValue.trim();
    if (!val) {
      triggerChange('');
      return;
    }

    // Replace - or . with /
    val = val.replace(/[-.]/g, '/');

    const parts = val.split('/');
    let day = '', month = '', year = '';

    const currentYear = new Date().getFullYear();

    if (parts.length === 2) {
      // Assume DD/MM, auto append current year
      day = parts[0];
      month = parts[1];
      year = currentYear.toString();
    } else if (parts.length === 3) {
      day = parts[0];
      month = parts[1];
      year = parts[2];
      if (year.length === 2) {
        year = `20${year}`;
      }
    } else {
      // If they typed something like 1507 without slashes
      if (val.length === 4) {
        day = val.slice(0, 2);
        month = val.slice(2, 4);
        year = currentYear.toString();
      } else if (val.length === 6) {
        day = val.slice(0, 2);
        month = val.slice(2, 4);
        year = `20${val.slice(4, 6)}`;
      } else if (val.length === 8) {
        day = val.slice(0, 2);
        month = val.slice(2, 4);
        year = val.slice(4, 8);
      } else {
        // return as is if can't parse
        triggerChange(val);
        setDisplayValue(val);
        return;
      }
    }

    // Pad day and month
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    const finalFormatted = `${year}-${month}-${day}`;
    // Check if valid date
    const dateObj = new Date(finalFormatted);
    if (!isNaN(dateObj.getTime())) {
      triggerChange(finalFormatted);
      setDisplayValue(`${day}/${month}/${year}`);
    } else {
      triggerChange(val);
      setDisplayValue(val);
    }
  };

  return (
    <input
      {...props}
      type="text"
      id={id}
      value={displayValue}
      onChange={(e) => setDisplayValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlur();
        }
      }}
      onFocus={(e) => e.target.select()}
      placeholder={placeholder}
      className={className || "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"}
      dir="ltr"
    />
  );
}
