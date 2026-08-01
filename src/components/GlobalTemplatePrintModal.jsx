import React, { useState } from 'react';
import { X, FileText, File } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import CertificatePrintView from './CertificatePrintView';

export default function GlobalTemplatePrintModal({ cases, sessionDate, onClose }) {
  const { settings } = useAppContext();
  const templates = settings?.printTemplates || [];
  
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showPrintView, setShowPrintView] = useState(false);

  // Group templates by category for better display
  const groupedTemplates = templates.reduce((acc, curr) => {
    const cat = curr.category || 'عام';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {});

  const handlePrint = (tpl) => {
    setSelectedTemplate(tpl);
    setShowPrintView(true);
  };

  if (showPrintView && selectedTemplate) {
    return (
      <CertificatePrintView 
        cases={cases} 
        sessionDate={sessionDate} 
        template={selectedTemplate} 
        onClose={onClose} 
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-800">توليد وثيقة مجمعة</h3>
              <p className="text-[10px] font-bold text-slate-500">تم تحديد ({cases.length}) دعوى للطباعة</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center p-8 text-slate-400">
              <File className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p className="font-bold">لا توجد قوالب محفوظة</p>
              <p className="text-xs mt-1">قم بإنشاء قوالب من مركز الوثائق أولاً</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.keys(groupedTemplates).map(cat => (
                <div key={cat} className="space-y-2">
                  <h4 className="text-xs font-black text-indigo-800 border-b border-indigo-100 pb-1">{cat}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {groupedTemplates[cat].map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => handlePrint(tpl)}
                        className="flex flex-col text-right items-start p-3 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 transition group"
                      >
                        <span className="font-black text-sm text-slate-700 group-hover:text-indigo-700 truncate w-full">
                          {tpl.name}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 mt-1">توليد الآن ←</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
