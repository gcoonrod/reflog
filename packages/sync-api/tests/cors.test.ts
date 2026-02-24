import { describe, it, expect } from "vitest";
import { isAllowedOrigin, parseOrigins } from "../src/middleware/cors";

describe("parseOrigins", () => {
  it("splits comma-separated origins", () => {
    expect(parseOrigins("http://a.com,http://b.com")).toEqual([
      "http://a.com",
      "http://b.com",
    ]);
  });

  it("trims whitespace", () => {
    expect(parseOrigins(" http://a.com , http://b.com ")).toEqual([
      "http://a.com",
      "http://b.com",
    ]);
  });

  it("filters empty segments", () => {
    expect(parseOrigins("http://a.com,,http://b.com,")).toEqual([
      "http://a.com",
      "http://b.com",
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(parseOrigins("")).toEqual([]);
  });
});

describe("isAllowedOrigin", () => {
  const patterns = parseOrigins(
    "http://localhost:3000,https://reflog.microcode.io,https://*.reflog-8t5.pages.dev,https://reflog-8t5.pages.dev",
  );

  it("allows exact match", () => {
    expect(isAllowedOrigin("http://localhost:3000", patterns)).toBe(true);
    expect(isAllowedOrigin("https://reflog.microcode.io", patterns)).toBe(true);
    expect(isAllowedOrigin("https://reflog-8t5.pages.dev", patterns)).toBe(
      true,
    );
  });

  it("allows wildcard subdomain match", () => {
    expect(
      isAllowedOrigin("https://develop.reflog-8t5.pages.dev", patterns),
    ).toBe(true);
    expect(
      isAllowedOrigin("https://feat-login.reflog-8t5.pages.dev", patterns),
    ).toBe(true);
    expect(
      isAllowedOrigin("https://abc123.reflog-8t5.pages.dev", patterns),
    ).toBe(true);
  });

  it("rejects non-matching origins", () => {
    expect(isAllowedOrigin("https://evil.com", patterns)).toBe(false);
    expect(
      isAllowedOrigin("https://reflog.microcode.io.evil.com", patterns),
    ).toBe(false);
  });

  it("rejects nested subdomains for single wildcard", () => {
    expect(
      isAllowedOrigin("https://a.b.reflog-8t5.pages.dev", patterns),
    ).toBe(false);
  });

  it("rejects empty origin", () => {
    expect(isAllowedOrigin("", patterns)).toBe(false);
  });

  it("returns false when no patterns configured", () => {
    expect(isAllowedOrigin("https://anything.com", [])).toBe(false);
  });
});
