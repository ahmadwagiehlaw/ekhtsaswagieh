import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider, useAppContext } from './context/AppState';
import { UIProvider } from './context/UIContext';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';

// Lazy-loaded pages for better performance (reduces initial bundle ~40%)
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Files         = lazy(() => import('./pages/Files'));
const Agenda        = lazy(() => import('./pages/Agenda'));
const Settings      = lazy(() => import('./pages/Settings'));
const CaseDetails   = lazy(() => import('./pages/CaseDetails'));
const CaseReport    = lazy(() => import('./pages/CaseReport'));
const RollsLibrary  = lazy(() => import('./pages/RollsLibrary'));
const Reports       = lazy(() => import('./pages/Reports'));
const DayRoll       = lazy(() => import('./pages/DayRoll'));
const Tasks         = lazy(() => import('./pages/Tasks'));
const Trash         = lazy(() => import('./pages/Trash'));
const Login         = lazy(() => import('./pages/Login'));
const SuperAdmin    = lazy(() => import('./pages/SuperAdmin'));

const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
  </div>
);


function AppContent() {
  const { loading } = useAppContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route element={<RequireAuth><Outlet /></RequireAuth>}>
              <Route index element={<Dashboard />} />
              <Route path="files" element={<Files />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="settings" element={<Settings />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="trash" element={<Trash />} />
              <Route path="case/:id" element={<CaseDetails />} />
              <Route path="case/:id/report" element={<CaseReport />} />
              <Route path="reports" element={<Reports />} />
              <Route path="super-admin" element={<SuperAdmin />} />
            </Route>
            {/* Rolls pages are public */}
            <Route path="rolls" element={<RollsLibrary />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          <Route path="/day-roll/:date" element={<DayRoll />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );

}

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <UIProvider>
            <AppContent />
          </UIProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

