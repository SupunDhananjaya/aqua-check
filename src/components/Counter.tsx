import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-slate-700" role="status">
        Count: {count}
      </p>
      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        className="rounded-md bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        Increment
      </button>
    </div>
  );
}
