import { Quote } from "lucide-react";
import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { Band, ClosingCta, Hero, SectionHead } from "../sections";

export const metadata: Metadata = {
  title: `Testimonials — ${brand.name}`,
  description: "What agencies running their desk on Pulse Recruit say about it.",
};

/**
 * PLS-107. The testimonials page, with the layout and without the quotes.
 *
 * The rebrand ships six five-star quotes attributed by name to real
 * RecruiterGTM clients (Patrick How, John Bult, Georgiana Larg, Justin
 * D'Aleo, Adrian Munoz, Carl Wheatley) praising a product none of them runs,
 * plus a metrics band claiming "40+ Agencies on Pulse" and "2x faster time to
 * first touch".
 *
 * Those are invented. Publishing them would put words in the mouths of named
 * people who never said them and put numbers on a page that nothing supports,
 * on a public site, under Daniyal's own company name. Daniyal's call was to
 * build the page and leave the quotes for real ones.
 *
 * So the structure is here and ready. Replacing PLACEHOLDERS with real quotes
 * is the only step left, and until then the page says plainly that it is
 * waiting for them rather than filling the space with fiction.
 */
const PLACEHOLDERS = [
  { slot: "Founding agency, first pilot" },
  { slot: "Founding agency, second pilot" },
  { slot: "Founding agency, third pilot" },
] as const;

export default function TestimonialsPage() {
  return (
    <>
      <Hero
        eyebrow="Testimonials"
        title="Recruiters who stopped losing candidates to silence"
        sub="The founding pilots are running now. Their words go here, once they have said them."
      />

      <Band>
        <SectionHead
          tag="Coming from the pilot"
          title="Real quotes, once there are real quotes"
          sub="This page is built and waiting. Nothing is published here until a founding agency has actually said it and agreed to be named."
        />

        <div className="grid gap-4 md:grid-cols-3">
          {PLACEHOLDERS.map((item) => (
            <div
              key={item.slot}
              className="rounded-card border border-dashed border-rule bg-sheet p-6"
            >
              <Quote
                size={16}
                strokeWidth={1.75}
                className="text-ink-3"
                aria-hidden
              />
              <p className="mt-3 text-[14px] leading-[1.65] text-ink-3">
                Reserved for a founding agency.
              </p>
              <p className="legend mt-5 text-ink-3">{item.slot}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-[58ch] text-center text-[13px] leading-[1.6] text-ink-2">
          {brand.company} works with recruitment agencies across the UK, Europe
          and North America. {brand.name} is the platform that work runs on, and
          the founding pilots are live now.
        </p>
      </Band>

      <ClosingCta
        title="Run your desk on Pulse."
        sub="Import your pipeline and see what is going cold before it does."
      />
    </>
  );
}
