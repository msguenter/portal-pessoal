'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { parseProjetoExcel } from '@/lib/projetos/parseExcel';
import ProjetosCharts from '@/components/projetos/ProjetosCharts';
import {
  APROVACOES_PADRAO,
  COM_QUEM_ESTA_OPCOES,
  ESPECIALIDADES_PADRAO,
  ESTADOS_PROJETO,
  FASES_PADRAO,
  calcularDataEntregaFase,
} from '@/lib/projetos/constants';

type Requerente = {
  id: string;
  nome: string;
  sede: string;
  nif: string;
  responsavel: string;
  telemovel: string;
  email: string;
};

type MembroEquipa = {
  id: string;
  nome: string;
  email: string;
  papel: 'coordenador' | 'tecnico';
  ativo: boolean;
};

type ProjetoRow = {
  id: string;
  codigo: string;
  designacao: string;
  contrato: string;
  coordenador: string;
  requerente_id: string | null;
  requerente_nome: string;
  morada: string;
  data_inicio: string | null;
  data_fim: string | null;
  fase_atual: string;
  estado: string;
  com_quem_esta: string[];
  entrega_fase_atual?: string | null;
  registos_count?: number;
  pendentes_count?: number;
  projeto_especialidades?: any[];
};

const ALL_COLUMNS = [
  { key: 'codigo', label: 'Código', defaultVisible: true },
  { key: 'designacao', label: 'Designação', defaultVisible: true },
  { key: 'coordenador', label: 'Coordenador', defaultVisible: true },
  { key: 'fase_atual', label: 'Fase Atual', defaultVisible: true },
  { key: 'estado', label: 'Estado', defaultVisible: true },
  { key: 'com_quem_esta', label: 'Com quem está', defaultVisible: true },
  { key: 'data_inicio', label: 'Início', defaultVisible: true },
  { key: 'entrega_fase_atual', label: 'Entrega Fase Atual', defaultVisible: true },
  { key: 'requerente_nome', label: 'Dono de Obra', defaultVisible: false },
  { key: 'registos_count', label: 'Registos', defaultVisible: false },
] as const;

type ColumnKey = (typeof ALL_COLUMNS)[number]['key'];

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [requerentes, setRequerentes] = useState<Requerente[]>([]);
  const [equipa, setEquipa] = useState<MembroEquipa[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Painéis recolhíveis e modais
  const [chartsOpen, setChartsOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [equipaModalOpen, setEquipaModalOpen] = useState(false);

  // Estado do disparo manual de emails
  const [sendingReport, setSendingReport] = useState(false);
  const [reportLogs, setReportLogs] = useState<string[]>([]);
  const [novoMembro, setNovoMembro] = useState({
    nome: '',
    email: '',
    papel: 'tecnico' as 'coordenador' | 'tecnico',
  });

  // Filtros
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('TODOS');
  const [faseFilter, setFaseFilter] = useState('TODAS');
  const [coordenadorFilter, setCoordenadorFilter] = useState('TODOS');
  const [comQuemFilter, setComQuemFilter] = useState('TODOS');

  // Colunas visíveis
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(() => {
    const initial = {} as Record<ColumnKey, boolean>;
    ALL_COLUMNS.forEach((c) => (initial[c.key] = c.defaultVisible));
    return initial;
  });

  // Formulário Novo Projeto
  const [novoProj, setNovoProj] = useState({
    codigo: '',
    designacao: '',
    contrato: '',
    coordenador: '',
    morada: '',
    data_inicio: new Date().toISOString().split('T')[0],
    fase_atual: 'Levantamento',
    estado: 'Não iniciada',
    com_quem_esta: ['ARCOS'] as string[],
    requerente_id: 'NOVO',
    req_nome: '',
    req_nif: '',
    req_responsavel: '',
    req_telemovel: '',
    req_email: '',
    req_sede: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('portal_projetos_cols_v2');
    if (saved) {
      try {
        setVisibleCols((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch {}
    }
    fetchAll();
  }, []);

  function toggleColumn(key: ColumnKey) {
    setVisibleCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('portal_projetos_cols_v2', JSON.stringify(next));
      return next;
    });
  }

  async function fetchAll() {
    setLoading(true);
    const [{ data: projs }, { data: reqs }, { data: eq }] = await Promise.all([
      supabase
        .from('projetos')
        .select('*, projeto_prazos(*), projeto_especialidades(*), projeto_registos(id, data_resolucao)')
        .order('codigo', { ascending: false }),
      supabase.from('requerentes').select('*').order('nome'),
      supabase.from('equipa').select('*').order('nome'),
    ]);

    if (reqs) setRequerentes(reqs);
    if (eq) setEquipa(eq);

    if (projs) {
      const mapped: ProjetoRow[] = projs.map((p: any) => {
        const regs = p.projeto_registos || [];
        const prazos = p.projeto_prazos || [];
        const faseObj = prazos.find(
          (pr: any) => pr.fase?.toLowerCase() === p.fase_atual?.toLowerCase()
        );
        const entregaFase = faseObj
          ? calcularDataEntregaFase(
              faseObj.data_inicio,
              faseObj.data_fim,
              faseObj.prazo_contrato_dias,
              faseObj.prorrogacao_dias
            )
          : null;

        return {
          ...p,
          com_quem_esta: Array.isArray(p.com_quem_esta) ? p.com_quem_esta : [],
          entrega_fase_atual: entregaFase,
          registos_count: regs.length,
          pendentes_count: regs.filter((r: any) => !r.data_resolucao).length,
        };
      });
      setProjetos(mapped);
    }
    setLoading(false);
  }

  // Gestão de Equipa
  async function handleAddMembro(e: React.FormEvent) {
    e.preventDefault();
    if (!novoMembro.nome.trim() || !novoMembro.email.trim()) return;
    const { error } = await supabase.from('equipa').insert({
      nome: novoMembro.nome.trim(),
      email: novoMembro.email.trim(),
      papel: novoMembro.papel,
      ativo: true,
    });
    if (error) {
      alert(`Erro ao adicionar membro: ${error.message}`);
    } else {
      setNovoMembro({ nome: '', email: '', papel: 'tecnico' });
      fetchAll();
    }
  }

  async function toggleMembroAtivo(m: MembroEquipa) {
    await supabase.from('equipa').update({ ativo: !m.ativo }).eq('id', m.id);
    fetchAll();
  }

  async function handleDispararEmails(emailUnico?: string) {
    const msg = emailUnico
      ? `Enviar relatório de teste agora para ${emailUnico}?`
      : 'Disparar agora os emails de relatório diário para toda a equipa ativa?';
    if (!confirm(msg)) return;

    setSendingReport(true);
    setReportLogs([]);
    try {
      const res = await fetch('/api/cron/daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailUnico }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Falha no envio.');
      }
      setReportLogs(data.detalhes || [`${data.enviados} email(s) enviado(s).`]);
    } catch (err: any) {
      alert(`Erro ao disparar emails: ${err.message}`);
    } finally {
      setSendingReport(false);
    }
  }

  // Edição rápida na tabela inicial
  async function updateProjetoInline(id: string, patch: Partial<ProjetoRow>) {
    setProjetos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await supabase.from('projetos').update(patch).eq('id', id);
    if (patch.fase_atual) {
      await fetchAll();
    }
  }

  function toggleComQuemInline(proj: ProjetoRow, entidade: string) {
    const atual = proj.com_quem_esta || [];
    const proximo = atual.includes(entidade)
      ? atual.filter((item) => item !== entidade)
      : [...atual, entidade];
    updateProjetoInline(proj.id, { com_quem_esta: proximo });
  }

  // Criar Novo Projeto Manualmente
  async function handleCreateManual(e: React.FormEvent) {
    e.preventDefault();
    try {
      let reqId = novoProj.requerente_id !== 'NOVO' ? novoProj.requerente_id : null;
      let reqSnapshot = {
        requerente_nome: novoProj.req_nome,
        requerente_nif: novoProj.req_nif,
        requerente_responsavel: novoProj.req_responsavel,
        requerente_telemovel: novoProj.req_telemovel,
        requerente_email: novoProj.req_email,
        requerente_sede: novoProj.req_sede,
      };

      if (reqId) {
        const found = requerentes.find((r) => r.id === reqId);
        if (found) {
          reqSnapshot = {
            requerente_nome: found.nome,
            requerente_nif: found.nif || '',
            requerente_responsavel: found.responsavel || '',
            requerente_telemovel: found.telemovel || '',
            requerente_email: found.email || '',
            requerente_sede: found.sede || '',
          };
        }
      } else if (novoProj.req_nome.trim()) {
        const { data: createdReq, error: reqErr } = await supabase
          .from('requerentes')
          .insert({
            nome: novoProj.req_nome.trim(),
            nif: novoProj.req_nif.trim() || null,
            responsavel: novoProj.req_responsavel.trim(),
            telemovel: novoProj.req_telemovel.trim(),
            email: novoProj.req_email.trim(),
            sede: novoProj.req_sede.trim(),
          })
          .select('id')
          .single();
        if (reqErr) throw reqErr;
        reqId = createdReq.id;
      }

      const { data: createdProj, error: projErr } = await supabase
        .from('projetos')
        .insert({
          codigo: novoProj.codigo.trim().toUpperCase(),
          designacao: novoProj.designacao.trim(),
          contrato: novoProj.contrato.trim() || novoProj.designacao.trim(),
          coordenador: novoProj.coordenador.trim(),
          morada: novoProj.morada.trim(),
          data_inicio: novoProj.data_inicio || null,
          fase_atual: novoProj.fase_atual,
          estado: novoProj.estado,
          com_quem_esta: novoProj.com_quem_esta,
          requerente_id: reqId,
          ...reqSnapshot,
        })
        .select('id')
        .single();

      if (projErr || !createdProj) throw projErr;

      await Promise.all([
        supabase.from('projeto_prazos').insert(
          FASES_PADRAO.map((f) => ({
            projeto_id: createdProj.id,
            ordem: f.ordem,
            fase: f.nome,
            data_inicio: f.nome === novoProj.fase_atual ? novoProj.data_inicio || null : null,
            data_fim:
              f.nome === novoProj.fase_atual
                ? calcularDataEntregaFase(novoProj.data_inicio, null, f.prazo_contrato_dias, 0)
                : null,
            prazo_contrato_dias: f.prazo_contrato_dias,
            prorrogacao_dias: 0,
          }))
        ),
        supabase.from('projeto_especialidades').insert(
          ESPECIALIDADES_PADRAO.map((esp, idx) => ({
            projeto_id: createdProj.id,
            ordem: idx + 1,
            especialidade: esp,
            aplicavel: !esp.toLowerCase().includes('gás'),
            estado: 'Pendente',
          }))
        ),
        supabase.from('projeto_aprovacoes').insert(
          APROVACOES_PADRAO.map((nome, idx) => ({
            projeto_id: createdProj.id,
            ordem: idx + 1,
            nome,
            aplicavel: false,
            estado: 'Pendente',
          }))
        ),
      ]);

      setNewModalOpen(false);
      await fetchAll();
    } catch (err: any) {
      alert(`Erro ao criar projeto: ${err.message}`);
    }
  }

  // Importação .xlsx
  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await parseProjetoExcel(file);
      if (!parsed.projeto.codigo) throw new Error('Código do projeto não encontrado na célula A6 da aba Capa.');

      let reqId: string | null = null;
      if (parsed.projeto.requerente_nome && parsed.projeto.requerente_nif) {
        const { data: reqData } = await supabase
          .from('requerentes')
          .upsert(
            {
              nome: parsed.projeto.requerente_nome,
              sede: parsed.projeto.requerente_sede,
              nif: parsed.projeto.requerente_nif,
              responsavel: parsed.projeto.requerente_responsavel,
              telemovel: parsed.projeto.requerente_telemovel,
              email: parsed.projeto.requerente_email,
            },
            { onConflict: 'nif' }
          )
          .select('id')
          .single();
        reqId = reqData?.id || null;
      }

      const { data: projData, error: projErr } = await supabase
        .from('projetos')
        .upsert(
          {
            ...parsed.projeto,
            requerente_id: reqId,
          },
          { onConflict: 'codigo' }
        )
        .select('id')
        .single();

      if (projErr || !projData) throw projErr || new Error('Erro ao guardar projeto.');
      const projetoId = projData.id;

      await Promise.all([
        supabase.from('projeto_prazos').delete().eq('projeto_id', projetoId),
        supabase.from('projeto_especialidades').delete().eq('projeto_id', projetoId),
        supabase.from('projeto_registos').delete().eq('projeto_id', projetoId),
      ]);

      const { count: aprovCount } = await supabase
        .from('projeto_aprovacoes')
        .select('*', { count: 'exact', head: true })
        .eq('projeto_id', projetoId);

      await Promise.all([
        parsed.prazos.length > 0
          ? supabase.from('projeto_prazos').insert(parsed.prazos.map((i) => ({ ...i, projeto_id: projetoId })))
          : Promise.resolve(),
        parsed.especialidades.length > 0
          ? supabase
              .from('projeto_especialidades')
              .insert(parsed.especialidades.map((i) => ({ ...i, projeto_id: projetoId })))
          : Promise.resolve(),
        parsed.registos.length > 0
          ? supabase.from('projeto_registos').insert(parsed.registos.map((i) => ({ ...i, projeto_id: projetoId })))
          : Promise.resolve(),
        (aprovCount || 0) === 0
          ? supabase
              .from('projeto_aprovacoes')
              .insert(parsed.aprovacoes.map((i) => ({ ...i, projeto_id: projetoId })))
          : Promise.resolve(),
      ]);

      await fetchAll();
      alert(`Projeto ${parsed.projeto.codigo} importado com sucesso (${parsed.registos.length} registos).`);
    } catch (err: any) {
      alert(`Erro na importação: ${err.message}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  const coordenadoresUnicos = useMemo(
    () =>
      Array.from(
        new Set([...equipa.map((m) => m.nome), ...projetos.map((p) => p.coordenador)].filter(Boolean))
      ),
    [projetos, equipa]
  );

  const filteredProjetos = useMemo(() => {
    return projetos.filter((p) => {
      if (estadoFilter !== 'TODOS' && p.estado !== estadoFilter) return false;
      if (faseFilter !== 'TODAS' && p.fase_atual !== faseFilter) return false;
      if (coordenadorFilter !== 'TODOS' && p.coordenador !== coordenadorFilter) return false;
      if (comQuemFilter !== 'TODOS' && !(p.com_quem_esta || []).includes(comQuemFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          p.codigo?.toLowerCase().includes(q) ||
          p.designacao?.toLowerCase().includes(q) ||
          p.coordenador?.toLowerCase().includes(q) ||
          p.requerente_nome?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [projetos, search, estadoFilter, faseFilter, coordenadorFilter, comQuemFilter]);

  const activeFiltersCount = [
    search.trim() !== '',
    estadoFilter !== 'TODOS',
    faseFilter !== 'TODAS',
    coordenadorFilter !== 'TODOS',
    comQuemFilter !== 'TODOS',
  ].filter(Boolean).length;

  function badgePrazoEntrega(dataStr: string | null | undefined) {
    if (!dataStr) return <span className="text-slate-400">—</span>;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const entrega = new Date(`${dataStr}T00:00:00`);
    const diffDias = Math.ceil((entrega.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-700" title="Prazo ultrapassado">
          {dataStr} ({Math.abs(diffDias)}d atraso)
        </span>
      );
    }
    if (diffDias <= 7) {
      return (
        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800" title="Vence em breve">
          {dataStr} ({diffDias}d)
        </span>
      );
    }
    return <span className="text-slate-700 font-medium">{dataStr}</span>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projetos ARCOS</h1>
          <p className="text-sm text-slate-500">Resumo de coordenação, prazos, responsabilidades e comunicações</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setChartsOpen((v) => !v)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
          >
            <span>Gráficos</span>
            <span className="text-xs">{chartsOpen ? '▲' : '▼'}</span>
          </button>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
          >
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-600 text-white">
                {activeFiltersCount}
              </span>
            )}
            <span className="text-xs">{filtersOpen ? '▲' : '▼'}</span>
          </button>

          <button
            type="button"
            onClick={() => setColumnsOpen((v) => !v)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
          >
            <span>Colunas</span>
            <span className="text-xs">{columnsOpen ? '▲' : '▼'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReportLogs([]);
              setEquipaModalOpen(true);
            }}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800"
          >
            Equipa & Emails
          </button>

          <button
            type="button"
            onClick={() => setNewModalOpen(true)}
            className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-900"
          >
            + Novo Projeto
          </button>

          <label className="cursor-pointer px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition">
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

      {/* Painel Recolhível: Gráficos & KPIs */}
      {chartsOpen && !loading && (
        <ProjetosCharts projetos={projetos} equipa={equipa} />
      )}

      {/* Painel Recolhível: Filtros */}
      {filtersOpen && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm grid grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Pesquisar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código, designação..."
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Coordenador</label>
            <select
              value={coordenadorFilter}
              onChange={(e) => setCoordenadorFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="TODOS">Todos</option>
              {coordenadoresUnicos.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Fase Atual</label>
            <select
              value={faseFilter}
              onChange={(e) => setFaseFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="TODAS">Todas as fases</option>
              {FASES_PADRAO.map((f) => (
                <option key={f.nome} value={f.nome}>{f.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
            <select
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="TODOS">Todos os estados</option>
              {ESTADOS_PROJETO.map((est) => (
                <option key={est} value={est}>{est}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Com quem está</label>
            <select
              value={comQuemFilter}
              onChange={(e) => setComQuemFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="TODOS">Qualquer entidade</option>
              {COM_QUEM_ESTA_OPCOES.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Painel Recolhível: Seletor de Colunas */}
      {columnsOpen && (
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="text-xs font-semibold text-slate-600 mb-2">Colunas visíveis na tabela:</div>
          <div className="flex flex-wrap gap-4">
            {ALL_COLUMNS.map((col) => (
              <label key={col.key} className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!visibleCols[col.key]}
                  onChange={() => toggleColumn(col.key)}
                  className="rounded border-slate-300 text-slate-900"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Equipa & Disparo de Relatórios por Email */}
      {equipaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Equipa ARCOS & Relatórios por Email</h2>
                <p className="text-xs text-slate-500">
                  Envio automático de Seg a Sex às 09h00 + disparo manual imediato
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEquipaModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm text-slate-900">Disparo Manual Imediato</div>
                <div className="text-xs text-slate-600">
                  Envia agora o relatório de pendências para cada técnico ativo e o consolidado para o(s) coordenador(es).
                </div>
              </div>
              <button
                type="button"
                disabled={sendingReport}
                onClick={() => handleDispararEmails()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap disabled:opacity-50"
              >
                {sendingReport ? 'A enviar...' : 'Disparar Emails Agora'}
              </button>
            </div>

            {reportLogs.length > 0 && (
              <div className="p-3 rounded-lg bg-slate-900 text-slate-100 text-xs space-y-1 font-mono">
                {reportLogs.map((l, idx) => (
                  <div key={idx}>• {l}</div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddMembro} className="grid grid-cols-4 gap-2">
              <input
                required
                placeholder="Nome (ex: Roberta Marquardt)"
                value={novoMembro.nome}
                onChange={(e) => setNovoMembro({ ...novoMembro, nome: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={novoMembro.email}
                onChange={(e) => setNovoMembro({ ...novoMembro, email: e.target.value })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
              <select
                value={novoMembro.papel}
                onChange={(e) => setNovoMembro({ ...novoMembro, papel: e.target.value as any })}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="tecnico">Técnico</option>
                <option value="coordenador">Coordenador (Recebe tudo)</option>
              </select>
              <button type="submit" className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white">
                + Adicionar
              </button>
            </form>

            <div className="border rounded-xl overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Papel</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipa.map((m) => (
                    <tr key={m.id} className={m.ativo ? '' : 'opacity-50'}>
                      <td className="px-3 py-2 font-medium text-slate-900">{m.nome}</td>
                      <td className="px-3 py-2 text-slate-600">{m.email}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            m.papel === 'coordenador'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {m.papel === 'coordenador' ? 'Coordenador' : 'Técnico'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={sendingReport}
                          onClick={() => handleDispararEmails(m.email)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Testar envio
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleMembroAtivo(m)}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          {m.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {equipa.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        Nenhum membro cadastrado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Projeto Manual */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateManual}
            className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl my-8"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Novo Projeto (Bases do Escritório)</h2>
              <button type="button" onClick={() => setNewModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Código *</label>
                <input
                  required
                  placeholder="ex: P391"
                  value={novoProj.codigo}
                  onChange={(e) => setNovoProj({ ...novoProj, codigo: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Coordenador</label>
                <select
                  value={novoProj.coordenador}
                  onChange={(e) => setNovoProj({ ...novoProj, coordenador: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">Selecionar...</option>
                  {equipa.filter((m) => m.ativo).map((m) => (
                    <option key={m.id} value={m.nome}>{m.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data de Início</label>
                <input
                  type="date"
                  value={novoProj.data_inicio}
                  onChange={(e) => setNovoProj({ ...novoProj, data_inicio: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Designação do Projeto *</label>
              <input
                required
                placeholder="ex: Remodelação e Ampliação da EB/JI Prime"
                value={novoProj.designacao}
                onChange={(e) => setNovoProj({ ...novoProj, designacao: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Morada do Projeto</label>
              <input
                placeholder="Morada da obra / intervenção"
                value={novoProj.morada}
                onChange={(e) => setNovoProj({ ...novoProj, morada: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase">Base 02 • Requerente / Dono de Obra</div>
              <select
                value={novoProj.requerente_id}
                onChange={(e) => setNovoProj({ ...novoProj, requerente_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="NOVO">+ Registar novo Requerente / Dono de Obra</option>
                {requerentes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome} {r.nif ? `(NIF: ${r.nif})` : ''}
                  </option>
                ))}
              </select>

              {novoProj.requerente_id === 'NOVO' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    placeholder="Nome do Dono de Obra"
                    value={novoProj.req_nome}
                    onChange={(e) => setNovoProj({ ...novoProj, req_nome: e.target.value })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                  <input
                    placeholder="NIF"
                    value={novoProj.req_nif}
                    onChange={(e) => setNovoProj({ ...novoProj, req_nif: e.target.value })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                  <input
                    placeholder="Pessoa Responsável"
                    value={novoProj.req_responsavel}
                    onChange={(e) => setNovoProj({ ...novoProj, req_responsavel: e.target.value })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                  <input
                    placeholder="Telefone"
                    value={novoProj.req_telemovel}
                    onChange={(e) => setNovoProj({ ...novoProj, req_telemovel: e.target.value })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                  <input
                    placeholder="Email"
                    value={novoProj.req_email}
                    onChange={(e) => setNovoProj({ ...novoProj, req_email: e.target.value })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                  <input
                    placeholder="Morada / Sede do Requerente"
                    value={novoProj.req_sede}
                    onChange={(e) => setNovoProj({ ...novoProj, req_sede: e.target.value })}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewModalOpen(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700"
              >
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white">
                Criar Projeto
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela Principal */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-600 font-semibold">
            <tr>
              {ALL_COLUMNS.filter((c) => visibleCols[c.key]).map((col) => (
                <th key={col.key} className="px-3.5 py-3 text-left whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  A carregar projetos...
                </td>
              </tr>
            ) : filteredProjetos.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                  Nenhum projeto encontrado. Cria um novo projeto ou importa um <code>Registos de Projecto.xlsx</code>.
                </td>
              </tr>
            ) : (
              filteredProjetos.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition">
                  {visibleCols.codigo && (
                    <td className="px-3.5 py-3 font-bold whitespace-nowrap">
                      <Link href={`/projetos/${p.id}`} className="text-blue-600 hover:underline">
                        {p.codigo}
                      </Link>
                    </td>
                  )}
                  {visibleCols.designacao && (
                    <td className="px-3.5 py-3 font-medium text-slate-900 min-w-[200px]">
                      <Link href={`/projetos/${p.id}`} className="hover:text-blue-600">
                        {p.designacao}
                      </Link>
                    </td>
                  )}
                  {visibleCols.coordenador && (
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <select
                        value={p.coordenador || ''}
                        onChange={(e) => updateProjetoInline(p.id, { coordenador: e.target.value })}
                        className="px-2 py-1 text-xs rounded-md border border-slate-200 bg-white text-slate-700"
                      >
                        <option value="">Definir...</option>
                        {coordenadoresUnicos.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {visibleCols.fase_atual && (
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <select
                        value={p.fase_atual || 'Levantamento'}
                        onChange={(e) => updateProjetoInline(p.id, { fase_atual: e.target.value })}
                        className="px-2 py-1 text-xs font-medium rounded-md border border-slate-200 bg-slate-50 text-slate-800"
                      >
                        {FASES_PADRAO.map((f) => (
                          <option key={f.nome} value={f.nome}>{f.nome}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {visibleCols.estado && (
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <select
                        value={p.estado || 'Não iniciada'}
                        onChange={(e) => updateProjetoInline(p.id, { estado: e.target.value })}
                        className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                          p.estado === 'Concluído'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : p.estado === 'Aguarda resposta DO'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : p.estado === 'Em andamento'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {ESTADOS_PROJETO.map((est) => (
                          <option key={est} value={est}>{est}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {visibleCols.com_quem_esta && (
                    <td className="px-3.5 py-3">
                      <div className="flex flex-wrap gap-1 min-w-[190px]">
                        {COM_QUEM_ESTA_OPCOES.map((op) => {
                          const ativo = (p.com_quem_esta || []).includes(op);
                          return (
                            <button
                              key={op}
                              type="button"
                              onClick={() => toggleComQuemInline(p, op)}
                              className={`px-2 py-0.5 text-[11px] font-medium rounded-md border transition ${
                                ativo
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700'
                              }`}
                            >
                              {op}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                  {visibleCols.data_inicio && (
                    <td className="px-3.5 py-3 text-slate-600 whitespace-nowrap">{p.data_inicio || '—'}</td>
                  )}
                  {visibleCols.entrega_fase_atual && (
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      {badgePrazoEntrega(p.entrega_fase_atual)}
                    </td>
                  )}
                  {visibleCols.requerente_nome && (
                    <td className="px-3.5 py-3 text-slate-600">{p.requerente_nome || '—'}</td>
                  )}
                  {visibleCols.registos_count && (
                    <td className="px-3.5 py-3 whitespace-nowrap text-slate-700">
                      {p.registos_count}
                      {p.pendentes_count ? (
                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-800">
                          {p.pendentes_count}
                        </span>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}