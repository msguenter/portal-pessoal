# Portal Pessoal - Arquitetura e Convenções

## Stack Tecnológica
- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Backend/Banco de Dados:** [Supabase](https://supabase.com/) (PostgreSQL + Auth)

## Ambientes e Fluxo de Trabalho
O projeto utiliza dois ambientes distintos no Supabase para garantir a estabilidade da produção:

1. **Desenvolvimento (dev):**
   - Projeto Supabase: `portal-pessoal-dev`
   - Branch Git: `dev`
2. **Produção (prod):**
   - Projeto Supabase: `portal-pessoal-prod`
   - Branch Git: `main`

### Regra de Ouro
Toda alteração de código e migração de banco deve ser feita e testada primeiro em **dev**. Somente após a validação, as alterações são promovidas para **main/prod**.

## Organização Modular
O projeto é organizado de forma modular. Cada funcionalidade principal ("planilha") é um módulo independente acessível via menu lateral:

- **Dashboard:** Visão geral de todos os módulos.
- **Finanças:** Gestão financeira pessoal.
- **Saúde:** Acompanhamento de indicadores de saúde.
- **Viagens:** Planejamento e histórico de viagens.
- **Planos:** Metas e planos de curto/longo prazo.

## Convenções de Código
- Utilize `lucide-react` para ícones.
- Siga os padrões do App Router do Next.js para rotas e layouts.
- Mantenha componentes pequenos, reutilizáveis e modulares.
- Mudanças no banco de dados devem ser feitas via migrações do Supabase.
