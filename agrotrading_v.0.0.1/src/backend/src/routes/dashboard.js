// Dashboard: lotes ativos, pedidos em andamento, media de avaliacao + KPI "taxa de conclusao".
const express = require('express');
const { autenticar } = require('../auth');
const { hoje } = require('../util');

module.exports = (db) => {
  const r = express.Router();

  r.get('/dashboard', autenticar, (req, res) => {
    const { id, tipo } = req.usuario;
    const col = tipo === 'produtor' ? 'produtor_id' : 'comprador_id';

    const pedidos = db.prepare(`SELECT * FROM pedidos WHERE ${col} = ?`).all(id);
    const finais = ['Retirado/Concluído', 'Entregue/Concluído'];
    const concluidos = pedidos.filter((p) => finais.includes(p.status)).length;
    const media = db.prepare('SELECT ROUND(AVG(nota),2) AS media, COUNT(*) AS total FROM avaliacoes WHERE avaliado_id = ?').get(id);

    const base = {
      tipo,
      pedidos_em_andamento: pedidos.length - concluidos,
      pedidos_concluidos: concluidos,
      // KPI: Taxa de conclusao = (pedidos concluidos / pedidos realizados) x 100. Meta >= 70%.
      taxa_conclusao: pedidos.length ? Math.round((concluidos / pedidos.length) * 1000) / 10 : null,
      media_avaliacao: media.media,
      total_avaliacoes: media.total,
    };

    if (tipo === 'produtor') {
      base.lotes_ativos = db
        .prepare("SELECT COUNT(*) AS n FROM lotes WHERE produtor_id = ? AND status = 'ativo' AND validade >= ?")
        .get(id, hoje()).n;
      base.lotes_arrematados = db.prepare("SELECT COUNT(*) AS n FROM lotes WHERE produtor_id = ? AND status = 'arrematado'").get(id).n;
    } else {
      base.lotes_com_meus_lances = db
        .prepare(
          `SELECT COUNT(DISTINCT la.lote_id) AS n FROM lances la JOIN lotes l ON l.id = la.lote_id
            WHERE la.comprador_id = ? AND l.status = 'ativo' AND l.validade >= ?`
        )
        .get(id, hoje()).n;
    }
    res.json(base);
  });

  return r;
};
