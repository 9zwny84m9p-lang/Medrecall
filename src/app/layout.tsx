import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MedRecall — an adaptive medical curriculum tutor",
    template: "%s · MedRecall",
  },
  description:
    "MedRecall teaches a medical course concept by concept, checks what you have " +
    "understood, and brings back what you are shaky on while you learn the next lecture.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The iPad is the primary device; let the layout run under the status bar.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <div className="flex min-h-dvh flex-col">
          <header className="border-b border-border/70">
            <nav className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-3">
              <Link
                href="/"
                className="flex min-h-touch items-center gap-2.5 font-semibold"
              >
                <span
                  aria-hidden
                  className="grid size-9 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white"
                >
                  MR
                </span>
                <span className="text-lg">MedRecall</span>
              </Link>
              <Link
                href="/review"
                className="flex min-h-touch items-center rounded-xl px-3.5 text-base font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                Concept review
              </Link>
            </nav>
          </header>

          <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8">{children}</main>

          <footer className="border-t border-border/70">
            <div className="mx-auto w-full max-w-4xl px-5 py-5 text-sm text-muted">
              MedRecall is a study tool. Its content comes from the material you give
              it — always check it against your course and a clinician.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
