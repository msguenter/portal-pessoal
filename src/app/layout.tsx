import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { LayoutGrid, Wallet, HeartPulse, Plane, Target } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal Pessoal",
  description: "Gestão pessoal de finanças, saúde, viagens e planos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const navItems = [
  { href: "/", label: "Início", icon: LayoutGrid },
  { href: "/saude", label: "Saúde", icon: HeartPulse },
  { href: "/financas", label: "Finanças", icon: Wallet },
  { href: "/viagens", label: "Viagens", icon: Plane },
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
        {/* Topo Desktop & Mobile */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-slate-900 text-lg tracking-tight"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm">
                PP
              </span>
              Portal Pessoal
            </Link>

            {/* Menu Desktop */}
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

            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              v0.2
            </span>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>

        {/* Barra Inferior Fixa estilo App Mobile */}
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
