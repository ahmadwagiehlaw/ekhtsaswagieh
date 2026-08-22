import React from 'react';
import { CalendarDays, Gavel, CheckSquare, Square, AlertTriangle, Camera, MapPin, FolderClosed, Sparkles, Files as FilesIcon, Eye } from 'lucide-react';
import { formatDateString, getSafeDateObj } from '../../utils/dateUtils';
import { getFieldVal } from '../../utils/caseUtils';

export default function CaseCard({
  c,
  viewMode,
  selectedCaseIds,
  toggleSelection,
  navigate,
  setQuickPeekId,
  setQuickLocationEditId,
  setSingleViewingCaseId,
  viewingTasks,
  toast
}) {
  const caseNum = getFieldVal(c, ['رقم الدعوى', 'رقم القضية', 'رقم_الدعوى']);
  const year = getFieldVal(c, ['السنة', 'سنة', 'year']);
  const appellant = getFieldVal(c, ['المدعي', 'الطاعن', 'المستأنف']);
  const appellee = getFieldVal(c, ['المدعى_عليه', 'المدعى عليه', 'المطعون ضده', 'المطعون']);
  const lastSession = getFieldVal(c, ['آخر جلسة', 'تاريخ الجلسة', 'أخر جلسة']);
  const formattedLastSession = lastSession ? formatDateString(lastSession) : '';
  const decision = getFieldVal(c, ['القرار', 'قرار الجلسة', 'المنطوق']);
  const sessionRoll = getFieldVal(c, ['الرول', 'رول الجلسة', 'رقم الرول']);
  const fileLocation = getFieldVal(c, ['مكان الملف']);

  const role = String(c['الصفة'] || c['صفة'] || '').trim();
  const isAppellant = role.includes('طاعن') || role.includes('مستأنف') || role.includes('مدعي');
  const isAppellee = role.includes('مطعون ضده') || role.includes('مطعون ضدنا') || role.includes('مستأنف ضده') || role.includes('مدعى عليه') || role.includes('مدعى علينا');
  const isNoInterest = role === 'لا شأن';
  const isOutOfJurisdiction = role === 'خارج الاختصاص';

  const joinedCasesStr = getFieldVal(c, ['دعاوى منضمة']);
  const hasJoinedCases = joinedCasesStr && joinedCasesStr.trim() !== '';

  const coverImageDoc = (c.documents || []).find(doc => doc.type === 'غلاف الملف' && doc.fileType === 'image');
  const coverImageUrl = coverImageDoc ? coverImageDoc.url : null;

  const isJudgment = String(decision).includes('حكم') || String(decision).includes('للحكم');

  // Card Color Logic based on role
  let roleColor = 'amber';
  let bgClass = `bg-white hover:bg-amber-50/30`;
  let borderClass = `border-amber-100 hover:border-amber-300`;
  let textClass = `text-amber-700`;
  let badgeBgClass = `bg-amber-50 text-amber-700 border-amber-200`;
  let cardOpacity = '';
  let grayscale = '';

  if (isAppellant) {
    roleColor = 'rose';
    bgClass = `bg-white hover:bg-rose-50/30`;
    borderClass = `border-rose-100 hover:border-rose-300`;
    textClass = `text-rose-700`;
    badgeBgClass = `bg-rose-50 text-rose-700 border-rose-200`;
  } else if (isAppellee) {
    roleColor = 'emerald';
    bgClass = `bg-white hover:bg-emerald-50/30`;
    borderClass = `border-emerald-100 hover:border-emerald-300`;
    textClass = `text-emerald-700`;
    badgeBgClass = `bg-emerald-50 text-emerald-700 border-emerald-200`;
  } else if (isOutOfJurisdiction) {
    roleColor = 'indigo';
    bgClass = `bg-indigo-50/10 hover:bg-indigo-50/30`;
    borderClass = `border-indigo-100 hover:border-indigo-300`;
    textClass = `text-indigo-700`;
    badgeBgClass = `bg-indigo-50 text-indigo-700 border-indigo-200`;
  } else if (isNoInterest) {
    roleColor = 'slate';
    bgClass = `bg-slate-50/50 hover:bg-slate-50`;
    borderClass = `border-slate-200 hover:border-slate-300`;
    textClass = `text-slate-500`;
    badgeBgClass = `bg-slate-100 text-slate-500 border-slate-300`;
    cardOpacity = 'opacity-60 hover:opacity-100';
    grayscale = 'grayscale';
  }

  const hasNoPaperDetails = (!c.documents || c.documents.length === 0) && (!c.paperFileContents || c.paperFileContents.length === 0);
  
  if (hasNoPaperDetails && !isNoInterest) {
    borderClass = `border-dashed border-[2px] border-slate-300 hover:border-slate-400`;
    bgClass = `bg-slate-50/50 hover:bg-slate-100/50`;
  }

  const activeAlerts = (c.alerts || []).filter(a => !a.isDone);
  const hasUrgentAlert = activeAlerts.some(a => {
    const diffDays = Math.ceil((getSafeDateObj(a.date) - new Date()) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  });

  const latestJudgmentSession = (c.sessions || [])
    .filter(s => s.hasJudgment && s.judgment)
    .sort((a, b) => getSafeDateObj(b.date) - getSafeDateObj(a.date))[0];
  const finalStampData = latestJudgmentSession ? latestJudgmentSession.judgment : null;
  let stampColor = 'indigo';
  if (finalStampData) {
    const res = finalStampData.result || '';
    // Determine stamp color based on result and role classification
    if (res.includes('ضد') || res.includes('إجرائي خطير') || (isAppellant && (res.includes('وقف جزائي') || res.includes('اعتبار')))) {
      stampColor = 'rose';
    } else if (res.includes('صالح') || (isAppellee && (res.includes('وقف جزائي') || res.includes('اعتبار')))) {
      stampColor = 'emerald';
    } else if (res.includes('مختلط')) {
      stampColor = 'amber';
    } else if (res.includes('لا شأن') || isNoInterest) {
      stampColor = 'slate';
    }
  }

  const isMissing = fileLocation === 'غير موجود';
  const isTemp = fileLocation === 'مؤقت';
  const isOut = fileLocation === 'خارج الاختصاص';

  let locationRibbon = null;
  if (!isNoInterest && fileLocation && fileLocation !== 'في المكتب') {
    if (isMissing) {
      locationRibbon = { text: 'غير موجود', color: 'bg-rose-600', textColor: 'text-white' };
    } else if (isTemp) {
      locationRibbon = { text: 'مؤقت', color: 'bg-amber-500', textColor: 'text-white' };
    } else if (isOut) {
      locationRibbon = { text: 'خارج الاختصاص', color: 'bg-indigo-600', textColor: 'text-white' };
    } else {
      locationRibbon = { text: fileLocation, color: 'bg-slate-700', textColor: 'text-white' };
    }
  }

  const hasViewingTask = viewingTasks?.some(t => t.status !== 'completed' && t.linkedCases?.includes(c.id));

  if (viewMode === 'list') {
    return (
      <div
        key={c.id}
        onClick={() => navigate(`/case/${c.id}`)}
        className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${bgClass} ${borderClass} ${cardOpacity} ${grayscale}`}
      >
         {/* Left Side: Checkbox, Important badge, Num, Year, Role */}
         <div className="flex items-center gap-3 w-full sm:w-1/3">
           <div onClick={(e) => toggleSelection(e, c.id)} className="z-30 shrink-0">
             {selectedCaseIds.includes(c.id) ? (
               <CheckSquare className="w-5 h-5 text-emerald-600 bg-white rounded shadow-sm" />
             ) : (
               <Square className="w-5 h-5 text-slate-300 bg-white rounded shadow-sm opacity-50 group-hover:opacity-100 transition-opacity" />
             )}
           </div>
           
           <div className="flex flex-col gap-1 w-full">
             <div className="flex items-center gap-2">
               {c.isImportant && <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />}
               <span className="font-black text-navy-900 text-sm sm:text-base">{caseNum || 'بدون رقم'}</span>
               {year && <span className="text-xs font-bold text-slate-400">لسنة {year}</span>}
             </div>
             <span className={`text-[10px] font-black w-fit px-1.5 py-0.5 rounded ${badgeBgClass}`}>
               {role || 'ملف دعوى'}
             </span>
           </div>
         </div>

         {/* Middle: Opponents */}
         <div className="flex flex-col text-[10px] sm:text-xs w-full sm:w-1/3 border-r sm:border-r-0 sm:border-x border-slate-200 px-3 py-1">
           <div className="flex gap-1"><span className="text-emerald-600 font-bold shrink-0">الطاعن:</span><span className="font-black truncate">{appellant || '---'}</span></div>
           <div className="flex gap-1"><span className="text-rose-500 font-bold shrink-0">ضد:</span><span className="font-bold truncate">{appellee || '---'}</span></div>
         </div>

         {/* Right: Date & Decision & Actions */}
         <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-1/3">
            <div className="flex flex-col gap-1 items-start sm:items-end w-full">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <CalendarDays className="w-3.5 h-3.5" />
                <span dir="ltr">{formattedLastSession || 'لم تحدد'}</span>
                {sessionRoll && <span className="text-[10px] bg-slate-100 px-1 rounded border">رول {sessionRoll}</span>}
              </div>
              {decision && (
                <div className={`text-[10px] font-black px-2 py-0.5 rounded border max-w-full truncate ${isJudgment ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                  {decision}
                </div>
              )}
            </div>

            {/* Quick Peek Button */}
            <button
               onClick={(e) => {
                 e.stopPropagation();
                 setQuickPeekId(c.id);
               }}
               className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors shrink-0 z-30"
               title="نظرة سريعة"
            >
               <Eye className="w-4 h-4" />
            </button>
         </div>
         
         {/* Urgent Alert absolute */}
         {hasUrgentAlert && <div className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-pulse m-2"></div>}
         
         {/* Has Viewing Task absolute */}
         {hasViewingTask && <div className="absolute top-0 right-3 w-2 h-2 bg-indigo-500 rounded-full m-2" title="مهمة إطلاع معلقة"></div>}
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div
        key={c.id}
        onClick={() => navigate(`/case/${c.id}`)}
        className={`group relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${bgClass} ${borderClass} ${cardOpacity} ${grayscale}`}
      >
         {/* Checkbox */}
         <div className="absolute top-3 left-3 z-30" onClick={(e) => toggleSelection(e, c.id)}>
           {selectedCaseIds.includes(c.id) ? (
             <CheckSquare className="w-5 h-5 text-emerald-600 bg-white rounded shadow-sm" />
           ) : (
             <Square className="w-5 h-5 text-slate-300 bg-white rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
           )}
         </div>
         
         {hasUrgentAlert && <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>}

         {/* Header */}
         <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-black text-base text-navy-900 flex items-center gap-1.5">
                {c.isImportant && <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                {caseNum || 'بدون رقم'}
                {year && <span className="text-[10px] text-slate-400">لسنة {year}</span>}
              </h3>
              <span className={`inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded ${badgeBgClass}`}>{role || 'ملف دعوى'}</span>
            </div>
            <button
               onClick={(e) => { e.stopPropagation(); setQuickLocationEditId(c.id); }}
               className={`w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition mt-1 mr-4`}
               title={`مكان الملف: ${fileLocation || 'لم يحدد'} (انقر للتغيير)`}
             >
               <MapPin className="w-3 h-3" />
             </button>
         </div>

         {/* Opponents */}
         <div className="flex flex-col gap-1 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3">
           <div className="flex gap-1"><span className="text-emerald-600 font-bold shrink-0">الطاعن:</span><span className="font-black truncate">{appellant || '---'}</span></div>
           <div className="flex gap-1"><span className="text-rose-500 font-bold shrink-0">ضد:</span><span className="font-bold truncate">{appellee || '---'}</span></div>
         </div>

         {/* Footer */}
         <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1 font-bold text-slate-600">
               <CalendarDays className="w-3 h-3" />
               <span dir="ltr">{formattedLastSession || 'لم تحدد'}</span>
            </div>
            {decision && <span className={`truncate max-w-[120px] font-black ${isJudgment ? 'text-rose-600' : 'text-slate-600'}`}>{decision}</span>}
         </div>
      </div>
    );
  }

  return (
    <div
      key={c.id}
      onClick={() => navigate(`/case/${c.id}`)}
      className="group relative cursor-pointer pt-4"
    >
      {/* Checkbox */}
      <div
        className="absolute top-1 left-2 z-30"
        onClick={(e) => toggleSelection(e, c.id)}
      >
        {selectedCaseIds.includes(c.id) ? (
          <CheckSquare className="w-6 h-6 text-emerald-600 bg-white rounded-md shadow-sm" />
        ) : (
          <Square className="w-6 h-6 text-slate-300 bg-white rounded-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Alert Badge */}
      {hasUrgentAlert && (
        <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm animate-pulse z-30 flex items-center gap-1 border-2 border-white">
          <AlertTriangle className="w-3 h-3" /> هام
        </div>
      )}

      {/* Viewing Task Button / Badge */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasViewingTask) {
            toast('هناك مهمة إطلاع مسجلة بالفعل. لا يمكنك إضافة مهمة جديدة إلا بعد حذف أو إنجاز المهمة الحالية.', 'error');
          } else {
            setSingleViewingCaseId(c.id);
          }
        }}
        className={`absolute top-1/2 -right-2.5 -translate-y-1/2 p-1.5 rounded-full shadow-sm z-30 flex items-center justify-center border-2 border-white transition-all duration-300 ${hasViewingTask ? 'bg-indigo-600 text-white opacity-100' : 'bg-slate-100 text-slate-500 hover:bg-indigo-500 hover:text-white opacity-0 group-hover:opacity-100 hover:scale-110'}`}
        title={hasViewingTask ? "مهمة إطلاع معلقة (انقر للتنبيه)" : "إنشاء مهمة إطلاع جديدة"}
      >
        <Camera className="w-3.5 h-3.5" />
      </button>

      {/* Card Body */}
      <div className={`relative ${bgClass} border ${borderClass} rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 z-20 h-full flex flex-col group-hover:-translate-y-1 overflow-hidden ${cardOpacity} ${grayscale}`}>

        {/* Judgment Ribbon (Top Left physically) */}
        {finalStampData && !isNoInterest && (
          <div className={`absolute top-4 -left-8 w-32 -rotate-45 text-center py-1.5 shadow-md z-40 bg-${stampColor}-600 text-white`}>
            <div className="text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 mt-0.5">{finalStampData.type || 'حكم'}</div>
          </div>
        )}

        {/* File Location Ribbon (Top Right physically) */}
        {locationRibbon && (
          <div className={`absolute top-4 -right-8 w-32 rotate-45 text-center py-1.5 text-[10px] font-black shadow-md z-40 ${locationRibbon.color} ${locationRibbon.textColor}`}>
            {locationRibbon.text}
          </div>
        )}

        {/* Top Accent Line */}
        <div className={`absolute top-0 left-0 w-full h-1 z-10 bg-gradient-to-r from-${roleColor}-400 to-${roleColor}-500`}></div>

        {/* Cover Area (Image or Beautiful CSS Fallback) */}
        <div className="mb-4 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 aspect-[3/4] relative border-b border-slate-100 shrink-0 overflow-hidden flex flex-col items-center justify-center bg-slate-50">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="غلاف الملف" className="w-full h-full object-cover absolute inset-0 z-0" />
          ) : (
            <>
              <div className={`absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200 z-0`}></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 z-0"></div>
              <div className={`absolute bottom-0 left-0 w-40 h-40 bg-${roleColor}-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 z-0`}></div>

              <div className={`w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3 text-${roleColor}-500 ring-1 ring-black/5 z-10`}>
                <Gavel className="w-7 h-7 opacity-80" />
              </div>

              <div className="text-center px-4 z-10">
                <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">ملف دعوى</p>
                <h4 className="text-xl font-black text-slate-700 tracking-tight">{caseNum || 'بدون رقم'}</h4>
                {year && <p className="text-xs font-bold text-slate-500 mt-0.5">لسنة {year}</p>}
              </div>
            </>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-navy-900/80 via-transparent to-transparent pointer-events-none z-10"></div>

          {/* Tags over cover (always show) */}
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end z-20">
            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border backdrop-blur-md shadow-sm ${isAppellant ? 'bg-rose-500/90 text-white border-rose-400' : isAppellee ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-amber-500/90 text-white border-amber-400'}`}>
              {role || 'ملف دعوى'}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setQuickLocationEditId(c.id); }}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border backdrop-blur-md shadow-sm transition ${fileLocation === 'غير موجود' ? 'bg-rose-500/90 text-white border-rose-400' :
                  fileLocation === 'مؤقت' ? 'bg-amber-500/90 text-white border-amber-400' :
                    fileLocation === 'في المكتب' ? 'bg-emerald-500/90 text-white border-emerald-400' :
                      fileLocation?.includes('شعبة') ? 'bg-slate-700/90 text-white border-slate-600' :
                        'bg-black/50 text-white border-white/20 hover:bg-black/70'
                }`}
              title={`مكان الملف: ${fileLocation || 'لم يحدد'} (انقر للتغيير)`}
            >
              {fileLocation === 'غير موجود' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                fileLocation === 'مؤقت' ? <FilesIcon className="w-3.5 h-3.5" /> :
                  fileLocation === 'في المكتب' ? <CheckSquare className="w-3.5 h-3.5" /> :
                    fileLocation?.includes('شعبة') ? <FolderClosed className="w-3.5 h-3.5" /> :
                      <MapPin className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Header: Number, Year (Simplified since fallback is in the cover now) */}
        <div className={`flex flex-col gap-3 mb-4 pt-1`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div>
                <h3 className="font-black text-lg sm:text-xl text-navy-900 leading-tight flex items-center gap-1.5 flex-wrap">
                  {c.isImportant && <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" title="دعوى هامة" />}
                  {caseNum || 'بدون رقم'}
                  {year && <span className="text-xs sm:text-sm font-bold text-slate-400 mr-1.5">لسنة {year}</span>}
                  {hasJoinedCases && (
                    <span className="bg-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 border border-indigo-200" title={`دعاوى منضمة: ${joinedCasesStr}`}>
                      <FilesIcon className="w-3 h-3" /> مجمعة
                    </span>
                  )}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Opponents & Details */}
        <div className="mt-auto space-y-3 pt-3 border-t border-slate-100">
          <div className="flex flex-col gap-1.5 text-[11px] sm:text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div className="flex items-start gap-1.5">
              <span className="text-emerald-600 font-bold shrink-0 whitespace-nowrap">الطاعن:</span>
              <span className="font-black text-navy-900 line-clamp-1 leading-relaxed" title={appellant}>{appellant || '---'}</span>
            </div>
            <div className="flex items-start gap-1.5 border-t border-slate-200/60 pt-1.5">
              <span className="text-rose-500 font-bold shrink-0 whitespace-nowrap">ضد:</span>
              <span className="font-bold text-slate-700 line-clamp-1 leading-relaxed" title={appellee}>{appellee || '---'}</span>
            </div>
          </div>

          <div className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-xs ${isJudgment ? 'bg-rose-50 border-rose-100 text-rose-700 font-black' : 'bg-slate-50 border-slate-200 text-slate-700 font-bold'}`}>
            <div className="flex items-center gap-1.5 truncate pr-1">
              <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-70 shrink-0" />
              <span className="truncate" dir="ltr">{formattedLastSession || 'لم تحدد'}</span>
              {sessionRoll && (
                <span className="bg-slate-200/50 text-slate-600 px-1.5 py-0.5 rounded text-[10px] mr-1 border border-slate-200 font-black shrink-0">
                  رول: {sessionRoll}
                </span>
              )}
            </div>
            {decision && (
              <span className={`px-2 py-1 rounded shadow-sm shrink-0 mr-1 flex items-center gap-1 border truncate max-w-[90px] sm:max-w-[130px] ${isJudgment ? 'bg-rose-500 text-white border-rose-600' : 'bg-white border-slate-200 text-navy-900'}`}>
                {isJudgment && <Gavel className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />}
                {decision}
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
