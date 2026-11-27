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
import { COM_QUEM_ESTA_OPCOES, FASES_PADRAO } from '@/lib/projetos/constants';

interface ProjetosChartsProps {
  projetos: any[];
  equipa: any[];
}

export default function ProjetosCharts({ projetos, equipa }: ProjetosChartsProps) {
  // KPIs rápidos
  const kpis = useMemo(() => {
    const ativos = projetos.filter((p) => p.estado !== 'Concluído');
    const aguardaDO = ativos.filter((p) => p.estado === 'Aguarda resposta DO').length;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const atrasados = ativos.filter((p) => {
      if (!p.entrega_fase_atual) return false;
      const d = new Date(`${p.entrega_fase_atual}T00:00:00`);
      return d < hoje;
    }).length;

    const totalComAbertas = ativos.reduce((acc, p) => acc + (p.pendentes_count || 0), 0);

    return {
      totalAtivos: ativos.length,
      aguardaDO,
      atrasados,
      totalComAbertas,
    };
  }, [projetos]);

  // Gráfico 1: Onde está a bola (Com quem está x Estado)
  const dataComQuem = useMemo(() => {
    const ativos = projetos.filter((p) => p.estado !== 'Concluído');
    return COM_QUEM_ESTA_OPCOES.map((entidade) => {
      const doGrupo = ativos.filter((p) => (p.com_quem_esta || []).includes(entidade));
      return {
        entidade,
        'Em andamento': doGrupo.filter((p) => p.estado === 'Em andamento').length,
        'Aguarda DO': doGrupo.filter((p) => p.estado === 'Aguarda resposta DO').length,
        'Não iniciada': doGrupo.filter((p) => p.estado === 'Não iniciada').length,
      };
    });
  }, [projetos]);

  // Gráfico 2: Projetos por Fase Atual
  const dataFases = useMemo(() => {
    const ativos = projetos.filter((p) => p.estado !== 'Concluído');
    return FASES_PADRAO.map((f) => ({
      fase: f.nome
        .replace('Projeto de Execução', 'Execução')
        .replace('Assistência Técnica', 'Assist. Téc.'),
      projetos: ativos.filter((p) => p.fase_atual === f.nome).length,
    }));
  }, [projetos]);

  // Gráfico 3: Carga por Membro da Equipa (Coordenação + Especialidades ativas)
  const dataEquipa = useMemo(() => {
    const ativos = projetos.filter((p) => p.estado !== 'Concluído');
    const nomes = Array.from(
      new Set([
        ...equipa.filter((m) => m.ativo).map((m) => m.nome),
        ...ativos.map((p) => p.coordenador).filter(Boolean),
      ])
    );

    return nomes.map((nome) => {
      const coordCount = ativos.filter((p) => p.coordenador === nome).length;
      let espPendentes = 0;
      let espEmCurso = 0;

      ativos.forEach((p) => {
        (p.projeto_especialidades || []).forEach((e: any) => {
          if (e.aplicavel && e.tecnico_responsavel === nome && e.estado !== 'Entregue') {
            if (e.estado === 'Em curso') espEmCurso++;
            else espPendentes++;
          }
        });
      });

      return {
        nome: nome.split(' ')[0], // Primeiro nome para eixo limpo
        nomeCompleto: nome,
        Coordenação: coordCount,
        'Esp. Em Curso': espEmCurso,
        'Esp. Pendentes': espPendentes,
      };
    });
  }, [projetos, equipa]);

  return (
    <div className="space-y-4">
      {/* Faixa de KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Projetos Ativos</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{kpis.totalAtivos}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Aguardam Resposta DO</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{kpis.aguardaDO}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Fases com Prazo Excedido</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{kpis.atrasados}</div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase">Comunicações Pendentes</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{kpis.totalComAbertas}</div>
        </div>
      </div>

      {/* Grelha Desktop 3 Colunas */}
      <div className="grid grid-cols-3 gap-4">
        {/* Gráfico 1: Onde está a bola */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Com Quem Está (Gargalos)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataComQuem} layout="vertical" margin={{ left: 10, right: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis dataKey="entidade" type="category" width={95} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Em andamento" stackId="a" fill="#2563eb" />
                <Bar dataKey="Aguarda DO" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Não iniciada" stackId="a" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Projetos por Fase */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Carteira por Fase Atual</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataFases} margin={{ left: -15, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="fase" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="projetos" name="Projetos" fill="#0f172a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Carga da Equipa */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3">Carga por Membro da Equipa</h3>
          <div className="h-64">
            {dataEquipa.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Adiciona membros em &ldquo;Equipa &amp; Emails&rdquo; para ver a distribuição.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataEquipa} margin={{ left: -15, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Coordenação" stackId="b" fill="#7c3aed" />
                  <Bar dataKey="Esp. Em Curso" stackId="b" fill="#0284c7" />
                  <Bar dataKey="Esp. Pendentes" stackId="b" fill="#cbd5e1" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}