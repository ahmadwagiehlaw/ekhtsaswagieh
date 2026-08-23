import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppState';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { firebaseConfig, USERS_DIRECTORY_REF } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import SettingsDataTab from '../components/settings/SettingsDataTab';
import SettingsUsersTab from '../components/settings/SettingsUsersTab';
import SettingsSystemTab from '../components/settings/SettingsSystemTab';
import { Upload, LogIn, LogOut, Check, ShieldCheck, Database, LayoutTemplate, Plus, Trash2, ArrowDownUp, Users, ShieldAlert, Settings as SettingsIcon, BookOpen, ClipboardList, Scale, Download, FileJson, ArrowUpFromLine, Copy, Clock, Fingerprint, Edit3, Search, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useUI } from '../context/UIContext';
import JudgmentRulesSection from '../components/JudgmentRulesSection';
import SettingsDeadlinesSection from '../components/settings/SettingsDeadlinesSection';
import SettingsStatsMappingSection from '../components/settings/SettingsStatsMappingSection';
import { DEFAULT_STATS_MAP } from '../utils/statsMapping';

export default function Settings() {
  const { cases, schema, deleteAllCases, saveBatchCasesToFirebase, saveSchemaToFirebase, isAdmin, logoutAdmin, settings, saveSettingsToFirebase } = useAppContext();
  const { userData, login, currentUser } = useAuth();
  const { toast, showConfirm, showPrompt } = useUI();

  // Sync state
  const [isProcessing, setIsProcessing] = useState(false);

  // Schema state
  const [localSchema, setLocalSchema] = useState(schema || []);
  const [activeTab, setActiveTab] = useState('system');
  
  // Advanced state
    const [localDecisions, setLocalDecisions] = useState(settings?.decisions || []);
    const [localRollTypes, setLocalRollTypes] = useState(settings?.rollTypes || ['رول جلسة', 'حصر الفحص', 'حصر الموضوع', 'رول أحكام']);
      const [localRoles, setLocalRoles] = useState(settings?.roles || ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص']);
  const [localSessionTypes, setLocalSessionTypes] = useState(settings?.sessionTypes || []);
  const [localFileLocations, setLocalFileLocations] = useState(settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي']);
  const [localViewingTasksPrintTemplate, setLocalViewingTasksPrintTemplate] = useState(settings?.viewingTasksPrintTemplate || {
    title: 'كشف مهام الإطلاع وتصوير المستندات',
    showCreationDate: true,
    showConsultant: true,
    showRoll: true,
    showCaseNumber: true,
    showAppellant: true,
    showAppellee: true,
    showRequiredDocs: true,
    showSessionDate: true,
    showDecision: true,
    showStatus: true
  });
  const [localViewingTasksPrintOrder, setLocalViewingTasksPrintOrder] = useState(settings?.viewingTasksPrintOrder || [
    'showRoll', 
    'showCaseNumber', 
    'showAppellant', 
    'showAppellee', 
    'showSessionDate', 
    'showSessionType', 
    'showDecision', 
    'showStatus',
    'showRequiredDocs'
  ]);
  const [localCommonProcedures, setLocalCommonProcedures] = useState(settings?.commonProcedures || ['إيداع مذكرة دفاع', 'تقديم حافظة مستندات', 'طلب تصوير ملف', 'سداد الأمانة', 'حضور الجلسة']);
  const [localCaseClassifications, setLocalCaseClassifications] = useState(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']);
    
  const migrateJudgmentRule = (rule) => {
    if (rule.triggerField) {
      return {
        name: rule.name || '',
        conditions: {
          role: '',
          category: rule.triggerField === 'category' ? (rule.triggerValue || '') : '',
          classification: rule.triggerField === 'classification' ? (rule.triggerValue || '') : '',
          type: ''
        },
        actions: {
          category: '',
          classification: rule.setClassification || '',
          type: rule.setType || '',
          text: rule.setText || ''
        }
      };
    }
    return {
      name: rule.name || '',
      conditions: rule.conditions || { role: '', category: '', classification: '', type: '', sessionType: '', decision: '' },
      actions: rule.actions || { category: '', classification: '', type: '', text: '' }
    };
  };

  const [localJudgmentDefaults, setLocalJudgmentDefaults] = useState((settings?.judgmentDefaults || []).map(migrateJudgmentRule));
  const [localJudgmentCategories, setLocalJudgmentCategories] = useState(settings?.judgmentCategories || ['قرار فحص', 'حكم نهائي', 'حكم إجرائي', 'حكم منه للخصومة']);
  const [localJudgmentClassifications, setLocalJudgmentClassifications] = useState(settings?.judgmentClassifications || ['صالح', 'ضد', 'مختلط', 'تمهيدي']);
  const [localJudgmentTypes, setLocalJudgmentTypes] = useState(settings?.judgmentTypes || [
    'قبول', 'إلغاء', 'رفض', 'عدم قبول', 'سقوط الخصومة', 'شطب', 'اعتبار الدعوى كأن لم تكن', 'وقف جزائي', 'انقطاع سير الخصومة', 'إحالة', 'إحالة للخبراء'
  ]);
  const [localDeadlineRules, setLocalDeadlineRules] = useState(settings?.deadlineRules || [
    { name: 'الطعن العادي', days: 60, targetRole: 'طاعنين', description: 'ميعاد الطعن العادي 60 يوماً' },
    { name: 'تعجيل من الوقف الجزائي', days: 15, triggerAfterDays: 30, targetRole: 'طاعنين', description: 'يجب التعجيل خلال 15 يوماً بعد مرور شهر من الوقف' }
  ]);
  const [expandedRules, setExpandedRules] = useState([]);
  const [rulesSearchQuery, setRulesSearchQuery] = useState('');
  const [expandedRuleGroups, setExpandedRuleGroups] = useState(['قواعد عامة']); // Default expand first/general group
  const [localMemoCalculationMode, setLocalMemoCalculationMode] = useState(settings?.memoCalculationMode || 'session_date');
  const [localScratchpadPosition, setLocalScratchpadPosition] = useState(settings?.scratchpadPosition || 'right');
  const [localSearchTabPosition, setLocalSearchTabPosition] = useState(settings?.searchTabPosition || 'right');
  const [localStatsMapping, setLocalStatsMapping] = useState(settings?.statsMapping?.length ? settings.statsMapping : [...DEFAULT_STATS_MAP]);
  

  // Sync settings when loaded
  React.useEffect(() => {
        setLocalDecisions(settings?.decisions || []);
        setLocalRollTypes(settings?.rollTypes || ['رول جلسة', 'حصر الفحص', 'حصر الموضوع', 'رول أحكام']);
            setLocalRoles(settings?.roles || ['مطعون ضدنا', 'طاعنين', 'لا شأن', 'خارج الاختصاص']);
    setLocalSessionTypes(settings?.sessionTypes || []);
    setLocalFileLocations(settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي']);
    setLocalCommonProcedures(settings?.commonProcedures || ['إيداع مذكرة دفاع', 'تقديم حافظة مستندات', 'طلب تصوير ملف', 'سداد الأمانة', 'حضور الجلسة']);
    setLocalCaseClassifications(settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']);
    setLocalJudgmentCategories(settings?.judgmentCategories || ['قرار فحص', 'حكم نهائي', 'حكم إجرائي', 'حكم منه للخصومة']);
    setLocalJudgmentClassifications(settings?.judgmentClassifications || ['صالح', 'ضد', 'مختلط', 'تمهيدي']);
    setLocalJudgmentTypes(settings?.judgmentTypes || ['قبول', 'إلغاء', 'رفض', 'عدم قبول', 'سقوط الخصومة', 'شطب', 'اعتبار الدعوى كأن لم تكن', 'وقف جزائي', 'انقطاع سير الخصومة', 'إحالة', 'إحالة للخبراء']);
        
    setLocalDeadlineRules(settings?.deadlineRules || [
      { name: 'الطعن العادي', days: 60, targetRole: 'طاعنين', description: 'ميعاد الطعن العادي 60 يوماً' },
      { name: 'تعجيل من الوقف الجزائي', days: 15, triggerAfterDays: 30, targetRole: 'طاعنين', description: 'يجب التعجيل خلال 15 يوماً بعد مرور شهر من الوقف' }
    ]);
    setLocalStatsMapping(settings?.statsMapping?.length ? settings.statsMapping : [...DEFAULT_STATS_MAP]);
  }, [settings]);

  const handleSaveSettings = async () => {
    

    await saveSettingsToFirebase({
      ...settings,
            viewingTasksPrintTemplate: localViewingTasksPrintTemplate,
      viewingTasksPrintOrder: localViewingTasksPrintOrder,
            decisions: localDecisions,
            rollTypes: localRollTypes,
                  roles: localRoles,
      sessionTypes: localSessionTypes,
      fileLocations: localFileLocations,
      commonProcedures: localCommonProcedures,
      caseClassifications: localCaseClassifications,
      judgmentCategories: localJudgmentCategories,
      judgmentClassifications: localJudgmentClassifications,
      judgmentTypes: localJudgmentTypes,
            
      judgmentDefaults: localJudgmentDefaults,
      deadlineRules: localDeadlineRules,
      memoCalculationMode: localMemoCalculationMode,
      scratchpadPosition: localScratchpadPosition,
      searchTabPosition: localSearchTabPosition,
      statsMapping: localStatsMapping,
    });
    setIsProcessing(false);
    toast('تم حفظ الإعدادات المتقدمة بنجاح', 'success');
  };

  
  


  const sanitizeId = (str) => String(str).replace(/[\/\\?%*:|"<>\s]/g, '_');

  const addSchemaField = () => {
    const id = `field_${Date.now()}`;
    setLocalSchema([...localSchema, { id, label: 'حقل جديد', type: 'text', visible: true, primary: false }]);
  };

  const updateSchemaField = (index, key, value) => {
    const newSchema = [...localSchema];
    newSchema[index][key] = value;
    setLocalSchema(newSchema);
  };

  const removeSchemaField = (index) => {
    const newSchema = localSchema.filter((_, i) => i !== index);
    setLocalSchema(newSchema);
  };

  const saveSchema = async () => {
    setIsProcessing(true);
    await saveSchemaToFirebase(localSchema);
    setIsProcessing(false);
    toast('تم حفظ بنية البيانات بنجاح!', 'success');
  };

  const handleCleanupSchema = async () => {
    const confirmed = await showConfirm('تأكيد تنظيف الحقول', 'سيتم دمج الحقول المكررة (سنة، year) في (السنة)، و(رقم القضية، رقم_الدعوى) في (رقم الدعوى). هل أنت متأكد؟');
    if (!confirmed) return;

    setIsProcessing(true);
    
    const duplicatesToRemove = ['سنة', 'year', 'رقم القضية', 'رقم_الدعوى', 'المدعى_عليه'];
    const newSchema = localSchema.filter(f => !duplicatesToRemove.includes(f.id));
    
    setLocalSchema(newSchema);
    await saveSchemaToFirebase(newSchema);
    
    toast('تم تنظيف الحقول بنجاح', 'success');
    setIsProcessing(false);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-rose-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-navy-900">غير مصرح لك بالدخول</h2>
            <p className="text-xs font-bold text-slate-500 mt-2">هذه الصفحة مخصصة لمدير النظام فقط.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Sub-tab state per main tab ──────────────────────────────
  const [systemSub,   setSystemSub]   = React.useState('general');
  const [judgmentSub, setJudgmentSub] = React.useState('lists');
  const [sessionSub,  setSessionSub]  = React.useState('roles');
  const [advancedSub, setAdvancedSub] = React.useState('schema');

  const SubNav = ({ options, active, setActive }) => (
    <div className="flex gap-1.5 flex-wrap mb-5 pb-4 border-b border-slate-100">
      {options.map(o => (
        <button key={o.id} onClick={() => setActive(o.id)}
          className={`text-[11px] font-black px-3 py-1.5 rounded-lg transition-all ${active === o.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );

  const SaveBtn = ({ label = 'حفظ الإعدادات' }) => (
    <button onClick={handleSaveSettings} disabled={isProcessing}
      className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm hover:bg-navy-800 transition disabled:opacity-50 mt-2">
      {isProcessing ? 'جاري الحفظ...' : `💾 ${label}`}
    </button>
  );

  const TagList = ({ items, onRemove, onAdd, addLabel, addPromptTitle, addPromptMsg, color = 'indigo' }) => (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-1 bg-${color}-50 border border-${color}-100 text-${color}-700 px-3 py-1.5 rounded-lg text-xs font-bold`}>
          <span>{item}</span>
          <button onClick={() => onRemove(i)} className={`text-${color}-400 hover:text-rose-500 mr-2`}><Trash2 className="w-3 h-3" /></button>
        </div>
      ))}
      <button onClick={async () => { const v = await showPrompt(addPromptTitle, addPromptMsg); if (v?.trim()) onAdd(v.trim()); }}
        className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm">
        <Plus className="w-3 h-3" /> {addLabel}
      </button>
    </div>
  );

  const SectionCard = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      {title && (
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
          <h3 className="font-black text-sm text-navy-900">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6">

      {/* Admin Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="font-black text-navy-900">لوحة الإدارة</h2>
        </div>
        <button onClick={logoutAdmin} className="text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-2 rounded-xl flex items-center gap-1.5">
          <LogOut className="w-3 h-3" /> تسجيل خروج
        </button>
      </div>

      {/* PRIMARY TABS */}
      <div className="flex bg-slate-200/50 p-1 rounded-xl gap-1">
        {[
          { id: 'system',    label: '⚙️ النظام' },
          { id: 'judgments', label: '⚖️ الأحكام' },
          { id: 'sessions',  label: '📋 الجلسات' },
          { id: 'advanced',  label: '🔧 البيانات' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 text-[11px] sm:text-xs font-bold py-2.5 rounded-lg transition-all ${activeTab === t.id ? 'bg-white shadow text-navy-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ ⚙️ النظام ═══ */}
      {activeTab === 'system' && (
        <div className="animate-in fade-in zoom-in duration-200">
          <SubNav active={systemSub} setActive={setSystemSub} options={[
            { id: 'general', label: '⚙️ إعدادات عامة' },
            { id: 'print',   label: '🖨️ الطباعة' },
          ]} />

          {systemSub === 'general' && (
            <div className="space-y-4">
              <SettingsSystemTab />
              <SaveBtn />
            </div>
          )}

          {systemSub === 'print' && (
            <div className="space-y-4">
              <SectionCard title="نموذج كشف مهام الإطلاع" icon={ClipboardList}>
                <div>
                  <label className="text-[11px] font-black text-slate-500 block mb-1">عنوان الكشف الافتراضي</label>
                  <input type="text" value={localViewingTasksPrintTemplate.title}
                    onChange={(e) => setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, title: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400" />
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-xs text-navy-900">بيانات الكشف الأساسية</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[{ key: 'showCreationDate', label: 'إظهار تاريخ التحرير' }, { key: 'showConsultant', label: 'إظهار اسم المستشار' }].map(field => (
                      <div key={field.key} onClick={() => setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, [field.key]: !localViewingTasksPrintTemplate[field.key]})}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all shadow-sm ${localViewingTasksPrintTemplate[field.key] ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
                        <span className="text-[11px] font-black text-navy-900">{field.label}</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${localViewingTasksPrintTemplate[field.key] ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localViewingTasksPrintTemplate[field.key] ? 'left-0.5' : 'right-0.5'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-xs text-navy-900">أعمدة الجدول وترتيبها</h4>
                    <span className="text-[10px] text-slate-500 font-bold bg-slate-200/70 px-2 py-0.5 rounded-full">الأسهم للترتيب</span>
                  </div>
                  {localViewingTasksPrintOrder.map((key, index) => {
                    const labels = { showRoll: 'عمود الرول', showCaseNumber: 'عمود رقم الدعوى', showAppellant: 'عمود المدعي', showAppellee: 'عمود المدعى عليه', showRequiredDocs: 'عمود المستندات (إلزامي)', showSessionDate: 'عمود تاريخ الجلسة', showSessionType: 'عمود نوع الجلسة', showDecision: 'عمود القرار', showStatus: 'عمود حالة المهمة' };
                    const isDisabled = key === 'showRequiredDocs';
                    const move = (dir, e) => { e.stopPropagation(); const n=[...localViewingTasksPrintOrder]; const target=index+dir; if(target<0||target>=n.length) return; [n[target],n[index]]=[n[index],n[target]]; setLocalViewingTasksPrintOrder(n); };
                    return (
                      <div key={key} onClick={() => !isDisabled && setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, [key]: !localViewingTasksPrintTemplate[key]})}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all shadow-sm group hover:border-indigo-300 ${localViewingTasksPrintTemplate[key] ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col gap-0.5 bg-white/60 p-0.5 rounded-lg border border-slate-100 opacity-70 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={e=>move(-1,e)} disabled={index===0} className="p-0.5 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all"><ChevronUp className="w-3 h-3" /></button>
                            <button type="button" onClick={e=>move(1,e)} disabled={index===localViewingTasksPrintOrder.length-1} className="p-0.5 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all"><ChevronDown className="w-3 h-3" /></button>
                          </div>
                          <span className="text-[11px] font-black text-navy-900">{labels[key]}</span>
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${localViewingTasksPrintTemplate[key] ? 'bg-indigo-600' : 'bg-slate-300'} ${isDisabled ? 'opacity-50' : ''}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localViewingTasksPrintTemplate[key] ? 'left-0.5' : 'right-0.5'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
              <SaveBtn label="حفظ إعدادات الطباعة" />
            </div>
          )}
        </div>
      )}

      {/* ═══ ⚖️ الأحكام ═══ */}
      {activeTab === 'judgments' && (
        <div className="animate-in fade-in zoom-in duration-200">
          <SubNav active={judgmentSub} setActive={setJudgmentSub} options={[
            { id: 'lists',     label: '📝 قوائم الإدخال' },
            { id: 'rules',     label: '🤖 قواعد التعبئة' },
            { id: 'deadlines', label: '⏰ المواعيد' },
            { id: 'stats',     label: '📊 محرك الإحصائيات' },
          ]} />

          {judgmentSub === 'lists' && (
            <div className="space-y-4">
              <SectionCard title="فئات الأحكام" icon={Scale}>
                <TagList items={localJudgmentCategories} onRemove={i => setLocalJudgmentCategories(localJudgmentCategories.filter((_,idx)=>idx!==i))} onAdd={v => setLocalJudgmentCategories([...localJudgmentCategories,v])} addLabel="إضافة فئة" addPromptTitle="إضافة فئة" addPromptMsg="أدخل اسم فئة الحكم:" />
              </SectionCard>
              <SectionCard title="تصنيفات الأحكام (الإحصائية)" icon={ClipboardList}>
                <TagList items={localJudgmentClassifications} onRemove={i => setLocalJudgmentClassifications(localJudgmentClassifications.filter((_,idx)=>idx!==i))} onAdd={v => setLocalJudgmentClassifications([...localJudgmentClassifications,v])} addLabel="إضافة تصنيف" addPromptTitle="إضافة تصنيف" addPromptMsg="أدخل تصنيف الحكم (مثال: صالح، ضد):" />
              </SectionCard>
              <SectionCard title="أنواع الأحكام (المحفزات)" icon={ClipboardList}>
                <TagList items={localJudgmentTypes} onRemove={i => setLocalJudgmentTypes(localJudgmentTypes.filter((_,idx)=>idx!==i))} onAdd={v => setLocalJudgmentTypes([...localJudgmentTypes,v])} addLabel="إضافة نوع" addPromptTitle="إضافة نوع" addPromptMsg="أدخل نوع الحكم (مثال: قبول، رفض، إلغاء):" />
              </SectionCard>
              <SaveBtn label="حفظ قوائم الأحكام" />
            </div>
          )}

          {judgmentSub === 'rules' && (
            <div className="space-y-4">
              <JudgmentRulesSection
                localJudgmentDefaults={localJudgmentDefaults}
                setLocalJudgmentDefaults={setLocalJudgmentDefaults}
                localRoles={localRoles}
                localJudgmentCategories={localJudgmentCategories}
                localJudgmentClassifications={localJudgmentClassifications}
                localJudgmentTypes={localJudgmentTypes}
                localSessionTypes={localSessionTypes}
                localDecisions={localDecisions}
              />
              <SaveBtn label="حفظ قواعد التعبئة" />
            </div>
          )}

          {judgmentSub === 'deadlines' && (
            <SettingsDeadlinesSection
              localDeadlineRules={localDeadlineRules}
              setLocalDeadlineRules={setLocalDeadlineRules}
              handleSaveSettings={handleSaveSettings}
              isProcessing={isProcessing}
            />
          )}

          {judgmentSub === 'stats' && (
            <div className="space-y-4">
              <SectionCard title="محرك ربط الإحصائيات" icon={Activity}>
                <SettingsStatsMappingSection mapping={localStatsMapping} setMapping={setLocalStatsMapping} />
              </SectionCard>
              <SaveBtn label="حفظ محرك الإحصائيات" />
            </div>
          )}
        </div>
      )}

      {/* ═══ 📋 الجلسات والدعاوى ═══ */}
      {activeTab === 'sessions' && (
        <div className="animate-in fade-in zoom-in duration-200">
          <SubNav active={sessionSub} setActive={setSessionSub} options={[
            { id: 'roles',      label: '👤 الصفات' },
            { id: 'types',      label: '📅 أنواع الجلسات' },
            { id: 'decisions',  label: '🗒️ القرارات' },
            { id: 'rolls',      label: '📄 الرولات' },
            { id: 'procedures', label: '✅ الإجراءات' },
            { id: 'casecls',    label: '🏷️ التصنيفات' },
          ]} />

          {sessionSub === 'roles' && (
            <div className="space-y-4">
              <SectionCard title="صفات الأطراف (طاعن / مطعون ضدنا / إلخ)" icon={SettingsIcon}>
                <TagList items={localRoles} onRemove={i => setLocalRoles(localRoles.filter((_,idx)=>idx!==i))} onAdd={v => setLocalRoles([...localRoles,v])} addLabel="إضافة صفة" addPromptTitle="إضافة صفة" addPromptMsg="أدخل مسمى الصفة الجديد:" color="rose" />
              </SectionCard>
              <SaveBtn label="حفظ الصفات" />
            </div>
          )}

          {sessionSub === 'types' && (
            <div className="space-y-4">
              <SectionCard title="أنواع الجلسات (فحص / موضوع / مفوضين)" icon={SettingsIcon}>
                <TagList items={localSessionTypes} onRemove={i => setLocalSessionTypes(localSessionTypes.filter((_,idx)=>idx!==i))} onAdd={v => setLocalSessionTypes([...localSessionTypes,v])} addLabel="إضافة نوع" addPromptTitle="إضافة نوع جلسة" addPromptMsg="أدخل اسم نوع الجلسة الجديد:" color="emerald" />
              </SectionCard>
              <SaveBtn label="حفظ أنواع الجلسات" />
            </div>
          )}

          {sessionSub === 'decisions' && (
            <div className="space-y-4">
              <SectionCard title="القرارات الافتراضية" icon={SettingsIcon}>
                <TagList items={localDecisions} onRemove={i => setLocalDecisions(localDecisions.filter((_,idx)=>idx!==i))} onAdd={v => setLocalDecisions([...localDecisions,v])} addLabel="إضافة قرار" addPromptTitle="إضافة قرار" addPromptMsg="أدخل القرار الجديد:" />
              </SectionCard>
              <SaveBtn label="حفظ القرارات" />
            </div>
          )}

          {sessionSub === 'rolls' && (
            <div className="space-y-4">
              <SectionCard title="أنواع الرولات (رول جلسة / حصر الفحص)" icon={BookOpen}>
                <TagList items={localRollTypes} onRemove={i => setLocalRollTypes(localRollTypes.filter((_,idx)=>idx!==i))} onAdd={v => setLocalRollTypes([...localRollTypes,v])} addLabel="إضافة نوع رول" addPromptTitle="إضافة نوع رول" addPromptMsg="أدخل اسم نوع الرول الجديد:" />
              </SectionCard>
              <SaveBtn label="حفظ الرولات" />
            </div>
          )}

          {sessionSub === 'procedures' && (
            <div className="space-y-4">
              <SectionCard title="الإجراءات الشائعة (سجل الإجراءات)" icon={ClipboardList}>
                <TagList items={localCommonProcedures} onRemove={i => setLocalCommonProcedures(localCommonProcedures.filter((_,idx)=>idx!==i))} onAdd={v => setLocalCommonProcedures([...localCommonProcedures,v])} addLabel="إضافة إجراء" addPromptTitle="إضافة إجراء شائع" addPromptMsg="أدخل اسم الإجراء الجديد:" />
              </SectionCard>
              <SaveBtn label="حفظ الإجراءات" />
            </div>
          )}

          {sessionSub === 'casecls' && (
            <div className="space-y-4">
              <SectionCard title="تصنيفات الدعاوى (تسويات / بدلات / إلخ)" icon={BookOpen}>
                <TagList items={localCaseClassifications} onRemove={i => setLocalCaseClassifications(localCaseClassifications.filter((_,idx)=>idx!==i))} onAdd={v => setLocalCaseClassifications([...localCaseClassifications,v])} addLabel="إضافة تصنيف" addPromptTitle="إضافة تصنيف" addPromptMsg="أدخل تصنيف الدعوى الجديد:" />
              </SectionCard>
              <SectionCard title="مواقع ملفات القضايا (شعبة الحفظ / أصلي)" icon={SettingsIcon}>
                <TagList items={localFileLocations} onRemove={i => setLocalFileLocations(localFileLocations.filter((_,idx)=>idx!==i))} onAdd={v => setLocalFileLocations([...localFileLocations,v])} addLabel="إضافة مكان" addPromptTitle="إضافة مكان الملف" addPromptMsg="أدخل مسمى مكان الملف الجديد:" color="amber" />
              </SectionCard>
              <SaveBtn label="حفظ التصنيفات والمواقع" />
            </div>
          )}
        </div>
      )}

      {/* ═══ 🔧 البيانات والنظام ═══ */}
      {activeTab === 'advanced' && (
        <div className="animate-in fade-in zoom-in duration-200">
          <SubNav active={advancedSub} setActive={setAdvancedSub} options={[
            { id: 'schema', label: '🧩 هيكلة الحقول' },
            { id: 'data',   label: '🛡️ بيانات ونسخ' },
            { id: 'users',  label: '👥 المستخدمون' },
          ]} />

          {advancedSub === 'schema' && (
            <div className="space-y-4">
              <SectionCard title="إدارة الحقول (Dynamic Schema)" icon={LayoutTemplate}>
                <p className="text-[11px] font-bold text-slate-500 leading-relaxed">يمكنك من هنا تخصيص الحقول التي تظهر في استمارة القضية دون الحاجة لمبرمج. المعرّف (ID) هو اسم العمود في ملف الإكسيل.</p>
                <div className="flex justify-end">
                  <button onClick={addSchemaField} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-200">
                    <Plus className="w-4 h-4" /> إضافة حقل
                  </button>
                </div>
                <div className="space-y-3">
                  {localSchema.map((field, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start sm:items-center">
                      <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div><label className="text-[9px] text-slate-500 font-bold block mb-1">اسم العرض</label><input type="text" value={field.label} onChange={e => updateSchemaField(index,'label',e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300" /></div>
                        <div><label className="text-[9px] text-slate-500 font-bold block mb-1">المعرف (الإكسيل)</label><input type="text" value={field.id} onChange={e => updateSchemaField(index,'id',e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 bg-slate-100" /></div>
                        <div><label className="text-[9px] text-slate-500 font-bold block mb-1">النوع</label><select value={field.type} onChange={e => updateSchemaField(index,'type',e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300"><option value="text">نص</option><option value="number">رقم</option><option value="textarea">نص طويل</option><option value="date">تاريخ</option></select></div>
                        <div className="flex items-center gap-2 pt-5"><label className="flex items-center gap-1 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={field.visible} onChange={e => updateSchemaField(index,'visible',e.target.checked)} /> مرئي</label></div>
                      </div>
                      <button onClick={() => removeSchemaField(index)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition self-end sm:self-auto mt-2 sm:mt-0"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button onClick={saveSchema} disabled={isProcessing} className="flex-[2] bg-navy-900 text-amber-300 font-bold py-3 rounded-xl text-sm">{isProcessing ? 'جاري الحفظ...' : '💾 حفظ هيكلة الحقول'}</button>
                  <button onClick={handleCleanupSchema} disabled={isProcessing} className="flex-1 bg-amber-100 text-amber-700 font-bold py-3 rounded-xl text-sm border border-amber-200 hover:bg-amber-200">تنظيف المكررات</button>
                </div>
              </SectionCard>
            </div>
          )}

          {advancedSub === 'data'  && <SettingsDataTab />}
          {advancedSub === 'users' && <SettingsUsersTab />}
        </div>
      )}

    </div>
  );
}

