# Organização do trabalho em equipe

Preencha os nomes dos integrantes com a divisão real acordada pela equipe. O quadro abaixo é uma proposta de organização; os commits e Pull Requests devem registrar as contribuições efetivas.

| Frente | Atividades | Branch sugerida | Integrante |
| --- | --- | --- | --- |
| Autenticação e segurança | Sessões, senha, CSRF, validação e limites | `feat/autenticacao-segura` | A definir |
| Finanças | Receitas/despesas, categorias, filtros e saldos | `feat/financas` | A definir |
| Comprovantes | Upload, autorização, download e testes de arquivo | `feat/comprovantes` | A definir |
| Família | Subcontas, permissões, acompanhamento e revogação | `feat/controle-parental` | A definir |
| Interface | Formulários, histórico, dashboard e responsividade | `feat/interface` | A definir |
| Qualidade e documentação | Testes, CI, README e revisão de segurança | `test/seguranca-documentacao` | A definir |

## Fluxo proposto

1. Abra uma issue para a tarefa, descrevendo resultado e critérios de aceitação.
2. Atualize `main` e crie uma branch da tarefa.
3. Faça commits pequenos com mensagens que expliquem a mudança.
4. Abra um Pull Request com descrição, testes e telas quando úteis.
5. Peça revisão a outro integrante e resolva os comentários.
6. Faça merge apenas após aprovação e checks da CI. Atualize a documentação e a demonstração final.

Use o modelo de PR em `.github/pull_request_template.md`. Não inclua `.env`, senhas, cookies, documentos pessoais ou comprovantes reais nos exemplos, commits ou capturas de tela.

## Conferência da entrega

- Repositório acessível ao professor.
- README com descrição, tecnologias, comandos e proteções de segurança.
- Instalação reproduzida a partir de um clone limpo.
- Demonstração de cadastro/login, saldo, receitas/despesas, anexo e família.
- Testes e revisão de código registrados nos PRs.
- Nomes e responsabilidades preenchidos com as contribuições reais.
