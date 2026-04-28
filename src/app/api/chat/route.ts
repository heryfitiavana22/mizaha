import { chatCatalog } from "@/lib/ui-generative/catalog/chat";
import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import type { UIMessage } from "ai";
import { pipeJsonRender } from "@json-render/core";
import { z } from "zod";

const CHAT_MODEL_ID = "gpt-4o-mini";

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
    model: openai(CHAT_MODEL_ID),
    system: chatCatalog.prompt({
      mode: "inline",
      customRules: CHAT_SYSTEM_RULES,
    }),
    messages: await convertToModelMessages(messages),
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.merge(pipeJsonRender(result.toUIMessageStream()));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
