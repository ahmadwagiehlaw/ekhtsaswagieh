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
  const [activeTab, setActiveTab] = useState('other'); // judgments, lists, schema, other, data
  
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

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6">

      {/* Admin Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-black text-navy-900">لوحة الإدارة</h2>
          </div>
        </div>
        <button onClick={logoutAdmin} className="text-[10px] font-black bg-rose-50 text-rose-600 px-3 py-2 rounded-xl flex items-center gap-1.5">
          <LogOut className="w-3 h-3" /> تسجيل خروج
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/50 p-1 rounded-xl flex-wrap">
        <button onClick={() => setActiveTab('other')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'other' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>⚙️ عام</button>
        <button onClick={() => setActiveTab('judgments')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'judgments' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>⚖️ الجلسات والأحكام</button>
        <button onClick={() => setActiveTab('lists')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'lists' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>📁 قوائم النظام</button>
        <button onClick={() => setActiveTab('stats')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'stats' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>📊 محرك الإحصائيات</button>
        <button onClick={() => setActiveTab('schema')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'schema' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>🧩 هيكلة الحقول</button>
        <button onClick={() => setActiveTab('data')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'data' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>🛡️ بيانات ونسخ</button>
        <button onClick={() => setActiveTab('print')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'print' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>🖨️ الطباعة</button>
        <button onClick={() => setActiveTab('users')} className={`flex-1 min-w-[80px] text-[11px] sm:text-xs font-bold py-2 rounded-lg transition ${activeTab === 'users' ? 'bg-white shadow text-navy-900' : 'text-slate-500'}`}>👥 المستخدمون</button>
      </div>

      {/* PRINT TAB */}
      {activeTab === 'print' && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
          <details className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-0" open>
            <summary className="flex items-center justify-between pb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-slate-100 transition-colors">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-navy-900" />
                <h3 className="font-black text-sm text-navy-900">نموذج كشف مهام الإطلاع</h3>
              </div>
              <ArrowDownUp className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="pt-4 space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-500 block mb-1">عنوان الكشف الافتراضي</label>
                <input
                  type="text"
                  value={localViewingTasksPrintTemplate.title}
                  onChange={(e) => setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, title: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-xs text-navy-900 mb-3">بيانات الكشف الأساسية</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'showCreationDate', label: 'إظهار تاريخ التحرير' },
                      { key: 'showConsultant', label: 'إظهار اسم المستشار / توقيع الموظف' }
                    ].map(field => (
                      <div key={field.key} className={`flex items-center justify-between p-3 rounded-xl border ${localViewingTasksPrintTemplate[field.key] ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'} transition-all cursor-pointer shadow-sm`} onClick={() => setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, [field.key]: !localViewingTasksPrintTemplate[field.key]})}>
                        <span className="text-[11px] font-black text-navy-900">{field.label}</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${localViewingTasksPrintTemplate[field.key] ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localViewingTasksPrintTemplate[field.key] ? 'left-0.5' : 'right-0.5'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-xs text-navy-900">أعمدة الجدول وترتيبها</h4>
                    <span className="text-[10px] text-slate-500 font-bold bg-slate-200/70 px-2 py-0.5 rounded-full">استخدم الأسهم للترتيب</span>
                  </div>
                  <div className="space-y-2">
                    {localViewingTasksPrintOrder.map((key, index) => {
                      const fieldLabels = {
                        showRoll: 'عمود الرول',
                        showCaseNumber: 'عمود رقم الدعوى',
                        showAppellant: 'عمود المدعي',
                        showAppellee: 'عمود المدعى عليه',
                        showRequiredDocs: 'عمود المستندات المطلوبة (الملاحظات)',
                        showSessionDate: 'عمود تاريخ الجلسة',
                        showSessionType: 'عمود نوع الجلسة',
                        showDecision: 'عمود القرار',
                        showStatus: 'عمود حالة المهمة'
                      };
                      const label = fieldLabels[key];
                      const isDisabled = key === 'showRequiredDocs';

                      const moveUp = (e) => {
                        e.stopPropagation();
                        if (index === 0) return;
                        const newOrder = [...localViewingTasksPrintOrder];
                        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                        setLocalViewingTasksPrintOrder(newOrder);
                      };

                      const moveDown = (e) => {
                        e.stopPropagation();
                        if (index === localViewingTasksPrintOrder.length - 1) return;
                        const newOrder = [...localViewingTasksPrintOrder];
                        [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
                        setLocalViewingTasksPrintOrder(newOrder);
                      };

                      return (
                        <div key={key} className={`flex items-center justify-between p-3 rounded-xl border ${localViewingTasksPrintTemplate[key] ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'} transition-all cursor-pointer shadow-sm group hover:border-indigo-300`} onClick={() => !isDisabled && setLocalViewingTasksPrintTemplate({...localViewingTasksPrintTemplate, [key]: !localViewingTasksPrintTemplate[key]})}>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-0.5 z-10 bg-white/60 p-0.5 rounded-lg border border-slate-100 opacity-70 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={moveUp} disabled={index === 0} className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all">
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button type="button" onClick={moveDown} disabled={index === localViewingTasksPrintOrder.length - 1} className="p-0.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all">
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[11px] font-black text-navy-900">{label} {isDisabled ? <span className="text-red-500 mr-1">(إلزامي ولا يمكن إخفاءه)</span> : ''}</span>
                          </div>
                          <div className={`w-8 h-4 rounded-full relative transition-colors ${localViewingTasksPrintTemplate[key] ? 'bg-indigo-600' : 'bg-slate-300'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localViewingTasksPrintTemplate[key] ? 'left-0.5' : 'right-0.5'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </details>

          <div className="pt-2">
            <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm hover:bg-navy-800 transition disabled:opacity-50">
              {isProcessing ? 'جاري الحفظ...' : 'حفظ الإعدادات الأساسية والطباعة'}
            </button>
          </div>
        </div>
      )}

      {/* DATA TAB */}
      {activeTab === 'data' && <SettingsDataTab />}

      {/* USERS TAB */}
      {activeTab === 'users' && <SettingsUsersTab />}

      {/* SYSTEM/OTHER TAB */}
      {activeTab === 'other' && <SettingsSystemTab />}

      {/* DEADLINES TAB CONTENT WAS MOVED TO JUDGMENTS */}

      {/* STATS MAPPING TAB */}
      {activeTab === 'stats' && (
        <div className="space-y-5 animate-in fade-in zoom-in duration-300">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-base">📊</span>
              </div>
              <div>
                <h3 className="font-black text-sm text-navy-900">محرك ربط الإحصائيات</h3>
                <p className="text-[10px] font-bold text-slate-500">تحكم كامل في كيفية حساب كل تصنيف حكم في لوحة القيادة</p>
              </div>
            </div>
            <SettingsStatsMappingSection mapping={localStatsMapping} setMapping={setLocalStatsMapping} />
          </div>
          <div className="pt-2">
            <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm hover:bg-navy-800 transition disabled:opacity-50">
              {isProcessing ? 'جاري الحفظ...' : '💾 حفظ إعدادات محرك الإحصائيات'}
            </button>
          </div>
        </div>
      )}



      {/* SCHEMA TAB */}
      {activeTab === 'schema' && (
        <details className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-0 animate-in fade-in zoom-in duration-300">
          <summary className="flex items-center justify-between pb-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden border-b border-transparent group-open:border-slate-100 transition-colors">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-navy-900" />
              <h3 className="font-black text-sm text-navy-900"><span className="text-[12px] opacity-70 group-open:hidden ml-1">▼</span><span className="text-[12px] opacity-70 hidden group-open:inline ml-1">▲</span> إدارة الحقول (Dynamic Schema)</h3>
            </div>
            <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}><button onClick={addSchemaField} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-amber-200">
              <Plus className="w-4 h-4" /> إضافة حقل
            </button></div></summary>
          <div className="pt-2 space-y-4">

            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
              يمكنك من هنا تخصيص الحقول التي تظهر في استمارة القضية دون الحاجة لمبرمج.
              المعرّف (ID) هو اسم العمود في ملف الإكسيل.
            </p>

            <div className="space-y-3">
              {localSchema.map((field, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start sm:items-center">
                  <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">اسم العرض</label>
                      <input type="text" value={field.label} onChange={e => updateSchemaField(index, 'label', e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300" />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">المعرف (طابق الإكسيل)</label>
                      <input type="text" value={field.id} onChange={e => updateSchemaField(index, 'id', e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 bg-slate-100" />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 font-bold block mb-1">النوع</label>
                      <select value={field.type} onChange={e => updateSchemaField(index, 'type', e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300">
                        <option value="text">نص</option>
                        <option value="number">رقم</option>
                        <option value="textarea">نص طويل</option>
                        <option value="date">تاريخ</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                        <input type="checkbox" checked={field.visible} onChange={e => updateSchemaField(index, 'visible', e.target.checked)} />
                        مرئي
                      </label>
                    </div>
                  </div>
                  <button onClick={() => removeSchemaField(index)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition self-end sm:self-auto mt-2 sm:mt-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex gap-2">
              <button onClick={saveSchema} disabled={isProcessing} className="flex-[2] bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
                {isProcessing ? 'جاري الحفظ...' : 'حفظ هيكلة الحقول'}
              </button>
              <button onClick={handleCleanupSchema} disabled={isProcessing} className="flex-1 bg-amber-100 text-amber-700 font-bold py-3 rounded-xl shadow-sm text-sm border border-amber-200 hover:bg-amber-200">
                تنظيف الحقول المكررة
              </button>
            </div>

          </div>
        </details>
      )}

      {/* LISTS TAB */}
      {activeTab === 'lists' && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
          {/* Core Field Options Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <SettingsIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة خيارات الحقول الجوهرية</h3>
            </div>

            {/* Roles choice */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-500">خيارات حقل الصفة (طاعن / مطعون ضدنا / إلخ):</h4>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                {localRoles.map((role, i) => (
                  <div key={i} className="flex items-center gap-1 bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <span>{role}</span>
                    <button onClick={() => setLocalRoles(localRoles.filter((_, idx) => idx !== i))} className="text-rose-450 hover:text-rose-600 mr-2">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={async () => {
                    const newRole = await showPrompt('إضافة صفة', 'أدخل مسمى الصفة الجديد:');
                    if (newRole?.trim()) setLocalRoles([...localRoles, newRole.trim()]);
                  }}
                  className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm"
                >
                  <Plus className="w-3 h-3" /> إضافة صفة
                </button>
              </div>
            </div>

            {/* Session Types choice */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-500">إضافة نوع جلسة مخصص (فحص / موضوع / مفوضين / مرافعة):</h4>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                {localSessionTypes.map((type, i) => (
                  <div key={i} className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <span>{type}</span>
                    <button onClick={() => setLocalSessionTypes(localSessionTypes.filter((_, idx) => idx !== i))} className="text-emerald-450 hover:text-emerald-600 mr-2">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={async () => {
                    const newType = await showPrompt('إضافة نوع جلسة', 'أدخل اسم نوع الجلسة الجديد:');
                    if (newType?.trim()) setLocalSessionTypes([...localSessionTypes, newType.trim()]);
                  }}
                  className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm"
                >
                  <Plus className="w-3 h-3" /> إضافة نوع
                </button>
              </div>
            </div>

            {/* File Locations choice */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-500">خيارات حقل مكان الملف (شعبة الحفظ / أصلي / إلخ):</h4>
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60">
                {localFileLocations.map((loc, i) => (
                  <div key={i} className="flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                    <span>{loc}</span>
                    <button onClick={() => setLocalFileLocations(localFileLocations.filter((_, idx) => idx !== i))} className="text-amber-450 hover:text-amber-600 mr-2">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={async () => {
                    const newLoc = await showPrompt('إضافة مكان الملف', 'أدخل مسمى مكان الملف الجديد:');
                    if (newLoc?.trim()) setLocalFileLocations([...localFileLocations, newLoc.trim()]);
                  }}
                  className="flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm"
                >
                  <Plus className="w-3 h-3" /> إضافة مكان
                </button>
              </div>
            </div>
          </div>

          {/* Common Procedures Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة خيارات الإجراءات الشائعة (سجل الإجراءات)</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localCommonProcedures.map((proc, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{proc}</span>
                  <button onClick={() => setLocalCommonProcedures(localCommonProcedures.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newProc = await showPrompt('إضافة إجراء شائع', 'أدخل اسم الإجراء الجديد:');
                  if (newProc?.trim()) setLocalCommonProcedures([...localCommonProcedures, newProc.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة إجراء
              </button>
            </div>
          </div>

          {/* Case Classifications Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة تصنيفات الدعوى</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localCaseClassifications.map((cls, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{cls}</span>
                  <button onClick={() => setLocalCaseClassifications(localCaseClassifications.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newCls = await showPrompt('إضافة تصنيف', 'أدخل تصنيف الدعوى الجديد:');
                  if (newCls?.trim()) setLocalCaseClassifications([...localCaseClassifications, newCls.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة تصنيف
              </button>
            </div>
          </div>

          {/* Save Settings Button */}
          <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
            {isProcessing ? 'جاري الحفظ...' : 'حفظ الإعدادات المتقدمة'}
          </button>
        </div>
      )}

      {/* JUDGMENTS TAB */}
      {activeTab === 'judgments' && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
          <SettingsDeadlinesSection 
            localDeadlineRules={localDeadlineRules}
            setLocalDeadlineRules={setLocalDeadlineRules}
            handleSaveSettings={handleSaveSettings}
            isProcessing={isProcessing}
          />
          {/* Default Judgment Settings Management */}
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
          {/* Decisions Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <SettingsIcon className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة القرارات الافتراضية</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localDecisions.map((dec, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{dec}</span>
                  <button onClick={() => setLocalDecisions(localDecisions.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newDec = await showPrompt('إضافة قرار', 'أدخل القرار الجديد:');
                  if (newDec?.trim()) setLocalDecisions([...localDecisions, newDec.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة قرار
              </button>
            </div>
          </div>

          {/* Roll Types Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة أنواع رولات الجلسات</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localRollTypes.map((type, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{type}</span>
                  <button onClick={() => setLocalRollTypes(localRollTypes.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newType = await showPrompt('إضافة نوع رول', 'أدخل اسم نوع الرول الجديد:');
                  if (newType?.trim()) setLocalRollTypes([...localRollTypes, newType.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة نوع
              </button>
            </div>
          </div>

          {/* Judgment Categories Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Scale className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة فئات الأحكام</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localJudgmentCategories.map((cat, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{cat}</span>
                  <button onClick={() => setLocalJudgmentCategories(localJudgmentCategories.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newCat = await showPrompt('إضافة فئة', 'أدخل اسم فئة الحكم الجديدة (مثال: شق عاجل، نهائي):');
                  if (newCat?.trim()) setLocalJudgmentCategories([...localJudgmentCategories, newCat.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة فئة
              </button>
            </div>
          </div>

          {/* Judgment Classifications Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة تصنيفات الأحكام</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localJudgmentClassifications.map((cls, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{cls}</span>
                  <button onClick={() => setLocalJudgmentClassifications(localJudgmentClassifications.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newCls = await showPrompt('إضافة تصنيف', 'أدخل تصنيف الحكم الجديد (مثال: صالح، ضد):');
                  if (newCls?.trim()) setLocalJudgmentClassifications([...localJudgmentClassifications, newCls.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة تصنيف
              </button>
            </div>
          </div>

          {/* Judgment Types Management */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-sm text-navy-900">إدارة أنواع الأحكام</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {localJudgmentTypes.map((type, i) => (
                <div key={i} className="flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
                  <span>{type}</span>
                  <button onClick={() => setLocalJudgmentTypes(localJudgmentTypes.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500 mr-2">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  const newType = await showPrompt('إضافة نوع', 'أدخل نوع الحكم الجديد (مثال: قبول، رفض، إلغاء):');
                  if (newType?.trim()) setLocalJudgmentTypes([...localJudgmentTypes, newType.trim()]);
                }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200"
              >
                <Plus className="w-3 h-3" /> إضافة نوع
              </button>
            </div>
          </div>


          {/* Save Settings Button */}
          <button onClick={handleSaveSettings} disabled={isProcessing} className="w-full bg-navy-900 text-amber-300 font-bold py-3 rounded-xl shadow-sm text-sm">
            {isProcessing ? 'جاري الحفظ...' : 'حفظ الإعدادات المتقدمة'}
          </button>
        </div>
      )}

    </div>
  );
}
