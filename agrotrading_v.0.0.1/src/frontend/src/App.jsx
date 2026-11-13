import { useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { getAuth, setAuth } from './api.js';
import Login from './pages/Login.jsx';
import Cadastro from './pages/Cadastro.jsx';
import Lotes from './pages/Lotes.jsx';
import LoteDetalhe from './pages/LoteDetalhe.jsx';
import NovoLote from './pages/NovoLote.jsx';
import MeusLotes from './pages/MeusLotes.jsx';
import Pedidos from './pages/Pedidos.jsx';
import Perfil from './pages/Perfil.jsx';
import Dashboard from './pages/Dashboard.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function Privado({ tipo, children }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (tipo && auth.usuario.tipo !== tipo) return <Navigate to="/" replace />;
  return children;
}

// Ícone de folha (SVG) usado no logo
function Folha() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}

function Menu() {
  const { auth, sair } = useAuth();
  const nav = useNavigate();
  const u = auth?.usuario;
  return (
    <header className="topo">
      <NavLink to="/" className="logo"><Folha /><strong>Agro<span>Trading</span></strong></NavLink>
      {u && (
        <nav>
          <NavLink to="/lotes">Lotes</NavLink>
          {u.tipo === 'produtor' && <NavLink to="/meus-lotes">Meus Lotes</NavLink>}
          {u.tipo === 'produtor' && <NavLink to="/lotes/novo">Novo Lote</NavLink>}
          <NavLink to="/pedidos">Meus Pedidos</NavLink>
          <NavLink to={`/perfil/${u.id}`}>Avaliações</NavLink>
          <span className="usuario">{u.nome} ({u.tipo})</span>
          <button className="link" onClick={() => { sair(); nav('/login'); }}>Sair</button>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  const [auth, setAuthState] = useState(getAuth());
  const value = {
    auth,
    entrar: (a) => { setAuth(a); setAuthState(a); },
    sair: () => { setAuth(null); setAuthState(null); },
  };
  return (
    <AuthCtx.Provider value={value}>
      <Menu />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/" element={<Privado><Dashboard /></Privado>} />
          <Route path="/lotes" element={<Privado><Lotes /></Privado>} />
          <Route path="/lotes/novo" element={<Privado tipo="produtor"><NovoLote /></Privado>} />
          <Route path="/lotes/:id" element={<Privado><LoteDetalhe /></Privado>} />
          <Route path="/meus-lotes" element={<Privado tipo="produtor"><MeusLotes /></Privado>} />
          <Route path="/pedidos" element={<Privado><Pedidos /></Privado>} />
          <Route path="/perfil/:id" element={<Privado><Perfil /></Privado>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </AuthCtx.Provider>
  );
}
