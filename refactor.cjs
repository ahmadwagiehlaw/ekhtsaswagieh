const fs = require('fs');

let code = fs.readFileSync('src/pages/CaseDetails.jsx', 'utf8');

// 1. Add import
if (!code.includes('import CaseInfoTab')) {
  code = code.replace(
    "import SmartAutocomplete from '../components/SmartAutocomplete';",
    "import SmartAutocomplete from '../components/SmartAutocomplete';\nimport CaseInfoTab from '../components/CaseDetailsTabs/CaseInfoTab';"
  );
}

// 2. Replace the details tab content
const startStr = '<div className="bg-transparent space-y-4 mx-4 sm:mx-0 animate-in fade-in slide-in-from-bottom-4 duration-300">';
const endStr = '      {/* Tab Content: Sessions */}';

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const before = code.substring(0, startIndex);
  // endIndex actually points to the start of "      {/* Tab Content: Sessions */}"
  // we need to make sure we don't duplicate the closing tags for "activeTab === 'details'"
  // looking at the file, right before endStr is ")}", so we will just replace the inner content.
  // We'll replace from startStr up to ")} \n      {/* Tab Content: Sessions */}"
  const beforeEndIndex = code.lastIndexOf(')}', endIndex);
  
  const after = code.substring(beforeEndIndex);
  
  const componentStr = `<CaseInfoTab
          activeDetailTab={activeDetailTab}
          setActiveDetailTab={setActiveDetailTab}
          schema={schema}
          editData={editData}
          setEditData={setEditData}
          isEditing={isEditing}
          settings={settings}
          cases={cases}
          effectiveDefendants={effectiveDefendants}
          activeDefId={activeDefId}
          setActiveDefId={setActiveDefId}
          newDefName={newDefName}
          setNewDefName={setNewDefName}
          newJoinedNo={newJoinedNo}
          setNewJoinedNo={setNewJoinedNo}
          newJoinedYear={newJoinedYear}
          setNewJoinedYear={setNewJoinedYear}
          caseData={caseData}
          handleAddUrgentReminder={handleAddUrgentReminder}
          setManagingField={setManagingField}
          isEmptyValue={isEmptyValue}
          legacyJoinedStr={legacyJoinedStr}
        />\n`;

  fs.writeFileSync('src/pages/CaseDetails.jsx', before + componentStr + after);
  console.log("Successfully replaced CaseInfoTab!");
} else {
  console.log("Could not find start or end index.");
}
