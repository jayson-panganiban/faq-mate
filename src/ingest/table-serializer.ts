/**
 * Deep Module: Tabular Data Extraction & Markdown Table Serializer
 *
 * Implements Spec 01 (Section 2.3) table serialization standards:
 * Converts sub-limit schedules, excess matrices, and coverage grids into
 * aligned GitHub-Flavored Markdown tables to prevent chunking blindness.
 */

export interface TableColumn {
  header: string;
  align?: "left" | "center" | "right";
}

export interface TableData {
  columns: TableColumn[];
  rows: string[][];
  caption?: string;
}

export interface SubLimitEntry {
  category: string;
  standardSubLimit: string;
  optionalIncreaseAvailable: boolean;
  notes?: string;
}

/**
 * Serializes structured tabular data into clean GitHub-Flavored Markdown.
 */
export function serializeMarkdownTable(data: TableData): string {
  if (!data.columns.length || !data.rows.length) {
    return "";
  }

  const colCount = data.columns.length;
  // Calculate max width per column for clean formatting
  const widths: number[] = data.columns.map((col, idx) => {
    const headerLen = col.header.trim().length;
    const maxRowLen = data.rows.reduce((max, row) => {
      const cell = (row[idx] ?? "").trim();
      return Math.max(max, cell.length);
    }, 0);
    return Math.max(headerLen, maxRowLen, 3);
  });

  // 1. Header row
  const headerRow =
    "| " +
    data.columns
      .map((col, i) => col.header.trim().padEnd(widths[i]))
      .join(" | ") +
    " |";

  // 2. Alignment delimiter row
  const delimiterRow =
    "| " +
    data.columns
      .map((col, i) => {
        const align = col.align ?? "left";
        const w = widths[i];
        if (align === "center") {
          return ":" + "-".repeat(w - 2) + ":";
        } else if (align === "right") {
          return "-".repeat(w - 1) + ":";
        } else {
          return ":" + "-".repeat(w - 1);
        }
      })
      .join(" | ") +
    " |";

  // 3. Data rows
  const bodyRows = data.rows.map((row) => {
    return (
      "| " +
      Array.from({ length: colCount }, (_, i) => {
        const cell = (row[i] ?? "").trim();
        const align = data.columns[i].align ?? "left";
        if (align === "right") {
          return cell.padStart(widths[i]);
        }
        return cell.padEnd(widths[i]);
      }).join(" | ") +
      " |"
    );
  });

  const parts: string[] = [];
  if (data.caption) {
    parts.push(`*${data.caption.trim()}*`, "");
  }
  parts.push(headerRow, delimiterRow, ...bodyRows);
  return parts.join("\n");
}

/**
 * Serializes standard insurance sub-limit entries into compliant Markdown table.
 */
export function serializeSubLimitsTable(
  entries: SubLimitEntry[],
  caption?: string
): string {
  const tableData: TableData = {
    caption,
    columns: [
      { header: "Item Category", align: "left" },
      { header: "Standard Sub-Limit", align: "left" },
      { header: "Optional Increase Available?", align: "left" },
    ],
    rows: entries.map((entry) => [
      entry.category,
      entry.standardSubLimit,
      entry.optionalIncreaseAvailable
        ? entry.notes
          ? `Yes, ${entry.notes}`
          : "Yes"
        : "No",
    ]),
  };

  return serializeMarkdownTable(tableData);
}

/**
 * Extracts and normalizes pipe-delimited or tab-delimited text lines into a Markdown table.
 */
export function normalizeRawTextTable(rawText: string): string {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return rawText;

  // Detect delimiter (pipe or tab or comma or multiple spaces)
  const delimiter = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes("|")
    ? "|"
    : lines[0].includes(",")
    ? ","
    : /\s{2,}/;

  const rawRows = lines.map((line) => {
    if (typeof delimiter === "string" && delimiter === "|") {
      return line
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
    }
    return line.split(delimiter).map((c) => c.trim());
  });

  const validRows = rawRows.filter(
    (row) => !row.every((cell) => /^[-:| ]+$/.test(cell))
  );

  if (validRows.length < 2) return rawText;

  const headerRow = validRows[0];
  const dataRows = validRows.slice(1);

  const columns: TableColumn[] = headerRow.map((h) => ({
    header: h || "Column",
    align: "left",
  }));

  return serializeMarkdownTable({ columns, rows: dataRows });
}
