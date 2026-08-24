export const DEFAULT_SCHEMA = [
  { id: 'رقم الدعوى', label: 'رقم الدعوى', type: 'text', visible: true, primary: true },
  { id: 'تاريخ رفع الدعوى', label: 'تاريخ رفع الدعوى', type: 'date', visible: true, isDate: true },
  { id: 'السنة', label: 'السنة', type: 'text', visible: true, primary: true },
  { id: 'المدعي', label: 'المدعي', type: 'text', visible: true },
  { id: 'المدعى_عليه', label: 'المدعى عليه', type: 'text', visible: true },
  { id: 'آخر جلسة', label: 'تاريخ آخر جلسة', type: 'date', visible: true, isDate: true },
  { id: 'القرار', label: 'القرار', type: 'text', visible: true },
  { id: 'الصفة', label: 'الصفة', type: 'text', visible: true },
  { id: 'تصنيف الدعوى', label: 'تصنيف الدعوى', type: 'text', visible: true },
  { id: 'موضوع الدعوى', label: 'موضوع الدعوى', type: 'textarea', visible: true },
  { id: 'عنوان المدعي', label: 'عنوان المدعي / الطاعن', type: 'text', visible: true },
  { id: 'مكان الملف', label: 'مكان الملف', type: 'text', visible: true },
  { id: 'دعاوى منضمة', label: 'دعاوى منضمة', type: 'text', visible: true },
  { id: 'محكمة أول درجة', label: 'محكمة أول درجة', type: 'text', visible: true },
  { id: 'جلسة حكم أول درجة', label: 'جلسة حكم أول درجة', type: 'date', visible: true },
  { id: 'منطوق حكم أول درجة', label: 'منطوق حكم أول درجة', type: 'textarea', visible: true },
  { id: 'ملخص الطعن', label: 'ملخص الطعن وتفاصيله', type: 'textarea', visible: true },
  { id: 'طلبات الطاعن', label: 'طلبات دعوى أول درجة', type: 'textarea', visible: true },
  { id: 'طلبات المدعي', label: 'طلبات المدعي/الطاعن', type: 'textarea', visible: true },
  { id: 'نوع الجلسة', label: 'نوع الجلسة', type: 'text', visible: true },
];

export const OBSOLETE_FIELDS = ['الحكم', 'المنطوق', 'الرول', 'جلسة الحكم', 'الإجراءات الهامة والعاجلة', 'مرحلة التقاضي', 'نوع الحكم', 'تصنيف الحكم', 'حكم محكمة أول درجة', 'المقر المختار', 'عنوان المدعى عليه'];

export const cleanSchemaFields = (fields) => {
  if (!fields || !Array.isArray(fields)) return DEFAULT_SCHEMA;
  
  let cleanSchema = fields.filter(f => f && !OBSOLETE_FIELDS.includes(f.id));
  
  const essentialFields = DEFAULT_SCHEMA.filter(f => !OBSOLETE_FIELDS.includes(f.id));
  
  essentialFields.forEach(ef => {
     const existing = cleanSchema.find(s => s.id === ef.id);
     if (!existing) {
        cleanSchema.push(ef);
     } else if (existing.type !== ef.type && (ef.id === 'المقر المختار' || ef.id === 'عنوان المدعى عليه')) {
        existing.type = 'textarea';
     }
  });

  return cleanSchema;
};
