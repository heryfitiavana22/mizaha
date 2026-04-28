import type { GenerateDraftInput } from "@/lib/providers/interfaces/llm";

export function buildGenerateDraftPrompt({
  contact,
  companyContext,
}: GenerateDraftInput): string {
  const contactName = contact.name ?? "Bonjour";
  const contactTitle = contact.title ? ` (${contact.title})` : "";

  return `You are helping a French freelance developer write a personalized outreach email.

Recipient: ${contactName}${contactTitle}
Company context:
${companyContext}

Write a short outreach email in French. Rules:
- Maximum 5 sentences
- Start with "Bonjour ${contactName},"
- Reference one specific and concrete thing about the company from the context
- Explain briefly what you offer and why it is relevant to them
- End with a low-pressure call to action (a short call, a quick exchange)
- No buzzwords, no corporate speak, no hollow compliments
- Plain text only — no subject line, no signature`;
}
