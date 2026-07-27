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
    <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
      {label[authority] ?? authority}
    </span>
  );
}
