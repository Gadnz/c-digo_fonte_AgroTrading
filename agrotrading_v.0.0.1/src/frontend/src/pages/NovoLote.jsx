import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

// US03 - cadastro de lote (até 3 fotos)
export default function NovoLote() {
  const nav = useNavigate();
  const [f, setF] = useState({ produto: '', quantidade_kg: '', qualidade: 'A', preco_inicial: '', validade: '', cidade: '', condicao: 'entrega' });
  const [fotos, setFotos] = useState([]);
  const [erro, setErro] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function escolherFotos(e) {
    const arq = [...e.target.files];
    if (arq.length > 3) { setErro('Selecione no máximo 3 fotos.'); e.target.value = ''; setFotos([]); return; }
    setErro(''); setFotos(arq);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => form.append(k, v));
    fotos.forEach((a) => form.append('fotos', a));
    try {
      const lote = await api('/lotes', { method: 'POST', form });
      nav(`/lotes/${lote.id}`);
    } catch (err) { setErro(err.message); }
  }

  return (
    <form className="card estreito" onSubmit={enviar}>
      <h1>Cadastrar lote</h1>
      {erro && <p className="erro">{erro}</p>}
      <label>Produto<input required value={f.produto} onChange={set('produto')} placeholder="Batata, tomate, alface…" /></label>
      <label>Quantidade (kg)<input type="number" min="0.1" step="0.1" required value={f.quantidade_kg} onChange={set('quantidade_kg')} /></label>
      <label>Qualidade
        <select value={f.qualidade} onChange={set('qualidade')}><option>A</option><option>B</option><option>C</option></select>
      </label>
      <label>Preço inicial (R$)<input type="number" min="0.01" step="0.01" required value={f.preco_inicial} onChange={set('preco_inicial')} /></label>
      <label>Validade do lote<input type="date" required value={f.validade} onChange={set('validade')} /></label>
      <label>Cidade de origem<input required value={f.cidade} onChange={set('cidade')} /></label>
      <label>Condição
        <select value={f.condicao} onChange={set('condicao')}>
          <option value="entrega">Entrega</option><option value="retirada">Retirada no local</option>
        </select>
      </label>
      <label>Fotos (até 3, JPG/PNG, 2 MB cada)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={escolherFotos} /></label>
      <button>Publicar lote</button>
    </form>
  );
}
