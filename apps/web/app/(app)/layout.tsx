import Link from "next/link";

const NAV = [
  { label: "My Calls", href: "/", ready: true },
  { label: "Team Calls", href: "/", ready: false },
  { label: "Playlists", href: "/", ready: false },
  { label: "Alerts", href: "/", ready: false },
];

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-3">
          <Link href="/" className="text-[15px] font-semibold tracking-tight text-text">
            FATHOM
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((item) =>
              item.ready ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded px-2.5 py-1 text-[13px] text-text transition-colors hover:bg-surface-2"
                >
                  {item.label}
                </Link>
              ) : (
                // Shown but honestly marked. A dead link that looks live is worse than an
                // absent one; this says what was built and what was not.
                <span
                  key={item.label}
                  className="cursor-not-allowed rounded px-2.5 py-1 text-[13px] text-text-faint"
                  title="Not built — see specs/future-considerations.md"
                >
                  {item.label}
                </span>
              ),
            )}
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
