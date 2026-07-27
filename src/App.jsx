import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppState';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Files from './pages/Files';
import Agenda from './pages/Agenda';
import Settings from './pages/Settings';
import CaseDetails from './pages/CaseDetails';

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
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="files" element={<Files />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="settings" element={<Settings />} />
          <Route path="case/:id" element={<CaseDetails />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
