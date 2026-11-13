const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit'); 
const path = require('path');
const fs = require('fs');
const { HttpError } = require('./util');

const limitador = (opcoes) =>
  rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ erro: 'Muitas requisições. Aguarde alguns minutos e tente novamente.' }),
    ...opcoes,
  });

function createApp(db) {
  const app = express();

  // Cabecalhos de seguranca (CSP, nosniff, HSTS, sem X-Powered-By etc.)
  app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { upgradeInsecureRequests: null } } }));

  // CORS restrito: apenas as origens permitidas (padrao: o Vite em desenvolvimento).
  // Em producao o frontend e servido pela mesma origem, entao nao precisa de CORS.
  const origens = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());
  app.use(cors({ origin: origens }));

  app.use(express.json({ limit: '100kb' }));

  // Protecao contra forca bruta e abuso
  app.use('/api/auth/login', limitador({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true }));
  app.use('/api/auth/cadastro', limitador({ windowMs: 60 * 60 * 1000, limit: 20 }));
  app.use('/api', limitador({ windowMs: 15 * 60 * 1000, limit: 600 }));

  const uploads = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
  app.use('/uploads', express.static(uploads, { index: false, dotfiles: 'deny' }));

  app.get('/api/saude', (_req, res) => res.json({ ok: true }));
  app.use('/api', require('./routes/usuarios')(db));
  app.use('/api', require('./routes/lotes')(db));
  app.use('/api', require('./routes/pedidos')(db));
  app.use('/api', require('./routes/dashboard')(db));

  // Em producao, serve o frontend compilado (src/frontend/dist) na mesma porta.
  const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Rota não encontrada.')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ erro: 'Cada foto pode ter no máximo 2 MB.' });
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT')
      return res.status(400).json({ erro: 'Envie no máximo 3 fotos.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição grande demais.' });
    if (err instanceof SyntaxError) return res.status(400).json({ erro: 'JSON inválido.' });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  });
  return app;
}

module.exports = { createApp };
