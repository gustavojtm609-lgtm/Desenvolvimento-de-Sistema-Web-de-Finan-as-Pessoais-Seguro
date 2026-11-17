# API da versão 2

Base: `/api`. As respostas são JSON, exceto downloads e respostas 204. Não há autenticação Bearer/JWT nesta versão.

| Método e rota | Uso |
| --- | --- |
| `GET /health` | Verificar API/banco |
| `POST /users` | Criar conta independente: `name`, `email`, `password` |
| `POST /auth/login` | Entrar: `email`, `password`; define cookie e retorna `user`, `csrfToken` |
| `GET /auth/session` | Recuperar usuário e token CSRF da sessão |
| `POST /auth/logout` | Revogar sessão atual |
| `PUT /auth/password` | `currentPassword`, `newPassword`; revoga todas as sessões |
| `GET /transactions` | Histórico paginado da conta |
| `POST /transactions` | Criar receita/despesa |
| `PUT /transactions/:id` | Substituir os campos editáveis de um lançamento |
| `DELETE /transactions/:id` | Excluir lançamento e comprovante |
| `GET /dashboard/summary` | Saldo e totais agregados |
| `GET /categories` | Categorias da conta |
| `POST /categories` | `name`, `description` opcional |
| `PUT /categories/:id` | `name`, `description` opcional |
| `DELETE /categories/:id` | Excluir categoria sem lançamentos |
| `POST /transactions/:id/receipt` | Multipart com um campo de arquivo `receipt` |
| `GET /transactions/:id/receipt` | Download autenticado |
| `DELETE /transactions/:id/receipt` | Remover comprovante |
| `GET /family/children` | Listar filhos do responsável |
| `POST /family/children` | Criar filho: `name`, `email`, `password`, `permissions` opcional |
| `PATCH /family/children/:id` | Alterar `name`, `permissions`, `active` e/ou `password` |

Escritas exigem cabeçalho `Origin` igual à origem configurada. Após o login, envie também `X-CSRF-Token` e o cookie. Navegadores recebem o cookie automaticamente; clientes de teste devem manter seu cookie jar. Campos desconhecidos são rejeitados.

## Lançamento

```json
{
  "title": "Compras do mercado",
  "amount": "125.50",
  "type": "EXPENSE",
  "categoryId": "UUID_DA_CATEGORIA_DA_CONTA",
  "date": "2026-01-05",
  "description": "Compra da semana",
  "status": "PAGA"
}
```

`type`: `INCOME` ou `EXPENSE`. `status`: `PAGA` (recebida/paga) ou `PENDENTE` (prevista/pendente). `date` deve existir e estar entre 1900 e 2100. A API aceita valor como número ou string decimal, positivo, com no máximo duas casas decimais. As respostas monetárias são strings decimais.

## Filtros e escopo

`GET /transactions` e `GET /dashboard/summary` aceitam `type`, `status`, `categoryId`, `startDate`, `endDate`, `minAmount`, `maxAmount`, `page` e `pageSize`. O período inclui as duas datas. A listagem retorna `items`, `total`, `page`, `pages`, `pageSize`; a página tem no máximo cem registros. A paginação não limita os totais do resumo.

Rotas financeiras aceitam `accountId` opcional: omitido, usa a própria conta; informado, precisa ser um filho do responsável autenticado. Não passe `accountId` às rotas `/family` ou de autenticação. Um `userId` no corpo não substitui esse controle.

O resumo retorna `income`, `expenses`, `balance`, `pendingIncome`, `pendingExpenses`, `projectedBalance` e `byCategory`. Saldo realizado usa apenas `PAGA`.

## Permissões

Objeto completo de permissões do filho:

```json
{
  "viewFinance": true,
  "createIncome": false,
  "createExpense": false,
  "manageTransactions": false,
  "manageCategories": false,
  "attachments": false
}
```

O filho não edita esse objeto. Apenas seu responsável o envia às rotas `/family/children`. Alterar o tipo de um lançamento também exige a permissão de criar o novo tipo. Filho desativado não inicia nem reutiliza sessões.
