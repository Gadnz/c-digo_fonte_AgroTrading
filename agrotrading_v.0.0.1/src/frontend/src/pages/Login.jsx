import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Login() {
  const { entrar } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', senha: '' });
  const [erro, setErro] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    try {
      entrar(await api('/auth/login', { method: 'POST', body: f }));
      nav('/');
    } catch (err) { setErro(err.message); }
  }

  return (
    <form className="card estreito" onSubmit={enviar}>
      <h1>Entrar</h1>
      {erro && <p className="erro">{erro}</p>}
      <label>E-mail<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label>Senha<input type="password" required value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} /></label>
      <button>Entrar</button>
      <p>Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </form>
  );
}
