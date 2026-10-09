import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import AppHeader from './components/AppHeader.tsx';
import LandingPage from './components/LandingPage.tsx';
import ReportPage from './components/ReportPage.tsx';
import { appName } from './config/measures.ts';

export default function App() {
  // index.html carries a static title for the first paint; the configured name
  // takes over as soon as the app mounts.
  useEffect(() => {
    document.title = appName;
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-16">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
