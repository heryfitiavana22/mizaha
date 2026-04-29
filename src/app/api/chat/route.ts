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

const CHAT_MODEL_ID = "gpt-5.4-mini";

const CHAT_SYSTEM_RULES = [
  "Respond in the same language as the user (French if they write in French).",
  "Generate interactive criteria components to help the user refine their company search.",
  "Include the most relevant fields based on what the user described.",
  "Always provide a brief explanation alongside the components.",
  'CRITICAL: Every form component (Select, Checkbox, Slider, ToggleGroup) MUST bind its value/checked prop using { "$bindState": "/statePath" } — never use a plain string or hardcoded value. This is required for user selections to be captured.',
  "CRITICAL: For every $bindState path used, initialize it in spec.state with a sensible default (e.g. empty string for Select, false for Checkbox).",
  "CRITICAL: Never use Button components — they are not available. Use only: Stack, Heading, Text, Checkbox, Slider, Select, ToggleGroup, Separator.",
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
