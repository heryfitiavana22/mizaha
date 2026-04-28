import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import logger from "@/lib/logger";
import {
  buildExtractCriteriaPrompt,
  searchCriteriaSchema,
} from "@/lib/ai/prompts/extract-criteria";
import {
  buildQualifyPrompt,
  qualificationResultSchema,
} from "@/lib/ai/prompts/qualify";
import { buildGenerateDraftPrompt } from "@/lib/ai/prompts/generate-draft";
import type {
  ExtractCriteriaInput,
  GenerateDraftInput,
  LLMProvider,
  QualifyInput,
} from "@/lib/providers/interfaces/llm";
import type { QualificationResult, Result, SearchCriteria } from "@/types";

const MAX_OUTPUT_TOKENS_STRUCTURED = 512;
const MAX_OUTPUT_TOKENS_DRAFT = 1024;

export class VercelLLMProvider implements LLMProvider {
  readonly name: string;

  constructor(
    private readonly model: LanguageModel,
    private readonly modelName: string,
  ) {
    this.name = modelName;
  }

  async extractCriteria({
    rawQuery,
    useCase,
    uiCriteria,
  }: ExtractCriteriaInput): Promise<Result<SearchCriteria>> {
    const start = Date.now();

    try {
      const { output } = await generateText({
        model: this.model,
        output: Output.object({ schema: searchCriteriaSchema }),
        maxOutputTokens: MAX_OUTPUT_TOKENS_STRUCTURED,
        prompt: buildExtractCriteriaPrompt({ rawQuery, useCase, uiCriteria }),
      });

      logger.info(
        {
          provider: this.modelName,
          method: "extractCriteria",
          durationMs: Date.now() - start,
          status: "success",
        },
        "API call completed",
      );

      return { success: true, data: output };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: this.modelName,
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
      const { output } = await generateText({
        model: this.model,
        output: Output.object({ schema: qualificationResultSchema }),
        maxOutputTokens: MAX_OUTPUT_TOKENS_STRUCTURED,
        prompt: buildQualifyPrompt({ company, criteria }),
      });

      logger.info(
        {
          provider: this.modelName,
          method: "qualify",
          durationMs: Date.now() - start,
          status: "success",
        },
        "API call completed",
      );

      return { success: true, data: output };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: this.modelName,
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
      const { text } = await generateText({
        model: this.model,
        maxOutputTokens: MAX_OUTPUT_TOKENS_DRAFT,
        prompt: buildGenerateDraftPrompt({ contact, companyContext }),
      });

      logger.info(
        {
          provider: this.modelName,
          method: "generateDraft",
          durationMs: Date.now() - start,
          status: "success",
        },
        "API call completed",
      );

      return { success: true, data: text };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: this.modelName,
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
