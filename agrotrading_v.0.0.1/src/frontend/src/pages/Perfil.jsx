import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, dataBR } from '../api.js';

export default function Perfil() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => { api(`/usuarios/${id}/perfil`).then(setP).catch((e) => setErro(e.message)); }, [id]);

  if (!p) return erro ? <p className="erro">{erro}</p> : <p>Carregando…</p>;
  return (
    <>
      <div className="card">
        <h1>{p.nome}</h1>
        <p>{p.tipo} · {p.cidade}</p>
        <p className="preco">{p.media ? `★ ${p.media}` : 'Sem avaliações'} <small>({p.total_avaliacoes} avaliações)</small></p>
      </div>
      <h2>Histórico de avaliações</h2>
      {p.avaliacoes.length === 0 && <p>Ainda não há avaliações.</p>}
      {p.avaliacoes.map((a, i) => (
        <div className="card" key={i}>
          <strong>{'★'.repeat(a.nota)}{'☆'.repeat(5 - a.nota)}</strong> <small>por {a.avaliador} em {dataBR(a.criado_em)}</small>
          {a.comentario && <p>{a.comentario}</p>}
        </div>
      ))}
    </>
  );
}
