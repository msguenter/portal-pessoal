"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  TrendingUp,
  Landmark,
  Users,
  PlusCircle,
  RefreshCw,
  Edit3,
  Plus,
  X,
  Wallet,
} from "lucide-react";

interface AtivoBR {
  id: string;
  ativo: string;
  indice: string;
  conta: string;
  data_aplicacao: string | null;
  valor_aplicado: number;
  valor_atual: number;
  observacoes: string | null;
}

interface TerceiroCota {
  id: string;
  beneficiario: string;
  quantidade_cotas: number;
  valor_cota_atual: number;
  ultimo_aporte_em: string | null;
}

function formatarBRL(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarEUR(valor: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(valor);
}

export default function InvestimentosBRPage() {
  const [ativos, setAtivos] = useState<AtivoBR[]>([]);
  const [terceiros, setTerceiros] = useState<TerceiroCota[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  // Cotação EUR/BRL editável (padrão ~5.263 da planilha)
  const [cambioEurBrl, setCambioEurBrl] = useState("5.263");

  // Controle das Cotas de Terceiros
  const [cotaSelicInput, setCotaSelicInput] = useState("20120.75");
  const [valorAporteMensal, setValorAporteMensal] = useState("50");

  // Formulário de Ativo Próprio
  const [editId, setEditId] = useState<string | null>(null);
  const [ativoForm, setAtivoForm] = useState("");
  const [indiceForm, setIndiceForm] = useState("Selic");
  const [contaForm, setContaForm] = useState("C6");
  const [dataForm, setDataForm] = useState("");
  const [aplicadoForm, setAplicadoForm] = useState("");
  const [atualForm, setAtualForm] = useState("");
  const [obsForm, setObsForm] = useState("");

  async function carregarDados() {
    setLoading(true);
    const [resAtivos, resTerceiros] = await Promise.all([
      supabase
        .from("investimentos_br_ativos")
        .select("*")
        .order("valor_atual", { ascending: false }),
      supabase
        .from("investimentos_br_terceiros")
        .select("*")
        .order("quantidade_cotas", { ascending: false }),
    ]);

    if (resAtivos.error) {
      setMensagem(`Erro ativos: ${resAtivos.error.message}`);
    } else if (resAtivos.data) {
      setAtivos(resAtivos.data);
    }

    if (resTerceiros.error) {
      setMensagem(`Erro terceiros: ${resTerceiros.error.message}`);
    } else if (resTerceiros.data) {
      setTerceiros(resTerceiros.data);
      if (resTerceiros.data.length > 0) {
        setCotaSelicInput(String(resTerceiros.data[0].valor_cota_atual));
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  function limparForm() {
    setEditId(null);
    setAtivoForm("");
    setIndiceForm("Selic");
    setContaForm("C6");
    setDataForm("");
    setAplicadoForm("");
    setAtualForm("");
    setObsForm("");
  }

  function carregarParaEdicao(item: AtivoBR) {
    setEditId(item.id);
    setAtivoForm(item.ativo);
    setIndiceForm(item.indice);
    setContaForm(item.conta);
    setDataForm(item.data_aplicacao || "");
    setAplicadoForm(String(item.valor_aplicado));
    setAtualForm(String(item.valor_atual));
    setObsForm(item.observacoes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSalvarAtivo(e: React.FormEvent) {
    e.preventDefault();
    if (!ativoForm.trim()) return;
    setSaving(true);
    setMensagem(null);

    const payload = {
      ativo: ativoForm.trim(),
      indice: indiceForm.trim(),
      conta: contaForm.trim(),
      data_aplicacao: dataForm || null,
      valor_aplicado: parseFloat(aplicadoForm.replace(",", ".")) || 0,
      valor_atual: parseFloat(atualForm.replace(",", ".")) || 0,
      observacoes: obsForm.trim() || null,
    };

    const { error } = editId
      ? await supabase.from("investimentos_br_ativos").update(payload).eq("id", editId)
      : await supabase.from("investimentos_br_ativos").insert(payload);

    if (error) {
      setMensagem(`Erro: ${error.message}`);
    } else {
      setMensagem(editId ? "Ativo atualizado!" : "Ativo adicionado!");
      limparForm();
      await carregarDados();
      setTimeout(() => setMensagem(null), 3000);
    }
    setSaving(false);
  }

  // Atualizar apenas o preço da cota Selic dos terceiros
  async function handleAtualizarCotaTerceiros() {
    const novaCota = parseFloat(cotaSelicInput.replace(",", "."));
    if (!novaCota || novaCota <= 0) return;
    setSaving(true);
    setMensagem(null);

    const updates = terceiros.map((t) =>
      supabase
        .from("investimentos_br_terceiros")
        .update({ valor_cota_atual: novaCota })
        .eq("id", t.id)
    );

    await Promise.all(updates);
    setMensagem(`Valor da cota atualizado para ${formatarBRL(novaCota)}!`);
    await carregarDados();
    setTimeout(() => setMensagem(null), 3500);
    setSaving(false);
  }

  // Somar o equivalente a R$ 50 (ou valor definido) em cotas para cada um dos 7 beneficiários
  async function handleAporteMensalTerceiros() {
    const novaCota = parseFloat(cotaSelicInput.replace(",", "."));
    const aporteReais = parseFloat(valorAporteMensal.replace(",", "."));
    if (!novaCota || novaCota <= 0 || !aporteReais || aporteReais <= 0) return;

    setSaving(true);
    setMensagem(null);

    const cotasAdicionais = aporteReais / novaCota;
    const hoje = new Date().toISOString().split("T")[0];

    const updates = terceiros.map((t) => {
      const novaQtd = Number((Number(t.quantidade_cotas) + cotasAdicionais).toFixed(6));
      return supabase
        .from("investimentos_br_terceiros")
        .update({
          quantidade_cotas: novaQtd,
          valor_cota_atual: novaCota,
          ultimo_aporte_em: hoje,
        })
        .eq("id", t.id);
    });

    await Promise.all(updates);
    setMensagem(
      `+${formatarBRL(aporteReais)} (+${cotasAdicionais.toFixed(6)} cotas) adicionados para cada um dos ${terceiros.length} beneficiários!`
    );
    await carregarDados();
    setTimeout(() => setMensagem(null), 4500);
    setSaving(false);
  }

  const resumo = useMemo(() => {
    const totalAplicado = ativos.reduce((acc, a) => acc + Number(a.valor_aplicado), 0);
    const totalBruto = ativos.reduce((acc, a) => acc + Number(a.valor_atual), 0);

    const cotaRef = parseFloat(cotaSelicInput.replace(",", ".")) || 20120.75;
    const totalTerceiros = terceiros.reduce(
      (acc, t) => acc + Number(t.quantidade_cotas) * cotaRef,
      0
    );

    const patrimonioLiquidoBRL = totalBruto - totalTerceiros;
    const taxaCambio = parseFloat(cambioEurBrl.replace(",", ".")) || 5.263;
    const patrimonioLiquidoEUR = patrimonioLiquidoBRL / taxaCambio;
    const totalBrutoEUR = totalBruto / taxaCambio;

    // Agrupamento por Indexador (já descontando terceiros do Selic para refletir a alocação líquida real)
    const porIndice: Record<string, number> = {};
    for (const a of ativos) {
      let val = Number(a.valor_atual);
      if (a.indice.toLowerCase() === "selic") {
        val = Math.max(0, val - totalTerceiros);
      }
      porIndice[a.indice] = (porIndice[a.indice] || 0) + val;
    }

    const alocacaoIndices = Object.entries(porIndice)
      .map(([indice, valor]) => ({
        indice,
        valor,
        percentual: patrimonioLiquidoBRL > 0 ? (valor / patrimonioLiquidoBRL) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    return {
      totalAplicado,
      totalBruto,
      totalTerceiros,
      patrimonioLiquidoBRL,
      patrimonioLiquidoEUR,
      totalBrutoEUR,
      alocacaoIndices,
    };
  }, [ativos, terceiros, cotaSelicInput, cambioEurBrl]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho + Câmbio rápido */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            Investimentos Brasil
          </h1>
          <p className="text-sm text-slate-500">
            Carteira ativa, patrimônio líquido próprio e custódia de terceiros
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm self-start">
          <span className="text-xs font-medium text-slate-500">1 € = R$</span>
          <input
            type="number"
            step="0.001"
            value={cambioEurBrl}
            onChange={(e) => setCambioEurBrl(e.target.value)}
            className="w-16 text-xs font-bold text-slate-900 focus:outline-none"
          />
        </div>
      </div>

      {mensagem && (
        <div className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl">
          {mensagem}
        </div>
      )}

      {/* 4 KPIs Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Líquido Próprio</span>
            <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-emerald-700">
            {formatarBRL(resumo.patrimonioLiquidoBRL)}
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-1">
            ≈ {formatarEUR(resumo.patrimonioLiquidoEUR)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Total Bruto</span>
            <Landmark className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-900">
            {formatarBRL(resumo.totalBruto)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            ≈ {formatarEUR(resumo.totalBrutoEUR)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Cotas Terceiros</span>
            <Users className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-amber-700">
            {formatarBRL(resumo.totalTerceiros)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Embutido no Tesouro Selic
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Valor Aplicado</span>
            <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-bold text-slate-900">
            {formatarBRL(resumo.totalAplicado)}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            Resultado: {formatarBRL(resumo.totalBruto - resumo.totalAplicado)}
          </p>
        </div>
      </div>

      {/* Gráfico de Alocação Líquida por Indexador */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Alocação Líquida por Indexador
          </h2>
          <span className="text-xs text-slate-400">
            Já descontando cotas de terceiros
          </span>
        </div>

        <div className="space-y-3 pt-1">
          {resumo.alocacaoIndices.map((item) => (
            <div key={item.indice}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">{item.indice}</span>
                <span className="text-slate-600">
                  {formatarBRL(item.valor)} ({item.percentual.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, item.percentual)}%` }}
                  className="bg-emerald-600 h-full rounded-full transition-all"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela de Ativos Próprios + Formulário */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Carteira Própria ({ativos.length} ativos)
          </h2>
          {loading && <span className="text-xs text-slate-400">A carregar...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3">Índice / Conta</th>
                <th className="px-4 py-3 text-right">Aplicado</th>
                <th className="px-4 py-3 text-right">Atual</th>
                <th className="px-4 py-3 text-right">Var.</th>
                <th className="px-4 py-3 text-right">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ativos.map((a) => {
                const aplicado = Number(a.valor_aplicado);
                const atual = Number(a.valor_atual);
                const varPerc = aplicado > 0 ? ((atual - aplicado) / aplicado) * 100 : 0;
                const isSelic = a.indice.toLowerCase() === "selic";

                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{a.ativo}</div>
                      {isSelic && (
                        <div className="text-[11px] text-emerald-700 font-normal">
                          Líquido próprio: {formatarBRL(Math.max(0, atual - resumo.totalTerceiros))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-medium text-slate-700">
                        {a.indice}
                      </span>{" "}
                      <span className="text-slate-400 ml-1">{a.conta}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                      {formatarBRL(aplicado)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {formatarBRL(atual)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right text-xs font-semibold whitespace-nowrap ${
                        varPerc >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {varPerc >= 0 ? "+" : ""}
                      {varPerc.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => carregarParaEdicao(a)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Atualizar saldo ou editar ativo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Formulário de Edição / Novo Ativo */}
        <form
          onSubmit={handleSalvarAtivo}
          className="p-5 bg-slate-50/70 border-t border-slate-200 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {editId ? `Atualizando: ${ativoForm}` : "Adicionar Novo Ativo"}
            </h3>
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

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nome do Ativo
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Tesouro Selic 2031"
                value={ativoForm}
                onChange={(e) => setAtivoForm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Indexador
              </label>
              <input
                type="text"
                required
                placeholder="Selic, CDI, Pré..."
                value={indiceForm}
                onChange={(e) => setIndiceForm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Corretora
              </label>
              <input
                type="text"
                required
                placeholder="C6, XP, Inter..."
                value={contaForm}
                onChange={(e) => setContaForm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Aplicado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={aplicadoForm}
                onChange={(e) => setAplicadoForm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Valor Atual (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={atualForm}
                onChange={(e) => setAtualForm(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {saving ? "A guardar..." : editId ? "Salvar Alteração" : "Adicionar Ativo"}
            </button>
          </div>
        </form>
      </div>

      {/* Seção Cotas de Terceiros (Automação Mensal R$ 50) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Cotas de Terceiros — Tesouro Selic ({terceiros.length} pessoas)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Atualize o valor da cota Selic e some o aporte mensal de R$ 50,00 para cada um em 1 clique.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Custodiado</span>
              <span className="text-lg font-bold text-amber-700">
                {formatarBRL(resumo.totalTerceiros)}
              </span>
            </div>
          </div>

          {/* Painel de Ação Rápida Mensal */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-amber-50/70 border border-amber-200/80 p-4 rounded-xl items-end">
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Unitário Cota Selic (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={cotaSelicInput}
                onChange={(e) => setCotaSelicInput(e.target.value)}
                className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-slate-900 bg-white"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Aporte por Pessoa (R$)
              </label>
              <input
                type="number"
                step="1"
                value={valorAporteMensal}
                onChange={(e) => setValorAporteMensal(e.target.value)}
                className="w-full rounded-xl border border-amber-300 px-3 py-2 text-sm font-semibold text-slate-900 bg-white"
              />
            </div>

            <div className="sm:col-span-5 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleAporteMensalTerceiros}
                className="flex-1 flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                + R$ {valorAporteMensal} p/ cada
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleAtualizarCotaTerceiros}
                className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-2.5 rounded-xl text-xs font-medium transition disabled:opacity-50"
                title="Atualiza apenas o valor da cota sem somar novo aporte"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Só Cota
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Beneficiário</th>
                <th className="px-4 py-3 text-right">Qtd. Cotas</th>
                <th className="px-4 py-3 text-right">Cota Ref.</th>
                <th className="px-4 py-3 text-right">Saldo Atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terceiros.map((t) => {
                const cotaRef = parseFloat(cotaSelicInput.replace(",", ".")) || Number(t.valor_cota_atual);
                const saldo = Number(t.quantidade_cotas) * cotaRef;
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {t.beneficiario}
                      {t.ultimo_aporte_em && (
                        <span className="ml-2 text-[10px] text-slate-400">
                          (aporte: {t.ultimo_aporte_em.split("-").reverse().join("/")})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-600">
                      {Number(t.quantidade_cotas).toFixed(6)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-500 whitespace-nowrap">
                      {formatarBRL(cotaRef)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {formatarBRL(saldo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
