import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, brl, dataSimples } from '../api.js';

// US04 - Produtor -> Produto -> Qtd -> Qualidade -> Preço -> Prazo
export default function Lotes() {
  const [filtros, setFiltros] = useState({ produto: '', cidade: '', qualidade: '', condicao: '', ordem: 'preco' });
  const [lotes, setLotes] = useState(null);
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setFiltros({ ...filtros, [k]: e.target.value });

  useEffect(() => {
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();
    api(`/lotes?${qs}`).then(setLotes).catch((e) => setErro(e.message));
  }, [filtros]);

  return (
    <>
      <h1>Lotes em leilão</h1>
      <div className="card filtros">
        <input placeholder="Produto (ex.: batata)" value={filtros.produto} onChange={set('produto')} />
        <input placeholder="Cidade" value={filtros.cidade} onChange={set('cidade')} />
        <select value={filtros.qualidade} onChange={set('qualidade')}>
          <option value="">Qualidade: todas</option><option>A</option><option>B</option><option>C</option>
        </select>
        <select value={filtros.condicao} onChange={set('condicao')}>
          <option value="">Entrega ou retirada</option><option value="entrega">Entrega</option><option value="retirada">Retirada</option>
        </select>
        <select value={filtros.ordem} onChange={set('ordem')}>
          <option value="preco">Ordenar: menor preço</option><option value="prazo">Ordenar: menor prazo</option>
        </select>
      </div>
      {erro && <p className="erro">{erro}</p>}
      {lotes && lotes.length === 0 && <p>Nenhum lote ativo encontrado com esses filtros.</p>}
      {lotes && lotes.length > 0 && (
        <table>
          <thead>
            <tr><th>Produtor</th><th>Produto</th><th>Qtd</th><th>Qualidade</th><th>Preço atual</th><th>Prazo</th><th>Cidade</th><th>Tipo</th><th></th></tr>
          </thead>
          <tbody>
            {lotes.map((l) => (
              <tr key={l.id}>
                <td><Link to={`/perfil/${l.produtor_id}`}>{l.produtor_nome}</Link></td>
                <td>{l.produto}</td>
                <td>{l.quantidade_kg} kg</td>
                <td>{l.qualidade}</td>
                <td>{brl(l.preco_atual)} <small>({l.total_lances} lances)</small></td>
                <td>{dataSimples(l.validade)}</td>
                <td>{l.cidade}</td>
                <td>{l.condicao}</td>
                <td><Link to={`/lotes/${l.id}`}>Ver / dar lance</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
