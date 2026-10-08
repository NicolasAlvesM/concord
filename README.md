# Concord

> Chat desktop em tempo real com canais de voz, vídeo e compartilhamento de tela.

Concord é um aplicativo de comunicação estilo Discord, construído do zero como
projeto de estudo de arquitetura. Traz servidores, canais de texto e voz, DMs,
amizades e chamadas WebRTC (voz, vídeo e compartilhamento de tela) em um cliente
desktop com tema escuro.

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)

## 📖 Sobre o projeto

O Concord nasceu com a ideia de entender, na prática, como funciona uma
aplicação de chat em tempo real de ponta a ponta: autenticação, permissões,
mensageria via WebSocket, presença online e chamadas P2P com WebRTC.

O objetivo **não** é competir com o Discord, e sim servir como referência de
arquitetura — do banco de dados ao cliente desktop — mantendo o código simples,
modular e fácil de evoluir.

## ✨ Funcionalidades

- **Autenticação** — cadastro/login com JWT (access + refresh) e senha com bcrypt
- **Amigos** — buscar usuários, enviar/aceitar/recusar/remover solicitações
- **Servidores** — criar, editar, listar e convidar membros (com cargos owner/admin/member)
- **Canais** — canais de **texto** e de **voz** por servidor
- **Mensagens em tempo real** — canais e DMs via WebSocket, com histórico paginado
- **Presença** — status online/offline ao vivo
- **Chamadas** — voz 1:1 e em grupo, vídeo (1:1 e multi-câmera) e
  **compartilhamento de tela com vários participantes ao mesmo tempo**
- **UI desktop** — Electron com tema escuro e fundo animado

<!-- ## 🖼️ Screenshots  (preciso de imagens/GIFs) -->

## 🧱 Stack

### Backend
| Tecnologia | Uso |
|---|---|
| Go 1.26 | Linguagem do servidor |
| Gin | Framework HTTP e roteamento |
| pgx v5 | Driver PostgreSQL |
| coder/websocket | WebSocket (tempo real) |
| JWT + bcrypt | Auth (access/refresh + hash de senha) |
| PostgreSQL 17 | Banco de dados |
| Docker Compose | Banco local |
| golang-migrate | Migrations versionadas (aplicadas no boot) |

### Frontend
| Tecnologia | Uso |
|---|---|
| Electron 39 | App desktop |
| electron-vite 5 | Build/dev do Electron |
| React 19 + TypeScript | Interface |
| Zustand | Estado global |
| Tailwind CSS v4 | Estilização (tokens via `@theme`) |
| react-router-dom 7 | Rotas (HashRouter) |
| WebRTC nativo | Voz, vídeo e compartilhamento de tela |

## 🏗️ Arquitetura

**Monólito modular**: uma única aplicação Go, organizada por domínio. Cada
domínio expõe a mesma cadeia de responsabilidades, para que partes possam ser
extraídas depois caso a escala exija.

```text
Client (Electron/React)
  │
  ├── HTTP ────────┐
  │                ▼
  └── WebSocket ─► Go (Gin) ──► PostgreSQL
                     │
                     └── WebRTC (P2P / mesh) para mídia
```

Cada módulo em `internal/` segue:

```text
handler      → comunicação externa (request/response)
service      → regras de negócio
repository   → persistência
model        → tipos e eventos
```

Regra de dependência: `Handler → Service → Repository → Database`.

### Estrutura do repositório

```text
concord/
├── backend/          # API em Go + WebSocket + sinalização WebRTC
│   ├── cmd/          # main.go
│   ├── internal/     # auth, user, friendship, server, channel, message,
│   │                 # conversation, call, websocket, database
│   └── migrations/   # SQL versionado
└── frontend/         # cliente Electron + React
    └── src/
        ├── main/     # processo principal do Electron
        ├── preload/  # bridge segura (IPC)
        └── renderer/ # app React (api, store, components, pages)
```

## 🚀 Como rodar

### Pré-requisitos
- Go 1.26+
- Node.js 20+ e Yarn
- Docker (para o PostgreSQL)

### 1. Clonar
```bash
git clone https://github.com/hugoemannuel/concord.git
cd concord
```

### 2. Banco de dados
```bash
cd backend
docker compose up -d
```

### 3. Backend
Crie `backend/.env`:
```env
DATABASE_URL=postgres://concord-user:concord-password@localhost:5432/concord?sslmode=disable
JWT_SECRET=troque-por-um-segredo-seguro
```
Rode (as migrations são aplicadas automaticamente no boot):
```bash
go run ./cmd
# API em http://localhost:8080  → GET /api/health
```

### 4. Frontend
```bash
cd frontend
yarn
yarn dev
# abre a janela do Electron (dev server em http://localhost:5173)
```

## 🔌 API (resumo)

Autenticação via header `Authorization: Bearer <access_token>` (exceto rotas públicas de auth).

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | criar conta |
| POST | `/api/auth/login` | login (retorna access + refresh) |
| POST | `/api/auth/refresh` | renovar access token |
| POST | `/api/auth/logout` | encerrar sessão |
| GET | `/api/users/me` | usuário autenticado |
| GET | `/api/users/search?username=` | buscar usuários |
| ... | `/api/friends/*` | solicitações, lista, pendentes |
| ... | `/api/servers/*` | servidores, membros, convites |
| ... | `/api/servers/:id/channels` | canais (texto/voz) |
| ... | `/api/channels/:channelId/messages` | mensagens de canal |
| ... | `/api/conversations/*` | DMs e mensagens de DM |
| ... | `/api/calls/*` | criar/estado/encerrar chamadas |
| GET | `/api/presence?ids=` | status online |

> A lista completa de endpoints está no código (`internal/*/routes.go`).

## 📡 WebSocket

Endpoint: `GET /ws?token=<access_token>`.
O cliente entra em salas com `{"type":"subscribe","payload":{"room":"..."}}`
(`channel:`, `conversation:`, `server:`, `user:`, `call:`).

Eventos principais: `presence:update`, `message:create`, `message:delete`,
`channel:create|update|delete`, `server:update|delete`, `server:member:join|leave`,
`friend:request|accepted|declined|removed` e `call:*` (sinalização WebRTC).

## 📞 Chamadas (WebRTC)

- **Sinalização** por WebSocket (`call:invite`, `call:signal`, `call:leave`...).
- **Mídia P2P (mesh)** direto entre os participantes — topologia adequada para
  chamadas 1:1 e grupos pequenos (~4–6). Upgrade para SFU fica como evolução futura.
- STUN público (Google) para descoberta; TURN fica como trabalho futuro para NATs restritivos.

## 🛠️ Scripts

### Backend
```bash
go run ./cmd      # inicia a API
go build ./...    # build
go vet ./...      # análise estática
```

### Frontend
```bash
yarn dev          # desenvolvimento
yarn build        # typecheck + build
yarn lint         # eslint
yarn typecheck    # tsc
yarn build:win    # instalador Windows
yarn build:mac    # instalador macOS
yarn build:linux  # instalador Linux
```

## 🗺️ Roadmap

- [x] Auth, usuários, amigos, servidores e canais
- [x] Chat em tempo real (canais e DMs) + presença
- [x] Chamadas de voz (1:1 e grupo)
- [x] Compartilhamento de tela multi-tela
- [x] Vídeo (1:1 e multi-câmera em grupo)
- [ ] TURN (coturn) para redes restritivas
- [ ] Histórico de chamadas na UI
- [ ] SFU para grupos maiores
