import { Navigate, Route, Routes } from 'react-router';
import LandingPage from './components/LandingPage.tsx';
import ReportPage from './components/ReportPage.tsx';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-3xl px-4 py-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">aqua-check</h1>
          <p className="text-sm text-slate-500">Waste-water quality check</p>
        </div>
      </header>

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
