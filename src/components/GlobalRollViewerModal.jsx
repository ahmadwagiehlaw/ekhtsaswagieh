import React, { useState, useEffect } from 'react';
import { BookOpen, X, Download, FileText, ChevronRight, ChevronLeft, RotateCw } from 'lucide-react';
import { useAppContext } from '../context/AppState';

export default function GlobalRollViewerModal({ isOpen, onClose, initialDate }) {
  const { rolls } = useAppContext();
  
  // Find rolls matching the date
  const matchingRolls = rolls.filter(r => r.date === initialDate);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
    setRotation(0);
  }, [initialDate, isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    setActiveIndex(prev => (prev + 1) % matchingRolls.length);
  };

  const handlePrev = () => {
    setActiveIndex(prev => (prev - 1 + matchingRolls.length) % matchingRolls.length);
  };

  return (
    <div className="fixed inset-0 bg-navy-900/95 backdrop-blur-md z-[300] flex flex-col p-2 sm:p-4 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="bg-white rounded-t-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between p-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-4 mb-3 sm:mb-0">
          <div className="font-black text-navy-900 text-sm md:text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            رول الجلسة - {initialDate}
          </div>
          <button onClick={onClose} className="sm:hidden p-2 bg-slate-100 rounded-full hover:bg-rose-100 hover:text-rose-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {matchingRolls.length > 0 && (
          <div className="flex items-center justify-between gap-3 bg-slate-50 p-1.5 rounded-xl">
            {matchingRolls.length > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={handlePrev} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-indigo-50 text-slate-600 transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-navy-900 min-w-[80px] text-center">
                  {matchingRolls[activeIndex].type}
                </span>
                <button onClick={handleNext} className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-indigo-50 text-slate-600 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            )}
            {matchingRolls.length === 1 && (
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                {matchingRolls[0].type}
              </span>
            )}

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setRotation(r => r + 90)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                title="تدوير الملف"
              >
                <RotateCw className="w-3.5 h-3.5" /> تدوير
              </button>
              <a 
                href={matchingRolls[activeIndex].url} 
                target="_blank" 
                rel="noreferrer"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" /> تحميل
              </a>
              <button onClick={onClose} className="hidden sm:flex p-1.5 bg-slate-200 rounded-lg hover:bg-rose-500 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {matchingRolls.length === 0 && (
           <button onClick={onClose} className="hidden sm:flex p-1.5 bg-slate-200 rounded-lg hover:bg-rose-500 hover:text-white transition">
             <X className="w-4 h-4" />
           </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-slate-100 rounded-b-2xl overflow-hidden flex flex-col items-center justify-center p-2">
        {matchingRolls.length > 0 ? (
          <div className="w-full h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative flex items-center justify-center">
            <div 
              style={{ 
                transform: `rotate(${rotation}deg)`, 
                width: rotation % 180 !== 0 ? '100vh' : '100%', 
                height: rotation % 180 !== 0 ? '100vw' : '100%',
                transition: 'transform 0.3s ease-in-out'
              }} 
              className="absolute flex items-center justify-center"
            >
              {matchingRolls[activeIndex].url.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(matchingRolls[activeIndex].url)}&embedded=true`} 
                  className="w-full h-full border-0 absolute inset-0"
                  title="PDF Viewer"
                />
              ) : (
                <div className="w-full h-full absolute inset-0 flex items-center justify-center p-4 overflow-auto bg-slate-100/50">
                   <img src={matchingRolls[activeIndex].url} alt="Roll" className="max-w-full max-h-full object-contain rounded-xl shadow-sm" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-sm">
            <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-black text-navy-900 mb-2">لا يوجد رول</h3>
            <p className="text-sm text-slate-500 font-bold mb-6">
              لم يتم العثور على رول محفوظ لتاريخ هذه الجلسة ({initialDate}).
            </p>
            <button 
              onClick={onClose}
              className="bg-navy-900 hover:bg-navy-800 text-white px-6 py-2.5 rounded-xl font-bold transition w-full shadow-md"
            >
              إغلاق
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
