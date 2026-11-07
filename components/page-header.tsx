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
    <header className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="label mb-1 text-emerald-800">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 sm:text-base">
          {description}
        </p>
      </div>
      {actions && (
        <div className="flex w-full flex-wrap gap-2 [&>.btn]:flex-1 sm:w-auto sm:justify-end sm:[&>.btn]:flex-none">
          {actions}
        </div>
      )}
    </header>
  );
}
