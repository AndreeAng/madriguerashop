import { cn } from "@/lib/utils";

function NibbleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="var(--color-amber-500)" />
      <path
        d="M9 22c0-4.4 3.6-8 8-8h2c4.4 0 8 3.6 8 8v3c0 1.7-1.3 3-3 3h-2.5l-1.5 2-1.5-2H12c-1.7 0-3-1.3-3-3v-3z"
        fill="#fff"
      />
      <rect x="14" y="22" width="3" height="5" rx="0.6" fill="var(--color-amber-500)" />
      <rect x="18" y="22" width="3" height="5" rx="0.6" fill="var(--color-amber-500)" />
      <circle cx="14.5" cy="18.5" r="1.3" fill="var(--color-bark-900)" />
      <circle cx="22.5" cy="18.5" r="1.3" fill="var(--color-bark-900)" />
      <ellipse cx="18.5" cy="20.5" rx="1.5" ry="1" fill="var(--color-bark-900)" />
      <path
        d="M28 28l4 3-3 1 1 3-4-3z"
        fill="var(--color-bark-700)"
      />
    </svg>
  );
}

export function NibbleLogo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <NibbleMark className="h-7 w-7" />
      <span
        className={cn(
          "font-display text-lg tracking-tight",
          mono ? "text-current" : "text-[color:var(--fg)]"
        )}
      >
        madriguera<span className="text-[color:var(--color-amber-500)]">·</span>shop
      </span>
    </span>
  );
}
