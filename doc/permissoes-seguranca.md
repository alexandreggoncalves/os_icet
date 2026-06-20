# Permissoes e Seguranca

## Grupos de acesso

| Grupo | Perfil | Permissoes |
| --- | --- | --- |
| Administradores | Equipe de TI | Acesso total, relatorios, gerenciamento, consulta geral e status |
| Docentes | Solicitantes | Criam solicitacoes, consultam proprias solicitacoes e interagem nelas |
| Tecnicos Administrativos | Solicitantes | Criam solicitacoes, consultam proprias solicitacoes e interagem nelas |

## Matriz de permissoes

| Acao | Administrador | Docente | Tecnico Administrativo |
| --- | --- | --- | --- |
| Login | Sim | Sim | Sim |
| Solicitar cadastro publico | Sim | Sim | Sim |
| Aprovar cadastro pendente | Sim | Nao | Nao |
| Criar solicitacao | Sim | Sim | Sim |
| Consultar todas as solicitacoes | Sim | Nao | Nao |
| Consultar propria solicitacao | Sim | Sim | Sim |
| Alterar status | Sim | Nao | Nao |
| Criar interacao | Sim, em qualquer solicitacao | Sim, nas proprias | Sim, nas proprias |
| Editar interacao | Somente se for autor | Somente se for autor | Somente se for autor |
| Excluir anexo | Somente se for autor da interacao | Somente se for autor da interacao | Somente se for autor da interacao |
| Gerenciar grupos | Sim | Nao | Nao |
| Gerenciar usuarios | Sim | Nao | Nao |
| Gerenciar demandas | Sim | Nao | Nao |
| Acessar relatorios | Sim | Nao | Nao |

Solicitacoes com status `Resolvido` ficam em modo somente leitura para todos os perfis.

## Como o backend aplica permissoes

Funcoes principais em `service/views.py`:

| Funcao | Responsabilidade |
| --- | --- |
| `current_user(request)` | Le token Bearer, remove tokens expirados e busca sessao valida |
| `require_user(request)` | Bloqueia endpoint sem autenticacao |
| `is_admin(user)` | Identifica administradores por `role` ou grupo |
| `is_primary_admin(user)` | Protege usuario principal `admin` |
| `can_access_request(user, item)` | Valida acesso a solicitacao |
| `is_resolved_status(status)` | Detecta solicitacao resolvida |
| `password_validation_error(password)` | Aplica politica minima de senha |
| `is_ufam_email(email)` | Valida dominio institucional |
| `valid_institutional_login(login)` | Valida o prefixo usado para derivar `login@ufam.edu.br` |
| `valid_siape(siape)` | Exige exatamente 7 digitos numericos |

## Senhas

As senhas usam `django.contrib.auth.hashers.make_password` e `check_password`. A configuracao padrao do Django usa hashes com sal e parametros de custo adequados para aplicacoes web.

Regras minimas adicionais:

- Pelo menos 8 caracteres.
- Pelo menos uma letra maiuscula.
- Pelo menos um caractere especial.

## Tokens de sessao

- Token aleatorio gerado com `secrets.token_urlsafe(32)`.
- Persistido em `session_tokens`.
- Enviado pelo frontend no header `Authorization`.
- Expira apos 8 horas.
- Token nao e renovado automaticamente.

## Uploads

Validacoes atuais:

- Extensao permitida.
- Tamanho maximo de 8 MB por arquivo.
- Nome armazenado com prefixo de timestamp e token aleatorio.

Pontos a reforcar para producao:

- Validar MIME real.
- Aplicar antivirus.
- Controlar acesso aos arquivos por permissao, caso os anexos nao devam ser publicos.
- Considerar storage institucional ou objeto.

## E-mails simulados

Recuperacao de senha e aprovacao gravam arquivos em `dev_mailbox/`.

O usuario informa somente o login nos fluxos institucionais. O backend deriva o e-mail `login@ufam.edu.br`, rejeita dominios externos na redefinicao e evita depender apenas da validacao do frontend.

Cadastros administrativos geram senha provisoria aleatoria, armazenam apenas o hash e obrigam a troca no primeiro acesso.

Para producao:

- Integrar SMTP institucional.
- Registrar logs sem expor codigos sensiveis.
- Definir remetente oficial.
- Adicionar limites de tentativas e reenvio.

## Configuracoes sensiveis

Variaveis principais:

| Variavel | Uso |
| --- | --- |
| `DJANGO_SECRET_KEY` | Chave criptografica do Django |
| `DJANGO_DEBUG` | Deve ser `0` em producao |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos |
| `POSTGRES_DB` | Nome da base |
| `POSTGRES_USER` | Usuario do banco |
| `POSTGRES_PASSWORD` | Senha do banco |
| `DB_HOST` | Host PostgreSQL |
| `DB_PORT` | Porta PostgreSQL |

Nunca versionar `.env` com credenciais reais.

## Recomendacoes para producao

- Desativar `DEBUG`.
- Usar HTTPS.
- Definir `ALLOWED_HOSTS` explicitamente.
- Trocar senhas padrao.
- Criar administradores nomeados.
- Remover ou desativar contas de teste.
- Configurar backup e restore testado.
- Adicionar logs de auditoria para login, aprovacao, alteracao de status, upload e exclusao.
- Adicionar protecao contra forca bruta.
