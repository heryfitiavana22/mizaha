// ---------------------------------------------------------------------------
// Result pattern — every function that can fail returns Result<T>, never throws
// ---------------------------------------------------------------------------
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: Error };

// ---------------------------------------------------------------------------
// Search (SearchProvider)
// ---------------------------------------------------------------------------
export type SearchOptions = {
  country?: string;
  limit?: number;
};

export type SearchResult = {
  url: string;
  title: string;
  snippet: string;
};

// ---------------------------------------------------------------------------
// Company (CompanyProvider)
// ---------------------------------------------------------------------------
export type CompanyCriteria = {
  sector?: string;
  location?: string;
  minEmployees?: number;
  maxEmployees?: number;
};

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
// Scraper (ScraperProvider)
// ---------------------------------------------------------------------------
export type ScrapedContent = {
  url: string;
  title: string;
  content: string;
  metadata: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Email (EmailProvider)
// ---------------------------------------------------------------------------
export type Contact = {
  name?: string;
  title?: string;
  email: string;
  confidence: number; // 0-100 — Hunter returns max 3 contacts per domain on free tier
  linkedinUrl?: string;
};

// ---------------------------------------------------------------------------
// LLM (LLMProvider)
// ---------------------------------------------------------------------------
export type SearchCriteria = {
  sector?: string;
  location?: string;
  signals: string[]; // e.g.: ["recently_funded", "hiring_dev"]
  techStack?: string[];
  employeeRange?: { min: number; max: number };
};

export type QualificationResult = {
  score: number; // 0.0 to 1.0
  reason: string;
  matchedSignals: string[];
};

// ---------------------------------------------------------------------------
// Pipeline step output types
// ---------------------------------------------------------------------------
export type QualifiedCompany = CompanyData & {
  qualification: QualificationResult;
};

export type EnrichedCompany = QualifiedCompany & {
  contacts: Contact[];
};
