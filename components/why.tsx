export function Why({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer font-bold text-emerald-800">
        Why?
      </summary>
      <div className="mt-2 rounded-lg border-l-4 border-emerald-300 bg-emerald-50 p-3 text-slate-700">
        {children}
      </div>
    </details>
  );
}
