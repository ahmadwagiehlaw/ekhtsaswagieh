import React from 'react';
import { CalendarPlus, Scale, MessageSquare, X, FileText, Paperclip, Loader2, BookOpen, Save, Edit3, Trash2, Settings } from 'lucide-react';
import { formatDateString } from '../../utils/dateUtils';
import { applyJudgmentDefaultRules } from '../../utils/judgmentRulesEngine';
import JudgmentRulesModal from '../JudgmentRulesModal';

export default function SessionsTab({
  caseData,
  canEditData,
  settings,
  rolls,
  sessionTypeOptions,
  setIsAddSessionOpen,
  fileInputRef,
  handleSessionFileUpload,
  editingSessionIdx,
  setEditingSessionIdx,
  editSessionData,
  setEditSessionData,
  activeSessionIdx,
  setActiveSessionIdx,
  isUploadingSessionFile,
  activeJudgmentSessionIdx,
  setActiveJudgmentSessionIdx,
  activeNoteSessionIdx,
  setActiveNoteSessionIdx,
  handleSaveSessionEdit,
  openRollViewer,
  saveCaseToFirebase,
  showConfirm,
  toast,
  showPrompt
}) {
  const [isRulesOpen, setIsRulesOpen] = React.useState(false);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <JudgmentRulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <CalendarPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-lg text-navy-900">سجل الجلسات</h2>
            <p className="text-[11px] text-slate-500 font-bold">تتابع الجلسات والقرارات</p>
          </div>
        </div>
        {canEditData && (
          <button
            onClick={() => setIsAddSessionOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <CalendarPlus className="w-4 h-4" /> إضافة جلسة
          </button>
        )}
      </div>

      <div className="pt-2">
        {(!caseData.sessions || caseData.sessions.length === 0) ? (
          <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
            <p className="text-xs font-bold text-slate-500">لا يوجد سجل جلسات مضاف يدوياً لهذه القضية.</p>
          </div>
        ) : (
          <div className="relative border-r-2 border-slate-200 space-y-6 pr-4 mr-2">
            {/* Hidden file input for sessions */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,.pdf"
              onChange={handleSessionFileUpload}
            />
            {caseData.sessions.map((session, idx) => (
              <div key={session.id || idx} className="relative">
                <div className="absolute -right-[23px] top-3 w-4 h-4 rounded-full bg-white border-2 border-amber-500 z-10"></div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 shadow-sm relative mr-2 transition hover:shadow-md flex flex-col gap-2">

                  <div className="flex items-center gap-2 w-full flex-wrap justify-between">
                    {/* Right side (Fields) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {editingSessionIdx === idx ? (
                        <>
                          {/* Roll Edit */}
                          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                            <span className="text-[10px] font-black text-slate-500">رول:</span>
                            <input
                              type="text"
                              value={editSessionData.roll ?? session.roll ?? ''}
                              onChange={(e) => setEditSessionData({ ...editSessionData, roll: e.target.value })}
                              className="w-8 text-[10px] font-black text-indigo-700 bg-transparent text-center focus:outline-none"
                            />
                          </div>

                          {/* Date Edit */}
                          <input
                            type="date"
                            value={editSessionData.date ?? session.date ?? ''}
                            onChange={(e) => setEditSessionData({ ...editSessionData, date: e.target.value })}
                            className="text-[10px] font-black text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 w-[110px] text-center focus:outline-none focus:border-amber-400"
                          />

                          {/* Type Edit */}
                          <select
                            value={editSessionData.type ?? session.type ?? sessionTypeOptions[0]}
                            onChange={(e) => setEditSessionData({ ...editSessionData, type: e.target.value })}
                            className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 focus:outline-none focus:border-emerald-400"
                          >
                            <option value="فحص">فحص</option>
                            <option value="موضوع">موضوع</option>
                          </select>

                          {/* Decision Edit */}
                          <input
                            list="decisions-list"
                            value={editSessionData.decision ?? session.decision ?? ''}
                            onChange={(e) => setEditSessionData({ ...editSessionData, decision: e.target.value })}
                            placeholder="القرار..."
                            className="text-xs font-black text-navy-900 bg-white px-3 py-1 rounded-md border border-slate-200 w-[120px] focus:outline-none focus:border-amber-400"
                          />
                        </>
                      ) : (
                        <>
                          {/* Roll View */}
                          {session.roll && (
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-slate-200">
                              <span className="text-[10px] font-black text-slate-500">رول:</span>
                              <span className="text-[10px] font-black text-indigo-700">{session.roll}</span>
                            </div>
                          )}

                          {/* Date View */}
                          <div className="text-[11px] font-black text-slate-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 flex items-center gap-2">
                            <CalendarPlus className="w-3.5 h-3.5 text-slate-400" />
                            {formatDateString(session.date)}
                          </div>

                          {/* Type View */}
                          <div className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-md border border-emerald-200">
                            {session.type || sessionTypeOptions[0]}
                          </div>

                          {/* Decision View */}
                          {session.decision && (
                            <div className="text-xs font-black text-navy-900 bg-white px-3 py-1.5 rounded-md border border-slate-200 max-w-[200px] truncate" title={session.decision}>
                              {session.decision}
                            </div>
                          )}

                          {/* Judgment Badge View */}
                          {session.hasJudgment && (session.judgment || session.shortJudgment) && (
                            <div className={`text-[10px] font-black px-2 py-1.5 rounded-md border flex items-center gap-1 ${(() => {
                                const res = (session.judgment && session.judgment.result) || session.judgmentClassification;
                                const rc = res === 'صالح' ? 'emerald' : res === 'ضد' ? 'rose' : res === 'مختلط' ? 'indigo' : res === 'اعتبار' ? 'amber' : (res === 'وقف جزائي' || res === 'غير منه للخصومة') ? 'orange' : res === 'وقف تعليقي' ? 'purple' : res === 'خبراء' ? 'cyan' : res === 'حكم منه للخصومة' ? 'amber' : res === 'تمهيدي' ? 'indigo' : 'slate';
                                return `bg-${rc}-50 text-${rc}-700 border-${rc}-200`;
                              })()
                              }`}>
                              <Scale className="w-3 h-3" />
                              {(session.judgment && session.judgment.type) || session.shortJudgment} {((session.judgment && session.judgment.result) || session.judgmentClassification) ? `- ${(session.judgment && session.judgment.result) || session.judgmentClassification}` : ''}
                            </div>
                          )}

                          {/* Notes Bubble */}
                          <div className="relative">
                            <button
                              onClick={() => setActiveNoteSessionIdx(activeNoteSessionIdx === idx ? null : idx)}
                              className={`p-1.5 rounded-md border transition flex items-center justify-center shadow-sm ${session.notes ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                              title={session.notes ? "استعراض/تعديل الملاحظات" : "إضافة ملاحظة"}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>

                            {activeNoteSessionIdx === idx && (
                              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-[100]">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-black text-slate-500">ملاحظات الجلسة</span>
                                  <button onClick={() => setActiveNoteSessionIdx(null)} className="text-slate-400 hover:text-rose-500 transition"><X className="w-3 h-3" /></button>
                                </div>
                                <textarea
                                  autoFocus
                                  defaultValue={session.notes || ''}
                                  placeholder="اكتب ملاحظاتك هنا..."
                                  className="w-full text-xs font-bold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-amber-400 min-h-[80px]"
                                  onBlur={async (e) => {
                                    if (e.target.value !== (session.notes || '')) {
                                      const newSessions = [...caseData.sessions];
                                      newSessions[idx] = { ...newSessions[idx], notes: e.target.value };
                                      await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Left side (Actions) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Attachment Indicator */}
                      {session.attachmentUrl && (
                        <a href={session.attachmentUrl} target="_blank" rel="noreferrer" className="bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 p-1 rounded transition flex items-center justify-center h-7 w-7 shadow-sm" title="عرض المرفق">
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {/* Attach Button */}
                      <button
                        onClick={() => { setActiveSessionIdx(idx); fileInputRef.current?.click(); }}
                        disabled={isUploadingSessionFile && activeSessionIdx === idx}
                        className="bg-slate-100 border border-slate-200 text-slate-500 hover:text-navy-900 hover:bg-slate-200 p-1 rounded transition flex items-center justify-center h-7 w-7 shadow-sm disabled:opacity-50"
                        title="إضافة مرفق للملف (صورة أو PDF)"
                      >
                        {(isUploadingSessionFile && activeSessionIdx === idx) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                      </button>

                      {/* Judgment Toggle */}
                      <button
                        onClick={() => {
                          setActiveJudgmentSessionIdx(activeJudgmentSessionIdx === idx ? null : idx);
                        }}
                        className={`p-1.5 rounded-md border transition flex items-center justify-center h-7 w-7 shadow-sm ${session.hasJudgment ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-navy-900'}`}
                        title={session.hasJudgment ? "استعراض/تعديل الحكم" : "إضافة حكم"}
                      >
                        <Scale className="w-3.5 h-3.5" />
                      </button>

                      {/* Matching rolls */}
                      {(() => {
                        const matchingRolls = rolls.filter(r => r.date === session.date);
                        if (matchingRolls.length === 0) return null;
                        return (
                          <button
                            onClick={() => openRollViewer(session.date)}
                            className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 shadow-sm h-7"
                            title="عرض الرول"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                        );
                      })()}

                      {/* Edit/Save Actions */}
                      {canEditData && editingSessionIdx === idx ? (
                        <>
                          <button
                            onClick={() => handleSaveSessionEdit(idx)}
                            className="text-white hover:bg-emerald-600 bg-emerald-500 transition p-1 rounded h-7 w-7 flex items-center justify-center shadow-sm"
                            title="حفظ"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setEditingSessionIdx(null); setEditSessionData({}); }}
                            className="text-slate-500 hover:text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition p-1 rounded h-7 w-7 flex items-center justify-center shadow-sm"
                            title="إلغاء"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        canEditData && (
                          <button
                            onClick={() => { setEditingSessionIdx(idx); setEditSessionData({ ...session }); }}
                            className="text-slate-400 hover:text-amber-600 hover:bg-amber-50 bg-white border border-transparent hover:border-amber-100 transition p-1 rounded h-7 w-7 flex items-center justify-center"
                            title="تعديل الجلسة"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )
                      )}

                      {/* Trash Icon */}
                      {canEditData && editingSessionIdx !== idx && (
                        <button
                          onClick={async () => {
                            const confirmed = await showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذه الجلسة؟', 'delete_session');
                            if (confirmed) {
                              const newSessions = [...caseData.sessions];
                              newSessions.splice(idx, 1);
                              await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                              toast("تم حذف الجلسة", "info");
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 bg-white border border-transparent hover:border-rose-100 transition p-1 rounded h-7 w-7 flex items-center justify-center"
                          title="حذف الجلسة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Judgment Fields Block */}
                  {(session.hasJudgment ? activeJudgmentSessionIdx !== idx : activeJudgmentSessionIdx === idx) && (() => {
                    const resColorMap = { 'صالح': 'emerald', 'ضد': 'rose', 'مختلط': 'indigo', 'اعتبار': 'amber', 'وقف جزائي': 'orange', 'وقف تعليقي': 'purple', 'خبراء': 'cyan', 'حكم منه للخصومة': 'amber', 'غير منه للخصومة': 'orange', 'تمهيدي': 'indigo' };
                    const j = session.judgment || {};

                    const JudgmentEditor = () => {
                      const initialCat = j.category || j._category || (session.decision?.includes(sessionTypeOptions[0]) ? sessionTypeOptions[0] : '');
                      const initialRes = j.result || j._result || session.judgmentClassification || '';
                      const initialType = j.type || j._type || session.shortJudgment || '';
                      const initialVerd = j.fullVerdict || j._verdict || session.verdict || '';

                      const [cat, setCat] = React.useState(initialCat);
                      const [res, setRes] = React.useState(initialRes);
                      const [type, setType] = React.useState(initialType);
                      const [verd, setVerd] = React.useState(initialVerd);
                      const [isEditing, setIsEditing] = React.useState(!session.hasJudgment);

                      const [lastAutoFilledText, setLastAutoFilledText] = React.useState('');

                      const calculateCategory = (currentRes) => {
                        if (session.type === 'موضوع' && ['صالح', 'ضد', 'مختلط'].includes(currentRes)) return 'حكم نهائي';
                        if (session.type === 'فحص' && (session.decision || '').includes('للحكم')) return 'قرار فحص';
                        if (currentRes && !['صالح', 'ضد', 'مختلط'].includes(currentRes)) return 'حكم إجرائي';
                        return '';
                      };

                      const applyRules = (changedField, newValue, currentCat, currentRes, currentType) => {
                        if (!settings?.judgmentDefaults?.length) return;
                        
                        const engineInput = {
                           role: String(caseData['الصفة'] || caseData['صفة'] || '').trim(),
                           category: changedField === 'category' ? newValue : currentCat,
                           classification: changedField === 'classification' ? newValue : currentRes,
                           type: changedField === 'type' ? newValue : currentType,
                           sessionType: session.type,
                           decision: session.decision,
                                                      text: verd // passing current text if needed
                        };
                        
                        const engineOutput = applyJudgmentDefaultRules(engineInput, settings.judgmentDefaults);
                        
                        let newCat = engineOutput.category;
                        if (newCat && newCat !== engineInput.category) {
                           setCat(newCat);
                        }
                        
                        let newRes = engineOutput.classification;
                        if (newRes && newRes !== engineInput.classification) {
                           setRes(newRes);
                           if (!newCat) {
                             const fallbackCat = getFallbackCategory(newRes);
                             if (fallbackCat) setCat(fallbackCat);
                           }
                        }
                        
                        if (engineOutput.type && engineOutput.type !== engineInput.type) {
                           setType(engineOutput.type);
                        }
                        
                        if (engineOutput.text && engineOutput.text !== engineInput.text) {
                           setVerd(engineOutput.text);
                        }
                      };

                      const handleTypeChange = (newType) => {
                        setType(newType);
                        applyRules('type', newType, cat, res, newType);
                      };

                      const handleCatChange = (newCat) => {
                        setCat(newCat);
                        applyRules('category', newCat, newCat, res, type);
                      };

                      const handleResChange = (newRes) => {
                        setRes(newRes);
                        const autoCat = calculateCategory(newRes);
                        if (autoCat) setCat(autoCat);
                        applyRules('classification', newRes, autoCat || cat, newRes, type);
                      };

                      const clearAll = () => {
                        setCat(''); setRes(''); setType(''); setVerd(''); setLastAutoFilledText('');
                      };

                      const [saving, setSaving] = React.useState(false);
                      const rc = resColorMap[res] || 'slate';

                      const handleSave = async () => {
                        let currentRole = caseData['الصفة'] || caseData['صفة'] || '';
                        if (!currentRole.trim()) {
                          const promptRes = await showPrompt('تحديد الصفة ضروري', 'يرجى تحديد صفتنا في هذه الدعوى لحساب الإحصائيات بدقة (مثلاً: طاعن، مطعون ضدنا):');
                          if (promptRes?.trim()) {
                            currentRole = promptRes.trim();
                          } else {
                            toast('تنبيه: لم يتم تحديد الصفة! الإحصائيات ستتأثر ولن تكون دقيقة.', 'error');
                          }
                        }

                        setSaving(true);
                        const isFinal = (cat === 'حكم نهائي');
                        const newJudgmentObj = { category: cat, type, result: res, fullVerdict: verd, isFinal: isFinal, recordedAt: new Date().toISOString().split('T')[0] };
                        const newSessions = [...caseData.sessions];
                        newSessions[idx] = { ...newSessions[idx], judgment: newJudgmentObj, shortJudgment: type, judgmentClassification: res, verdict: verd, hasJudgment: true };

                        const payload = { sessions: newSessions };
                        if (currentRole !== (caseData['الصفة'] || caseData['صفة'])) {
                          payload['الصفة'] = currentRole;
                        }

                        await saveCaseToFirebase(caseData.id, payload);
                        setSaving(false);
                        setIsEditing(false); // Switch back to view mode after saving
                      };

                      if (!isEditing) {
                        return (
                          <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 mt-1 shadow-sm relative group transition-all hover:border-indigo-200">
                            <div className="absolute left-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button onClick={() => setIsEditing(true)} className="p-1.5 bg-white text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm border border-slate-200" title="تعديل بيانات الحكم">
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button onClick={async () => {
                                const confirmed = await showConfirm('حذف الحكم', 'هل أنت متأكد من حذف هذا الحكم؟', 'delete_judgment');
                                if (confirmed) {
                                  const newSessions = [...caseData.sessions];
                                  newSessions[idx] = { ...newSessions[idx], hasJudgment: false, judgment: null, shortJudgment: null, judgmentClassification: null, verdict: null };
                                  await saveCaseToFirebase(caseData.id, { sessions: newSessions });
                                  setActiveJudgmentSessionIdx(null);
                                }
                              }} className="p-1.5 bg-white text-slate-400 hover:text-rose-600 rounded-lg shadow-sm border border-slate-200" title="حذف الحكم">
                                <Trash2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => setActiveJudgmentSessionIdx(null)} className="p-1.5 bg-white text-slate-400 hover:text-slate-600 rounded-lg shadow-sm border border-slate-200" title="إغلاق التفاصيل">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">⚖️ حكم مسجل</span>
                              {(cat === 'حكم نهائي' || j.isFinal || j._isFinal) && <span className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">نهائي</span>}
                              {res && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border bg-${rc}-50 text-${rc}-700 border-${rc}-200 mr-auto`}>{res}</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs mb-1">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 block">فئة الحكم</span>
                                <span className="font-bold text-slate-700">{cat || '-'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 block">نوع الحكم</span>
                                <span className="font-bold text-slate-700">{type || '-'}</span>
                              </div>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block">المنطوق</span>
                              <span className="font-bold text-slate-800 text-xs leading-relaxed">{verd || '-'}</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col gap-2 bg-rose-50/60 p-3 rounded-xl border border-rose-100 mt-1 shadow-sm">
                          {!(caseData['الصفة'] || caseData['صفة'])?.trim() && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 mb-1 shadow-sm">
                              <span>⚠️</span>
                              <span>يرجى تحديد "صفة الموكل" في بيانات الدعوى لضمان عمل التعبئة التلقائية.</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-rose-700">⚖️ بيانات الحكم</span>
                              <button onClick={clearAll} className="text-[9px] font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200 hover:border-rose-200 transition shadow-sm" title="تفريغ الحقول">
                                🧹 مسح الكل
                              </button>
                            </div>
                            {res && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border bg-${rc}-50 text-${rc}-700 border-${rc}-200`}>{res}</span>}
                          </div>
                          
                          

                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-0.5">مختصر الحكم</label>
                              <select
                                value={type}
                                onChange={e => handleTypeChange(e.target.value)}
                                className="w-full text-[10px] font-bold bg-white p-1.5 rounded-lg border border-rose-200 focus:outline-none focus:border-rose-400"
                              >
                                <option value="">-- اختر --</option>
                                {(settings?.judgmentTypes || ['قبول', 'رفض', 'عدم قبول', 'سقوط الخصومة', 'اعتبار الدعوى كأن لم تكن', 'وقف جزائي', 'انقطاع سير الخصومة', 'شطب', 'إلغاء', 'تأييد']).map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-0.5">تصنيف الحكم</label>
                              <select value={res} onChange={e => handleResChange(e.target.value)} className="w-full text-[10px] font-bold bg-white p-1.5 rounded-lg border border-rose-200 focus:outline-none focus:border-rose-400">
                                <option value="">-- اختر --</option>
                                {(settings?.judgmentClassifications?.length ? settings.judgmentClassifications : ['صالح', 'ضد', 'مختلط', 'تمهيدي']).map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                          </div>
                          
                          <div className="mb-2">
                            <label className="text-[9px] font-bold text-slate-500 block mb-0.5">فئة الحكم</label>
                            <select value={cat} onChange={e => handleCatChange(e.target.value)} className="w-full text-[10px] font-bold bg-white p-1.5 rounded-lg border border-rose-200 focus:outline-none focus:border-rose-400">
                              <option value="">-- اختر فئة الحكم --</option>
                              {Array.from(new Set([...(settings?.judgmentCategories?.length ? settings.judgmentCategories : ['قرار فحص', 'حكم نهائي', 'حكم إجرائي', 'حكم منه للخصومة'])])).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 block mb-0.5">منطوق الحكم كاملاً</label>
                            <textarea value={verd} onChange={e => setVerd(e.target.value)} placeholder="أكتب منطوق الحكم كاملاً..." className="w-full text-[10px] font-bold bg-white p-2 rounded-lg border border-rose-200 whitespace-pre-wrap focus:outline-none focus:border-rose-400 resize-none min-h-[50px]" rows={2} />
                          </div>
                          <div className="flex items-center justify-end pt-1 border-t border-rose-100 mt-2">
                            <div className="flex gap-2">
                              <button onClick={() => {
                                if (session.hasJudgment) setIsEditing(false);
                                else setActiveJudgmentSessionIdx(null);
                              }} disabled={saving} className="text-[10px] font-bold px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition disabled:opacity-50">
                                إلغاء
                              </button>
                              <button onClick={() => setIsRulesOpen(true)} className="text-[10px] font-bold px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg transition flex items-center gap-1" title="قواعد التعبئة التلقائية">
                                <Settings className="w-3 h-3" /> قواعد التعبئة
                              </button>
                              <button onClick={handleSave} disabled={saving} className="text-[10px] font-black px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition disabled:opacity-50">
                                {saving ? '...' : '💾 حفظ الحكم'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    };
                    return <JudgmentEditor />;
                  })()}

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
