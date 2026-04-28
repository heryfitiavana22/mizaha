import { describe, expect, it, vi } from "vitest";
import { extractCriteria } from "@/lib/pipeline/steps/extract-criteria";
import { fakeCriteria } from "@/tests/fixtures/search";
import { makeMockLLMProvider } from "@/tests/mocks/providers";

describe("extractCriteria", () => {
  it("delegates to llm.extractCriteria and returns its result", async () => {
    const llm = makeMockLLMProvider();

    const result = await extractCriteria({
      rawQuery: "startups React Paris",
      useCase: "freelance",
      llm,
    });

    expect(result).toEqual({ success: true, data: fakeCriteria });
    expect(llm.extractCriteria).toHaveBeenCalledWith({
      rawQuery: "startups React Paris",
      useCase: "freelance",
    });
  });

  it("propagates llm failure as a Result", async () => {
    const error = new Error("LLM unavailable");
    const llm = makeMockLLMProvider({
      extractCriteria: vi.fn().mockResolvedValue({ success: false, error }),
    });

    const result = await extractCriteria({
      rawQuery: "test",
      useCase: "freelance",
      llm,
    });

    expect(result).toEqual({ success: false, error });
  });
});
