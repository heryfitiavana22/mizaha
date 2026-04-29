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
// Email
// ---------------------------------------------------------------------------
export type Contact = {
  name?: string;
  title?: string;
  email: string;
  confidence: number; // 0-100 — Hunter returns max 3 contacts per domain on free tier
  linkedinUrl?: string;
};

// ---------------------------------------------------------------------------
// LLM
// ---------------------------------------------------------------------------
export type SearchCriteria = {
  sector?: string;
  location?: string;
  techStack?: string[];
  employeeRange?: { min: number; max: number };
  targetPersona?: string;
  maxResults?: number;
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
