const express = require('express');
const bcrypt = require('bcrypt');
const Database = require('./database');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const SENHA_LOJISTA_HASH = process.env.SENHA_LOJISTA_HASH || '$2b$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de autenticação
const authenticate = async (req, res, next) => {
  const { senha } = req.body || req.query;
  const isAuthenticated = req.cookies.authenticated;

  console.log('Verificando autenticação - Senha:', senha, 'Cookie:', isAuthenticated, 'Método:', req.method, 'URL:', req.url);

  if (!isAuthenticated && !senha) {
    console.log('Nenhuma senha ou cookie de autenticação fornecidos');
    if (req.method === 'GET') {
      console.log('Redirecionando para /login');
      return res.redirect('/login');
    } else {
      console.log('Retornando erro 401 para requisição não GET');
      return res.status(401).json({ error: 'Autenticação necessária. Faça login.' });
    }
  }

  if (senha) {
    const isSenhaValida = await bcrypt.compare(senha, SENHA_LOJISTA_HASH);
    if (!isSenhaValida) {
      console.log('Senha incorreta fornecida:', senha, 'Hash comparado:', SENHA_LOJISTA_HASH);
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    console.log('Autenticação bem-sucedida com senha:', senha);
    res.cookie('authenticated', 'true', { httpOnly: true }); // Removido maxAge, agora é sessão
  } else if (isAuthenticated) {
    console.log('Autenticação bem-sucedida via cookie');
  }

  next();
};

// Rota raiz com redirecionamento forçado
app.get('/', (req, res) => {
  console.log('Acessando / - Redirecionando para /login');
  res.redirect('/login');
});

// Aplicar authenticate a outras rotas
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/consultar-pontos') return next();
  authenticate(req, res, next);
});

app.get('/login', (req, res) => {
  console.log('Servindo login.html');
  res.clearCookie('authenticated');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/cadastro', (req, res) => {
  console.log('Servindo cadastro.html');
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

app.get('/registros', (req, res) => {
  console.log('Servindo registros.html');
  res.sendFile(path.join(__dirname, 'public', 'registros.html'));
});

app.get('/consultar-pontos', (req, res) => {
  console.log('Servindo consultar-pontos.html');
  res.sendFile(path.join(__dirname, 'public', 'consultar-pontos.html'));
});

const db = new Database(process.env.DB_PATH, process.env.SQLITE_KEY);

app.post('/login', async (req, res) => {
  const { senha } = req.body;
  console.log('Tentativa de login com senha recebida:', senha);
  console.log('Hash de senha no servidor:', SENHA_LOJISTA_HASH);
  const isSenhaValida = await bcrypt.compare(senha, SENHA_LOJISTA_HASH);
  if (isSenhaValida) {
    console.log('Login bem-sucedido');
    res.cookie('authenticated', 'true', { httpOnly: true });
    res.json({ message: 'Login bem-sucedido', redirect: '/cadastro' });
  } else {
    console.log('Senha incorreta');
    res.status(401).json({ error: 'Senha incorreta.' });
  }
});

app.post('/cadastrar-procedimento', async (req, res) => {
  const { senha, nome, email, telefone, procedimento, data, valor, pontos } = req.body;
  console.log('Requisição para /cadastrar-procedimento:', { senha, nome, email, telefone, procedimento, data, valor, pontos });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Por favor, insira um e-mail válido.' });
  }
  if (!nome || !/^[A-Za-zÀ-ÿ0-9\s]{2,}$/.test(nome)) {
    return res.status(400).json({ error: 'O nome deve conter pelo menos 2 caracteres e pode incluir letras, números e espaços.' });
  }
  if (telefone && !/^\d{8,15}$/.test(telefone)) {
    return res.status(400).json({ error: 'Digite um telefone válido (8 a 15 dígitos).'});
  }
  if (!procedimento || !/^[A-Za-zÀ-ÿ0-9\s]{2,}$/.test(procedimento)) {
    return res.status(400).json({ error: 'O procedimento deve conter pelo menos 2 caracteres e pode incluir letras, números e espaços.' });
  }
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ error: 'Por favor, insira uma data válida.' });
  }
  if (!valor || isNaN(valor) || parseFloat(valor) <= 0) {
    return res.status(400).json({ error: 'Digite um valor válido.' });
  }
  if (pontos && (isNaN(pontos) || parseInt(pontos) < 0)) {
    return res.status(400).json({ error: 'Digite um número inteiro positivo para pontos.' });
  }

  if (!req.cookies.authenticated) {
    const isSenhaValida = await bcrypt.compare(senha, SENHA_LOJISTA_HASH);
    if (!isSenhaValida) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    res.cookie('authenticated', 'true', { httpOnly: true });
  }

  try {
    let procedimentoId = null;
    const procCadastrado = db.getProcedimentosCadastrados().find(p => p.nome === procedimento);
    let novoProcedimento = false;
    if (procCadastrado) {
      procedimentoId = procCadastrado.id;
    } else {
      db.addProcedimentoCadastrado(procedimento, parseFloat(valor) || 0, 0);
      procedimentoId = db.getProcedimentosCadastrados().find(p => p.nome === procedimento).id;
      novoProcedimento = true;
    }

    let novoCliente = false;
    if (!db.checkClienteExists(email)) {
      db.addCliente(email, nome, telefone);
      novoCliente = true;
    }

    const finalPontos = pontos ? parseInt(pontos) : db.getProcedimentoCadastrado(procedimentoId).pontos_padrao;
    db.addProcedimentoRealizado(email, procedimentoId, data, parseFloat(valor), finalPontos);
    const novosPontos = await db.getPontos(email);

    let message = `Procedimento cadastrado! Pontos totais: ${novosPontos}.`;
    if (novoCliente) message += ' Novo e-mail cadastrado.';
    if (novoProcedimento) message += ' Novo procedimento cadastrado.';
    res.json({ message });
  } catch (error) {
    console.error('Erro ao cadastrar procedimento:', error);
    res.status(500).json({ error: 'Erro ao cadastrar procedimento: ' + error.message });
  }
});

app.get('/listar-registros', async (req, res) => {
  try {
    const registros = await db.getProcedimentosRealizados();
    res.json(registros);
  } catch (error) {
    console.error('Erro ao listar registros:', error);
    res.status(500).json({ error: 'Erro ao listar registros: ' + error.message });
  }
});

app.get('/listar-procedimentos-cadastrados', async (req, res) => {
  try {
    const procedimentos = await db.getProcedimentosCadastrados();
    res.json(procedimentos);
  } catch (error) {
    console.error('Erro ao listar procedimentos cadastrados:', error);
    res.status(500).json({ error: 'Erro ao listar procedimentos cadastrados: ' + error.message });
  }
});

app.get('/listar-clientes', async (req, res) => {
  try {
    const clientes = await db.getClientes();
    res.json(clientes);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao listar clientes: ' + error.message });
  }
});

app.post('/consultar-pontos', async (req, res) => {
  const { email } = req.body;
  console.log('Requisição para /consultar-pontos:', { email });

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Por favor, insira um e-mail válido.' });
  }

  try {
    const pontos = await db.getPontos(email);
    res.json({ pontos, email });
  } catch (error) {
    console.error('Erro ao consultar pontos:', error);
    res.status(500).json({ error: 'Erro ao consultar pontos: ' + error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${port}`);
});