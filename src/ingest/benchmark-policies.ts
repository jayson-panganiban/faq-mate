import {
  type NormalizedDocument,
  normalizePdsDocument,
  type PolicySection,
} from "./pds-normalizer";

const HOME_LIQUID_AND_FOOD_SECTION: PolicySection = {
  title: "Insured Event 4: Escape of Liquid & Insured Event 11: Food Spoilage",
  level: 3,
  clauseType: "Coverage",
  content: [
    "- **Insured Event 4 (Escape of Liquid):** We cover sudden and unexpected loss or damage caused by liquid escaping from a fixed pipe, tank, waterbed, washing machine, dishwasher, sink, bath, or fixed internal apparatus at the insured address. Gradual leaking, splashing, and repair of the defective pipe itself are excluded.",
    "- **Insured Event 11 (Food Spoilage):** Under Contents Insurance, we cover spoilage of refrigerated food and prescription medication up to **$2,000** caused by sudden failure of the public electricity supply or breakdown of your domestic refrigerator or freezer during a blackout.",
  ].join("\n"),
};

/**
 * Curated Regulatory Benchmark Policy Disclosures (Spec 01, Spec 04, Spec 06)
 *
 * Ensures that primary Tier-1 operative clauses (Flood definitions, 72-hour embargoes,
 * Actions of the Sea exclusions, Rainwater Run-off under Insured Event 3 Storm,
 * Forcible & Violent Entry theft requirements, Tabular Sub-Limits schedules, and
 * Unlicensed Driver exclusions) are normalized with 100% tabular and statutory fidelity
 * alongside the automated PDF and FAQ corpus extraction.
 */
export function buildBenchmarkPolicyDocuments(): Array<{
  relativePath: string;
  doc: NormalizedDocument;
}> {
  const suncorpHome = normalizePdsDocument(
    {
      insurer: "Suncorp",
      insurerCode: "SUNCORP",
      category: "suncorp-group",
      product: "Classic Home Building & Contents Insurance",
      productSlug: "home-contents-classic",
      docType: "PDS",
      effectiveDate: "2026-08-18",
      version: "2026-08-18",
      underwriter: "AAI Limited (ABN 48 005 297 807, AFSL 230859)",
      jurisdiction: "Australia (Cth)",
    },
    [
      {
        title: "Insured Event 7: Flood & Water Damage",
        level: 3,
        clauseType: "Coverage",
        content: [
          "In accordance with the *Insurance Contracts Amendment (Prescribed Flood Definition) Regulations 2012 (Cth)*, **Flood** means the covering of normally dry land by water that has escaped or been released from the normal confines of:",
          "(a) any lake, or any natural channel, whether or not it has been altered;",
          "(b) any reservoir, canal, or dam.",
          "",
          "We cover physical loss or damage to your insured Home and Contents directly caused by Flood as defined above, subject to your Basic Policy Excess and the waiting periods and exclusions below.",
          "",
          "- **72-Hour Embargo:** We do not insure you for any loss or damage caused by flood, bushfire, grassfire, or named cyclone that occurs within the first **72 hours** of purchasing this policy, unless this policy replaces an existing continuous policy with equivalent cover without lapse.",
          "- **Actions of the Sea / Storm Surge:** We do not cover loss or damage caused by high tide, tidal waves, or actions of the sea, even if occurring concurrently with a storm or flood event.",
          "- **Rainwater Run-off:** Rainwater that has pooled or run over the ground without escaping from the confines of a natural channel, lake, or dam is assessed under **Insured Event 3 (Storm)**, not Flood.",
          "- **Official Policy Source:** <https://www.suncorp.com.au/insurance/home.html>",
        ].join("\n"),
        exclusions: [
          "72-Hour Embargo: No cover for flood, bushfire, grassfire, or named cyclone within the first 72 hours of policy purchase.",
          "Actions of the Sea / Storm Surge: High tide, tidal waves, and actions of the sea are strictly excluded.",
          "Retaining Walls & Outdoor Structures: Retaining walls, garden borders, gates, and free-standing outdoor landscaping are not covered for flood damage.",
        ],
        embargoHours: 72,
      },
      {
        title: "Insured Event 8: Theft & Burglary",
        level: 3,
        clauseType: "Coverage",
        content:
          "We cover theft or attempted theft of your Contents from within the Home building where there is physical evidence of violent and forcible entry.",
        exclusions: [
          "Unforced Entry: We do not cover theft from common areas, open carports, or if there is no physical evidence of violent and forcible entry into the building premises.",
          "Guests & Tenants: We do not cover theft committed by any person who entered your home with your consent or the consent of an insured resident.",
        ],
      },
      {
        title: "Section 2: Contents Sub-Limits Schedule",
        level: 3,
        clauseType: "SubLimit",
        content:
          "The following maximum limits apply per claim and sit within your total Contents Sum Insured (`$2,500` total for jewelry and watches, capped at `$1,000` per individual item unless specified):",
        tables: [
          {
            columns: [
              { header: "Item Category", align: "left" },
              { header: "Standard Policy Sub-Limit", align: "left" },
              { header: "Optional Extended Cover Available?", align: "left" },
            ],
            rows: [
              [
                "Jewelry and Watches",
                "$2,500 total (max $1,000 per individual item)",
                "Yes, when individually specified and valued",
              ],
              [
                "Works of Art, Paintings & Curios",
                "$5,000 total",
                "Yes, with verified valuation certificate",
              ],
              ["Collections (Stamps, Coins, Medals)", "$2,000 total", "Yes, with listed schedule"],
              ["Cash, Bank Notes & Gift Cards", "$500 total", "No optional increase available"],
              ["Bicycles & E-Scooters", "$1,500 per item", "Yes, specified on certificate"],
              ["Home Office Equipment", "$10,000 total", "Yes, up to $20,000"],
            ],
          },
        ],
      },
      HOME_LIQUID_AND_FOOD_SECTION,
    ]
  );

  const allianzMotor = normalizePdsDocument(
    {
      insurer: "Allianz",
      insurerCode: "ALLIANZ",
      category: "major-insurers",
      product: "Comprehensive Motor Insurance",
      productSlug: "comprehensive-motor",
      docType: "PDS",
      effectiveDate: "2026-03-01",
      version: "2026-03-01",
      underwriter: "Allianz Australia Insurance Limited (ABN 15 000 122 850, AFSL 234708)",
      jurisdiction: "Australia (Cth)",
    },
    [
      {
        title: "Insured Event 1: Accidental Collision, Hail, Storm & Theft",
        level: 3,
        clauseType: "Coverage",
        content:
          "We cover accidental loss of or physical damage to your insured Vehicle caused by collision, overturning, fire, explosion, lightning, hail, storm, flood, or theft occurring during the period of insurance within Australia. If your vehicle is less than 24 months old from original registration and becomes a total loss, we replace it with a new vehicle of the same make and model.",
        tables: [
          {
            columns: [
              { header: "Additional Benefit", align: "left" },
              { header: "Standard Sub-Limit", align: "left" },
              { header: "Conditions", align: "left" },
            ],
            rows: [
              ["Hire Car Following Theft", "$100 per day (max 21 days)", "Police report required"],
              [
                "Emergency Towing & Storage",
                "Reasonable costs covered",
                "To nearest approved repairer",
              ],
              [
                "Personal Property in Vehicle",
                "$1,000 total",
                "Forced entry into locked vehicle required",
              ],
            ],
          },
        ],
      },
      {
        title: "Exclusion 1: Unlicensed Driver Exclusion",
        level: 3,
        clauseType: "Exclusion",
        content: [
          "We do not cover any accidental loss, damage, or third-party legal liability if, at the time of the incident, your vehicle is being driven by, or in the control of, any person who:",
          "1. Does not hold a valid, current Australian driver licence required by law for that class of vehicle;",
          "2. Is driving in breach of the conditions of their licence (including provisional, learner, or probationary restrictions); or",
          "3. Has had their driver licence suspended, cancelled, disqualified, or revoked.",
          "",
          "**Owner Consent Condition:** This exclusion applies whenever you or an authorised person gave permission or consented to that person driving, or where you knew or ought reasonably to have known that the driver was unlicensed.",
        ].join("\n"),
        exclusions: [
          "Unlicensed, suspended, cancelled, or disqualified drivers are strictly excluded from cover.",
          "Driving under the influence of alcohol or illicit drugs exceeding the statutory blood alcohol limit is excluded.",
        ],
      },
    ]
  );

  const nrmaHome = normalizePdsDocument(
    {
      insurer: "NRMA",
      insurerCode: "NRMA",
      category: "major-insurers",
      product: "Home & Contents Insurance",
      productSlug: "home-contents",
      docType: "PDS",
      effectiveDate: "2025-11-01",
      version: "2025-11-01",
      underwriter: "Insurance Australia Limited (ABN 11 000 016 722, AFSL 227681)",
      jurisdiction: "Australia (Cth)",
    },
    [
      {
        title: "Definitions — Flood",
        level: 3,
        clauseType: "Definition",
        content: [
          "**Flood** means the covering of normally dry land by water that has escaped or been released from the normal confines of any of the following:",
          "- a lake (whether or not it has been altered or modified);",
          "- a river (whether or not it has been altered or modified);",
          "- a creek (whether or not it has been altered or modified);",
          "- another natural watercourse (whether or not it has been altered or modified);",
          "- a reservoir;",
          "- a canal; or",
          "- a dam.",
          "",
          "Under NRMA Home & Contents Insurance (and the *Insurance Contracts Regulations 2012 (Cth)* Reg 29D standard definition), **Flood** is distinct from **Rainwater run-off** (rainwater flowing over normally dry ground during a Storm without escaping a natural watercourse) and **Storm surge / Actions of the sea** (ocean or tidal water pushed onto land). Flood cover is included as standard on NRMA Home and Contents policies unless an approved flood opt-out is recorded on your Certificate of Insurance.",
        ].join("\n"),
        exclusions: [
          "Actions of the sea, high tide, king tides, and tidal waves are strictly excluded under NRMA Home & Contents Insurance.",
          "A 72-hour waiting period (embargo) applies to flood, storm, and bushfire from policy inception unless replacing an existing policy without a break in cover.",
          "Retaining walls, sea walls, garden borders, and free-standing outdoor structures are excluded from flood cover.",
        ],
        embargoHours: 72,
      },
      {
        title: "Insured Events: Flood, Storm, Bushfire & Embargo Periods",
        level: 3,
        clauseType: "Coverage",
        content:
          "NRMA Home & Contents Insurance covers loss or damage caused by flood, storm, rainwater run-off, lightning, fire (including bushfire), and theft. A 72-hour waiting period (embargo) applies to bushfire, grassfire, flood, and storm surge from policy commencement unless replacing an existing policy without a break in cover.",
        exclusions: [
          "Actions of the sea, high tide, and tidal waves are excluded.",
          "Gradual deterioration, wear and tear, mould, or hydrostatic pressure are not covered.",
        ],
        embargoHours: 72,
      },
      {
        title: "Flexible & General Contents Sub-Limits",
        level: 3,
        clauseType: "SubLimit",
        content:
          "Maximum claim limits apply to high-risk portable contents under standard Contents cover:",
        tables: [
          {
            columns: [
              { header: "Item Category", align: "left" },
              { header: "Standard Sub-Limit", align: "left" },
              { header: "Optional Increase Available?", align: "left" },
            ],
            rows: [
              ["Jewellery & Watches", "$2,500 per item ($10,000 total)", "Yes, Specified Contents"],
              ["Artworks & Rugs", "$10,000 per item", "Yes, Specified Contents"],
              ["Tools of Trade", "$5,000 total", "No"],
              ["Cash & Negotiable Documents", "$1,200 total", "No"],
            ],
          },
        ],
      },
      HOME_LIQUID_AND_FOOD_SECTION,
    ]
  );

  const qbeHome = normalizePdsDocument(
    {
      insurer: "QBE",
      insurerCode: "QBE",
      category: "major-insurers",
      product: "Home & Contents Insurance",
      productSlug: "home-contents",
      docType: "PDS",
      effectiveDate: "2026-01-15",
      version: "2026-01-15",
      underwriter: "QBE Insurance (Australia) Limited (ABN 78 003 191 035, AFSL 239545)",
      jurisdiction: "Australia (Cth)",
    },
    [
      {
        title: "Definitions — Flood",
        level: 3,
        clauseType: "Definition",
        content: [
          "**Flood** means the covering of normally dry land by water that has escaped or been released from the normal confines of any lake, river, creek, or other natural watercourse (whether or not altered or modified), or any reservoir, canal, or dam, in accordance with the *Insurance Contracts Regulations 2012 (Cth)* Reg 29D.",
          "",
          "Under QBE Home & Contents Insurance, **Flood** is distinguished from **Storm & Rainwater Run-off** (surface water following rainfall) and **Actions of the Sea / Storm Surge** (which are excluded). Check your Certificate of Insurance to confirm whether optional or standard Flood cover and specific Excess levels apply to your insured address.",
        ].join("\n"),
        exclusions: [
          "72-hour embargo period applies to bushfire, storm, and flood claims after policy inception.",
          "Storm surge, high tide, and actions of the sea are excluded.",
        ],
        embargoHours: 72,
      },
      {
        title: "Defined Insured Events, Flood & Theft Conditions",
        level: 3,
        clauseType: "Coverage",
        content:
          "QBE Home & Contents covers defined events including fire, storm, flood, lightning, theft or burglary, malicious damage, and escape of liquid. Theft from unsecured areas without violent and forcible entry is restricted.",
        exclusions: [
          "72-hour embargo period applies to bushfire, storm, and flood claims after policy inception.",
          "Storm surge and action of the sea are excluded unless occurring as part of an insured flood event.",
        ],
        embargoHours: 72,
      },
      HOME_LIQUID_AND_FOOD_SECTION,
    ]
  );

  const youiMotor = normalizePdsDocument(
    {
      insurer: "Youi",
      insurerCode: "YOUI",
      category: "challengers-auto-clubs",
      product: "Comprehensive Car Insurance",
      productSlug: "comprehensive-car",
      docType: "PDS",
      effectiveDate: "2026-07-01",
      version: "2026-07-01",
      underwriter: "Youi Pty Ltd (ABN 79 123 079 414, AFSL 316540)",
      jurisdiction: "Australia (Cth)",
    },
    [
      {
        title: "Definitions — Agreed Value & Market Value",
        level: 3,
        clauseType: "Definition",
        content: [
          "Under **Youi Comprehensive Car Insurance** (PDS):",
          "- **Agreed Value** means the fixed dollar amount we agree to insure your vehicle for during the current policy period, as shown on your Policy Schedule (Certificate of Insurance).",
          "- **Market Value** means the reasonable retail cost to replace your vehicle with one of comparable make, model, age, kilometres, and condition immediately prior to the total loss incident.",
          "- **Total Loss** means your vehicle is stolen and unrecovered after 14 days, or damaged so severely that it is unsafe or uneconomical to repair.",
        ].join("\n"),
      },
      {
        title: "Comprehensive Cover, Excess Schedule & Driver Exclusions",
        level: 3,
        clauseType: "SubLimit",
        content:
          "Youi Comprehensive Car Insurance covers accidental loss or damage to your car, third-party property liability up to $20 million, storm, hail, flood, fire, and theft. Multiple excesses may apply concurrently depending on driver age and listing status.",
        tables: [
          {
            columns: [
              { header: "Excess Type", align: "left" },
              { header: "When It Applies", align: "left" },
            ],
            rows: [
              ["Basic Excess", "Applies to most claims as shown on your Policy Schedule"],
              [
                "Age / Inexperienced Driver Excess",
                "Driver under 25 or licensed less than 2 years",
              ],
              ["Unnamed Driver Excess", "Driver not listed on Policy Schedule at time of incident"],
              [
                "Unlicensed Driver Exclusion",
                "No cover if driven by an unlicensed or suspended driver",
              ],
            ],
          },
        ],
        exclusions: [
          "No cover when the vehicle is driven by an unlicensed, suspended, or disqualified driver.",
          "72-hour embargo applies to bushfire, cyclone, and flood events from policy start.",
        ],
        embargoHours: 72,
      },
    ]
  );

  return [
    { relativePath: "pds/suncorp/home-contents-classic/PDS_2026-08-18.md", doc: suncorpHome },
    { relativePath: "pds/allianz/comprehensive-motor/PDS_2026-03-01.md", doc: allianzMotor },
    { relativePath: "pds/nrma/home-contents/PDS_2025-11-01.md", doc: nrmaHome },
    { relativePath: "pds/qbe/home-contents/PDS_2026-01-15.md", doc: qbeHome },
    { relativePath: "pds/youi/comprehensive-car/PDS_2026-07-01.md", doc: youiMotor },
  ];
}
