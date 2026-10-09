import { appName, standard } from '../config/measures.ts';
import Logo from './Logo.tsx';

export default function AppHeader() {
  return (
    <header className="bg-linear-to-r from-slate-900 via-slate-800 to-sky-800 text-white shadow-lg">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
          <Logo className="size-6 text-sky-300" />
        </span>

        {/* min-w-0 lets the truncation below actually bite on a long configured name. */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{appName}</h1>
          <p className="text-sm text-sky-100/80">Waste-water quality check</p>
        </div>

        {standard === null ? null : (
          <p className="max-w-xs border-t border-white/15 pt-3 text-sm text-sky-100/80 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <span className="block text-[11px] font-semibold tracking-wider text-sky-200/70 uppercase">
              Standard
            </span>
            {standard}
          </p>
        )}
      </div>
    </header>
  );
}
