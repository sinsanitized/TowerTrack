export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function withReturnPath(href: string, returnTo: string) {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}returnTo=${encodeURIComponent(returnTo)}${hash}`;
}

export function withWorkflowNotice(path: string, notice: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}workflowNotice=${encodeURIComponent(notice)}`;
}
