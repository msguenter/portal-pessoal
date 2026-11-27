'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface ProjetoFasesGanttProps {
  prazos: any[];
}

export default function ProjetoFasesGantt({ prazos }: ProjetoFasesGanttProps) {
  const { chartData, minTs, hojeOffsetDias, hojeLabel } = useMemo(() => {
    const validos = prazos.filter((p) => p.data_inicio);
    if (validos.length === 0) {
      return { chartData: [], minTs: 0, hojeOffsetDias: null, hojeLabel: '' };
    }

    const msPorDia = 1000 * 60 * 60 * 24;
    const timestampsInicio = validos.map((p) => new Date(`${p.data_inicio}T00:00:00`).getTime());
    const min = Math.min(...timestampsInicio);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const offsetHoje = Math.round((hoje.getTime() - min) / msPorDia);
    const hojeFmt = hoje.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });

    const data = prazos.map((p) => {
      if (!p.data_inicio) {
        return {
          fase: p.fase,
          offsetDias: 0,
          contratoDias: 0,
          prorrogacaoDias: 0,
          periodoLabel: 'Sem data de início',
        };
      }

      const startTs = new Date(`${p.data_inicio}T00:00:00`).getTime();
      const offsetDias = Math.max(0, Math.round((startTs - min) / msPorDia));
      const contratoDias = Number(p.prazo_contrato_dias) || 0;
      const prorrogacaoDias = Number(p.prorrogacao_dias) || 0;

      return {
        fase: p.fase,
        offsetDias,
        contratoDias,
        prorrogacaoDias,
        periodoLabel: `${p.data_inicio} → ${p.data_fim || '?'}`,
      };
    });

    return {
      chartData: data,
      minTs: min,
      hojeOffsetDias: offsetHoje >= 0 ? offsetHoje : null,
      hojeLabel: hojeFmt,
    };
  }, [prazos]);

  if (chartData.length === 0) {
    return null;
  }

  function formatarDiaParaData(diasOffset: number) {
    if (!minTs) return '';
    const d = new Date(minTs + diasOffset * 1000 * 60 * 60 * 24);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">
          Cronograma das Fases
        </h3>
        <span className="text-xs text-slate-500">
          Contrato vs. Prorrogação • Hoje: <strong className="text-rose-600">{hojeLabel}</strong>
        </span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 25, top: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              type="number"
              domain={[0, (dataMax: number) => Math.max(dataMax, (hojeOffsetDias || 0) + 5)]}
              tickFormatter={formatarDiaParaData}
              tick={{ fontSize: 12 }}
            />
            <YAxis dataKey="fase" type="category" width={150} tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(label, payload) => {
                const periodo = payload?.[0]?.payload?.periodoLabel;
                return periodo ? `${label} (${periodo})` : label;
              }}
              formatter={(value: any, name: any) => {
                if (name === 'Início (offset)') {
                  return [formatarDiaParaData(Number(value)), 'Data de início'];
                }
                return [`${value} dias`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />

            <Bar dataKey="offsetDias" name="Início (offset)" stackId="gantt" fill="transparent" />
            <Bar dataKey="contratoDias" name="Prazo Contratual" stackId="gantt" fill="#0f172a" />
            <Bar
              dataKey="prorrogacaoDias"
              name="Prorrogação"
              stackId="gantt"
              fill="#f59e0b"
              radius={[0, 4, 4, 0]}
            />

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