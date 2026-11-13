import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, brl, dataBR, dataSimples } from '../api.js';
import { useAuth } from '../App.jsx';

// US05 (dar lance) e US06 (produtor aceita lance)
export default function LoteDetalhe() {
  const { id } = useParams();
  const { auth } = useAuth();
  const u = auth.usuario;
  const [lote, setLote] = useState(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(() => api(`/lotes/${id}`).then(setLote).catch((e) => setErro(e.message)), [id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function darLance(e) {
    e.preventDefault(); setErro(''); setAviso('');
    try {
      await api(`/lotes/${id}/lances`, { method: 'POST', body: { valor: Number(valor) } });
      setValor(''); setAviso('Lance registrado!'); carregar();
    } catch (err) { setErro(err.message); }
  }

  async function aceitar(lanceId) {
    setErro(''); setAviso('');
    if (!window.confirm('Aceitar este lance? O lote será arrematado e o pedido gerado.')) return;
    try {
      const r = await api(`/lotes/${id}/aceitar`, { method: 'POST', body: { lance_id: lanceId } });
      setAviso(`Pedido #${r.pedido_id} gerado. Contato do vencedor: ${r.contato_vencedor.nome} — WhatsApp ${r.contato_vencedor.telefone}`);
      carregar();
    } catch (err) { setErro(err.message); }
  }

  if (!lote) return erro ? <p className="erro">{erro}</p> : <p>Carregando…</p>;
  const ativo = lote.status === 'ativo';
  const souDono = u.tipo === 'produtor' && lote.produtor_id === u.id;
  const minimo = lote.total_lances ? `maior que ${brl(lote.preco_atual)}` : `no mínimo ${brl(lote.preco_inicial)}`;

  return (
    <>
      <p><Link to="/lotes">← Voltar aos lotes</Link></p>
      <div className="card">
        <h1>{lote.produto} — {lote.quantidade_kg} kg <span className={`tag ${lote.status}`}>{lote.status}</span></h1>
        <p>
          Produtor: <Link to={`/perfil/${lote.produtor_id}`}>{lote.produtor_nome}</Link> · Qualidade {lote.qualidade} · {lote.cidade} · {lote.condicao} · Validade {dataSimples(lote.validade)}
        </p>
        <p className="preco">{brl(lote.preco_atual)} <small>{lote.total_lances ? 'lance atual' : 'preço inicial'}</small></p>
        <div className="fotos">{lote.fotos.map((f) => <img key={f} src={f} alt={`Foto de ${lote.produto}`} />)}</div>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {aviso && <p className="ok">{aviso}</p>}

      {ativo && u.tipo === 'comprador' && (
        <form className="card linha" onSubmit={darLance}>
          <label>Seu lance (R$) — {minimo}
            <input type="number" step="0.01" min="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} />
          </label>
          <button>Dar lance</button>
        </form>
      )}

      <h2>{souDono ? 'Painel de lances recebidos' : 'Histórico de lances'}</h2>
      {lote.lances.length === 0 ? <p>Nenhum lance ainda.</p> : (
        <table>
          <thead><tr><th>Comprador</th><th>Valor</th><th>Data/hora</th>{souDono && ativo && <th></th>}</tr></thead>
          <tbody>
            {lote.lances.map((l, i) => (
              <tr key={l.id}>
                <td>{l.comprador_nome}{i === 0 && ' 🏆'}</td><td>{brl(l.valor)}</td><td>{dataBR(l.criado_em)}</td>
                {souDono && ativo && <td><button onClick={() => aceitar(l.id)}>Aceitar lance</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {souDono && !ativo && <p><Link to="/pedidos">Ver o pedido gerado em “Meus Pedidos”</Link></p>}
    </>
  );
}
