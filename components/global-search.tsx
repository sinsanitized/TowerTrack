"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { buttonClass } from "@/lib/button-variants";

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
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GlobalSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const normalizedQuery = normalize(query);

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    setQuery("");
    setResults([]);
    setOpen(false);
  }, [pathname]);
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
        className="flex items-center gap-2"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={18}
          />
          <input
            aria-label="Find a tower"
            aria-autocomplete="list"
            aria-controls="global-search-results"
            aria-expanded={open && Boolean(normalizedQuery)}
            role="combobox"
            autoComplete="off"
            className="field pl-10"
            placeholder="Customer, building, address, tower, or job number"
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
        </div>
        <button
          className={buttonClass("secondary", "min-h-11 shrink-0 px-3")}
          type="submit"
        >
          <Search size={17} aria-hidden />
          <span className="hidden sm:inline">Show matches</span>
          <span className="sm:hidden">Show</span>
        </button>
      </form>
      {open && normalizedQuery && (
        <div
          id="global-search-results"
          role="listbox"
          aria-label="Tower search results"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-[var(--surface)] shadow-xl"
        >
          {results.length ? (
            <>
              <p
                role="presentation"
                className="border-b border-slate-100 px-4 py-2 text-sm font-bold text-slate-600"
              >
                Choose a tower to open it.
              </p>
              {results.map((item) => (
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
              ))}
            </>
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
