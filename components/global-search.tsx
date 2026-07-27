"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

export interface GlobalSearchItem {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  keywords: string;
}

function normalize(value: string) {
  return value.toLocaleLowerCase().trim().replaceAll(/\s+/g, " ");
}

export function GlobalSearch() {
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GlobalSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const normalizedQuery = normalize(query);

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Search request failed");
        const data = (await response.json()) as {
          items?: GlobalSearchItem[];
        };
        setResults(data.items ?? []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery]);

  return (
    <div
      className="relative max-w-md flex-1"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form
        role="search"
        onSubmit={async (event) => {
          event.preventDefault();
          let first: GlobalSearchItem | undefined = results[0];
          if (!first && normalizedQuery.length >= 2) {
            const response = await fetch(
              `/api/search?q=${encodeURIComponent(normalizedQuery)}`,
            );
            if (response.ok) {
              const data = (await response.json()) as {
                items?: GlobalSearchItem[];
              };
              first = data.items?.[0];
            }
          }
          if (!first) return;
          setOpen(false);
          window.location.assign(first.href);
        }}
      >
        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
        <input
          aria-label="Search towers"
          aria-autocomplete="list"
          aria-controls="global-search-results"
          aria-expanded={open && Boolean(normalizedQuery)}
          role="combobox"
          autoComplete="off"
          className="field pl-10"
          placeholder="Search building, system, job number…"
          type="search"
          disabled={!hydrated}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        />
      </form>
      {open && normalizedQuery && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Tower search results"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-[var(--surface)] shadow-xl"
        >
          {results.length ? (
            results.map((item) => (
              <a
                key={item.id}
                href={item.href}
                role="option"
                aria-selected="false"
                className="block border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-emerald-50 focus:bg-emerald-50"
                onClick={() => setOpen(false)}
              >
                <span className="block font-black text-slate-950">
                  {item.title}
                </span>
                <span className="mt-1 block text-xs font-bold text-slate-600">
                  {item.subtitle}
                </span>
              </a>
            ))
          ) : loading ? (
            <p className="px-4 py-3 text-sm font-bold text-slate-600">
              Searching…
            </p>
          ) : (
            <p className="px-4 py-3 text-sm font-bold text-slate-600">
              No towers match “{query.trim()}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
