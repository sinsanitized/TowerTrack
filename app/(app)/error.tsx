"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function OperationalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("TowerTrack operational screen failed", error);
  }, [error]);

  return (
    <section className="panel mx-auto max-w-2xl p-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 shrink-0 text-red-700" size={24} />
        <div>
          <h1 className="text-xl font-black">This screen could not load</h1>
          <p className="mt-2 text-sm text-slate-600">
            No compliance record was changed. Try again; if it keeps failing,
            give support the reference below.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-slate-500">
              Reference: {error.digest}
            </p>
          )}
          <button className="btn btn-primary mt-5" onClick={reset}>
            <RotateCcw size={16} /> Retry
          </button>
        </div>
      </div>
    </section>
  );
}
