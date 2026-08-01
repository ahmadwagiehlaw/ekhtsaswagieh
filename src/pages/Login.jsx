import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Key, Mail, ShieldAlert, Users, UserPlus, Fingerprint } from 'lucide-react';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { db, INVITES_REF } from '../lib/firebase';

export default function Login() {
  const [activeTab, setActiveTab] = useState('consultant'); // 'consultant', 'employee', 'new'
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [username, setUsername] = useState('');
  const [tenantCode, setTenantCode] = useState('');
  
  const [inviteCode, setInviteCode] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleConsultantLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const generatedEmail = `${username.toLowerCase().trim()}@${tenantCode.trim()}.ekhtsas.local`;
      await login(generatedEmail, password);
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('بيانات الدخول غير صحيحة. تأكد من اسم المستخدم، كلمة المرور، وكود المستشار.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConsultant = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      // Check invite code
      const inviteRef = doc(INVITES_REF, inviteCode);
      const inviteSnap = await getDoc(inviteRef);
      
      if (!inviteSnap.exists()) {
        throw new Error('كود الدعوة غير صحيح');
      }
      
      const inviteData = inviteSnap.data();
      if (inviteData.used) {
        throw new Error('كود الدعوة هذا تم استخدامه مسبقاً');
      }

      // Proceed with signup
      await signup(email, password, 'consultant', inviteData.tenantId);
      
      // Mark invite as used
      await setDoc(inviteRef, { used: true }, { merge: true });
      
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء التسجيل. قد يكون البريد مستخدم مسبقاً.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-100 max-w-md w-full animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 rotate-3">
            <ShieldAlert className="w-8 h-8 text-white -rotate-3" />
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-center text-slate-800 mb-2">منصة إختصاصي</h1>
        
        <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
          <button 
            onClick={() => { setActiveTab('consultant'); setError(''); }}
            className={`flex-1 text-sm font-bold py-2 rounded-lg transition-all ${activeTab === 'consultant' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            دخول مستشار
          </button>
          <button 
            onClick={() => { setActiveTab('employee'); setError(''); }}
            className={`flex-1 text-sm font-bold py-2 rounded-lg transition-all ${activeTab === 'employee' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            دخول موظف
          </button>
          <button 
            onClick={() => { setActiveTab('new'); setError(''); }}
            className={`flex-1 text-sm font-bold py-2 rounded-lg transition-all ${activeTab === 'new' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            حساب جديد
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-sm font-bold mb-6 text-center border border-rose-200 animate-shake">
            {error}
          </div>
        )}

        {/* Consultant Login */}
        {activeTab === 'consultant' && (
          <form onSubmit={handleConsultantLogin} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="admin@example.com"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
              <div className="relative">
                <Key className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="••••••••"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-5 h-5" /> دخول مساحة العمل</>}
            </button>
          </form>
        )}

        {/* Employee Login */}
        {activeTab === 'employee' && (
          <form onSubmit={handleEmployeeLogin} className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم (باللغة الإنجليزية)</label>
              <div className="relative">
                <Users className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="مثال: omar"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كود المستشار</label>
              <div className="relative">
                <Fingerprint className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={tenantCode}
                  onChange={(e) => setTenantCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="مثال: tenant_x8s9d"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
              <div className="relative">
                <Key className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="••••••••"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-5 h-5" /> دخول مساحة العمل</>}
            </button>
          </form>
        )}

        {/* New Consultant */}
        {activeTab === 'new' && (
          <form onSubmit={handleNewConsultant} className="space-y-4 animate-fade-in">
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 mb-4">
              <p className="text-xs font-bold text-amber-800 leading-relaxed text-center">
                لإنشاء مساحة عمل خاصة بك، يجب أن تمتلك "كود دعوة" مسبق من الإدارة.
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كود الدعوة</label>
              <div className="relative">
                <ShieldAlert className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="INV-XXXXX"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">البريد الإلكتروني الشخصي</label>
              <div className="relative">
                <Mail className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="your@email.com"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
              <div className="relative">
                <Key className="absolute right-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-12 pl-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all"
                  placeholder="••••••••"
                  required
                  dir="ltr"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus className="w-5 h-5" /> إنشاء حساب ومساحة عمل</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
