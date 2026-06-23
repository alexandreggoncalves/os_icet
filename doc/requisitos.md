# Requisitos Funcionais e Regras de Negocio

## Requisitos funcionais

| ID | Requisito | Situacao |
| --- | --- | --- |
| RF01 | Permitir login de usuarios cadastrados | Implementado |
| RF02 | Persistir sessoes com expiracao | Implementado em `session_tokens` |
| RF03 | Permitir recuperacao de senha por codigo | Implementado com e-mail simulado |
| RF04 | Exigir confirmacao ao redefinir senha | Implementado |
| RF05 | Exigir senha com minimo de 8 caracteres, uma letra maiuscula e um caractere especial | Implementado |
| RF06 | Permitir auto-cadastro publico institucional | Implementado |
| RF07 | Permitir aprovacao administrativa de cadastro pendente | Implementado |
| RF08 | Exigir troca de senha no primeiro acesso aprovado | Implementado |
| RF09 | Permitir cadastro de solicitacao somente por usuario autenticado | Implementado |
| RF10 | Permitir consulta de solicitacoes | Implementado |
| RF11 | Restringir usuarios comuns as proprias solicitacoes | Implementado |
| RF12 | Permitir filtros, paginacao e abertura do detalhe | Implementado no frontend |
| RF13 | Permitir historico de interacoes | Implementado |
| RF14 | Permitir anexos em interacoes | Implementado |
| RF15 | Permitir exclusao de anexos somente pelo autor | Implementado |
| RF16 | Permitir edicao de interacao somente pelo autor | Implementado |
| RF17 | Permitir alteracao de status por administradores | Implementado |
| RF18 | Bloquear alteracoes em solicitacao resolvida | Implementado |
| RF19 | Permitir gerenciamento de grupos, usuarios e demandas | Implementado |
| RF20 | Permitir desativar e reativar usuarios sem exclusao | Implementado |
| RF21 | Proteger o administrador principal `admin` contra edicao/desativacao | Implementado |
| RF22 | Permitir relatorios e exportacao CSV pelo frontend | Implementado |
| RF23 | Servir frontend React pelo Django | Implementado |
| RF24 | Usar PostgreSQL com migrations versionadas | Implementado |
| RF25 | Executar em Docker com web e banco | Implementado |
| RF26 | Derivar e-mail institucional a partir do login | Implementado |
| RF27 | Exigir SIAPE numerico com exatamente 7 digitos | Implementado |
| RF28 | Gerar senha provisoria no cadastro administrativo de usuario | Implementado |
| RF29 | Exibir data/hora e prazo estimado na lista de solicitacoes | Implementado |
| RF30 | Permitir edicao de usuario pelo clique na linha | Implementado |
| RF31 | Ocultar o item Login do menu durante sessao autenticada | Implementado |
| RF32 | Preencher a solicitacao com os dados cadastrados do usuario, inclusive administradores | Implementado |
| RF33 | Permitir editar o SIAPE do usuario mantendo validacao e unicidade | Implementado |
| RF34 | Permitir editar e desativar grupos, protegendo `Administradores` | Implementado |
| RF35 | Permitir editar e desativar demandas sem exclusao | Implementado |
| RF36 | Bloquear login por 15 minutos apos 3 senhas invalidas consecutivas | Implementado |
| RF37 | Permitir cadastro, edicao e desativacao de locais e blocos | Implementado |
| RF38 | Exigir atribuicao a um administrador ao iniciar atendimento | Implementado |
| RF39 | Permitir rejeitar e remover somente cadastros pendentes | Implementado |
| RF40 | Filtrar consultas e relatorios pelo usuario atribuido | Implementado |
| RF41 | Restringir salas aos intervalos 101-120, 201-220 e 301-320 | Implementado |
| RF42 | Persistir local e bloco da solicitacao por chaves estrangeiras | Implementado |
| RF43 | Persistir solicitante, demanda e autoria das interacoes por chaves estrangeiras | Implementado |

## Regras de negocio

### Autenticacao

- Apenas usuarios ativos e aprovados podem autenticar.
- Login invalido nao informa se o erro foi usuario ou senha.
- Cadastros publicos ficam pendentes ate aprovacao administrativa.
- Usuario pendente nao acessa o sistema.
- Aprovacao gera senha provisoria e obriga primeiro acesso.
- Senhas sao validadas no backend.
- Tokens expiram apos 8 horas.
- Tokens expirados sao removidos durante a validacao de sessao.
- Tres senhas incorretas consecutivas bloqueiam a conta por 15 minutos.
- O bloqueio expira automaticamente e um login valido posterior zera o contador.
- A recuperacao de senha permanece disponivel durante o bloqueio.
- Uma redefinicao concluida desbloqueia imediatamente a conta e zera as tentativas invalidas.

### Cadastro institucional

- O usuario informa somente o login; o sistema deriva `login@ufam.edu.br`.
- SIAPE deve ter exatamente 7 digitos numericos.
- E-mail, login e SIAPE nao podem duplicar cadastro existente.
- O grupo sugerido depende do cargo: docente/professor vai para Docentes; demais vao para Tecnicos Administrativos.

### Solicitacoes

- Todos os usuarios, inclusive administradores, criam solicitacoes com os proprios dados cadastrais.
- O SIAPE da solicitacao e obrigatorio, deve ter 7 digitos e sempre vem do banco.
- A solicitacao fica vinculada ao usuario autenticado para permitir o acompanhamento e as interacoes proprias.
- A sala deve possuir tres algarismos e pertencer aos intervalos `101-120`, `201-220` ou `301-320`.
- Local e bloco sao persistidos por `location_id` e `block_id`; o bloco informado deve pertencer ao local selecionado.
- A solicitacao persiste `owner_user_id` e `demand_id`; nome, e-mail, SIAPE, perfil e nome da demanda sao derivados das relacoes.
- Interacoes persistem `user_id`; nome e grupo do autor sao derivados do usuario relacionado.
- O perfil administrativo e derivado de `users.group_id`, sem coluna paralela `role`.
- O administrador master de login `admin` recebe o SIAPE reservado `0000000` para permitir a abertura de solicitacoes iniciais.
- Toda solicitacao recebe protocolo `OS-ANO-NNNNN`.
- Ao criar solicitacao pelo endpoint principal, o sistema registra interacao inicial.
- Administradores visualizam todas as solicitacoes.
- Usuarios comuns visualizam solicitacoes vinculadas ao proprio usuario ou e-mail.

### Status

- Status usados: `Aberto`, `Em Atendimento` e `Resolvido`.
- Somente administradores alteram status.
- A transicao de `Aberto` para `Em Atendimento` exige um usuario ativo e aprovado do grupo `Administradores`.
- A solicitacao registra o usuario atribuido e inclui a atribuicao no historico de interacoes.
- O fluxo nao permite passar diretamente de `Aberto` para `Resolvido` nem retornar de `Em Atendimento` para `Aberto`.
- Solicitacao resolvida fica somente para leitura.
- Uma solicitacao resolvida nao pode receber novas interacoes, edicoes ou exclusoes de anexo.

### Interacoes

- Administradores e solicitantes podem interagir nas solicitacoes que conseguem acessar.
- Cada interacao registra autor, grupo, mensagem, tipo e data.
- Somente o autor edita sua propria interacao.
- Ao editar, `edited_at` e preenchido.
- Anexos nao sao alterados pela edicao da mensagem.

### Anexos

- Extensoes aceitas: imagens, PDF, DOC e DOCX.
- Limite atual: 8 MB por arquivo.
- Arquivos sao salvos em `uploads/`.
- Metadados sao gravados na tabela `attachments`.
- Somente o autor da interacao pode excluir seus anexos.

### Gerenciamento de usuarios

- Administradores cadastram, editam, ativam e desativam usuarios.
- Cadastro administrativo gera senha provisoria, e-mail simulado e exige troca no primeiro acesso.
- A edicao e aberta pelo clique na linha; ativacao/desativacao permanece uma acao separada.
- Usuarios nao sao excluidos, para preservar historico.
- O usuario principal `admin` nao pode ser editado nem desativado pelo gerenciamento.
- Senha nao e alterada pela tela administrativa; use recuperacao de senha.

### Gerenciamento de grupos e demandas

- Grupos podem ter nome e descricao editados e podem ser desativados ou reativados.
- O grupo `Administradores` nunca pode ser editado nem desativado.
- Somente grupos ativos podem ser atribuidos a usuarios.
- Demandas podem ter nome e prazo editados e podem ser desativadas ou reativadas.
- Demandas inativas nao aparecem em novas solicitacoes, mas permanecem no historico.
- Grupos e demandas nao possuem operacao de exclusao.

### Locais, blocos e pendencias

- Administradores cadastram, editam, ativam e desativam locais e blocos.
- Cada bloco pertence a um local e seu nome e unico dentro desse local.
- Locais ou blocos inativos nao aparecem em novas solicitacoes, mas permanecem no historico.
- Renomear local ou bloco atualiza as referencias textuais das solicitacoes existentes.
- Cadastros pendentes podem ser aprovados ou rejeitados; a rejeicao envia aviso simulado e remove apenas o cadastro ainda pendente.

### Dados de demonstracao

- `seed_data` cria grupos, demandas, usuarios e amostras iniciais.
- `seed_demo_data` cria massa maior para apresentacao.
- O comando de demonstracao pode ser executado novamente sem duplicar as solicitacoes dos usuarios demo.
