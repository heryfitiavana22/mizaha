import { chatCatalog } from "@/lib/ui-generative/catalog/chat";
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";

const CHAT_MODEL_ID = "claude-haiku-4-5-20251001";

const CHAT_SYSTEM_RULES = [
  "Respond in the same language as the user (French if they write in French).",
  "Generate interactive criteria components to help the user refine their company search.",
  "Include the most relevant fields based on what the user described.",
  "Always provide a brief explanation alongside the components.",
];

const chatBodySchema = z.object({
  messages: z.array(z.unknown()).min(1),
});

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json();
  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 });
  }

  const messages = parsed.data.messages as UIMessage[];

  const result = streamText({
    model: anthropic(CHAT_MODEL_ID),
    system: chatCatalog.prompt({ customRules: CHAT_SYSTEM_RULES }),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
