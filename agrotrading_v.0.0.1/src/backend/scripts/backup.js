// Backup consistente do banco SQLite (seguro mesmo com a API em execucao).
// Uso: npm run backup   -> gera data/backups/agrotrading-AAAA-MM-DD_HH-MM-SS.db e mantem os 14 mais recentes.
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const origem = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'agrotrading.db');
const MANTER = Number(process.env.BACKUPS_MANTER || 14);

if (!fs.existsSync(origem)) {
  console.error(`Banco não encontrado em ${origem}. Inicie a API ao menos uma vez antes de fazer backup.`);
  process.exit(1);
}

const pasta = path.join(path.dirname(origem), 'backups');
fs.mkdirSync(pasta, { recursive: true });

const agora = new Date();
const p = (n) => String(n).padStart(2, '0');
const carimbo = `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}_${p(agora.getHours())}-${p(agora.getMinutes())}-${p(agora.getSeconds())}`;
const destino = path.join(pasta, `agrotrading-${carimbo}.db`);

const db = new Database(origem, { readonly: true });
db.backup(destino)
  .then(() => {
    try { fs.chmodSync(destino, 0o600); } catch { /* Windows */ }
    console.log(`Backup criado: ${destino}`);
    // Remove os mais antigos, mantendo apenas os N mais recentes.
    const antigos = fs.readdirSync(pasta).filter((f) => /^agrotrading-.*\.db$/.test(f)).sort().reverse().slice(MANTER);
    for (const f of antigos) fs.unlinkSync(path.join(pasta, f));
    if (antigos.length) console.log(`${antigos.length} backup(s) antigo(s) removido(s).`);
  })
  .catch((e) => { console.error('Falha no backup:', e.message); process.exitCode = 1; })
  .finally(() => db.close());
