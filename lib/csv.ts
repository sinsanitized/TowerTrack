export type CsvPreview<T> = {
  rows: T[];
  errors: { row: number; message: string }[];
  duplicates: number[];
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_SOURCES = new Set([
  "USER_ENTRY",
  "FIELD_REPORT",
  "LAB_REPORT",
  "CHAIN_OF_CUSTODY",
  "PORTAL_CONFIRMATION",
  "IMPORTED_CSV",
  "CORRECTION",
  "UNKNOWN",
]);

function validDateOnly(value: string) {
  if (!DATE_ONLY.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}
export function previewSystemCsv(
  text: string,
  today = new Date().toISOString().slice(0, 10),
): CsvPreview<Record<string, string>> {
  const [header, ...data] = parseCsv(text);
  const required = [
    "customer_name",
    "account_number",
    "building_name",
    "street_address",
    "city",
    "state",
    "postal_code",
    "route_zone",
    "system_name",
    "job_number",
    "rule_profile_id",
    "last_legionella_sample",
    "date_source",
  ];
  const errors: { row: number; message: string }[] = [];
  if (!header)
    return {
      rows: [],
      errors: [{ row: 1, message: "CSV is empty" }],
      duplicates: [],
    };
  for (const name of required)
    if (!header.includes(name))
      errors.push({ row: 1, message: `Missing column: ${name}` });
  const rows = data.map((values) =>
    Object.fromEntries(header.map((h, j) => [h, values[j] ?? ""])),
  );
  const seen = new Set<string>(),
    duplicates: number[] = [];
  rows.forEach((r, i) => {
    const n = i + 2;
    for (const name of required)
      if (!r[name]) errors.push({ row: n, message: `${name} is required` });
    if (!validDateOnly(r.last_legionella_sample))
      errors.push({
        row: n,
        message: "last_legionella_sample must be a valid YYYY-MM-DD date",
      });
    else if (r.last_legionella_sample > today)
      errors.push({
        row: n,
        message: "last_legionella_sample cannot be in the future",
      });
    if (!/^[A-Za-z]{2}$/.test(r.state))
      errors.push({ row: n, message: "state must be a two-letter code" });
    if (!DATE_SOURCES.has(r.date_source))
      errors.push({ row: n, message: "date_source is not recognized" });
    if (r.job_number && seen.has(r.job_number)) duplicates.push(n);
    seen.add(r.job_number);
  });
  return { rows, errors, duplicates };
}
