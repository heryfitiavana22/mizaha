import type { GenerateDraftInput } from "@/lib/providers/interfaces/llm";

// Stub — real prompt content is written in Phase 7
export function buildGenerateDraftPrompt({
  contact,
  companyContext,
}: GenerateDraftInput): string {
  return `You are a freelance business development assistant. Write a personalized outreach email.

Contact:
- Email: ${contact.email}
- Name: ${contact.name ?? "Unknown"}
- Title: ${contact.title ?? "Unknown"}

Company context:
${companyContext}

Write a short, genuine, non-salesy outreach email in French. Plain text only, no subject line.`;
}
