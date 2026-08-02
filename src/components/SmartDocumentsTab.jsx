import React, { useState, useEffect, useRef } from 'react';
import { Plus, Save, Trash2, Edit3, Copy, FileText, Search, Settings, Variable, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useUI } from '../context/UIContext';

export default function SmartDocumentsTab() {
  const { settings, saveSettingsToFirebase, isAdmin } = useAppContext();
  const { toast } = useUI();
  
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
       <div class="flex items-start"><span class="w-24 shrink-0">ضـــــــد:</span> <span class="flex-1">{{ضد}}</span></div>
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
  const [expandedCats, setExpandedCats] = useState({ 'شهادات': true, 'عام': true });
  const [showMoreVars, setShowMoreVars] = useState(false);
  
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
      category: 'عام',
      content: '<div dir="rtl" style="font-family: \'Cairo\', sans-serif;">اكتب نص القالب هنا...</div>'
    };
    const updated = [...templates, newTpl];
    saveTemplates(updated);
    setActiveTemplate(newTpl);
  };

  const handleSaveActive = () => {
    if (!activeTemplate || !editorRef.current) return;
    const updated = templates.map(t => 
      t.id === activeTemplate.id ? { ...t, content: editorRef.current.innerHTML } : t
    );
    saveTemplates(updated);
  };

  const handleDelete = (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا القالب؟')) {
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
    const cat = curr.category || 'عام';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {});

  const toggleCat = (cat) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const mainVariables = [
    { label: 'رقم الدعوى', val: '{{رقم_الدعوى}}' },
    { label: 'السنة', val: '{{السنة}}' },
    { label: 'المدعي', val: '{{المدعي}}' },
    { label: 'ضد', val: '{{ضد}}' },
    { label: 'الجلسة الحالية', val: '{{الجلسة_الحالية}}' },
    { label: 'القرار', val: '{{القرار}}' },
  ];

  const moreVariables = [
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
  ];

  return (
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
        
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {Object.keys(groupedTemplates).map(cat => (
            <div key={cat} className="space-y-1">
              <button 
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between p-1 hover:bg-slate-50 rounded"
              >
                <h4 className="text-xs font-black text-slate-500 flex items-center gap-1">
                  {expandedCats[cat] ? <ChevronDown className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                  {cat} ({groupedTemplates[cat].length})
                </h4>
              </button>
              {expandedCats[cat] && (
                <div className="space-y-1 pr-2 border-r-2 border-slate-100 mr-2">
                  {groupedTemplates[cat].map(tpl => (
                    <div 
                      key={tpl.id}
                      onClick={() => setActiveTemplate(tpl)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${activeTemplate?.id === tpl.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className={`w-4 h-4 shrink-0 ${activeTemplate?.id === tpl.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className={`text-xs font-bold truncate ${activeTemplate?.id === tpl.id ? 'text-indigo-800' : 'text-slate-600'}`}>
                          {tpl.name}
                        </span>
                      </div>
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id); }} className="text-slate-300 hover:text-rose-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
                      value={metaForm.category} 
                      onChange={e => setMetaForm({...metaForm, category: e.target.value})}
                      className="text-xs font-bold px-2 py-1 rounded border w-24"
                      placeholder="المجلد"
                    />
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
                  <button onClick={() => execCmd('bold')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 font-black border-l">B</button>
                  <button onClick={() => execCmd('italic')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 italic border-l">I</button>
                  <button onClick={() => execCmd('underline')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 underline border-l">U</button>
                  <button onClick={() => execCmd('justifyRight')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 border-l" title="يمين">≡</button>
                  <button onClick={() => execCmd('justifyCenter')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100 border-l" title="توسيط">≢</button>
                  <button onClick={() => execCmd('justifyLeft')} className="w-8 h-full flex items-center justify-center hover:bg-slate-100" title="يسار">≡</button>
                </div>
                {isAdmin && (
                  <button 
                    onClick={handleSaveActive}
                    className="flex items-center gap-1 bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    <Save className="w-4 h-4" /> حفظ التعديلات
                  </button>
                )}
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
                  <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 grid grid-cols-2 gap-1">
                    {moreVariables.map(v => (
                      <button 
                        key={v.val}
                        onClick={() => { insertVariable(v.val); setShowMoreVars(false); }}
                        className="text-right text-[10px] font-bold text-slate-700 hover:bg-slate-100 p-1.5 rounded"
                      >
                        {v.label}
                      </button>
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
                    dangerouslySetInnerHTML={{ __html: activeTemplate.content }}
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
  );
}
