import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas Lite — AI Intent Execution for Portaldot",
  description: "Natural language → verified onchain execution on Portaldot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased min-h-screen">
        {/* Top nav bar */}
        <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">A</span>
          </div>
          <span className="font-semibold tracking-tight">Atlas Lite</span>
          <span className="text-zinc-500 text-sm ml-1">· Portaldot</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950 border border-emerald-800 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Mainnet
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-col items-center px-4 py-12 min-h-[calc(100vh-65px)]">
          {children}
        </main>

        {/* Footer */}
        <footer className="text-center text-zinc-600 text-xs py-6 border-t border-zinc-900">
          Built for Portaldot Online Hackathon S1 · Atlas Lite
        </footer>
      </body>
    </html>
  );
}
