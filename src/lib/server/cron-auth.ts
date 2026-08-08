import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * The shared secret every cron route checks.
 *
 * Lifted out of `/api/cron/publish` in PLS-137, when a second scheduled route
 * needed the same check. Two copies of an auth comparison is how one of them
 * quietly stops matching the other: the publisher's version was already the
 * only thing standing between `CRON_SECRET` and a stranger claiming a batch of
 * posts.
 *
 * Constant time on purpose. A secret compared with `===` leaks its prefix
 * through timing, one byte at a time, to anyone willing to measure. The length
 * check before it is not a leak worth closing: the length of a secret is not
 * the secret, and `timingSafeEqual` throws on a length mismatch rather than
 * returning false.
 *
 * No secret configured is a refusal, never a pass. A route that authorises
 * everybody when it is misconfigured is worse than one that authorises nobody.
 */
export function cronAuthorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const given =
    request.headers.get("x-cron-secret") ??
    new URL(request.url).searchParams.get("token") ??
    "";

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
