import Link from "next/link";
import type { TowerDetailView } from "@/lib/tower-details";

const viewCopy: Record<
  TowerDetailView,
  { title: string; description: string }
> = {
  overview: {
    title: "Overview",
    description: "The next action and important dates.",
  },
  obligations: {
    title: "Work to do",
    description: "Everything still required for this tower.",
  },
  history: {
    title: "Records",
    description: "Completed work and its supporting history.",
  },
  information: {
    title: "Tower details",
    description: "Facility, equipment, identifiers, and responsibilities.",
  },
  settings: {
    title: "Settings",
    description: "Operating pattern, jurisdiction, and rule configuration.",
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
    ["Work to do", "obligations"],
    ["Tower records", "history"],
    ["Tower details", "information"],
    ...(canViewSettings
      ? ([["Settings", "settings"]] as Array<[string, TowerDetailView]>)
      : []),
  ];

  return (
    <>
      <nav
        className="panel mb-6 flex flex-wrap gap-1 overflow-visible p-2"
        aria-label="Tower workspace"
      >
        {tabs.map(([label, tab]) => (
          <Link
            key={tab}
            className={`min-h-11 min-w-max rounded-lg px-4 py-3 text-sm font-black ${
              view === tab
                ? "bg-sky-800 text-white"
                : "text-sky-900 hover:bg-sky-50"
            }`}
            href={`/systems/${systemId}?view=${tab}`}
            aria-current={view === tab ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="mb-6 border-l-4 border-sky-700 pl-4">
        <h2 className="text-lg font-black">{viewCopy[view].title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          {viewCopy[view].description}
        </p>
      </div>
    </>
  );
}
