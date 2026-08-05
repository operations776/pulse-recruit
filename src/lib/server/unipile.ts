import "server-only";

// The LinkedIn transport, Pillar 5 phase B.
//
// RecruiterGTM holds ONE Unipile tenant. A recruiter never sees a Unipile key
// and never creates a Unipile account: they walk through Unipile's hosted
// wizard, and their LinkedIn profile becomes an account under our tenant. That
// is why the credentials here are platform env vars rather than a per-org Vault
// key like Apollo or HeyReach.
//
// Unipile bills roughly 5 EUR per connected account per month on a 49 EUR
// minimum, charged on the peak count in each 30 day window, so a connected
// account is a recurring cost and disconnecting one is a real saving. Anything
// that creates accounts silently would show up on an invoice.

const DEFAULT_TIMEOUT_MS = 15_000;

export class UnipileError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "UnipileError";
    this.status = status;
  }
}

export function hasUnipile(): boolean {
  return Boolean(process.env.UNIPILE_API_KEY && process.env.UNIPILE_DSN);
}

/** The tenant's API base, for example https://api8.unipile.com:13843 */
function dsn(): string {
  const value = process.env.UNIPILE_DSN;
  if (!value) {
    throw new UnipileError("UNIPILE_DSN is not set.", 500);
  }
  return value.replace(/\/+$/, "");
}

function apiKey(): string {
  const value = process.env.UNIPILE_API_KEY;
  if (!value) {
    throw new UnipileError("UNIPILE_API_KEY is not set.", 500);
  }
  return value;
}

async function call<T>(
  path: string,
  init: { method: string; body?: unknown },
): Promise<T> {
  const response = await fetch(`${dsn()}/api/v1${path}`, {
    method: init.method,
    headers: {
      "X-API-KEY": apiKey(),
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    // Surface Unipile's own wording where there is any. A generic "request
    // failed" would hide the one thing that tells you what to change.
    let detail = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { detail?: string; title?: string };
      detail = parsed.detail ?? parsed.title ?? detail;
    } catch {
      // not JSON, keep the raw tail
    }
    throw new UnipileError(
      `Unipile answered ${response.status}: ${detail}`,
      response.status,
    );
  }

  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Mint a hosted auth link.
 *
 * `name` is our own identifier and comes back on the webhook, so it is how a
 * connection finds its way to the right org. It carries the user too, so the
 * row records who connected the profile.
 */
export async function createHostedAuthLink(input: {
  orgId: string;
  userId: string;
  origin: string;
  /** Present for a reconnect, absent for a first connection. */
  reconnectAccountId?: string;
}): Promise<string> {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  if (!secret) {
    throw new UnipileError(
      "UNIPILE_WEBHOOK_SECRET is not set, so the callback could not be trusted and no link was created.",
      500,
    );
  }

  // Fifteen minutes. Long enough to find your password, short enough that a
  // link left in a chat thread is not a standing invitation to attach an
  // account to someone else's workspace.
  const expiresOn = new Date(Date.now() + 15 * 60_000).toISOString();

  // Unipile does not sign its callbacks, so the shared secret travels in the
  // notify URL and the route compares it in constant time.
  const notifyUrl = `${input.origin}/api/unipile/accounts?token=${encodeURIComponent(secret)}`;

  const body = {
    type: input.reconnectAccountId ? "reconnect" : "create",
    providers: ["LINKEDIN"],
    api_url: dsn(),
    expiresOn,
    name: `${input.orgId}:${input.userId}`,
    success_redirect_url: `${input.origin}/settings/channels?connected=1`,
    failure_redirect_url: `${input.origin}/settings/channels?failed=1`,
    notify_url: notifyUrl,
    ...(input.reconnectAccountId
      ? { reconnect_account: input.reconnectAccountId }
      : {}),
  };

  const result = await call<{ url?: string }>("/hosted/accounts/link", {
    method: "POST",
    body,
  });

  if (!result.url) {
    throw new UnipileError("Unipile returned no hosted auth URL.", 502);
  }
  return result.url;
}

export type UnipileAccount = {
  id: string;
  name?: string;
  type?: string;
  sources?: { status?: string }[];
};

/* ---------------------------------------------------------------------------
 * Publishing
 * ------------------------------------------------------------------------- */

/**
 * Publish a post to LinkedIn, now.
 *
 * Unipile has no scheduling of its own: this sends immediately, which is why
 * Pulse holds the timer and only calls here once a post is claimed.
 *
 * Text only. `call<T>` sends JSON, and LinkedIn media through Unipile needs
 * multipart/form-data, which is a different transport and a separate piece of
 * work. A post with images attached still publishes its text rather than
 * silently dropping the whole thing, and the caller says so.
 */
export async function publishPost(input: {
  accountId: string;
  text: string;
}): Promise<{ postId: string | null; url: string | null }> {
  const text = input.text.trim();
  if (!text) {
    throw new UnipileError("There is nothing to publish.", 400);
  }

  const result = await call<{ post_id?: string; id?: string; url?: string }>(
    "/posts",
    {
      method: "POST",
      body: { account_id: input.accountId, text },
    },
  );

  // Unipile has used both spellings across versions. Take either rather than
  // failing a post that actually went out.
  return {
    postId: result.post_id ?? result.id ?? null,
    url: result.url ?? null,
  };
}

/* ---------------------------------------------------------------------------
 * Connecting an account from inside Pulse
 *
 * The hosted wizard is still the default and the safest path. These two exist
 * because Daniyal asked to connect without leaving the app, and because a
 * recruiter whose LinkedIn is already open in a browser can hand over a cookie
 * without typing a password anywhere.
 * ------------------------------------------------------------------------- */

export type ConnectResult =
  | { status: "connected"; accountId: string }
  | { status: "checkpoint"; accountId: string; checkpoint: string };

type RawConnect = {
  object?: string;
  account_id?: string;
  checkpoint?: { type?: string };
};

function readConnect(raw: RawConnect): ConnectResult {
  const accountId = raw.account_id;
  if (!accountId) {
    throw new UnipileError("Unipile did not return an account id.", 502);
  }
  // A 202 with a Checkpoint object means LinkedIn wants a code. Unipile gives
  // five minutes before the authentication intent self-destructs, so the UI
  // has to ask for it immediately rather than queue it.
  if (raw.object === "Checkpoint" || raw.checkpoint) {
    return {
      status: "checkpoint",
      accountId,
      checkpoint: raw.checkpoint?.type ?? "2FA",
    };
  }
  return { status: "connected", accountId };
}

/** Connect with a LinkedIn email and password. */
export async function connectWithCredentials(input: {
  username: string;
  password: string;
}): Promise<ConnectResult> {
  const raw = await call<RawConnect>("/accounts", {
    method: "POST",
    body: {
      provider: "LINKEDIN",
      username: input.username.trim(),
      password: input.password,
    },
  });
  return readConnect(raw);
}

/**
 * Connect with the `li_at` cookie from an already signed-in browser.
 *
 * Unipile recommends sending the same user agent the cookie was issued to:
 * LinkedIn treats a session that suddenly changes browser as suspicious, and
 * matching it is the difference between a connection that lasts and one that
 * is challenged within a day.
 */
export async function connectWithCookie(input: {
  accessToken: string;
  userAgent?: string;
}): Promise<ConnectResult> {
  const raw = await call<RawConnect>("/accounts", {
    method: "POST",
    body: {
      provider: "LINKEDIN",
      access_token: input.accessToken.trim(),
      ...(input.userAgent ? { user_agent: input.userAgent } : {}),
    },
  });
  return readConnect(raw);
}

/**
 * Answer a checkpoint: 2FA, OTP, in-app validation, captcha.
 *
 * `TRY_ANOTHER_WAY` is a valid code and asks LinkedIn for a different method.
 * Past five minutes Unipile answers 408 and then 400, so a stale code gets a
 * real explanation rather than a generic failure.
 */
export async function solveCheckpoint(input: {
  accountId: string;
  code: string;
}): Promise<ConnectResult> {
  try {
    const raw = await call<RawConnect>("/accounts/checkpoint", {
      method: "POST",
      body: {
        provider: "LINKEDIN",
        account_id: input.accountId,
        code: input.code.trim(),
      },
    });
    return readConnect(raw);
  } catch (error) {
    if (error instanceof UnipileError && (error.status === 408 || error.status === 400)) {
      throw new UnipileError(
        "That code arrived too late. LinkedIn only holds the request open for five minutes, so start the connection again.",
        error.status,
      );
    }
    throw error;
  }
}

/** Ask LinkedIn to send the code again. */
export async function resendCheckpoint(accountId: string): Promise<void> {
  await call("/accounts/checkpoint/resend", {
    method: "POST",
    body: { provider: "LINKEDIN", account_id: accountId },
  });
}

export async function getAccount(accountId: string): Promise<UnipileAccount> {
  return call<UnipileAccount>(`/accounts/${encodeURIComponent(accountId)}`, {
    method: "GET",
  });
}

/**
 * Release an account on Unipile's side.
 *
 * Worth doing rather than only deleting our row: an account we forget about
 * keeps counting towards the monthly peak we are billed on.
 */
export async function deleteAccount(accountId: string): Promise<void> {
  await call(`/accounts/${encodeURIComponent(accountId)}`, {
    method: "DELETE",
  });
}
