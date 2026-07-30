import React, { useState } from 'react';
import { X, Search, CalendarDays, User, Scale, Hash, MapPin, Building2, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppState';

export default function AdvancedSearchModal({ isOpen, onClose, onSearch }) {
  const { settings, cases } = useAppContext();
  
  const [formData, setFormData] = useState({
    caseNo: '',
    year: '',
    opponentName: '',
    opponentRole: 'all', // 'all', 'appellant', 'appellee'
    decision: '',
    sessionDateStart: '',
    sessionDateEnd: '',
    court: '',
    location: ''
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToggleRole = (role) => {
    setFormData(prev => ({ ...prev, opponentRole: role }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(formData);
    onClose();
  };

  const handleReset = () => {
    setFormData({
      caseNo: '',
      year: '',
      opponentName: '',
      opponentRole: 'all',
      decision: '',
      sessionDateStart: '',
      sessionDateEnd: '',
      court: '',
      location: ''
    });
  };

  // Get unique options
  const uniqueCourts = [...new Set(cases.map(c => c['المحكمة']).filter(Boolean))];
  const uniqueLocations = [...new Set(cases.map(c => c['مكان الملف']).filter(Boolean))];
  const decisions = settings?.decisions || [];

  return (
    <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-l from-indigo-600 to-indigo-800 p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">البحث الذكي <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Beta</span></h2>
              <p className="text-xs text-indigo-200 mt-1 font-bold">استخدم فلاتر متعددة للوصول الدقيق للملفات</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50 custom-scrollbar">
          <form id="advanced-search-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Case Identifiers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-navy-900 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-slate-400" /> رقم الدعوى
                </label>
                <input 
                  type="text"
                  name="caseNo"
                  value={formData.caseNo}
                  onChange={handleChange}
                  placeholder="مثال: 1234"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-navy-900 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-slate-400" /> السنة
                </label>
                <input 
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  placeholder="مثال: 70"
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Opponent */}
            <div className="space-y-4">
              <label className="text-xs font-black text-navy-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" /> اسم الخصم
              </label>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text"
                  name="opponentName"
                  value={formData.opponentName}
                  onChange={handleChange}
                  placeholder="ابحث بجزء من اسم الخصم..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
                
                {/* Toggle Group */}
                <div className="flex bg-slate-200 p-1 rounded-xl shrink-0">
                  <button 
                    type="button"
                    onClick={() => handleToggleRole('all')}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${formData.opponentRole === 'all' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-navy-700'}`}
                  >
                    أي صفة
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleToggleRole('appellant')}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${formData.opponentRole === 'appellant' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-navy-700'}`}
                  >
                    طاعن/مدعي
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleToggleRole('appellee')}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all ${formData.opponentRole === 'appellee' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-navy-700'}`}
                  >
                    مطعون ضدنا
                  </button>
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Session Dates */}
            <div className="space-y-4">
              <label className="text-xs font-black text-navy-900 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-400" /> تاريخ الجلسة (نطاق زمني)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500">من تاريخ</span>
                  <input 
                    type="date"
                    name="sessionDateStart"
                    value={formData.sessionDateStart}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500">إلى تاريخ</span>
                  <input 
                    type="date"
                    name="sessionDateEnd"
                    value={formData.sessionDateEnd}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Advanced Categorical */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-navy-900 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-slate-400" /> القرار / الحكم
                </label>
                <select 
                  name="decision"
                  value={formData.decision}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="">الكل</option>
                  <option value="حكم">أي حكم</option>
                  <option value="للحكم">محجوز للحكم</option>
                  {decisions.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-navy-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" /> المحكمة
                </label>
                <select 
                  name="court"
                  value={formData.court}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="">الكل</option>
                  {uniqueCourts.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-navy-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" /> مكان الملف
                </label>
                <select 
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="">الكل</option>
                  {uniqueLocations.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <button 
            type="submit"
            form="advanced-search-form"
            className="w-full sm:w-auto flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-sm shadow-indigo-200"
          >
            <Sparkles className="w-4 h-4 text-amber-300" /> بحث سحري
          </button>
          <button 
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
          >
            مسح الحقول
          </button>
        </div>

      </div>
    </div>
  );
}
