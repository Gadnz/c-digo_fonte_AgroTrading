// US03 (cadastro de lote), US04 (busca/comparacao), US05 (lances), US06 (aceite -> pedido).
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { HttpError, hoje, dataValida } = require('../util');
const { autenticar, exigirTipo } = require('../auth');
const { criarPedido } = require('./pedidos');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// A extensao vem do tipo MIME validado, nunca do nome enviado pelo cliente
// (evita salvar "foto.html" como se fosse imagem e servi-la depois).
const EXTENSOES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + EXTENSOES[file.mimetype]),
  }),
  limits: { fileSize: 2 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) =>
    EXTENSOES[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Envie fotos JPG, PNG ou WEBP.')),
});

const QUALIDADES = ['A', 'B', 'C'];
const CONDICOES = ['entrega', 'retirada'];

// Escapa % e _ para que o texto digitado na busca seja tratado como texto comum.
const like = (s) => `%${String(s).slice(0, 80).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// Preco atual = maior lance, ou o preco inicial enquanto nao ha lances.
const SELECT_LOTE = `
  SELECT l.*, u.nome AS produtor_nome,
         COALESCE((SELECT MAX(valor) FROM lances WHERE lote_id = l.id), l.preco_inicial) AS preco_atual,
         (SELECT COUNT(*) FROM lances WHERE lote_id = l.id) AS total_lances
    FROM lotes l JOIN usuarios u ON u.id = l.produtor_id`;

const formatar = (l) => ({ ...l, fotos: JSON.parse(l.fotos).map((f) => `/uploads/${f}`) });

module.exports = (db) => {
  const r = express.Router();

  // US03 - cadastrar lote
  r.post('/lotes', autenticar, exigirTipo('produtor'), upload.array('fotos', 3), (req, res) => {
    const b = req.body || {};
    const produto = String(b.produto || '').trim();
    const quantidade = Number(b.quantidade_kg);
    const preco = Number(b.preco_inicial);
    const cidade = String(b.cidade || '').trim();
    const qualidade = String(b.qualidade || '').toUpperCase();
    const condicao = String(b.condicao || '').toLowerCase();
    const validade = String(b.validade || '');

    if (!produto) throw new HttpError(400, 'Informe o produto.');
    if (produto.length > 80 || cidade.length > 80) throw new HttpError(400, 'Produto e cidade aceitam até 80 caracteres.');
    if (!(quantidade > 0) || !Number.isFinite(quantidade)) throw new HttpError(400, 'A quantidade (kg) deve ser maior que zero.');
    if (!QUALIDADES.includes(qualidade)) throw new HttpError(400, 'Qualidade deve ser A, B ou C.');
    if (!(preco > 0) || !Number.isFinite(preco)) throw new HttpError(400, 'O preço inicial deve ser maior que zero.');
    if (!dataValida(validade)) throw new HttpError(400, 'Informe a validade no formato AAAA-MM-DD.');
    if (validade < hoje()) throw new HttpError(400, 'A validade não pode estar no passado.');
    if (!cidade) throw new HttpError(400, 'Informe a cidade de origem.');
    if (!CONDICOES.includes(condicao)) throw new HttpError(400, 'Condição deve ser "entrega" ou "retirada".');

    const fotos = (req.files || []).map((f) => f.filename);
    const info = db
      .prepare(
        `INSERT INTO lotes (produtor_id, produto, quantidade_kg, qualidade, preco_inicial, validade, cidade, condicao, fotos)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(req.usuario.id, produto, quantidade, qualidade, preco, validade, cidade, condicao, JSON.stringify(fotos));

    // O lote nasce com status "ativo" e ja aparece na listagem.
    const lote = db.prepare(`${SELECT_LOTE} WHERE l.id = ?`).get(info.lastInsertRowid);
    res.status(201).json(formatar(lote));
  });

  // US04 - listar/comparar lotes ativos (Produtor -> Produto -> Qtd -> Qualidade -> Preco -> Prazo)
  r.get('/lotes', autenticar, (req, res) => {
    const { produto, cidade, qualidade, condicao, ordem } = req.query;
    const where = ["l.status = 'ativo'", 'l.validade >= ?'];
    const params = [hoje()];
    if (produto) { where.push("l.produto LIKE ? ESCAPE '\\'"); params.push(like(produto)); }
    if (cidade) { where.push("l.cidade LIKE ? ESCAPE '\\'"); params.push(like(cidade)); }
    if (qualidade) { where.push('l.qualidade = ?'); params.push(String(qualidade).toUpperCase()); }
    if (condicao) { where.push('l.condicao = ?'); params.push(String(condicao).toLowerCase()); }

    // Ordenacao por menor preco e prazo (menor primeiro). Valores fixos: nada do cliente entra no SQL.
    const orderBy = ordem === 'prazo' ? 'l.validade ASC, preco_atual ASC' : 'preco_atual ASC, l.validade ASC';
    const lotes = db.prepare(`${SELECT_LOTE} WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`).all(...params);
    res.json(lotes.map(formatar));
  });

  // Lotes do produtor logado (qualquer status) - painel de lances
  r.get('/lotes/meus', autenticar, exigirTipo('produtor'), (req, res) => {
    const lotes = db.prepare(`${SELECT_LOTE} WHERE l.produtor_id = ? ORDER BY l.id DESC`).all(req.usuario.id);
    res.json(lotes.map(formatar));
  });

  r.get('/lotes/:id', autenticar, (req, res) => {
    const lote = db.prepare(`${SELECT_LOTE} WHERE l.id = ?`).get(req.params.id);
    if (!lote) throw new HttpError(404, 'Lote não encontrado.');
    const lances = db
      .prepare(
        `SELECT la.id, la.valor, la.criado_em, la.comprador_id, u.nome AS comprador_nome
           FROM lances la JOIN usuarios u ON u.id = la.comprador_id
          WHERE la.lote_id = ? ORDER BY la.valor DESC, la.id ASC`
      )
      .all(lote.id);
    res.json({ ...formatar(lote), lances });
  });

  // US05 - dar lance
  r.post('/lotes/:id/lances', autenticar, exigirTipo('comprador'), (req, res) => {
    const valor = Number(req.body?.valor);
    if (!(valor > 0) || !Number.isFinite(valor)) throw new HttpError(400, 'Informe um valor de lance válido.');

    const tx = db.transaction(() => {
      const lote = db.prepare(`${SELECT_LOTE} WHERE l.id = ?`).get(req.params.id);
      if (!lote) throw new HttpError(404, 'Lote não encontrado.');
      if (lote.status !== 'ativo') throw new HttpError(409, 'Este lote não está mais ativo para lances.');
      if (lote.validade < hoje()) throw new HttpError(409, 'O prazo deste lote expirou.');
      if (lote.total_lances === 0 && valor < lote.preco_inicial) {
        throw new HttpError(400, `O primeiro lance deve ser de no mínimo R$ ${lote.preco_inicial.toFixed(2)}.`);
      }
      if (lote.total_lances > 0 && valor <= lote.preco_atual) {
        throw new HttpError(400, `O lance deve ser maior que o lance atual (R$ ${lote.preco_atual.toFixed(2)}).`);
      }
      const info = db
        .prepare('INSERT INTO lances (lote_id, comprador_id, valor) VALUES (?,?,?)')
        .run(lote.id, req.usuario.id, valor);
      return db.prepare('SELECT * FROM lances WHERE id = ?').get(info.lastInsertRowid);
    });
    res.status(201).json(tx());
  });

  // US06 - produtor aceita um lance (por padrao, o maior) -> lote arrematado + pedido automatico
  r.post('/lotes/:id/aceitar', autenticar, exigirTipo('produtor'), (req, res) => {
    const tx = db.transaction(() => {
      const lote = db.prepare('SELECT * FROM lotes WHERE id = ?').get(req.params.id);
      if (!lote) throw new HttpError(404, 'Lote não encontrado.');
      if (lote.produtor_id !== req.usuario.id) throw new HttpError(403, 'Este lote pertence a outro produtor.');
      if (lote.status !== 'ativo') throw new HttpError(409, 'Este lote já foi arrematado.');

      const lance = req.body?.lance_id
        ? db.prepare('SELECT * FROM lances WHERE id = ? AND lote_id = ?').get(req.body.lance_id, lote.id)
        : db.prepare('SELECT * FROM lances WHERE lote_id = ? ORDER BY valor DESC, id ASC LIMIT 1').get(lote.id);
      if (!lance) throw new HttpError(400, 'Não há lances para aceitar neste lote.');

      db.prepare("UPDATE lotes SET status = 'arrematado' WHERE id = ?").run(lote.id);
      return criarPedido(db, lote, lance);
    });
    res.status(201).json(tx());
  });

  return r;
};
