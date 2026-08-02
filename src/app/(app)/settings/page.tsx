import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import SettingsClient, { type SettingsData } from "./settings-client";

export default async function SettingsPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("org_memberships")
    .select("id, user_id, role")
    .order("created_at", { ascending: true });

  const data: SettingsData = {
    org: { id: session.org.id, name: session.org.name, slug: session.org.slug },
    members: members ?? [],
    currentUserId: session.userId,
  };

  return <SettingsClient data={data} />;
}
