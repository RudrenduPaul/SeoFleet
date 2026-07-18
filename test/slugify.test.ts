import { describe, expect, it } from "vitest";
import { slugify } from "../src/slugify.js";

describe("slugify", () => {
  it("strips the scheme and collapses a URL's hostname+path into one slug", () => {
    expect(slugify("https://good.example/blog/post")).toBe("good-example-blog-post");
  });

  it("lowercases and hyphenates a plain manifest name", () => {
    expect(slugify("Client A")).toBe("client-a");
  });

  it("collapses runs of punctuation into a single hyphen", () => {
    expect(slugify("https://good.example:8080/a//b--c")).toBe("good-example-8080-a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("-- weird --")).toBe("weird");
  });

  it("falls back to \"site\" for input that slugifies to nothing", () => {
    expect(slugify("")).toBe("site");
    expect(slugify("://///")).toBe("site");
  });
});
