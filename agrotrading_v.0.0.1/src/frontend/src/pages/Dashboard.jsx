import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function Cartao({ rotulo, valor, destaque }) {
  return <div className={`kpi ${destaque ? 'destaque' : ''}`}><span>{valor ?? '—'}</span><small>{rotulo}</small></div>;
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api('/dashboard').then(setD).catch((e) => setErro(e.message)); }, []);

  if (!d) return erro ? <p className="erro">{erro}</p> : <p>Carregando…</p>;
  return (
    <>
      <h1>Dashboard</h1>
      <div className="kpis">
        {d.tipo === 'produtor' ? (
          <>
            <Cartao rotulo="Lotes ativos" valor={d.lotes_ativos} />
            <Cartao rotulo="Lotes arrematados" valor={d.lotes_arrematados} />
          </>
        ) : (
          <Cartao rotulo="Lotes com meus lances ativos" valor={d.lotes_com_meus_lances} />
        )}
        <Cartao rotulo="Pedidos em andamento" valor={d.pedidos_em_andamento} />
        <Cartao rotulo="Pedidos concluídos" valor={d.pedidos_concluidos} />
        <Cartao rotulo="Média de avaliação" valor={d.media_avaliacao ? `★ ${d.media_avaliacao}` : null} />
        <Cartao rotulo="Taxa de conclusão (meta ≥ 70%)" valor={d.taxa_conclusao != null ? `${d.taxa_conclusao}%` : null} destaque />
      </div>
      <p>
        <Link to="/lotes">Ver lotes em leilão</Link> · <Link to="/pedidos">Meus pedidos</Link>
        {d.tipo === 'produtor' && <> · <Link to="/lotes/novo">Cadastrar novo lote</Link></>}
      </p>
    </>
  );
}
