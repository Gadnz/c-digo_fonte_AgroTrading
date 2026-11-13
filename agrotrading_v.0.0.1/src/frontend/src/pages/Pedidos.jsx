import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, brl, dataBR } from '../api.js';
import { useAuth } from '../App.jsx';

// US07 (acompanhamento) e US08 (avaliação) - aba "Meus Pedidos"
function Avaliar({ pedido, onFeito }) {
  const souProdutor = useAuth().auth.usuario.tipo === 'produtor';
  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState('');
  const [crit, setCrit] = useState({});
  const [erro, setErro] = useState('');
  const itens = souProdutor
    ? [['pagamento_no_prazo', 'Retirada/pagamento no prazo?']]
    : [['produto_conforme_foto', 'Produto conforme a foto?'], ['quantidade_correta', 'Quantidade correta?'], ['qualidade_ok', 'Qualidade conforme o anunciado?']];

  async function enviar(e) {
    e.preventDefault(); setErro('');
    try {
      await api(`/pedidos/${pedido.id}/avaliacoes`, { method: 'POST', body: { nota, comentario, criterios: crit } });
      onFeito();
    } catch (err) { setErro(err.message); }
  }

  return (
    <form className="avaliar" onSubmit={enviar}>
      <strong>Avaliar {souProdutor ? 'o comprador' : 'o produtor'}</strong>
      {erro && <p className="erro">{erro}</p>}
      {itens.map(([k, rotulo]) => (
        <label key={k} className="check"><input type="checkbox" onChange={(e) => setCrit({ ...crit, [k]: e.target.checked })} /> {rotulo}</label>
      ))}
      <label>Nota
        <select value={nota} onChange={(e) => setNota(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <label>Comentário<textarea maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} /></label>
      <button>Enviar avaliação</button>
    </form>
  );
}

export default function Pedidos() {
  const { auth } = useAuth();
  const souProdutor = auth.usuario.tipo === 'produtor';
  const [pedidos, setPedidos] = useState(null);
  const [erro, setErro] = useState('');
  const carregar = useCallback(() => api('/pedidos').then(setPedidos).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  async function avancar(id) {
    setErro('');
    try { await api(`/pedidos/${id}/status`, { method: 'PATCH' }); carregar(); } catch (e) { setErro(e.message); }
  }

  return (
    <>
      <h1>Meus pedidos</h1>
      {erro && <p className="erro">{erro}</p>}
      {pedidos && pedidos.length === 0 && <p>Nenhum pedido ainda.</p>}
      {pedidos?.map((p) => (
        <div className="card" key={p.id}>
          <h2>Pedido #{p.id} — {p.produto} ({p.quantidade_kg} kg) · {brl(p.valor)}</h2>
          <p>
            Status: <span className="tag">{p.status}</span> · {p.condicao === 'entrega' ? 'Entrega' : 'Retirada'} ·{' '}
            {souProdutor ? 'Comprador' : 'Produtor'}: <Link to={`/perfil/${p.contato.id}`}>{p.contato.nome}</Link> — WhatsApp {p.contato.telefone} · {p.contato.email}
          </p>
          <p className="etapas">{p.fluxo.map((s) => <span key={s} className={s === p.status ? 'atual' : ''}>{s}</span>)}</p>
          <ul className="historico">
            {p.historico.map((h, i) => <li key={i}><small>{dataBR(h.criado_em)}</small> {h.mensagem}</li>)}
          </ul>
          {souProdutor && p.proximo_status && <button onClick={() => avancar(p.id)}>Atualizar Status → {p.proximo_status}</button>}
          {p.pode_avaliar && <Avaliar pedido={p} onFeito={carregar} />}
          {p.ja_avaliou && <p className="ok">Você já avaliou este pedido.</p>}
        </div>
      ))}
    </>
  );
}
