import React from 'react';
import { Trash2, Calendar, Bell, Files, X, MapPin } from 'lucide-react';
import StrictSelectField from '../StrictSelectField';
import SmartAutocomplete from '../SmartAutocomplete';
import { formatDateString, getSafeDateObj } from '../../utils/dateUtils';
import { localizeNumber } from '../../utils/numberUtils';

export default function CaseInfoTab({
  setActiveTab,
  setActiveJudgmentSessionIdx,
  activeDetailTab,
  setActiveDetailTab,
  schema,
  editData,
  setEditData,
  isEditing,
  settings,
  cases,
  effectiveDefendants,
  activeDefId,
  setActiveDefId,
  newDefName,
  setNewDefName,
  newJoinedNo,
  setNewJoinedNo,
  newJoinedYear,
  setNewJoinedYear,
  caseData,
  handleAddUrgentReminder,
  setManagingField,
  isEmptyValue,
  legacyJoinedStr
}) {
  const [newPlaintName, setNewPlaintName] = React.useState('');

  return (
    <div className="bg-transparent space-y-4 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Dynamic Fields from Schema (Grouped & Redesigned) */}
      <div className="space-y-6 pt-2">
        {/* Tabs Header */}
        <div className="flex flex-wrap gap-2 pb-2 mb-4 border-b border-slate-100">
          {[
            {
              title: '📌 بيانات أساسية',
              keys: ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى', 'السنة', 'سنة', 'year', 'تاريخ رفع الدعوى', 'دعاوى منضمة', 'المحكمة', 'الدائرة', 'المدعي', 'المدعى_عليه', 'المدعى عليه', 'الخصوم', 'مطعون ضدهم آخرين', 'الصفة', 'صفة', 'مكان الملف']
            },
            {
              title: '⚖️ الجلسة والقرار',
              keys: ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة', 'الرول', 'نوع الجلسة', 'القرار', 'قرار الجلسة', 'ملاحظات']
            },
            {
              title: '📑 بيانات فنية',
              keys: ['تصنيف الدعوى', 'موضوع الدعوى', 'طلبات المدعي']
            },
            {
              title: '🏛️ بيانات الحكم وأخرى',
              keys: ['محكمة أول درجة', 'رقم دعوى أول درجة', 'سنة دعوى أول درجة', 'تاريخ حكم أول درجة', 'جلسة حكم أول درجة', 'منطوق حكم أول درجة', 'الحكم', 'تصنيف الحكم', 'نوع الحكم', 'المنطوق', 'منطوق الحكم', 'ملخص الطعن وتفاصيله', 'ملخص الطعن', 'المقر المختار', 'عنوان المدعى عليه', 'عنوان المدعي', 'طلبات الطاعن']
            }
          ].map((group) => (
            <button
              key={group.title}
              type="button"
              onClick={() => setActiveDetailTab(group.title)}
              className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-black text-xs transition-all border ${activeDetailTab === group.title ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {group.title}
            </button>
          ))}
        </div>

        {/* Active Tab Content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 animate-in fade-in zoom-in duration-200 min-h-[400px]">
          {[
            {
              title: '📌 بيانات أساسية',
              keys: ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى', 'السنة', 'سنة', 'year', 'تاريخ رفع الدعوى', 'دعاوى منضمة', 'المحكمة', 'الدائرة', 'المدعي', 'المدعى_عليه', 'المدعى عليه', 'الخصوم', 'مطعون ضدهم آخرين', 'الصفة', 'صفة', 'مكان الملف']
            },
            {
              title: '⚖️ الجلسة والقرار',
              keys: ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة', 'الرول', 'نوع الجلسة', 'القرار', 'قرار الجلسة', 'ملاحظات']
            },
            {
              title: '📑 بيانات فنية',
              keys: ['تصنيف الدعوى', 'موضوع الدعوى', 'طلبات المدعي']
            },
            {
              title: '🏛️ بيانات الحكم وأخرى',
              keys: ['محكمة أول درجة', 'رقم دعوى أول درجة', 'سنة دعوى أول درجة', 'تاريخ حكم أول درجة', 'جلسة حكم أول درجة', 'منطوق حكم أول درجة', 'الحكم', 'تصنيف الحكم', 'نوع الحكم', 'المنطوق', 'منطوق الحكم', 'ملخص الطعن وتفاصيله', 'ملخص الطعن', 'المقر المختار', 'عنوان المدعى عليه', 'عنوان المدعي', 'طلبات الطاعن']
            }
          ].map((group, idx, arr) => {
            if (group.title !== activeDetailTab) return null;
            let groupFields = schema.filter(f => f && f.visible && group.keys.includes(f.id));
            if (idx === arr.length - 1) {
              const allConfiguredKeys = arr.flatMap(g => g.keys);
              const unmappedFields = schema.filter(f => f && f.visible && !allConfiguredKeys.includes(f.id));
              groupFields = [...groupFields, ...unmappedFields];
            }

            return (
              <div key={idx} className="w-full">
                {/* --- Unified Header injected at top of tab --- */}
                {group.title === '🏛️ بيانات الحكم وأخرى' && settings?.courtDegree !== 'أول درجة' && (
                  <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-200 space-y-5">
                    <div className="grid grid-cols-12 gap-2 w-full">
                      <div className="col-span-8 sm:col-span-8 relative">
                        <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">رقم دعوى أول درجة</span>
                        {isEditing ? (
                          <SmartAutocomplete
                            maxLength={6}
                            id="رقم دعوى أول درجة"
                            value={editData['رقم دعوى أول درجة'] || ''}
                            onChange={(v) => {
                                let finalV = v.replace(/[^\d]/g, '');
                                setEditData({...editData, 'رقم دعوى أول درجة': finalV});
                            }}
                            cases={cases}
                            fieldPaths={['رقم دعوى أول درجة']}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition"
                          />
                        ) : (
                          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 min-h-[42px] flex items-center justify-center gap-1.5" dir="ltr">
                            <span>{localizeNumber(editData['سنة دعوى أول درجة'] || '', settings?.numberFormat)}</span>
                            <span className="text-slate-400">/</span>
                            <span>{localizeNumber(editData['رقم دعوى أول درجة'] || '', settings?.numberFormat)}</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-4 sm:col-span-4 relative">
                        <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">سنة دعوى أول درجة</span>
                        {isEditing ? (
                          <SmartAutocomplete
                            maxLength={4}
                            id="سنة دعوى أول درجة"
                            value={editData['سنة دعوى أول درجة'] || ''}
                            onChange={(v) => {
                                let finalV = v.replace(/[^\d]/g, '');
                                setEditData({...editData, 'سنة دعوى أول درجة': finalV});
                            }}
                            cases={cases}
                            fieldPaths={['سنة دعوى أول درجة']}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition z-0"
                          />
                        ) : (
                          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 min-h-[42px] flex items-center justify-center">
                            {localizeNumber(editData['سنة دعوى أول درجة'] || '', settings?.numberFormat) || '---'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {group.title === '📌 بيانات أساسية' && (
                  <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-200 space-y-5">
                    {/* 1. Case No & Year */}
                    <div className="grid grid-cols-12 gap-2 w-full">
                      <div className="col-span-5 sm:col-span-5 relative">
                        <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">رقم الدعوى</span>
                        {isEditing ? (
                          <SmartAutocomplete
                            maxLength={6}
                            id="رقم الدعوى"
                            value={editData['رقم الدعوى'] || editData['رقم القضية'] || editData['رقم_الدعوى'] || ''}
                            onChange={(v) => {
                                let finalV = v.replace(/[^\d]/g, '');
                                setEditData({...editData, 'رقم الدعوى': finalV});
                            }}
                            cases={cases}
                            fieldPaths={['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition"
                          />
                        ) : (
                          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 min-h-[42px] flex items-center justify-center gap-1.5" dir="ltr">
                            <span>{localizeNumber(editData['السنة'] || editData['سنة'] || editData['year'] || '', settings?.numberFormat)}</span>
                            <span className="text-slate-400">/</span>
                            <span>{localizeNumber(editData['رقم الدعوى'] || editData['رقم القضية'] || editData['رقم_الدعوى'] || '', settings?.numberFormat)}</span>
                          </div>
                        )}
                      </div>
                      <div className="col-span-3 sm:col-span-3 relative">
                        <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">السنة</span>
                        {isEditing ? (
                          <SmartAutocomplete
                            maxLength={4}
                            id="السنة"
                            value={editData['السنة'] || editData['سنة'] || editData['year'] || ''}
                            onChange={(v) => {
                                let finalV = v.replace(/[^\d]/g, '');
                                setEditData({...editData, 'السنة': finalV});
                            }}
                            cases={cases}
                            fieldPaths={['السنة', 'سنة', 'year']}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition z-0"
                          />
                        ) : (
                          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 min-h-[42px] flex items-center justify-center">
                            {localizeNumber(editData['السنة'] || editData['سنة'] || editData['year'] || '', settings?.numberFormat)}
                          </div>
                        )}
                      </div>
                    <div className="col-span-4 sm:col-span-4 relative">
                        <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">تاريخ رفع الدعوى</span>
                        {isEditing ? (
                          <input type="date" value={editData['تاريخ رفع الدعوى'] && getSafeDateObj(editData['تاريخ رفع الدعوى']) ? getSafeDateObj(editData['تاريخ رفع الدعوى']).toISOString().split('T')[0] : ''} onChange={(e) => setEditData({ ...editData, ['تاريخ رفع الدعوى']: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition h-[38px] mt-0.5" />
                        ) : (
                          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 min-h-[42px] flex items-center justify-center">
                            {localizeNumber(formatDateString(editData['تاريخ رفع الدعوى']), settings?.numberFormat) || '---'}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 2. Plaintiffs List */}
                    <div>
                      <label className="text-xs font-black text-slate-500 block mb-3">المدعين / الطاعنين</label>
                      <div className="space-y-3">
                        {((editData.plaintiffsList && editData.plaintiffsList.length > 0) ? editData.plaintiffsList : []).map((plaint, idx) => (
                          <div key={plaint.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative group">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex-1">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={plaint.name} 
                                    onChange={e => {
                                      const list = [...editData.plaintiffsList];
                                      list[idx].name = e.target.value;
                                      setEditData({ ...editData, plaintiffsList: list });
                                    }}
                                    placeholder="اسم المدعي"
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                  />
                                ) : (
                                  <div className="font-bold text-sm text-navy-900">{plaint.name || '---'}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isEditing && (
                                  <button 
                                    onClick={() => {
                                      const list = [...editData.plaintiffsList];
                                      list.splice(idx, 1);
                                      setEditData({ ...editData, plaintiffsList: list });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 bg-white rounded-lg border border-slate-200"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {isEditing && (
                          <div className="flex items-center gap-2 mt-2">
                            <input 
                              type="text" 
                              value={newPlaintName} 
                              onChange={e => setNewPlaintName(e.target.value)} 
                              placeholder="اسم المدعي الجديد..." 
                              className="flex-1 bg-white border border-indigo-200 shadow-sm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400"
                            />
                            <button 
                              onClick={() => {
                                if (!newPlaintName.trim()) return;
                                const newList = [...(editData.plaintiffsList || []), { id: Date.now().toString(), name: newPlaintName }];
                                setEditData({ ...editData, plaintiffsList: newList });
                                setNewPlaintName('');
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition whitespace-nowrap"
                            >
                              + إضافة
                            </button>
                          </div>
                        )}
                        {(!editData.plaintiffsList || editData.plaintiffsList.length === 0) && !isEditing && (
                          <div className="text-xs font-bold text-slate-700 bg-slate-50/80 border border-slate-100 rounded-xl p-3 min-h-[42px] flex items-center">
                            {editData['المدعي'] || editData['الطاعن'] || 'لا يوجد مدعين مسجلين.'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. Defendants List */}
                    <div>
                      <label className="text-xs font-black text-slate-500 block mb-3">المدعى عليهم / المطعون ضدهم</label>
                      <div className="space-y-3">
                        {((editData.defendantsList && editData.defendantsList.length > 0) ? editData.defendantsList : effectiveDefendants).map((def, idx) => (
                          <div key={def.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 relative group">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex-1">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={def.name} 
                                    onChange={e => {
                                      const list = [...editData.defendantsList];
                                      list[idx].name = e.target.value;
                                      setEditData({ ...editData, defendantsList: list });
                                    }}
                                    placeholder="اسم المدعى عليه"
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-400"
                                  />
                                ) : (
                                  <div className="font-bold text-sm text-navy-900">{def.name || '---'}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {!isEditing && (def.address || def.chosenAddress) && (
                                  <button 
                                    onClick={() => setActiveDefId(activeDefId === def.id ? null : def.id)}
                                    className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 font-bold flex items-center gap-1"
                                  >
                                    <MapPin className="w-3 h-3" /> التفاصيل
                                  </button>
                                )}
                                {isEditing && (
                                  <button 
                                    onClick={() => setActiveDefId(activeDefId === def.id ? null : def.id)}
                                    className="text-[10px] bg-white border border-indigo-200 text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-indigo-50 font-bold flex items-center gap-1"
                                  >
                                    <MapPin className="w-3 h-3" /> {activeDefId === def.id ? 'إخفاء العناوين' : 'إضافة/تعديل العناوين'}
                                  </button>
                                )}
                                {isEditing && (
                                  <button 
                                    onClick={() => {
                                      const list = [...editData.defendantsList];
                                      list.splice(idx, 1);
                                      setEditData({ ...editData, defendantsList: list });
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 bg-white rounded-lg border border-slate-200"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* Expanded Address Fields */}
                            {(activeDefId === def.id || (!isEditing && activeDefId === def.id)) && (
                              <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">عنوان المدعى عليه</label>
                                  {isEditing ? (
                                    <textarea
                                      value={def.address || ''}
                                      onChange={e => {
                                        const list = [...editData.defendantsList];
                                        list[idx].address = e.target.value;
                                        setEditData({ ...editData, defendantsList: list });
                                      }}
                                      placeholder="العنوان..."
                                      rows={2}
                                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:outline-none focus:border-indigo-400 resize-none"
                                    />
                                  ) : (
                                    <div className="text-xs font-bold text-slate-700">{def.address || 'لا يوجد'}</div>
                                  )}
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1">المقر المختار</label>
                                  {isEditing ? (
                                    <textarea
                                      value={def.chosenAddress || ''}
                                      onChange={e => {
                                        const list = [...editData.defendantsList];
                                        list[idx].chosenAddress = e.target.value;
                                        setEditData({ ...editData, defendantsList: list });
                                      }}
                                      placeholder="المقر المختار..."
                                      rows={2}
                                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[11px] font-bold focus:border-indigo-400 resize-none"
                                    />
                                  ) : (
                                    <div className="text-xs font-bold text-slate-700">{def.chosenAddress || 'لا يوجد'}</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {isEditing && (
                          <div className="flex items-center gap-2 mt-2">
                            <input 
                              type="text" 
                              value={newDefName} 
                              onChange={e => setNewDefName(e.target.value)} 
                              placeholder="اسم المدعى عليه الجديد..." 
                              className="flex-1 bg-white border border-indigo-200 shadow-sm rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-400"
                            />
                            <button 
                              onClick={() => {
                                if (!newDefName.trim()) return;
                                const newList = [...(editData.defendantsList || []), { id: Date.now().toString(), name: newDefName, address: '', chosenAddress: '' }];
                                setEditData({ ...editData, defendantsList: newList });
                                setNewDefName('');
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition whitespace-nowrap"
                            >
                              + إضافة
                            </button>
                          </div>
                        )}
                        {(!editData.defendantsList || editData.defendantsList.length === 0) && !isEditing && effectiveDefendants.length === 0 && (
                          <div className="text-xs font-bold text-slate-400">لا يوجد مدعى عليهم مسجلين.</div>
                        )}
                      </div>
                    </div>
                    
                    {/* 4. Joined Cases and Role (الصفة) */}
                    <div className="grid grid-cols-12 gap-2 w-full mt-3">
                      {/* Joined Cases */}
                      <div className="col-span-12 sm:col-span-7 md:col-span-8 bg-indigo-50/40 rounded-xl p-3 border border-indigo-100 relative">
                        <label className="text-[10px] font-black text-indigo-800 mb-2 block">الدعاوى المنضمة</label>
                        <div className="flex flex-wrap items-center gap-2">
                          {(editData.joinedCasesList || []).map((jc, jcIdx) => (
                            <div key={jcIdx} className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                              {jc.no} <span className="text-[10px] text-slate-400">/</span> {jc.year}
                              {isEditing && (
                                <button type="button" onClick={() => {
                                  const list = [...(editData.joinedCasesList || [])];
                                  list.splice(jcIdx, 1);
                                  setEditData({ ...editData, joinedCasesList: list });
                                }} className="text-rose-400 hover:text-rose-600 transition ml-1">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}

                          {legacyJoinedStr && !isEditing && (
                            <div className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                              {legacyJoinedStr}
                            </div>
                          )}

                          {isEditing && (
                            <div className="flex items-center gap-1.5">
                              <input type="number" placeholder="رقم" value={newJoinedNo} onChange={e => setNewJoinedNo(e.target.value)} className="w-16 bg-white border border-indigo-200 shadow-sm rounded-lg px-2 py-1.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                              <input type="number" placeholder="سنة" value={newJoinedYear} onChange={e => setNewJoinedYear(e.target.value)} className="w-14 bg-white border border-indigo-200 shadow-sm rounded-lg px-2 py-1.5 text-xs font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                              <button type="button" onClick={() => {
                                if (!newJoinedNo || !newJoinedYear) return;
                                const list = [...(editData.joinedCasesList || []), { no: newJoinedNo, year: newJoinedYear }];
                                setEditData({ ...editData, joinedCasesList: list });
                                setNewJoinedNo('');
                                setNewJoinedYear('');
                              }} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm text-white px-2.5 py-1.5 rounded-lg text-xs font-black transition">
                                + إضافة
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Role (الصفة) */}
                      <div className="col-span-12 sm:col-span-5 md:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-3 relative">
                        <label className="text-[10px] font-black text-slate-500 block mb-1">الصفة</label>
                        {isEditing ? (
                          <StrictSelectField
                            value={editData['الصفة'] || editData['صفة'] || ''}
                            options={['طاعنين أو مدعين', 'مطعون ضدنا أو مدعى علينا', 'لا شأن', 'خارج الاختصاص']}
                            onChange={(v) => setEditData({...editData, 'الصفة': v})}
                          />
                        ) : (
                          <div className="text-xs font-bold text-navy-900 bg-white border border-slate-200 rounded-lg p-2.5 min-h-[42px] flex items-center">{editData['الصفة'] || editData['صفة'] || '---'}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {group.title === '⚖️ الجلسة والقرار' && (
                  <div className="mb-4 flex justify-between items-center bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                    <div>
                      <h4 className="text-sm font-black text-indigo-900">إضافة أو تعديل حكم</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">انتقل إلى سجل الجلسات لتسجيل حكم آخر جلسة</p>
                    </div>
                    <button
                      type="button"
                      disabled={!caseData?.sessions || caseData.sessions.length === 0}
                      onClick={() => {
                        if (caseData?.sessions && caseData.sessions.length > 0) {
                          setActiveTab('sessions');
                          setActiveJudgmentSessionIdx(caseData.sessions.length - 1);
                        }
                      }}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm"
                      title={!caseData?.sessions || caseData.sessions.length === 0 ? "يجب إضافة جلسة أولاً" : ""}
                    >
                      <span>⚖️ إضافة حكم</span>
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 gap-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {groupFields.map(field => {
                    const val = editData[field.id] || '';

                    // Smart conditional logic:
                    if (isEditing) {
                      const currentRole = editData['الصفة'] || '';
                      const isPlaintiffRole = currentRole.includes('طاعن') || currentRole.includes('مستأنف') || currentRole.includes('مدعي');
                      const isDefendantRole = currentRole.includes('مطعون') || currentRole.includes('مدعى عليه');

                      if (field.id === 'المقر المختار' && !isPlaintiffRole) return null;
                      if (field.id === 'عنوان المدعى عليه' && !isPlaintiffRole) return null;
                      if (field.id === 'عنوان المدعي' && !isDefendantRole) return null;
                    }

                    // Hide appeal fields if courtDegree is 'أول درجة'
                    const appealFields = ['رقم دعوى أول درجة', 'سنة دعوى أول درجة', 'تاريخ حكم أول درجة', 'محكمة أول درجة', 'منطوق حكم أول درجة', 'مطعون ضدهم آخرين', 'عناوين المطعون ضدهم الآخرين'];
                    if (settings?.courtDegree === 'أول درجة' && appealFields.includes(field.id)) {
                      return null;
                    }

                    if (!isEditing && isEmptyValue(val)) return null;

                    // Skip rendering fields that are handled dynamically or separately
                    if (['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى', 'المدعي', 'المدعى_عليه', 'المدعى عليه', 'الخصوم', 'عناوين المطعون ضدهم الآخرين', 'الصفة', 'صفة', 'السنة', 'سنة', 'year', 'دعاوى منضمة', 'مطعون ضدهم آخرين', 'تاريخ رفع الدعوى', 'رقم دعوى أول درجة', 'سنة دعوى أول درجة'].includes(field.id)) return null;

                    const isDateField = (field.type === 'date' && field.id !== 'نوع الجلسة') || field.id.includes('تاريخ') || (field.id.includes('جلسة') && field.id !== 'نوع الجلسة');
                    const displayVal = localizeNumber(isDateField ? formatDateString(val) : val, settings?.numberFormat);

                    let colSpan = 'col-span-2 md:col-span-2';
                    const shortFields = ['رقم الدعوى', 'السنة', 'سنة', 'year', 'رقم القضية', 'رقم_الدعوى', 'الرول', 'الدائرة', 'تصنيف الحكم'];
                    const longFields = ['ملاحظات', 'المنطوق', 'منطوق الحكم', 'موضوع الدعوى', 'الإجراءات الهامة والعاجلة'];

                    if (shortFields.includes(field.id)) colSpan = 'col-span-1 md:col-span-1';
                    if (longFields.includes(field.id) || field.type === 'textarea') colSpan = 'col-span-2 md:col-span-4';

                    if (field.id === 'الإجراءات الهامة والعاجلة' && !isEditing) {
                      return (
                        <div key={field.id} className="col-span-2 md:col-span-4 bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/80 rounded-2xl p-4.5 space-y-3 shadow-sm relative overflow-hidden group">
                          <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-gradient-to-b from-rose-500 to-amber-500"></div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                              <label className="text-xs font-black text-rose-800">{field.label}</label>
                            </div>
                            <button
                              onClick={() => handleAddUrgentReminder(val)}
                              className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black text-amber-700 bg-amber-100 hover:bg-amber-250 hover:text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200 transition shadow-sm cursor-pointer"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>تذكير بموعد الإجراء</span>
                            </button>
                          </div>
                          <div className="text-xs font-bold text-slate-800 pr-3 leading-relaxed whitespace-pre-wrap">
                            {val}
                          </div>
                          {editData.urgentReminderDate && (
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg w-max mt-2">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>موعد التذكير: {localizeNumber(editData.urgentReminderDate, settings?.numberFormat)}</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={field.id} className={`space-y-1.5 ${colSpan}`}>
                        
  {!( ['الصفة', 'صفة', 'نوع الجلسة', 'القرار', 'مكان الملف', 'تصنيف الدعوى', 'تصنيف الحكم', 'محكمة أول درجة'].includes(field.id) && isEditing ) && (
    <label className="text-[11px] font-black text-slate-500 block">{field.label}</label>
  )}
  {isEditing ? (

                          field.id === 'الصفة' || field.id === 'صفة' ? (
                            <StrictSelectField
                              label={field.label}
                              value={val}
                              onChange={v => setEditData({ ...editData, [field.id]: v })}
                              options={['طاعنين أو مدعين', 'مطعون ضدنا أو مدعى علينا', 'لا شأن', 'خارج الاختصاص']}
                              placeholder="اختر الصفة..."
                            />
                          ) : field.id === 'نوع الجلسة' ? (
                            <StrictSelectField
                              label={field.label}
                              value={val}
                              onChange={v => setEditData({ ...editData, [field.id]: v })}
                              options={settings?.sessionTypes || ['فحص', 'موضوع']}
                              onManage={() => setManagingField('sessionTypes')}
                              placeholder="اختر نوع الجلسة..."
                            />
                          ) : field.id === 'القرار' && settings?.decisions ? (
                            <StrictSelectField
                              value={val}
                              onChange={v => setEditData({ ...editData, [field.id]: v })}
                              options={settings.decisions}
                              onManage={() => setManagingField('decisions')}
                              placeholder="اختر القرار..."
                            />
                          ) : field.id === 'مكان الملف' ? (
                            <StrictSelectField
                              label={field.label}
                              value={val}
                              onChange={v => setEditData({ ...editData, [field.id]: v })}
                              options={settings?.fileLocations || ['شعبة الحفظ', 'الأحكام', 'أصلي']}
                              onManage={() => setManagingField('fileLocations')}
                              placeholder="اختر مكان الملف..."
                            />
                          ) : field.id === 'تصنيف الدعوى' ? (
                            <StrictSelectField
                              label={field.label}
                              value={val}
                              onChange={v => setEditData({ ...editData, [field.id]: v })}
                              options={settings?.caseClassifications || ['تسويات', 'بدلات', 'جزاءات', 'ترقيات', 'عقود', 'ضرائب']}
                              onManage={() => setManagingField('caseClassifications')}
                              placeholder="اختر تصنيف الدعوى..."
                            />
                          ) : field.id === 'تصنيف الحكم' ? (
                            <StrictSelectField
                              label={field.label}
                              value={val}
                              onChange={v => setEditData({ ...editData, [field.id]: v })}
                              options={settings?.judgmentClassifications || ['صالح', 'ضد', 'مختلط', 'اعتبار', 'وقف جزائي', 'وقف تعليقي', 'خبراء']}
                              onManage={() => setManagingField('judgmentClassifications')}
                              placeholder="اختر تصنيف الحكم..."
                            />
                          ) : field.type === 'textarea' ? (
                            <textarea value={val} onChange={(e) => setEditData({ ...editData, [field.id]: e.target.value })} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 resize-none transition" />
                          ) : field.type === 'date' || field.id.includes('تاريخ') || field.id.includes('جلسة') ? (
                            <input type="date" value={val && getSafeDateObj(val) ? getSafeDateObj(val).toISOString().split('T')[0] : ''} onChange={(e) => setEditData({ ...editData, [field.id]: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition" />
                          ) : ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى'].includes(field.id) ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-[2]">
                                <SmartAutocomplete
                                  id={field.id}
                                  value={val}
                                  onChange={(v) => {
                                    let finalV = v;
                                    if (field.type === 'number') finalV = finalV.replace(/[^\d]/g, '');
                                    setEditData({ ...editData, [field.id]: finalV });
                                  }}
                                  cases={cases}
                                  fieldPaths={[field.id]}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition"
                                />
                              </div>
                              <div className="flex-[1] relative">
                                <span className="absolute -top-5 right-1 text-[10px] font-black text-slate-500">السنة</span>
                                <SmartAutocomplete
                                  maxLength={4}
                            id="السنة"
                            value={editData['السنة'] || editData['سنة'] || editData['year'] || ''}
                            onChange={(v) => {
                                    let finalV = v;
                                    if (schema.find(f => f.id === 'السنة' || f.id === 'سنة' || f.id === 'year')?.type === 'number') finalV = finalV.replace(/[^\d]/g, '');
                                    setEditData({ ...editData, ['السنة']: finalV });
                                  }}
                                  cases={cases}
                                  fieldPaths={['السنة', 'سنة', 'year']}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition relative z-0"
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <SmartAutocomplete
                                id={field.id}
                                value={val}
                                onChange={(v) => {
                                  let finalV = v;
                                  if (field.type === 'number') finalV = finalV.replace(/[^\d]/g, '');
                                  setEditData({ ...editData, [field.id]: finalV });
                                }}
                                cases={cases}
                                fieldPaths={[field.id]}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 transition"
                              />
                            </>
                          )
                        ) : ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى'].includes(field.id) ? (
                          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 flex items-center justify-center gap-1.5 min-h-[42px]" dir="ltr">
                            <span>{localizeNumber(editData['السنة'] || editData['سنة'] || editData['year'] || '', settings?.numberFormat)}</span>
                            <span className="text-slate-400">/</span>
                            <span>{displayVal}</span>
                          </div>
                        ) : (
                          <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-xs font-bold text-navy-900 whitespace-pre-wrap break-words min-h-[42px]" dir={isDateField ? "ltr" : "auto"}>
                            {displayVal}
                          </div>
                        )}
                        {/* Inject Joined Cases directly below Case Number if applicable */}
                        {['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى'].includes(field.id) && (
                          <div className="mt-2 space-y-2">
                            {((editData.joinedCasesList && editData.joinedCasesList.length > 0) || legacyJoinedStr || isEditing) && (
                              <div className="bg-indigo-50/40 rounded-xl p-2 border border-indigo-100">
                                <h3 className="text-[10px] font-black text-indigo-800 mb-2 flex items-center gap-1.5"><Files className="w-3 h-3" /> الدعاوى المنضمة</h3>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {(editData.joinedCasesList || []).map((jc, idx) => (
                                    <div key={idx} className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                                      {localizeNumber(jc.no, settings?.numberFormat)} <span className="text-[9px] text-slate-400">/</span> {localizeNumber(jc.year, settings?.numberFormat)}
                                      {isEditing && (
                                        <button onClick={() => {
                                          const list = [...(editData.joinedCasesList || [])];
                                          list.splice(idx, 1);
                                          setEditData({ ...editData, joinedCasesList: list });
                                        }} className="text-rose-400 hover:text-rose-600 transition ml-1">
                                          <X className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}

                                  {legacyJoinedStr && !isEditing && (
                                    <div className="bg-white border border-indigo-200 shadow-sm text-indigo-700 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                                      {legacyJoinedStr}
                                    </div>
                                  )}

                                  {(!editData.joinedCasesList || editData.joinedCasesList.length === 0) && !legacyJoinedStr && !isEditing && (
                                    <span className="text-[10px] font-bold text-slate-400">لا توجد دعاوى منضمة.</span>
                                  )}

                                  {isEditing && (
                                    <div className="flex items-center gap-1 ml-auto">
                                      <input type="number" placeholder="رقم" value={newJoinedNo} onChange={e => setNewJoinedNo(e.target.value)} className="w-14 bg-white border border-indigo-200 shadow-sm rounded-md px-1.5 py-1 text-[10px] font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                                      <input type="number" placeholder="سنة" value={newJoinedYear} onChange={e => setNewJoinedYear(e.target.value)} className="w-12 bg-white border border-indigo-200 shadow-sm rounded-md px-1.5 py-1 text-[10px] font-bold text-navy-900 focus:outline-none focus:border-indigo-400" />
                                      <button onClick={() => {
                                        if (!newJoinedNo || !newJoinedYear) return;
                                        const list = [...(editData.joinedCasesList || []), { no: newJoinedNo, year: newJoinedYear }];
                                        setEditData({ ...editData, joinedCasesList: list });
                                        setNewJoinedNo('');
                                        setNewJoinedYear('');
                                      }} className="bg-indigo-600 hover:bg-indigo-700 shadow-sm text-white px-2 py-1 rounded-md text-[10px] font-black transition">
                                        +
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Custom fields not in schema (legacy/extra) */}
      {(() => {
        const extraKeys = Object.keys(editData).filter(k => 
          k !== 'id' && 
          k !== 'sessions' && 
          k !== 'documents' && 
          k !== 'joinedCasesList' && 
          k !== 'defendantsList' && 
          k !== 'plaintiffsList' && 
          k !== 'paperFileContents' && 
          !schema.find(s => s.id === k) && 
          !['isImportant', 'procedures', 'urgentReminderDate', 'createdAt', 'updatedAt', 'userId', 'المدعي', 'المدعى عليه', 'الصفة', 'المقر المختار', 'رقم الدعوى', 'السنة', 'عنوان المدعى عليه', 'عنوان المدعي', 'الحكم', 'تصنيف الحكم', 'المنطوق', 'منطوق الحكم', 'الرول', 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي'].includes(k)
        );
        if (!isEditing || extraKeys.length === 0) return null;

        return (
          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-xs font-black text-slate-400 mb-3">حقول إضافية غير مسجلة في الهيكلة:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {extraKeys.map(key => (
                <div key={key} className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">{key}</span>
                    <input
                      type="text"
                      value={editData[key] || ''}
                      onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-navy-900"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newData = { ...editData };
                      delete newData[key];
                      setEditData(newData);
                    }}
                    className="self-end pb-1 text-rose-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
