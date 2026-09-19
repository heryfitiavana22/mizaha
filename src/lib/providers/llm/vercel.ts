import { generateText, Output } from "ai";
import type { LanguageModel } from "ai";
import logger from "@/lib/logger";
import {
  buildExtractCriteriaPrompt,
  searchCriteriaSchema,
} from "@/lib/ai/prompts/extract-criteria";
import {
  buildExtractCompanyNamesPrompt,
  extractedCompanyNamesSchema,
} from "@/lib/ai/prompts/extract-company-names";
import {
  buildQualifyPrompt,
  qualificationResultSchema,
} from "@/lib/ai/prompts/qualify";
import type { ExtractCriteriaInput } from "@/lib/providers/interfaces/text-extractor";
import type { QualifyInput } from "@/lib/providers/interfaces/entity-scorer";
import type { LLMProvider } from "@/lib/providers/interfaces/llm";
import type {
  QualificationResult,
  Result,
  SearchCriteria,
  SearchResult,
} from "@/types";

const MAX_OUTPUT_TOKENS = 512;

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
        maxOutputTokens: MAX_OUTPUT_TOKENS,
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

  async extractCompanyNames(
    results: SearchResult[],
  ): Promise<Result<string[]>> {
    const start = Date.now();
    try {
      const { output } = await generateText({
        model: this.model,
        output: Output.object({ schema: extractedCompanyNamesSchema }),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        prompt: buildExtractCompanyNamesPrompt({ results }),
      });
      logger.info(
        {
          provider: this.modelName,
          method: "extractCompanyNames",
          durationMs: Date.now() - start,
          status: "success",
          count: output.companyNames.length,
        },
        "API call completed",
      );
      return { success: true, data: output.companyNames };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: this.modelName,
          method: "extractCompanyNames",
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
    entity,
    criteria,
    scrapedContent,
  }: QualifyInput): Promise<Result<QualificationResult>> {
    const start = Date.now();
    try {
      const { output } = await generateText({
        model: this.model,
        output: Output.object({ schema: qualificationResultSchema }),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        prompt: buildQualifyPrompt({ entity, criteria, scrapedContent }),
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
}
