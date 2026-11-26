"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Activity,
  Scale,
  HeartPulse,
  Flame,
  Dumbbell,
  CandyOff,
  Check,
  Edit3,
  Save,
  Trophy,
} from "lucide-react";

interface SaudeRegistro {
  id?: string;
  data: string;
  peso_kg: number | null;
  sistole: number | null;
  diastole: number | null;
  exercicio_cardio: boolean;
  exercicio_forca: boolean;
  consumiu_acucar: boolean;
  observacoes: string | null;
  isDefault?: boolean;
}

const DATA_INICIO = "2026-05-18";

const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function gerarCalendarioCompleto(
  registros: SaudeRegistro[],
  dataInicioStr: string,
  dataFimStr: string
): SaudeRegistro[] {
  const mapa = new Map<string, SaudeRegistro>();
  for (const r of registros) {
    mapa.set(r.data, r);
  }

  const [anoI, mesI, diaI] = dataInicioStr.split("-").map(Number);
  const [anoF, mesF, diaF] = dataFimStr.split("-").map(Number);

  const inicio = new Date(Date.UTC(anoI, mesI - 1, diaI));
  const fim = new Date(Date.UTC(anoF, mesF - 1, diaF));
  const dataLimite = fim >= inicio ? fim : inicio;

  const resultado: SaudeRegistro[] = [];
  for (
    let d = new Date(dataLimite);
    d >= inicio;
    d.setUTCDate(d.getUTCDate() - 1)
  ) {
    const iso = d.toISOString().split("T")[0];
    const existente = mapa.get(iso);
    if (existente) {
      resultado.push({ ...existente, isDefault: false });
    } else {
      resultado.push({
        data: iso,
        peso_kg: null,
        sistole: null,
        diastole: null,
        exercicio_cardio: false,
        exercicio_forca: false,
        consumiu_acucar: false,
        observacoes: null,
        isDefault: true,
      });
    }
  }
  return resultado;
}

export default function SaudePage() {
  const [registros, setRegistros] = useState<SaudeRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const hojeISO = new Date().toISOString().split("T")[0];

  const [dataForm, setDataForm] = useState(hojeISO);
  const [pesoForm, setPesoForm] = useState("");
  const [sistoleForm, setSistoleForm] = useState("");
  const [diastoleForm, setDiastoleForm] = useState("");
  const [cardioForm, setCardioForm] = useState(false);
  const [forcaForm, setForcaForm] = useState(false);
  const [acucarForm, setAcucarForm] = useState(false);
  const [obsForm, setObsForm] = useState("");

  async function carregarDados() {
    setLoading(true);
    const { data, error } = await supabase
      .from("saude_registros")
      .select("*")
      .order("data", { ascending: false });

    if (error) {
      setMensagem(`Erro Supabase: ${error.message}`);
    } else if (data) {
      setRegistros(data);
      preencherFormularioPorData(hojeISO, data);
    }
    setLoading(false);
  }

  function preencherFormularioPorData(dataAlvo: string, lista = registros) {
    setDataForm(dataAlvo);
    const existente = lista.find((r) => r.data === dataAlvo);
    if (existente) {
      setPesoForm(existente.peso_kg !== null ? String(existente.peso_kg) : "");
      setSistoleForm(existente.sistole !== null ? String(existente.sistole) : "");
      setDiastoleForm(existente.diastole !== null ? String(existente.diastole) : "");
      setCardioForm(existente.exercicio_cardio);
      setForcaForm(existente.exercicio_forca);
      setAcucarForm(existente.consumiu_acucar);
      setObsForm(existente.observacoes || "");
    } else {
      setPesoForm("");
      setSistoleForm("");
      setDiastoleForm("");
      setCardioForm(false);
      setForcaForm(false);
      setAcucarForm(false);
      setObsForm("");
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMensagem(null);

    const payload = {
      data: dataForm,
      peso_kg: pesoForm.trim() !== "" ? parseFloat(pesoForm.replace(",", ".")) : null,
      sistole: sistoleForm.trim() !== "" ? parseInt(sistoleForm, 10) : null,
      diastole: diastoleForm.trim() !== "" ? parseInt(diastoleForm, 10) : null,
      exercicio_cardio: cardioForm,
      exercicio_forca: forcaForm,
      consumiu_acucar: acucarForm,
      observacoes: obsForm.trim() !== "" ? obsForm.trim() : null,
    };

    const { error } = await supabase
      .from("saude_registros")
      .upsert(payload, { onConflict: "data" });

    if (error) {
      setMensagem(`Erro ao salvar: ${error.message}`);
    } else {
      setMensagem("Registo guardado com sucesso!");
      await carregarDados();
      setTimeout(() => setMensagem(null), 3000);
    }
    setSaving(false);
  }

  // Linha do tempo contínua desde 18/05/2026 até hoje (com defaults nos dias sem registo)
  const calendarioCompleto = useMemo(() => {
    const maiorData =
      registros.length > 0 && registros[0].data > hojeISO
        ? registros[0].data
        : hojeISO;
    return gerarCalendarioCompleto(registros, DATA_INICIO, maiorData);
  }, [registros, hojeISO]);

  const kpis = useMemo(() => {
    const comPeso = calendarioCompleto.filter((r) => r.peso_kg !== null);
    const pesoAtual = comPeso.length > 0 ? Number(comPeso[0].peso_kg) : null;
    const pesoInicial =
      comPeso.length > 0 ? Number(comPeso[comPeso.length - 1].peso_kg) : null;
    const diffPeso =
      pesoAtual !== null && pesoInicial !== null
        ? +(pesoAtual - pesoInicial).toFixed(1)
        : null;

    const comPressao = calendarioCompleto.filter(
      (r) => r.sistole !== null && r.diastole !== null
    );
    const ultimaPressao = comPressao.length > 0 ? comPressao[0] : null;

    // Sequência atual sem açúcar (do dia mais recente para trás, incluindo dias sem registo = false)
    let streakSemAcucar = 0;
    for (const r of calendarioCompleto) {
      if (!r.consumiu_acucar) streakSemAcucar++;
      else break;
    }

    // Maior sequência histórica sem açúcar (ordem cronológica contínua)
    let maiorStreakSemAcucar = 0;
    let contadorAtual = 0;
    const cronologico = calendarioCompleto.slice().reverse();
    for (const r of cronologico) {
      if (!r.consumiu_acucar) {
        contadorAtual++;
        if (contadorAtual > maiorStreakSemAcucar) {
          maiorStreakSemAcucar = contadorAtual;
        }
      } else {
        contadorAtual = 0;
      }
    }

    const ultimos30 = calendarioCompleto.slice(0, 30);
    const treinos30d = ultimos30.filter(
      (r) => r.exercicio_cardio || r.exercicio_forca
    ).length;

    return {
      pesoAtual,
      diffPeso,
      ultimaPressao,
      streakSemAcucar,
      maiorStreakSemAcucar,
      treinos30d,
    };
  }, [calendarioCompleto]);

  const pontosPeso = useMemo(() => {
    return calendarioCompleto
      .filter((r) => r.peso_kg !== null)
      .slice()
      .reverse()
      .map((r) => ({ data: r.data, peso: Number(r.peso_kg) }));
  }, [calendarioCompleto]);

  const graficoSvg = useMemo(() => {
    if (pontosPeso.length < 2) return null;
    const largura = 760;
    const altura = 225;
    const padX = 42;
    const padTop = 22;
    const padBottom = 34;

    const pesos = pontosPeso.map((p) => p.peso);
    const minP = Math.floor(Math.min(...pesos) - 0.5);
    const maxP = Math.ceil(Math.max(...pesos) + 0.5);
    const rangeP = maxP - minP || 1;

    const coords = pontosPeso.map((p, idx) => {
      const x = padX + (idx / (pontosPeso.length - 1)) * (largura - padX * 2);
      const y =
        altura -
        padBottom -
        ((p.peso - minP) / rangeP) * (altura - padTop - padBottom);
      return { ...p, x, y };
    });

    const mesesLabels: { x: number; label: string }[] = [];
    let ultimoMesAno = "";
    coords.forEach((c) => {
      const [ano, mesStr] = c.data.split("-");
      const chave = `${ano}-${mesStr}`;
      if (chave !== ultimoMesAno) {
        ultimoMesAno = chave;
        const mesIdx = parseInt(mesStr, 10) - 1;
        mesesLabels.push({
          x: c.x,
          label: `${MESES_PT[mesIdx]}/${ano.slice(2)}`,
        });
      }
    });

    const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ");
    return {
      largura,
      altura,
      padX,
      padTop,
      padBottom,
      minP,
      maxP,
      coords,
      polyline,
      mesesLabels,
    };
  }, [pontosPeso]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Controle de Saúde</h1>
        <p className="text-sm text-slate-500">
          Acompanhamento diário de peso, pressão arterial, treinos e hábitos
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Peso Atual</span>
            <Scale className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900">
              {kpis.pesoAtual !== null ? `${kpis.pesoAtual.toFixed(1)} kg` : "—"}
            </span>
            {kpis.diffPeso !== null && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  kpis.diffPeso <= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {kpis.diffPeso > 0 ? `+${kpis.diffPeso}` : kpis.diffPeso} kg
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Última Pressão</span>
            <HeartPulse className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900">
              {kpis.ultimaPressao
                ? `${kpis.ultimaPressao.sistole}/${kpis.ultimaPressao.diastole}`
                : "—"}
            </span>
            {kpis.ultimaPressao && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  (kpis.ultimaPressao.sistole ?? 0) < 130 &&
                  (kpis.ultimaPressao.diastole ?? 0) < 85
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {(kpis.ultimaPressao.sistole ?? 0) < 130 &&
                (kpis.ultimaPressao.diastole ?? 0) < 85
                  ? "Normal"
                  : "Atenção"}
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Sem Açúcar</span>
            <CandyOff className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">
              {kpis.streakSemAcucar} {kpis.streakSemAcucar === 1 ? "dia" : "dias"}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-700 font-medium">
              <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Recorde: {kpis.maiorStreakSemAcucar} dias</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs sm:text-sm">
            <span>Treinos (30d)</span>
            <Dumbbell className="w-4 h-4 text-indigo-600 shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-slate-900">
              {kpis.treinos30d} dias
            </span>
          </div>
        </div>
      </div>

      {/* Formulário de Check-in Diário */}
      <form
        onSubmit={handleSalvar}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Registo Diário (Check-in)
          </h2>
          {mensagem && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              {mensagem}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Data
            </label>
            <input
              type="date"
              required
              value={dataForm}
              onChange={(e) => preencherFormularioPorData(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Peso (kg)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="Ex: 108.0"
              value={pesoForm}
              onChange={(e) => setPesoForm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Sístole (mmHg)
            </label>
            <input
              type="number"
              placeholder="Ex: 120"
              value={sistoleForm}
              onChange={(e) => setSistoleForm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Diástole (mmHg)
            </label>
            <input
              type="number"
              placeholder="Ex: 76"
              value={diastoleForm}
              onChange={(e) => setDiastoleForm(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setCardioForm(!cardioForm)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition ${
              cardioForm
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            <Activity className="w-4 h-4" />
            Cardio {cardioForm && <Check className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setForcaForm(!forcaForm)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition ${
              forcaForm
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            <Dumbbell className="w-4 h-4" />
            Força {forcaForm && <Check className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setAcucarForm(!acucarForm)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition ${
              acucarForm
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
            }`}
          >
            <Flame className="w-4 h-4" />
            {acucarForm ? "Consumiu Açúcar" : "Dia Sem Açúcar"}
          </button>

          <input
            type="text"
            placeholder="Observação opcional..."
            value={obsForm}
            onChange={(e) => setObsForm(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900"
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </form>

      {/* Gráfico de Evolução de Peso com Eixo de Meses */}
      {graficoSvg && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">
              Evolução do Peso (kg)
            </h2>
            <span className="text-xs text-slate-500">
              {pontosPeso.length} pesagens registadas
            </span>
          </div>
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${graficoSvg.largura} ${graficoSvg.altura}`}
              className="w-full min-w-[520px] h-56"
            >
              <line
                x1={graficoSvg.padX}
                y1={graficoSvg.padTop}
                x2={graficoSvg.largura - graficoSvg.padX}
                y2={graficoSvg.padTop}
                stroke="#e2e8f0"
                strokeDasharray="4"
              />
              <line
                x1={graficoSvg.padX}
                y1={graficoSvg.altura - graficoSvg.padBottom}
                x2={graficoSvg.largura - graficoSvg.padX}
                y2={graficoSvg.altura - graficoSvg.padBottom}
                stroke="#cbd5e1"
              />

              <text x="6" y={graficoSvg.padTop + 4} fontSize="11" fill="#64748b">
                {graficoSvg.maxP}
              </text>
              <text
                x="6"
                y={graficoSvg.altura - graficoSvg.padBottom + 4}
                fontSize="11"
                fill="#64748b"
              >
                {graficoSvg.minP}
              </text>

              {graficoSvg.mesesLabels.map((m, idx) => (
                <g key={idx}>
                  <line
                    x1={m.x}
                    y1={graficoSvg.padTop}
                    x2={m.x}
                    y2={graficoSvg.altura - graficoSvg.padBottom}
                    stroke="#f1f5f9"
                  />
                  <text
                    x={m.x}
                    y={graficoSvg.altura - 12}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#64748b"
                  >
                    {m.label}
                  </text>
                </g>
              ))}

              <polyline
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                points={graficoSvg.polyline}
              />

              {graficoSvg.coords.map((c, i) => (
                <g key={i}>
                  <circle cx={c.x} cy={c.y} r="3.5" fill="#1d4ed8">
                    <title>{`${c.data.split("-").reverse().join("/")}: ${c.peso.toFixed(1)} kg`}</title>
                  </circle>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* Histórico Recente (Últimos 30 dias corridos) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Histórico Recente (Últimos 30 dias)
          </h2>
          {loading && <span className="text-xs text-slate-400">A carregar...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Peso</th>
                <th className="px-4 py-3">Pressão</th>
                <th className="px-4 py-3">Cardio</th>
                <th className="px-4 py-3">Força</th>
                <th className="px-4 py-3">Açúcar</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calendarioCompleto.slice(0, 30).map((r) => (
                <tr
                  key={r.data}
                  className={r.isDefault ? "bg-slate-50/40 hover:bg-slate-50" : "hover:bg-slate-50"}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <span>{r.data.split("-").reverse().join("/")}</span>
                    {r.isDefault && (
                      <span className="ml-2 text-[10px] text-slate-400 font-normal">
                        (padrão)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {r.peso_kg !== null ? `${Number(r.peso_kg).toFixed(1)} kg` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {r.sistole && r.diastole ? `${r.sistole}/${r.diastole}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.exercicio_cardio ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                        Sim
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.exercicio_forca ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700">
                        Sim
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.consumiu_acucar ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-rose-50 text-rose-700">
                        Sim
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700">
                        Não
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        preencherFormularioPorData(r.data);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-slate-500 hover:text-blue-600 p-1"
                      title="Editar registo"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
