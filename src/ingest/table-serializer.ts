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
    "| " + data.columns.map((col, i) => col.header.trim().padEnd(widths[i])).join(" | ") + " |";

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
export function serializeSubLimitsTable(entries: SubLimitEntry[], caption?: string): string {
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
      entry.optionalIncreaseAvailable ? (entry.notes ? `Yes, ${entry.notes}` : "Yes") : "No",
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

  const validRows = rawRows.filter((row) => !row.every((cell) => /^[-:| ]+$/.test(cell)));

  if (validRows.length < 2) return rawText;

  const headerRow = validRows[0];
  const dataRows = validRows.slice(1);

  const columns: TableColumn[] = headerRow.map((h) => ({
    header: h || "Column",
    align: "left",
  }));

  return serializeMarkdownTable({ columns, rows: dataRows });
}

/**
 * Repairs ragged or colspan-broken Markdown tables (e.g., from HTML colspan headers)
 * so every row in a contiguous table block has symmetric column counts and a valid
 * GFM delimiter row.
 */
export function repairMarkdownTables(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];
  let tableBlock: string[] = [];

  const flushTable = () => {
    if (tableBlock.length === 0) return;

    const parsedRows = tableBlock.map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim())
    );

    // Filter out empty or delimiter-only rows
    const contentRows = parsedRows.filter((r) => !r.every((c) => c === "" || /^:?-+:?$/.test(c)));

    if (contentRows.length === 0) {
      tableBlock = [];
      return;
    }

    const maxCols = Math.max(...contentRows.map((r) => r.length));

    // Extract single-column title/caption rows at the start of a multi-column table
    const captions: string[] = [];
    while (contentRows.length > 1 && contentRows[0].length === 1 && maxCols > 1) {
      const cap = contentRows.shift()![0];
      if (cap) captions.push(`*${cap}*`);
    }

    if (captions.length > 0) {
      result.push(...captions, "");
    }

    const normalizedRows = contentRows.map((row) => {
      const padded = [...row];
      while (padded.length < maxCols) padded.push("");
      return "| " + padded.slice(0, maxCols).join(" | ") + " |";
    });

    if (normalizedRows.length >= 1) {
      const delimiter = "| " + Array.from({ length: maxCols }, () => "---").join(" | ") + " |";
      result.push(normalizedRows[0], delimiter, ...normalizedRows.slice(1));
    }

    tableBlock = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length >= 2) {
      tableBlock.push(line);
    } else {
      flushTable();
      result.push(line);
    }
  }
  flushTable();

  return result.join("\n");
}
