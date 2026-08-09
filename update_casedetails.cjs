const fs = require('fs');

const code = fs.readFileSync('src/pages/CaseDetails.jsx', 'utf8');

// 1. Add import statement at the top
const importStatement = "import SessionsTab from '../components/CaseDetailsTabs/SessionsTab';\n";
let newCode = code;
if (!newCode.includes('import SessionsTab')) {
  newCode = newCode.replace(
    "import CaseInfoTab from '../components/CaseDetailsTabs/CaseInfoTab';",
    "import CaseInfoTab from '../components/CaseDetailsTabs/CaseInfoTab';\n" + importStatement
  );
}

// 2. Find and replace the sessions block
const startStr = "{activeTab === 'sessions' && (";
const startIdx = newCode.indexOf(startStr);
if (startIdx !== -1) {
  const nextTabStr = "{/* Tab Content: Documents */}";
  const nextTabIdx = newCode.indexOf(nextTabStr, startIdx);
  const endIdx = newCode.lastIndexOf(')}', nextTabIdx) + 2;

  const componentStr = `{activeTab === 'sessions' && (
        <SessionsTab
          caseData={caseData}
          canEditData={canEditData}
          settings={settings}
          rolls={rolls}
          sessionTypeOptions={sessionTypeOptions}
          isAddSessionOpen={isAddSessionOpen}
          setIsAddSessionOpen={setIsAddSessionOpen}
          fileInputRef={fileInputRef}
          handleSessionFileUpload={handleSessionFileUpload}
          editingSessionIdx={editingSessionIdx}
          setEditingSessionIdx={setEditingSessionIdx}
          editSessionData={editSessionData}
          setEditSessionData={setEditSessionData}
          activeSessionIdx={activeSessionIdx}
          setActiveSessionIdx={setActiveSessionIdx}
          isUploadingSessionFile={isUploadingSessionFile}
          activeJudgmentSessionIdx={activeJudgmentSessionIdx}
          setActiveJudgmentSessionIdx={setActiveJudgmentSessionIdx}
          activeNoteSessionIdx={activeNoteSessionIdx}
          setActiveNoteSessionIdx={setActiveNoteSessionIdx}
          handleSaveSessionEdit={handleSaveSessionEdit}
          openRollViewer={openRollViewer}
          saveCaseToFirebase={saveCaseToFirebase}
          showConfirm={showConfirm}
          toast={toast}
          showPrompt={showPrompt}
        />
      )}`;

  newCode = newCode.substring(0, startIdx) + componentStr + newCode.substring(endIdx);
  
  fs.writeFileSync('src/pages/CaseDetails.jsx', newCode, 'utf8');
  console.log("Successfully replaced SessionsTab in CaseDetails.jsx");
} else {
  console.error("Could not find sessions tab block.");
}
