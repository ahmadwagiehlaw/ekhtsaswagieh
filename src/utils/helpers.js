export const getPrimaryValue = (cObj, possibleKeys) => {
  for (let k of possibleKeys) {
    if (cObj[k] !== undefined && cObj[k] !== null) return cObj[k];
  }
  return '';
};

export const JUDGMENT_COLORS = {
  'صالح': '#10b981', 'ضد': '#ef4444', 'وقف جزائي': '#f97316',
  'وقف تعليقي': '#fb923c', 'خبراء': '#8b5cf6', 'اعتبار': '#eab308',
  'تمهيدي': '#06b6d4', 'لا شأن بالحكم': '#94a3b8', 'غير مصنف': '#cbd5e1',
  'غير منه للخصومة': '#64748b', 'حكم منه للخصومة': '#22c55e',
};

export const getJColor = (name) => {
  for (const [k, v] of Object.entries(JUDGMENT_COLORS)) {
    if (name === k || name.includes(k) || k.includes(name)) return v;
  }
  return '#94a3b8';
};
