import { env } from "@/env";
import logger from "@/lib/logger";
import type {
  EmailProvider,
  FindContactInput,
} from "@/lib/providers/interfaces/email";
import type { Contact, Result } from "@/types";

const BASE_URL = "https://api.apollo.io/api/v1";

// Each email reveal costs 10 credits (free tier: 100/month non-corporate, 10 000/month corporate)
const MAX_CONTACTS_PER_DOMAIN = 3;

type ApolloPerson = {
  id?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  linkedin_url?: string;
  email?: string;
  has_email?: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toContact(person: Record<string, unknown>): Contact | null {
  if (typeof person.email !== "string" || !person.email) return null;
  const nameParts = [person.first_name, person.last_name].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  return {
    name: nameParts.length > 0 ? nameParts.join(" ") : undefined,
    title: typeof person.title === "string" ? person.title : undefined,
    email: person.email,
    confidence: 80,
    linkedinUrl:
      typeof person.linkedin_url === "string" ? person.linkedin_url : undefined,
  };
}

async function apolloPost({
  path,
  body,
}: {
  path: string;
  body: Record<string, unknown>;
}): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "X-Api-Key": env.APOLLO_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Apollo API responded with ${response.status}`);
  }
  return response.json();
}

async function revealContactById({
  personId,
}: {
  personId: string;
}): Promise<Contact | null> {
  const data = await apolloPost({
    path: "/people/match",
    body: { id: personId, reveal_personal_emails: true },
  });
  if (!isObject(data)) return null;
  const person = data.person;
  return isObject(person) ? toContact(person) : null;
}

export class ApolloEmailProvider implements EmailProvider {
  readonly name = "Apollo";

  async findByDomain(domain: string): Promise<Result<Contact[]>> {
    const start = Date.now();

    try {
      // Step 1 — search people by domain (free, no credits consumed)
      const searchData = await apolloPost({
        path: "/mixed_people/api_search",
        body: {
          q_organization_domains_list: [domain],
          page: 1,
          per_page: MAX_CONTACTS_PER_DOMAIN,
        },
      });

      if (!isObject(searchData))
        throw new Error("Unexpected Apollo search response shape");

      const people = Array.isArray(searchData.people)
        ? (searchData.people as ApolloPerson[])
        : [];

      // Step 2 — reveal email for candidates that have one (costs credits)
      const contacts: Contact[] = [];
      for (const person of people.filter((p) => p.has_email && p.id)) {
        if (!person.id) continue;
        const contact = await revealContactById({ personId: person.id });
        if (contact) contacts.push(contact);
      }

      logger.info(
        {
          provider: "apollo",
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
          provider: "apollo",
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
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName =
        nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

      const data = await apolloPost({
        path: "/people/match",
        body: {
          first_name: firstName,
          last_name: lastName,
          domain,
          reveal_personal_emails: true,
        },
      });

      if (!isObject(data))
        throw new Error("Unexpected Apollo match response shape");

      const contact = isObject(data.person) ? toContact(data.person) : null;

      logger.info(
        {
          provider: "apollo",
          method: "findContact",
          durationMs: Date.now() - start,
          status: "success",
          found: !!contact,
        },
        "API call completed",
      );

      return { success: true, data: contact };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        {
          provider: "apollo",
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
