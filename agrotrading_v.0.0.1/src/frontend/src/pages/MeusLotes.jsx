import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, brl, dataSimples } from '../api.js';

export default function MeusLotes() {
  const [lotes, setLotes] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api('/lotes/meus').then(setLotes).catch((e) => setErro(e.message)); }, []);

  return (
    <>
      <h1>Meus lotes</h1>
      {erro && <p className="erro">{erro}</p>}
      {lotes && lotes.length === 0 && <p>Você ainda não cadastrou lotes. <Link to="/lotes/novo">Cadastrar o primeiro</Link></p>}
      {lotes && lotes.length > 0 && (
        <table>
          <thead><tr><th>Produto</th><th>Qtd</th><th>Maior lance</th><th>Lances</th><th>Validade</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id}>
                <td>{l.produto}</td><td>{l.quantidade_kg} kg</td><td>{brl(l.preco_atual)}</td>
                <td>{l.total_lances}</td><td>{dataSimples(l.validade)}</td>
                <td><span className={`tag ${l.status}`}>{l.status}</span></td>
                <td><Link to={`/lotes/${l.id}`}>Painel de lances</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
