// US06 (geracao do pedido), US07 (acompanhamento) e US08 (avaliacao mutua).
const express = require('express');
const { HttpError } = require('../util');
const { autenticar, exigirTipo } = require('../auth');

const FLUXOS = {
  retirada: ['Pedido Confirmado', 'Em Separação/Preparação', 'Pronto para Retirada', 'Retirado/Concluído'],
  entrega: ['Pedido Confirmado', 'Em Separação/Preparação', 'Saiu para Entrega', 'Entregue/Concluído'],
};

const mensagem = (id, status) =>
  ({
    'Pedido Confirmado': `Seu pedido #${id} foi confirmado`,
    'Em Separação/Preparação': `Seu pedido #${id} está em preparação`,
    'Pronto para Retirada': `Seu pedido #${id} está pronto para retirada`,
    'Saiu para Entrega': `Seu pedido #${id} saiu para entrega`,
    'Retirado/Concluído': `Seu pedido #${id} foi retirado. Pedido concluído`,
    'Entregue/Concluído': `Seu pedido #${id} foi entregue. Pedido concluído`,
  })[status];

const concluido = (p) => p.status === FLUXOS[p.condicao].at(-1);

// Chamada dentro da transacao de "aceitar lance" (routes/lotes.js).
function criarPedido(db, lote, lance) {
  const ultimo = db.prepare('SELECT MAX(id) AS m FROM pedidos').get().m || 100;
  const id = ultimo + 1; // primeiro pedido = #101
  const status = FLUXOS[lote.condicao][0];
  db.prepare(
    `INSERT INTO pedidos (id, lote_id, lance_id, produtor_id, comprador_id, valor, condicao, status)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(id, lote.id, lance.id, lote.produtor_id, lance.comprador_id, lance.valor, lote.condicao, status);
  db.prepare('INSERT INTO pedido_historico (pedido_id, status, mensagem) VALUES (?,?,?)').run(
    id, status, mensagem(id, status)
  );
  const comprador = db
    .prepare('SELECT nome, telefone, email FROM usuarios WHERE id = ?')
    .get(lance.comprador_id);
  return { pedido_id: id, lote_id: lote.id, valor: lance.valor, status, contato_vencedor: comprador };
}

function detalhar(db, p, usuarioId) {
  const lote = db.prepare('SELECT produto, quantidade_kg, qualidade, cidade FROM lotes WHERE id = ?').get(p.lote_id);
  const outroId = usuarioId === p.produtor_id ? p.comprador_id : p.produtor_id;
  // O contato da outra parte e liberado apos o aceite, para combinar pagamento/frete (fora da plataforma).
  const contato = db.prepare('SELECT id, nome, telefone, email FROM usuarios WHERE id = ?').get(outroId);
  const historico = db
    .prepare('SELECT status, mensagem, criado_em FROM pedido_historico WHERE pedido_id = ? ORDER BY id')
    .all(p.id);
  const fluxo = FLUXOS[p.condicao];
  const idx = fluxo.indexOf(p.status);
  const jaAvaliou = !!db
    .prepare('SELECT 1 FROM avaliacoes WHERE pedido_id = ? AND avaliador_id = ?')
    .get(p.id, usuarioId);
  return {
    ...p,
    ...lote,
    fluxo,
    proximo_status: fluxo[idx + 1] || null,
    concluido: concluido(p),
    contato,
    historico,
    ja_avaliou: jaAvaliou,
    pode_avaliar: concluido(p) && !jaAvaliou,
  };
}

module.exports = (db) => {
  const r = express.Router();

  // "Meus Pedidos" (produtor ou comprador)
  r.get('/pedidos', autenticar, (req, res) => {
    const pedidos = db
      .prepare('SELECT * FROM pedidos WHERE produtor_id = ? OR comprador_id = ? ORDER BY id DESC')
      .all(req.usuario.id, req.usuario.id);
    res.json(pedidos.map((p) => detalhar(db, p, req.usuario.id)));
  });

  r.get('/pedidos/:id', autenticar, (req, res) => {
    const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!p || ![p.produtor_id, p.comprador_id].includes(req.usuario.id)) throw new HttpError(404, 'Pedido não encontrado.');
    res.json(detalhar(db, p, req.usuario.id));
  });

  // US07 - "Atualizar Status": o produtor avanca para a proxima etapa com 1 clique (manual, sem GPS)
  r.patch('/pedidos/:id/status', autenticar, exigirTipo('produtor'), (req, res) => {
    const tx = db.transaction(() => {
      const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
      if (!p || p.produtor_id !== req.usuario.id) throw new HttpError(404, 'Pedido não encontrado.');
      const fluxo = FLUXOS[p.condicao];
      const proximo = fluxo[fluxo.indexOf(p.status) + 1];
      if (!proximo) throw new HttpError(409, 'Este pedido já foi concluído.');
      db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(proximo, p.id);
      db.prepare('INSERT INTO pedido_historico (pedido_id, status, mensagem) VALUES (?,?,?)').run(
        p.id, proximo, mensagem(p.id, proximo)
      );
      return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(p.id);
    });
    res.json(detalhar(db, tx(), req.usuario.id));
  });

  // US08 - avaliacao mutua, liberada somente com o pedido concluido
  r.post('/pedidos/:id/avaliacoes', autenticar, (req, res) => {
    const p = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!p || ![p.produtor_id, p.comprador_id].includes(req.usuario.id)) {
      throw new HttpError(403, 'Somente quem participou do pedido pode avaliar.');
    }
    if (!concluido(p)) throw new HttpError(409, 'A avaliação só é liberada após o pedido ser entregue ou retirado.');

    const nota = Number(req.body?.nota);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new HttpError(400, 'A nota deve ser um número inteiro de 1 a 5.');
    const comentario = String(req.body?.comentario || '').trim().slice(0, 500);

    const euSouProdutor = req.usuario.id === p.produtor_id;
    const avaliado = euSouProdutor ? p.comprador_id : p.produtor_id;
    // Quesitos opcionais: comprador avalia produto/quantidade/qualidade; produtor avalia pagamento/retirada no prazo.
    const campos = euSouProdutor ? ['pagamento_no_prazo'] : ['produto_conforme_foto', 'quantidade_correta', 'qualidade_ok'];
    const criterios = {};
    for (const c of campos) if (typeof req.body?.criterios?.[c] === 'boolean') criterios[c] = req.body.criterios[c];

    try {
      db.prepare(
        'INSERT INTO avaliacoes (pedido_id, avaliador_id, avaliado_id, nota, comentario, criterios) VALUES (?,?,?,?,?,?)'
      ).run(p.id, req.usuario.id, avaliado, nota, comentario, JSON.stringify(criterios));
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw new HttpError(409, 'Você já avaliou este pedido.');
      throw e;
    }
    const resumo = db
      .prepare('SELECT ROUND(AVG(nota),2) AS media, COUNT(*) AS total FROM avaliacoes WHERE avaliado_id = ?')
      .get(avaliado);
    res.status(201).json({ mensagem: 'Avaliação registrada com sucesso', media_do_avaliado: resumo.media });
  });

  return r;
};
module.exports.criarPedido = criarPedido;
