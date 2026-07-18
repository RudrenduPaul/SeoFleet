import type { Check, CheckContext, CheckResult } from "../../types.js";

const ID = "organization-schema";
const NAME = "Organization schema";
const CATEGORY = "geo" as const;

const ENTITY_TYPES = ["Organization", "Corporation", "LocalBusiness", "Person"];

function hasEntityType(typeValue: unknown): boolean {
  if (typeof typeValue === "string") return ENTITY_TYPES.includes(typeValue);
  if (Array.isArray(typeValue)) return typeValue.some((t) => typeof t === "string" && ENTITY_TYPES.includes(t));
  return false;
}

function findEntityNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEntityNode(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (hasEntityType(obj["@type"])) return obj;
    if ("@graph" in obj) return findEntityNode(obj["@graph"]);
  }
  return null;
}

function hasNonEmptySameAs(node: Record<string, unknown>): boolean {
  const sameAs = node["sameAs"];
  if (Array.isArray(sameAs)) return sameAs.length > 0;
  return typeof sameAs === "string" && sameAs.trim().length > 0;
}

export const organizationSchemaCheck: Check = {
  id: ID,
  name: NAME,
  category: CATEGORY,
  run(ctx: CheckContext): CheckResult {
    const base = { id: ID, name: NAME, category: CATEGORY };

    if (!ctx.$) {
      return {
        ...base,
        status: "FAIL",
        message: "Homepage could not be fetched, so Organization schema could not be checked.",
        fix: "Confirm siteUrl in LLMScout.json is correct and reachable.",
      };
    }

    const $ = ctx.$;
    let entityNode: Record<string, unknown> | null = null;
    $('script[type="application/ld+json"]').each((_i, el) => {
      if (entityNode) return;
      try {
        const parsed: unknown = JSON.parse($(el).text());
        entityNode = findEntityNode(parsed);
      } catch {
        // invalid JSON-LD is reported by the structured-data check; ignore here
      }
    });

    // Organization/Person schema only applies to entities that actually
    // want a Knowledge Panel presence, so its absence is informational,
    // never a failure.
    if (!entityNode) {
      return {
        ...base,
        status: "WARN",
        message: `No ${ENTITY_TYPES.join("/")} structured data found.`,
        fix: "Add Organization (or Person) JSON-LD with a sameAs array of your official social/profile URLs to strengthen Knowledge Panel signals.",
      };
    }

    if (!hasNonEmptySameAs(entityNode)) {
      return {
        ...base,
        status: "WARN",
        message: "Organization/Person schema found, but it has no sameAs property.",
        fix: "Add a sameAs array listing this entity's official social profiles and other authoritative URLs.",
      };
    }

    return {
      ...base,
      status: "PASS",
      message: "Organization/Person schema found with a sameAs property linking authoritative profiles.",
    };
  },
};
