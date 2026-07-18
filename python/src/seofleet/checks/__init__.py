"""Ported from src/checks/index.ts."""
from __future__ import annotations

from typing import List

from ..types import Check
from .geo.ai_crawler_directives import ai_crawler_directives_check
from .geo.content_extraction import content_extraction_check
from .geo.faq_schema import faq_schema_check
from .geo.llms_txt import llms_txt_check
from .geo.structured_data import structured_data_check
from .technical.canonical import canonical_check
from .technical.heading_structure import heading_structure_check
from .technical.image_alt import image_alt_check
from .technical.image_weight import image_weight_check
from .technical.meta_description import meta_description_check
from .technical.redirect_chain import redirect_chain_check
from .technical.robots_txt import robots_txt_check
from .technical.sitemap_xml import sitemap_xml_check
from .technical.title import title_check

TECHNICAL_CHECKS: List[Check] = [
    title_check,
    meta_description_check,
    canonical_check,
    robots_txt_check,
    sitemap_xml_check,
    heading_structure_check,
    image_alt_check,
    image_weight_check,
    redirect_chain_check,
]

GEO_CHECKS: List[Check] = [
    structured_data_check,
    llms_txt_check,
    ai_crawler_directives_check,
    faq_schema_check,
    content_extraction_check,
]

ALL_CHECKS: List[Check] = [*TECHNICAL_CHECKS, *GEO_CHECKS]

__all__ = [
    "TECHNICAL_CHECKS",
    "GEO_CHECKS",
    "ALL_CHECKS",
    "title_check",
    "meta_description_check",
    "canonical_check",
    "robots_txt_check",
    "sitemap_xml_check",
    "heading_structure_check",
    "image_alt_check",
    "image_weight_check",
    "redirect_chain_check",
    "structured_data_check",
    "llms_txt_check",
    "ai_crawler_directives_check",
    "faq_schema_check",
    "content_extraction_check",
]
