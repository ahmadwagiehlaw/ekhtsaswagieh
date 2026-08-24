export function applyJudgmentDefaultRules(currentValues, judgmentDefaults) {
  if (!judgmentDefaults?.length) return currentValues;

  const newData = { ...currentValues };
  
  // Sort rules by specificity (number of defined conditions) descending
  const sortedRules = [...judgmentDefaults].sort((a, b) => {
    const countA = Object.values(a.conditions || {}).filter(v => v && String(v).trim() !== '').length;
    const countB = Object.values(b.conditions || {}).filter(v => v && String(v).trim() !== '').length;
    return countB - countA;
  });

  for (const rule of sortedRules) {
    const conds = rule.conditions || {};
    
    const roleMatch = !conds.role || (newData.role && newData.role.includes(conds.role)) || conds.role === newData.role;
    const catMatch = !conds.category || newData.category === conds.category || (newData.category && newData.category.includes(conds.category)) || (conds.category && conds.category.includes(newData.category));
    const classMatch = !conds.classification || newData.classification === conds.classification || (newData.classification && newData.classification.includes(conds.classification)) || (conds.classification && conds.classification.includes(newData.classification));
    const typeMatch = !conds.type || newData.type === conds.type || (newData.type && newData.type.includes(conds.type)) || (conds.type && conds.type.includes(newData.type));
    const sessionTypeMatch = !conds.sessionType || newData.sessionType === conds.sessionType;
    const decisionMatch = !conds.decision || newData.decision === conds.decision;
    
    const hasConditions = conds.role || conds.category || conds.classification || conds.type || conds.sessionType || conds.decision;

    if (hasConditions && roleMatch && catMatch && classMatch && typeMatch && sessionTypeMatch && decisionMatch) {
      const acts = rule.actions || {};
      
      if (acts.category && acts.category !== '-- بدون تغيير --') newData.category = acts.category;
      if (acts.classification && acts.classification !== '-- بدون تغيير --') newData.classification = acts.classification;
      if (acts.type && acts.type !== '-- بدون تغيير --') newData.type = acts.type;
      if (acts.text && acts.text !== '-- بدون تغيير --') newData.text = acts.text;
      
      break; // Apply only the most specific matching rule
    }
  }
  return newData;
}
