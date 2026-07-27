export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <div className="label mb-2 text-emerald-800">{eyebrow}</div>
        )}
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
