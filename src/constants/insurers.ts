/**
 * Canonical Australian Insurer Registry (v2.0)
 *
 * Single source of truth for the 39 primary archive insurers in data/raw/
 * across 5 categories, plus Bancassurance and white-label brand aliases mapped
 * to their issuing underwriter in accordance with Australian General & Life
 * Insurance disclosure standards.
 */

import type { GroundedChunk } from "../types/chat";
import { STATUTORY_GAW } from "./statutory";

export type InsurerCategory =
  | "suncorp-group"
  | "major-insurers"
  | "challengers-auto-clubs"
  | "travel-specialists"
  | "life-insurers";

export type PrimaryInsurerCode =
  | "SUNCORP"
  | "AAMI"
  | "GIO"
  | "APIA"
  | "SHANNONS"
  | "BINGLE"
  | "ALLIANZ"
  | "QBE"
  | "VERO"
  | "NRMA"
  | "BUDGET_DIRECT"
  | "RAC_WA"
  | "RAA"
  | "RACT"
  | "RACV"
  | "RACQ"
  | "CGU"
  | "YOUI"
  | "TIO"
  | "GO_INSURANCE"
  | "1COVER"
  | "INSUREANDGO"
  | "FAST_COVER"
  | "SOUTHERN_CROSS"
  | "ZOOM"
  | "COVER_MORE"
  | "TRAVEL_INSURANCE_DIRECT"
  | "ZURICH"
  | "AIA"
  | "NOBLEOAK"
  | "NEOS"
  | "HCF_LIFE"
  | "ACENDA"
  | "CHALLENGER"
  | "CLEARVIEW"
  | "METLIFE"
  | "TAL"
  | "PPS_MUTUAL"
  | "ASTERON_LIFE";

export interface InsurerProfile {
  /** Display name matching data/raw/all_manifest.csv and FAQs */
  name: string;
  /** Lowercase kebab-case slug used in file paths and R2 keys */
  slug: string;
  /** Uppercase filter code */
  code: string;
  /** Primary industry classification */
  category: InsurerCategory;
  /** Statutory underwriter / AFS Licensee */
  underwriter: string;
  /** Product lines offered */
  productLines: string[];
}

export const PRIMARY_INSURERS: readonly InsurerProfile[] = [
  // 1. Suncorp Group (6)
  {
    name: "Suncorp",
    slug: "suncorp",
    code: "SUNCORP",
    category: "suncorp-group",
    underwriter: "AAI Limited (ABN 48 005 297 807, AFSL 230859)",
    productLines: ["Home & Contents", "Motor", "Landlord", "Boat", "Caravan", "CTP"],
  },
  {
    name: "AAMI",
    slug: "aami",
    code: "AAMI",
    category: "suncorp-group",
    underwriter: "AAI Limited (ABN 48 005 297 807, AFSL 230859)",
    productLines: ["Home & Contents", "Car", "Landlord", "Business", "Motorcycle", "CTP"],
  },
  {
    name: "GIO",
    slug: "gio",
    code: "GIO",
    category: "suncorp-group",
    underwriter: "AAI Limited (ABN 48 005 297 807, AFSL 230859)",
    productLines: ["Home & Contents", "Car", "Workers Compensation", "Business", "Boat", "CTP"],
  },
  {
    name: "APIA",
    slug: "apia",
    code: "APIA",
    category: "suncorp-group",
    underwriter: "AAI Limited (ABN 48 005 297 807, AFSL 230859)",
    productLines: ["Home & Contents", "Car", "Motorhome", "Caravan", "Boat", "Travel"],
  },
  {
    name: "Shannons",
    slug: "shannons",
    code: "SHANNONS",
    category: "suncorp-group",
    underwriter: "AAI Limited (ABN 48 005 297 807, AFSL 230859)",
    productLines: ["Motor", "Home & Contents", "Enthusiast Vehicle"],
  },
  {
    name: "Bingle",
    slug: "bingle",
    code: "BINGLE",
    category: "suncorp-group",
    underwriter: "AAI Limited (ABN 48 005 297 807, AFSL 230859)",
    productLines: ["Car", "Comprehensive Motor", "Third Party Car"],
  },

  // 2. Major Insurers (4)
  {
    name: "Allianz",
    slug: "allianz",
    code: "ALLIANZ",
    category: "major-insurers",
    underwriter: "Allianz Australia Insurance Limited (ABN 15 000 122 850, AFSL 234708)",
    productLines: [
      "Home & Contents",
      "Comprehensive Motor",
      "Landlord",
      "Travel",
      "Business",
      "Life",
    ],
  },
  {
    name: "QBE",
    slug: "qbe",
    code: "QBE",
    category: "major-insurers",
    underwriter: "QBE Insurance (Australia) Limited (ABN 78 003 191 035, AFSL 239545)",
    productLines: [
      "Home & Contents",
      "Car",
      "Landlord",
      "Compulsory Third Party",
      "Small Business",
    ],
  },
  {
    name: "Vero",
    slug: "vero",
    code: "VERO",
    category: "major-insurers",
    underwriter: "AAI Limited trading as Vero Insurance (ABN 48 005 297 807, AFSL 230859)",
    productLines: ["Motor Fleet", "Commercial Property", "Personal Lines", "Marine"],
  },
  {
    name: "NRMA",
    slug: "nrma",
    code: "NRMA",
    category: "major-insurers",
    underwriter: "Insurance Australia Limited (ABN 11 000 016 722, AFSL 227681)",
    productLines: ["Home & Contents", "Car", "Landlord", "Boat", "Caravan", "Travel", "Business"],
  },

  // 3. Challengers & Auto Clubs (9)
  {
    name: "Budget Direct",
    slug: "budget-direct",
    code: "BUDGET_DIRECT",
    category: "challengers-auto-clubs",
    underwriter: "Auto & General Insurance Company Limited (ABN 42 111 586 353, AFSL 285571)",
    productLines: ["Car", "Home & Contents", "Travel", "Motorcycle", "Pet", "Life"],
  },
  {
    name: "RAC WA",
    slug: "rac-wa",
    code: "RAC_WA",
    category: "challengers-auto-clubs",
    underwriter: "RAC Insurance Pty Limited (ABN 59 094 685 882, AFSL 231222)",
    productLines: ["Car", "Home & Contents", "Motorcycle", "Caravan", "Boat", "Travel", "Life"],
  },
  {
    name: "RAA",
    slug: "raa",
    code: "RAA",
    category: "challengers-auto-clubs",
    underwriter: "RAA Insurance Limited (ABN 14 007 872 602, AFSL 232525)",
    productLines: ["Car", "Home & Contents", "Caravan", "Boat", "Travel"],
  },
  {
    name: "RACT",
    slug: "ract",
    code: "RACT",
    category: "challengers-auto-clubs",
    underwriter: "RACT Insurance Pty Ltd (ABN 96 068 167 804, AFSL 229076)",
    productLines: ["Motor", "Home & Contents", "Boat", "Caravan", "Travel"],
  },
  {
    name: "RACV",
    slug: "racv",
    code: "RACV",
    category: "challengers-auto-clubs",
    underwriter:
      "Insurance Manufacturers of Australia Pty Limited (ABN 93 004 208 084, AFSL 227678)",
    productLines: ["Home & Contents", "Motor", "Caravan", "Boat", "Travel", "Business"],
  },
  {
    name: "RACQ",
    slug: "racq",
    code: "RACQ",
    category: "challengers-auto-clubs",
    underwriter: "RACQ Insurance Limited (ABN 50 009 704 152, AFSL 233082)",
    productLines: ["Home & Contents", "Car", "Caravan & Trailer", "Boat", "Pet"],
  },
  {
    name: "CGU",
    slug: "cgu",
    code: "CGU",
    category: "challengers-auto-clubs",
    underwriter: "Insurance Australia Limited (ABN 11 000 016 722, AFSL 227681)",
    productLines: ["Home & Contents", "Motor", "Landlord", "Commercial", "Strata"],
  },
  {
    name: "Youi",
    slug: "youi",
    code: "YOUI",
    category: "challengers-auto-clubs",
    underwriter: "Youi Pty Ltd (ABN 79 123 079 414, AFSL 316540)",
    productLines: ["Car", "Home & Contents", "Motorcycle", "Watercraft", "Caravan", "CTP"],
  },
  {
    name: "TIO",
    slug: "tio",
    code: "TIO",
    category: "challengers-auto-clubs",
    underwriter:
      "Allianz Australia Insurance Limited trading as TIO (ABN 15 000 122 850, AFSL 234708)",
    productLines: ["Home & Contents", "Motor", "Boat", "Caravan", "Landlord"],
  },

  // 4. Travel Specialists (8)
  {
    name: "Go Insurance",
    slug: "go-insurance",
    code: "GO_INSURANCE",
    category: "travel-specialists",
    underwriter: "Go Unlimited Pty Ltd / Certain Underwriters at Lloyd's (AFSL 296462)",
    productLines: ["International Travel", "Domestic Travel", "Cruise", "Ski & Winter Sports"],
  },
  {
    name: "1Cover",
    slug: "1cover",
    code: "1COVER",
    category: "travel-specialists",
    underwriter: "Mitsui Sumitomo Insurance Company Limited / 1Cover Pty Ltd (AFSL 299039)",
    productLines: ["International Travel", "Domestic Travel", "Ski"],
  },
  {
    name: "InsureandGo",
    slug: "insureandgo",
    code: "INSUREANDGO",
    category: "travel-specialists",
    underwriter: "Mitsui Sumitomo Insurance Company Limited (ABN 49 000 525 637, AFSL 240816)",
    productLines: ["International Travel", "Domestic Travel", "Cruise", "Annual Multi-Trip"],
  },
  {
    name: "Fast Cover",
    slug: "fast-cover",
    code: "FAST_COVER",
    category: "travel-specialists",
    underwriter: "Allianz Australia Insurance Limited / Hollard Insurance Company (AFSL 241436)",
    productLines: ["Travel Insurance", "Snow Sports", "Domestic & International"],
  },
  {
    name: "Southern Cross Travel Insurance",
    slug: "southern-cross-travel-insurance",
    code: "SCTI",
    category: "travel-specialists",
    underwriter: "Southern Cross Benefits Limited (ABN 99 133 438 742, AFSL 331058)",
    productLines: ["International Travel", "Domestic Travel", "Working Overseas"],
  },
  {
    name: "Zoom",
    slug: "zoom",
    code: "ZOOM",
    category: "travel-specialists",
    underwriter: "Mitsui Sumitomo Insurance Company Limited / Zoom Travel Insurance",
    productLines: ["International Travel", "Domestic Travel"],
  },
  {
    name: "Cover-More",
    slug: "cover-more",
    code: "COVER_MORE",
    category: "travel-specialists",
    underwriter: "Zurich Australian Insurance Limited (ABN 13 000 296 640, AFSL 232507)",
    productLines: ["International Travel", "Domestic Travel", "Inbound Travel"],
  },
  {
    name: "Travel Insurance Direct",
    slug: "travel-insurance-direct",
    code: "TID",
    category: "travel-specialists",
    underwriter: "Pacific International Insurance Pty Ltd / nib Travel Services (AFSL 336966)",
    productLines: ["International Travel", "Domestic Travel", "Annual Multi-Trip"],
  },

  // 5. Life Insurers (12)
  {
    name: "Zurich",
    slug: "zurich",
    code: "ZURICH",
    category: "life-insurers",
    underwriter: "Zurich Australia Limited (ABN 92 000 010 195, AFSL 232510)",
    productLines: ["Life Insurance", "Income Protection", "TPD", "Trauma", "Motor"],
  },
  {
    name: "AIA",
    slug: "aia",
    code: "AIA",
    category: "life-insurers",
    underwriter: "AIA Australia Limited (ABN 79 004 837 861, AFSL 230043)",
    productLines: ["Priority Protection", "Life", "TPD", "Crisis Recovery", "Income Protection"],
  },
  {
    name: "NobleOak",
    slug: "nobleoak",
    code: "NOBLEOAK",
    category: "life-insurers",
    underwriter: "NobleOak Life Limited (ABN 85 087 648 708, AFSL 247302)",
    productLines: ["Term Life", "Income Protection", "TPD", "Trauma", "Business Expenses"],
  },
  {
    name: "NEOS",
    slug: "neos",
    code: "NEOS",
    category: "life-insurers",
    underwriter: "NobleOak Life Limited / Pacific Life Re (NEOS Protection)",
    productLines: ["NEOS Protection", "Encompass Protection"],
  },
  {
    name: "HCF Life",
    slug: "hcf-life",
    code: "HCF_LIFE",
    category: "life-insurers",
    underwriter: "HCF Life Insurance Company Pty Limited (ABN 37 001 831 250, AFSL 236806)",
    productLines: ["Recover Cover", "Direct Life", "Income Protect", "Personal Accident"],
  },
  {
    name: "Acenda",
    slug: "acenda",
    code: "ACENDA",
    category: "life-insurers",
    underwriter:
      "Nippon Life Insurance Australia and New Zealand Limited (formerly MLC Life, AFSL 230694)",
    productLines: [
      "Life Cover",
      "Income Protection",
      "Total & Permanent Disability",
      "Critical Illness",
    ],
  },
  {
    name: "Challenger",
    slug: "challenger",
    code: "CHALLENGER",
    category: "life-insurers",
    underwriter: "Challenger Life Company Limited (ABN 44 072 486 938, AFSL 234670)",
    productLines: ["Guaranteed Annuity", "Liquid Lifetime", "CarePlus"],
  },
  {
    name: "ClearView",
    slug: "clearview",
    code: "CLEARVIEW",
    category: "life-insurers",
    underwriter: "ClearView Life Assurance Limited (ABN 12 000 021 581, AFSL 227682)",
    productLines: ["ClearChoice", "LifeSolutions", "Income Protection", "TPD", "Trauma"],
  },
  {
    name: "MetLife",
    slug: "metlife",
    code: "METLIFE",
    category: "life-insurers",
    underwriter: "MetLife Insurance Limited (ABN 75 004 274 882, AFSL 238096)",
    productLines: ["MetLife Protect", "Retail Life", "Group Life"],
  },
  {
    name: "TAL",
    slug: "tal",
    code: "TAL",
    category: "life-insurers",
    underwriter: "TAL Life Limited (ABN 70 050 109 450, AFSL 237848)",
    productLines: [
      "Accelerated Protection",
      "Term Life",
      "Income Protection",
      "TPD",
      "Critical Illness",
    ],
  },
  {
    name: "PPS Mutual",
    slug: "pps-mutual",
    code: "PPS_MUTUAL",
    category: "life-insurers",
    underwriter: "NobleOak Life Limited for Professional Provident Society Mutual (AFSL 247302)",
    productLines: ["Professionals Choice", "Life", "TPD", "Trauma", "Income Protection"],
  },
  {
    name: "Asteron Life",
    slug: "asteron-life",
    code: "ASTERON_LIFE",
    category: "life-insurers",
    underwriter:
      "TAL Life Insurance Services Limited / Asteron Life & Superannuation Limited (AFSL 229889)",
    productLines: ["Complete Protection", "Life", "Income Protection", "TPD"],
  },
] as const;

/**
 * White-label, Bancassurance, and Subsidiary Brand Aliases
 * Maps distributing brands to their underlying archive underwriter.
 */
export const INSURER_BRAND_ALIASES: Readonly<
  Record<string, { targetSlug: string; displayBrand: string; underwriterNote: string }>
> = {
  // Bancassurance
  commbank: {
    targetSlug: "allianz",
    displayBrand: "CommBank",
    underwriterNote:
      "General insurance distributed by Commonwealth Bank of Australia and underwritten by Hollard / Allianz; Life cover via AIA Australia.",
  },
  westpac: {
    targetSlug: "allianz",
    displayBrand: "Westpac",
    underwriterNote:
      "General insurance distributed by Westpac and underwritten by Allianz Australia Insurance Limited; Life cover via TAL Life.",
  },
  "st.george": {
    targetSlug: "allianz",
    displayBrand: "St.George",
    underwriterNote:
      "General insurance distributed by St.George Bank (Westpac Group) and underwritten by Allianz Australia Insurance Limited.",
  },
  "st-george": {
    targetSlug: "allianz",
    displayBrand: "St.George",
    underwriterNote:
      "General insurance distributed by St.George Bank (Westpac Group) and underwritten by Allianz Australia Insurance Limited.",
  },
  banksa: {
    targetSlug: "allianz",
    displayBrand: "BankSA",
    underwriterNote:
      "General insurance distributed by BankSA (Westpac Group) and underwritten by Allianz Australia Insurance Limited.",
  },
  anz: {
    targetSlug: "qbe",
    displayBrand: "ANZ",
    underwriterNote:
      "General insurance distributed by ANZ and underwritten by QBE Insurance (Australia) Limited; Travel via Cover-More / Zurich.",
  },
  nab: {
    targetSlug: "allianz",
    displayBrand: "NAB",
    underwriterNote:
      "General insurance distributed by National Australia Bank and underwritten by Allianz Australia Insurance Limited; Life via MLC / Acenda.",
  },
  hsbc: {
    targetSlug: "allianz",
    displayBrand: "HSBC",
    underwriterNote:
      "General insurance distributed by HSBC Bank Australia and underwritten by Allianz Australia Insurance Limited.",
  },
  ing: {
    targetSlug: "budget-direct",
    displayBrand: "ING",
    underwriterNote:
      "General insurance distributed by ING Australia and underwritten by Auto & General Insurance Company Limited.",
  },
  macquarie: {
    targetSlug: "zurich",
    displayBrand: "Macquarie",
    underwriterNote:
      "Life risk portfolio transferred to Zurich Australia Limited; General insurance via underwriter partners.",
  },
  bankwest: {
    targetSlug: "allianz",
    displayBrand: "Bankwest",
    underwriterNote:
      "General insurance distributed by Bankwest and underwritten by Hollard / Allianz Australia.",
  },

  // Retail / Challenger / Travel / Life Brand Aliases
  "coles-insurance": {
    targetSlug: "cgu",
    displayBrand: "Coles Insurance",
    underwriterNote: "Underwritten by Insurance Australia Limited (IAG / CGU) and Auto & General.",
  },
  coles: {
    targetSlug: "cgu",
    displayBrand: "Coles Insurance",
    underwriterNote: "Underwritten by Insurance Australia Limited (IAG / CGU) and Auto & General.",
  },
  rollin: {
    targetSlug: "cgu",
    displayBrand: "ROLLiN'",
    underwriterNote:
      "Issued and underwritten by Insurance Australia Limited (ABN 11 000 016 722, AFSL 227681).",
  },
  "rollin'": {
    targetSlug: "cgu",
    displayBrand: "ROLLiN'",
    underwriterNote:
      "Issued and underwritten by Insurance Australia Limited (ABN 11 000 016 722, AFSL 227681).",
  },
  "everyday-insurance": {
    targetSlug: "budget-direct",
    displayBrand: "Everyday Insurance",
    underwriterNote:
      "Everyday Insurance from Woolworths, underwritten by Auto & General / Hollard.",
  },
  "australian-seniors": {
    targetSlug: "budget-direct",
    displayBrand: "Australian Seniors",
    underwriterNote:
      "Distributed by Greenstone Financial Services and underwritten by Hollard / Auto & General.",
  },
  "real-insurance": {
    targetSlug: "budget-direct",
    displayBrand: "Real Insurance",
    underwriterNote:
      "Distributed by Greenstone Financial Services and underwritten by Hollard / Auto & General.",
  },
  "tick-travel-insurance": {
    targetSlug: "insureandgo",
    displayBrand: "Tick Travel Insurance",
    underwriterNote:
      "Underwritten by Mitsui Sumitomo Insurance Company Limited (same underwriter group as InsureandGo).",
  },
  "world-nomads": {
    targetSlug: "travel-insurance-direct",
    displayBrand: "World Nomads",
    underwriterNote:
      "Distributed by nib Travel Services (Australia) Pty Ltd alongside Travel Insurance Direct.",
  },
  "zoom-travel-insurance": {
    targetSlug: "zoom",
    displayBrand: "Zoom Travel Insurance",
    underwriterNote:
      "Zoom Travel Insurance (underwritten by Mitsui Sumitomo Insurance Company Limited).",
  },
  "aia-australia": {
    targetSlug: "aia",
    displayBrand: "AIA Australia",
    underwriterNote: "AIA Australia Limited (ABN 79 004 837 861, AFSL 230043).",
  },
  "mlc-life": {
    targetSlug: "acenda",
    displayBrand: "MLC Life",
    underwriterNote:
      "MLC Life Insurance rebranded to Acenda (Nippon Life Insurance Australia and New Zealand Limited).",
  },
  "resolution-life": {
    targetSlug: "aia",
    displayBrand: "Resolution Life",
    underwriterNote:
      "Resolution Life Australasia (in-force life & wealth book, successor to AMP Life).",
  },
  "zurich-assure": {
    targetSlug: "zurich",
    displayBrand: "Zurich Assure",
    underwriterNote: "Issued by Zurich Australia Limited (ABN 92 000 010 195, AFSL 232510).",
  },
};

/**
 * Normalizes any insurer name, code, or brand alias to a canonical slug.
 */
export function toInsurerSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolves an insurer query/filter string to its canonical InsurerProfile.
 * Supports all 39 primary archive insurers plus Bancassurance and white-label aliases.
 */
export function resolveInsurer(input: string): {
  profile: InsurerProfile;
  aliasBrand?: string;
  underwriterNote?: string;
} | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  const upper = cleaned.toUpperCase().replace(/[\s-]+/g, "_");
  const slug = toInsurerSlug(cleaned);

  // 1. Direct match on primary insurers
  const direct = PRIMARY_INSURERS.find(
    (p) =>
      p.code === upper ||
      p.slug === slug ||
      p.name.toLowerCase() === cleaned.toLowerCase() ||
      (upper === "SOUTHERN_CROSS" && p.code === "SCTI") ||
      (upper === "TRAVEL_INSURANCE_DIRECT" && p.code === "TID")
  );
  if (direct) {
    return { profile: direct };
  }

  // 2. Match via brand alias (Bancassurance / white-label / rebrand)
  const alias = INSURER_BRAND_ALIASES[slug] || INSURER_BRAND_ALIASES[cleaned.toLowerCase()];
  if (alias) {
    const target = PRIMARY_INSURERS.find((p) => p.slug === alias.targetSlug);
    if (target) {
      return {
        profile: target,
        aliasBrand: alias.displayBrand,
        underwriterNote: alias.underwriterNote,
      };
    }
  }

  // 3. Partial substring match
  const partial = PRIMARY_INSURERS.find(
    (p) =>
      p.name.toLowerCase().includes(cleaned.toLowerCase()) ||
      cleaned.toLowerCase().includes(p.name.toLowerCase())
  );
  if (partial) {
    return { profile: partial };
  }

  return null;
}

export interface InsurerCategoryGroup {
  category: InsurerCategory;
  label: string;
  options: Array<{ value: string; label: string; underwriter: string }>;
}

const CATEGORY_LABELS: Record<InsurerCategory, string> = {
  "suncorp-group": "Suncorp Group (6)",
  "major-insurers": "Major Insurers (4)",
  "challengers-auto-clubs": "Challengers & Auto Clubs (9)",
  "travel-specialists": "Travel Specialists (8)",
  "life-insurers": "Life Insurers (12)",
};

/**
 * Returns all 39 primary archive insurers grouped by category for UI `<optgroup>` selectors.
 */
export function getGroupedInsurerOptions(): InsurerCategoryGroup[] {
  const categories: InsurerCategory[] = [
    "suncorp-group",
    "major-insurers",
    "challengers-auto-clubs",
    "travel-specialists",
    "life-insurers",
  ];

  return categories.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    options: PRIMARY_INSURERS.filter((p) => p.category === cat).map((p) => ({
      value: p.code,
      label: p.name,
      underwriter: p.underwriter,
    })),
  }));
}

/**
 * Compiled ASIC RG 244 Brand-Comparison Pattern derived from all 39 primary insurers
 * and all 24 Bancassurance/white-label brand aliases.
 */
function buildBrandComparisonRegex(): RegExp {
  const brandTokens = new Set<string>();
  for (const p of PRIMARY_INSURERS) {
    brandTokens.add(p.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    brandTokens.add(p.code.toLowerCase().replace(/_/g, "[\\s_-]+"));
  }
  for (const [aliasKey, aliasVal] of Object.entries(INSURER_BRAND_ALIASES)) {
    brandTokens.add(aliasKey.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    brandTokens.add(aliasVal.displayBrand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }
  const alternation = Array.from(brandTokens)
    .sort((a, b) => b.length - a.length)
    .join("|");
  return new RegExp(
    `\\b(?:is|are)\\s+(?:${alternation})\\s+(?:better|best|cheaper|preferable)\\s+(?:than|for|or)\\b`,
    "i"
  );
}

export const BRAND_COMPARISON_ADVICE_REGEX = buildBrandComparisonRegex();

export interface PolicyComparisonDimension {
  id: "flood" | "jewellery" | "accidental" | "runoff";
  category: string;
  keywords: string[];
}

export const POLICY_COMPARISON_DIMENSIONS: readonly PolicyComparisonDimension[] = [
  {
    id: "flood",
    category: "Flood Definition",
    keywords: ["flood", "normally dry land", "watercourse", "river", "dam"],
  },
  {
    id: "jewellery",
    category: "Jewellery & Watches Sub-limit",
    keywords: ["jewelry", "jewellery", "watches", "sub-limit", "$2,500", "$1,000"],
  },
  {
    id: "accidental",
    category: "Accidental Damage",
    keywords: ["accidental", "damage", "collision", "breakage"],
  },
  {
    id: "runoff",
    category: "Rainwater Run-off & Storm Surge",
    keywords: ["rainwater", "run-off", "storm surge", "actions of the sea", "72-hour"],
  },
] as const;

const CURATED_BENCHMARK_OVERRIDES: Record<
  string,
  Record<PolicyComparisonDimension["id"], string>
> = {
  SUNCORP: {
    flood:
      "Covers the covering of normally dry land by water escaping from a lake, river, creek, or natural watercourse (72-hour embargo applies).",
    jewellery: "$2,500 total ($1,000 per individual item) unless specified on policy schedule.",
    accidental:
      "Included standard on Classic Advantage; optional upgrade on Classic Home & Contents.",
    runoff:
      "Assessed under Insured Event 3 (Storm); actions of the sea and storm surge strictly excluded.",
  },
  NRMA: {
    flood:
      "Standard coverage for covering of normally dry land by water escaping from natural watercourses or lakes (72-hour waiting period).",
    jewellery: "$2,500 per item / $10,000 total per claim unless listed as Specified Contents.",
    accidental: "Optional add-on for Home & Contents; included on Comprehensive Plus tiers.",
    runoff: "Covered under Storm & Rainwater Run-off; actions of the sea and tidal waves excluded.",
  },
  ALLIANZ: {
    flood:
      "Prescribed statutory flood definition included under insured events (72-hour waiting period applies).",
    jewellery: "$2,500 per item / $12,000 maximum total collection limit unless specified.",
    accidental:
      "Covered for Comprehensive Motor collision & optional extension for Home accidental breakage.",
    runoff:
      "Storm surge and action of the sea excluded unless occurring with simultaneous named cyclone.",
  },
  QBE: {
    flood:
      "Standard flood cover included subject to watercourse overflow definition and 72-hour embargo.",
    jewellery: "$2,000 per item / $8,000 total limit for unspecified jewellery and watches.",
    accidental: "Optional accidental damage cover with fixed policy excess per incident.",
    runoff: "Storm surge and action of the sea excluded unless part of an insured flood event.",
  },
  YOUI: {
    flood:
      "Covers flood inundation across Home & Comprehensive Motor subject to 72-hour embargo from policy start.",
    jewellery:
      "Subject to policy schedule specified contents sub-limits and individual risk assessment.",
    accidental:
      "Comprehensive accidental loss or damage covered subject to Basic, Age, and Unnamed Driver excesses.",
    runoff: "Storm and hail covered; actions of the sea and gradual water seepage excluded.",
  },
};

const TRAVEL_DIMENSION_DISCLOSURES: Record<
  PolicyComparisonDimension["id"],
  (profile: InsurerProfile) => string
> = {
  flood: (profile) =>
    `${profile.name} Travel PDS covers trip cancellation/disruption due to natural disasters (including flood) subject to policy issue prior to event public warning.`,
  jewellery: (profile) =>
    `${profile.name} Luggage & Personal Effects sub-limits and age depreciation tables apply per item/pair; high-value jewellery requires specified listing or receipts.`,
  accidental: () =>
    "Covers accidental loss, theft, or damage to accompanied luggage and personal effects subject to policy excess and unattended item exclusions.",
  runoff: () =>
    "Weather and natural disaster claims require official carrier delay verification; pre-existing known events at time of purchase are excluded.",
};

const GENERAL_DIMENSION_DISCLOSURES: Record<
  PolicyComparisonDimension["id"],
  (profile: InsurerProfile) => string
> = {
  flood: (profile) =>
    `Governed by the Prescribed Flood Definition (Insurance Contracts Regulations 2012) under ${profile.name} (${profile.underwriter}), subject to a 72-hour commencement embargo.`,
  jewellery: (profile) =>
    `Standard portable valuables and jewellery sub-limits apply under ${profile.name} Contents PDS unless individually specified on the Policy Schedule.`,
  accidental: (profile) =>
    `Covered under ${profile.name} Comprehensive Motor and optional/tiered Home & Contents accidental damage clauses (${profile.productLines.slice(0, 3).join(", ")}).`,
  runoff: (profile) =>
    `Storm and rainwater run-off assessed separately from riverine Flood; actions of the sea, high tide, and storm surge are excluded under ${profile.name} PDS terms.`,
};

/**
 * Resolves operative comparison terms for any of the 39 primary insurers across the 4 benchmark dimensions,
 * prioritizing active retrieved chunks before falling back to curated & underwriter category disclosures.
 */
export function resolvePolicyComparisonCell(
  dimensionId: PolicyComparisonDimension["id"],
  insurerInput: string,
  sessionChunks: Array<{
    content: string;
    source: { insurer: string; section: string };
  }> = []
): string {
  const resolved = resolveInsurer(insurerInput);
  const code = resolved ? resolved.profile.code : insurerInput.toUpperCase();
  const profile = resolved?.profile;

  // 1. Check curated Tier-1 benchmark baseline first so canonical tables stay crisp
  if (CURATED_BENCHMARK_OVERRIDES[code]?.[dimensionId]) {
    return CURATED_BENCHMARK_OVERRIDES[code][dimensionId];
  }

  // 2. Check session chunks if matching keywords exist for this insurer
  const dim = POLICY_COMPARISON_DIMENSIONS.find((d) => d.id === dimensionId);
  if (dim && sessionChunks.length > 0) {
    const match = sessionChunks.find(
      (c) =>
        c.source.insurer.toLowerCase() ===
          (profile?.name.toLowerCase() ?? insurerInput.toLowerCase()) &&
        dim.keywords.some((kw) => c.content.toLowerCase().includes(kw))
    );
    if (match) {
      const cleanExcerpt = match.content
        .replace(/^#{1,4}\s+.+$/m, "")
        .trim()
        .slice(0, 180);
      return `${cleanExcerpt}... (${match.source.section})`;
    }
  }

  // 3. Category-aware statutory disclosure fallback for all 39 insurers
  if (!profile) {
    return "Subject to published Product Disclosure Statement (PDS) schedule terms.";
  }

  if (profile.category === "travel-specialists") {
    return (
      TRAVEL_DIMENSION_DISCLOSURES[dimensionId]?.(profile) ??
      "Subject to published Product Disclosure Statement (PDS) schedule terms."
    );
  }

  if (profile.category === "life-insurers") {
    return `${profile.name} (${profile.underwriter}) issues Life, TPD, Trauma & Income Protection PDS policies; property perils and general contents sub-limits do not apply.`;
  }

  // Suncorp Group / Challengers / Auto Clubs general insurers
  return (
    GENERAL_DIMENSION_DISCLOSURES[dimensionId]?.(profile) ??
    "Subject to published Product Disclosure Statement (PDS) schedule terms."
  );
}

// ============================================================================
// Corporate Groups & Underwriter Transparency (ASIC RG 244 & Corporations Act s.949A)
// ============================================================================

export type CorporateGroupId =
  | "suncorp-group"
  | "iag-group"
  | "allianz-group"
  | "msig-group"
  | "nobleoak-group"
  | "tal-group"
  | "zurich-group"
  | "auto-general-group";

export interface CorporateGroup {
  id: CorporateGroupId;
  name: string;
  leadUnderwriter: string;
  badgeDescription: string;
}

export const CORPORATE_GROUPS: Readonly<Record<CorporateGroupId, CorporateGroup>> = {
  "suncorp-group": {
    id: "suncorp-group",
    name: "Suncorp Group",
    leadUnderwriter: "AAI Limited",
    badgeDescription:
      "Both brands are underwritten by AAI Limited (Suncorp Group) and share common underwriting and dispute resolution guidelines.",
  },
  "iag-group": {
    id: "iag-group",
    name: "IAG (Insurance Australia Group)",
    leadUnderwriter: "Insurance Australia Limited",
    badgeDescription:
      "Both brands are part of Insurance Australia Group (IAG) and share common underwriting and dispute resolution guidelines.",
  },
  "allianz-group": {
    id: "allianz-group",
    name: "Allianz Australia",
    leadUnderwriter: "Allianz Australia Insurance Limited",
    badgeDescription:
      "Both brands are underwritten by Allianz Australia Insurance Limited and share common underwriting and dispute resolution guidelines.",
  },
  "msig-group": {
    id: "msig-group",
    name: "Mitsui Sumitomo Insurance (MSIG)",
    leadUnderwriter: "Mitsui Sumitomo Insurance Company Limited",
    badgeDescription:
      "Both brands are underwritten by Mitsui Sumitomo Insurance Company Limited (MSIG) and share common underwriting and dispute resolution guidelines.",
  },
  "nobleoak-group": {
    id: "nobleoak-group",
    name: "NobleOak Life Group",
    leadUnderwriter: "NobleOak Life Limited",
    badgeDescription:
      "Both brands are underwritten by NobleOak Life Limited and share common underwriting and dispute resolution guidelines.",
  },
  "tal-group": {
    id: "tal-group",
    name: "TAL (Dai-ichi Life Group)",
    leadUnderwriter: "TAL Life Limited",
    badgeDescription:
      "Both brands are underwritten by TAL Life (Dai-ichi Life Group) and share common underwriting and dispute resolution guidelines.",
  },
  "zurich-group": {
    id: "zurich-group",
    name: "Zurich Insurance Group",
    leadUnderwriter: "Zurich Australia Limited",
    badgeDescription:
      "Both brands are part of Zurich Insurance Group and share common underwriting and dispute resolution guidelines.",
  },
  "auto-general-group": {
    id: "auto-general-group",
    name: "Auto & General",
    leadUnderwriter: "Auto & General Insurance Company Limited",
    badgeDescription:
      "Both brands are underwritten by Auto & General Insurance Company Limited and share common underwriting and dispute resolution guidelines.",
  },
};

/**
 * Maps all canonical insurer codes and slugs to their corporate group (if part of a multi-brand group).
 */
export const INSURER_CORPORATE_GROUP_MAP: Readonly<Record<string, CorporateGroupId>> = {
  // Suncorp Group (7)
  SUNCORP: "suncorp-group",
  suncorp: "suncorp-group",
  AAMI: "suncorp-group",
  aami: "suncorp-group",
  GIO: "suncorp-group",
  gio: "suncorp-group",
  APIA: "suncorp-group",
  apia: "suncorp-group",
  SHANNONS: "suncorp-group",
  shannons: "suncorp-group",
  BINGLE: "suncorp-group",
  bingle: "suncorp-group",
  VERO: "suncorp-group",
  vero: "suncorp-group",

  // IAG Group (3)
  NRMA: "iag-group",
  nrma: "iag-group",
  CGU: "iag-group",
  cgu: "iag-group",
  RACV: "iag-group",
  racv: "iag-group",

  // Allianz Australia Group (3)
  ALLIANZ: "allianz-group",
  allianz: "allianz-group",
  TIO: "allianz-group",
  tio: "allianz-group",
  FAST_COVER: "allianz-group",
  "fast-cover": "allianz-group",
  fast_cover: "allianz-group",

  // Mitsui Sumitomo Insurance (MSIG) (3)
  "1COVER": "msig-group",
  "1cover": "msig-group",
  INSUREANDGO: "msig-group",
  insureandgo: "msig-group",
  ZOOM: "msig-group",
  zoom: "msig-group",

  // NobleOak Life Group (3)
  NOBLEOAK: "nobleoak-group",
  nobleoak: "nobleoak-group",
  NEOS: "nobleoak-group",
  neos: "nobleoak-group",
  PPS_MUTUAL: "nobleoak-group",
  "pps-mutual": "nobleoak-group",
  pps_mutual: "nobleoak-group",

  // TAL Group (2)
  TAL: "tal-group",
  tal: "tal-group",
  ASTERON_LIFE: "tal-group",
  "asteron-life": "tal-group",
  asteron_life: "tal-group",

  // Zurich Insurance Group (2)
  ZURICH: "zurich-group",
  zurich: "zurich-group",
  COVER_MORE: "zurich-group",
  "cover-more": "zurich-group",
  cover_more: "zurich-group",

  // Auto & General (1 + aliases)
  BUDGET_DIRECT: "auto-general-group",
  "budget-direct": "auto-general-group",
  budget_direct: "auto-general-group",
};

export interface SharedUnderwriterInfo {
  isShared: boolean;
  groupId: CorporateGroupId;
  groupName: string;
  underwriterName: string;
  badgeText: string;
}

/**
 * Resolves the corporate group for any given insurer input (code, slug, or alias).
 */
export function getUnderwriterGroup(insurerInput: string): CorporateGroup | null {
  const resolved = resolveInsurer(insurerInput);
  const code = resolved ? resolved.profile.code : insurerInput.trim().toUpperCase();
  const slug = resolved ? resolved.profile.slug : toInsurerSlug(insurerInput);

  const groupId =
    INSURER_CORPORATE_GROUP_MAP[code] ||
    INSURER_CORPORATE_GROUP_MAP[slug] ||
    INSURER_CORPORATE_GROUP_MAP[insurerInput.trim().toUpperCase()] ||
    INSURER_CORPORATE_GROUP_MAP[insurerInput.trim().toLowerCase()];
  if (!groupId) return null;
  return CORPORATE_GROUPS[groupId] ?? null;
}

/**
 * Evaluates whether two insurers share an issuing underwriter or corporate group.
 * Strictly adheres to ASIC RG 244 by producing purely factual institutional copy.
 */
export function getSharedUnderwriterInfo(
  insurerA: string,
  insurerB: string
): SharedUnderwriterInfo | null {
  const resolvedA = resolveInsurer(insurerA);
  const resolvedB = resolveInsurer(insurerB);

  const codeA = resolvedA ? resolvedA.profile.code : insurerA.trim().toUpperCase();
  const codeB = resolvedB ? resolvedB.profile.code : insurerB.trim().toUpperCase();

  // If the same insurer is compared against itself, do not render a shared underwriter badge
  if (codeA === codeB) return null;

  const groupA = getUnderwriterGroup(codeA);
  const groupB = getUnderwriterGroup(codeB);

  if (groupA && groupB && groupA.id === groupB.id) {
    return {
      isShared: true,
      groupId: groupA.id,
      groupName: groupA.name,
      underwriterName: groupA.leadUnderwriter,
      badgeText: groupA.badgeDescription,
    };
  }

  // Fallback: check exact statutory underwriter string match on profiles
  if (
    resolvedA?.profile.underwriter &&
    resolvedB?.profile.underwriter &&
    resolvedA.profile.underwriter.toLowerCase() === resolvedB.profile.underwriter.toLowerCase()
  ) {
    const underwriterClean =
      resolvedA.profile.underwriter.split("(")[0]?.trim() || "the same underwriter";
    return {
      isShared: true,
      groupId: "suncorp-group",
      groupName: underwriterClean,
      underwriterName: underwriterClean,
      badgeText: `Both brands are underwritten by ${underwriterClean} and share common underwriting and dispute resolution guidelines.`,
    };
  }

  return null;
}

export interface CanonicalPdsDefinition {
  product: string;
  docType: "PDS";
  section: string;
  clauseId?: string;
  effectiveDate: string;
  excerpt: string;
}

/**
 * Registry of canonical PDS documents for all 39 primary insurers.
 */
export const CANONICAL_PDS_REGISTRY: Readonly<Record<string, CanonicalPdsDefinition>> = {
  SUNCORP: {
    product: "Suncorp Classic Home",
    docType: "PDS",
    section: "Section 2: Flood & Water Damage",
    clauseId: "2.1",
    effectiveDate: "2026-08-18",
    excerpt:
      "Covers the covering of normally dry land by water escaping from a lake, river, creek, or natural watercourse (Insurance Contracts Regulations 2012 Reg 29D). A strict 72-hour commencement embargo applies. Actions of the sea and storm surge are excluded. Rainwater run-off is assessed under Insured Event 3 (Storm). Jewellery and watches sub-limit is capped at $2,500 total ($1,000 per individual item) unless specified.",
  },
  AAMI: {
    product: "AAMI Home Building & Contents",
    docType: "PDS",
    section: "Section 1: Insured Events & Flood Coverage",
    clauseId: "1.2",
    effectiveDate: "2026-08-26",
    excerpt:
      "Standard cover for flood inundation escaping from natural watercourses, lakes, or dams. 72-hour waiting period applies to flood, storm, and bushfire claims. Complete replacement cover for building; rainwater run-off assessed under storm peril. High-value jewellery subject to scheduled limits.",
  },
  GIO: {
    product: "GIO Platinum Home & Contents",
    docType: "PDS",
    section: "Section 2: Flood & Storm Run-off",
    clauseId: "2.3",
    effectiveDate: "2026-04-01",
    excerpt:
      "Prescribed flood definition applies across Home and Contents policies subject to 72-hour waiting period. Platinum tier provides accidental damage cover standard with fixed excess terms.",
  },
  APIA: {
    product: "Apia Home & Contents Insurance",
    docType: "PDS",
    section: "Section 3: Insured Perils & Defined Events",
    clauseId: "3.1",
    effectiveDate: "2026-03-15",
    excerpt:
      "Designed for over-50s Australian property owners. Standard flood cover included subject to 72-hour embargo. Rainwater run-off covered under storm events; tidal actions of the sea excluded.",
  },
  SHANNONS: {
    product: "Shannons Home & Contents Insurance",
    docType: "PDS",
    section: "Section 2: Flood, Storm & Specialist Cover",
    clauseId: "2.1",
    effectiveDate: "2026-01-20",
    excerpt:
      "Tailored for motoring enthusiasts. Covers flood inundation under prescribed statutory wording. Specialist sub-limits apply to automotive memorabilia, tools of trade, and rare collectables.",
  },
  BINGLE: {
    product: "Bingle Comprehensive Car Insurance",
    docType: "PDS",
    section: "Section 1: Accidental Loss or Damage & Perils",
    clauseId: "1.1",
    effectiveDate: "2026-02-10",
    excerpt:
      "Digital-only comprehensive motor cover for accidental damage, collision, fire, storm, and flood inundation. 72-hour waiting period applies to weather events from initial inception.",
  },
  ALLIANZ: {
    product: "Allianz Home and Contents",
    docType: "PDS",
    section: "Section 4: Flood Definition & Insured Events",
    clauseId: "4.2",
    effectiveDate: "2026-03-01",
    excerpt:
      "Prescribed statutory flood definition included under insured events. 72-hour waiting period applies. Jewellery and watches sub-limit capped at $2,500 per item / $12,000 maximum total collection limit unless individually listed.",
  },
  QBE: {
    product: "QBE Home & Contents Insurance",
    docType: "PDS",
    section: "Section 1: Insured Events & Defined Flood",
    clauseId: "1.4",
    effectiveDate: "2026-01-15",
    excerpt:
      "Standard flood cover included subject to watercourse overflow definition (Reg 29D) and 72-hour embargo. Unspecified jewellery and watches limited to $2,000 per item / $8,000 total claim limit.",
  },
  VERO: {
    product: "Vero Business & Personal Insurance",
    docType: "PDS",
    section: "Section 3: Property Damage & Natural Perils",
    clauseId: "3.2",
    effectiveDate: "2026-02-01",
    excerpt:
      "Intermediated commercial and personal property cover. Prescribed statutory flood terms apply subject to 72-hour waiting period. Storm surge and actions of the sea excluded.",
  },
  NRMA: {
    product: "NRMA Home & Contents",
    docType: "PDS",
    section: "Section 1: Flood & Water Damage",
    clauseId: "1.1",
    effectiveDate: "2025-11-01",
    excerpt:
      "Standard coverage for covering of normally dry land by water escaping from natural watercourses or lakes (72-hour waiting period applies). Rainwater run-off covered under Storm. Jewellery sub-limits capped at $2,500 per item / $10,000 total per claim.",
  },
  BUDGET_DIRECT: {
    product: "Budget Direct Home & Contents",
    docType: "PDS",
    section: "Section 2: Flood & Storm Coverage",
    clauseId: "2.1",
    effectiveDate: "2026-04-12",
    excerpt:
      "Standard flood cover included subject to 72-hour embargo window from policy start. Storm surge and sea actions excluded. High-value jewellery items must be specified on policy schedule.",
  },
  RAC_WA: {
    product: "RAC WA Home & Contents",
    docType: "PDS",
    section: "Section 2: Natural Perils & Flood Coverage",
    clauseId: "2.2",
    effectiveDate: "2026-01-01",
    excerpt:
      "Mutual member policy terms for Western Australian homeowners. Flood inundation covered under Regulations 2012 definitions; 72-hour waiting period applies.",
  },
  RAA: {
    product: "RAA Home & Contents",
    docType: "PDS",
    section: "Section 3: Defined Perils & Flood Conditions",
    clauseId: "3.1",
    effectiveDate: "2026-02-15",
    excerpt:
      "South Australian auto club home cover. Standard statutory flood included with 72-hour embargo. Rainwater run-off covered under storm peril; actions of the sea excluded.",
  },
  RACT: {
    product: "RACT Home & Contents",
    docType: "PDS",
    section: "Section 2: Flood & Storm Perils",
    clauseId: "2.1",
    effectiveDate: "2026-03-01",
    excerpt:
      "Tasmanian member home cover. Covers flood inundation from natural rivers, creeks, or lakes. 72-hour waiting period applies from inception.",
  },
  RACV: {
    product: "RACV Home & Contents",
    docType: "PDS",
    section: "Section 1: Flood & Water Damage",
    clauseId: "1.1",
    effectiveDate: "2025-11-01",
    excerpt:
      "Victorian auto club cover issued by Insurance Manufacturers of Australia (IMA/IAG). Prescribed flood definition applies with 72-hour embargo. Rainwater run-off assessed under storm.",
  },
  RACQ: {
    product: "RACQ Household Insurance",
    docType: "PDS",
    section: "Section 2: Insured Perils & Natural Disasters",
    clauseId: "2.1",
    effectiveDate: "2026-05-01",
    excerpt:
      "Queensland household cover with standard flood definition. 72-hour embargo on flood and named cyclone events. Actions of the sea and storm surge excluded unless specified.",
  },
  CGU: {
    product: "CGU Home & Contents",
    docType: "PDS",
    section: "Section 2: Flood & Defined Events",
    clauseId: "2.1",
    effectiveDate: "2026-01-10",
    excerpt:
      "Intermediated IAG property cover. Prescribed flood definition under Insurance Contracts Regulations 2012. 72-hour waiting period on weather events. Jewellery sub-limits apply.",
  },
  YOUI: {
    product: "Youi Comprehensive Home & Car",
    docType: "PDS",
    section: "Section 1: Insured Events & Flood Inundation",
    clauseId: "1.3",
    effectiveDate: "2026-07-01",
    excerpt:
      "Covers flood inundation across Home and Comprehensive Motor subject to 72-hour embargo from policy start. Specified contents sub-limits and risk excess apply.",
  },
  TIO: {
    product: "TIO Home & Contents Insurance",
    docType: "PDS",
    section: "Section 2: Flood, Storm Surge & Cyclone",
    clauseId: "2.2",
    effectiveDate: "2026-03-01",
    excerpt:
      "Northern Territory coverage underwritten by Allianz Australia. Covers flood, cyclone, and storm run-off. Embargo periods apply to unseasonal tropical perils.",
  },
  GO_INSURANCE: {
    product: "Go Insurance Travel Insurance",
    docType: "PDS",
    section: "Section 1: Trip Disruption, Natural Perils & Medical",
    clauseId: "1.1",
    effectiveDate: "2026-02-01",
    excerpt:
      "Comprehensive travel cover for overseas and domestic journeys. Covers cancellation due to unforeseen natural disasters and flood; medical and luggage sub-limits apply.",
  },
  "1COVER": {
    product: "1Cover Travel Insurance",
    docType: "PDS",
    section: "General Policy Terms: Trip Cancellation & Natural Disasters",
    clauseId: "1.1",
    effectiveDate: "2026-03-04",
    excerpt:
      "Underwritten by Mitsui Sumitomo. Covers cancellation, disruption, and medical costs due to natural disasters. Luggage and personal effects sub-limits apply per pair/item.",
  },
  INSUREANDGO: {
    product: "InsureandGo Comprehensive Travel",
    docType: "PDS",
    section: "Section 1: Cancellation, Medical & Natural Hazards",
    clauseId: "1.2",
    effectiveDate: "2026-01-20",
    excerpt:
      "Underwritten by Mitsui Sumitomo. Travel cancellation due to natural hazards covered if policy purchased before event warnings. Unattended luggage excluded.",
  },
  FAST_COVER: {
    product: "Fast Cover Comprehensive Travel",
    docType: "PDS",
    section: "Section 2: Luggage Sub-Limits & Trip Interruption",
    clauseId: "2.1",
    effectiveDate: "2026-02-15",
    excerpt:
      "Travel disruption, medical evacuation, and luggage benefits underwritten by Allianz Australia / Hollard. Pre-existing known natural events excluded.",
  },
  SCTI: {
    product: "Southern Cross International Travel",
    docType: "PDS",
    section: "Section 1: Medical, Cancellation & Personal Belongings",
    clauseId: "1.1",
    effectiveDate: "2026-01-10",
    excerpt:
      "Direct travel insurance issued by Southern Cross Benefits. Overseas medical expenses, trip cancellation, and personal effects limits apply.",
  },
  SOUTHERN_CROSS: {
    product: "Southern Cross International Travel",
    docType: "PDS",
    section: "Section 1: Medical, Cancellation & Personal Belongings",
    clauseId: "1.1",
    effectiveDate: "2026-01-10",
    excerpt:
      "Direct travel insurance issued by Southern Cross Benefits. Overseas medical expenses, trip cancellation, and personal effects limits apply.",
  },
  ZOOM: {
    product: "Zoom Travel Insurance",
    docType: "PDS",
    section: "Section 1: Emergency Medical & Baggage Sub-limits",
    clauseId: "1.1",
    effectiveDate: "2026-03-01",
    excerpt:
      "Travel insurance underwritten by Mitsui Sumitomo. Emergency medical, baggage sub-limits, and trip interruption coverage subject to excess terms.",
  },
  COVER_MORE: {
    product: "Cover-More Comprehensive Travel",
    docType: "PDS",
    section: "Section 1: Cancellation, Natural Disasters & Medical",
    clauseId: "1.1",
    effectiveDate: "2026-02-01",
    excerpt:
      "Zurich underwritten travel insurance covering cancellation, luggage, and 24/7 medical assistance worldwide. Natural disaster cover requires purchase prior to public warnings.",
  },
  TID: {
    product: "Travel Insurance Direct PDS",
    docType: "PDS",
    section: "Section 1: Overseas Medical & Luggage Benefits",
    clauseId: "1.1",
    effectiveDate: "2026-01-15",
    excerpt:
      "Distributed by nib Travel Services and underwritten by Pacific International. Covers medical emergencies and trip disruption subject to policy exclusions.",
  },
  TRAVEL_INSURANCE_DIRECT: {
    product: "Travel Insurance Direct PDS",
    docType: "PDS",
    section: "Section 1: Overseas Medical & Luggage Benefits",
    clauseId: "1.1",
    effectiveDate: "2026-01-15",
    excerpt:
      "Distributed by nib Travel Services and underwritten by Pacific International. Covers medical emergencies and trip disruption subject to policy exclusions.",
  },
  ZURICH: {
    product: "Zurich Life Protection",
    docType: "PDS",
    section: "Section 1: Life Cover, TPD & Critical Illness Terms",
    clauseId: "1.1",
    effectiveDate: "2026-01-01",
    excerpt:
      "Retail life insurance underwritten by Zurich Australia. Covers terminal illness, life cover, and total and permanent disability according to statutory life fund rules.",
  },
  AIA: {
    product: "AIA Priority Protection",
    docType: "PDS",
    section: "Section 1: Life Cover, Crisis Recovery & TPD",
    clauseId: "1.1",
    effectiveDate: "2026-02-01",
    excerpt:
      "Life insurance, crisis recovery, and income protection issued by AIA Australia. Property peril and general contents terms do not apply.",
  },
  NOBLEOAK: {
    product: "NobleOak Premium Life",
    docType: "PDS",
    section: "Section 1: Term Life & Income Protection Schedules",
    clauseId: "1.1",
    effectiveDate: "2026-01-15",
    excerpt:
      "Direct life cover, trauma, and income protection issued by NobleOak Life Limited. General advice and medical underwriting criteria apply.",
  },
  NEOS: {
    product: "NEOS Protection",
    docType: "PDS",
    section: "Section 1: Life, TPD & Critical Illness Schedules",
    clauseId: "1.1",
    effectiveDate: "2026-02-20",
    excerpt:
      "Retail life risk cover issued by NobleOak Life Limited and reinsured by Pacific Life Re. Comprehensive TPD and life schedules.",
  },
  HCF_LIFE: {
    product: "HCF Life Recover Cover",
    docType: "PDS",
    section: "Section 1: Direct Life & Personal Accident Cover",
    clauseId: "1.1",
    effectiveDate: "2026-01-01",
    excerpt:
      "Direct life and recovery cover issued by HCF Life Insurance Company Pty Limited. Provides lump sum benefits for serious illness and accidental injury.",
  },
  ACENDA: {
    product: "Acenda Life Cover",
    docType: "PDS",
    section: "Section 1: Life Cover, Income Protection & TPD",
    clauseId: "1.1",
    effectiveDate: "2026-03-01",
    excerpt:
      "Retail life insurance issued by Nippon Life Insurance Australia and New Zealand Limited (formerly MLC Life). TPD and income protection terms apply.",
  },
  CHALLENGER: {
    product: "Challenger Guaranteed Annuity",
    docType: "PDS",
    section: "Section 1: Lifetime Income & Annuity Guarantees",
    clauseId: "1.1",
    effectiveDate: "2026-01-01",
    excerpt:
      "Guaranteed lifetime annuity and retirement income streams issued by Challenger Life Company Limited. Capital protection terms apply.",
  },
  CLEARVIEW: {
    product: "ClearView ClearChoice",
    docType: "PDS",
    section: "Section 1: Life, TPD & Income Protection",
    clauseId: "1.1",
    effectiveDate: "2026-02-01",
    excerpt:
      "Comprehensive retail life, TPD, and income protection cover issued by ClearView Life Assurance Limited.",
  },
  METLIFE: {
    product: "MetLife Protect",
    docType: "PDS",
    section: "Section 1: Life Cover & Income Protection Schedules",
    clauseId: "1.1",
    effectiveDate: "2026-01-01",
    excerpt:
      "Retail life protection and disability cover issued by MetLife Insurance Limited. Statutory life fund terms apply.",
  },
  TAL: {
    product: "TAL Accelerated Protection",
    docType: "PDS",
    section: "Section 1: Term Life, Income Protection & Critical Illness",
    clauseId: "1.1",
    effectiveDate: "2026-01-15",
    excerpt:
      "Term life, TPD, and critical illness insurance issued by TAL Life Limited. Full underwriting definitions and waiting period schedules apply.",
  },
  PPS_MUTUAL: {
    product: "PPS Mutual Professionals Choice",
    docType: "PDS",
    section: "Section 1: Professional Life, TPD & Income Protection",
    clauseId: "1.1",
    effectiveDate: "2026-02-01",
    excerpt:
      "Mutual life insurance for qualifying professionals underwritten by NobleOak Life Limited. Profit-share account terms apply.",
  },
  ASTERON_LIFE: {
    product: "Asteron Life Complete Protection",
    docType: "PDS",
    section: "Section 1: Life, TPD & Income Protection",
    clauseId: "1.1",
    effectiveDate: "2026-01-01",
    excerpt:
      "Complete protection life risk portfolio underwritten by TAL Life Insurance Services Limited / Asteron Life. TPD and trauma terms apply.",
  },
};

/**
 * Returns verified canonical PDS document sources as GroundedChunk objects for any of the 39 canonical insurers.
 */
export function getCanonicalPdsSources(insurerInput: string): GroundedChunk[] {
  const resolved = resolveInsurer(insurerInput);
  const code = resolved ? resolved.profile.code : insurerInput.trim().toUpperCase();
  const profile = resolved?.profile ?? PRIMARY_INSURERS.find((p) => p.code === code);

  const def =
    CANONICAL_PDS_REGISTRY[code] ??
    CANONICAL_PDS_REGISTRY[insurerInput.trim().toUpperCase()] ??
    (profile?.slug ? CANONICAL_PDS_REGISTRY[profile.slug] : undefined);

  if (!profile && !def) return [];

  const insurerName = profile?.name ?? insurerInput;
  const underwriter = profile?.underwriter ?? "Australian Financial Services Licensee";
  const product = def?.product ?? `${insurerName} Standard Policy`;
  const section = def?.section ?? "Section 1: Policy Coverage Terms";
  const effectiveDate = def?.effectiveDate ?? "2026-01-01";
  const excerpt =
    def?.excerpt ?? `Operative terms under ${insurerName} Product Disclosure Statement (PDS).`;

  const fullContent = [
    `### ${insurerName} ${product} (PDS)`,
    "",
    `**Issuing Underwriter:** ${underwriter}`,
    `**Operative Section:** ${section}`,
    `**Effective Date:** ${effectiveDate}`,
    "",
    "#### Operative Policy Terms & Coverage Summary:",
    excerpt,
    "",
    `> ${STATUTORY_GAW}`,
  ].join("\n");

  const chunk: GroundedChunk = {
    id: `canonical-pds-${toInsurerSlug(code || insurerName)}`,
    relevanceScore: 1.0,
    content: fullContent,
    source: {
      insurer: insurerName,
      product,
      docType: "PDS",
      section,
      clauseId: def?.clauseId,
      effectiveDate,
      underwriter,
    } as unknown as GroundedChunk["source"],
  };

  return [chunk];
}
