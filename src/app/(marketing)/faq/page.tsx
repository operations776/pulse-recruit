import { Mail } from "lucide-react";
import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { FAQ } from "@/config/marketing";
import { Band, Hero, Wrap } from "../sections";

export const metadata: Metadata = {
  title: `FAQ — ${brand.name}`,
  description:
    "Data, the AI pillars, pilots, and security. Everything about running your desk on Pulse Recruit.",
};

// PLS-107. Fifteen questions.
//
// The rebrand injects these from a JS array at runtime, so they are invisible
// to a search engine and to anyone with JavaScript off. Rendered server-side
// here, in native <details> elements, which means the accordion works with no
// JavaScript at all and is keyboard accessible for free.
export default function FaqPage() {
  return (
    <>
      <Hero
        title="Frequently asked questions"
        sub="Everything about running your desk on Pulse Recruit: data, the AI pillars, pilots, and security. Cannot find it? Email us and a human replies."
      />

      <Band>
        <div className="mx-auto max-w-[760px]">
          {FAQ.map((group) => (
            <section key={group.group} className="mb-10 last:mb-0">
              <h2 className="legend mb-3 text-violet">{group.group}</h2>
              <div className="overflow-hidden rounded-shell border border-rule bg-sheet">
                {group.items.map((item, index) => (
                  <details
                    key={item.q}
                    className={`settle group px-5 ${
                      index > 0 ? "border-t border-rule" : ""
                    }`}
                  >
                    <summary className="cursor-pointer list-none py-4 text-[15px] font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                      <span className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-violet opacity-0 transition-opacity group-open:opacity-100"
                        />
                        <span className="-ml-[18px] group-open:ml-0">
                          {item.q}
                        </span>
                      </span>
                    </summary>
                    <p className="pb-4 pl-[18px] text-[14px] leading-[1.65] text-ink-2">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Band>

      <Band alt>
        <Wrap>
          <div className="mx-auto max-w-[52ch] rounded-shell border border-rule bg-sheet p-8 text-center">
            <p className="display text-[18px]">Still stuck?</p>
            <p className="mt-2.5 text-[14px] leading-[1.6] text-ink-2">
              Email the {brand.company} team and we will get back to you within
              one business day.
            </p>
            <a
              href={`mailto:${brand.supportEmail}`}
              className="settle lift mt-5 inline-flex items-center gap-2 rounded-control bg-violet px-5 py-2.5 text-[14px] font-medium text-on-violet hover:bg-violet-hover"
            >
              <Mail size={16} strokeWidth={1.75} />
              Email {brand.supportEmail}
            </a>
          </div>
        </Wrap>
      </Band>
    </>
  );
}
