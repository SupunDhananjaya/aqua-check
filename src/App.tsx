import Counter from './components/Counter.tsx';

export default function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-8">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">aqua-check</h1>
      <p className="text-slate-600">Vite + React + TypeScript + Tailwind</p>
      <Counter />
    </main>
  );
}
