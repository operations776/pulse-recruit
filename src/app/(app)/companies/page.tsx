import { CompaniesList } from "@/components/ats/companies-list";
import { requireSession } from "@/lib/auth";
import { getCompanies } from "@/lib/data";

// Clients and prospects share one book. There is no write path for companies
// yet, so this screen reads and does not offer an add control it cannot honour.
export default async function CompaniesPage() {
  const [session, companies] = await Promise.all([
    requireSession(),
    getCompanies(),
  ]);

  return <CompaniesList companies={companies} viewerId={session.userId} />;
}
