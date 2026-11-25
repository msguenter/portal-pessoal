import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { LayoutGrid, Wallet, HeartPulse, Hammer, Target } from "lucide-react";
import "./globals.css";

const isPreview =
  process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.NODE_ENV === "development";

export const metadata: Metadata = {
  title: isPreview ? "[DEV] Portal Pessoal" : "Portal Pessoal",
  description: "Gestão pessoal de saúde, obra, finanças e planos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const navItems = [
  { href: "/", label: "Início", icon: LayoutGrid },
  { href: "/saude", label: "Saúde", icon: HeartPulse },
  { href: "/obra", label: "Obra", icon: Hammer },
  { href: "/financas", label: "Finanças", icon: Wallet },
  { href: "/planos", label: "Planos", icon: Target },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen bg-slate-50 text-slate-900 pb-24 md:pb-8">
        <header
          className={`sticky top-0 z-30 backdrop-blur border-b ${
            isPreview
              ? "bg-amber-50/95 border-amber-300"
              : "bg-white/90 border-slate-200"
          }`}
        >
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-slate-900 text-lg tracking-tight"
            >
              <span
                className={`w-8 h-8 rounded-lg text-white flex items-center justify-center text-sm ${
                  isPreview ? "bg-amber-600" : "bg-slate-900"
                }`}
              >
                PP
              </span>
              Portal Pessoal
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {isPreview ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500 text-white tracking-wide">
                DEV • v0.3
              </span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                v0.3
              </span>
            )}
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 shadow-lg">
          <div className="grid grid-cols-5 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-600 hover:text-blue-600 active:bg-slate-100 transition"
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  <span className="text-[11px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </body>
    </html>
  );
}
