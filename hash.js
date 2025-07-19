const bcrypt = require('bcrypt');

// Senha que você deseja hashear (ex.: 'admin123')
const senha = '99jasmim10toddy2025kiara';

// Gera o hash com custo 10
bcrypt.hash(senha, 10, (err, hash) => {
  if (err) {
    console.error('Erro ao gerar hash:', err);
    return;
  }
  console.log('Hash gerado:', hash);
});