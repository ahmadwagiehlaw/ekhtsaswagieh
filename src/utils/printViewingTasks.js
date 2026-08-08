export const printViewingTasksList = (tasks, cases, settings = {}) => {
  if (!tasks || tasks.length === 0) {
    return false;
  }

  const template = settings?.viewingTasksPrintTemplate || {
    title: 'كشف مهام الإطلاع وتصوير المستندات',
    showCreationDate: true,
    showConsultant: true,
    showRoll: true,
    showCaseNumber: true,
    showAppellant: true,
    showAppellee: true,
    showRequiredDocs: true,
    showSessionDate: true,
    showSessionType: true,
    showDecision: true,
    showStatus: true
  };

  const consultantName = settings?.consultantName || '';

  const uniqueSessionDates = [...new Set(tasks.map(t => {
    const linkedCase = cases.find(c => c.id === t.linkedCases?.[0]) || {};
    return t.caseContext?.date || linkedCase['تاريخ الجلسة'] || linkedCase['آخر جلسة'] || '';
  }).filter(d => d && d !== '---'))];
  const commonSessionDate = uniqueSessionDates.length === 1 ? uniqueSessionDates[0] : null;

  const printWindow = window.open('', '_blank');
  
  // Build columns based on settings
  let tableHeaders = ``;
  if (template.showRoll !== false) tableHeaders += `<th style="width: 60px;">الرول</th>`;
  if (template.showCaseNumber) tableHeaders += `<th>رقم الدعوى والسنة</th>`;
  if (template.showAppellant) tableHeaders += `<th>المدعي</th>`;
  if (template.showAppellee) tableHeaders += `<th>المدعى عليه</th>`;
  if (template.showRequiredDocs) tableHeaders += `<th>المطلوب (الملاحظات)</th>`;
  if (template.showSessionDate) tableHeaders += `<th>تاريخ الجلسة</th>`;
  if (template.showSessionType) tableHeaders += `<th>نوع الجلسة</th>`;
  if (template.showDecision) tableHeaders += `<th>القرار</th>`;
  if (template.showStatus) tableHeaders += `<th>حالة المهمة</th>`;

  // Build rows
  const tableRows = tasks.map((task, index) => {
    const linkedCaseId = task.linkedCases && task.linkedCases[0];
    const linkedCase = cases.find(c => c.id === linkedCaseId) || {};
    
    const caseNumber = linkedCase['رقم الدعوى'] || linkedCase['رقم القضية'] || linkedCase['رقم_الدعوى'] ? `${linkedCase['رقم الدعوى'] || linkedCase['رقم القضية'] || linkedCase['رقم_الدعوى']}` : '---';
    const caseYear = linkedCase['السنة'] || linkedCase['سنة'] || linkedCase['year'] ? ` لسنة ${linkedCase['السنة'] || linkedCase['سنة'] || linkedCase['year']}` : '';
    const fullCaseNumber = caseNumber !== '---' ? `${caseNumber}${caseYear}` : (task.caseContext?.roll ? `رول ${task.caseContext.roll}` : '---');

    const appellant = linkedCase['المدعي'] || linkedCase['الطاعن'] || linkedCase['المستأنف'] || '---';
    const appellee = linkedCase['المدعى عليه'] || linkedCase['المطعون ضده'] || linkedCase['المطعون ضدنا'] || linkedCase['المدعى_عليه'] || '---';
    const rollStr = task.caseContext?.roll || linkedCase['الرول'] || linkedCase['رول'] || '---';

    const docsString = task.title.includes(':') ? task.title.split(':').pop().trim() : task.title;
    const sessionDate = task.caseContext?.date || linkedCase['تاريخ الجلسة'] || linkedCase['آخر جلسة'] || '---';
    const sessionType = task.caseContext?.type || linkedCase['نوع الجلسة'] || '---';
    const decision = task.caseContext?.decision || linkedCase['القرار'] || linkedCase['قرار الجلسة'] || '---';
    const statusText = task.status === 'completed' ? 'تم الإطلاع' : 'قيد الانتظار';
    const statusColor = task.status === 'completed' ? '#059669' : '#e11d48';

    let rowHtml = `<tr>`;
    if (template.showRoll !== false) rowHtml += `<td><span style="font-size: 16px; font-weight: 900;">${rollStr}</span></td>`;
    if (template.showCaseNumber) rowHtml += `<td><span class="font-bold">${fullCaseNumber}</span></td>`;
    if (template.showAppellant) rowHtml += `<td>${appellant}</td>`;
    if (template.showAppellee) rowHtml += `<td>${appellee}</td>`;
    if (template.showRequiredDocs) rowHtml += `<td style="font-weight: 900; font-size: 15px;">${docsString}</td>`;
    if (template.showSessionDate) rowHtml += `<td>${sessionDate}</td>`;
    if (template.showSessionType) rowHtml += `<td>${sessionType}</td>`;
    if (template.showDecision) rowHtml += `<td>${decision}</td>`;
    if (template.showStatus) rowHtml += `<td style="color: ${statusColor}; font-weight: bold;">${statusText}</td>`;
    rowHtml += `</tr>`;
    
    return rowHtml;
  }).join('');

  printWindow.document.write(`
    <html dir="rtl">
      <head>
        <title>${template.title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #1e1b4b;
            --border: #334155;
          }
          body { 
            font-family: 'Cairo', sans-serif; 
            padding: 20px; 
            margin: 0;
            background: #fff;
            color: #0f172a;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .header-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            border-bottom: 2px solid var(--primary);
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          h1 { 
            text-align: center; 
            font-size: 26px; 
            font-weight: 900;
            margin: 0 0 10px 0; 
            color: var(--primary);
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            width: 100%;
            font-size: 14px;
            font-weight: 700;
            color: #475569;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
          }
          th, td { 
            border: 2px solid var(--border); 
            padding: 10px; 
            text-align: center; 
            vertical-align: middle;
            font-size: 14px;
          }
          th { 
            background-color: #f8fafc; 
            font-weight: 900; 
            font-size: 15px;
            color: var(--primary);
          }
          td {
            font-weight: 600;
          }
          .font-bold { font-weight: 900 !important; }
          .signatures {
            margin-top: 60px;
            display: flex;
            justify-content: space-around;
            page-break-inside: avoid;
          }
          .sig-box {
            text-align: center;
            font-weight: 900;
            font-size: 16px;
            color: var(--primary);
          }
          .sig-title { margin-bottom: 30px; }
          .sig-line { 
            border-top: 2px dashed #94a3b8; 
            width: 200px;
            margin: 0 auto 10px auto;
          }
          .sig-name { font-weight: 700; font-size: 14px; color: #475569; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="position: fixed; top: 15px; left: 15px; z-index: 9999;">
          <button onclick="window.close()" style="background: #e11d48; color: #fff; padding: 10px 20px; border: none; border-radius: 8px; font-weight: 900; font-size: 14px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: 'Cairo', sans-serif;">
            إغلاق وعودة للتطبيق ✕
          </button>
        </div>
        <div class="header-container">
          <h1>${template.title}</h1>
          <div class="meta-info">
            ${template.showCreationDate !== false ? `<div>تاريخ التحرير: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>` : ''}
            ${commonSessionDate ? `<div>تاريخ الجلسة: <span style="font-weight:900; color:#1e1b4b; padding: 2px 8px; background: #e0e7ff; border-radius: 4px;">${commonSessionDate}</span></div>` : ''}
            ${template.showConsultant && consultantName ? `<div>السيد الأستاذ المستشار / <span style="font-weight:900; color:#1e1b4b;">${consultantName}</span></div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              ${tableHeaders}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        
        <div class="signatures">
          <div class="sig-box">
            <div class="sig-title">توقيع الموظف المختص</div>
            <div class="sig-line"></div>
            <div class="sig-name">........................</div>
          </div>
          ${template.showConsultant ? `
          <div class="sig-box">
            <div class="sig-title">يعتمد ،،، المستشار</div>
            <div class="sig-line"></div>
            <div class="sig-name">${consultantName}</div>
          </div>
          ` : ''}
        </div>
      </body>
    </html>
  `);
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
  return true;
};
