const express = require('express');
const bcrypt = require('bcrypt');
const Database = require('./database');
const path = require('path');
require('dotenv').config(); // Adiciona o dotenv

const app = express();
const port = process.env.PORT || 3000;

// Middleware para parsing de JSON e servir arquivos estáticos
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Log para verificar se a rota raiz está sendo acessada
app.get('/', (req, res) => {
  console.log('Servindo index.html');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializa o banco de dados com a chave do .env
const db = new Database('fidelidade.db', process.env.SQLITE_KEY);

// Senha do lojista (hash para "admin123", substitua pelo seu hash gerado)
const SENHA_LOJISTA_HASH = '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// Função para validar e-mail ou telefone
function validarIdentificador(id) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const telefoneRegex = /^\+?\d{10,15}$/;
  return emailRegex.test(id) || telefoneRegex.test(id);
}

// Rota para verificar pontos do cliente
app.post('/verificar-pontos', async (req, res) => {
  const { clienteId, consentimento } = req.body;
  console.log('Requisição para /verificar-pontos:', { clienteId, consentimento });

  if (!consentimento) {
    return res.status(400).json({ error: 'Você deve concordar com o uso dos dados.' });
  }

  if (!validarIdentificador(clienteId)) {
    return res.status(400).json({ error: 'Por favor, insira um e-mail ou telefone válido.' });
  }

  try {
    const pontos = await db.getPontos(clienteId);
    res.json({ pontos });
  } catch (error) {
    console.error('Erro ao verificar pontos:', error);
    res.status(500).json({ error: 'Erro ao verificar pontos.' });
  }
});

// Rota para adicionar pontos
app.post('/adicionar-pontos', async (req, res) => {
  const { senha, clienteId, pontos } = req.body;
  console.log('Requisição para /adicionar-pontos:', { clienteId, pontos });

  const isSenhaValida = await bcrypt.compare(senha, SENHA_LOJISTA_HASH);
  if (!isSenhaValida) {
    console.log('Senha incorreta fornecida');
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  if (!validarIdentificador(clienteId)) {
    return res.status(400).json({ error: 'Por favor, insira um e-mail ou telefone válido.' });
  }

  if (isNaN(pontos) || pontos < 1 || pontos > 100) {
    return res.status(400).json({ error: 'Por favor, insira uma quantidade de pontos válida (1-100).' });
  }

  try {
    const novosPontos = await db.addPontos(clienteId, pontos);
    res.json({ message: `Adicionado ${pontos} pontos. Total: ${novosPontos} pontos.` });
  } catch (error) {
    console.error('Erro ao adicionar pontos:', error);
    res.status(500).json({ error: 'Erro ao adicionar pontos.' });
  }
});

// Rota para resgatar recompensa
app.post('/resgatar-recompensa', async (req, res) => {
  const { senha, clienteId } = req.body;
  console.log('Requisição para /resgatar-recompensa:', { clienteId });
  const PONTOS_PARA_RECOMPENSA = 10;

  const isSenhaValida = await bcrypt.compare(senha, SENHA_LOJISTA_HASH);
  if (!isSenhaValida) {
    console.log('Senha incorreta fornecida');
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  if (!validarIdentificador(clienteId)) {
    return res.status(400).json({ error: 'Por favor, insira um e-mail ou telefone válido.' });
  }

  try {
    const pontos = await db.getPontos(clienteId);
    if (pontos < PONTOS_PARA_RECOMPENSA) {
      return res.status(400).json({ error: `Pontos insuficientes. Necessário: ${PONTOS_PARA_RECOMPENSA}, disponível: ${pontos}.` });
    }

    const novosPontos = await db.resgatarPontos(clienteId, PONTOS_PARA_RECOMPENSA);
    res.json({ message: `Recompensa resgatada! Pontos restantes: ${novosPontos}.` });
  } catch (error) {
    console.error('Erro ao resgatar recompensa:', error);
    res.status(500).json({ error: 'Erro ao resgatar recompensa.' });
  }
});

// Inicia o servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});