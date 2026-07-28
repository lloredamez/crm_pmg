# Especificação de Arquitetura & Prompt de Desenvolvimento para IA - Lead CRM System

## 1. Contexto Geral do Projeto

Você é um Engenheiro de Software Sênior e Arquiteto de Soluções Full Stack. O objetivo deste projeto é construir um **CRM de Distribuição Inteligente de Leads com SLA de Atendimento**, inspirado no layout moderno do dashboard fornecido (UI/UX clean, cantos arredondados, paleta de cores soft/purple-mint, abas pill-shaped e tabelas dinâmicas).

---

## 2. Tech Stack Mandatória

### **Arquitetura Feature-Driven**

O projeto deve ser estruturado em uma arquitetura **Feature-Driven**, onde cada funcionalidade (feature) do sistema possui sua própria pasta contendo todo o código relacionado: componentes React, hooks, estilos, serviços, testes e arquivos de configuração específicos.

### **Frontend**

- **Framework:** Next.js (App Router, TypeScript)
- **Estilização:** Tailwind CSS (com Shadcn UI / Radix UI para primitivos de acessibilidade)
- **Tabelas & Estado de Data Grid:** `@tanstack/react-table` (v8)
- **Gerenciamento de Estado Server & Caching:** `@tanstack/react-query` (v5)
- **Comunicação Real-time:** `socket.io-client`
- **Ícones:** `lucide-react`

### **Backend**

- **Framework:** FastAPI (Python 3.11+) com `uvicorn`
- **ORM:** SQLAlchemy (Async) ou SQLModel + Alembic para migrações
- **Workers / Fila Assíncrona:** Celery ou ARQ (com suporte a Redis) para controle de SLA/Timeout
- **Comunicação Real-time:** `python-socketio` / WebSockets nativos com PubSub Redis
- **Injeção de Dependências:** FastAPI Depends / Pydantic v2

### **Infraestrutura / Database**

- **Banco de Dados Relacional:** PostgreSQL 15+
- **Cache & Fila Assíncrona:** Redis 7+
- **Containerização:** Docker & Docker Compose (`docker-compose.yml` orquestrando Frontend, Backend, Postgres, Redis e Worker)

---

## 3. Diretrizes Design & UI/UX (Baseado na Imagem de Referência)

O layout deve reproduzir a estética visual da imagem fornecida:

1. **Header Principal:**
   - Logotipo à esquerda com ícones/badges circulares integrados.
   - Navegação por Abas no estilo "Pill/Capsule" (Ex: _Overview_, _Leads/Clients_, _Projects_, _Inbox_, _Analytics_).
   - Abas ativas possuem fundo branco com borda e sombra leve (`shadow-sm`). Abas inativas têm estilo suave/transparente.
2. **KPI Cards (Métricas):**
   - Cards brancos com bordas suaves (`rounded-2xl border border-slate-100 shadow-sm`).
   - Títulos em cinza neutro (`text-slate-500 font-medium text-sm`).
   - Badges de variação (+4 em verde mint, -8% em rosa soft).
   - Valores em tipografia destacada e comparativo com o mês anterior (`text-slate-400 text-xs`).
3. **Seção do Gráfico / Analytics:**
   - Card container grande com canto arredondado alto.
   - Indicadores de legenda com bullet colorido (_Actual_, _AI Projected_).
   - Tooltips customizados com badge de data em roxo suave (`bg-indigo-600 text-white rounded-md`).
4. **Tabela / Data Grid (Manage Leads/Projects):**
   - Control-bar superior com abas de filtro pill-shaped (_Priority (3)_, _Active_, _Completed_, _Canceled_).
   - Campo de busca minimalista no canto direito com ícone de lupa.
   - Colunas organizadas: _Client_, _Task_, _Note_, _Due On_, _Price_, _Status_, _More_.
   - Status visual estilizado com badges arredondadas (Pill badges).

---

## 4. Requisitos Funcionais do Sistema

### **4.1. Ingestão e Distribuição de Leads (Meta Ads Integration)**

- Endpoint `/api/v1/webhooks/meta` para receber notificações de formulários Meta Lead Ads em tempo real.
- Mecanismo de distribuição via **Round-Robin** ou **Carga Balanceada** entre atendentes online (`status = 'online'`).
- Tabela de fila e alocação (`lead_assignments`).

### **4.2. Motor de SLA & Realocação por Timeout**

- Ao atribuir um lead a um atendente, registra-se `assigned_at` e cria-se um evento temporizado no Redis/Celery (Ex: 15 minutos de tolerância para primeira interação).
- Se o atendente não alterar o status ou não responder, o worker de timeout invalida o vínculo atual (`status = 'expired_timeout'`) e redireciona o lead para o próximo atendente disponível.
- Notificação em tempo real via Socket.IO para o novo atendente.

### **4.3. Interface de Tabela de Leads (TanStack Table)**

- Paginação no servidor, ordenação por coluna, filtros por status, atendente e busca por texto.
- Ações rápidas diretamente na linha da tabela (Reatribuir manualmente, Alterar Status, Iniciar Atendimento).
- Seleção em lote (bulk actions) para transferência de leads.

### **4.4. Preparação para Módulo WhatsApp (Futuro)**

- Estrutura de dados pronta para `conversations` e `messages`.
- Abstração do serviço de envio/recebimento de mensagens (Adapter Pattern) para fácil plug & play da API do WhatsApp no futuro (ex: Evolution API ou Meta Cloud API).

---

## 5. Estrutura de Modelagem de Dados (Schema Postgres)

```sql
-- Users / Atendentes
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'attendant', -- 'admin', 'supervisor', 'attendant'
    status VARCHAR(50) DEFAULT 'offline', -- 'online', 'offline', 'busy'
    max_simultaneous_leads INT DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    meta_lead_id VARCHAR(255),
    campaign_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'new', -- 'new', 'assigned', 'in_progress', 'converted', 'lost'
    current_attendant_id UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Histórico de SLA / Distribuição
CREATE TABLE lead_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id),
    attendant_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(50) NOT NULL, -- 'active', 'expired_timeout', 'manually_reassigned', 'completed'
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unassigned_at TIMESTAMP WITH TIME ZONE
);

-- Tabela preparada para Mensagens de Chat (WhatsApp)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id),
    attendant_id UUID REFERENCES users(id),
    direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read'
    external_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 6. Arquitetura do Docker Compose

Fornecer o arquivo `docker-compose.yml` contendo:

1. `frontend`: Next.js na porta `5051`
2. `backend`: FastAPI + Socket.IO na porta `5052`
3. `postgres`: PostgreSQL na porta `5432`
4. `redis`: Redis na porta `6379`
5. `worker`: Worker Celery/ARQ executando as checagens de timeout de SLA e jobs de fila em segundo plano.

---

## 7. Instruções de Implementação para a IA

1. **Gere a estrutura inicial de pastas** modularizada para Next.js (App Router) e FastAPI.
2. **Crie os componentes Tailwind/UI** replicando rigorosamente a estética visual do print fornecido (Cores neutras, abas arredondadas, badges de metricas em tons pastel).
3. **Monte a tabela principal utilizando TanStack Table**, incluindo ordenação e filtros.
4. **Configure a conexão Socket.IO** no Next.js para escutar eventos `lead:assigned` e `lead:reassigned` com feedback visual de toast/notificação.
5. **Implemente a lógica de roteamento em Python (FastAPI)** com dependências de banco de dados assíncronas (`asyncpg` / `SQLAlchemy AsyncSession`).

Por favor, forneça o código modularizado, limpo, bem documentado e pronto para produção!
