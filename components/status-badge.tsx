import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  PauseCircle,
  SearchCheck,
} from "lucide-react";

const styles = {
  GREEN: "bg-emerald-50 text-emerald-800 border-emerald-200",
  YELLOW: "bg-amber-50 text-amber-900 border-amber-300",
  RED: "bg-red-50 text-red-800 border-red-300",
  BLUE: "bg-blue-50 text-blue-800 border-blue-200",
  GRAY: "bg-slate-100 text-slate-700 border-slate-300",
  PURPLE: "bg-purple-50 text-purple-800 border-purple-300",
};
const icons = {
  GREEN: CheckCircle2,
  YELLOW: Clock3,
  RED: AlertCircle,
  BLUE: Clock3,
  GRAY: PauseCircle,
  PURPLE: SearchCheck,
};
export function StatusBadge({
  color,
  label,
  compact = false,
}: {
  color: keyof typeof styles;
  label: string;
  compact?: boolean;
}) {
  const Icon = icons[color];
  return (
    <span
      data-color={color}
      className={`inline-flex items-center rounded-full border font-extrabold ${
        compact
          ? "max-w-full gap-1 px-1.5 py-1 text-[10px] leading-tight whitespace-normal"
          : "gap-1.5 px-2.5 py-1 text-xs whitespace-nowrap"
      } ${styles[color]}`}
    >
      <Icon size={14} aria-hidden />
      {label}
    </span>
  );
}
