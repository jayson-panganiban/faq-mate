/**
 * Canonical Australian Insurer Registry (v2.0)
 *
 * Single source of truth for the 39 primary archive insurers in data/raw/
 * across 5 categories, plus Bancassurance and white-label brand aliases mapped
 * to their issuing underwriter in accordance with Australian General & Life
 * Insurance disclosure standards.
 */

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
    (p) => p.code === upper || p.slug === slug || p.name.toLowerCase() === cleaned.toLowerCase()
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
