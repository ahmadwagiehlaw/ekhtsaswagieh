import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { FolderOpen, CalendarDays, Settings, Plus, LayoutDashboard, Scale, Bell } from 'lucide-react';
import { useAppContext } from '../context/AppState';
import AddCaseModal from './AddCaseModal';

export default function Layout() {
  const { settings, isAdmin } = useAppContext();
  const location = useLocation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Hide bottom nav on case details page for full screen view, just like the original app
  const isDetailsPage = location.pathname.startsWith('/case/');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-[80px] pt-[70px]">
      
      {/* Top Header */}
      <header className="fixed top-0 inset-x-0 h-[64px] bg-navy-900 shadow-md z-40 flex items-center justify-between px-4 sm:px-6 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
            <Scale className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-black text-white">اختصاص</h1>
            <p className="text-[10px] font-bold text-amber-400/80">مستشار / أحمد وجيه</p>
          </div>
        </div>
        <button className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-white">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-navy-900"></span>
        </button>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 pb-4 space-y-4">
        <Outlet />
      </main>

      {/* Floating Action Button */}
      {!isDetailsPage && (
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="fixed bottom-24 left-6 md:left-12 w-14 h-14 bg-amber-500 text-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-amber-600 hover:-translate-y-1 transition-all z-40"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Bottom Navigation (Dark Theme) */}
      <nav className="fixed bottom-0 inset-x-0 bg-navy-900 border-t border-navy-800 px-2 sm:px-6 py-2.5 flex justify-around items-center z-40 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.3)] no-print">
          
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

      <AddCaseModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}
