import Link from "next/link";
import {
  HeartPulse,
  Hammer,
  TrendingUp,
  Wallet,
  Target,
  ChevronRight,
} from "lucide-react";

const modulos = [
  {
    href: "/saude",
    titulo: "Saúde",
    descricao: "Peso, pressão arterial, treinos e dias sem açúcar",
    icon: HeartPulse,
    cor: "bg-rose-50 text-rose-600 border-rose-100",
    ativo: true,
  },
  {
    href: "/obra",
    titulo: "Obra & Apartamento",
    descricao: "Fluxo de caixa, entradas, escritura e gastos da obra",
    icon: Hammer,
    cor: "bg-amber-50 text-amber-600 border-amber-100",
    ativo: true,
  },
  {
    href: "/investimentos-br",
    titulo: "Investimentos Brasil",
    descricao: "Carteira ativa, patrimônio líquido e cotas de terceiros",
    icon: TrendingUp,
    cor: "bg-emerald-50 text-emerald-600 border-emerald-100",
    ativo: true,
  },
  {
    href: "/financas",
    titulo: "Finanças",
    descricao: "Orçamento mensal, despesas e controle geral",
    icon: Wallet,
    cor: "bg-sky-50 text-sky-600 border-sky-100",
    ativo: false,
  },
  {
    href: "/planos",
    titulo: "Planos",
    descricao: "Metas anuais, mudança e projetos pessoais",
    icon: Target,
    cor: "bg-indigo-50 text-indigo-600 border-indigo-100",
    ativo: false,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Olá, Matias</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Seleciona um módulo para registar ou consultar os teus dados.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modulos.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 active:scale-[0.99] transition flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${mod.cor}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-slate-900 text-base">
                      {mod.titulo}
                    </h2>
                    {mod.ativo && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {mod.descricao}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-700 transition" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
