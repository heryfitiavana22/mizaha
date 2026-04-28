import { env } from "@/env";
import logger from "@/lib/logger";
import type {
  EmailProvider,
  FindContactInput,
} from "@/lib/providers/interfaces/email";
import type { Contact, Result } from "@/types";

const BASE_URL = "https://api.hunter.io/v2";

type HunterEmail = {
  value?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  linkedin?: string;
  confidence?: number;
};

type HunterDomainSearchResponse = {
  data?: { emails?: HunterEmail[] };
};

type HunterEmailFinderResponse = {
  data?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    position?: string;
    linkedin?: string;
    score?: number;
  };
};

function isObject(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

function toContact(email: HunterEmail): Contact | null {
  if (!email.value) return null;
  const nameParts = [email.first_name, email.last_name].filter(Boolean);
  return {
    name: nameParts.length > 0 ? nameParts.join(" ") : undefined,
    title: email.position,
    email: email.value,
    confidence: email.confidence ?? 0,
    linkedinUrl: email.linkedin,
  };
}

export class HunterEmailProvider implements EmailProvider {
  async findByDomain(domain: string): Promise<Result<Contact[]>> {
    const start = Date.now();

    try {
      const params = new URLSearchParams({
        domain,
        api_key: env.HUNTER_API_KEY,
      });
      const response = await fetch(`${BASE_URL}/domain-search?${params}`);

      if (!response.ok)
        throw new Error(`Hunter API responded with ${response.status}`);

      const raw: unknown = await response.json();
      if (!isObject(raw))
        throw new Error("Unexpected Hunter domain-search response shape");

      const data = raw as HunterDomainSearchResponse;
      const contacts = (data.data?.emails ?? [])
        .map(toContact)
        .filter((c): c is Contact => c !== null);

      logger.info(
        {
          provider: "hunter",
          method: "findByDomain",
          durationMs: Date.now() - start,
          status: "success",
          count: contacts.length,
        },
        "API call completed",
      );

      return { success: true, data: contacts };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "hunter",
          method: "findByDomain",
          durationMs: Date.now() - start,
          status: "error",
          error: err.message,
        },
        "API call failed",
      );
      return { success: false, error: err };
    }
  }

  async findContact({
    name,
    domain,
  }: FindContactInput): Promise<Result<Contact | null>> {
    const start = Date.now();

    try {
      const params = new URLSearchParams({
        domain,
        full_name: name,
        api_key: env.HUNTER_API_KEY,
      });
      const response = await fetch(`${BASE_URL}/email-finder?${params}`);

      if (!response.ok)
        throw new Error(`Hunter API responded with ${response.status}`);

      const raw: unknown = await response.json();
      if (!isObject(raw))
        throw new Error("Unexpected Hunter email-finder response shape");

      const data = raw as HunterEmailFinderResponse;
      const finderData = data.data;

      if (!finderData?.email) {
        logger.info(
          {
            provider: "hunter",
            method: "findContact",
            durationMs: Date.now() - start,
            status: "success",
            found: false,
          },
          "API call completed",
        );
        return { success: true, data: null };
      }

      const nameParts = [finderData.first_name, finderData.last_name].filter(
        Boolean,
      );
      const contact: Contact = {
        name: nameParts.length > 0 ? nameParts.join(" ") : undefined,
        title: finderData.position,
        email: finderData.email,
        confidence: finderData.score ?? 0,
        linkedinUrl: finderData.linkedin,
      };

      logger.info(
        {
          provider: "hunter",
          method: "findContact",
          durationMs: Date.now() - start,
          status: "success",
          found: true,
        },
        "API call completed",
      );

      return { success: true, data: contact };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "hunter",
          method: "findContact",
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
