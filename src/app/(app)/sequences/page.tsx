import { getSequences } from "@/lib/data";
import { SequenceWorkbench } from "./sequence-workbench";

// Pillar 3. The copy a signal fires, the mailboxes it sends from, and the
// numbers it has produced so far.
export default async function SequencesPage() {
  const { sequences, steps, mailboxes, links } = await getSequences();

  return (
    <SequenceWorkbench
      sequences={sequences}
      steps={steps}
      mailboxes={mailboxes}
      links={links}
    />
  );
}
