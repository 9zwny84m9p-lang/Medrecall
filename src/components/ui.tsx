import type { MasteryState } from "@/lib/domain/types";

/** Join class names, dropping anything falsy. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Shared control styling.
 *
 * Every interactive class here clears a 44px touch target, because the primary
 * device is an iPad and a desktop-sized button is genuinely hard to hit.
 */
export const BUTTON_BASE =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-xl px-5 text-base font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const BUTTON_PRIMARY = cn(
  BUTTON_BASE,
  "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700",
);

export const BUTTON_SECONDARY = cn(
  BUTTON_BASE,
  "border border-border bg-surface hover:bg-surface-muted",
);

export const BUTTON_QUIET = cn(BUTTON_BASE, "text-muted hover:bg-surface-muted hover:text-foreground");

export const CARD = "rounded-2xl border border-border bg-surface p-5 sm:p-6";

export const FIELD =
  "w-full rounded-xl border border-border bg-background px-4 py-3 outline-none " +
  "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export const MASTERY_STYLE: Record<MasteryState, string> = {
  new: "bg-surface-muted text-muted",
  learning: "bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-100",
  weak: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  stable: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  strong: "bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-50",
};

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        className ?? "bg-surface-muted text-muted",
      )}
    >
      {children}
    </span>
  );
}
