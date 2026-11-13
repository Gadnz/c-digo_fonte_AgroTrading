// Cliente HTTP simples: anexa o JWT e converte erros da API em Error(mensagem).
const KEY = 'agrotrading_auth';

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
export function setAuth(auth) {
  try {
    if (auth) localStorage.setItem(KEY, JSON.stringify(auth));
    else localStorage.removeItem(KEY);
  } catch { /* armazenamento indisponivel: segue sem persistir */ }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const auth = getAuth();
  const headers = {};
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) { setAuth(null); window.location.assign('/login'); }
  if (!res.ok) throw new Error(data.erro || 'Erro ao comunicar com o servidor.');
  return data;
}

export const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: s.length > 10 ? 'short' : undefined }) : '');
export const dataSimples = (s) => s.split('-').reverse().join('/');
