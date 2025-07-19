const sqlite3 = require('better-sqlite3');

class Database {
  constructor(dbPath = process.env.DB_PATH || 'fidelidade.db', encryptionKey = process.env.SQLITE_KEY) {
    console.log('Inicializando banco de dados:', dbPath);
    this.db = new sqlite3(dbPath);
    this.db.pragma(`key = '${encryptionKey}'`);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('integrity_check');
    console.log('Criando tabelas, se não existirem');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clientes (
        email TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        telefone TEXT,
        pontos INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS procedimentos_cadastrados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        valor_padrao REAL NOT NULL,
        pontos_padrao INTEGER NOT NULL,
        UNIQUE (nome)
      );
      CREATE TABLE IF NOT EXISTS procedimentos_realizados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        procedimento_id INTEGER,
        data TEXT NOT NULL,
        valor REAL NOT NULL,
        pontos INTEGER NOT NULL,
        FOREIGN KEY (email) REFERENCES clientes (email),
        FOREIGN KEY (procedimento_id) REFERENCES procedimentos_cadastrados (id)
      )
    `);
  }

  getPontos(email) {
    const stmt = this.db.prepare('SELECT pontos FROM clientes WHERE email = ?');
    const row = stmt.get(email);
    console.log('Consultando pontos para email:', email, 'Resultado:', row ? row.pontos : 0);
    return row ? row.pontos : 0;
  }

  addCliente(email, nome, telefone = null) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO clientes (email, nome, telefone, pontos)
      VALUES (?, ?, ?, 0)
    `);
    console.log('Tentando adicionar cliente:', { email, nome, telefone });
    const result = stmt.run(email, nome, telefone);
    console.log('Resultado da inserção de cliente:', result.changes ? 'Sucesso' : 'Ignorado (já existe)');
    return result;
  }

  addPontos(email, pontos) {
    const stmtSelect = this.db.prepare('SELECT pontos FROM clientes WHERE email = ?');
    let currentPontos = stmtSelect.get(email)?.pontos || 0;
    console.log('Pontos atuais para', email, ':', currentPontos);

    const stmtUpsert = this.db.prepare(`
      UPDATE clientes SET pontos = pontos + ? WHERE email = ?
    `);
    const result = stmtUpsert.run(pontos, email);
    console.log('Atualizando pontos para', email, 'por', pontos, 'Resultado:', result.changes);
    return currentPontos + pontos;
  }

  resgatarPontos(email, pontos) {
    const stmtSelect = this.db.prepare('SELECT pontos FROM clientes WHERE email = ?');
    const currentPontos = stmtSelect.get(email)?.pontos || 0;

    const stmtUpdate = this.db.prepare('UPDATE clientes SET pontos = ? WHERE email = ?');
    stmtUpdate.run(currentPontos - pontos, email);

    return currentPontos - pontos;
  }

  addProcedimentoRealizado(email, procedimentoId, data, valor, pontos) {
    const stmt = this.db.prepare(`
      INSERT INTO procedimentos_realizados (email, procedimento_id, data, valor, pontos)
      VALUES (?, ?, ?, ?, ?)
    `);
    console.log('Tentando adicionar procedimento realizado:', { email, procedimentoId, data, valor, pontos });
    const result = stmt.run(email, procedimentoId, data, valor, pontos);
    console.log('Resultado da inserção de procedimento:', result.changes ? 'Sucesso' : 'Falha');
    this.addPontos(email, pontos);
    return result;
  }

  getProcedimentosRealizados(email = null) {
    let stmt;
    if (email) {
      stmt = this.db.prepare(`
        SELECT pr.id, c.email, c.nome, c.telefone, pc.nome AS procedimento, pr.data, pr.valor, pr.pontos
        FROM procedimentos_realizados pr
        JOIN clientes c ON pr.email = c.email
        JOIN procedimentos_cadastrados pc ON pr.procedimento_id = pc.id
        WHERE pr.email = ?
      `);
      return stmt.all(email);
    } else {
      stmt = this.db.prepare(`
        SELECT pr.id, c.email, c.nome, c.telefone, pc.nome AS procedimento, pr.data, pr.valor, pr.pontos
        FROM procedimentos_realizados pr
        JOIN clientes c ON pr.email = c.email
        JOIN procedimentos_cadastrados pc ON pr.procedimento_id = pc.id
      `);
      return stmt.all();
    }
  }

  getProcedimentosCadastrados() {
    const stmt = this.db.prepare('SELECT id, nome, valor_padrao, pontos_padrao FROM procedimentos_cadastrados');
    return stmt.all();
  }

  addProcedimentoCadastrado(nome, valor_padrao, pontos_padrao) {
    const stmt = this.db.prepare(`
      INSERT INTO procedimentos_cadastrados (nome, valor_padrao, pontos_padrao)
      VALUES (?, ?, ?)
    `);
    console.log('Tentando adicionar procedimento cadastrado:', { nome, valor_padrao, pontos_padrao });
    const result = stmt.run(nome, valor_padrao, pontos_padrao);
    console.log('Resultado da inserção de procedimento cadastrado:', result.changes ? 'Sucesso' : 'Falha');
    return result;
  }

  getClientes() {
    const stmt = this.db.prepare('SELECT email, nome, telefone FROM clientes');
    return stmt.all();
  }

  checkClienteExists(email) {
    const stmt = this.db.prepare('SELECT 1 FROM clientes WHERE email = ?');
    return !!stmt.get(email);
  }

  checkProcedimentoExists(procedimentoId) {
    const stmt = this.db.prepare('SELECT 1 FROM procedimentos_cadastrados WHERE id = ?');
    return !!stmt.get(procedimentoId);
  }

  getProcedimentoCadastrado(procedimentoId) {
    const stmt = this.db.prepare('SELECT * FROM procedimentos_cadastrados WHERE id = ?');
    return stmt.get(procedimentoId);
  }

  close() {
    console.log('Fechando conexão com o banco de dados');
    this.db.close();
  }
}

module.exports = Database;