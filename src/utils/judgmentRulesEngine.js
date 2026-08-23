export function applyJudgmentDefaultRules(currentValues, judgmentDefaults) {
  if (!judgmentDefaults?.length) return currentValues;

  const newData = { ...currentValues };
  
  for (const rule of judgmentDefaults) {
    const conds = rule.conditions || {};
    
    // Using SessionTable.jsx logic as the final reference
    const roleMatch = !conds.role || (newData.role && newData.role.includes(conds.role)) || conds.role === newData.role;
    const catMatch = !conds.category || newData.category === conds.category;
    const classMatch = !conds.classification || newData.classification === conds.classification;
    const typeMatch = !conds.type || newData.type === conds.type;
    const sessionTypeMatch = !conds.sessionType || newData.sessionType === conds.sessionType;
    const decisionMatch = !conds.decision || newData.decision === conds.decision;
    
    if (roleMatch && catMatch && classMatch && typeMatch && sessionTypeMatch && decisionMatch && (conds.role || conds.category || conds.classification || conds.type || conds.sessionType || conds.decision)) {
      const acts = rule.actions || {};
      if (acts.category && !newData.category) newData.category = acts.category;
      if (acts.classification && !newData.classification) newData.classification = acts.classification;
      if (acts.type && !newData.type) newData.type = acts.type;
      if (acts.text && !newData.text) newData.text = acts.text;
      break;
    }
  }
  return newData;
}