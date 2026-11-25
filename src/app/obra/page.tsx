"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Hammer,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  CheckCircle2,
  Clock,
  Plus,
  Edit3,
  Trash2,
  Check,
  X,
} from "lucide-react";

interface FluxoItem {
  id: string;
  tipo: "entrada" | "saida";
  status: "executado" | "previsto";
  data: string | null;
  descricao: string;
  categoria: string;
  valor: number;
}

const CATEGORIAS = [
  "Obra & Materiais",
  "Aquisição",
  "Impostos & Escritura",
  "Banco & Crédito",
  "Aporte / Capital",
  "Documentação",
  "Geral",
];

function formatarEuro(valor: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(valor);
}

export default function ObraPage() {
  const [itens, setItens] = useState<FluxoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "executado" | "previsto">("todos");

  // Formulário
  const [editId, setEditId] = useState<string | null>(null);
  const [tipoForm, setTipoForm] = useState<"entrada" | "saida">("saida");
  const [statusForm, setStatusForm] = useState<"executado" | "previsto">("previsto");
  const [dataForm, setDataForm] = useState("");
  const [descricaoForm, setDescricaoForm] = useState("");
  const [categoriaForm, setCategoriaForm] = useState("Obra & Materiais");
  const [valorForm, setValorForm] = useState("");

  async function carregarDados() {
    setLoading(true);
    const { data, error } = await supabase
      .from("obra_fluxo_caixa")
      .select("*")
      .order("status", { ascending: true })
      .order("data", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMensagem(`Erro Supabase: ${error.message}`);
    } else if (data) {
      setItens(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function limparForm() {
    setEditId(null);
    setTipoForm("saida");
    setStatusForm("previsto");
    setDataForm("");
    setDescricaoForm("");
    setCategoriaForm("Obra & Materiais");
    setValorForm("");
  }

  function carregarParaEdicao(item: FluxoItem) {
    setEditId(item.id);
    setTipoForm(item.tipo);
    setStatusForm(item.status);
    setDataForm(item.data || "");
    setDescricaoForm(item.descricao);
    setCategoriaForm(item.categoria || "Geral");
    setValorForm(String(item.valor));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!descricaoForm.trim() || !valorForm.trim()) return;
    setSaving(true);
    setMensagem(null);

    const payload = {
      tipo: tipoForm,
      status: statusForm,
      data: statusForm === "executado" && dataForm ? dataForm : null,
      descricao: descricaoForm.trim(),
      categoria: categoriaForm,
      valor: parseFloat(valorForm.replace(",", ".")),
    };

    const { error } = editId
      ? await supabase.from("obra_fluxo_caixa").update(payload).eq("id", editId)
      : await supabase.from("obra_fluxo_caixa").insert(payload);

    if (error) {
      setMensagem(`Erro: ${error.message}`);
    } else {
      setMensagem(editId ? "Movimento atualizado!" : "Movimento adicionado!");
      limparForm();
      await carregarDados();
      setTimeout(() => setMensagem(null), 3000);
    }
    setSaving(false);
  }

  async function marcarComoExecutado(item: FluxoItem) {
    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("obra_fluxo_caixa")
      .update({ status: "executado", data: hoje })
      .eq("id", item.id);

    if (!error) {
      setMensagem(`"${item.descricao}" marcado como executado!`);
      await carregarDados();
      setTimeout(() => setMensagem(null), 3000);
    }
  }

  async function excluirItem(id: string) {
    const { error } = await supabase.from("obra_fluxo_caixa").delete().eq("id", id);
    if (!error) {
      await carregarDados();
    }
  }

  // Indicadores financeiros
  const resumo = useMemo(() => {
    let entExec = 0;
    let entPrev = 0;
    let saiExec = 0;
    let saiPrev = 0;

    const porCategoria: Record<string, { executado: number; previsto: number }> = {};

    for (const item of itens) {
      const val = Number(item.valor) || 0;
      if (item.tipo === "entrada") {
        if (item.status === "executado") entExec += val;
        else entPrev += val;
      } else {
        if (item.status === "executado") saiExec += val;
        else saiPrev += val;

        if (!porCategoria[item.categoria]) {
          porCategoria[item.categoria] = { executado: 0, previsto: 0 };
        }
        if (item.status === "executado") porCategoria[item.categoria].executado += val;
        else porCategoria[item.categoria].previsto += val;
      }
    }

    const totalEntradas = entExec + entPrev;
    const totalSaidas = saiExec + saiPrev;
    const saldoAtual = entExec - saiExec;
    const saldoProjetado = totalEntradas - totalSaidas;

    const categoriasOrdenadas = Object.entries(porCategoria)
      .map(([nome, vals]) => ({
        nome,
        executado: vals.executado,
        previsto: vals.previsto,
        total: vals.executado + vals.previsto,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      entExec,
      entPrev,
      saiExec,
      saiPrev,
      totalEntradas,
      totalSaidas,
      saldoAtual,
      saldoProjetado,
      categoriasOrdenadas,
    };
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    return itens.filter((i) => {
      if (filtroTipo !== "todos" && i.tipo !== filtroTipo) return false;
      if (filtroStatus !== "todos" && i.status !== filtroStatus) return false;
      return true;
    });
  }, [itens, filtroTipo, filtroStatus]);

  const maxBarra = Math.max(resumo.totalEntradas, resumo.totalSaidas, 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Hammer className="w-6 h-6 text-amber-600" />
            Obra & Novo Apartamento
          </h1>
          <p className="text-sm text-slate-500">
            Fluxo de caixa, aportes, aquisição e gastos da remodelação
          </p>
        </div>
      </div>

      {/* 4 Cards de Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Saldo Projetado</span>
            <Wallet className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div
            className={`mt-2 text-lg sm:text-xl font-bold ${
              resumo.saldoProjetado >= 0 ? "text-emerald-700" : "text-rose-600"
            }`}
          >
            {formatarEuro(resumo.saldoProjetado)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Após todas as previsões
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Caixa Atual</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-900">
            {formatarEuro(resumo.saldoAtual)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Apenas movimentos executados
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Total Entradas</span>
            <ArrowUpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-900">
            {formatarEuro(resumo.totalEntradas)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Exec: {formatarEuro(resumo.entExec)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Total Saídas</span>
            <ArrowDownCircle className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-900">
            {formatarEuro(resumo.totalSaidas)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Exec: {formatarEuro(resumo.saiExec)}
          </p>
        </div>
      </div>

      {/* Gráficos Visuais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 1: Comparativo Entradas vs Saídas (Executado + Previsto) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">
              Executado vs. Previsto
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-800 inline-block" />
                Executado
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                Previsto
              </span>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {/* Barra Entradas */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-emerald-700">Entradas ({formatarEuro(resumo.totalEntradas)})</span>
                <span className="text-slate-500">
                  {resumo.totalEntradas > 0
                    ? `${Math.round((resumo.entExec / resumo.totalEntradas) * 100)}% recebido`
                    : "0%"}
                </span>
              </div>
              <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${(resumo.entExec / maxBarra) * 100}%` }}
                  className="bg-emerald-600 h-full transition-all"
                  title={`Executado: ${formatarEuro(resumo.entExec)}`}
                />
                <div
                  style={{ width: `${(resumo.entPrev / maxBarra) * 100}%` }}
                  className="bg-emerald-200 h-full transition-all"
                  title={`Previsto: ${formatarEuro(resumo.entPrev)}`}
                />
              </div>
            </div>

            {/* Barra Saídas */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1.5">
                <span className="text-rose-700">Saídas ({formatarEuro(resumo.totalSaidas)})</span>
                <span className="text-slate-500">
                  {resumo.totalSaidas > 0
                    ? `${Math.round((resumo.saiExec / resumo.totalSaidas) * 100)}% pago`
                    : "0%"}
                </span>
              </div>
              <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${(resumo.saiExec / maxBarra) * 100}%` }}
                  className="bg-rose-600 h-full transition-all"
                  title={`Executado: ${formatarEuro(resumo.saiExec)}`}
                />
                <div
                  style={{ width: `${(resumo.saiPrev / maxBarra) * 100}%` }}
                  className="bg-rose-200 h-full transition-all"
                  title={`Previsto: ${formatarEuro(resumo.saiPrev)}`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico 2: Distribuição de Saídas por Categoria */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-slate-800">
            Saídas por Categoria
          </h2>
          {resumo.categoriasOrdenadas.length === 0 ? (
            <p className="text-xs text-slate-400">Sem saídas registadas.</p>
          ) : (
            <div className="space-y-2.5">
              {resumo.categoriasOrdenadas.map((cat) => {
                const perc =
                  resumo.totalSaidas > 0
                    ? Math.round((cat.total / resumo.totalSaidas) * 100)
                    : 0;
                return (
                  <div key={cat.nome}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{cat.nome}</span>
                      <span className="text-slate-600">
                        {formatarEuro(cat.total)} ({perc}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        style={{
                          width: `${
                            resumo.totalSaidas > 0
                              ? (cat.executado / resumo.totalSaidas) * 100
                              : 0
                          }%`,
                        }}
                        className="bg-amber-600 h-full"
                      />
                      <div
                        style={{
                          width: `${
                            resumo.totalSaidas > 0
                              ? (cat.previsto / resumo.totalSaidas) * 100
                              : 0
                          }%`,
                        }}
                        className="bg-amber-200 h-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Formulário de Novo Movimento / Edição */}
      <form
        onSubmit={handleSalvar}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            {editId ? "Editar Movimento" : "Novo Lançamento"}
          </h2>
          <div className="flex items-center gap-2">
            {mensagem && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                {mensagem}
              </span>
            )}
            {editId && (
              <button
                type="button"
                onClick={limparForm}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {/* Tipo */}
          <div className="col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tipo
            </label>
            <select
              value={tipoForm}
              onChange={(e) => setTipoForm(e.target.value as "entrada" | "saida")}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
            >
              <option value="saida">Saída (-)</option>
              <option value="entrada">Entrada (+)</option>
            </select>
          </div>

          {/* Status */}
          <div className="col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Estado
            </label>
            <select
              value={statusForm}
              onChange={(e) => {
                const st = e.target.value as "executado" | "previsto";
                setStatusForm(st);
                if (st === "executado" && !dataForm) {
                  setDataForm(new Date().toISOString().split("T")[0]);
                }
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
            >
              <option value="previsto">Previsto</option>
              <option value="executado">Executado</option>
            </select>
          </div>

          {/* Data (se executado) */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Data {statusForm === "previsto" && "(Opcional)"}
            </label>
            <input
              type="date"
              disabled={statusForm === "previsto"}
              value={statusForm === "executado" ? dataForm : ""}
              onChange={(e) => setDataForm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          {/* Categoria */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Categoria
            </label>
            <select
              value={categoriaForm}
              onChange={(e) => setCategoriaForm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Descrição
            </label>
            <input
              type="text"
              required
              placeholder="Ex: IMT, Cozinha..."
              value={descricaoForm}
              onChange={(e) => setDescricaoForm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          {/* Valor */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Valor (€)
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0,00"
              value={valorForm}
              onChange={(e) => setValorForm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {saving ? "A guardar..." : editId ? "Atualizar" : "Adicionar"}
          </button>
        </div>
      </form>

      {/* Tabela de Movimentos com Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-800">
            Extrato do Projeto ({itensFiltrados.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as any)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50"
            >
              <option value="todos">Entradas e Saídas</option>
              <option value="entrada">Apenas Entradas</option>
              <option value="saida">Apenas Saídas</option>
            </select>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50"
            >
              <option value="todos">Todos os Estados</option>
              <option value="executado">Executados</option>
              <option value="previsto">Previstos</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Estado / Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 hidden sm:table-cell">Categoria</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    A carregar movimentos...
                  </td>
                </tr>
              ) : (
                itensFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {item.status === "executado" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {item.data ? item.data.split("-").reverse().join("/") : "Executado"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 shrink-0" />
                          Previsto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{item.descricao}</div>
                      <div className="text-[11px] text-slate-400 sm:hidden">
                        {item.categoria}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">
                      {item.categoria}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                        item.tipo === "entrada" ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {item.tipo === "entrada" ? "+" : "-"} {formatarEuro(Number(item.valor))}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {item.status === "previsto" && (
                          <button
                            type="button"
                            onClick={() => marcarComoExecutado(item)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            title="Marcar como executado hoje"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => carregarParaEdicao(item)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirItem(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="Apagar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
