import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { calcularDataEntregaFase } from '@/lib/projetos/constants';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PendenciaItem {
  projetoId: string;
  projetoCodigo: string;
  projetoDesignacao: string;
  tipo: 'Coordenação' | 'Especialidade' | 'Comunicação';
  titulo: string;
  detalhe: string;
  prazo: string | null;
  diasRestantes: number | null;
}

function calcularDiasRestantes(dataStr: string | null): number | null {
  if (!dataStr) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${dataStr}T00:00:00`);
  if (isNaN(alvo.getTime())) return null;
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function badgePrazoHtml(prazo: string | null, dias: number | null): string {
  if (!prazo) return '<span style="color:#64748b;">Sem data</span>';
  if (dias !== null && dias < 0) {
    return `<span style="background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px;font-weight:600;font-size:12px;">${prazo} (${Math.abs(dias)}d atraso)</span>`;
  }
  if (dias !== null && dias <= 7) {
    return `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-weight:600;font-size:12px;">${prazo} (${dias}d)</span>`;
  }
  return `<span style="color:#334155;font-weight:500;">${prazo}</span>`;
}

function renderTabelaPendencias(itens: PendenciaItem[], baseUrl: string): string {
  if (itens.length === 0) {
    return '<p style="color:#64748b;font-size:14px;">Sem pendências ativas neste momento.</p>';
  }

  const rows = itens
    .map(
      (item) => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:10px 8px;font-weight:700;white-space:nowrap;">
          <a href="${baseUrl}/projetos/${item.projetoId}" style="color:#2563eb;text-decoration:none;">
            ${item.projetoCodigo}
          </a>
        </td>
        <td style="padding:10px 8px;">
          <div style="font-weight:600;color:#0f172a;">${item.titulo}</div>
          <div style="font-size:12px;color:#64748b;">${item.projetoDesignacao} • ${item.detalhe}</div>
        </td>
        <td style="padding:10px 8px;white-space:nowrap;">${badgePrazoHtml(item.prazo, item.diasRestantes)}</td>
        <td style="padding:10px 8px;white-space:nowrap;">
          <a href="${baseUrl}/projetos/${item.projetoId}" style="background:#0f172a;color:#ffffff;padding:5px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:500;">
            Abrir
          </a>
        </td>
      </tr>`
    )
    .join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;margin-top:8px;">
      <thead>
        <tr style="background:#f8fafc;color:#475569;border-bottom:2px solid #e2e8f0;">
          <th style="padding:8px;">Proj.</th>
          <th style="padding:8px;">Tarefa / Especialidade</th>
          <th style="padding:8px;">Prazo</th>
          <th style="padding:8px;">Ação</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function executarEnvioRelatorios(baseUrl: string, filtroEmailUnico?: string) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Variável RESEND_API_KEY não configurada no servidor.');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'ARCOS Projetos <onboarding@resend.dev>';

  // 1. Carregar equipa ativa e projetos não concluídos
  const [{ data: membros, error: errEq }, { data: projetos, error: errPr }] = await Promise.all([
    supabase.from('equipa').select('*').eq('ativo', true).order('nome'),
    supabase
      .from('projetos')
      .select('*, projeto_prazos(*), projeto_especialidades(*), projeto_registos(*)')
      .neq('estado', 'Concluído'),
  ]);

  if (errEq) throw errEq;
  if (errPr) throw errPr;

  const equipaAtiva = membros || [];
  const projetosAtivos = projetos || [];

  if (equipaAtiva.length === 0) {
    return { enviados: 0, detalhes: ['Nenhum membro ativo cadastrado na tabela equipa.'] };
  }

  // 2. Mapear pendências por nome do membro
  const pendenciasPorPessoa: Record<string, PendenciaItem[]> = {};
  equipaAtiva.forEach((m) => {
    pendenciasPorPessoa[m.nome.toLowerCase()] = [];
  });

  for (const proj of projetosAtivos) {
    const faseAtualObj = (proj.projeto_prazos || []).find(
      (f: any) => f.fase?.toLowerCase() === proj.fase_atual?.toLowerCase()
    );
    const prazoFaseAtual = faseAtualObj
      ? calcularDataEntregaFase(
          faseAtualObj.data_inicio,
          faseAtualObj.data_fim,
          faseAtualObj.prazo_contrato_dias,
          faseAtualObj.prorrogacao_dias
        )
      : null;
    const diasFaseAtual = calcularDiasRestantes(prazoFaseAtual);

    // A) Coordenação do projeto
    if (proj.coordenador) {
      const key = proj.coordenador.trim().toLowerCase();
      if (pendenciasPorPessoa[key]) {
        pendenciasPorPessoa[key].push({
          projetoId: proj.id,
          projetoCodigo: proj.codigo,
          projetoDesignacao: proj.designacao,
          tipo: 'Coordenação',
          titulo: `Coordenação: ${proj.fase_atual} (${proj.estado})`,
          detalhe: `Com: ${(proj.com_quem_esta || []).join(', ') || 'Não definido'}`,
          prazo: prazoFaseAtual,
          diasRestantes: diasFaseAtual,
        });
      }
    }

    // B) Especialidades incluídas e pendentes/em curso
    for (const esp of proj.projeto_especialidades || []) {
      if (!esp.aplicavel || esp.estado === 'Entregue') continue;
      const resp = (esp.tecnico_responsavel || '').trim().toLowerCase();
      if (resp && pendenciasPorPessoa[resp]) {
        const prazoEsp = esp.data_fim || prazoFaseAtual;
        pendenciasPorPessoa[resp].push({
          projetoId: proj.id,
          projetoCodigo: proj.codigo,
          projetoDesignacao: proj.designacao,
          tipo: 'Especialidade',
          titulo: esp.especialidade,
          detalhe: `Estado: ${esp.estado || 'Pendente'} • Fase: ${proj.fase_atual}`,
          prazo: prazoEsp,
          diasRestantes: calcularDiasRestantes(prazoEsp),
        });
      }
    }

    // C) Registos / Comunicações abertas atribuídas a alguém da equipa
    for (const reg of proj.projeto_registos || []) {
      if (reg.data_resolucao) continue;
      const resp = (reg.responsavel_equipa || '').trim().toLowerCase();
      if (resp && pendenciasPorPessoa[resp]) {
        pendenciasPorPessoa[resp].push({
          projetoId: proj.id,
          projetoCodigo: proj.codigo,
          projetoDesignacao: proj.designacao,
          tipo: 'Comunicação',
          titulo: `Ref. ${reg.ref || '—'}: ${reg.assunto || 'Comunicação pendente'}`,
          detalhe: `${reg.tipo_comunicacao || 'Registo'} • Fase: ${proj.fase_atual}`,
          prazo: prazoFaseAtual,
          diasRestantes: diasFaseAtual,
        });
      }
    }
  }

  // 3. Disparar emails
  const dataHojeFmt = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const logs: string[] = [];
  let enviados = 0;

  for (const membro of equipaAtiva) {
    if (filtroEmailUnico && membro.email.toLowerCase() !== filtroEmailUnico.toLowerCase()) {
      continue;
    }

    const minhasPendencias = pendenciasPorPessoa[membro.nome.toLowerCase()] || [];
    const isCoordenador = membro.papel === 'coordenador';

    // Membros técnicos só recebem se tiverem algo pendente (coordenador recebe sempre o resumo geral)
    if (!isCoordenador && minhasPendencias.length === 0) {
      logs.push(`${membro.nome} (${membro.email}): sem pendências, email ignorado.`);
      continue;
    }

    let htmlSecaoEquipa = '';
    if (isCoordenador) {
      const outrosMembros = equipaAtiva.filter((m) => m.id !== membro.id);
      const blocosEquipa = outrosMembros
        .map((outro) => {
          const listaOutro = pendenciasPorPessoa[outro.nome.toLowerCase()] || [];
          return `
            <div style="margin-top:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
              <h3 style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">
                ${outro.nome} <span style="font-weight:400;color:#64748b;font-size:13px;">(${listaOutro.length} pendentes)</span>
              </h3>
              ${renderTabelaPendencias(listaOutro, baseUrl)}
            </div>`;
        })
        .join('');

      htmlSecaoEquipa = `
        <hr style="border:none;border-top:1px solid #cbd5e1;margin:28px 0;" />
        <h2 style="font-size:17px;color:#0f172a;margin-bottom:4px;">Visão Geral da Equipa</h2>
        <p style="font-size:13px;color:#64748b;margin-top:0;">Resumo consolidado das pendências de todos os membros ativos.</p>
        ${blocosEquipa}
      `;
    }

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;color:#1e293b;padding:20px;">
        <div style="border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:20px;">
          <h1 style="margin:0;font-size:20px;color:#0f172a;">ARCOS • Relatório Diário de Projetos</h1>
          <p style="margin:4px 0 0 0;font-size:13px;color:#64748b;text-transform:capitalize;">${dataHojeFmt}</p>
        </div>

        <p style="font-size:14px;">Olá <strong>${membro.nome}</strong>, segue o resumo do que tens pendente nos projetos ativos:</p>

        <h2 style="font-size:16px;color:#0f172a;margin-top:20px;">As Tuas Pendências (${minhasPendencias.length})</h2>
        ${renderTabelaPendencias(minhasPendencias, baseUrl)}

        ${htmlSecaoEquipa}

        <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;">
          <a href="${baseUrl}/projetos" style="display:inline-block;background:#2563eb;color:#ffffff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            Abrir Portal de Projetos
          </a>
        </div>
      </div>
    `;

    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: membro.email,
      subject: `[ARCOS] Report Diário • ${minhasPendencias.length} pendência(s) — ${new Date().toLocaleDateString('pt-PT')}`,
      html,
    });

    if (sendError) {
      logs.push(`Erro ao enviar para ${membro.email}: ${sendError.message}`);
    } else {
      enviados++;
      logs.push(`Enviado para ${membro.nome} (${membro.email})`);
    }
  }

  return { enviados, detalhes: logs };
}

// GET: Chamado pelo Agendamento Automático (GitHub Actions / Vercel Cron)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const result = await executarEnvioRelatorios(baseUrl);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// POST: Chamado manualmente pelo botão no Portal
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const result = await executarEnvioRelatorios(baseUrl, body.emailUnico || undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}