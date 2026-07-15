import type { Check } from "../types.js";
import { titleCheck } from "./technical/title.js";
import { metaDescriptionCheck } from "./technical/meta-description.js";
import { canonicalCheck } from "./technical/canonical.js";
import { robotsTxtCheck } from "./technical/robots-txt.js";
import { sitemapXmlCheck } from "./technical/sitemap-xml.js";
import { headingStructureCheck } from "./technical/heading-structure.js";
import { imageAltCheck } from "./technical/image-alt.js";
import { structuredDataCheck } from "./geo/structured-data.js";
import { llmsTxtCheck } from "./geo/llms-txt.js";
import { aiCrawlerDirectivesCheck } from "./geo/ai-crawler-directives.js";
import { faqSchemaCheck } from "./geo/faq-schema.js";
import { contentExtractionCheck } from "./geo/content-extraction.js";

export const TECHNICAL_CHECKS: Check[] = [
  titleCheck,
  metaDescriptionCheck,
  canonicalCheck,
  robotsTxtCheck,
  sitemapXmlCheck,
  headingStructureCheck,
  imageAltCheck,
];

export const GEO_CHECKS: Check[] = [
  structuredDataCheck,
  llmsTxtCheck,
  aiCrawlerDirectivesCheck,
  faqSchemaCheck,
  contentExtractionCheck,
];

export const ALL_CHECKS: Check[] = [...TECHNICAL_CHECKS, ...GEO_CHECKS];

export {
  titleCheck,
  metaDescriptionCheck,
  canonicalCheck,
  robotsTxtCheck,
  sitemapXmlCheck,
  headingStructureCheck,
  imageAltCheck,
  structuredDataCheck,
  llmsTxtCheck,
  aiCrawlerDirectivesCheck,
  faqSchemaCheck,
  contentExtractionCheck,
};
