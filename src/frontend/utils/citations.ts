import type { GroundedChunk } from "../types/chat-ui";

/**
 * Normalizes insurance product and document type into a unified display title.
 * Prevents redundant docType repetitions (e.g. "Suncorp Home PDS PDS").
 */
export function formatProductDoc(product?: string, docType?: string): string {
  const effectiveProduct = product?.trim() || "Policy Document";
  const effectiveDocType = docType?.trim() || "PDS";

  if (effectiveProduct.toLowerCase().includes(effectiveDocType.toLowerCase())) {
    return effectiveProduct;
  }
  return `${effectiveProduct} ${effectiveDocType}`;
}

/**
 * Finds a matching GroundedChunk from a collection of chunks based on a raw or formatted citation string.
 * Uses a prioritized multi-tier heuristic:
 * 1. Direct Chunk ID match
 * 2. Combined Product and Section match
 * 3. Section match (including section prefix e.g. "Section 1")
 * 4. Product name match
 */
export function findMatchingChunk(
  citationText: string,
  chunks?: GroundedChunk[]
): GroundedChunk | undefined {
  if (!chunks || chunks.length === 0) return undefined;
  const clean = citationText.replace(/[[\]]/g, "").trim().toLowerCase();

  // 1. Direct Chunk ID match
  const byId = chunks.find(
    (c) => clean.includes(c.id.toLowerCase()) || c.id.toLowerCase().includes(clean)
  );
  if (byId) return byId;

  // 2. Combined Product and Section match
  const byBoth = chunks.find((c) => {
    const prod = c.source.product.toLowerCase();
    const sec = c.source.section.toLowerCase();
    return (
      (clean.includes(prod) || prod.includes(clean)) && (clean.includes(sec) || sec.includes(clean))
    );
  });
  if (byBoth) return byBoth;

  // 3. Section match
  const bySec = chunks.find((c) => {
    const sec = c.source.section.toLowerCase();
    const secPrefix = sec.split(":")[0]?.trim();
    return (
      clean.includes(sec) || sec.includes(clean) || (secPrefix ? clean.includes(secPrefix) : false)
    );
  });
  if (bySec) return bySec;

  // 4. Product match
  const byProd = chunks.find((c) => {
    const prod = c.source.product.toLowerCase();
    return clean.includes(prod) || prod.includes(clean);
  });
  if (byProd) return byProd;

  return undefined;
}
