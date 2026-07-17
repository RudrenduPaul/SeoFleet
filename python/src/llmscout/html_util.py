"""
A minimal HTML tree builder used in place of the TypeScript CLI's `cheerio`
dependency. The npm package parses HTML with cheerio; this Python port uses
only the standard library `html.parser`, building a small DOM-like tree
(`Element`) with just enough surface -- tag, attributes, children, and text
extraction -- for the 12 checks in `LLMScout.checks` to query. It is not a
general-purpose HTML parser: it targets the same well-formed-enough real
website HTML the original tool assumes.

Not part of the original TypeScript source (there was no equivalent module
to port -- cheerio provided this directly); written to keep the individual
check modules a faithful, readable port of their TypeScript counterparts.
"""
from __future__ import annotations

from html.parser import HTMLParser
from typing import Iterable, List, Optional, Set

# Void elements never receive a matching end tag in real-world HTML, so the
# tree builder must close them immediately instead of waiting for one.
_VOID_TAGS = frozenset(
    {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }
)


class Element:
    """One node in the parsed tree. `children` holds a mix of `Element`
    nodes and plain `str` text nodes, in document order."""

    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag: str, attrs: dict, parent: Optional["Element"] = None) -> None:
        self.tag = tag
        self.attrs = attrs
        self.children: List["Element | str"] = []
        self.parent = parent

    def attr(self, name: str) -> Optional[str]:
        """Returns the attribute value, or None if the attribute is not
        present at all (mirrors cheerio's `.attr()` returning `undefined`
        for a missing attribute, distinct from an attribute present but
        empty, e.g. `alt=""`)."""
        return self.attrs.get(name)

    def has_attr(self, name: str) -> bool:
        return name in self.attrs

    def text(self) -> str:
        """Concatenates all descendant text nodes, document order."""
        parts: List[str] = []
        for child in self.children:
            if isinstance(child, str):
                parts.append(child)
            else:
                parts.append(child.text())
        return "".join(parts)

    def find_all(self, tags: Iterable[str]) -> List["Element"]:
        """All descendant elements (not self) whose tag is in `tags`,
        pre-order document order."""
        wanted: Set[str] = set(tags)
        results: List[Element] = []
        for child in self.children:
            if isinstance(child, Element):
                if child.tag in wanted:
                    results.append(child)
                results.extend(child.find_all(tags))
        return results

    def find_first(self, tags: Iterable[str]) -> Optional["Element"]:
        wanted: Set[str] = set(tags)
        for child in self.children:
            if isinstance(child, Element):
                if child.tag in wanted:
                    return child
                found = child.find_first(tags)
                if found is not None:
                    return found
        return None


class _TreeBuilder(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Element("#document", {})
        self._stack: List[Element] = [self.root]

    def handle_starttag(self, tag: str, attrs) -> None:
        el = Element(tag, dict(attrs), parent=self._stack[-1])
        self._stack[-1].children.append(el)
        if tag not in _VOID_TAGS:
            self._stack.append(el)

    def handle_startendtag(self, tag: str, attrs) -> None:
        el = Element(tag, dict(attrs), parent=self._stack[-1])
        self._stack[-1].children.append(el)
        # Explicitly self-closed (`<tag ... />`); never pushed.

    def handle_endtag(self, tag: str) -> None:
        # Pop back to (and including) the matching open tag, if any is
        # still open. Mismatched/unclosed tags in real-world HTML are
        # common; ignoring an end tag with no matching open tag (rather
        # than raising) keeps the tree builder tolerant of that.
        for i in range(len(self._stack) - 1, 0, -1):
            if self._stack[i].tag == tag:
                del self._stack[i:]
                return

    def handle_data(self, data: str) -> None:
        if data:
            self._stack[-1].children.append(data)


def parse_html(html: str) -> Element:
    """Parses an HTML document string into an `Element` tree rooted at a
    synthetic `#document` node."""
    builder = _TreeBuilder()
    builder.feed(html)
    builder.close()
    return builder.root


def get_meta_content(root: Element, name: str) -> Optional[str]:
    """First `<meta name="...">`'s `content` attribute, case-insensitive
    name match, or None if no such tag exists."""
    for el in root.find_all(("meta",)):
        if (el.attr("name") or "").strip().lower() == name.lower():
            content = el.attr("content")
            return content.strip() if content is not None else None
    return None


def get_link_href(root: Element, rel: str) -> Optional[str]:
    """First `<link rel="...">`'s `href` attribute, case-insensitive rel
    match, or None if no such tag exists."""
    for el in root.find_all(("link",)):
        if (el.attr("rel") or "").strip().lower() == rel.lower():
            href = el.attr("href")
            return href.strip() if href is not None else None
    return None


def get_scripts_by_type(root: Element, type_: str) -> List[Element]:
    return [
        el
        for el in root.find_all(("script",))
        if (el.attr("type") or "").strip().lower() == type_.lower()
    ]
