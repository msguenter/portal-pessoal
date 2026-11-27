'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ProjetoDetalhePage() {
  const { id } = useParams<{ id: string }>();

  const [projeto, setProjeto] = useState<any>(null);
  const [prazos, setPrazos] = useState<any[]>([]);
  const [especialidades, setEspecialidades] = useState<any[]>([]);
  const [registos, setRegistos] = useState<any[]>([]);
  const [tab, setTab] = useState<'registos' | 'capa' | 'especialidades'>('registos');

  // Filtro de comunicações
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  // Novo registo
  const [form, setForm] = useState({
    ref: '',
    levantado_por: 'EP',
    especialidade: '',
    data_registo: new Date().toISOString().split('T')[0],
    tipo_comunicacao: 'Email',
    assunto: '',
    atribuido_a: 'DO',
    resolucao_observacoes: '',
  });

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  async function loadAll() {
    const [{ data: p }, { data: pr }, { data: esp }, { data: reg }] = await Promise.all([
      supabase.from('projetos').select('*').eq('id', id).single(),
      supabase.from('projeto_prazos').select('*').eq('projeto_id', id).order('ordem'),
      supabase.from('projeto_especialidades').select('*').eq('projeto_id', id).order('ordem'),
      supabase.from('projeto_registos').select('*').eq('projeto_id', id).order('data_registo', { ascending: false }),
    ]);

    setProjeto(p);
    setPrazos(pr || []);
    setEspecialidades(esp || []);
    setRegistos(reg || []);
  }

  async function handleAddRegisto(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('projeto_registos').insert({
      ...form,
      projeto_id: id,
    });
    if (!error) {
      setNewOpen(false);
      setForm({
        ref: '',
        levantado_por: 'EP',
        especialidade: '',
        data_registo: new Date().toISOString().split('T')[0],
        tipo_comunicacao: 'Email',
        assunto: '',
        atribuido_a: 'DO',
        resolucao_observacoes: '',
      });
      loadAll();
    }
  }

  async function toggleResolver(reg: any) {
    const novaData = reg.data_resolucao ? null : new Date().toISOString().split('T')[0];
    await supabase.from('projeto_registos').update({ data_resolucao: novaData }).eq('id', reg.id);
    loadAll();
  }

  if (!projeto) return <div className="p-6 text-slate-500">A carregar projeto...</div>;

  const registosVisiveis = onlyOpen ? registos.filter((r) => !r.data_resolucao) : registos;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Breadcrumb & Cabeçalho */}
      <div>
        <Link href="/projetos" className="text-sm text-blue-600 hover:underline">
          ← Voltar aos Projetos
        </Link>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-sm font-bold rounded bg-slate-900 text-white">
                {projeto.codigo}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{projeto.designacao}</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {projeto.requerente_nome} • Resp.: {projeto.requerente_responsavel} ({projeto.requerente_email})
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-sm font-medium">
        <button
          onClick={() => setTab('registos')}
          className={`pb-2.5 border-b-2 transition ${
            tab === 'registos' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}
        >
          Comunicações & Registos ({registos.length})
        </button>
        <button
          onClick={() => setTab('capa')}
          className={`pb-2.5 border-b-2 transition ${
            tab === 'capa' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}
        >
          Identificação & Prazos
        </button>
        <button
          onClick={() => setTab('especialidades')}
          className={`pb-2.5 border-b-2 transition ${
            tab === 'especialidades' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}
        >
          Especialidades ({especialidades.length})
        </button>
      </div>

      {/* TAB 1: COMUNICAÇÕES / REGISTOS */}
      {tab === 'registos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyOpen}
                onChange={(e) => setOnlyOpen(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Mostrar apenas pendentes (sem data de resolução)</span>
            </label>

            <button
              onClick={() => setNewOpen((v) => !v)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              {newOpen ? 'Cancelar' : '+ Novo Registo / Comunicação'}
            </button>
          </div>

          {newOpen && (
            <form onSubmit={handleAddRegisto} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <input
                  placeholder="Ref. (ex: 5.3)"
                  value={form.ref}
                  onChange={(e) => setForm({ ...form, ref: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                />
                <input
                  type="date"
                  value={form.data_registo}
                  onChange={(e) => setForm({ ...form, data_registo: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                />
                <select
                  value={form.tipo_comunicacao}
                  onChange={(e) => setForm({ ...form, tipo_comunicacao: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Email">Email</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Reunião">Reunião</option>
                  <option value="Nota">Nota Interna</option>
                </select>
                <input
                  placeholder="De (ex: EP_RM)"
                  value={form.levantado_por}
                  onChange={(e) => setForm({ ...form, levantado_por: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                />
                <input
                  placeholder="Para (ex: DO)"
                  value={form.atribuido_a}
                  onChange={(e) => setForm({ ...form, atribuido_a: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Assunto"
                  value={form.assunto}
                  onChange={(e) => setForm({ ...form, assunto: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                />
                <input
                  placeholder="Especialidade / Tema (ex: Prazos, Obra Vãos)"
                  value={form.especialidade}
                  onChange={(e) => setForm({ ...form, especialidade: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <textarea
                rows={4}
                placeholder="Corpo da comunicação / Observações..."
                value={form.resolucao_observacoes}
                onChange={(e) => setForm({ ...form, resolucao_observacoes: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              />
              <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white">
                Guardar Registo
              </button>
            </form>
          )}

          {/* Lista de Comunicações (Timeline Cards) */}
          <div className="space-y-3">
            {registosVisiveis.map((r) => (
              <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-800">
                      Ref. {r.ref || '—'}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{r.data_registo}</span>
                    {r.tipo_comunicacao && (
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700">
                        {r.tipo_comunicacao}
                      </span>
                    )}
                    {r.especialidade && (
                      <span className="px-2 py-0.5 text-xs rounded bg-purple-50 text-purple-700">
                        {r.especialidade}
                      </span>
                    )}
                    {(r.levantado_por || r.atribuido_a) && (
                      <span className="text-xs text-slate-600 font-medium">
                        {r.levantado_por} → {r.atribuido_a}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => toggleResolver(r)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-full border transition ${
                      r.data_resolucao
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {r.data_resolucao ? `Resolvido (${r.data_resolucao})` : 'Pendente • Marcar resolvido'}
                  </button>
                </div>

                <div className="font-semibold text-slate-900">{r.assunto || '(Sem assunto)'}</div>

                {r.resolucao_observacoes && (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {r.resolucao_observacoes}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CAPA & PRAZOS */}
      {tab === 'capa' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-sm">
              <h2 className="font-bold text-slate-900">Identificação do Requerente</h2>
              <p><span className="text-slate-500">Nome:</span> {projeto.requerente_nome}</p>
              <p><span className="text-slate-500">Sede:</span> {projeto.requerente_sede}</p>
              <p><span className="text-slate-500">NIF:</span> {projeto.requerente_nif}</p>
              <p><span className="text-slate-500">Responsável:</span> {projeto.requerente_responsavel}</p>
              <p><span className="text-slate-500">Telemóvel:</span> {projeto.requerente_telemovel}</p>
              <p><span className="text-slate-500">Email:</span> {projeto.requerente_email}</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-sm">
              <h2 className="font-bold text-slate-900">Identificação do Projeto</h2>
              <p><span className="text-slate-500">Contrato:</span> {projeto.contrato}</p>
              <p><span className="text-slate-500">Morada:</span> {projeto.morada}</p>
              <p><span className="text-slate-500">Nº Processo:</span> {projeto.num_processo || '—'}</p>
              <p><span className="text-slate-500">Início (Assinatura):</span> {projeto.data_inicio || '—'}</p>
              <p><span className="text-slate-500">Fim (Aprovação):</span> {projeto.data_fim || '—'}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Fase</th>
                  <th className="px-4 py-3 text-left">Início</th>
                  <th className="px-4 py-3 text-left">Fim</th>
                  <th className="px-4 py-3 text-left">Prazo Contrato (dias)</th>
                  <th className="px-4 py-3 text-left">Prazo Real (dias)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prazos.map((pr) => (
                  <tr key={pr.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{pr.fase}</td>
                    <td className="px-4 py-3 text-slate-600">{pr.data_inicio || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{pr.data_fim || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{pr.prazo_contrato_dias ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{pr.prazo_real_dias ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ESPECIALIDADES */}
      {tab === 'especialidades' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Especialidade</th>
                <th className="px-4 py-3 text-left">Técnico Elaborou</th>
                <th className="px-4 py-3 text-left">Início</th>
                <th className="px-4 py-3 text-left">Fim</th>
                <th className="px-4 py-3 text-left">Técnico Responsável</th>
                <th className="px-4 py-3 text-left">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {especialidades.map((esp) => (
                <tr key={esp.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{esp.especialidade}</td>
                  <td className="px-4 py-3 text-slate-600">{esp.tecnico_elaborou || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{esp.data_inicio || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{esp.data_fim || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{esp.tecnico_responsavel || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{esp.notas || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}