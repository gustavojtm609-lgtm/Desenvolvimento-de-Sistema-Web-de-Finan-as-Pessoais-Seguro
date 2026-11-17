# Segurança: mecanismos e roteiro de avaliação

## Fronteiras de confiança

O navegador envia dados, não decisões de autorização. A sessão é identificada por um cookie aleatório. O servidor busca a sessão e o usuário ativos, verifica prazo/inatividade e lê as permissões atuais. `accountId` só é aceito se for o próprio usuário ou um filho vinculado ao responsável. `userId` de um lançamento é definido pelo servidor, nunca pelo corpo da requisição.

As permissões e os acessos são aplicados em `middleware/auth.js`; schemas ficam em `lib/schemas.js`; controllers usam campos explícitos. A autenticação não usa mais JWT nem armazena token de sessão no JavaScript.

## Sessão e CSRF

- Identificador de 32 bytes gerado com `crypto.randomBytes`, enviado apenas como cookie `HttpOnly`, `SameSite=Strict`, sem domínio compartilhado e com caminho `/api`.
- No banco, o identificador fica como SHA-256; um vazamento somente dessa tabela não entrega o cookie original.
- Cada login gera outro identificador e revoga a sessão apresentada naquele navegador. Logout remove a sessão atual do banco. Trocar senha revoga todas as sessões da conta.
- Desativar filho ou redefinir a senha dele revoga todas as sessões do filho. Mudanças de permissões valem na próxima requisição, sem depender de renovar token.
- Expiração padrão: oito horas absolutas e trinta minutos sem atividade. O navegador pode ser reutilizado por outra pessoa se a conta permanecer aberta: use logout em dispositivos compartilhados.
- GET `/api/auth/session` entrega o usuário e o token CSRF da sessão para a própria interface. O token CSRF fica só em memória; operações de escrita o enviam em `X-CSRF-Token`.
- Escritas exigem `Origin` exata permitida e rejeitam `Sec-Fetch-Site: cross-site`. O token CSRF é comparado com `timingSafeEqual`. Login/cadastro usam JSON e controle de origem para impedir login CSRF.
- CORS permite somente as origens configuradas e credenciais. CORS não substitui autenticação, autorização ou CSRF.

Em HTTPS público, habilite `SESSION_COOKIE_SECURE=true` e ajuste as origens; isso também habilita HSTS. Não exponha uma instalação com cookies não seguros em HTTP público. O cookie protegido reduz riscos; não torna inofensivo o comprometimento do dispositivo ou o roubo de uma sessão válida.

## SQL e Mass Assignment

Sequelize parametriza os valores utilizados nos filtros e no CRUD. Datas, UUIDs, limites e enums são validados antes das consultas. Nenhuma coluna de ordenação ou expressão SQL é recebida do usuário. Migrations usam `queryInterface` e seeders usam models; não há concatenação de SQL com entradas externas.

Zod `.strict()` rejeita propriedades extras, inclusive `userId`, `role`, `parentId` e permissões fora dos endpoints administrativos autorizados. Depois da validação, os controllers ainda selecionam os campos explicitamente. Criar um cadastro público nunca cria uma conta de filho nem aceita privilégios de administrador.

## XSS e cabeçalhos

A interface renderiza texto pelo React e não interpreta marcação fornecida pelo usuário. A CSP permite recursos locais e bloqueia scripts inline, avaliação dinâmica, objetos e inclusão da aplicação em frames. O projeto usa fontes locais. Comprovantes são baixados, sem visualização HTML/inline. Helmet adiciona `nosniff` e política de referência `no-referrer`. Respostas da API e downloads privados usam `Cache-Control: no-store`.

## Comprovantes

A autenticação, a autorização por conta, o CSRF e as permissões são verificados antes de processar o upload. Há limite de 5 MB, um único arquivo e nenhum campo adicional no formulário multipart. PDF, PNG, JPEG e WebP precisam ter extensão, MIME e assinatura binária coerentes. SVG, HTML e executáveis são rejeitados.

O binário fica em BLOB privado no MySQL e acompanha o backup do banco. A API não expõe diretório de uploads. O download consulta o lançamento da conta autorizada, usa nome com UUID/extensão conhecida e `Content-Disposition: attachment`. Nomes do usuário são normalizados, e a interface os trata como texto. Excluir um lançamento remove seu comprovante pela chave estrangeira.

Validação de assinatura não é antivírus nem análise completa de PDF. Para um serviço aberto ao público, acrescente varredura antimalware e quotas de armazenamento conforme a infraestrutura escolhida.

## Autenticação, limites e erros

Senhas novas exigem dez caracteres, letra e número, com até 72 bytes em UTF-8 para respeitar o limite do bcrypt. Hashes usam custo 12. Login não distingue conta inexistente de senha incorreta; uma comparação bcrypt também ocorre para e-mail inexistente.

Há limite geral de 300 requisições por IP a cada 15 minutos, dez tentativas de login por IP/e-mail a cada 15 minutos e dez cadastros públicos por IP/hora. Os contadores ficam em memória; múltiplas instâncias exigem armazenamento compartilhado para manter o limite agregado. Configure `TRUST_PROXY=1` somente atrás de um único proxy confiável.

Erros de entrada retornam 400, autenticação 401, autorização/CSRF 403, objetos indisponíveis 404 e conflitos 409. Erros internos não entregam SQL, stack ou credenciais. Não registre cookies, senhas ou conteúdo de comprovantes em logs.

## Demonstrar ao professor

1. Crie um responsável, uma categoria, uma receita recebida e uma despesa paga; confira o saldo e filtros.
2. Anexe um PNG/PDF, faça download e tente anexar HTML renomeado como PNG; deve ser rejeitado.
3. Crie um filho somente com leitura. Entre em outro navegador/contexto e tente criar uma despesa: bloqueado.
4. Libere apenas despesas e tente criar receita, alterar o vínculo ou acessar o ID de outro usuário: bloqueado pelo servidor.
5. Desative o filho e recarregue a página dele: deve voltar ao login.
6. Insira uma tag HTML em observações e confira que aparece como texto, sem executar script.
7. Envie uma escrita sem `X-CSRF-Token`, ou com `Origin` maliciosa: resposta 403.
8. Envie `userId` ou `role` extra no cadastro/lançamento: resposta 400.
9. Faça logout e tente reutilizar o cookie antigo: resposta 401.
10. Execute `npm test`, `npm run test:e2e`, `npm run lint` e a auditoria de dependências. Guarde o resultado dos checks no PR.

Os testes automatizados cobrem esses comportamentos em banco real e no navegador. Eles são evidência dos cenários testados, não certificação de ausência de vulnerabilidades.
