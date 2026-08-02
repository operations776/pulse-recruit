import { CalendarDays, FileText, Mail, MessageSquare } from "lucide-react";

// DESIGN.md: a zero renders as a mono double-dash so the eye skips it.
export type Metrics = {
  emails: number;
  notes: number;
  documents: number;
  interviews: number;
};

const items = [
  { key: "emails", icon: Mail, label: "Emails" },
  { key: "notes", icon: MessageSquare, label: "Notes" },
  { key: "documents", icon: FileText, label: "Documents" },
  { key: "interviews", icon: CalendarDays, label: "Interviews" },
] as const;

export function MetricRow({ metrics }: { metrics: Metrics }) {
  return (
    <span className="flex items-center gap-2.5 text-ink-400">
      {items.map(({ key, icon: Icon, label }) => {
        const value = metrics[key];
        return (
          <span key={key} className="flex items-center gap-1" title={label}>
            <Icon size={12} strokeWidth={1.75} />
            <span className="data-literal text-inherit text-[12px]">
              {value > 0 ? value : "--"}
            </span>
          </span>
        );
      })}
    </span>
  );
}
