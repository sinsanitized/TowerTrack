import { mkdir, writeFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";

const xml = (value) => strToU8(value);
const textCell = (ref, value) =>
  `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`;
const numberCell = (ref, value, style = "") =>
  `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${value}</v></c>`;

const headers = [
  ["B3", "Job Number"],
  ["C3", "Job Name"],
  ["D3", "Address"],
  ["E3", "System Type"],
  ["F3", "TON"],
  ["G3", "Cleaning"],
  ["H3", "Seasonal/12 Months"],
  ["I3", "2020"],
  ["J3", "January"],
  ["K3", "February"],
  ["L3", "March"],
  ["M3", "April"],
  ["BR3", "January"],
  ["BS3", "February"],
  ["BY3", "SHH"],
]
  .map(([ref, value]) => textCell(ref, value))
  .join("");

const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="B3:CD6"/><sheetData>
<row r="3">${headers}</row>
<row r="4">${textCell("B4", "DUP-100")}${textCell("C4", "Example Facility")}${textCell("D4", "10 Example Street")}${textCell("E4", "CTA")}${numberCell("F4", 100)}${textCell("H4", "Seasonal")}${numberCell("BR4", 15)}${numberCell("BY4", 46213, "1")}</row>
<row r="5">${textCell("B5", "DUP-100")}${textCell("C5", "Example Facility Tower Two")}${textCell("D5", "12 Example Street")}${textCell("E5", "CTA 2")}${numberCell("F5", 125)}${textCell("H5", "12 Months")}${textCell("J5", "1/20/2021")}${textCell("K5", "PD")}${textCell("L5", "6/1-6/15")}${numberCell("M5", 87848)}</row>
<row r="6">${textCell("B6", "BAD-200")}${textCell("D6", "20 Review Road")}${textCell("E6", "57")}${textCell("F6", "unknown")}${textCell("H6", "unknown")}${numberCell("BS6", 30)}</row>
</sheetData></worksheet>`;

const files = {
  "[Content_Types].xml": xml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  ),
  "_rels/.rels": xml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  ),
  "xl/workbook.xml": xml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  ),
  "xl/_rels/workbook.xml.rels": xml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  ),
  "xl/styles.xml": xml(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>`,
  ),
  "xl/worksheets/sheet1.xml": xml(sheet),
};

await mkdir("tests/fixtures", { recursive: true });
await writeFile("tests/fixtures/legacy-import-sanitized.xlsx", zipSync(files));
