import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Plus, Trash2, Search, Folder, FolderOpen, ArrowRight, AlertTriangle, Edit2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useUI } from '../context/UIContext';

export default function JudgmentRulesSection({
  localJudgmentDefaults,
  setLocalJudgmentDefaults,
  localRoles,
  localJudgmentCategories,
  localJudgmentClassifications,
  localJudgmentTypes,
  localSessionTypes,
  localDecisions
}) {
  const { showPrompt } = useUI();
  const [activeFolder, setActiveFolder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRules, setExpandedRules] = useState([]);

  // Migrate old rules
  useEffect(() => {
    let migrated = false;
    const newRules = localJudgmentDefaults.map(rule => {
      if (rule.folder === undefined) {
        migrated = true;
        return { ...rule, folder: rule.conditions?.type ? `قواعد: ${rule.conditions.type.trim()}` : 'قواعد عامة' };
      }
      return rule;
    });
    if (migrated) {
      setLocalJudgmentDefaults(newRules);
    }
  }, [localJudgmentDefaults, setLocalJudgmentDefaults]);

  // Duplicate detection
  const duplicates = new Set();
  const seen = new Map();
  localJudgmentDefaults.forEach((rule, idx) => {
    if (!rule.conditions) return;
    const key = [
      rule.conditions.role || '',
      rule.conditions.category || '',
      rule.conditions.classification || '',
      rule.conditions.type || '',
      rule.conditions.sessionType || '',
      rule.conditions.decision || ''
    ].join('||');
    
    // Ignore empty rules
    if (key === '||||||||||') return;

    if (seen.has(key)) {
      duplicates.add(idx);
      duplicates.add(seen.get(key));
    } else {
      seen.set(key, idx);
    }
  });

  const allFolders = [...new Set(localJudgmentDefaults.map(r => r.folder || 'قواعد عامة'))];

  const handleGenerateDefaults = () => {
    const confirmLoad = window.confirm('هل أنت متأكد من تحميل القواعد الافتراضية الذكية؟ سيتم إضافتها في مجلدات مخصصة.');
    if (confirmLoad) {
      const defaults = [
        { name: 'استنتاج ذكي: قبول/إلغاء للطاعن', folder: 'قواعد: قبول', conditions: { role: 'طاعن', type: 'قبول' }, actions: { classification: 'صالح' } },
        { name: 'استنتاج ذكي: قبول/إلغاء للطاعن', folder: 'قواعد: إلغاء', conditions: { role: 'طاعن', type: 'إلغاء' }, actions: { classification: 'صالح' } },
        { name: 'استنتاج ذكي: قبول/إلغاء للمطعون ضده', folder: 'قواعد: قبول', conditions: { role: 'مطعون ضده', type: 'قبول' }, actions: { classification: 'ضد' } },
        { name: 'استنتاج ذكي: قبول/إلغاء للمطعون ضده', folder: 'قواعد: إلغاء', conditions: { role: 'مطعون ضده', type: 'إلغاء' }, actions: { classification: 'ضد' } },
        
        { name: 'استنتاج ذكي: رفض/عدم قبول للطاعن', folder: 'قواعد: رفض', conditions: { role: 'طاعن', type: 'رفض' }, actions: { classification: 'ضد' } },
        { name: 'استنتاج ذكي: رفض/عدم قبول للطاعن', folder: 'قواعد: عدم قبول', conditions: { role: 'طاعن', type: 'عدم قبول' }, actions: { classification: 'ضد' } },
        { name: 'استنتاج ذكي: رفض/عدم قبول للمطعون ضده', folder: 'قواعد: رفض', conditions: { role: 'مطعون ضده', type: 'رفض' }, actions: { classification: 'صالح' } },
        { name: 'استنتاج ذكي: رفض/عدم قبول للمطعون ضده', folder: 'قواعد: عدم قبول', conditions: { role: 'مطعون ضده', type: 'عدم قبول' }, actions: { classification: 'صالح' } },
        
        { name: 'استنتاج ذكي: سقوط/شطب للطاعن', folder: 'قواعد: سقوط الخصومة', conditions: { role: 'طاعن', type: 'سقوط الخصومة' }, actions: { classification: 'ضد' } },
        { name: 'استنتاج ذكي: سقوط/شطب للطاعن', folder: 'قواعد: شطب', conditions: { role: 'طاعن', type: 'شطب' }, actions: { classification: 'ضد' } },
        { name: 'استنتاج ذكي: سقوط/شطب للمطعون ضده', folder: 'قواعد: سقوط الخصومة', conditions: { role: 'مطعون ضده', type: 'سقوط الخصومة' }, actions: { classification: 'صالح' } },
        { name: 'استنتاج ذكي: سقوط/شطب للمطعون ضده', folder: 'قواعد: شطب', conditions: { role: 'مطعون ضده', type: 'شطب' }, actions: { classification: 'صالح' } },
        
        { name: 'استنتاج ذكي: اعتبار للطاعن (خطر)', folder: 'قواعد: اعتبار الدعوى كأن لم تكن', conditions: { role: 'طاعن', type: 'اعتبار الدعوى كأن لم تكن' }, actions: { classification: 'ضد' } },
        { name: 'استنتاج ذكي: اعتبار للمطعون ضده', folder: 'قواعد: اعتبار الدعوى كأن لم تكن', conditions: { role: 'مطعون ضده', type: 'اعتبار الدعوى كأن لم تكن' }, actions: { classification: 'صالح' } },
        
        { name: 'استنتاج ذكي: وقف جزائي للطاعن (خطر)', folder: 'قواعد: وقف جزائي', conditions: { role: 'طاعن', type: 'وقف جزائي' }, actions: { classification: 'إجرائي' } },
        { name: 'استنتاج ذكي: وقف جزائي للمطعون ضده', folder: 'قواعد: وقف جزائي', conditions: { role: 'مطعون ضده', type: 'وقف جزائي' }, actions: { classification: 'إجرائي' } },
      ];
      setLocalJudgmentDefaults([...localJudgmentDefaults, ...defaults]);
    }
  };

    const moveFolder = (folderName, direction) => {
    const groups = {};
    localJudgmentDefaults.forEach(r => {
      const f = r.folder || 'قواعد عامة';
      if (!groups[f]) groups[f] = [];
      groups[f].push(r);
    });

    const currentFolders = [...new Set(localJudgmentDefaults.map(r => r.folder || 'قواعد عامة'))];
    const idx = currentFolders.indexOf(folderName);
    
    if (direction === -1 && idx > 0) {
      const temp = currentFolders[idx - 1];
      currentFolders[idx - 1] = folderName;
      currentFolders[idx] = temp;
    } else if (direction === 1 && idx < currentFolders.length - 1) {
      const temp = currentFolders[idx + 1];
      currentFolders[idx + 1] = folderName;
      currentFolders[idx] = temp;
    } else {
      return;
    }

    const newRules = [];
    currentFolders.forEach(f => {
      if (groups[f]) newRules.push(...groups[f]);
    });
    setLocalJudgmentDefaults(newRules);
  };

  const handleEditFolder = async (oldName) => {
    const newName = await showPrompt('تعديل اسم المجلد', 'أدخل الاسم الجديد للمجلد:', oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;
    
    const newRules = localJudgmentDefaults.map(r => {
      if ((r.folder || 'قواعد عامة') === oldName) {
        return { ...r, folder: newName.trim() };
      }
      return r;
    });
    setLocalJudgmentDefaults(newRules);
  };

  const handleDeleteFolder = (folderName) => {
    const confirm = window.confirm(`هل أنت متأكد من حذف المجلد "${folderName}" وجميع القواعد بداخله؟`);
    if (!confirm) return;
    const newRules = localJudgmentDefaults.filter(r => (r.folder || 'قواعد عامة') !== folderName);
    setLocalJudgmentDefaults(newRules);
  };

  const handleAddRule = async () => {
    let folder = activeFolder;
    if (!folder) {
      folder = await showPrompt('اسم المجلد', 'أدخل اسم المجلد الجديد أو الحالي:') || 'قواعد عامة';
      setActiveFolder(folder);
    }
    setLocalJudgmentDefaults([...localJudgmentDefaults, { name: '', folder, conditions: { role: '', category: '', classification: '', type: '', sessionType: '', decision: '' }, actions: { category: '', classification: '', type: '', text: '' } }]);
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-black text-sm text-navy-900">قواعد التعبئة التلقائية للأحكام</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1">
              إدارة قواعد استنتاج تصنيف الأحكام والمنطوق آلياً بناءً على شروط متعددة.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleGenerateDefaults}
            className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
          >
            <Plus className="w-4 h-4" /> توليد القواعد الافتراضية
          </button>
          <button
            onClick={handleAddRule}
            className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-indigo-100 transition"
          >
            <Plus className="w-4 h-4" /> إضافة قاعدة
          </button>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 min-h-[400px]">
        {activeFolder ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => setActiveFolder(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition">
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2 text-indigo-600">
                  <FolderOpen className="w-6 h-6 fill-indigo-100" />
                  <h4 className="font-black text-sm">{activeFolder}</h4>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="بحث داخل المجلد..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-64 text-xs font-bold pl-3 pr-9 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {localJudgmentDefaults.map((rule, idx) => {
                if ((rule.folder || 'قواعد عامة') !== activeFolder) return null;
                
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  const match = (rule.name || '').toLowerCase().includes(q) ||
                    (rule.conditions?.type || '').toLowerCase().includes(q) ||
                    (rule.conditions?.role || '').toLowerCase().includes(q);
                  if (!match) return null;
                }

                const isExpanded = expandedRules.includes(idx);
                const isDuplicated = duplicates.has(idx);

                return (
                  <div key={idx} className={`bg-white rounded-xl border ${isDuplicated ? 'border-rose-300 shadow-rose-100' : 'border-slate-200'} overflow-hidden shadow-sm transition-all`}>
                    <div 
                      onClick={() => setExpandedRules(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])}
                      className={`flex items-center justify-between p-3 cursor-pointer select-none ${isDuplicated ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isDuplicated && <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />}
                        <div className={`w-6 h-6 rounded-md ${isDuplicated ? 'bg-rose-200 text-rose-700' : 'bg-slate-100 text-slate-600'} flex items-center justify-center font-black text-[11px] shrink-0`}>
                          {idx + 1}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h5 className={`font-bold text-xs truncate ${isDuplicated ? 'text-rose-700' : 'text-navy-900'}`}>
                            {rule.name || 'قاعدة بدون اسم'}
                          </h5>
                          {isDuplicated && <span className="text-[9px] font-bold text-rose-500">⚠️ تنبيه: توجد قاعدة أخرى بنفس الشروط تماماً! يرجى التعديل لتجنب التعارض.</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 mr-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const confirm = window.confirm('هل أنت متأكد من الحذف؟');
                            if (confirm) setLocalJudgmentDefaults(localJudgmentDefaults.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-400 hover:text-rose-500 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="text-slate-400 text-[10px]">{isExpanded ? '▼' : '◀'}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white border-t border-slate-100">
                        {/* Meta */}
                        <div className="md:col-span-2 flex gap-4">
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-slate-700 block mb-1">اسم القاعدة</label>
                            <input
                              type="text"
                              value={rule.name}
                              onChange={(e) => {
                                const newRules = [...localJudgmentDefaults];
                                newRules[idx].name = e.target.value;
                                setLocalJudgmentDefaults(newRules);
                              }}
                              className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-slate-700 block mb-1">مجلد القاعدة (للتنظيم)</label>
                            <input
                              list="folders-list"
                              value={rule.folder || 'قواعد عامة'}
                              onChange={(e) => {
                                const newRules = [...localJudgmentDefaults];
                                newRules[idx].folder = e.target.value;
                                setLocalJudgmentDefaults(newRules);
                              }}
                              className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                            />
                            <datalist id="folders-list">
                              {allFolders.map(f => <option key={f} value={f} />)}
                            </datalist>
                          </div>
                        </div>

                        {/* Conditions */}
                        <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <p className="text-xs font-black text-indigo-700 mb-3 border-b border-indigo-100 pb-2">شروط التطبيق (متى تُطبق القاعدة؟)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">الصفة</label>
                              <select
                                value={rule.conditions?.role || ''}
                                onChange={(e) => {
                                  const newRules = [...localJudgmentDefaults];
                                  if (!newRules[idx].conditions) newRules[idx].conditions = {};
                                  newRules[idx].conditions.role = e.target.value;
                                  setLocalJudgmentDefaults(newRules);
                                }}
                                className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200"
                              >
                                <option value="">- أي صفة -</option>
                                {localRoles.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">نوع الحكم</label>
                              <select
                                value={rule.conditions?.type || ''}
                                onChange={(e) => {
                                  const newRules = [...localJudgmentDefaults];
                                  if (!newRules[idx].conditions) newRules[idx].conditions = {};
                                  newRules[idx].conditions.type = e.target.value;
                                  setLocalJudgmentDefaults(newRules);
                                }}
                                className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200"
                              >
                                <option value="">- أي نوع حكم -</option>
                                {localJudgmentTypes.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">القرار (الجلسة)</label>
                              <select
                                value={rule.conditions?.decision || ''}
                                onChange={(e) => {
                                  const newRules = [...localJudgmentDefaults];
                                  if (!newRules[idx].conditions) newRules[idx].conditions = {};
                                  newRules[idx].conditions.decision = e.target.value;
                                  setLocalJudgmentDefaults(newRules);
                                }}
                                className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200"
                              >
                                <option value="">- أي قرار -</option>
                                {localDecisions.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">فئة الحكم</label>
                              <select
                                value={rule.conditions?.category || ''}
                                onChange={(e) => {
                                  const newRules = [...localJudgmentDefaults];
                                  if (!newRules[idx].conditions) newRules[idx].conditions = {};
                                  newRules[idx].conditions.category = e.target.value;
                                  setLocalJudgmentDefaults(newRules);
                                }}
                                className="w-full text-[10px] font-bold p-1.5 rounded-md border border-slate-200"
                              >
                                <option value="">- أي فئة -</option>
                                {localJudgmentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                          <p className="text-xs font-black text-emerald-700 mb-3 border-b border-emerald-100 pb-2">تعبئة البيانات تلقائياً بـ:</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">فئة الحكم (الجديدة)</label>
                              <select
                                value={rule.actions?.category || ''}
                                onChange={(e) => {
                                  const newRules = [...localJudgmentDefaults];
                                  if (!newRules[idx].actions) newRules[idx].actions = {};
                                  newRules[idx].actions.category = e.target.value;
                                  setLocalJudgmentDefaults(newRules);
                                }}
                                className="w-full text-[10px] font-bold p-1.5 rounded-md border border-emerald-200"
                              >
                                <option value="">-- بدون تغيير --</option>
                                {localJudgmentCategories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">التصنيف</label>
                              <select
                                value={rule.actions?.classification || ''}
                                onChange={(e) => {
                                  const newRules = [...localJudgmentDefaults];
                                  if (!newRules[idx].actions) newRules[idx].actions = {};
                                  newRules[idx].actions.classification = e.target.value;
                                  setLocalJudgmentDefaults(newRules);
                                }}
                                className="w-full text-[10px] font-bold p-1.5 rounded-md border border-emerald-200"
                              >
                                <option value="">-- بدون تغيير --</option>
                                {localJudgmentClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">المنطوق الآلي</label>
                              <textarea
                                value={rule.actions?.text || ''}
                                onChange={(e) => {
                                  const newRules = [...localJudgmentDefaults];
                                  if (!newRules[idx].actions) newRules[idx].actions = {};
                                  newRules[idx].actions.text = e.target.value;
                                  setLocalJudgmentDefaults(newRules);
                                }}
                                className="w-full text-[10px] font-bold p-2 rounded-md border border-emerald-200 min-h-[50px] resize-y"
                                placeholder="منطوق الحكم الافتراضي لهذه القاعدة..."
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xs font-black text-slate-600">المجلدات ({allFolders.length})</h4>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="بحث في المجلدات والقواعد..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-64 text-xs font-bold pl-3 pr-9 py-2 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none bg-white shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {allFolders
                .filter(folder => !searchQuery || folder.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(folder => {
                const rulesCount = localJudgmentDefaults.filter(r => (r.folder || 'قواعد عامة') === folder).length;
                const folderHasDuplicates = localJudgmentDefaults.some((r, i) => (r.folder || 'قواعد عامة') === folder && duplicates.has(i));

                return (
                  <div
                    key={folder}
                    className={`relative bg-white p-4 pb-12 rounded-2xl border ${folderHasDuplicates ? 'border-rose-300 shadow-rose-100 hover:border-rose-400' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'} shadow-sm transition-all flex flex-col items-center justify-center gap-3 text-center group`}
                  >
                    <div 
                      className="cursor-pointer flex flex-col items-center gap-3 w-full"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveFolder(folder);
                      }}
                    >
                      <div className="relative">
                        <Folder className={`w-12 h-12 ${folderHasDuplicates ? 'fill-rose-100 text-rose-500' : 'fill-indigo-50 text-indigo-400 group-hover:text-indigo-500 group-hover:fill-indigo-100'} transition-colors`} />
                        {folderHasDuplicates && (
                          <div className="absolute -top-1 -right-1 bg-white rounded-full">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h5 className={`font-black text-xs ${folderHasDuplicates ? 'text-rose-700' : 'text-navy-900'} line-clamp-2`}>{folder}</h5>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 block">{rulesCount} قاعدة</span>
                      </div>
                    </div>
                    
                    {/* Action Bar (always visible at bottom but subtle) */}
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); moveFolder(folder, -1); }} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition" title="تحريك لليمين">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleEditFolder(folder); }} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition" title="تغيير الاسم">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }} className="p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition" title="حذف المجلد">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveFolder(folder, 1); }} className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition" title="تحريك لليسار">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
