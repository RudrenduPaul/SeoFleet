/**
 * Turns a site URL or a fleet manifest's site `name` into a filesystem-safe
 * slug usable as a per-site report filename stem: lowercased, any URL
 * scheme stripped, and every run of characters that isn't a letter or
 * digit collapsed to a single hyphen (with leading/trailing hyphens
 * trimmed). `https://good.example/blog/post` becomes
 * `good-example-blog-post`; a manifest name like "Client A" becomes
 * `client-a`. Falls back to `"site"` for input that slugifies to nothing
 * (e.g. an empty string or a URL made up entirely of punctuation), so a
 * caller never ends up writing to a blank filename.
 */
export function slugify(input: string): string {
  const withoutScheme = input.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const slug = withoutScheme
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "site";
}
