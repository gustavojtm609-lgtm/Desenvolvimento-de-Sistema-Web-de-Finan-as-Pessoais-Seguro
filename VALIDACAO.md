# Validação da versão 2

- Node.js 24 e MySQL 8.4 real, executado em container.
- Instalação limpa com `npm ci`: aprovada.
- Instalação das dependências de execução com `npm ci --omit=dev`: verificada separadamente.
- Cinco migrations aplicadas em banco vazio e atualização do banco da versão anterior: aprovadas.
- ESLint e build de produção do React: aprovados.
- Integração HTTP com MySQL: 20 testes aprovados, sem falhas, inclusive em banco criado do zero.
- Navegador Chromium: cadastro/login, cookies protegidos, receitas/despesas, saldo, anexo/download, edição, filtros, sessão após recarga, controle parental, autorização por conta, desativação do filho, alteração de senha, exclusão e logout aprovados.
- Payload XSS exibido como texto; nenhum erro JavaScript ou violação da CSP no teste de navegador.
- Layout móvel de 390 px sem transbordamento horizontal da página; tabelas rolam dentro de seu contêiner.
- Seeders opcionais com senha fornecida por ambiente: aprovados em banco novo.
- Auditoria `npm audit`: zero vulnerabilidades conhecidas no resultado obtido na preparação, incluindo dependências de desenvolvimento. As versões transitivas corrigidas estão fixadas em `overrides` e no lockfile; a auditoria deve ser repetida ao atualizar dependências.
- Configuração do Compose validada. A execução da imagem Docker completa desta versão não faz parte dos checks locais concluídos; a aplicação foi testada com Node.js e MySQL em Docker.

Testes reproduzíveis: `npm test` e `npm run test:e2e`. Capturas com dados fictícios estão em `docs/images`. O workflow da CI verifica instalação, migrations, lint, build, integração, dependências e navegador após push/PR; consulte o status da execução no GitHub.
