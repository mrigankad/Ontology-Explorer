import type { Entity, Relationship } from "../types";

/**
 * Labels below come from the Wayam ontology reference graphic. The graphic is a
 * taxonomy illustration, so every entity is `draft` with `reference-graphic`
 * provenance until a curator attaches real sources. Descriptions state only what
 * the graphic states; nothing here is a verified product claim.
 */

const T0 = "2026-09-01T09:00:00.000Z";
const T1 = "2026-09-18T14:20:00.000Z";

type EntitySeed = [id: string, label: string, typeId: string, extra?: Partial<Entity>];

const PENDING = "Named in the Wayam reference graphic. Description pending curation from a real source.";

const seeds: EntitySeed[] = [
  ["wayam", "Wayam.ai", "Organization", {
    description: "The company at the centre of the ontology. All products in this dataset are shown as developed by Wayam.ai.",
    aliases: ["Wayam", "Wayam AI"],
    status: "active",
    properties: { kind: "company", headquarters: null },
  }],

  // Products / Platforms
  ["wayameye", "WayamEye", "Product", { aliases: ["Wayam Eye"] }],
  ["vakyam", "Vakyam", "Product"],
  ["pariksha", "Pariksha", "Product"],
  ["sutradhar", "Sutradhar", "Product"],
  ["arjuna", "Arjuna", "Product"],

  // Domains / Capabilities
  ["computer-vision", "Computer Vision", "Capability", { aliases: ["CV", "Vision AI"], description: "Extracting structured information from images and video." }],
  ["nlp", "Natural Language Processing", "Capability", { aliases: ["NLP"], description: "Understanding and generating human language in text and speech transcripts." }],
  ["agentic-ai", "Agentic AI", "Capability", { aliases: ["AI agents"], description: "Systems that plan and take multi-step actions toward a goal using tools." }],
  ["data-analytics", "Data Analytics", "Capability", { aliases: ["Analytics"], description: "Aggregating and interpreting structured and time-series data." }],
  ["automation", "Automation", "Capability", { aliases: ["Workflow automation"], description: "Executing repeatable business steps without manual handling." }],
  ["security-compliance", "Security & Compliance", "Capability", { aliases: ["GRC"], description: "Controls that keep data handling within policy and regulation." }],
  ["spatial-ai", "3D / Spatial AI", "Capability", { aliases: ["Spatial AI", "3D AI"], description: "Reasoning about geometry, depth and position in physical space." }],

  // Detail-tier capabilities (only visible after expanding their parent)
  ["object-detection", "Object Detection", "Capability", { tier: "detail", aliases: ["Detection"], description: "Locating and classifying objects with bounding boxes." }],
  ["ppe-detection", "PPE Detection", "Capability", { tier: "detail", aliases: ["Personal protective equipment detection"], description: "Detecting whether people wear required protective equipment." }],
  ["ocr", "Optical Character Recognition", "Capability", { tier: "detail", aliases: ["OCR"], description: "Reading printed or handwritten text from images and scans." }],
  ["speech-to-text", "Speech-to-Text", "Capability", { tier: "detail", aliases: ["ASR", "Transcription"], description: "Converting spoken audio into time-aligned text." }],
  ["summarization", "Summarization", "Capability", { tier: "detail", description: "Condensing long text or transcripts into key points." }],

  // Technologies / Models
  ["llms", "LLMs", "Technology", { aliases: ["Large language models"], description: "General-purpose large language models." }],
  ["cv-models", "Computer Vision Models", "Technology", { aliases: ["Vision models"], description: "Model families for detection, segmentation and classification of images." }],
  ["vector-db", "Vector Database", "Technology", { aliases: ["Vector store", "Embeddings index"], description: "Storage and similarity search over embeddings." }],
  ["cloud-platforms", "Cloud Platforms", "Technology", { aliases: ["Cloud"], description: "Managed compute, storage and deployment infrastructure." }],
  ["data-apis", "Data Sources / APIs", "Technology", { aliases: ["APIs", "Connectors"], description: "Integrations used to pull data from other systems." }],

  // Data / Information (categories, not files)
  ["images", "Images", "DataCategory", { aliases: ["Image data", "Video frames"], description: "Still images and video frames as a category of input." }],
  ["audio", "Audio", "DataCategory", { aliases: ["Speech", "Recordings"], description: "Recorded sound, including calls and speech." }],
  ["documents", "Documents", "DataCategory", { aliases: ["Docs", "PDFs"], description: "Text documents, forms and scans." }],
  ["structured-data", "Structured Data", "DataCategory", { aliases: ["Tabular data"], description: "Rows and columns from databases, spreadsheets and exports." }],
  ["sensor-iot", "Sensor / IoT Data", "DataCategory", { aliases: ["IoT", "Telemetry"], description: "Time-series readings from sensors and devices." }],

  // Use Cases / Solutions
  ["safety-surveillance", "Safety & Surveillance", "UseCase", { aliases: ["Site safety"], description: "Monitoring sites for unsafe conditions and behaviour." }],
  ["quality-inspection", "Quality Inspection", "UseCase", { aliases: ["Visual QA", "Defect detection"], description: "Detecting defects or deviations in products and equipment." }],
  ["itsm", "IT Service Management", "UseCase", { aliases: ["ITSM"], description: "Handling IT tickets, incidents and requests." }],
  ["regulatory-compliance", "Regulatory Compliance", "UseCase", { aliases: ["Compliance"], description: "Demonstrating adherence to regulation and internal policy." }],
  ["call-analytics", "Call Analytics & QA", "UseCase", { aliases: ["Call QA", "Speech analytics", "Call quality"], description: "Scoring recorded calls against quality and disclosure requirements." }],
  ["document-intelligence", "Document Intelligence", "UseCase", { aliases: ["IDP", "Document AI"], description: "Extracting fields and meaning from documents." }],
  ["process-automation", "Process Automation", "UseCase", { aliases: ["RPA"], description: "Running end-to-end business processes with less manual work." }],

  // Industries (sectors, never clients)
  ["mining", "Mining", "Industry", { description: "Extraction of minerals and ores. An industry sector — not a client." }],
  ["manufacturing", "Manufacturing", "Industry", { description: "Production of goods. An industry sector." }],
  ["healthcare", "Healthcare", "Industry", { description: "Care delivery, payers and life sciences. An industry sector." }],
  ["it-enterprise", "IT / Enterprise", "Industry", { aliases: ["Enterprise IT"], description: "Internal IT and enterprise operations. An industry sector." }],
  ["bfsi", "BFSI", "Industry", { aliases: ["Banking, financial services and insurance", "Finance"], description: "Banking, financial services and insurance. An industry sector." }],
  ["retail", "Retail", "Industry", { description: "Selling goods to consumers. An industry sector." }],
  ["government", "Government / Public Sector", "Industry", { aliases: ["Public sector", "Government"], description: "Public administration and services. An industry sector." }],

  // Users / Stakeholders
  ["business-user", "Business User", "Stakeholder", { description: "Non-technical staff consuming outputs and reports." }],
  ["operations-team", "Operations Team", "Stakeholder", { aliases: ["Ops"], description: "People responsible for day-to-day site or process operation." }],
  ["it-team", "IT Team", "Stakeholder", { description: "People who run and support internal systems." }],
  ["compliance-team", "Compliance Team", "Stakeholder", { description: "People accountable for regulatory and policy adherence." }],
  ["data-scientist", "Data Scientist", "Stakeholder", { description: "People who build and evaluate models and analyses." }],
  ["developer", "Developer", "Stakeholder", { description: "Engineers integrating or extending the platform." }],
  ["end-customer", "End Customer", "Stakeholder", { description: "The customer of the client organisation." }],
];

export const ENTITIES: Entity[] = seeds.map(([id, label, typeId, extra]) => ({
  id,
  label,
  typeId,
  aliases: [],
  description: PENDING,
  properties: {},
  status: "draft",
  tier: "overview",
  provenance: "reference-graphic",
  classification: "internal",
  createdAt: T0,
  updatedAt: T1,
  ...extra,
}));

// ---------------------------------------------------------------------------

type RelSeed = [id: string, subject: string, predicate: string, object: string, extra?: Partial<Relationship>];

const REFERENCE_NOTE = "Link drawn in the Wayam reference graphic. Illustrative until a curator attaches evidence.";
const DEMO_NOTE = "Cross-family link added for the demo so the graph can be explored beyond a star. Not a sourced claim.";

const rels: RelSeed[] = [
  // Company → products
  ["r-dev-wayameye", "wayam", "develops", "wayameye"],
  ["r-dev-vakyam", "wayam", "develops", "vakyam"],
  ["r-dev-pariksha", "wayam", "develops", "pariksha"],
  ["r-dev-sutradhar", "wayam", "develops", "sutradhar"],
  ["r-dev-arjuna", "wayam", "develops", "arjuna"],

  // WayamEye
  ["r-we-cv", "wayameye", "implements", "computer-vision"],
  ["r-we-safety", "wayameye", "solves", "safety-surveillance"],
  ["r-we-quality", "wayameye", "solves", "quality-inspection", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-we-images", "wayameye", "processes", "images"],
  ["r-we-cvmodels", "wayameye", "uses", "cv-models"],
  ["r-we-ops", "wayameye", "used_by", "operations-team", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],

  // Vakyam
  ["r-vk-nlp", "vakyam", "implements", "nlp"],
  ["r-vk-call", "vakyam", "supports", "call-analytics"],
  ["r-vk-audio", "vakyam", "processes", "audio"],
  ["r-vk-llms", "vakyam", "uses", "llms"],
  ["r-vk-compliance", "vakyam", "used_by", "compliance-team", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],

  // Pariksha
  ["r-pk-reg", "pariksha", "supports", "regulatory-compliance", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-pk-docs", "pariksha", "processes", "documents", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],

  // Sutradhar
  ["r-st-agentic", "sutradhar", "implements", "agentic-ai"],
  ["r-st-process", "sutradhar", "supports", "process-automation"],
  ["r-st-llms", "sutradhar", "uses", "llms", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-st-vector", "sutradhar", "uses", "vector-db", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-st-dev", "sutradhar", "used_by", "developer", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],

  // Arjuna
  ["r-aj-agentic", "arjuna", "implements", "agentic-ai", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-aj-itsm", "arjuna", "supports", "itsm", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-aj-spatial", "arjuna", "implements", "spatial-ai", {
    status: "disputed",
    provenance: "demo-fixture",
    provenanceNote: "Demo claim deliberately left disputed: a synthetic roadmap note contradicts it.",
    reviewedBy: "demo.curator",
  }],

  // Capability → use case
  ["r-cv-safety", "computer-vision", "enables", "safety-surveillance"],
  ["r-cv-quality", "computer-vision", "enables", "quality-inspection"],
  ["r-nlp-call", "nlp", "enables", "call-analytics"],
  ["r-nlp-docs", "nlp", "enables", "document-intelligence"],
  ["r-agentic-process", "agentic-ai", "enables", "process-automation"],
  ["r-auto-process", "automation", "enables", "process-automation"],
  ["r-auto-itsm", "automation", "enables", "itsm", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-sec-reg", "security-compliance", "enables", "regulatory-compliance"],
  ["r-spatial-safety", "spatial-ai", "enables", "safety-surveillance", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],

  // Capability → technology
  ["r-cv-cvmodels", "computer-vision", "uses", "cv-models"],
  ["r-nlp-llms", "nlp", "uses", "llms"],
  ["r-agentic-llms", "agentic-ai", "uses", "llms"],
  ["r-agentic-vector", "agentic-ai", "uses", "vector-db"],
  ["r-analytics-apis", "data-analytics", "uses", "data-apis"],
  ["r-auto-cloud", "automation", "uses", "cloud-platforms", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],

  // → data categories
  ["r-cvmodels-images", "cv-models", "processes", "images"],
  ["r-llms-docs", "llms", "processes", "documents"],
  ["r-apis-structured", "data-apis", "processes", "structured-data"],
  ["r-analytics-sensor", "data-analytics", "processes", "sensor-iot"],
  ["r-analytics-structured", "data-analytics", "processes", "structured-data"],

  // Use case → industry
  ["r-safety-mining", "safety-surveillance", "applied_in", "mining"],
  ["r-safety-mfg", "safety-surveillance", "applied_in", "manufacturing", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-quality-mfg", "quality-inspection", "applied_in", "manufacturing"],
  ["r-call-bfsi", "call-analytics", "applied_in", "bfsi"],
  ["r-call-retail", "call-analytics", "applied_in", "retail", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-docs-health", "document-intelligence", "applied_in", "healthcare"],
  ["r-reg-bfsi", "regulatory-compliance", "applied_in", "bfsi"],
  ["r-itsm-it", "itsm", "applied_in", "it-enterprise"],
  ["r-process-gov", "process-automation", "applied_in", "government"],

  // → stakeholders
  ["r-call-compliance", "call-analytics", "used_by", "compliance-team"],
  ["r-itsm-itteam", "itsm", "used_by", "it-team"],
  ["r-docs-business", "document-intelligence", "used_by", "business-user"],
  ["r-analytics-ds", "data-analytics", "used_by", "data-scientist"],
  ["r-quality-ops", "quality-inspection", "used_by", "operations-team"],
  ["r-process-end", "process-automation", "used_by", "end-customer", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],

  // Detail tier
  ["r-od-cv", "object-detection", "part_of", "computer-vision", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-ppe-cv", "ppe-detection", "part_of", "computer-vision", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-ppe-od", "ppe-detection", "part_of", "object-detection", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-ocr-cv", "ocr", "part_of", "computer-vision", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-stt-nlp", "speech-to-text", "part_of", "nlp", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
  ["r-sum-nlp", "summarization", "part_of", "nlp", { provenance: "demo-fixture", provenanceNote: DEMO_NOTE }],
];

export const RELATIONSHIPS: Relationship[] = rels.map(([id, subjectId, relationTypeId, objectId, extra]) => ({
  id,
  subjectId,
  relationTypeId,
  objectId,
  status: "draft",
  validFrom: null,
  validTo: null,
  createdBy: "seed:reference-graphic",
  reviewedBy: null,
  provenance: "reference-graphic",
  provenanceNote: REFERENCE_NOTE,
  classification: "internal",
  createdAt: T0,
  updatedAt: T1,
  ...extra,
}));
