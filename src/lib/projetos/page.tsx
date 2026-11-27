'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { parseProjetoExcel } from '@/lib/projetos/parseExcel';

type ProjetoRow = {
  id: string;
  codigo: string;
  designacao: string;
  contrato: string;
  requerente_nome: string;
  requerente_responsavel: string;
  morada: string;
  num_processo: string;
  data_inicio: string | null;
  data_fim: string | null;
  fase_atual: string;
  estado: string;
  registos_count?: number;
  pendentes_count?: number;
};

const ALL_COLUMNS = [
  { key: 'codigo', label: 'Código', defaultVisible: true },
  { key: 'designacao', label: 'Designação', defaultVisible: true },
  { key: 'requerente_nome', label: 'Requerente / DO', defaultVisible: true },
  { key: 'fase_atual', label: 'Fase Atual', defaultVisible: true },
  { key: 'estado', label: 'Estado', defaultVisible: true },
  { key: 'data_inicio', label: 'Início', defaultVisible: true },
  { key: 'registos_count', label: 'Registos (Pendentes)', defaultVisible: true },
  { key: 'requerente_responsavel', label: 'Responsável DO', defaultVisible: false },
  { key: 'morada', label: 'Morada', defaultVisible: false },
  { key: 'num_processo', label: 'Nº Processo', defaultVisible: false },
  { key: 'data_fim', label: 'Fim / Aprovação', defaultVisible: false },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]['key'];

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Painéis recolhíveis
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Estados dos filtros
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');
  const [faseFilter, setFaseFilter] = useState('TODAS');
  const [requerenteFilter, setRequerenteFilter] = useState('TODOS');

  // Colunas visíveis
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    const initial = {} as Record<ColumnKey, boolean>;
    ALL_COLUMNS.forEach((c) => (initial[c.key] = c.defaultVisible));
    return initial;
  });

  useEffect(() => {
    const saved = localStorage.getItem('portal_projetos_cols');
    if (saved) {
      try {
        setVisibleCols((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch {}
    }
    fetchProjetos();
  }, []);

  function toggleColumn(key: ColumnKey) {
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('portal_projetos_cols', JSON.stringify(next));
      return next;
    });
  }

  async function fetchProjetos() {
    setLoading(true);
    const { data, error } = await supabase
      .from('projetos')
      .select('*, projeto_registos(id, data_resolucao)')
      .order('codigo', { ascending: false });

    if (!error && data) {
      const mapped = data.map((p: any) => {
        const regs = p.projeto_registos || [];
        const pendentes = regs.filter((r: any) => !r.data_resolucao).length;
        return {
          ...p,
          registos_count: regs.length,
          pendentes_count: pendentes,
        };
      });
      setProjetos(mapped);
    }
    setLoading(false);
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseProjetoExcel(file);
      if (!parsed.projeto.codigo) throw new Error('Código do projeto não encontrado na célula A6 da aba Capa.');

      // 1. Upsert Projeto
      const { data: projData, error: projErr } = await supabase
        .from('projetos')
        .upsert(parsed.projeto, { onConflict: 'codigo' })
        .select('id')
        .single();

      if (projErr || !projData) throw projErr || new Error('Erro ao guardar projeto.');
      const projetoId = projData.id;

      // 2. Limpar e reinserir Prazos, Especialidades e Registos desta folha
      await Promise.all([
        supabase.from('projeto_prazos').delete().eq('projeto_id', projetoId),
        supabase.from('projeto_especialidades').delete().eq('projeto_id', projetoId),
        supabase.from('projeto_registos').delete().eq('projeto_id', projetoId),
      ]);

      if (parsed.prazos.length > 0) {
        await supabase.from('projeto_prazos').insert(
          parsed.prazos.map((item) => ({ ...item, projeto_id: projetoId }))
        );
      }
      if (parsed.especialidades.length > 0) {
        await supabase.from('projeto_especialidades').insert(
          parsed.especialidades.map((item) => ({ ...item, projeto_id: projetoId }))
        );
      }
      if (parsed.registos.length > 0) {
        await supabase.from('projeto_registos').insert(
          parsed.registos.map((item) => ({ ...item, projeto_id: projetoId }))
        );
      }

      await fetchProjetos();
      alert(`Projeto ${parsed.projeto.codigo} importado com sucesso (${parsed.registos.length} registos).`);
    } catch (err: any) {
      alert(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  const requerentesUnicos = useMemo(
    () => Array.from(new Set(projetos.map((p) => p.requerente_nome).filter(Boolean))),
    [projetos]
  );

  const fasesUnicas = useMemo(
    () => Array.from(new Set(projetos.map((p) => p.fase_atual).filter(Boolean))),
    [projetos]
  );

  const filteredProjetos = useMemo(() => {
    return projetos.filter((p) => {
      if (estadoFilter !== 'TODOS' && p.estado !== estadoFilter) return false;
      if (faseFilter !== 'TODAS' && p.fase_atual !== faseFilter) return false;
      if (requerenteFilter !== 'TODOS' && p.requerente_nome !== requerenteFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          p.codigo?.toLowerCase().includes(q) ||
          p.designacao?.toLowerCase().includes(q) ||
          p.requerente_nome?.toLowerCase().includes(q) ||
          p.morada?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [projetos, search, estadoFilter, faseFilter, requerenteFilter]);

  const activeFiltersCount = [
    search.trim() !== '',
    estadoFilter !== 'TODOS',
    faseFilter !== 'TODAS',
    requerenteFilter !== 'TODOS',
  ].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projetos</h1>
          <p className="text-sm text-slate-500">Coordenação, prazos, especialidades e registos de comunicação</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Filtros Recolhível */}
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2"
          >
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-600 text-white">
                {activeFiltersCount}
              </span>
            )}
            <span className="text-xs">{filtersOpen ? '▲' : '▼'}</span>
          </button>

          {/* Botão Colunas Recolhível */}
          <button
            type="button"
            onClick={() => setColumnsOpen((v) => !v)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2"
          >
            <span>Colunas</span>
            <span className="text-xs">{columnsOpen ? '▲' : '▼'}</span>
          </button>

          {/* Importar Excel */}
          <label className="cursor-pointer px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition">
            {importing ? 'A importar...' : '+ Importar .xlsx'}
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              disabled={importing}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Painel Recolhível: Filtros */}
      {filtersOpen && (
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pesquisar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, escola, morada..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="TODOS">Todos os estados</option>
              <option value="Em Curso">Em Curso</option>
              <option value="Concluído">Concluído</option>
              <option value="Suspenso">Suspenso</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Fase Atual</label>
            <select
              value={faseFilter}
              onChange={(e) => setFaseFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="TODAS">Todas as fases</option>
              {fasesUnicas.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Requerente / DO</label>
            <select
              value={requerenteFilter}
              onChange={(e) => setRequerenteFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="TODOS">Todos</option>
              {requerentesUnicos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Painel Recolhível: Seletor de Colunas */}
      {columnsOpen && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-semibold text-slate-600 mb-2">Colunas visíveis na tabela:</div>
          <div className="flex flex-wrap gap-3">
            {ALL_COLUMNS.map((col) => (
              <label key={col.key} className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!visibleCols[col.key]}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de Projetos */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold">
            <tr>
              {ALL_COLUMNS.filter((c) => visibleCols[c.key]).map((col) => (
                <th key={col.key} className="px-4 py-3 text-left whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                  A carregar projetos...
                </td>
              </tr>
            ) : filteredProjetos.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  Nenhum projeto encontrado. Importa um ficheiro <code>Registos de Projecto.xlsx</code> acima.
                </td>
              </tr>
            ) : (
              filteredProjetos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  {visibleCols.codigo && (
                    <td className="px-4 py-3 font-bold whitespace-nowrap">
                      <Link href={`/projetos/${p.id}`} className="text-blue-600 hover:underline">
                        {p.codigo}
                      </Link>
                    </td>
                  )}
                  {visibleCols.designacao && (
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/projetos/${p.id}`} className="hover:text-blue-600">
                        {p.designacao}
                      </Link>
                    </td>
                  )}
                  {visibleCols.requerente_nome && <td className="px-4 py-3 text-slate-600">{p.requerente_nome}</td>}
                  {visibleCols.fase_atual && (
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700">
                        {p.fase_atual}
                      </span>
                    </td>
                  )}
                  {visibleCols.estado && (
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                        {p.estado}
                      </span>
                    </td>
                  )}
                  {visibleCols.data_inicio && (
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.data_inicio || '—'}</td>
                  )}
                  {visibleCols.registos_count && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{p.registos_count}</span>
                      {p.pendentes_count ? (
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-800">
                          {p.pendentes_count} abertos
                        </span>
                      ) : null}
                    </td>
                  )}
                  {visibleCols.requerente_responsavel && (
                    <td className="px-4 py-3 text-slate-600">{p.requerente_responsavel || '—'}</td>
                  )}
                  {visibleCols.morada && <td className="px-4 py-3 text-slate-600">{p.morada || '—'}</td>}
                  {visibleCols.num_processo && <td className="px-4 py-3 text-slate-600">{p.num_processo || '—'}</td>}
                  {visibleCols.data_fim && <td className="px-4 py-3 text-slate-600">{p.data_fim || '—'}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}