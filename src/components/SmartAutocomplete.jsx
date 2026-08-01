import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getFieldVal } from '../utils/caseUtils';

export default function SmartAutocomplete({ 
  value, 
  onChange, 
  cases = [], 
  fieldPaths = [], 
  placeholder = '', 
  className = '',
  id = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);

  // Extract unique historical values
  const suggestions = useMemo(() => {
    if (!cases || cases.length === 0 || !fieldPaths || fieldPaths.length === 0) return [];
    
    const uniqueValues = new Set();
    cases.forEach(c => {
      // For basic case fields
      fieldPaths.forEach(path => {
         const val = getFieldVal(c, [path]);
         if (val && typeof val === 'string' && val.trim() !== '') {
            uniqueValues.add(val.trim());
         }
      });
      // Also look inside sessions for fields like type or decision
      if (c.sessions && Array.isArray(c.sessions)) {
         c.sessions.forEach(s => {
            fieldPaths.forEach(path => {
               const val = s[path];
               if (val && typeof val === 'string' && val.trim() !== '') {
                  uniqueValues.add(val.trim());
               }
            });
         });
      }
    });
    
    return Array.from(uniqueValues).sort();
  }, [cases, fieldPaths]);

  // Filter based on current input
  const filteredSuggestions = useMemo(() => {
    const query = (value || '').toLowerCase();
    if (!query) return suggestions.slice(0, 50); // Show max 50 recent/all if empty
    return suggestions
      .filter(s => s.toLowerCase().includes(query) && s !== value)
      .slice(0, 10); // Show top 10 matches
  }, [suggestions, value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        id={id}
        type="text"
        value={value || ''}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsFocused(true);
          if (filteredSuggestions.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          // Small delay to allow click on suggestion
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <ul className="py-1">
            {filteredSuggestions.map((suggestion, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent blur
                    onChange(suggestion);
                    setIsOpen(false);
                  }}
                  className="w-full text-right px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
