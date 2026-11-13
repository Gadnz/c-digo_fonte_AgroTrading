// Funcoes auxiliares: validacao de CPF/CNPJ, datas e erros HTTP.

class HttpError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const apenasDigitos = (s) => String(s ?? '').replace(/\D/g, '');

function cpfValido(valor) {
  const c = apenasDigitos(valor);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(c[i]) * (t + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(c[t])) return false;
  }
  return true;
}

function cnpjValido(valor) {
  const c = apenasDigitos(valor);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const calc = (t) => {
    const pesos = t === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, p, i) => acc + p * Number(c[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

// Data local no formato AAAA-MM-DD (evita o desvio de fuso do toISOString).
function hoje() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const emailValido = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

module.exports = { HttpError, apenasDigitos, cpfValido, cnpjValido, hoje, dataValida, emailValido };
