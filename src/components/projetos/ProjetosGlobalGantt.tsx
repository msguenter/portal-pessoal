'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from 'recharts';

interface ProjetosGlobalGanttProps {
  projetos: any[];
}

export default function ProjetosGlobalGantt({ projetos }: ProjetosGlobalGanttProps) {
  const { chartData, minTs, hojeOffsetDias, hojeLabel } = useMemo(() => {
    const msPorDia = 1000 * 60 * 60 * 24;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFmt = hoje.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });

    const ativos = projetos.filter((p) => p.estado !== 'Concluído');

    // Extrair início e fim (entrega da fase atual ou última data de fim das fases) para cada projeto
    const intervalos = ativos
      .map((p) => {
        const prazosValidos = (p.projeto_prazos || []).filter((pr: any) => pr.data_inicio || pr.data_fim);
        const inicios = prazosValidos
          .map((pr: any) => pr.data_inicio)
          .filter(Boolean)
          .sort();
        const fins = prazosValidos
          .map((pr: any) => pr.data_fim)
          .filter(Boolean)
          .sort();

        const dataInicioStr = p.data_inicio || inicios[0] || null;
        const dataFimStr = p.entrega_fase_atual || fins[fins.length - 1] || dataInicioStr;

        if (!dataInicioStr || !dataFimStr) return null;

        const startTs = new Date(`${dataInicioStr}T00:00:00`).getTime();
        const endTs = Math.max(startTs + msPorDia, new Date(`${dataFimStr}T00:00:00`).getTime());

        const atrasado = p.entrega_fase_atual
          ? new Date(`${p.entrega_fase_atual}T00:00:00`) < hoje
          : false;

        return {
          codigo: p.codigo,
          designacao: p.designacao,
          labelEixo: `${p.codigo} • ${p.designacao.slice(0, 22)}${p.designacao.length > 22 ? '…' : ''}`,
          faseAtual: p.fase_atual,
          estado: p.estado,
          coordenador: p.coordenador || 'Sem coord.',
          dataInicioStr,
          dataFimStr,
          startTs,
          endTs,
          atrasado,
        };
      })
      .filter(Boolean) as any[];

    if (intervalos.length === 0) {
      return { chartData: [], minTs: 0, hojeOffsetDias: null, hojeLabel: hojeFmt };
    }

    // Ordenar do que começa mais cedo para o mais recente
    intervalos.sort((a, b) => a.startTs - b.startTs);

    const min = Math.min(...intervalos.map((i) => i.startTs));
    const offsetHoje = Math.round((hoje.getTime() - min) / msPorDia);

    const data = intervalos.map((item) => {
      const offsetDias = Math.max(0, Math.round((item.startTs - min) / msPorDia));
      const duracaoDias = Math.max(1, Math.round((item.endTs - item.startTs) / msPorDia));

      let cor = '#2563eb'; // Em andamento (azul)
      if (item.atrasado) cor = '#e11d48'; // Prazo excedido (vermelho)
      else if (item.estado === 'Aguarda resposta DO') cor = '#f59e0b'; // Aguarda DO (âmbar)
      else if (item.estado === 'Não iniciada') cor = '#94a3b8'; // Não iniciada (cinza)

      return {
        ...item,
        offsetDias,
        duracaoDias,
        cor,
      };
    });

    return {
      chartData: data,
      minTs: min,
      hojeOffsetDias: offsetHoje >= 0 ? offsetHoje : null,
      hojeLabel: hojeFmt,
    };
  }, [projetos]);

  if (chartData.length === 0) {
    return null;
  }

  function formatarDiaParaData(diasOffset: number) {
    if (!minTs) return '';
    const d = new Date(minTs + diasOffset * 1000 * 60 * 60 * 24);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  }

  // Altura dinâmica conforme o número de projetos ativos (mínimo 240px)
  const chartHeight = Math.max(240, chartData.length * 42 + 60);

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Cronograma Global dos Projetos (Início → Entrega Fase Atual)
          </h3>
          <p className="text-xs text-slate-500">
            Visão temporal da carteira ativa • Hoje: <strong className="text-rose-600">{hojeLabel}</strong>
          </p>
        </div>

        {/* Legenda de Cores */}
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" /> Em andamento
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Aguarda DO
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-600 inline-block" /> Prazo excedido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block" /> Não iniciada
          </span>
        </div>
      </div>

      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 25, top: 18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              domain={[0, (dataMax: number) => Math.max(dataMax, (hojeOffsetDias || 0) + 7)]}
              tickFormatter={formatarDiaParaData}
              tick={{ fontSize: 12 }}
            />
            <YAxis dataKey="labelEixo" type="category" width={195} tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                if (!item) return '';
                return `${item.codigo} — ${item.designacao} (${item.faseAtual})`;
              }}
              formatter={(value: any, name: any, props: any) => {
                const item = props?.payload;
                if (name === 'Início') {
                  return [item?.dataInicioStr || formatarDiaParaData(Number(value)), 'Início'];
                }
                return [
                  `${value} dias (${item?.dataInicioStr} → ${item?.dataFimStr}) • ${item?.coordenador}`,
                  'Período',
                ];
              }}
            />

            <Bar dataKey="offsetDias" name="Início" stackId="globalGantt" fill="transparent" />
            <Bar dataKey="duracaoDias" name="Período" stackId="globalGantt" radius={[4, 4, 4, 4]}>
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.cor} />
              ))}
            </Bar>

            {hojeOffsetDias !== null && (
              <ReferenceLine
                x={hojeOffsetDias}
                stroke="#e11d48"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{
                  value: `Hoje (${hojeLabel})`,
                  position: 'top',
                  fill: '#e11d48',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}