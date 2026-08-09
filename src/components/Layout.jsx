import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FolderOpen, CalendarDays, Settings, Plus, LayoutDashboard, Scale, Bell, Search, BookOpen, Download, ClipboardList, BarChart2, Trash2, ShieldAlert } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import { useAuth } from '../context/AuthContext';
import AddCaseModal from './AddCaseModal';
import NotificationCenter from './NotificationCenter';
import TasksManagerModal from './TasksManagerModal';
import OnboardingModal from './OnboardingModal';

export default function Layout() {
  const { settings, isAdmin, currentUserPermissions } = useAppContext();
  const { userData } = useAuth();
  const isSuperAdmin = userData?.role === 'super_admin';
  const canDeleteData = isAdmin || currentUserPermissions?.canDeleteData;
  const canEditData = isAdmin || currentUserPermissions?.canEditData;
  const location = useLocation();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  // Hide bottom nav on case details page for full screen view, just like the original app
  const isDetailsPage = location.pathname.startsWith('/case/');

  return (
    <div 
      className="min-h-screen bg-slate-50 font-sans text-slate-800"
      style={{ 
        paddingTop: 'calc(70px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' 
      }}
    >
      
      {/* Top Header */}
      <header 
        className="fixed top-0 inset-x-0 bg-navy-900 shadow-md z-40 flex items-center justify-between px-4 sm:px-6 no-print"
        style={{ 
          height: 'calc(64px + env(safe-area-inset-top, 0px))', 
          paddingTop: 'env(safe-area-inset-top, 0px)' 
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-navy-900" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-base sm:text-xl font-black text-white tracking-tight leading-none pb-1">اختصاص</h1>
            <div className="h-[1px] w-full bg-gradient-to-l from-amber-400/70 to-transparent rounded-full"></div>
            <span className="text-[11px] sm:text-[13px] font-bold text-amber-400 leading-none mt-1">
              {settings?.consultantName || 'أحمد وجيه'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button 
              onClick={() => navigate('/super-admin')}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-800/50 hover:bg-indigo-700 transition-colors text-amber-400"
              title="لوحة التحكم العليا"
            >
              <ShieldAlert className="w-5 h-5" />
            </button>
          )}
          {deferredPrompt && (
            <button 
              onClick={handleInstallClick}
              className="hidden sm:flex items-center gap-1.5 bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-600 transition"
              title="تثبيت التطبيق"
            >
              <Download className="w-4 h-4" /> تثبيت
            </button>
          )}
          <button 
            onClick={() => setIsTasksModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
            title="المهام"
          >
            <ClipboardList className="w-5 h-5" />
          </button>
          {canDeleteData && (
            <button 
              onClick={() => navigate('/trash')}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-rose-400"
              title="سلة المحذوفات"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => navigate('/rolls')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
            title="مكتبة الرولات"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button 
            onClick={() => {
              navigate('/files');
              setTimeout(() => document.getElementById('search-cases-input')?.focus(), 300);
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-white"
            title="بحث"
          >
            <Search className="w-5 h-5" />
          </button>
          <NotificationCenter />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 pb-4 space-y-4">
        <Outlet />
      </main>

      <OnboardingModal />

      {/* Floating Action Button */}
      {!isDetailsPage && canEditData && (
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="fixed bottom-24 left-6 md:left-12 w-14 h-14 bg-amber-500 text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-amber-600 hover:-translate-y-1 transition-all z-40"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Add Case Modal */}
      {isAddModalOpen && (
        <AddCaseModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      )}

      {/* Bottom Navigation (Dark Theme) */}
      <nav 
        className="fixed bottom-0 inset-x-0 bg-navy-900 border-t border-navy-800 px-2 sm:px-6 flex justify-around items-center z-40 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.3)] no-print"
        style={{ 
          height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
          
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              `flex flex-col items-center justify-center w-20 p-1.5 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`
            }
          >
            {({ isActive }) => (
              <>
                <LayoutDashboard className={`w-6 h-6 mb-1 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  الرئيسية
                </span>
              </>
            )}
          </NavLink>

          <NavLink 
            to="/files" 
            className={({ isActive }) => 
              `flex flex-col items-center justify-center w-20 p-1.5 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`
            }
          >
            {({ isActive }) => (
              <>
                <FolderOpen className={`w-6 h-6 mb-1 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  الملفات
                </span>
              </>
            )}
          </NavLink>

          <NavLink 
            to="/agenda" 
            className={({ isActive }) => 
              `flex flex-col items-center justify-center w-20 p-1.5 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`
            }
          >
            {({ isActive }) => (
              <>
                <CalendarDays className={`w-6 h-6 mb-1 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  الأجندة
                </span>
              </>
            )}
          </NavLink>

          <NavLink 
            to="/reports" 
            className={({ isActive }) => 
              `flex flex-col items-center justify-center w-20 p-1.5 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`
            }
          >
            {({ isActive }) => (
              <>
                <BarChart2 className={`w-6 h-6 mb-1 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  مركز التقارير
                </span>
              </>
            )}
          </NavLink>

          <NavLink 
            to="/settings" 
            className={({ isActive }) => 
              `flex flex-col items-center justify-center w-20 p-1.5 rounded-xl transition ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`
            }
          >
            {({ isActive }) => (
              <>
                <Settings className={`w-6 h-6 mb-1 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {isAdmin ? 'الإدارة' : 'إعدادات'}
                </span>
              </>
            )}
          </NavLink>

        </nav>

      <AddCaseModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
      <TasksManagerModal isOpen={isTasksModalOpen} onClose={() => setIsTasksModalOpen(false)} />
    </div>
  );
}
