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
    <header className="mb-7 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="label mb-2 text-emerald-800">{eyebrow}</div>
        )}
        <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">
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
