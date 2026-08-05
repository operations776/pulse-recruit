import { getPersona } from "@/lib/data";
import { hasModelKey } from "@/lib/server/ai/openai";
import { PersonaScreen } from "./persona-screen";

// PLS-82. Where a recruiter teaches Pulse how they sound.
//
// Nothing here is scraped. Exa reads cache-first public pages truncated to
// 2400 characters and cannot sign in to LinkedIn, so a scraped persona would
// be quietly weak and the user would only discover it when their generated
// posts read like everyone else's. Asking takes a minute and is honest.
export default async function PersonaPage() {
  const { persona, lessons } = await getPersona();

  return (
    <PersonaScreen
      persona={persona}
      lessons={lessons}
      // Without a model key there is nothing to distil a voice with, so the
      // screen says so rather than accepting an intake it cannot process.
      configured={hasModelKey()}
    />
  );
}
