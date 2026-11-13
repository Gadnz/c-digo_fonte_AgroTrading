// US01 / US02 - Cadastro e login. Perfil publico com media de avaliacoes (US08).
const express = require('express');
const bcrypt = require('bcryptjs');
const { HttpError, apenasDigitos, cpfValido, cnpjValido, emailValido } = require('../util');
const { gerarToken, autenticar } = require('../auth');

const BCRYPT_COST = 12;
const SENHA_MIN = 8;
// Hash falso: login de e-mail inexistente gasta o mesmo tempo que um real (evita enumerar e-mails pelo tempo de resposta).
const HASH_FALSO = bcrypt.hashSync('senha-falsa-para-igualar-o-tempo', BCRYPT_COST);

module.exports = (db) => {
  const r = express.Router();

  r.post('/auth/cadastro', (req, res) => {
    const b = req.body || {};
    const tipo = b.tipo;
    if (!['produtor', 'comprador'].includes(tipo)) throw new HttpError(400, 'Informe o tipo: produtor ou comprador.');

    const nome = String(b.nome || '').trim();
    const cidade = String(b.cidade || '').trim();
    const telefone = apenasDigitos(b.telefone);
    const email = String(b.email || '').trim().toLowerCase();
    const documento = apenasDigitos(b.documento);
    const senha = String(b.senha || '');
    const endereco = String(b.endereco || '').trim();
    const responsavel = String(b.responsavel || '').trim();

    const faltando = [];
    if (!nome) faltando.push(tipo === 'comprador' ? 'razão social' : 'nome');
    if (!documento) faltando.push(tipo === 'comprador' ? 'CNPJ' : 'CPF/CNPJ');
    if (!cidade) faltando.push('cidade');
    if (!telefone) faltando.push('telefone/WhatsApp');
    if (!email) faltando.push('e-mail');
    if (!senha) faltando.push('senha');
    if (tipo === 'comprador') {
      if (!endereco) faltando.push('endereço');
      if (!responsavel) faltando.push('responsável');
    }
    if (faltando.length) throw new HttpError(400, `Campos obrigatórios não preenchidos: ${faltando.join(', ')}.`);

    // Limites de tamanho (evita lixo e abuso de armazenamento)
    if (nome.length > 120 || cidade.length > 80 || endereco.length > 200 || responsavel.length > 120 || email.length > 254) {
      throw new HttpError(400, 'Um ou mais campos excedem o tamanho permitido.');
    }
    if (!emailValido(email)) throw new HttpError(400, 'E-mail inválido.');
    if (senha.length < SENHA_MIN) throw new HttpError(400, `A senha deve ter ao menos ${SENHA_MIN} caracteres.`);
    if (senha.length > 72) throw new HttpError(400, 'A senha deve ter no máximo 72 caracteres.'); // limite do bcrypt
    if (telefone.length < 10 || telefone.length > 13) throw new HttpError(400, 'Telefone/WhatsApp inválido.');

    if (tipo === 'comprador') {
      if (!cnpjValido(documento)) throw new HttpError(400, 'CNPJ inválido.');
    } else if (!cpfValido(documento) && !cnpjValido(documento)) {
      throw new HttpError(400, 'CPF/CNPJ inválido.');
    }

    if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) {
      throw new HttpError(409, 'E-mail já cadastrado.');
    }
    if (db.prepare('SELECT 1 FROM usuarios WHERE documento = ?').get(documento)) {
      throw new HttpError(409, documento.length === 14 ? 'CNPJ já cadastrado.' : 'CPF já cadastrado.');
    }

    const hash = bcrypt.hashSync(senha, BCRYPT_COST); // senha nunca e salva em texto puro
    const info = db
      .prepare(
        `INSERT INTO usuarios (tipo, nome, documento, cidade, telefone, email, senha_hash, endereco, responsavel)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(tipo, nome, documento, cidade, telefone, email, hash, endereco || null, responsavel || null);

    res.status(201).json({ mensagem: 'Cadastro realizado com sucesso', id: info.lastInsertRowid });
  });

  r.post('/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const senha = String(req.body?.senha || '').slice(0, 72);
    const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    const confere = bcrypt.compareSync(senha, u ? u.senha_hash : HASH_FALSO);
    if (!u || !confere) throw new HttpError(401, 'E-mail ou senha incorretos.');
    res.json({
      token: gerarToken(u),
      usuario: { id: u.id, tipo: u.tipo, nome: u.nome, cidade: u.cidade, email: u.email },
    });
  });

  r.get('/usuarios/me', autenticar, (req, res) => {
    const u = db
      .prepare('SELECT id, tipo, nome, cidade, email, telefone, endereco, responsavel FROM usuarios WHERE id = ?')
      .get(req.usuario.id);
    if (!u) throw new HttpError(404, 'Usuário não encontrado.');
    res.json(u);
  });

  // Perfil publico: nao expoe documento, e-mail nem telefone.
  r.get('/usuarios/:id/perfil', autenticar, (req, res) => {
    const u = db.prepare('SELECT id, tipo, nome, cidade FROM usuarios WHERE id = ?').get(req.params.id);
    if (!u) throw new HttpError(404, 'Usuário não encontrado.');
    const resumo = db
      .prepare('SELECT ROUND(AVG(nota),2) AS media, COUNT(*) AS total FROM avaliacoes WHERE avaliado_id = ?')
      .get(u.id);
    const avaliacoes = db
      .prepare(
        `SELECT a.nota, a.comentario, a.criado_em, us.nome AS avaliador
           FROM avaliacoes a JOIN usuarios us ON us.id = a.avaliador_id
          WHERE a.avaliado_id = ? ORDER BY a.id DESC LIMIT 20`
      )
      .all(u.id);
    res.json({ ...u, media: resumo.media, total_avaliacoes: resumo.total, avaliacoes });
  });

  return r;
};
