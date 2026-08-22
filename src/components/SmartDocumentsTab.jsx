import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Trash2, Edit3, Copy, FileText, Search, Settings, Variable, ChevronDown, ChevronRight, ChevronLeft, Folder, FolderOpen, List, ListOrdered, Undo, Redo, Eraser, Eye, X, Printer } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';

export default function SmartDocumentsTab() {
  const { settings, saveSettingsToFirebase, isAdmin, cases } = useAppContext();
  const { toast, showConfirm } = useUI();
  const [showPreview, setShowPreview] = useState(false);
  
  const [templates, setTemplates] = useState(settings?.printTemplates || [
    {
      id: 'default_cert_1',
      name: 'شهادة من الجدول (الإدارية العليا)',
      category: 'شهادات',
      content: `<div class="w-full h-full text-right" dir="rtl" style="font-family: 'Cairo', sans-serif;">
  <div class="flex justify-between items-start mb-16 border-b-2 border-black pb-4">
    <div class="flex flex-col gap-2 font-bold text-lg w-[55%]">
       <div class="flex items-start"><span class="w-24 shrink-0">الطعن رقم:</span> <span>{{رقم_الدعوى}} لسنة {{السنة}} ق</span></div>
       <div class="flex items-start"><span class="w-24 shrink-0">المقامة من:</span> <span class="flex-1">{{المدعي}}</span></div>
       <div class="flex items-start"><span class="w-24 shrink-0">ضـــــــد:</span> <span class="flex-1">{{المدعى_عليه}}</span></div>
       <div class="flex items-start"><span class="w-24 shrink-0">جلــــسة:</span> <span>{{الجلسة_الحالية}}</span></div>
    </div>
    
    <div class="text-center font-black flex flex-col items-center w-[40%]">
      <h1 class="text-2xl mb-1 border-b border-black pb-1">هيئة قضايا الدولة</h1>
      <h2 class="text-xl">قسم الإدارية العليا (أ)</h2>
      <h2 class="text-xl">الدائرة العاشرة</h2>
      <h3 class="mt-2 text-lg">مستشار/ {{اسم_المستشار}}</h3>
    </div>
  </div>

  <h2 class="text-3xl font-black text-center mb-8">
    السيد الاستاذ/ أمين عام المحكمة الإدارية العليا
  </h2>
  <h3 class="text-2xl font-bold text-center mb-12">
    تحية طيبة وبعد ،،
  </h3>

  <div class="text-2xl font-bold leading-[2] mb-12 text-justify">
    <p>بخصوص الطعن الموضحة بياناته، نأمل من سيادتكم تيسير مأمورية مندوبنا/ ............................ في الحصول علي بيان بآخر ما تم في الطعن عاليه ..</p>
    <p>علما بأن آخر جلسة معلومة لدينا هي: {{الجلسة_الحالية}}</p>
    <p>وذلك مع اعتبار الأمر هام وعاجل .</p>
  </div>

  <h3 class="text-2xl font-bold text-center mb-24">
    وتفضلوا بقبول فائق الاحترام ،،،
  </h3>

  <div class="flex justify-between text-xl font-bold px-12 mb-16">
    <div></div>
    <div class="text-center">
      <p class="mb-12">العضو المختص</p>
      <p>مستشار/ {{اسم_المستشار}}</p>
    </div>
  </div>

  <div class="mt-auto pt-8 border-t-2 border-black">
    <h3 class="text-xl font-bold underline mb-4">الرد على المسطر بعالية:-</h3>
  </div>
</div>`
    }
  ]);

  const [activeTemplate, setActiveTemplate] = useState(templates[0] || null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ name: '', category: '' });
  const [activeFolder, setActiveFolder] = useState(null);
  const [showMoreVars, setShowMoreVars] = useState(false);
  const [searchTemplate, setSearchTemplate] = useState('');
  
  const editorRef = useRef(null);

  useEffect(() => {
    if (activeTemplate && editorRef.current) {
      editorRef.current.innerHTML = activeTemplate.content || '';
    }
  }, [activeTemplate?.id]);

  const saveTemplates = async (newTemplates) => {
    setTemplates(newTemplates);
    if (isAdmin) {
      await saveSettingsToFirebase({ printTemplates: newTemplates });
      toast('تم حفظ القوالب', 'success');
    }
  };

  const handleCreateNew = () => {
    const newTpl = {
      id: 'tpl_' + Date.now(),
      name: 'قالب جديد',
      category: activeFolder || 'عام',
      content: '<div dir="rtl" style="font-family: \'Cairo\', sans-serif;">اكتب نص القالب هنا...</div>'
    };
    const updated = [...templates, newTpl];
    saveTemplates(updated);
    setActiveTemplate(newTpl);
  };

  const handleSaveActive = () => {
    if (!activeTemplate || !editorRef.current) return;
    const newContent = editorRef.current.innerHTML;
    const updated = templates.map(t => 
      t.id === activeTemplate.id ? { ...t, content: newContent } : t
    );
    saveTemplates(updated);
    setActiveTemplate(prev => ({ ...prev, content: newContent }));
  };

  const handleDelete = async (id) => {
    if (await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذا القالب؟')) {
      const updated = templates.filter(t => t.id !== id);
      saveTemplates(updated);
      if (activeTemplate?.id === id) setActiveTemplate(updated[0] || null);
    }
  };

  const insertVariable = (variable) => {
    if (editorRef.current) {
      editorRef.current.focus();
      // Insert text at cursor position
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(variable);
        range.insertNode(node);
        // Move cursor after the inserted node
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  const execCmd = (cmd, arg = null) => {
    document.execCommand(cmd, false, arg);
    editorRef.current?.focus();
  };

  // Group templates by category
  const groupedTemplates = templates.reduce((acc, curr) => {
    if (searchTemplate && !curr.name.toLowerCase().includes(searchTemplate.toLowerCase())) return acc;
    const cat = curr.category || 'عام';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedTemplates).sort((a, b) => a.localeCompare(b, 'ar'));

  const mainVariables = [
    { label: 'رقم الدعوى', val: '{{رقم_الدعوى}}' },
    { label: 'السنة', val: '{{السنة}}' },
    { label: 'المدعي', val: '{{المدعي}}' },
    { label: 'المدعى عليه', val: '{{المدعى_عليه}}' },
    { label: 'الجلسة الحالية', val: '{{الجلسة_الحالية}}' },
    { label: 'القرار', val: '{{القرار}}' },
  ];

  const moreVariables = [
    { label: 'عنوان المدعي', val: '{{عنوان_المدعي}}' },
    { label: 'عنوان المدعى عليه', val: '{{عنوان_المدعى_عليه}}' },
    { label: 'المقر المختار', val: '{{المقر_المختار}}' },
    { label: 'تصنيف الدعوى', val: '{{تصنيف_الدعوى}}' },
    { label: 'موضوع الدعوى', val: '{{موضوع_الدعوى}}' },
    { label: 'مكان الملف', val: '{{مكان_الملف}}' },
    { label: 'نوع الجلسة', val: '{{نوع_الجلسة}}' },
    { label: 'اسم المستشار', val: '{{اسم_المستشار}}' },
    { label: 'المحكمة', val: '{{المحكمة}}' },
    { label: 'الدائرة', val: '{{الدائرة}}' },
    { label: 'الصفة', val: '{{الصفة}}' },
    { label: 'الملاحظات', val: '{{الملاحظات}}' },
    { label: 'رقم الحفظ', val: '{{رقم_الحفظ}}' },
    { label: 'حكم تمهيدي', val: '{{حكم_تمهيدي}}' },
    { label: 'منطوق الحكم', val: '{{منطوق_الحكم}}' },
    { label: 'تصنيف الحكم', val: '{{تصنيف_الحكم}}' },
    { label: 'الرول', val: '{{الرول}}' },
    { label: 'المطعون ضده', val: '{{المطعون_ضده}}' },
    { label: 'طلبات المدعي', val: '{{طلبات_المدعي}}' },
    { label: 'آخر جلسة', val: '{{آخر_جلسة}}' },
    { label: 'منطوق حكم أول درجة', val: '{{منطوق_حكم_أول_درجة}}' },
    { label: 'محكمة أول درجة', val: '{{محكمة_أول_درجة}}' },
  ];

  // ─── Preview Logic ───
  const previewCase = cases?.[0] || null;

  const getFieldVal = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return '';
  };

  const processPreview = (content) => {
    if (!previewCase) return content;
    const c = previewCase;
    const latestSessionDate = c.sessions?.length > 0 ? c.sessions[0].date : getFieldVal(c, ['تاريخ الجلسة']);
    const legacyAppellee = getFieldVal(c, ['المدعى_عليه', 'المدعى عليه', 'المطعون ضده', 'ضد']);
    const legacyAddress = getFieldVal(c, ['عنوان المدعى عليه', 'عنوان_المدعى_عليه']);
    const legacyChosenAddress = getFieldVal(c, ['المقر المختار']);
    const effectiveDefendants = (c.defendantsList?.length > 0) ? c.defendantsList
      : ((legacyAppellee || legacyAddress) ? [{ name: legacyAppellee || '', address: legacyAddress || '', chosenAddress: legacyChosenAddress || '' }] : []);
    const finalDefendantName = effectiveDefendants.map(d => d.name).filter(Boolean).join(' و ') || legacyAppellee || '';
    const finalDefendantAddress = effectiveDefendants.map(d => d.address).filter(Boolean).join(' و ') || legacyAddress || '';
    const finalChosenAddress = effectiveDefendants.map(d => d.chosenAddress).filter(Boolean).join(' و ') || legacyChosenAddress || '';

    const vars = {
      '{{رقم_الدعوى}}': getFieldVal(c, ['رقم الدعوى', 'رقم القضية']) || '',
      '{{السنة}}': getFieldVal(c, ['السنة', 'سنة']) || '',
      '{{المدعي}}': getFieldVal(c, ['المدعي', 'الطاعن', 'المدعى']) || '',
      '{{المدعى_عليه}}': finalDefendantName,
      '{{المدعي_عليه}}': finalDefendantName,
      '{{المطعون_ضده}}': finalDefendantName,
      '{{الجلسة_الحالية}}': latestSessionDate || '',
      '{{آخر_جلسة}}': latestSessionDate || '',
      '{{تاريخ_الجلسة}}': latestSessionDate || '',
      '{{القرار}}': getFieldVal(c, ['القرار', 'قرار الجلسة', 'المنطوق']) || '',
      '{{نوع_الجلسة}}': getFieldVal(c, ['نوع الجلسة']) || '',
      '{{اسم_المستشار}}': settings?.consultantName || '',
      '{{المحكمة}}': getFieldVal(c, ['المحكمة']) || '',
      '{{الدائرة}}': getFieldVal(c, ['الدائرة']) || '',
      '{{الصفة}}': getFieldVal(c, ['الصفة', 'صفتنا']) || '',
      '{{الملاحظات}}': getFieldVal(c, ['الملاحظات', 'ملاحظات']) || '',
      '{{رقم_الحفظ}}': getFieldVal(c, ['رقم الحفظ']) || '',
      '{{حكم_تمهيدي}}': getFieldVal(c, ['حكم تمهيدي']) || '',
      '{{منطوق_الحكم}}': getFieldVal(c, ['منطوق الحكم', 'المنطوق']) || '',
      '{{تصنيف_الحكم}}': getFieldVal(c, ['تصنيف الحكم', 'نوع الحكم']) || '',
      '{{الرول}}': getFieldVal(c, ['الرول', 'رول الجلسة']) || '',
      '{{تصنيف_الدعوى}}': getFieldVal(c, ['تصنيف الدعوى']) || '',
      '{{موضوع_الدعوى}}': getFieldVal(c, ['موضوع الدعوى', 'ملخص الطعن']) || '',
      '{{عنوان_المدعي}}': getFieldVal(c, ['عنوان المدعي', 'عنوان الطاعن']) || '',
      '{{عنوان_المدعى_عليه}}': finalDefendantAddress,
      '{{عنوان_المدعي_عليه}}': finalDefendantAddress,
      '{{المقر_المختار}}': finalChosenAddress,
      '{{مكان_الملف}}': getFieldVal(c, ['مكان الملف']) || '',
      '{{طلبات_المدعي}}': getFieldVal(c, ['طلبات المدعي', 'طلبات الطاعن']) || '',
      '{{منطوق_حكم_أول_درجة}}': getFieldVal(c, ['منطوق حكم أول درجة']) || '',
      '{{حكم_أول_درجة}}': getFieldVal(c, ['حكم محكمة أول درجة']) || '',
      '{{محكمة_أول_درجة}}': getFieldVal(c, ['محكمة أول درجة']) || '',
    };
    let html = content;
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
      html = html.replace(regex, `<span style="background:#fef08a;border-radius:3px;padding:0 2px;">${value || `<span style="color:#ef4444;font-size:11px;">[${key}]</span>`}</span>`);
    }
    return html;
  };

  return (
    <>
    <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-4 w-full">
      {/* Sidebar: Templates List */}
      <div className="w-full lg:w-1/4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">القوالب المحفوظة</h3>
          <button 
            onClick={handleCreateNew}
            className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن قالب..."
              value={searchTemplate}
              onChange={e => setSearchTemplate(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-lg py-1.5 pr-9 pl-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sortedCategories.length === 0 && (
             <div className="text-center text-slate-400 text-xs py-4 font-bold">لا توجد قوالب مطابقة</div>
          )}
          
          {!activeFolder ? (
            // Folders View
            <div className="grid grid-cols-2 gap-2">
              {sortedCategories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setActiveFolder(cat)}
                  className="flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl transition gap-2 group"
                >
                  <Folder className="w-10 h-10 text-amber-400 fill-amber-100 group-hover:scale-110 transition-transform" />
                  <h4 className="text-[11px] font-black text-slate-700 text-center line-clamp-1">{cat}</h4>
                  <span className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border">{groupedTemplates[cat].length} ملف</span>
                </button>
              ))}
            </div>
          ) : (
            // Files View (Inside a folder)
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-2 duration-200">
              <button 
                onClick={() => setActiveFolder(null)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg mb-3 self-start transition"
              >
                <ChevronRight className="w-4 h-4" /> عودة للمجلدات
              </button>
              
              <div className="flex items-center gap-2 mb-3 px-1">
                <FolderOpen className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-black text-slate-700">{activeFolder}</h4>
              </div>

              <div className="space-y-1.5 flex-1 overflow-y-auto">
                {(groupedTemplates[activeFolder] || []).sort((a,b) => a.name.localeCompare(b.name, 'ar')).map(tpl => (
                  <div 
                    key={tpl.id}
                    onClick={() => setActiveTemplate(tpl)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition group border ${activeTemplate?.id === tpl.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FileText className={`w-4 h-4 shrink-0 ${activeTemplate?.id === tpl.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className={`text-[11px] font-bold truncate ${activeTemplate?.id === tpl.id ? 'text-indigo-800' : 'text-slate-600'}`}>
                        {tpl.name}
                      </span>
                    </div>
                    {isAdmin && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id); }} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition shrink-0 bg-white hover:bg-rose-50 p-1.5 rounded-lg shadow-sm border border-slate-200 hover:border-rose-200">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Area: Editor */}
      <div className="w-full lg:w-3/4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        {activeTemplate ? (
          <>
            {/* Toolbar */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              
              <div className="flex items-center gap-2">
                {isEditingMeta ? (
                  <div className="flex gap-2 items-center">
                    <input 
                      type="text" 
                      value={metaForm.name} 
                      onChange={e => setMetaForm({...metaForm, name: e.target.value})}
                      className="text-xs font-bold px-2 py-1 rounded border"
                      placeholder="اسم القالب"
                    />
                    <input 
                      type="text" 
                      list="cat-suggestions"
                      value={metaForm.category} 
                      onChange={e => setMetaForm({...metaForm, category: e.target.value})}
                      className="text-xs font-bold px-2 py-1 rounded border w-24"
                      placeholder="المجلد"
                    />
                    <datalist id="cat-suggestions">
                      {sortedCategories.map(c => <option key={c} value={c} />)}
                    </datalist>
                    <button onClick={() => {
                      const updated = templates.map(t => t.id === activeTemplate.id ? { ...t, name: metaForm.name, category: metaForm.category } : t);
                      saveTemplates(updated);
                      setActiveTemplate({ ...activeTemplate, name: metaForm.name, category: metaForm.category });
                      setIsEditingMeta(false);
                    }} className="text-emerald-600 font-bold text-xs bg-emerald-100 px-2 py-1 rounded">حفظ</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-indigo-900">{activeTemplate.name}</h3>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{activeTemplate.category}</span>
                    <button onClick={() => { setMetaForm({name: activeTemplate.name, category: activeTemplate.category}); setIsEditingMeta(true); }} className="text-slate-400 hover:text-indigo-600">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white border rounded-lg overflow-hidden h-8">
                  <button onClick={() => execCmd('undo')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 border-l text-slate-700" title="تراجع"><Undo className="w-3.5 h-3.5"/></button>
                  <button onClick={() => execCmd('redo')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 border-l text-slate-700" title="إعادة"><Redo className="w-3.5 h-3.5"/></button>
                  <button onClick={() => execCmd('bold')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 font-black border-l text-slate-700" title="عريض">B</button>
                  <button onClick={() => execCmd('italic')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 italic border-l text-slate-700" title="مائل">I</button>
                  <button onClick={() => execCmd('underline')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 underline border-l text-slate-700" title="تسطير">U</button>
                  <button onClick={() => execCmd('removeFormat')} className="w-8 h-full flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 border-l text-slate-500" title="مسح التنسيقات"><Eraser className="w-4 h-4"/></button>
                  <button onClick={() => execCmd('insertUnorderedList')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 border-l text-slate-700" title="قائمة نقطية"><List className="w-4 h-4"/></button>
                  <button onClick={() => execCmd('insertOrderedList')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 border-l text-slate-700" title="قائمة رقمية"><ListOrdered className="w-4 h-4"/></button>
                  <button onClick={() => execCmd('justifyRight')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 border-l text-slate-700" title="يمين">≡</button>
                  <button onClick={() => execCmd('justifyCenter')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 border-l text-slate-700" title="توسيط">≢</button>
                  <button onClick={() => execCmd('justifyLeft')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 text-slate-700" title="يسار">≡</button>
                </div>
                {isAdmin && (
                  <button 
                    onClick={handleSaveActive}
                    className="flex items-center gap-1 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    <Save className="w-4 h-4" /> حفظ التعديلات
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (editorRef.current) {
                      // Save first then show preview
                      handleSaveActive();
                    }
                    setShowPreview(true);
                  }}
                  className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-200 transition border border-indigo-200"
                  title="معاينة القالب مع بيانات حقيقية"
                >
                  <Eye className="w-4 h-4" /> معاينة
                </button>
              </div>
            </div>

            {/* Variables Bar */}
            <div className="bg-amber-50 p-2 border-b border-amber-100 flex items-center gap-2 flex-wrap relative">
              <span className="text-[10px] font-black text-amber-800 flex items-center gap-1 shrink-0"><Variable className="w-3 h-3"/> المتغيرات السحرية:</span>
              {mainVariables.map(v => (
                <button 
                  key={v.val}
                  onClick={() => insertVariable(v.val)}
                  className="bg-white border border-amber-200 text-amber-700 text-[10px] font-bold px-2 py-1 rounded hover:bg-amber-100 transition shrink-0"
                  title={`إدراج ${v.label}`}
                >
                  {v.label}
                </button>
              ))}
              
              <div className="relative">
                <button 
                  onClick={() => setShowMoreVars(!showMoreVars)}
                  className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded hover:bg-indigo-100 transition shrink-0 flex items-center gap-1"
                >
                  المزيد <ChevronDown className="w-3 h-3" />
                </button>
                {showMoreVars && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-3 grid grid-cols-2 gap-2">
                    <div className="col-span-2 text-[9px] font-black text-slate-400 mb-1 border-b pb-1">بيانات الدعوى الأساسية</div>
                    {moreVariables.slice(0, 5).map(v => (
                      <button key={v.val} onClick={() => { insertVariable(v.val); setShowMoreVars(false); }} className="text-right text-[10px] font-bold text-slate-700 hover:bg-slate-100 p-1.5 rounded">{v.label}</button>
                    ))}
                    <div className="col-span-2 text-[9px] font-black text-slate-400 mb-1 mt-2 border-b pb-1">بيانات الجلسة والمحكمة</div>
                    {moreVariables.slice(5, 11).map(v => (
                      <button key={v.val} onClick={() => { insertVariable(v.val); setShowMoreVars(false); }} className="text-right text-[10px] font-bold text-slate-700 hover:bg-slate-100 p-1.5 rounded">{v.label}</button>
                    ))}
                    <div className="col-span-2 text-[9px] font-black text-slate-400 mb-1 mt-2 border-b pb-1">بيانات الحكم</div>
                    {moreVariables.slice(11).map(v => (
                      <button key={v.val} onClick={() => { insertVariable(v.val); setShowMoreVars(false); }} className="text-right text-[10px] font-bold text-slate-700 hover:bg-slate-100 p-1.5 rounded">{v.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-slate-500 shrink-0 mr-auto">(اضغط للإدراج)</span>
            </div>

            {/* Editor Surface */}
            <div className="flex-1 p-8 overflow-y-auto bg-slate-100">
               <div className="max-w-[210mm] mx-auto bg-white min-h-[297mm] shadow-lg p-12 focus-within:ring-2 focus-within:ring-indigo-300 transition-shadow">
                  <div 
                    ref={editorRef}
                    contentEditable={isAdmin}
                    className="w-full h-full outline-none prose prose-slate max-w-none text-right font-cairo"
                    dir="rtl"
                    style={{ minHeight: '100%', fontFamily: 'Cairo, sans-serif' }}
                    onBlur={handleSaveActive}
                    onPaste={(e) => {
                      // Browser default paste is allowed here to keep Word formatting
                    }}
                  />
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
            <FileText className="w-16 h-16 opacity-20" />
            <p className="font-bold">اختر قالباً من القائمة أو أنشئ قالباً جديداً</p>
          </div>
        )}
      </div>

    </div>

    {/* ─── Preview Modal ─── */}
    {showPreview && activeTemplate && (
      <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center overflow-y-auto">
        {/* Header */}
        <div className="w-full bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-10 shadow-xl print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-base">{activeTemplate.name} — معاينة بيانات حقيقية</h2>
              {previewCase ? (
                <p className="text-[11px] text-slate-300">
                  يعرض بيانات: {previewCase['رقم الدعوى'] || previewCase['رقم_الدعوى']} — 
                  <span className="bg-yellow-400/20 text-yellow-300 px-1 rounded text-[10px]">المتغيرات المعبأة بالأصفر ✓</span>
                  <span className="text-rose-300 px-1 text-[10px]"> المتغيرات الفارغة بالأحمر ✗</span>
                </p>
              ) : (
                <p className="text-[11px] text-amber-300">⚠️ لا توجد قضايا محملة للمعاينة</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-sm font-bold transition"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button 
              onClick={() => setShowPreview(false)}
              className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Preview */}
        <div className="w-full max-w-[210mm] mx-auto my-8 print:my-0 shadow-2xl print:shadow-none bg-white">
          <div className="w-full min-h-[297mm] p-12 print:p-8 bg-white">
            <div 
              className="w-full h-full"
              style={{ fontFamily: 'Cairo, sans-serif' }}
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: processPreview(activeTemplate.content || '') }}
            />
          </div>
        </div>

        {/* Variable Legend */}
        {previewCase && (
          <div className="w-full max-w-[210mm] mx-auto mb-8 bg-white rounded-xl shadow-lg p-4 print:hidden">
            <h4 className="font-black text-sm text-slate-700 mb-3 border-b pb-2">📋 تقرير المتغيرات في هذا القالب</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              {[...mainVariables, ...moreVariables].filter(v => activeTemplate.content?.includes(v.val)).map(v => {
                const allVars = { ...mainVariables, ...moreVariables };
                const previewHtml = processPreview(v.val);
                const isEmpty = previewHtml.includes('color:#ef4444');
                return (
                  <div key={v.val} className={`flex items-center gap-2 p-2 rounded-lg border ${isEmpty ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <span className={`text-lg ${isEmpty ? 'text-rose-400' : 'text-emerald-500'}`}>{isEmpty ? '✗' : '✓'}</span>
                    <div>
                      <div className="font-black text-slate-700">{v.label}</div>
                      <div className={`text-[10px] ${isEmpty ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {isEmpty ? 'فارغ — تحقق من اسم الحقل' : 'يعمل'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    )}
    </>
  );
}
