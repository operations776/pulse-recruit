import {
  IntegrationFormScope,
  IntegrationRow,
} from "@/components/settings/integration-row";
import { StatusChip, type Tone } from "@/components/ui/misc";
import { requireSession } from "@/lib/auth";
import { getIntegrations } from "@/lib/data";

// The provider list comes from the database, ordered by the enum, so this map
// is presentation only. A provider missing from it still renders, using its own
// key as the name, rather than disappearing from the screen.
const PROVIDERS: Record<string, { name: string; note?: string }> = {
  exa: { name: "Exa", note: "Web research" },
  apollo: { name: "Apollo", note: "Contact data" },
  prospeo: { name: "Prospeo", note: "Email finding" },
  clay: { name: "Clay", note: "Enrichment" },
  instantly: { name: "Instantly", note: "Email sending" },
  heyreach: { name: "HeyReach", note: "LinkedIn" },
  unipile: { name: "Unipile", note: "LinkedIn posting" },
  beehiiv: { name: "Beehiiv", note: "Newsletter" },
  openai: { name: "OpenAI" },
  anthropic: { name: "Anthropic", note: "Claude" },
  smtp: { name: "Custom SMTP" },
};

// AI.md section 1: the model and research keys are Pulse's, not the customer's.
// Asking a recruitment agency founder to go and open an OpenAI account before
// the product does anything is the worst possible first run, so these never
// appear as something to fill in.
const PLATFORM_PROVIDERS = new Set(["openai", "anthropic", "exa"]);

const PLATFORM_NOTE: Record<string, string> = {
  openai: "Answers on the BD engine and the ops manager",
  anthropic: "Held for a second model provider",
  exa: "Live web research behind the BD engine",
};

// DESIGN.md rule 9: colour plus icon plus word. StatusChip supplies the icon.
const STATUS: Record<string, { tone: Tone; word: string }> = {
  connected: { tone: "on", word: "Connected" },
  disconnected: { tone: "off", word: "Not set" },
  invalid: { tone: "attention", word: "Invalid" },
};

type IntegrationSummary = {
  provider: string;
  status: string;
  last_four: string | null;
  last_verified_at: string | null;
};

function since(iso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 60) return `checked ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `checked ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `checked ${days}d ago`;
  return `checked ${Math.round(days / 30)}mo ago`;
}

export default async function IntegrationsPage() {
  await requireSession();
  const all = (await getIntegrations()) as IntegrationSummary[];

  // Two kinds of key, and conflating them is what made this screen ask for
  // things the customer should never have to supply.
  const platform = all.filter((row) => PLATFORM_PROVIDERS.has(row.provider));
  const integrations = all.filter((row) => !PLATFORM_PROVIDERS.has(row.provider));

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <p className="legend text-ink-3">Settings</p>
        <h1 className="display mt-2 text-[18px]">API keys</h1>
        <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
          Connect the accounts that are yours: your sending tools, your LinkedIn,
          your newsletter. Keys are encrypted at rest and never shown again after
          you save them.
        </p>
      </header>

      <div className="px-6 py-5">
        <section className="mb-5 rounded-shell border border-rule bg-sheet">
          <div className="border-b border-rule px-4 py-3">
            <p className="legend text-ink-3">Included with Pulse</p>
            <p className="mt-1.5 max-w-[62ch] text-[12px] text-ink-2">
              Research and answers run on Pulse&apos;s own accounts and come out
              of your weekly credit allowance. There is nothing to set up.
            </p>
          </div>
          {platform.map((row) => (
            <div
              key={row.provider}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0"
            >
              <div className="min-w-[180px] flex-1">
                <p className="text-[13px] font-medium">
                  {(PROVIDERS[row.provider] ?? { name: row.provider }).name}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-2">
                  {PLATFORM_NOTE[row.provider] ?? "Provided by Pulse"}
                </p>
              </div>
              <StatusChip tone="on">Included</StatusChip>
            </div>
          ))}
        </section>

        <IntegrationFormScope>
          <div className="rounded-shell border border-rule bg-sheet">
            {integrations.map((row) => {
              const meta = PROVIDERS[row.provider] ?? { name: row.provider };
              const status = STATUS[row.status] ?? STATUS.disconnected;
              const hasKey = Boolean(row.last_four);

              return (
                <div
                  key={row.provider}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[13px] font-medium">{meta.name}</p>
                    {meta.note ? (
                      <p className="mt-0.5 text-[12px] text-ink-2">
                        {meta.note}
                      </p>
                    ) : null}
                  </div>

                  <StatusChip tone={status.tone}>{status.word}</StatusChip>

                  <p className="meta w-24 shrink-0 text-ink-2">
                    {hasKey ? `ends ${row.last_four}` : ""}
                  </p>

                  <p className="meta w-32 shrink-0 text-ink-2">
                    {row.last_verified_at ? since(row.last_verified_at) : ""}
                  </p>

                  <IntegrationRow
                    provider={row.provider}
                    name={meta.name}
                    hasKey={hasKey}
                  />
                </div>
              );
            })}
          </div>
        </IntegrationFormScope>
      </div>
    </main>
  );
}
