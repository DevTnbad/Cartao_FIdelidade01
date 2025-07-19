const sqlite3 = require('better-sqlite3');

class Database {
  constructor(dbPath = process.env.DB_PATH || 'fidelidade.db', encryptionKey = process.env.SQLITE_KEY) {
    console.log('Inicializando banco de dados:', dbPath);
    this.db = new sqlite3(dbPath);
    this.db.pragma(`key = '${encryptionKey}'`);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('integrity_check');
    console.log('Criando tabela de clientes, se não existir');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clientes (
        clienteId TEXT PRIMARY KEY,
        pontos INTEGER DEFAULT 0
      )
    `);
  }

  getPontos(clienteId) {
    const stmt = this.db.prepare('SELECT pontos FROM clientes WHERE clienteId = ?');
    const row = stmt.get(clienteId);
    return row ? row.pontos : 0;
  }

  addPontos(clienteId, pontos) {
    const stmtSelect = this.db.prepare('SELECT pontos FROM clientes WHERE clienteId = ?');
    let currentPontos = stmtSelect.get(clienteId)?.pontos || 0;

    const stmtUpsert = this.db.prepare(`
      INSERT INTO clientes (clienteId, pontos)
      VALUES (?, ?)
      ON CONFLICT(clienteId) DO UPDATE SET pontos = pontos + ?
    `);
    stmtUpsert.run(clienteId, currentPontos + pontos, pontos);

    return currentPontos + pontos;
  }

  resgatarPontos(clienteId, pontos) {
    const stmtSelect = this.db.prepare('SELECT pontos FROM clientes WHERE clienteId = ?');
    const currentPontos = stmtSelect.get(clienteId)?.pontos || 0;

    const stmtUpdate = this.db.prepare('UPDATE clientes SET pontos = ? WHERE clienteId = ?');
    stmtUpdate.run(currentPontos - pontos, clienteId);

    return currentPontos - pontos;
  }

  close() {
    console.log('Fechando conexão com o banco de dados');
    this.db.close();
  }
}

module.exports = Database;