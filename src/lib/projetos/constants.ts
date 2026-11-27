export const FASES_PADRAO = [
  { ordem: 1, nome: 'Levantamento', prazo_contrato_dias: 45 },
  { ordem: 2, nome: 'Estudo Prévio', prazo_contrato_dias: 45 },
  { ordem: 3, nome: 'Anteprojeto', prazo_contrato_dias: 60 },
  { ordem: 4, nome: 'Projeto de Execução', prazo_contrato_dias: 60 },
  { ordem: 5, nome: 'Assistência Técnica', prazo_contrato_dias: null },
] as const;

export const ESTADOS_PROJETO = [
  'Não iniciada',
  'Em andamento',
  'Aguarda resposta DO',
  'Concluído',
] as const;

export const COM_QUEM_ESTA_OPCOES = [
  'ARCOS',
  'Especialidades',
  'Entidades',
  'Dono de Obra',
] as const;

export const ESPECIALIDADES_PADRAO = [
  '01 ARQ | Arquitetura e Acessibilidades',
  '02 EST | Fundações e Estrutura',
  '03 AGU | Instalações, equipamentos e sistemas de água',
  '04 ESG | Instalações, equipamentos e sistemas de águas residuais domésticas e pluviais',
  '05 ELE | Instalações, equipamentos e sistemas elétricos, incluindo UPAC',
  '06 ITED | Instalações, equipamentos e sistemas de comunicações',
  '07 AVAC | Instalações, equipamentos e sistemas de aquecimento, ventilação, ar condicionado e refrigeração',
  '08 SINT (SADI + SADINT E CATV) | Sistemas de segurança integrada',
  '09 SCIE | Segurança contra Incêndios',
  '10 GAS | Projeto de Instalação de Gás (se necessário)',
  '11 TERM | Comportamento térmico e pré-certificação energética',
  '12 ACU | Condicionamento acústico',
  '13 AEXT | Arranjos Exteriores e arquitetura paisagista',
  '14 IEM | Instalações Eletromecânicas',
  '15 PSS | Plano de Segurança e Saúde em projeto',
  '16 PPGRCD | Plano de Prevenção e Gestão de Resíduos de Construção e Demolição',
] as const;

export const APROVACOES_PADRAO = [
  'Licenciamento na Câmara',
  'Pedidos de Cadastros',
  'Estudo Luminotécnico',
  'Estudo Geotécnico',
  'E-Redes',
  'SMAS',
  'CCDR',
] as const;

export function calcularDataEntregaFase(
  dataInicio: string | null,
  dataFimExplicita: string | null,
  prazoContratoDias: number | null,
  prorrogacaoDias: number | null = 0
): string | null {
  if (dataFimExplicita) return dataFimExplicita;
  if (!dataInicio || !prazoContratoDias) return null;

  const base = new Date(`${dataInicio}T12:00:00`);
  if (isNaN(base.getTime())) return null;

  const totalDias = Number(prazoContratoDias) + Number(prorrogacaoDias || 0);
  base.setDate(base.getDate() + totalDias);
  return base.toISOString().split('T')[0];
}