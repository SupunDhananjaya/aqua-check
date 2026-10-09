/**
 * The water-drop mark, matching the icon `scripts/make-icon.mjs` renders into
 * `build/icon.ico` for the desktop build.
 *
 * Inline rather than an asset file so it needs no request, stays crisp at any
 * size, and inherits `currentColor` from whatever it sits in. The app name is
 * always rendered as text beside it, so it carries no accessible name of its own.
 */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M16 2 C 11 9 5 15 5 21 A 11 11 0 0 0 27 21 C 27 15 21 9 16 2 Z" />
    </svg>
  );
}
