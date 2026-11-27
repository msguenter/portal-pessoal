'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ProjetoFasesGantt from '@/components/projetos/ProjetoFasesGantt';
import {
  COM_QUEM_ESTA_OPCOES,
  ESTADOS_PROJETO,
  FASES_PADRAO,
  calcularDataEntregaFase,
} from '@/lib/projetos/constants';

export default function ProjetoDetalhePage() {
  const { id } = useParams<{ id: string }>();

  const [projeto, setProjeto] = useState<any>(null);
  const [prazos, setPrazos] = useState<any[]>([]);
  const [especialidades, setEspecialidades] = useState<any[]>([]);
  const [aprovacoes, setAprovacoes] = useState<any[]>([]);
  const [registos, setRegistos] = useState<any[]>([]);
  const [equipa, setEquipa] = useState<any[]>([]);
  const [tab, setTab] = useState<'registos' | 'bases' | 'trabalhos' | 'aprovacoes'>('registos');

  const [onlyOpen, setOnlyOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [savingBase, setSavingBase] = useState(false);

  const [form, setForm] = useState({
    ref: '',
    levantado_por: 'EP',
    especialidade: '',
    data_registo: new Date().toISOString().split('T')[0],
    tipo_comunicacao: 'Email',
    assunto: '',
    atribuido_a: 'DO',
    responsavel_equipa: '',
    resolucao_observacoes: '',
  });

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  async function loadAll() {
    const [{ data: p }, { data: pr }, { data: esp }, { data: aprov }, { data: reg }, { data: eq }] =
      await Promise.all([
        supabase.from('projetos').select('*').eq('id', id).single(),
        supabase.from('projeto_prazos').select('*').eq('projeto_id', id).order('ordem'),
        supabase.from('projeto_especialidades').select('*').eq('projeto_id', id).order('ordem'),
        supabase.from('projeto_aprovacoes').select('*').eq('projeto_id', id).order('ordem'),
        supabase.from('projeto_registos').select('*').eq('projeto_id', id).order('data_registo', { ascending: false }),
        supabase.from('equipa').select('*').eq('ativo', true).order('nome'),
      ]);

    if (p) {
      setProjeto({
        ...p,
        com_quem_esta: Array.isArray(p.com_quem_esta) ? p.com_quem_esta : [],
      });
    }
    setPrazos(pr || []);
    setEspecialidades(esp || []);
    setAprovacoes(aprov || []);
    setRegistos(reg || []);
    setEquipa(eq || []);
  }

  async function handleSaveIdentificacao(e: React.FormEvent) {
    e.preventDefault();
    setSavingBase(true);
    await supabase
      .from('projetos')
      .update({
        designacao: projeto.designacao,
        coordenador: projeto.coordenador,
        morada: projeto.morada,
        num_processo: projeto.num_processo,
        data_inicio: projeto.data_inicio || null,
        data_fim: projeto.data_fim || null,
        fase_atual: projeto.fase_atual,
        estado: projeto.estado,
        com_quem_esta: projeto.com_quem_esta,
        requerente_nome: projeto.requerente_nome,
        requerente_sede: projeto.requerente_sede,
        requerente_nif: projeto.requerente_nif,
        requerente_responsavel: projeto.requerente_responsavel,
        requerente_telemovel: projeto.requerente_telemovel,
        requerente_email: projeto.requerente_email,
      })
      .eq('id', id);

    if (projeto.requerente_id) {
      await supabase
        .from('requerentes')
        .update({
          nome: projeto.requerente_nome,
          sede: projeto.requerente_sede,
          nif: projeto.requerente_nif || null,
          responsavel: projeto.requerente_responsavel,
          telemovel: projeto.requerente_telemovel,
          email: projeto.requerente_email,
        })
        .eq('id', projeto.requerente_id);
    }

    setSavingBase(false);
    alert('Bases 01 e 02 atualizadas.');
  }

  async function updateFase(faseId: string, patch: any) {
    const atualizada = prazos.map((pr) => {
      if (pr.id !== faseId) return pr;
      const merged = { ...pr, ...patch };
      if ('data_inicio' in patch || 'prazo_contrato_dias' in patch || 'prorrogacao_dias' in patch) {
        merged.data_fim = calcularDataEntregaFase(
          merged.data_inicio,
          null,
          merged.prazo_contrato_dias,
          merged.prorrogacao_dias
        );
      }
      return merged;
    });
    setPrazos(atualizada);
    const alvo = atualizada.find((pr) => pr.id === faseId);
    if (alvo) {
      await supabase
        .from('projeto_prazos')
        .update({
          data_inicio: alvo.data_inicio || null,
          data_fim: alvo.data_fim || null,
          prazo_contrato_dias: alvo.prazo_contrato_dias,
          prorrogacao_dias: alvo.prorrogacao_dias || 0,
        })
        .eq('id', faseId);
    }
  }

  async function updateEspecialidade(espId: string, patch: any) {
    setEspecialidades((prev) => prev.map((e) => (e.id === espId ? { ...e, ...patch } : e)));
    await supabase.from('projeto_especialidades').update(patch).eq('id', espId);
  }

  async function updateAprovacao(aprovId: string, patch: any) {
    setAprovacoes((prev) => prev.map((a) => (a.id === aprovId ? { ...a, ...patch } : a)));
    await supabase.from('projeto_aprovacoes').update(patch).eq('id', aprovId);
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
        responsavel_equipa: '',
        resolucao_observacoes: '',
      });
      loadAll();
    }
  }

  async function updateRegistoResponsavel(regId: string, responsavel_equipa: string) {
    setRegistos((prev) => prev.map((r) => (r.id === regId ? { ...r, responsavel_equipa } : r)));
    await supabase.from('projeto_registos').update({ responsavel_equipa }).eq('id', regId);
  }

  async function toggleResolver(reg: any) {
    const novaData = reg.data_resolucao ? null : new Date().toISOString().split('T')[0];
    await supabase.from('projeto_registos').update({ data_resolucao: novaData }).eq('id', reg.id);
    loadAll();
  }

  if (!projeto) return <div className="p-6 text-slate-500">A carregar projeto...</div>;

  const registosVisiveis = onlyOpen ? registos.filter((r) => !r.data_resolucao) : registos;
  const espAtivasCount = especialidades.filter((e) => e.aplicavel).length;
  const aprovAtivasCount = aprovacoes.filter((a) => a.aplicavel).length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/projetos" className="text-sm text-blue-600 hover:underline">
          ← Voltar aos Projetos
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-sm font-bold rounded bg-slate-900 text-white">
                {projeto.codigo}
              </span>
              <h1 className="text-2xl font-bold text-slate-900">{projeto.designacao}</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              {projeto.requerente_nome} • Coordenador: <strong>{projeto.coordenador || 'Não definido'}</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setTab('registos')}
          className={`pb-2.5 border-b-2 transition ${
            tab === 'registos' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}
        >
          Comunicações ({registos.length})
        </button>
        <button
          onClick={() => setTab('bases')}
          className={`pb-2.5 border-b-2 transition ${
            tab === 'bases' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}
        >
          01–03 • Identificação & Fases
        </button>
        <button
          onClick={() => setTab('trabalhos')}
          className={`pb-2.5 border-b-2 transition ${
            tab === 'trabalhos' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}
        >
          04 • Trabalhos Envolvidos ({espAtivasCount}/{especialidades.length})
        </button>
        <button
          onClick={() => setTab('aprovacoes')}
          className={`pb-2.5 border-b-2 transition ${
            tab === 'aprovacoes' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500'
          }`}
        >
          05 • Aprovações ({aprovAtivasCount}/{aprovacoes.length})
        </button>
      </div>

      {tab === 'registos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
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
            <form onSubmit={handleAddRegisto} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
              <div className="grid grid-cols-6 gap-3">
                <input
                  placeholder="Ref. (ex: 5.3)"
                  value={form.ref}
                  onChange={(e) => setForm({ ...form, ref: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
                <input
                  type="date"
                  value={form.data_registo}
                  onChange={(e) => setForm({ ...form, data_registo: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300"
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
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
                <input
                  placeholder="Para (ex: DO)"
                  value={form.atribuido_a}
                  onChange={(e) => setForm({ ...form, atribuido_a: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
                <select
                  value={form.responsavel_equipa}
                  onChange={(e) => setForm({ ...form, responsavel_equipa: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">Responsável Equipa...</option>
                  {equipa.map((m) => (
                    <option key={m.id} value={m.nome}>{m.nome}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="Assunto"
                  value={form.assunto}
                  onChange={(e) => setForm({ ...form, assunto: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
                <input
                  placeholder="Especialidade / Tema"
                  value={form.especialidade}
                  onChange={(e) => setForm({ ...form, especialidade: e.target.value })}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>
              <textarea
                rows={4}
                placeholder="Corpo da comunicação / Observações..."
                value={form.resolucao_observacoes}
                onChange={(e) => setForm({ ...form, resolucao_observacoes: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
              <button type="submit" className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white">
                Guardar Registo
              </button>
            </form>
          )}

          <div className="space-y-3">
            {registosVisiveis.map((r) => (
              <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-800">
                      Ref. {r.ref || '—'}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{r.data_registo}</span>
                    {r.tipo_comunicacao && (
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-700">{r.tipo_comunicacao}</span>
                    )}
                    {r.especialidade && (
                      <span className="px-2 py-0.5 text-xs rounded bg-purple-50 text-purple-700">{r.especialidade}</span>
                    )}
                    {(r.levantado_por || r.atribuido_a) && (
                      <span className="text-xs text-slate-600 font-medium">
                        {r.levantado_por} → {r.atribuido_a}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={r.responsavel_equipa || ''}
                      onChange={(e) => updateRegistoResponsavel(r.id, e.target.value)}
                      className="px-2 py-1 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-700"
                    >
                      <option value="">Atribuir equipa...</option>
                      {equipa.map((m) => (
                        <option key={m.id} value={m.nome}>{m.nome}</option>
                      ))}
                    </select>

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

      {tab === 'bases' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveIdentificacao} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-sm">
                <h2 className="font-bold text-slate-900">01 • Identificação do Projeto</h2>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Designação</label>
                  <input
                    value={projeto.designacao || ''}
                    onChange={(e) => setProjeto({ ...projeto, designacao: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Coordenador</label>
                    <select
                      value={projeto.coordenador || ''}
                      onChange={(e) => setProjeto({ ...projeto, coordenador: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">Selecionar...</option>
                      {equipa.map((m) => (
                        <option key={m.id} value={m.nome}>{m.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Data Início</label>
                    <input
                      type="date"
                      value={projeto.data_inicio || ''}
                      onChange={(e) => setProjeto({ ...projeto, data_inicio: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Morada do Projeto</label>
                  <input
                    value={projeto.morada || ''}
                    onChange={(e) => setProjeto({ ...projeto, morada: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Fase Atual</label>
                    <select
                      value={projeto.fase_atual || 'Levantamento'}
                      onChange={(e) => setProjeto({ ...projeto, fase_atual: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    >
                      {FASES_PADRAO.map((f) => (
                        <option key={f.nome} value={f.nome}>{f.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Estado</label>
                    <select
                      value={projeto.estado || 'Não iniciada'}
                      onChange={(e) => setProjeto({ ...projeto, estado: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    >
                      {ESTADOS_PROJETO.map((est) => (
                        <option key={est} value={est}>{est}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Com quem está (seleção múltipla)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COM_QUEM_ESTA_OPCOES.map((op) => {
                      const ativo = (projeto.com_quem_esta || []).includes(op);
                      return (
                        <button
                          key={op}
                          type="button"
                          onClick={() => {
                            const atual = projeto.com_quem_esta || [];
                            const proximo = ativo ? atual.filter((x: string) => x !== op) : [...atual, op];
                            setProjeto({ ...projeto, com_quem_esta: proximo });
                          }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${
                            ativo ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'
                          }`}
                        >
                          {op}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-sm">
                <h2 className="font-bold text-slate-900">02 • Identificação do Requerente / DO</h2>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Dono de Obra</label>
                  <input
                    value={projeto.requerente_nome || ''}
                    onChange={(e) => setProjeto({ ...projeto, requerente_nome: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Pessoa Responsável</label>
                    <input
                      value={projeto.requerente_responsavel || ''}
                      onChange={(e) => setProjeto({ ...projeto, requerente_responsavel: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">NIF</label>
                    <input
                      value={projeto.requerente_nif || ''}
                      onChange={(e) => setProjeto({ ...projeto, requerente_nif: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Telefone</label>
                    <input
                      value={projeto.requerente_telemovel || ''}
                      onChange={(e) => setProjeto({ ...projeto, requerente_telemovel: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Email</label>
                    <input
                      value={projeto.requerente_email || ''}
                      onChange={(e) => setProjeto({ ...projeto, requerente_email: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Morada / Sede</label>
                  <input
                    value={projeto.requerente_sede || ''}
                    onChange={(e) => setProjeto({ ...projeto, requerente_sede: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingBase}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800"
            >
              {savingBase ? 'A guardar...' : 'Guardar Identificação e Requerente'}
            </button>
          </form>

          <ProjetoFasesGantt prazos={prazos} />

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200 font-bold text-sm text-slate-900">
              03 • Fases do Projeto & Prazos Contratuais (Dias Corridos)
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Fase</th>
                  <th className="px-4 py-3 text-left">Prazo Contratual (dias)</th>
                  <th className="px-4 py-3 text-left">Prorrogação (dias)</th>
                  <th className="px-4 py-3 text-left">Data de Início</th>
                  <th className="px-4 py-3 text-left">Data de Fim / Entrega</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prazos.map((pr) => (
                  <tr key={pr.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{pr.fase}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={pr.prazo_contrato_dias ?? ''}
                        onChange={(e) =>
                          updateFase(pr.id, {
                            prazo_contrato_dias: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        className="w-24 px-2 py-1 rounded border border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={pr.prorrogacao_dias ?? 0}
                        onChange={(e) =>
                          updateFase(pr.id, { prorrogacao_dias: Number(e.target.value) || 0 })
                        }
                        className="w-20 px-2 py-1 rounded border border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={pr.data_inicio || ''}
                        onChange={(e) => updateFase(pr.id, { data_inicio: e.target.value || null })}
                        className="px-2 py-1 rounded border border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={pr.data_fim || ''}
                        onChange={(e) => updateFase(pr.id, { data_fim: e.target.value || null })}
                        className="px-2 py-1 rounded border border-slate-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'trabalhos' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <div className="px-4 py-3 border-b border-slate-200 font-bold text-sm text-slate-900">
            04 • Trabalhos Envolvidos (Marcação das Especialidades Necessárias)
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 text-center w-16">Incluir</th>
                <th className="px-4 py-3 text-left">Especialidade</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Responsável Equipa</th>
                <th className="px-4 py-3 text-left">Prazo Específico</th>
                <th className="px-4 py-3 text-left">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {especialidades.map((esp) => (
                <tr key={esp.id} className={esp.aplicavel ? '' : 'bg-slate-50/70 opacity-60'}>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!esp.aplicavel}
                      onChange={(e) => updateEspecialidade(esp.id, { aplicavel: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{esp.especialidade}</td>
                  <td className="px-4 py-3">
                    <select
                      disabled={!esp.aplicavel}
                      value={esp.estado || 'Pendente'}
                      onChange={(e) => updateEspecialidade(esp.id, { estado: e.target.value })}
                      className="px-2 py-1 text-xs rounded border border-slate-300 bg-white"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em curso">Em curso</option>
                      <option value="Entregue">Entregue</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={!esp.aplicavel}
                      value={esp.tecnico_responsavel || ''}
                      onChange={(e) => updateEspecialidade(esp.id, { tecnico_responsavel: e.target.value })}
                      className="px-2 py-1 text-xs rounded border border-slate-300 bg-white w-44"
                    >
                      <option value="">Selecionar...</option>
                      {equipa.map((m) => (
                        <option key={m.id} value={m.nome}>{m.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      disabled={!esp.aplicavel}
                      value={esp.data_fim || ''}
                      onChange={(e) => updateEspecialidade(esp.id, { data_fim: e.target.value || null })}
                      className="px-2 py-1 text-xs rounded border border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      disabled={!esp.aplicavel}
                      placeholder="Observações..."
                      value={esp.notas || ''}
                      onChange={(e) => updateEspecialidade(esp.id, { notas: e.target.value })}
                      className="px-2 py-1 text-xs rounded border border-slate-300 w-44"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'aprovacoes' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <div className="px-4 py-3 border-b border-slate-200 font-bold text-sm text-slate-900">
            05 • Aprovações & Entidades Externas
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3 text-center w-16">Necessário</th>
                <th className="px-4 py-3 text-left">Aprovação / Entidade</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Data Submissão</th>
                <th className="px-4 py-3 text-left">Data Aprovação</th>
                <th className="px-4 py-3 text-left">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aprovacoes.map((ap) => (
                <tr key={ap.id} className={ap.aplicavel ? '' : 'bg-slate-50/70 opacity-60'}>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={!!ap.aplicavel}
                      onChange={(e) => updateAprovacao(ap.id, { aplicavel: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{ap.nome}</td>
                  <td className="px-4 py-3">
                    <select
                      disabled={!ap.aplicavel}
                      value={ap.estado || 'Pendente'}
                      onChange={(e) => updateAprovacao(ap.id, { estado: e.target.value })}
                      className="px-2 py-1 text-xs rounded border border-slate-300 bg-white"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Submetido">Submetido</option>
                      <option value="Aprovado">Aprovado</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      disabled={!ap.aplicavel}
                      value={ap.data_submissao || ''}
                      onChange={(e) => updateAprovacao(ap.id, { data_submissao: e.target.value || null })}
                      className="px-2 py-1 text-xs rounded border border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="date"
                      disabled={!ap.aplicavel}
                      value={ap.data_aprovacao || ''}
                      onChange={(e) => updateAprovacao(ap.id, { data_aprovacao: e.target.value || null })}
                      className="px-2 py-1 text-xs rounded border border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      disabled={!ap.aplicavel}
                      placeholder="Notas..."
                      value={ap.notas || ''}
                      onChange={(e) => updateAprovacao(ap.id, { notas: e.target.value })}
                      className="px-2 py-1 text-xs rounded border border-slate-300 w-44"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}