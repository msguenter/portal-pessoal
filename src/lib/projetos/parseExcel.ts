import * as XLSX from 'xlsx';
import { APROVACOES_PADRAO, calcularDataEntregaFase } from './constants';

export interface ParsedProjeto {
  projeto: {
    codigo: string;
    contrato: string;
    designacao: string;
    morada: string;
    num_processo: string;
    data_inicio: string | null;
    data_fim: string | null;
    requerente_nome: string;
    requerente_sede: string;
    requerente_nif: string;
    requerente_responsavel: string;
    requerente_telemovel: string;
    requerente_email: string;
    fase_atual: string;
    estado: string;
    com_quem_esta: string[];
  };
  prazos: Array<{
    ordem: number;
    fase: string;
    data_inicio: string | null;
    data_fim: string | null;
    prazo_contrato_dias: number | null;
    prorrogacao_dias: number;
    prazo_real_dias: number | null;
  }>;
  especialidades: Array<{
    ordem: number;
    especialidade: string;
    aplicavel: boolean;
    estado: string;
    tecnico_elaborou: string;
    data_inicio: string | null;
    data_fim: string | null;
    tecnico_responsavel: string;
    notas: string;
  }>;
  aprovacoes: Array<{
    ordem: number;
    nome: string;
    aplicavel: boolean;
    estado: string;
  }>;
  registos: Array<{
    ref: string;
    levantado_por: string;
    especialidade: string;
    data_registo: string | null;
    zona_artigo: string;
    tipo_comunicacao: string;
    assunto: string;
    atribuido_a: string;
    fase_levantamento: string;
    fase_estudo_previo: string;
    fase_anteprojecto: string;
    fase_execucao: string;
    fase_assistencia: string;
    resolucao_observacoes: string;
    data_resolucao: string | null;
    estado_pe: string;
  }>;
}

function excelDateToISO(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    if (val.getFullYear() <= 1901) return null;
    return val.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    if (val < 100) return null;
    const parsed = XLSX.SSF.parse_date_code(val);
    if (!parsed || parsed.y <= 1901) return null;
    const m = String(parsed.m).padStart(2, '0');
    const d = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${m}-${d}`;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-') return null;
    const dmy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  }
  return null;
}

function cellStr(ws: XLSX.WorkSheet, addr: string): string {
  const cell = ws[addr];
  if (!cell || cell.v === undefined || cell.v === null) return '';
  return String(cell.v).trim();
}

function normalizarNomeFase(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('levantamento')) return 'Levantamento';
  if (lower.includes('estudo')) return 'Estudo Prévio';
  if (lower.includes('anteprojecto') || lower.includes('anteprojeto')) return 'Anteprojeto';
  if (lower.includes('execução') || lower.includes('execucao')) return 'Projeto de Execução';
  if (lower.includes('assistência') || lower.includes('assistencia')) return 'Assistência Técnica';
  return raw;
}

export async function parseProjetoExcel(file: File): Promise<ParsedProjeto> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const wsCapa = wb.Sheets['Capa'];
  const wsRegistos = wb.Sheets['Registos'];

  if (!wsCapa || !wsRegistos) {
    throw new Error('O ficheiro Excel deve conter as abas "Capa" e "Registos".');
  }

  // 1. Prazos (Linhas 23 a 27 da Capa)
  const prazos = [];
  let faseAtual = 'Levantamento';
  for (let r = 23; r <= 27; r++) {
    const rawFase = cellStr(wsCapa, `A${r}`);
    if (!rawFase) continue;
    const fase = normalizarNomeFase(rawFase);
    const dInicio = excelDateToISO(wsCapa[`D${r}`]?.v);
    const dFimRaw = excelDateToISO(wsCapa[`F${r}`]?.v);
    const pContrato = Number(wsCapa[`I${r}`]?.v) || null;
    const pReal = Number(wsCapa[`K${r}`]?.v) || null;
    const dFim = calcularDataEntregaFase(dInicio, dFimRaw, pContrato, 0);

    if (dInicio) faseAtual = fase;

    prazos.push({
      ordem: r - 22,
      fase,
      data_inicio: dInicio,
      data_fim: dFim,
      prazo_contrato_dias: pContrato,
      prorrogacao_dias: 0,
      prazo_real_dias: pReal,
    });
  }

  // 2. Especialidades (Linhas 32 a 47 da Capa)
  const especialidades = [];
  for (let r = 32; r <= 47; r++) {
    const esp = cellStr(wsCapa, `A${r}`);
    if (!esp) continue;
    const isGasOpcional = esp.toLowerCase().includes('gás');
    especialidades.push({
      ordem: r - 31,
      especialidade: esp,
      aplicavel: !isGasOpcional,
      estado: 'Pendente',
      tecnico_elaborou: cellStr(wsCapa, `D${r}`),
      data_inicio: excelDateToISO(wsCapa[`F${r}`]?.v),
      data_fim: excelDateToISO(wsCapa[`G${r}`]?.v),
      tecnico_responsavel: cellStr(wsCapa, `H${r}`),
      notas: cellStr(wsCapa, `J${r}`),
    });
  }

  // 3. Aprovações padrão (Base 05)
  const aprovacoes = APROVACOES_PADRAO.map((nome, idx) => ({
    ordem: idx + 1,
    nome,
    aplicavel: false,
    estado: 'Pendente',
  }));

  // 4. Registos (Aba Registos a partir da linha 5)
  const range = XLSX.utils.decode_range(wsRegistos['!ref'] || 'A1:Q50');
  const registos = [];
  for (let r = 5; r <= range.e.r + 1; r++) {
    const ref = cellStr(wsRegistos, `A${r}`);
    const assunto = cellStr(wsRegistos, `G${r}`);
    const obs = cellStr(wsRegistos, `N${r}`);
    if (!ref && !assunto && !obs) continue;

    registos.push({
      ref,
      levantado_por: cellStr(wsRegistos, `B${r}`),
      especialidade: cellStr(wsRegistos, `C${r}`),
      data_registo: excelDateToISO(wsRegistos[`D${r}`]?.v),
      zona_artigo: cellStr(wsRegistos, `E${r}`),
      tipo_comunicacao: cellStr(wsRegistos, `F${r}`),
      assunto,
      atribuido_a: cellStr(wsRegistos, `H${r}`),
      fase_levantamento: excelDateToISO(wsRegistos[`I${r}`]?.v) || cellStr(wsRegistos, `I${r}`),
      fase_estudo_previo: cellStr(wsRegistos, `J${r}`),
      fase_anteprojecto: cellStr(wsRegistos, `K${r}`),
      fase_execucao: cellStr(wsRegistos, `L${r}`),
      fase_assistencia: cellStr(wsRegistos, `M${r}`),
      resolucao_observacoes: obs,
      data_resolucao: excelDateToISO(wsRegistos[`O${r}`]?.v),
      estado_pe: cellStr(wsRegistos, `Q${r}`),
    });
  }

  // Inferir estado e "com quem está" a partir dos registos abertos
  const abertosComDO = registos.filter((r) => !r.data_resolucao && r.atribuido_a?.toUpperCase() === 'DO');
  const dataInicioContrato = excelDateToISO(wsCapa['K6']?.v);
  const dataFimContrato = excelDateToISO(wsCapa['L6']?.v);

  let estado = 'Não iniciada';
  if (dataFimContrato) estado = 'Concluído';
  else if (abertosComDO.length > 0) estado = 'Aguarda resposta DO';
  else if (dataInicioContrato) estado = 'Em andamento';

  const comQuemEsta: string[] = [];
  if (estado === 'Em andamento') comQuemEsta.push('ARCOS');
  if (abertosComDO.length > 0) comQuemEsta.push('Dono de Obra');

  return {
    projeto: {
      codigo: cellStr(wsCapa, 'A6'),
      contrato: cellStr(wsCapa, 'C6'),
      designacao: cellStr(wsCapa, 'B17') || cellStr(wsCapa, 'C6'),
      morada: cellStr(wsCapa, 'B18'),
      num_processo: cellStr(wsCapa, 'B19'),
      data_inicio: dataInicioContrato,
      data_fim: dataFimContrato,
      requerente_nome: cellStr(wsCapa, 'B11'),
      requerente_sede: cellStr(wsCapa, 'B12'),
      requerente_nif: cellStr(wsCapa, 'B13'),
      requerente_responsavel: cellStr(wsCapa, 'B14'),
      requerente_telemovel: cellStr(wsCapa, 'E14'),
      requerente_email: cellStr(wsCapa, 'H14'),
      fase_atual: faseAtual,
      estado,
      com_quem_esta: comQuemEsta,
    },
    prazos,
    especialidades,
    aprovacoes,
    registos,
  };
}