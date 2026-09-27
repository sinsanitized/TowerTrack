"use client";

import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

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
          <h1 className="text-xl font-black">
            TowerTrack could not save or load this screen
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            No changes were saved. Go back, review the required fields, and try
            again. Your browser may preserve what you entered.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-slate-500">
              Reference: {error.digest}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="btn btn-primary"
              onClick={() => window.history.back()}
            >
              <ArrowLeft size={16} /> Go back to the form
            </button>
            <button className="btn" onClick={reset}>
              <RotateCcw size={16} /> Retry this screen
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
