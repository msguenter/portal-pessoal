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
  ResponsiveContainer,
} from 'recharts';

interface ProjetoFasesGanttProps {
  prazos: any[];
}

export default function ProjetoFasesGantt({ prazos }: ProjetoFasesGanttProps) {
  const chartData = useMemo(() => {
    const validos = prazos.filter((p) => p.data_inicio);
    if (validos.length === 0) return [];

    const timestampsInicio = validos.map((p) => new Date(`${p.data_inicio}T00:00:00`).getTime());
    const minTs = Math.min(...timestampsInicio);
    const msPorDia = 1000 * 60 * 60 * 24;

    return prazos.map((p) => {
      if (!p.data_inicio) {
        return {
          fase: p.fase,
          offsetDias: 0,
          contratoDias: p.prazo_contrato_dias || 0,
          prorrogacaoDias: p.prorrogacao_dias || 0,
          periodoLabel: 'Sem data de início',
        };
      }

      const startTs = new Date(`${p.data_inicio}T00:00:00`).getTime();
      const offsetDias = Math.max(0, Math.round((startTs - minTs) / msPorDia));
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
  }, [prazos]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-900">
          Linha Temporal das Fases (Dias Corridos desde o Início)
        </h3>
        <span className="text-xs text-slate-500">Contrato vs. Prorrogação</span>
      </div>

      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" unit="d" tick={{ fontSize: 12 }} />
            <YAxis dataKey="fase" type="category" width={150} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: any, name: any) => {
                if (name === 'Início (offset)') return [`Dia ${value}`, 'Início no cronograma'];
                return [`${value} dias`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* Barra transparente para posicionar o início de cada fase na linha temporal */}
            <Bar dataKey="offsetDias" name="Início (offset)" stackId="gantt" fill="transparent" />
            <Bar dataKey="contratoDias" name="Prazo Contratual" stackId="gantt" fill="#0f172a" />
            <Bar
              dataKey="prorrogacaoDias"
              name="Prorrogação"
              stackId="gantt"
              fill="#f59e0b"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}