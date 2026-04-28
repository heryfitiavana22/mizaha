import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";
import logger from "@/lib/logger";
import { buildExtractCriteriaPrompt } from "@/lib/ai/prompts/extract-criteria";
import { buildQualifyPrompt } from "@/lib/ai/prompts/qualify";
import { buildGenerateDraftPrompt } from "@/lib/ai/prompts/generate-draft";
import type {
  ExtractCriteriaInput,
  GenerateDraftInput,
  LLMProvider,
  QualifyInput,
} from "@/lib/providers/interfaces/llm";
import type { QualificationResult, Result, SearchCriteria } from "@/types";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS_JSON = 512;
const MAX_TOKENS_DRAFT = 1024;

function extractText(response: Anthropic.Message): string {
  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}

function parseJson<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in LLM response");
  return JSON.parse(match[0]) as T;
}

export class ClaudeLLMProvider implements LLMProvider {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async extractCriteria({
    rawQuery,
    useCase,
  }: ExtractCriteriaInput): Promise<Result<SearchCriteria>> {
    const start = Date.now();

    try {
      const prompt = buildExtractCriteriaPrompt({ rawQuery, useCase });
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS_JSON,
        messages: [{ role: "user", content: prompt }],
      });

      const criteria = parseJson<SearchCriteria>(extractText(response));

      logger.info(
        {
          provider: "claude",
          method: "extractCriteria",
          durationMs: Date.now() - start,
          status: "success",
        },
        "API call completed",
      );

      return { success: true, data: criteria };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "claude",
          method: "extractCriteria",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }

  async qualify({
    company,
    criteria,
  }: QualifyInput): Promise<Result<QualificationResult>> {
    const start = Date.now();

    try {
      const prompt = buildQualifyPrompt({ company, criteria });
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS_JSON,
        messages: [{ role: "user", content: prompt }],
      });

      const result = parseJson<QualificationResult>(extractText(response));

      logger.info(
        {
          provider: "claude",
          method: "qualify",
          durationMs: Date.now() - start,
          status: "success",
        },
        "API call completed",
      );

      return { success: true, data: result };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "claude",
          method: "qualify",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }

  async generateDraft({
    contact,
    companyContext,
  }: GenerateDraftInput): Promise<Result<string>> {
    const start = Date.now();

    try {
      const prompt = buildGenerateDraftPrompt({ contact, companyContext });
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS_DRAFT,
        messages: [{ role: "user", content: prompt }],
      });

      const draft = extractText(response);

      logger.info(
        {
          provider: "claude",
          method: "generateDraft",
          durationMs: Date.now() - start,
          status: "success",
        },
        "API call completed",
      );

      return { success: true, data: draft };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "claude",
          method: "generateDraft",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }
}
