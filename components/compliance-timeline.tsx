import { CheckCircle2, Circle, Flag, Sparkles } from "lucide-react";
import Link from "next/link";
import { ComplianceDate } from "@/components/compliance-date";

export interface ComplianceTimelineItem {
  id: string;
  label: string;
  detail: string;
  date: string | Date | null;
  state: "SOURCE" | "WINDOW" | "TARGET" | "DEADLINE" | "COMPLETED";
  href?: string;
}

const icon = {
  SOURCE: Sparkles,
  WINDOW: Circle,
  TARGET: Circle,
  DEADLINE: Flag,
  COMPLETED: CheckCircle2,
};

export function ComplianceTimeline({
  title,
  items,
}: {
  title: string;
  items: ComplianceTimelineItem[];
}) {
  return (
    <section className="panel p-5">
      <div className="label">Visual compliance timeline</div>
      <h2 className="mt-1 text-xl font-black">{title}</h2>
      <ol className="mt-5 space-y-0">
        {items.map((item, index) => {
          const Icon = icon[item.state];
          const final = index === items.length - 1;
          return (
            <li key={item.id} className="grid grid-cols-[28px_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`grid size-7 place-items-center rounded-full border ${
                    item.state === "DEADLINE"
                      ? "border-red-300 bg-red-50 text-red-800"
                      : item.state === "COMPLETED"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  <Icon size={14} />
                </span>
                {!final && (
                  <span className="min-h-12 w-px flex-1 bg-slate-300" />
                )}
              </div>
              <div className={final ? "pb-0" : "pb-5"}>
                {item.href ? (
                  <Link
                    className="font-black text-emerald-800 hover:underline"
                    href={item.href}
                  >
                    {item.label} →
                  </Link>
                ) : (
                  <div className="font-black">{item.label}</div>
                )}
                <p className="text-sm text-slate-600">{item.detail}</p>
                <div className="mt-1">
                  <ComplianceDate
                    value={item.date}
                    deadline={item.state === "DEADLINE"}
                    empty="No fixed date"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
