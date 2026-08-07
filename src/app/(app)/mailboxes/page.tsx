import { getMailboxes } from "@/lib/data";
import { ConnectMailboxButton, MailboxRows } from "./mailbox-rows";

// Pillar 3. The inboxes every sequence sends from. Caps and warmup are the only
// thing standing between an outbound programme and a burned domain, so they are
// on the surface rather than behind a settings screen.
export default async function MailboxesPage() {
  const mailboxes = await getMailboxes();

  const connected = mailboxes.filter((m) => m.status === "connected").length;
  const failing = mailboxes.filter((m) => m.status === "error").length;
  // An errored mailbox sends nothing, so it contributes no capacity.
  const capacity = mailboxes
    .filter((m) => m.status === "connected" || m.status === "warming")
    .reduce((sum, m) => sum + m.daily_cap, 0);
  const sentToday = mailboxes.reduce((sum, m) => sum + m.sent_today, 0);

  const stats: [string, string][] = [
    ["Connected", String(connected)],
    ["Daily capacity", String(capacity)],
    ["Sent today", String(sentToday)],
    ["Needs attention", String(failing)],
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-paper">
      <header className="border-b border-rule px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="legend text-ink-3">Pillar 3 / multichannel outbound</p>
            <h1 className="page-title mt-2 text-ink">Mailboxes</h1>
            <p className="mt-2 max-w-[62ch] text-[12px] text-ink-2">
              The inboxes your sequences send from. Daily caps and warmup protect
              your domain reputation.
            </p>
          </div>

          <ConnectMailboxButton />
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
          {stats.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="legend text-ink-3">{label}</dt>
              <dd className="display text-[21px] leading-none">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="px-6 py-5">
        <MailboxRows mailboxes={mailboxes} />
      </div>
    </main>
  );
}
