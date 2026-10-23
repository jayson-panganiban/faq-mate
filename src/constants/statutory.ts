/**
 * Canonical Statutory Notices & Legal Disclosures
 * Single source of truth derived from GLOSSARY.md and Spec 03.
 */

/**
 * Mandatory statutory General Advice Warning under Section 949A of the Corporations Act 2001 (Cth).
 * Canonical copy defined in GLOSSARY.md § 2.
 */
export const STATUTORY_GAW =
  "⚠️ General Advice Warning: This information is general product information only and does not take into account your personal objectives, financial situation, or needs. Before making any financial decision, you should read the relevant Product Disclosure Statement (PDS) and Target Market Determination (TMD) and seek independent professional advice.";

/**
 * ASIC RG 244 Safe Harbor Refusal Copy for Personal Advice requests (Spec 03 § 1.2).
 */
export const STATUTORY_SAFE_HARBOR_REFUSAL =
  "I cannot provide personal financial product advice or recommend which insurance policy suits your individual financial situation, objectives, or budget.\n\n" +
  "I can, however, provide factual information regarding what is covered or excluded under published Product Disclosure Statements (PDS).\n\n" +
  STATUTORY_GAW;

/**
 * Emergency hotlines mandated under General Insurance Code of Practice (COP) for vulnerable customers.
 */
export const EMERGENCY_HOTLINES = {
  lifeThreat: "Triple Zero (000)",
  ses: "State Emergency Service (SES): 132 500",
  disasterWelfare: "Disaster Welfare Services: 1800 018 444",
  summary: "Triple Zero (000), SES (132 500), or Disaster Welfare Services (1800 018 444)",
} as const;

export const EMERGENCY_REFUSAL_MESSAGE =
  "🚨 EMERGENCY ASSISTANCE: If you or your property are in immediate life danger, please immediately call Triple Zero (000).\n" +
  `• For storm or flood emergency assistance, contact the ${EMERGENCY_HOTLINES.ses}.\n` +
  `• For emergency accommodation and disaster support, contact ${EMERGENCY_HOTLINES.disasterWelfare}.`;

/**
 * Australian Financial Complaints Authority (AFCA) External Dispute Resolution contacts.
 */
export const AFCA_CONTACT = {
  name: "Australian Financial Complaints Authority (AFCA)",
  phone: "1800 931 678",
  website: "https://www.afca.org.au",
  post: "GPO Box 3, Melbourne VIC 3001",
} as const;
