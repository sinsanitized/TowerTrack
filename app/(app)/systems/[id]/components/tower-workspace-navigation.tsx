import Link from "next/link";
import type { TowerDetailView } from "@/lib/tower-details";

const viewCopy: Record<
  TowerDetailView,
  { title: string; description: string }
> = {
  overview: {
    title: "Tower overview",
    description:
      "See what needs attention now, the next upcoming work, and the latest compliance dates.",
  },
  obligations: {
    title: "Required work",
    description:
      "Review unfinished work, dependencies, deadlines, and compatible completion dates.",
  },
  history: {
    title: "Compliance records",
    description:
      "Review completed samples, results, inspections, cleaning, submissions, corrections, and audit history.",
  },
  information: {
    title: "Tower information",
    description:
      "Review the facility, equipment, identifiers, and service responsibilities.",
  },
  settings: {
    title: "Tower settings",
    description:
      "Manage operating patterns, recommended service dates, jurisdiction, and compliance rules.",
  },
};

export function TowerWorkspaceNavigation({
  systemId,
  view,
  canViewSettings,
}: {
  systemId: string;
  view: TowerDetailView;
  canViewSettings: boolean;
}) {
  const tabs: Array<[string, TowerDetailView]> = [
    ["Overview", "overview"],
    ["Required work", "obligations"],
    ["Records", "history"],
    ["Tower Information", "information"],
  ];
  if (canViewSettings) tabs.push(["Settings", "settings"]);

  return (
    <>
      <nav
        className="panel mb-6 flex gap-1 overflow-x-auto p-2"
        aria-label="Tower workspace"
      >
        {tabs.map(([label, tab]) => (
          <Link
            key={tab}
            className={`min-h-11 min-w-max rounded-lg px-4 py-3 text-sm font-black ${
              view === tab
                ? "bg-emerald-800 text-white"
                : "text-emerald-900 hover:bg-emerald-50"
            }`}
            href={`/systems/${systemId}?view=${tab}`}
            aria-current={view === tab ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mb-6 border-l-4 border-emerald-700 pl-4">
        <h2 className="text-lg font-black">{viewCopy[view].title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {viewCopy[view].description}
        </p>
      </div>
    </>
  );
}
