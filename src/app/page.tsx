import Link from "next/link";
import { brand } from "@/config/brand";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3">
      <span className="flex items-center gap-2.5">
        <span className="size-2.5 rounded-full bg-pulse-600 pulse-dot-live" />
        <span className="text-[20px] font-[590] tracking-[-0.01em]">
          {brand.name}
        </span>
      </span>
      <p className="text-ink-600">{brand.tagline}</p>
      <Link
        href="/design"
        className="mt-2 flex h-8 items-center rounded-control border border-line bg-surface px-3 text-[13px] font-[550] hover:bg-canvas"
      >
        View design sheet
      </Link>
    </main>
  );
}
