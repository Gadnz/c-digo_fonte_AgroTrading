// Testes de ponta a ponta das US01-US08 (usa banco em memoria e o runner nativo do Node).
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'agrotrading-test-uploads');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createDb } = require('../src/db');
const { createApp } = require('../src/app');
const { cpfValido, cnpjValido, hoje } = require('../src/util');

// Geradores de documentos validos para os testes
function gerarCpf(base) {
  const d = base.split('').map(Number);
  for (const t of [9, 10]) {
    const s = d.reduce((a, n, i) => a + n * (t + 1 - i), 0);
    d.push(((s * 10) % 11) % 10);
  }
  return d.join('');
}
function gerarCnpj(base) {
  const d = base.split('').map(Number);
  for (const t of [12, 13]) {
    const p = t === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = d.reduce((a, n, i) => a + n * p[i], 0) % 11;
    d.push(r < 2 ? 0 : 11 - r);
  }
  return d.join('');
}
const CPF = gerarCpf('123456789');
const CNPJ_A = gerarCnpj('112223330001');
const CNPJ_B = gerarCnpj('445556660001');

let server, base, db;
test.before(async () => {
  db = createDb(':memory:');
  server = createApp(db).listen(0);
  base = `http://localhost:${server.address().port}/api`;
});
test.after(() => server.close());

async function api(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
const amanha = () => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); };

const produtor = { tipo: 'produtor', nome: 'Sítio Boa Terra', documento: CPF, cidade: 'Mogi das Cruzes', telefone: '11999990000', email: 'prod@teste.com', senha: 'segredo1' };
const comprador = { tipo: 'comprador', nome: 'Mercado Central Ltda', documento: CNPJ_A, cidade: 'São Paulo', telefone: '1133334444', email: 'comp@teste.com', senha: 'segredo2', endereco: 'Rua A, 10', responsavel: 'Maria' };
const comprador2 = { ...comprador, nome: 'Hortifruti Sol', documento: CNPJ_B, email: 'sol@teste.com' };

const tk = {};
let loteId;

test('validadores de CPF/CNPJ', () => {
  assert.ok(cpfValido(CPF));
  assert.ok(!cpfValido('11111111111'));
  assert.ok(cnpjValido(CNPJ_A));
  assert.ok(!cnpjValido('12345678000100'));
});

test('US01/US02: cadastro, duplicidade e validações', async () => {
  let r = await api('POST', '/auth/cadastro', { body: produtor });
  assert.equal(r.status, 201);
  assert.equal(r.data.mensagem, 'Cadastro realizado com sucesso');

  r = await api('POST', '/auth/cadastro', { body: { ...produtor, documento: gerarCpf('987654321') } });
  assert.equal(r.status, 409); // e-mail repetido
  assert.match(r.data.erro, /E-mail já cadastrado/);

  assert.equal((await api('POST', '/auth/cadastro', { body: comprador })).status, 201);
  r = await api('POST', '/auth/cadastro', { body: { ...comprador, email: 'outro@teste.com' } });
  assert.equal(r.status, 409);
  assert.match(r.data.erro, /CNPJ já cadastrado/);

  r = await api('POST', '/auth/cadastro', { body: { ...comprador, email: 'x@x.com', documento: '12345678000100' } });
  assert.equal(r.status, 400); // CNPJ invalido
  r = await api('POST', '/auth/cadastro', { body: { tipo: 'produtor', nome: 'x' } });
  assert.equal(r.status, 400);

  assert.equal((await api('POST', '/auth/cadastro', { body: comprador2 })).status, 201);

  // senha armazenada com hash
  const row = db.prepare('SELECT senha_hash FROM usuarios WHERE email = ?').get('prod@teste.com');
  assert.notEqual(row.senha_hash, 'segredo1');
  assert.match(row.senha_hash, /^\$2[aby]\$/);
});

test('Login com JWT', async () => {
  let r = await api('POST', '/auth/login', { body: { email: 'prod@teste.com', senha: 'errada' } });
  assert.equal(r.status, 401);
  for (const [k, u] of [['p', produtor], ['c', comprador], ['c2', comprador2]]) {
    r = await api('POST', '/auth/login', { body: { email: u.email, senha: u.senha } });
    assert.equal(r.status, 200);
    tk[k] = r.data.token;
    tk[k + 'Id'] = r.data.usuario.id;
  }
  assert.equal((await api('GET', '/lotes')).status, 401); // sem token
});

test('US03: cadastro de lote com validações', async () => {
  const ok = { produto: 'Batata', quantidade_kg: 100, qualidade: 'A', preco_inicial: 4.5, validade: amanha(), cidade: 'Mogi das Cruzes', condicao: 'entrega' };
  let r = await api('POST', '/lotes', { token: tk.p, body: { ...ok, quantidade_kg: 0 } });
  assert.equal(r.status, 400);
  r = await api('POST', '/lotes', { token: tk.p, body: { ...ok, preco_inicial: -1 } });
  assert.equal(r.status, 400);
  r = await api('POST', '/lotes', { token: tk.p, body: { ...ok, validade: '2000-01-01' } });
  assert.equal(r.status, 400);
  r = await api('POST', '/lotes', { token: tk.c, body: ok });
  assert.equal(r.status, 403); // comprador nao cria lote

  r = await api('POST', '/lotes', { token: tk.p, body: ok });
  assert.equal(r.status, 201);
  assert.equal(r.data.status, 'ativo');
  loteId = r.data.id;

  await api('POST', '/lotes', { token: tk.p, body: { ...ok, produto: 'Tomate', qualidade: 'B', preco_inicial: 3, condicao: 'retirada', cidade: 'Suzano' } });
});

test('US04: busca, filtros e ordenação', async () => {
  let r = await api('GET', '/lotes', { token: tk.c });
  assert.equal(r.data.length, 2);
  assert.equal(r.data[0].produto, 'Tomate'); // menor preço primeiro
  r = await api('GET', '/lotes?produto=bata', { token: tk.c });
  assert.equal(r.data.length, 1);
  r = await api('GET', '/lotes?qualidade=B&condicao=retirada&cidade=suz', { token: tk.c });
  assert.equal(r.data.length, 1);
  r = await api('GET', '/lotes?qualidade=C', { token: tk.c });
  assert.equal(r.data.length, 0);

  // lote vencido nao aparece
  db.prepare("INSERT INTO lotes (produtor_id,produto,quantidade_kg,qualidade,preco_inicial,validade,cidade,condicao) VALUES (?,?,?,?,?,?,?,?)")
    .run(tk.pId, 'Alface', 10, 'A', 2, '2000-01-01', 'X', 'entrega');
  r = await api('GET', '/lotes', { token: tk.c });
  assert.equal(r.data.length, 2);
});

test('US05: lances respeitam regras', async () => {
  let r = await api('POST', `/lotes/${loteId}/lances`, { token: tk.c, body: { valor: 4 } });
  assert.equal(r.status, 400); // abaixo do preço inicial
  r = await api('POST', `/lotes/${loteId}/lances`, { token: tk.p, body: { valor: 5 } });
  assert.equal(r.status, 403); // produtor nao da lance
  r = await api('POST', `/lotes/${loteId}/lances`, { token: tk.c, body: { valor: 4.6 } });
  assert.equal(r.status, 201);
  r = await api('POST', `/lotes/${loteId}/lances`, { token: tk.c2, body: { valor: 4.6 } });
  assert.equal(r.status, 400); // igual ao atual
  r = await api('POST', `/lotes/${loteId}/lances`, { token: tk.c2, body: { valor: 5 } });
  assert.equal(r.status, 201);

  r = await api('GET', `/lotes/${loteId}`, { token: tk.c });
  assert.equal(r.data.lances.length, 2);
  assert.equal(r.data.preco_atual, 5);
  assert.ok(r.data.lances[0].criado_em);
});

test('US06: aceite gera pedido #101 e tira o lote da listagem', async () => {
  let r = await api('POST', `/lotes/${loteId}/aceitar`, { token: tk.c2 });
  assert.equal(r.status, 403);
  r = await api('POST', `/lotes/${loteId}/aceitar`, { token: tk.p });
  assert.equal(r.status, 201);
  assert.equal(r.data.pedido_id, 101);
  assert.equal(r.data.valor, 5);
  assert.equal(r.data.contato_vencedor.nome, 'Hortifruti Sol');

  r = await api('GET', '/lotes', { token: tk.c });
  assert.ok(!r.data.some((l) => l.id === loteId));
  r = await api('POST', `/lotes/${loteId}/lances`, { token: tk.c, body: { valor: 9 } });
  assert.equal(r.status, 409);
  r = await api('POST', `/lotes/${loteId}/aceitar`, { token: tk.p });
  assert.equal(r.status, 409);
});

test('US07: acompanhamento do pedido (entrega)', async () => {
  let r = await api('PATCH', '/pedidos/101/status', { token: tk.c2 });
  assert.equal(r.status, 403);

  r = await api('GET', '/pedidos', { token: tk.c2 });
  assert.equal(r.data[0].status, 'Pedido Confirmado');
  assert.equal(r.data[0].pode_avaliar, false);

  r = await api('POST', '/pedidos/101/avaliacoes', { token: tk.c2, body: { nota: 5 } });
  assert.equal(r.status, 409); // ainda nao concluido

  const vistos = [];
  for (let i = 0; i < 3; i++) {
    r = await api('PATCH', '/pedidos/101/status', { token: tk.p });
    assert.equal(r.status, 200);
    vistos.push(r.data.status);
  }
  assert.deepEqual(vistos, ['Em Separação/Preparação', 'Saiu para Entrega', 'Entregue/Concluído']);
  r = await api('PATCH', '/pedidos/101/status', { token: tk.p });
  assert.equal(r.status, 409);

  r = await api('GET', '/pedidos/101', { token: tk.c2 });
  assert.equal(r.data.historico.length, 4);
  assert.equal(r.data.historico[1].mensagem, 'Seu pedido #101 está em preparação');
  assert.equal(r.data.historico[2].mensagem, 'Seu pedido #101 saiu para entrega');
  assert.ok(r.data.historico.every((h) => h.criado_em));
  assert.equal((await api('GET', '/pedidos/101', { token: tk.c })).status, 404); // outro comprador
});

test('US08: avaliação mútua só após conclusão, só participantes, uma vez', async () => {
  let r = await api('POST', '/pedidos/101/avaliacoes', { token: tk.c, body: { nota: 1 } });
  assert.equal(r.status, 403); // nao participou
  r = await api('POST', '/pedidos/101/avaliacoes', { token: tk.c2, body: { nota: 6 } });
  assert.equal(r.status, 400);
  r = await api('POST', '/pedidos/101/avaliacoes', { token: tk.c2, body: { nota: 5, comentario: 'Tudo certo', criterios: { quantidade_correta: true } } });
  assert.equal(r.status, 201);
  r = await api('POST', '/pedidos/101/avaliacoes', { token: tk.c2, body: { nota: 4 } });
  assert.equal(r.status, 409);
  r = await api('POST', '/pedidos/101/avaliacoes', { token: tk.p, body: { nota: 4, comentario: 'Pagou no prazo' } });
  assert.equal(r.status, 201);

  r = await api('GET', `/usuarios/${tk.pId}/perfil`, { token: tk.c });
  assert.equal(r.data.media, 5);
  assert.equal(r.data.total_avaliacoes, 1);
  assert.ok(!('email' in r.data) && !('documento' in r.data));
  r = await api('GET', `/usuarios/${tk.c2Id}/perfil`, { token: tk.p });
  assert.equal(r.data.media, 4);
});

test('Dashboard e taxa de conclusão', async () => {
  let r = await api('GET', '/dashboard', { token: tk.p });
  assert.equal(r.data.lotes_ativos, 1); // Tomate
  assert.equal(r.data.lotes_arrematados, 1);
  assert.equal(r.data.pedidos_concluidos, 1);
  assert.equal(r.data.taxa_conclusao, 100);
  assert.equal(r.data.media_avaliacao, 5);
  r = await api('GET', '/dashboard', { token: tk.c });
  assert.equal(r.data.lotes_com_meus_lances, 0);
  assert.equal(r.data.taxa_conclusao, null);
});

test('Fluxo de retirada tem etapas próprias', async () => {
  const lote = (await api('GET', '/lotes', { token: tk.c })).data.find((l) => l.produto === 'Tomate');
  await api('POST', `/lotes/${lote.id}/lances`, { token: tk.c, body: { valor: 3.5 } });
  const r = await api('POST', `/lotes/${lote.id}/aceitar`, { token: tk.p });
  assert.equal(r.data.pedido_id, 102);
  const passos = [];
  for (let i = 0; i < 3; i++) passos.push((await api('PATCH', '/pedidos/102/status', { token: tk.p })).data.status);
  assert.deepEqual(passos, ['Em Separação/Preparação', 'Pronto para Retirada', 'Retirado/Concluído']);
});
