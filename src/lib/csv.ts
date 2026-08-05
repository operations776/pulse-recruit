// CSV building, defined once. Client-side on purpose: the board already holds
// every row it shows, so an export is a serialisation of what is on screen,
// not a second query that could disagree with it.

/** RFC 4180 quoting. A field with a comma, a quote or a newline gets wrapped. */
function csvField(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  // A leading =, +, - or @ executes as a formula in Excel and Sheets. The
  // apostrophe prefix is the standard defusal, and a recruiter WILL open this
  // file in Excel.
  const defused = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(defused) ? `"${defused.replace(/"/g, '""')}"` : defused;
}

export function buildCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return [header, ...rows]
    .map((row) => row.map(csvField).join(","))
    .join("\r\n");
}

/** Hand a CSV to the browser as a download. */
export function downloadCsv(fileName: string, csv: string): void {
  // The BOM makes Excel read UTF-8 instead of guessing the codepage, which is
  // the difference between "Zoë" and "ZoÃ«" in a client-facing file.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
