import { getSignals } from "@/lib/data";
import { SignalFeed } from "./signal-feed";

// Pillar 3. The Dream 100 watchlist and what those companies did this week.
export default async function SignalsPage() {
  const { signals, dreamCompanies } = await getSignals();

  // relativeTime is measured against a clock. Fix it once here and hand it
  // down, so the server render and the client render agree on "now" and the
  // labels cannot drift mid session.
  const now = new Date().toISOString();

  return (
    <SignalFeed
      signals={signals}
      dreamCompanies={dreamCompanies}
      now={now}
    />
  );
}
