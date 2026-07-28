# Lead CRM System - Distribuição Inteligente de Leads com SLA

Este projeto é um CRM completo para ingestão, distribuição inteligente (Round-Robin & Carga Balanceada) e controle rigoroso de SLA de atendimento com realocação por timeout em tempo real.

---

## 🚀 Teck Stack

- **Frontend:** Next.js (App Router), Tailwind CSS, TanStack Table v8, React Query v5, Socket.io Client, Lucide Icons, Recharts.
- **Backend:** FastAPI (Python 3.11+), Async SQLAlchemy (`asyncpg`), Python-SocketIO, Pydantic v2.
- **Processamento Assíncrono / Worker:** Celery com broker e result backend no Redis.
- **Banco de Dados & Cache:** PostgreSQL 15+, Redis 7+.
- **Containers & Orquestração:** Docker Compose.

---

## 🛠️ Como Executar com Docker Compose

1. **Copiar arquivo de variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```

2. **Iniciar todos os serviços em segundo plano:**
   ```bash
   docker-compose up --build -d
   ```

3. **Acessar as aplicações:**
   - **Frontend Dashboard:** [http://localhost:5051](http://localhost:5051)
   - **Backend API & Swagger Docs:** [http://localhost:5052/docs](http://localhost:5052/docs)
   - **Meta Webhook Endpoint:** `POST http://localhost:5052/api/v1/webhooks/meta`

---

## ⚡ Funcionalidades Principais

1. **Ingestão Meta Ads & Webhook:** Endpoint preparado para receber leads do Meta Lead Ads com verificação de segurança e token (`hub.verify_token`).
2. **Algoritmo de Distribuição Inteligente:** Round-Robin que aloca automaticamente novos leads aos atendentes online com menor carga de atendimentos simultâneos.
3. **Engine de SLA & Timeout Worker:** Worker Celery agendado que verifica tempo de resposta (15 min). Se estourado, invalida o vínculo e realoca o lead automaticamente com alerta Socket.IO.
4. **Data Grid Avançado (TanStack Table):** Tabela de leads com busca em tempo real, abas pill-shaped de filtro, paginação, ordenação e reatribuição manual individual ou em lote (bulk action).
5. **Simulação Webhook Integrada:** Botão `+ Simular Meta Lead` no header para testar facilmente a ingestão e a atribuição no ambiente de desenvolvimento.
6. **Módulo WhatsApp Prontidão:** Abstração via `MockWhatsAppAdapter` pronta para conectar a APIs como Evolution API ou Meta Cloud API.
