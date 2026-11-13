// Camada de banco de dados (SQLite via better-sqlite3).
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('produtor','comprador')),
  nome TEXT NOT NULL,
  documento TEXT NOT NULL UNIQUE,      -- CPF/CNPJ (somente digitos)
  cidade TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  endereco TEXT,
  responsavel TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS lotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produtor_id INTEGER NOT NULL REFERENCES usuarios(id),
  produto TEXT NOT NULL,
  quantidade_kg REAL NOT NULL CHECK (quantidade_kg > 0),
  qualidade TEXT NOT NULL CHECK (qualidade IN ('A','B','C')),
  preco_inicial REAL NOT NULL CHECK (preco_inicial > 0),
  validade TEXT NOT NULL,              -- AAAA-MM-DD
  cidade TEXT NOT NULL,
  condicao TEXT NOT NULL CHECK (condicao IN ('entrega','retirada')),
  fotos TEXT NOT NULL DEFAULT '[]',    -- JSON com nomes dos arquivos
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','arrematado')),
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS lances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id INTEGER NOT NULL REFERENCES lotes(id),
  comprador_id INTEGER NOT NULL REFERENCES usuarios(id),
  valor REAL NOT NULL CHECK (valor > 0),
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY,              -- numeracao comeca em 101
  lote_id INTEGER NOT NULL UNIQUE REFERENCES lotes(id),
  lance_id INTEGER NOT NULL REFERENCES lances(id),
  produtor_id INTEGER NOT NULL REFERENCES usuarios(id),
  comprador_id INTEGER NOT NULL REFERENCES usuarios(id),
  valor REAL NOT NULL,
  condicao TEXT NOT NULL,
  status TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pedido_historico (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  status TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  avaliador_id INTEGER NOT NULL REFERENCES usuarios(id),
  avaliado_id INTEGER NOT NULL REFERENCES usuarios(id),
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criterios TEXT NOT NULL DEFAULT '{}',
  criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  UNIQUE (pedido_id, avaliador_id)
);

CREATE INDEX IF NOT EXISTS idx_lotes_status ON lotes(status);
CREATE INDEX IF NOT EXISTS idx_lances_lote ON lances(lote_id);
`;

function createDb(file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'agrotrading.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (file !== ':memory:') db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  // O arquivo do banco guarda hashes e dados pessoais: so o usuario do servidor deve le-lo (Linux/macOS).
  if (file !== ':memory:') {
    try { fs.chmodSync(file, 0o600); } catch { /* sistemas sem suporte a permissoes (ex.: Windows) */ }
  }
  return db;
}

module.exports = { createDb };
