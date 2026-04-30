// ---------------------------------------------------------------------------
// Result pattern — every function that can fail returns Result<T>, never throws
// ---------------------------------------------------------------------------
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
};

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------
export type CompanyData = {
  name: string;
  domain: string;
  sector: string;
  location: string;
  employeeCount?: number;
  legalForm?: string;
  foundedAt?: string;
};

// ---------------------------------------------------------------------------
// Job Board
// ---------------------------------------------------------------------------
export type JobPosting = {
  title: string;
  companyName: string;
  companyDomain?: string; // not always available — lookup via CompanyProvider if missing
  location: string;
  contractType: string;
  techStack?: string[];
  description: string;
  url: string;
  postedAt?: string;
};

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
export type Contact = {
  name?: string;
  title?: string;
  email: string;
  confidence: number; // 0-100
  linkedinUrl?: string;
};

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------
export type SignalSource =
  | "france_travail"
  | "wttj"
  | "pappers_search"
  | "brave";

export type SearchCriteria = {
  targetEntity: "company" | "job_offer";
  sector?: string;
  location?: string;
  techStack?: string[];
  employeeRange?: { min: number; max: number };
  targetPersona?: string;
  maxResults?: number;
  signalSources: SignalSource[];
  searchStrategies: string[];
  qualificationCriteria: string[];
};

export type QualificationResult = {
  score: number; // 0.0 to 1.0
  reason: string;
  matchedCriteria: string[];
};

// ---------------------------------------------------------------------------
// Pipeline step output types
// ---------------------------------------------------------------------------
export type QualifiedCompany = CompanyData & {
  qualification: QualificationResult;
  scrapedContent?: string;
};

export type EnrichedCompany = QualifiedCompany & {
  contacts: Contact[];
};

export type QualifiedJobOffer = JobPosting & {
  qualification: QualificationResult;
  scrapedContent: string; // posting description passed from qualify → enrich
};

export type EnrichedJobOffer = QualifiedJobOffer & {
  company?: CompanyData;
  contacts: Contact[];
};
