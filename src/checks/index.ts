import type { Check } from "../types.js";
import { titleCheck } from "./technical/title.js";
import { metaDescriptionCheck } from "./technical/meta-description.js";
import { canonicalCheck } from "./technical/canonical.js";
import { robotsTxtCheck } from "./technical/robots-txt.js";
import { sitemapXmlCheck } from "./technical/sitemap-xml.js";
import { headingStructureCheck } from "./technical/heading-structure.js";
import { imageAltCheck } from "./technical/image-alt.js";
import { openGraphCheck } from "./technical/open-graph.js";
import { twitterCardCheck } from "./technical/twitter-card.js";
import { robotsMetaDirectivesCheck } from "./technical/robots-meta-directives.js";
import { imageWeightCheck } from "./technical/image-weight.js";
import { redirectChainCheck } from "./technical/redirect-chain.js";
import { structuredDataCheck } from "./geo/structured-data.js";
import { llmsTxtCheck } from "./geo/llms-txt.js";
import { aiCrawlerDirectivesCheck } from "./geo/ai-crawler-directives.js";
import { faqSchemaCheck } from "./geo/faq-schema.js";
import { contentExtractionCheck } from "./geo/content-extraction.js";
import { speakableSchemaCheck } from "./geo/speakable-schema.js";
import { organizationSchemaCheck } from "./geo/organization-schema.js";
import { markdownNegotiationCheck } from "./geo/markdown-negotiation.js";
import { linkHeaderCheck } from "./geo/link-header.js";

export const TECHNICAL_CHECKS: Check[] = [
  titleCheck,
  metaDescriptionCheck,
  canonicalCheck,
  robotsTxtCheck,
  sitemapXmlCheck,
  headingStructureCheck,
  imageAltCheck,
  openGraphCheck,
  twitterCardCheck,
  robotsMetaDirectivesCheck,
  imageWeightCheck,
  redirectChainCheck,
];

export const GEO_CHECKS: Check[] = [
  structuredDataCheck,
  llmsTxtCheck,
  aiCrawlerDirectivesCheck,
  faqSchemaCheck,
  contentExtractionCheck,
  speakableSchemaCheck,
  organizationSchemaCheck,
  markdownNegotiationCheck,
  linkHeaderCheck,
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
  openGraphCheck,
  twitterCardCheck,
  robotsMetaDirectivesCheck,
  imageWeightCheck,
  redirectChainCheck,
  structuredDataCheck,
  llmsTxtCheck,
  aiCrawlerDirectivesCheck,
  faqSchemaCheck,
  contentExtractionCheck,
  speakableSchemaCheck,
  organizationSchemaCheck,
  markdownNegotiationCheck,
  linkHeaderCheck,
};
