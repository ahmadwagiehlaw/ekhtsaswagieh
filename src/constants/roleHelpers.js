export const isAppellantRole = (role, settings = {}) => {
  if (!role) return false;
  const appRole = settings?.roles?.[0] || 'طاعن';
  const roleStr = String(role).trim().toLowerCase();
  
  return roleStr.includes(appRole) || 
         roleStr.includes('طاعن') || 
         roleStr.includes('مستأنف') || 
         roleStr.includes('مدعي');
};

export const isAppelleeRole = (role, settings = {}) => {
  if (!role) return false;
  const apeRole = settings?.roles?.[1] || 'مطعون ضده';
  const roleStr = String(role).trim().toLowerCase();
  
  return roleStr.includes(apeRole) || 
         roleStr.includes('مطعون ضد') || 
         roleStr.includes('مستأنف ضد') || 
         roleStr.includes('مدعى علي');
};

export const isNoInterestRole = (role) => {
  if (!role) return false;
  const roleStr = String(role).trim().toLowerCase();
  return roleStr === 'لا شأن' || roleStr === 'لاشأن';
};

export const isOutOfJurisdictionRole = (role) => {
  if (!role) return false;
  const roleStr = String(role).trim().toLowerCase();
  return roleStr === 'خارج الاختصاص' || roleStr.includes('خارج الاختصاص');
};
