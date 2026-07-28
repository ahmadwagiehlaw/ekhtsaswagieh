import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppState';
import { ShieldCheck, BookOpen } from 'lucide-react';

export default function RequireAuth({ children }) {
  const { isAdmin, isEmployee, loginAdmin } = useAppContext();
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();

  if (isAdmin || isEmployee) {
    return children;
  }

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginAdmin(password)) {
      setLoginError('');
      setPassword('');
    } else {
      setLoginError('كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 w-full max-w-sm text-center space-y-6 animate-fade-in">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl mx-auto flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-black text-navy-900">تسجيل الدخول مطلوب</h2>
          <p className="text-xs font-bold text-slate-500 mt-2">عفواً، يجب إدخال كلمة المرور للوصول إلى هذا القسم.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-sm font-bold focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition shadow-sm"
            />
            {loginError && <p className="text-rose-500 text-[11px] font-bold mt-2">{loginError}</p>}
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow-sm">دخول</button>
        </form>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl w-full max-w-sm text-center animate-fade-in" style={{ animationDelay: '100ms' }}>
        <p className="text-xs font-bold text-amber-800 mb-3 leading-relaxed">
          غير مصرح لك بتصفح ملفات النظام بدون تسجيل الدخول. يمكنك فقط الإطلاع على مكتبة الرولات العامة.
        </p>
        <button 
          onClick={() => navigate('/rolls')}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-2 text-sm"
        >
          <BookOpen className="w-4 h-4" />
          الذهاب إلى مكتبة الرولات
        </button>
      </div>
    </div>
  );
}
