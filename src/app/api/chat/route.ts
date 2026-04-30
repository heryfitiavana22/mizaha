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
  "Your goal is to understand the user's intent, then generate interactive criteria components so they can refine their search.",
  "Determine the use case from the conversation: 'freelance-client' when the user wants to find companies (clients) to prospect; 'find-jobs' when the user wants to find job offers or missions.",
  "Include the most relevant fields based on what the user described.",
  "Always provide a brief explanation alongside the components.",
  'CRITICAL: Every form component (Select, Checkbox, Slider, ToggleGroup) MUST bind its value/checked prop using { "$bindState": "/statePath" } — never use a plain string or hardcoded value. This is required for user selections to be captured.',
  "CRITICAL: For every $bindState path used, initialize it in spec.state with a sensible default (e.g. empty string for Select, false for Checkbox).",
  "When you are confident about the use case and the user's main request, include a Button at the bottom of the spec bound to the 'launchSearch' action with the determined useCaseName and the user's rawQuery verbatim. Label it 'Lancer la recherche →'.",
  "Only show the launch Button once you have enough context. Do not show it on the very first response if the intent is still unclear.",
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
