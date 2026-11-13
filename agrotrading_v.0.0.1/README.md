# AgroTrading — Código-fonte

Plataforma de leilão de frutas, legumes e verduras que conecta produtores rurais a mercados, hortifrútis e restaurantes.

**Stack:** Node.js + Express + SQLite (backend) · React + Vite (frontend) · JWT + bcrypt (autenticação).

## Como executar

Pré-requisito: Node.js 18 ou superior.

### Opção 1 — Desenvolvimento (2 terminais)

```bash
# Terminal 1 — API em http://localhost:3001
cd src/backend
npm install
npm start

# Terminal 2 — interface em http://localhost:5173
cd src/frontend
npm install
npm run dev
```

### Opção 2 — Tudo em uma porta (modo demonstração)

```bash
cd src/frontend && npm install && npm run build
cd ../backend && npm install && npm start
# abra http://localhost:3001
```

O banco SQLite é criado sozinho em `src/backend/data/agrotrading.db` na primeira execução.

### Testes automatizados

```bash
cd src/backend && npm test
```

Cobrem o fluxo completo das US01–US08 (11 testes).

### Variáveis de ambiente (opcionais)

| Variável | Padrão | Uso |
|----------|--------|-----|
| `PORT` | 3001 | Porta da API |
| `JWT_SECRET` | aleatório temporário (só em desenvolvimento) | **Obrigatório em produção (`NODE_ENV=production`), mín. 32 caracteres.** Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `NODE_ENV` | — | Use `production` ao publicar: exige `JWT_SECRET` |
| `CORS_ORIGIN` | `http://localhost:5173` | Origens permitidas na API (separe por vírgula) |
| `BACKUPS_MANTER` | 14 | Quantos backups do banco o script mantém |
| `DB_FILE` | `backend/data/agrotrading.db` | Caminho do banco |
| `UPLOAD_DIR` | `backend/uploads` | Pasta das fotos dos lotes |

## Segurança e backup

- Senhas com bcrypt (custo 12), mínimo de 8 caracteres; JWT fixado em HS256 com expiração de 8 h.
- `helmet` (cabeçalhos de segurança), CORS restrito, limite de tamanho do corpo (100 kb) e limite de tentativas de login (10 por 15 min) e de cadastro.
- Consultas SQL sempre parametrizadas; uploads aceitam só JPG/PNG/WEBP e a extensão vem do tipo validado.
- O arquivo do banco é criado com permissão `600` (Linux/macOS). Nunca envie `data/`, `uploads/` ou `.env` ao GitHub (já estão no `.gitignore`).
- Backup do banco: `cd src/backend && npm run backup` (gera `data/backups/agrotrading-AAAA-MM-DD_HH-MM-SS.db`).

## Estrutura

```
src/
├── backend/
│   ├── src/
│   │   ├── server.js, app.js      # inicialização e middlewares
│   │   ├── db.js                  # esquema SQLite
│   │   ├── auth.js, util.js       # JWT, validação de CPF/CNPJ, datas
│   │   └── routes/                # usuarios, lotes, pedidos, dashboard
│   └── tests/fluxo.test.js
└── frontend/src/                  # App.jsx, api.js e pages/
```

## Rastreabilidade: história → implementação

| História | Endpoints (`/api`) | Tela |
|----------|--------------------|------|
| US01 Cadastro do produtor | `POST /auth/cadastro`, `POST /auth/login` | Cadastro, Login |
| US02 Cadastro do comprador | `POST /auth/cadastro` (CNPJ único e validado) | Cadastro |
| US03 Cadastro de lote | `POST /lotes` (até 3 fotos) | Novo Lote |
| US04 Busca e comparação | `GET /lotes?produto&cidade&qualidade&condicao&ordem` | Lotes |
| US05 Lances | `POST /lotes/:id/lances`, `GET /lotes/:id` | Detalhe do lote |
| US06 Aceite e pedido | `POST /lotes/:id/aceitar` | Painel de lances |
| US07 Acompanhamento | `GET /pedidos`, `PATCH /pedidos/:id/status` | Meus Pedidos |
| US08 Avaliação mútua | `POST /pedidos/:id/avaliacoes`, `GET /usuarios/:id/perfil` | Meus Pedidos, Avaliações |
| Dashboard / KPI taxa de conclusão | `GET /dashboard` | Dashboard |

## Regras de negócio implementadas

- E-mail único; CPF/CNPJ único e com dígitos verificadores válidos; comprador exige CNPJ. Senha com hash (bcrypt).
- Lote nasce `ativo`. Quantidade e preço > 0, validade não pode estar no passado, qualidade A/B/C, entrega ou retirada.
- Lotes vencidos ou arrematados saem da listagem. Ordenação por menor preço ou menor prazo.
- Lance: somente comprador, somente em lote ativo; o primeiro deve ser ≥ preço inicial e os seguintes > lance atual.
- Aceite: somente o produtor dono; lote vira `arrematado`, gera o pedido (numeração a partir de #101) e libera o contato das partes.
- Status do pedido avança manualmente (sem GPS): retirada → Confirmado, Em Separação, Pronto para Retirada, Retirado; entrega → Confirmado, Em Separação, Saiu para Entrega, Entregue. Cada mudança registra data/hora e mensagem.
- Avaliação (nota 1–5 + comentário): só após o pedido concluído, só entre as duas partes, uma por pessoa. O perfil exibe média e histórico.

## Fora do escopo desta entrega

- **KPI "Tempo médio para encontrar uma oferta":** exige instrumentar a busca no frontend; fica para a Sprint 3. A taxa de conclusão já está no dashboard.
- E-mails automáticos de atualização de pedido (o README do escopo prevê "e-mail simples").
- Pagamento e frete são combinados fora da plataforma (WhatsApp), conforme o escopo.
