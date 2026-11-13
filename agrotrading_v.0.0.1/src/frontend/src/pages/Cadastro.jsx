import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const vazio = { tipo: 'produtor', nome: '', documento: '', cidade: '', telefone: '', email: '', senha: '', endereco: '', responsavel: '' };

export default function Cadastro() {
  const nav = useNavigate();
  const [f, setF] = useState(vazio);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const comprador = f.tipo === 'comprador';

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    try {
      const r = await api('/auth/cadastro', { method: 'POST', body: f });
      setOk(r.mensagem);
      setTimeout(() => nav('/login'), 1500);
    } catch (err) { setErro(err.message); }
  }

  return (
    <form className="card estreito" onSubmit={enviar}>
      <h1>Cadastro</h1>
      {erro && <p className="erro">{erro}</p>}
      {ok && <p className="ok">{ok}</p>}
      <label>Sou
        <select value={f.tipo} onChange={set('tipo')}>
          <option value="produtor">Produtor rural</option>
          <option value="comprador">Comprador (mercado / hortifruti / restaurante)</option>
        </select>
      </label>
      <label>{comprador ? 'Razão social' : 'Nome'}<input required value={f.nome} onChange={set('nome')} /></label>
      <label>{comprador ? 'CNPJ' : 'CPF ou CNPJ'}<input required value={f.documento} onChange={set('documento')} placeholder="somente números" /></label>
      {comprador && <label>Endereço<input required value={f.endereco} onChange={set('endereco')} /></label>}
      {comprador && <label>Responsável<input required value={f.responsavel} onChange={set('responsavel')} /></label>}
      <label>Cidade<input required value={f.cidade} onChange={set('cidade')} /></label>
      <label>Telefone / WhatsApp<input required value={f.telefone} onChange={set('telefone')} placeholder="11999999999" /></label>
      <label>E-mail<input type="email" required value={f.email} onChange={set('email')} /></label>
      <label>Senha (mín. 8 caracteres)<input type="password" required minLength={8} value={f.senha} onChange={set('senha')} /></label>
      <button disabled={!!ok}>Cadastrar</button>
      <p>Já tem conta? <Link to="/login">Entrar</Link></p>
    </form>
  );
}
