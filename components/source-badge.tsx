const label: Record<string, string> = {
  REGULATORY: "Regulatory",
  GUIDANCE: "Guidance only",
  COMPANY_POLICY: "Company policy",
  CONTRACT_REQUIREMENT: "Contract requirement",
  PENDING_REGULATION: "Pending regulation",
  UNKNOWN_REQUIRES_REVIEW: "Needs review",
};
export function SourceBadge({ authority }: { authority: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-bold leading-tight text-slate-700">
      {label[authority] ?? authority}
    </span>
  );
}
