import { describe, expect, it } from "vitest";

import { bucketFor, clientAddress, VERIFIED_IP_HEADER } from "@/lib/rate-limit/client-ip";

const ON_VERCEL = { VERCEL: "1" };

function from(headers: Record<string, string>, env: Record<string, string | undefined> = ON_VERCEL) {
  return clientAddress(new Headers(headers), env);
}

describe("bucketFor", () => {
  it.each([
    ["203.0.113.7", { kind: "ip", version: 4, bucket: "203.0.113.7" }],
    [" 203.0.113.7 ", { kind: "ip", version: 4, bucket: "203.0.113.7" }],
    // IPv6 is keyed by /64: one subscriber, one bucket.
    ["2001:db8:85a3:8d3:1319:8a2e:370:7348", { kind: "ip", version: 6, bucket: "2001:db8:85a3:8d3::/64" }],
    ["2001:db8:85a3:8d3::1", { kind: "ip", version: 6, bucket: "2001:db8:85a3:8d3::/64" }],
    ["2001:DB8::", { kind: "ip", version: 6, bucket: "2001:db8:0:0::/64" }],
    ["::1", { kind: "ip", version: 6, bucket: "0:0:0:0::/64" }],
    ["fe80::1%eth0", { kind: "ip", version: 6, bucket: "fe80:0:0:0::/64" }],
    // IPv4-mapped IPv6 is the IPv4 client, and shares its bucket.
    ["::ffff:203.0.113.7", { kind: "ip", version: 4, bucket: "203.0.113.7" }],
    ["::ffff:cb00:7107", { kind: "ip", version: 4, bucket: "203.0.113.7" }],
    // An embedded IPv4 tail that is not the mapped prefix stays IPv6.
    ["64:ff9b::203.0.113.7", { kind: "ip", version: 6, bucket: "64:ff9b:0:0::/64" }],
  ])("buckets %s", (raw, expected) => {
    expect(bucketFor(raw)).toEqual(expected);
  });

  it("gives every address in one /64 the same bucket, and the next /64 another", () => {
    const a = bucketFor("2001:db8:1:2:aaaa::1");
    const b = bucketFor("2001:db8:1:2:ffff:ffff:ffff:ffff");
    const c = bucketFor("2001:db8:1:3::1");

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it.each(["", "unknown", "203.0.113", "203.0.113.256", "evil.example", "1.2.3.4:443", "[::1]"])(
    "refuses %j",
    (raw) => {
      expect(bucketFor(raw)).toBeNull();
    }
  );
});

describe("clientAddress", () => {
  it("trusts the verified header on Vercel", () => {
    expect(from({ [VERIFIED_IP_HEADER]: "203.0.113.7" })).toEqual({
      kind: "ip",
      version: 4,
      bucket: "203.0.113.7",
    });
  });

  it("takes the client from the left of a list", () => {
    expect(from({ [VERIFIED_IP_HEADER]: "203.0.113.7, 10.0.0.1" })).toMatchObject({
      bucket: "203.0.113.7",
    });
  });

  it("ignores client-controllable headers even on Vercel", () => {
    // Rotating these must not buy a fresh bucket.
    expect(
      from({
        "x-forwarded-for": "198.51.100.1",
        "x-real-ip": "198.51.100.2",
        forwarded: "for=198.51.100.3",
        "cf-connecting-ip": "198.51.100.4",
        "true-client-ip": "198.51.100.5",
      })
    ).toEqual({ kind: "unknown" });
  });

  it("prefers the verified header over a spoofed X-Forwarded-For", () => {
    expect(
      from({ [VERIFIED_IP_HEADER]: "203.0.113.7", "x-forwarded-for": "198.51.100.1" })
    ).toMatchObject({ bucket: "203.0.113.7" });
  });

  it.each([
    ["not on Vercel", {}],
    ["VERCEL set to something else", { VERCEL: "true" }],
  ])("believes no header when %s", (_label, env) => {
    expect(from({ [VERIFIED_IP_HEADER]: "203.0.113.7" }, env)).toEqual({ kind: "unknown" });
  });

  it("answers unknown for a malformed verified header", () => {
    expect(from({ [VERIFIED_IP_HEADER]: "not-an-ip" })).toEqual({ kind: "unknown" });
  });

  it("reads process.env by default", () => {
    // The unit suite never runs with VERCEL=1.
    expect(clientAddress(new Headers({ [VERIFIED_IP_HEADER]: "203.0.113.7" }))).toEqual({
      kind: "unknown",
    });
  });
});
