import { expect, test } from "@playwright/test";

// PLS-88. The publisher endpoint.
//
// These matter more than any screen test in this batch. `/api/cron/publish`
// carries no session (a scheduler does not have one), it runs as service-role,
// and it is reachable from the open internet. Everything it refuses is
// asserted here.
//
// What is NOT asserted here: that a post reaches LinkedIn. That needs a real
// connected profile and real money, so it is a manual step in DEPLOY.md, done
// once before the cron is scheduled.

test("the publisher refuses a caller with no secret", async ({ request }) => {
  const response = await request.post("/api/cron/publish");
  expect(response.status()).toBe(401);
});

test("the publisher refuses a wrong secret", async ({ request }) => {
  const response = await request.post("/api/cron/publish", {
    headers: { "x-cron-secret": "nope" },
  });
  expect(response.status()).toBe(401);
});

test("a wrong secret of the right length is still refused", async ({
  request,
}) => {
  // The length check runs before timingSafeEqual, which throws on a mismatch.
  // A same-length wrong secret is the case that actually exercises the compare,
  // so it is the one worth asserting.
  const response = await request.post("/api/cron/publish", {
    headers: { "x-cron-secret": "a".repeat(64) },
  });
  expect(response.status()).toBe(401);
});

test("the publisher is not behind the sign-in redirect", async ({ request }) => {
  // A cron cannot follow a redirect to /signin. If the middleware ever starts
  // matching this path, the job silently stops publishing and nothing says so.
  const response = await request.post("/api/cron/publish", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(401);
  expect(response.headers().location).toBeUndefined();
});

test("a browser GET gets an explanation, not a redirect", async ({
  request,
}) => {
  const response = await request.get("/api/cron/publish");
  expect(response.status()).toBe(405);
  expect((await response.json()).error).toMatch(/only accepts post/i);
});

test("an authorised run answers with honest counts", async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  test.skip(!secret, "CRON_SECRET is not set in this environment");

  const response = await request.post("/api/cron/publish", {
    headers: { "x-cron-secret": secret! },
  });

  // 503 is a legitimate answer: no service-role key, or no Unipile. Both say
  // so plainly rather than claiming rows and failing them, which would burn
  // three attempts on every due post.
  if (response.status() === 503) {
    expect((await response.json()).error).toMatch(/not configured/i);
    return;
  }

  expect(response.status()).toBe(200);
  const body = await response.json();

  // Law 9. Every number is real, including the failures.
  expect(body.ok).toBe(true);
  expect(body.claimed).toBeGreaterThanOrEqual(0);
  expect(body.published + body.failed).toBe(body.claimed);
});

test("two runs at once cannot publish the same post twice", async ({
  request,
}) => {
  const secret = process.env.CRON_SECRET;
  test.skip(!secret, "CRON_SECRET is not set in this environment");

  // FOR UPDATE SKIP LOCKED is the whole point of the claim. If it ever
  // regresses, both runs claim the same rows and the post goes out twice,
  // which is the one failure a recruiter cannot undo.
  const [a, b] = await Promise.all([
    request.post("/api/cron/publish", { headers: { "x-cron-secret": secret! } }),
    request.post("/api/cron/publish", { headers: { "x-cron-secret": secret! } }),
  ]);

  test.skip(a.status() === 503 || b.status() === 503, "publisher not configured");

  const first = await a.json();
  const second = await b.json();

  // Both must succeed. A run that errors proves nothing about the claim.
  expect(a.status()).toBe(200);
  expect(b.status()).toBe(200);

  // The real assertion: at most one run claims anything. SKIP LOCKED means the
  // loser takes the rows the winner did not, and the winner took them all, so
  // a batch claimed by BOTH runs is the regression this guards against.
  expect(Math.min(first.claimed, second.claimed)).toBe(0);

  expect(first.published + first.failed).toBe(first.claimed);
  expect(second.published + second.failed).toBe(second.claimed);
});
