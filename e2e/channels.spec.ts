import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// PLS-71. The Channels screen and the Unipile callback.
//
// The webhook tests matter more than the screen tests: that route is the only
// writer of linkedin_accounts and it is reachable from the open internet,
// because a provider callback carries no session. Everything it refuses is
// asserted here.
const DEMO = { email: "daniyal@nortech.io", password: "pulse-demo-2026" };

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(pipeline|candidates)/, { timeout: 30_000 });
}

test("channels explains itself and offers the connect action", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/channels");

  await expect(
    page.getByRole("heading", { name: /channels/i, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/no key to paste/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /connect a profile/i }),
  ).toBeVisible();

  // Honest about the state of the product: connecting a profile does not mean
  // Pulse starts posting.
  await expect(page.getByText(/does not post to linkedin yet/i)).toBeVisible();
});

test("channels is reachable from settings and from the api keys screen", async ({
  page,
}) => {
  await signIn(page);

  // The rail carries the settings sections, and it is the only place they are
  // listed. Two links to one destination is the duplication DESIGN.md section 2
  // rules out by asking for spatial consistency.
  await page.goto("/settings");
  const railLinks = page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Channels" });
  await expect(railLinks).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Channels" })).toHaveCount(1);
  await railLinks.click();
  await expect(page).toHaveURL(/\/settings\/channels/);

  // The API keys screen must not offer a Unipile key field, because there is
  // no such thing to paste. It points here instead.
  await page.goto("/settings/integrations");
  await expect(page.getByText("Unipile")).toHaveCount(0);
  await page.getByRole("link", { name: /open channels/i }).click();
  await expect(page).toHaveURL(/\/settings\/channels/);
});

test("the unipile callback refuses a caller with no secret", async ({
  request,
}) => {
  const response = await request.post("/api/unipile/accounts", {
    data: { status: "CREATION_SUCCESS", account_id: "forged", name: "x:y" },
  });
  expect(response.status()).toBe(401);
});

test("the unipile callback refuses a wrong secret", async ({ request }) => {
  const response = await request.post("/api/unipile/accounts?token=nope", {
    data: { status: "CREATION_SUCCESS", account_id: "forged", name: "x:y" },
  });
  expect(response.status()).toBe(401);
});

test("the unipile callback is not behind the sign-in redirect", async ({
  request,
}) => {
  // The middleware sends anonymous traffic to /signin. A provider callback has
  // no session and must reach the route, which then judges it on the secret.
  // If this ever returns the sign-in page, connections would silently vanish.
  const response = await request.post("/api/unipile/accounts", {
    data: {},
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "unauthorised" });
});

test("the unipile callback accepts the right secret", async ({ request }) => {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  test.skip(
    !secret,
    "set UNIPILE_WEBHOOK_SECRET to prove the comparison accepts as well as refuses",
  );

  // Proving a gate refuses is only half of it. A comparison that returned false
  // for everything would pass every test above and quietly drop every real
  // connection. This asserts a correct token gets through the gate: what it
  // meets next is the missing service-role key (503) or a payload it declines
  // to act on (400), never another 401.
  const response = await request.post(
    `/api/unipile/accounts?token=${encodeURIComponent(secret!)}`,
    { data: { status: "CREATION_SUCCESS", account_id: "e2e-probe" } },
  );

  expect(response.status()).not.toBe(401);
  expect([400, 503]).toContain(response.status());
});

/** The publishable key ships to every browser, so this is what an attacker has. */
function publicSupabase(): { url: string; key: string } | null {
  const file = join(process.cwd(), ".env.local");
  if (!existsSync(file)) return null;

  const env = Object.fromEntries(
    readFileSync(file, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const at = line.indexOf("=");
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  );

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

test("the publishable key cannot write linkedin_accounts", async ({
  request,
}) => {
  const supabase = publicSupabase();
  test.skip(!supabase, "no .env.local, so there is no key to try this with");

  // linkedin_accounts has no insert policy at all, deliberately. Rows only
  // arrive through the callback, using the service-role client. Anyone can read
  // the publishable key out of the JavaScript bundle, so this is the realistic
  // attempt: attach an account id to an org you do not own.
  const response = await request.post(
    `${supabase!.url}/rest/v1/linkedin_accounts`,
    {
      headers: {
        apikey: supabase!.key,
        authorization: `Bearer ${supabase!.key}`,
        "content-type": "application/json",
        prefer: "return=representation",
      },
      data: {
        org_id: "00000000-0000-0000-0000-000000000000",
        unipile_account_id: "forged-from-a-browser",
      },
    },
  );

  expect(response.ok()).toBe(false);
  expect([401, 403]).toContain(response.status());
});

test("the publishable key cannot read another org's accounts", async ({
  request,
}) => {
  const supabase = publicSupabase();
  test.skip(!supabase, "no .env.local, so there is no key to try this with");

  const response = await request.get(
    `${supabase!.url}/rest/v1/linkedin_accounts?select=unipile_account_id`,
    {
      headers: {
        apikey: supabase!.key,
        authorization: `Bearer ${supabase!.key}`,
      },
    },
  );

  // An anonymous caller has no membership, so the select policy matches nothing
  // and the honest answer is an empty set rather than an error.
  if (response.ok()) {
    expect(await response.json()).toEqual([]);
  } else {
    expect([401, 403]).toContain(response.status());
  }
});
