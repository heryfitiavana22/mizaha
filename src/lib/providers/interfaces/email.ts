import type { Contact, Result } from "@/types";

export type FindContactInput = {
  name: string;
  domain: string;
};

export interface EmailProvider {
  readonly name: string;
  findByDomain(domain: string): Promise<Result<Contact[]>>;
  findContact(input: FindContactInput): Promise<Result<Contact | null>>;
}
