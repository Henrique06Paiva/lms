# EduCore LMS — Enterprise B2B SaaS Learning Management System

> Plataforma Corporativa de Gestão de Aprendizagem e Conformidade, desenvolvida em **Node.js (Vanilla / Sem Frameworks)**, **TypeScript**, **SQLite** e um **Design System Executivo B2B puro** (inspirado no padrão Stripe Atlas e IBM Carbon).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20(WAL)-003B57.svg)](https://sqlite.org/)
[![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20Flexbox%20%26%20ES6-orange.svg)]()
[![Architecture](https://img.shields.io/badge/Architecture-Clean%20%26%20Zero--Framework-purple.svg)]()
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing%20(9%20Suites)-brightgreen.svg)]()

---

## 🏛️ Destaques de Engenharia e Arquitetura

- **Zero Dependências de Framework no Core**: Roteador HTTP nativo construído sobre `node:http`, suporte a middlewares encadeados, extração de parâmetros dinâmicos (`/api/courses/:slug`), streaming de vídeo via chunking (`Range: bytes=...`) e proteção estrita contra Directory Traversal.
- **Banco de Dados SQLite de Alta Performance**: Configurado em modo `WAL` (Write-Ahead Logging), chaves estrangeiras ativas e **triggers nativos em SQL** que recalculam o percentual de conclusão e preenchem `completed_at` em nível de banco de forma atômica e instantânea.
- **Emissão Desacoplada de Certificados Oficiais (Subprocesso Worker)**: A compilação vetorial de PDFs oficiais com marca d'água, dados de autenticidade e hash criptográfico é delegada a um subprocesso desacoplado via `child_process.fork`, garantindo que o loop de eventos HTTP permaneça desimpedido mesmo sob carga.
- **Validador Público de Autenticidade (Chancela Corporativa)**: Endpoint e interface pública para validação de certificados por código único (ex: `EDU-XXXXXX-XXXXXX`), permitindo que equipes de auditoria ou RH comprovem a veracidade do documento sem necessidade de login.
- **Design System Executivo B2B (Vanilla CSS Flexbox)**: Paleta dark sóbria em ardósia e grafite profundo, tipografia monoespaçada corporativa, alternador de visão entre **Fichas Técnicas Corporativas (*Technical Dossiers*)** e **Tabela Executiva de Alta Densidade**, player de vídeo corporativo customizado com atalhos de teclado e persistência de preferências de tema.

---

## 🚀 Como Colocar em Produção (Guia para Portfólio)

### Opção 1: Render (Recomendada — 100% Gratuito com Deploy em 1 Clique)

O repositório já inclui o arquivo `render.yaml` pronto para provisionamento automático.

1. Acesse [render.com](https://render.com) e conecte sua conta do GitHub.
2. No painel do Render, clique em **New +** e selecione **Blueprint**.
3. Conecte este repositório (`Henrique06Paiva/lms`).
4. O Render detectará automaticamente o arquivo `render.yaml` e o `Dockerfile` otimizado em múltiplos estágios.
5. Clique em **Apply**. Em cerca de 2 minutos, sua aplicação estará online com HTTPS gratuito (ex: `https://educore-lms.onrender.com`).
6. O sistema executa **migrações e seed corporativo automaticamente no primeiro boot**, portanto quem visitar seu portfólio encontrará imediatamente usuários e cursos prontos para teste!

---

### Opção 2: Railway (Suporte a Volumes Persistentes)

1. Acesse [railway.app](https://railway.app) e clique em **New Project** > **Deploy from GitHub repo**.
2. Selecione o repositório `lms`.
3. *(Opcional)* Nas configurações de serviço do Railway, adicione um **Volume** montado em `/app/data` para que os dados do SQLite persistam entre novos deploys.
4. Gere um domínio público na aba de networking (ex: `educore.up.railway.app`).

---

### Opção 3: VPS / Servidor Próprio com Docker Compose

Clone o repositório em seu servidor Linux e execute:

```bash
# 1. Clone o repositório
git clone https://github.com/Henrique06Paiva/lms.git
cd lms

# 2. Suba o container com persistência em disco local
docker compose up -d --build

# 3. Verifique os logs de inicialização
docker compose logs -f
```

A aplicação estará rodando na porta `3000`.

---

## 🔑 Credenciais Pré-configuradas para Teste

Ao iniciar com banco vazio, o sistema popula automaticamente duas contas corporativas prontas para demonstração:

| Perfil | E-mail | Senha | Permissões |
| :--- | :--- | :--- | :--- |
| 👑 **Administrador** | `admin@educore.com` | `adminPassword123` | Criação de cursos, gestão corporativa, métricas |
| 🎓 **Colaborador / Aluno** | `aluno@empresa.com` | `alunoPassword123` | Matrículas, aulas, progresso e emissão de certificados |

> **Dica**: Na tela de login há botões rápidos de 1 clique (`👑 Administrador` e `🎓 Aluno de Teste`) que preenchem as credenciais instantaneamente.

---

## 💻 Executando Localmente

### Pré-requisitos
- Node.js 20+ (ou 22+)
- NPM

### Passo a passo

```bash
# 1. Instalar dependências
npm install

# 2. Executar migrações do banco SQLite
npm run db:migrate

# 3. Povoar banco com cursos e usuários de teste
npm run db:seed

# 4. Iniciar em modo de desenvolvimento (com hot-reload via tsx)
npm run dev

# 5. Ou compilar e rodar em modo de produção
npm run build
npm start
```

Acesse no navegador: `http://localhost:3000`

---

## 🧪 Suíte Completa de Testes Automatizados

Para rodar todos os testes de regressão, triggers e integrações:

```bash
npm test
```

A suíte cobre 9 módulos com 100% de aprovação:
- `verify_triggers.ts`: Validação de triggers SQLite e sincronização atômica de progresso.
- `verify_core.ts`: Roteador nativo, middlewares, parsing de body e status codes.
- `verify_auth.ts`: Hash criptográfico PBKDF2/SHA-512, sessões com expiração e rotas protegidas.
- `verify_courses.ts`: CRUD de cursos, ordenação de aulas e matrículas.
- `verify_media.ts`: Uploads binários e streaming HTTP com suporte a Range requests (HTTP 206).
- `verify_progress.ts`: Marcação de aulas, percentual e reset de progresso.
- `verify_certificates.ts`: Emissão via worker desacoplado, validação pública e download do PDF.
- `verify_frontend.ts`: Entrega de ativos estáticos sem framework e SPA fallback.
- `verify_course_completion.ts`: Ciclo de vida ponta a ponta de conclusão e revalidação de certificados.

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais detalhes.
