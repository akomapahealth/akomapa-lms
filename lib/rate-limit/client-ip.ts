import { isIP } from "node:net";

/**
 * The client address a rate limit may key on (#46).
 *
 * Only the deployment platform's verified source is trusted. On Vercel that is
 * `x-vercel-forwarded-for`: Vercel overwrites the forwarding headers at its edge
 * and does not pass on client-supplied values, and this one, unlike
 * `x-forwarded-for`, stays correct if a proxy is ever placed in front of Vercel.
 * Off Vercel there is no verified source, so no header is believed -- a client
 * could otherwise rotate `X-Forwarded-For` to get a fresh bucket per request.
 *
 * IPv6 is keyed by its /64 network rather than the full address. A single
 * subscriber is routinely assigned a whole /64, so keying on the full address
 * would hand an attacker 2^64 free buckets.
 */

export type ClientAddress =
  | { kind: "ip"; version: 4 | 6; bucket: string }
  | { kind: "unknown" };

/** The header Vercel sets from the TCP peer, overwriting any client value. */
export const VERIFIED_IP_HEADER = "x-vercel-forwarded-for";

const UNKNOWN: ClientAddress = { kind: "unknown" };

/**
 * Expands an IPv6 address to eight 16-bit groups. The input has already passed
 * `isIP(...) === 6`, so only the `::` shorthand and an embedded IPv4 tail need
 * handling.
 */
function ipv6Groups(address: string): number[] {
  let text = address.toLowerCase();

  // An embedded dotted-quad tail (`::ffff:192.0.2.1`) is two groups.
  const dotted = text.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted.slice(1).map(Number);
    text = `${text.slice(0, dotted.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head, tail] = text.includes("::") ? text.split("::") : [text, null];
  const parse = (part: string) => (part === "" ? [] : part.split(":").map((g) => parseInt(g, 16)));
  const left = parse(head);
  if (tail === null) return left;

  const right = parse(tail);
  return [...left, ...new Array<number>(8 - left.length - right.length).fill(0), ...right];
}

/** Normalises one address string into a bucket, or null when it is not an IP. */
export function bucketFor(raw: string): ClientAddress | null {
  // Drop a zone index (`fe80::1%eth0`): it names an interface on the peer, not
  // a different client.
  const address = raw.trim().replace(/%.*$/, "");
  const version = isIP(address);

  if (version === 4) return { kind: "ip", version: 4, bucket: address };
  if (version !== 6) return null;

  const groups = ipv6Groups(address);

  // IPv4-mapped (`::ffff:a.b.c.d`) is an IPv4 client reached over a dual-stack
  // socket, and must share that client's bucket rather than get a new one.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const v4 = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
    return { kind: "ip", version: 4, bucket: v4 };
  }

  const network = groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":");
  return { kind: "ip", version: 6, bucket: `${network}::/64` };
}

/**
 * The caller's address as the platform verified it, or `unknown`.
 *
 * `unknown` is a real answer, not an error: outside Vercel (local development,
 * CI) there is no trustworthy address, and a malformed header on Vercel means
 * something upstream is wrong. Callers decide what an unknown address means;
 * see `enforceRateLimit`.
 */
export function clientAddress(
  headers: Pick<Headers, "get">,
  env: Record<string, string | undefined> = process.env
): ClientAddress {
  if (env.VERCEL !== "1") return UNKNOWN;

  const header = headers.get(VERIFIED_IP_HEADER);
  if (header === null) return UNKNOWN;

  // Vercel overwrites this header with the single client address. If a list
  // ever arrives, the left-most entry is the client by the header's own
  // convention, and the rest describe intermediaries.
  const [first] = header.split(",");
  return bucketFor(first) ?? UNKNOWN;
}
