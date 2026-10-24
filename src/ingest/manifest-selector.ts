import { resolveInsurer, toInsurerSlug } from "../constants/insurers";

export interface ManifestEntry {
  insurer: string;
  insurerSlug: string;
  category: string;
  product: string;
  productSlug: string;
  type: "PDS" | "SPDS";
  title: string;
  file: string;
  bytes: number;
  url: string;
  inferredDate: string;
  isArchived: boolean;
}

/**
 * Parses CSV text (matching data/raw/all_manifest.csv) into structured rows.
 * Handles RFC 4180 quoted fields and commas inside quotes.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Infers an ISO-like date string (YYYY-MM-DD) from a PDS title or filename
 * so current editions sort ahead of older superseded editions.
 */
export function inferEffectiveDate(title: string, file: string): string {
  const combined = `${title} ${file}`;

  // Explicit "current" marker gets highest priority date
  if (/\bcurrent\b/i.test(combined)) {
    return "2026-10-24";
  }

  // Match YYYY-MM-DD or YYYY_MM_DD
  const isoMatch = combined.match(/\b(20[0-2]\d)[-_](0[1-9]|1[0-2])[-_](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Match compact YYYYMMDD
  const compactMatch = combined.match(/\b(20[0-2]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }

  // Match DD-MM-YY or DD_MM_YY (e.g. 18-08-26 or 24-05-25)
  const dmyShort = combined.match(/\b(0[1-9]|[12]\d|3[01])[-_](0[1-9]|1[0-2])[-_](2[0-6])\b/);
  if (dmyShort) {
    return `20${dmyShort[3]}-${dmyShort[2]}-${dmyShort[1]}`;
  }

  // Match Month YYYY (e.g. "November 2025", "April 2024")
  const months: Record<string, string> = {
    january: "01",
    jan: "01",
    february: "02",
    feb: "02",
    march: "03",
    mar: "03",
    april: "04",
    apr: "04",
    may: "05",
    june: "06",
    jun: "06",
    july: "07",
    jul: "07",
    august: "08",
    aug: "08",
    september: "09",
    sep: "09",
    october: "10",
    oct: "10",
    november: "11",
    nov: "11",
    december: "12",
    dec: "12",
  };
  const monthYearMatch = combined.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(20[0-2]\d)\b/i
  );
  if (monthYearMatch) {
    const m = months[monthYearMatch[1].toLowerCase()] || "01";
    return `${monthYearMatch[2]}-${m}-01`;
  }

  // Match standalone year 2003..2026
  const yearMatch = combined.match(/\b(20[0-2]\d)\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`;
  }

  return "2025-01-01";
}

/**
 * Parses all_manifest.csv content into typed ManifestEntry items.
 */
export function parseManifestCsv(csvContent: string): ManifestEntry[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const entries: ManifestEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 8) continue;

    const [insurer, rawCategory, product, rawType, title, file, bytesStr, url] = cols;
    const resolved = resolveInsurer(insurer);
    const insurerSlug = resolved ? resolved.profile.slug : toInsurerSlug(insurer);
    const category = resolved ? resolved.profile.category : rawCategory || "general";
    const productClean = (product || "General Policy").trim();
    const productSlug = toInsurerSlug(productClean) || "policy";
    const type: "PDS" | "SPDS" = rawType.toUpperCase().includes("SPDS") ? "SPDS" : "PDS";
    const isArchived =
      /\barchived?\b/i.test(file) ||
      /\barchived?\b/i.test(rawCategory) ||
      /\bsuperseded\b/i.test(title);

    entries.push({
      insurer: resolved ? resolved.profile.name : insurer.trim(),
      insurerSlug,
      category,
      product: productClean,
      productSlug,
      type,
      title: title || `${insurer} ${productClean} ${type}`,
      file,
      bytes: Number.parseInt(bytesStr, 10) || 0,
      url,
      inferredDate: inferEffectiveDate(title, file),
      isArchived,
    });
  }

  return entries;
}

/**
 * Selects either the latest current PDS & SPDS per (insurer, product, type)
 * or all 1,277 historical entries when includeHistorical is true.
 */
export function selectManifestEntries(
  entries: ManifestEntry[],
  options: { includeHistorical?: boolean; insurerFilter?: string } = {}
): ManifestEntry[] {
  let filtered = entries;

  if (options.insurerFilter) {
    const targetSlug = toInsurerSlug(options.insurerFilter);
    filtered = filtered.filter((e) => e.insurerSlug === targetSlug);
  }

  if (options.includeHistorical) {
    return filtered;
  }

  // Group by (insurerSlug, productSlug, type) and pick the latest non-archived edition
  // (falling back to latest archived only if an insurer+product has no non-archived files)
  const grouped = new Map<string, ManifestEntry[]>();
  for (const entry of filtered) {
    const key = `${entry.insurerSlug}::${entry.productSlug}::${entry.type}`;
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  const selected: ManifestEntry[] = [];
  for (const group of grouped.values()) {
    const nonArchived = group.filter((g) => !g.isArchived);
    const pool = nonArchived.length > 0 ? nonArchived : group;

    pool.sort((a, b) => {
      if (b.inferredDate !== a.inferredDate) {
        return b.inferredDate.localeCompare(a.inferredDate);
      }
      return b.bytes - a.bytes;
    });

    selected.push(pool[0]);
  }

  return selected;
}
