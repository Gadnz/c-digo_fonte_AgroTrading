// JWT + middlewares de autenticacao/autorizacao.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { HttpError } = require('./util');

// O segredo NUNCA fica no codigo-fonte. Em producao ele e obrigatorio.
// Em desenvolvimento, sem JWT_SECRET, usa um segredo aleatorio temporario (sessoes caem ao reiniciar).
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Defina a variável de ambiente JWT_SECRET antes de iniciar em produção.');
  }
  SECRET = crypto.randomBytes(48).toString('hex');
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[aviso] JWT_SECRET não definido: usando segredo temporário (as sessões expiram a cada reinício).');
  }
} else if (SECRET.length < 32) {
  throw new Error('JWT_SECRET muito curto: use ao menos 32 caracteres.');
}

const ALG = 'HS256';

const gerarToken = (u) => jwt.sign({ id: u.id, tipo: u.tipo }, SECRET, { algorithm: ALG, expiresIn: '8h' });

function autenticar(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Autenticação necessária.'));
  try {
    // Fixa o algoritmo aceito (evita ataques de troca de algoritmo).
    req.usuario = jwt.verify(token, SECRET, { algorithms: [ALG] });
    next();
  } catch {
    next(new HttpError(401, 'Sessão inválida ou expirada. Faça login novamente.'));
  }
}

const exigirTipo = (tipo) => (req, _res, next) =>
  req.usuario.tipo === tipo
    ? next()
    : next(new HttpError(403, `Apenas ${tipo}es podem realizar esta ação.`));

module.exports = { gerarToken, autenticar, exigirTipo };
