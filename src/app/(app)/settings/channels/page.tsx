import { requireSession } from "@/lib/auth";
import { getLinkedInAccounts } from "@/lib/data";
import { hasUnipile } from "@/lib/server/unipile";
import { ChannelsClient } from "./channels-client";

export const metadata = { title: "Channels" };

// PLS-69. Where a recruiter connects the LinkedIn profile Pulse will post from.
//
// Deliberately not on the API keys screen. Every row there is a key the customer
// pastes in; this is an account they authorise, under RecruiterGTM's single
// Unipile tenant, and putting it beside the keys taught people to look for a
// Unipile key that does not exist.
export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; failed?: string }>;
}) {
  const [session, accounts, params] = await Promise.all([
    requireSession(),
    getLinkedInAccounts(),
    searchParams,
  ]);

  return (
    <ChannelsClient
      accounts={accounts}
      meId={session.userId}
      canManageAny={session.role !== "member"}
      // Whether the deployment can talk to Unipile at all. Without it the
      // screen says so instead of showing a button that cannot work.
      configured={hasUnipile()}
      justConnected={params.connected === "1"}
      justFailed={params.failed === "1"}
    />
  );
}
