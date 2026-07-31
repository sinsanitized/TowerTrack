export function isUnverifiedLegacyEvent(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details))
    return false;
  const value = details as Record<string, unknown>;
  return (
    value.source === "LEGACY_EXCEL" && value.verificationStatus === "UNVERIFIED"
  );
}
