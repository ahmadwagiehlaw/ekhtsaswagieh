import React, { useState } from 'react';
import { X, FileText, File, Search, ChevronRight, Star, Folder, ClipboardList } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useAppContext } from '../context/AppState';
import CertificatePrintView from './CertificatePrintView';

export default function GlobalTemplatePrintModal({ cases, sessionDate, onClose }) {
  const { settings, saveSettingsToFirebase, globalTasks, PREDEFINED_TASKS } = useAppContext();
  const templates = settings?.printTemplates || [];
  
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showPrintView, setShowPrintView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [repeatForDefendants, setRepeatForDefendants] = useState(true);
  const [taskFilter, setTaskFilter] = useState('');
  const { toast } = useUI();

  const filteredTemplates = templates.filter(t => t.name.includes(searchQuery));
  const sortedByUsage = [...templates].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  const topTemplates = sortedByUsage.filter(t => (t.usageCount || 0) > 0).slice(0, 3);

  // Group templates by category for better display
  const groupedTemplates = templates.reduce((acc, curr) => {
    const cat = curr.category || 'عام';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {});

  const handlePrint = (tpl) => {
    // Check if we need to filter by task
    let printCases = cases;
    if (taskFilter) {
      printCases = cases.filter(c => 
        globalTasks?.some(t => t.title === taskFilter && t.linkedCases?.includes(c.id) && t.status === 'pending')
      );
      if (printCases.length === 0) {
        return toast('عفواً، لا توجد ملفات ضمن التحديد تحتوي على هذه المهمة قيد التنفيذ', 'error');
      }
    }

    // Increment usage count
    const updatedTemplates = templates.map(t => 
      t.id === tpl.id ? { ...t, usageCount: (t.usageCount || 0) + 1 } : t
    );
    if (saveSettingsToFirebase) {
      saveSettingsToFirebase({ printTemplates: updatedTemplates });
    }
    setSelectedTemplate(tpl);
    setShowPrintView(printCases);
  };

  if (showPrintView && selectedTemplate) {
    return (
      <CertificatePrintView 
        cases={Array.isArray(showPrintView) ? showPrintView : cases} 
        sessionDate={sessionDate} 
        template={selectedTemplate} 
        onClose={onClose} 
        repeatForDefendants={repeatForDefendants}
      />
    );
  }

  // Determine what to show in body
  const isSearching = searchQuery.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
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
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition bg-white rounded-lg p-1 hover:bg-rose-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        {templates.length > 0 && (
          <div className="px-4 pt-4">
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="ابحث عن وثيقة..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value) setCurrentFolder(null); // Reset folder when searching
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-10 pl-4 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition"
              />
            </div>
            
            <label className="flex items-center gap-2 mt-3 cursor-pointer p-2 bg-indigo-50/50 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition">
              <input 
                type="checkbox" 
                checked={repeatForDefendants} 
                onChange={(e) => setRepeatForDefendants(e.target.checked)} 
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              />
              <span className="text-xs font-bold text-indigo-900">تكرار الوثيقة لكل مدعى عليه (في حال وجود أكثر من مدعى عليه بالملف)</span>
            </label>

            <div className="mt-3 p-3 bg-indigo-50/30 rounded-xl border border-indigo-100 flex items-center gap-3">
              <ClipboardList className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="flex-1">
                <select
                  value={taskFilter}
                  onChange={e => setTaskFilter(e.target.value)}
                  className="w-full bg-white border border-indigo-200 rounded-lg py-1.5 px-3 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">(طباعة لكافة الملفات المحددة)</option>
                  {PREDEFINED_TASKS?.map(t => (
                    <option key={t} value={t}>قصر الطباعة على الملفات التي تطلب مهمة: {t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-4 h-[400px] max-h-[60vh] overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center p-8 text-slate-400 h-full flex flex-col justify-center items-center">
              <File className="w-12 h-12 mb-2 opacity-20" />
              <p className="font-bold">لا توجد قوالب محفوظة</p>
              <p className="text-xs mt-1">قم بإنشاء قوالب من مركز الوثائق أولاً</p>
            </div>
          ) : isSearching ? (
            // Search Results View
            filteredTemplates.length === 0 ? (
              <div className="text-center p-8 text-slate-400 text-sm font-bold h-full flex items-center justify-center">لا توجد وثائق تطابق بحثك</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => handlePrint(tpl)}
                    className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md transition group"
                  >
                    <FileText className="w-10 h-10 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-black text-sm text-slate-700 group-hover:text-indigo-700 line-clamp-2">
                      {tpl.name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 mt-2 bg-slate-50 px-2 py-0.5 rounded-full">{tpl.category || 'عام'}</span>
                  </button>
                ))}
              </div>
            )
          ) : currentFolder ? (
            // Folder Contents View
            <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                <button 
                  onClick={() => setCurrentFolder(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-indigo-800">
                  <Folder className="w-5 h-5 fill-indigo-200 text-indigo-500" />
                  <h4 className="font-black text-sm">{currentFolder}</h4>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {groupedTemplates[currentFolder]?.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => handlePrint(tpl)}
                    className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md transition group"
                  >
                    <FileText className="w-10 h-10 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="font-black text-sm text-slate-700 group-hover:text-indigo-700 line-clamp-2">
                      {tpl.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Main Folders View
            <div className="space-y-6 animate-in fade-in duration-200">
              {topTemplates.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-amber-600 flex items-center gap-1 border-b border-amber-100 pb-1">
                    <Star className="w-3.5 h-3.5" /> الأسرع وصولاً (الأكثر استخداماً)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {topTemplates.map(tpl => (
                      <button
                        key={'top_'+tpl.id}
                        onClick={() => handlePrint(tpl)}
                        className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white hover:shadow-md hover:border-amber-400 transition group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-8 h-8 bg-amber-100 rounded-bl-full flex items-start justify-end p-1.5 opacity-50">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        </div>
                        <FileText className="w-10 h-10 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-black text-sm text-amber-950 group-hover:text-amber-700 line-clamp-2">
                          {tpl.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-500 flex items-center gap-1 border-b border-slate-100 pb-1">
                  المجلدات
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.keys(groupedTemplates).map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setCurrentFolder(cat)}
                      className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md transition group"
                    >
                      <div className="relative mb-2">
                        <Folder className="w-12 h-12 text-indigo-400 fill-indigo-100 group-hover:scale-110 transition-transform" />
                        <div className="absolute -bottom-1 -right-1 bg-white border border-slate-200 text-xs font-black text-slate-600 rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                          {groupedTemplates[cat].length}
                        </div>
                      </div>
                      <h4 className="font-black text-sm text-slate-700 group-hover:text-indigo-800">{cat}</h4>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
