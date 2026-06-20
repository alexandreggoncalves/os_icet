# Contrato da API Django

Base URL local:

```text
http://127.0.0.1:8000
```

Rotas protegidas usam:

```http
Authorization: Bearer <access_token>
```

## Formato de resposta

A API retorna JSON. Em caso de erro, o campo mais comum e:

```json
{
  "detail": "Mensagem do erro."
}
```

## Autenticacao

### `POST /api/auth/login`

Autentica usuario e cria registro em `session_tokens`.

Request:

```json
{
  "login": "admin",
  "password": "admin1234"
}
```

Response `200`:

```json
{
  "access_token": "token",
  "token_type": "bearer",
  "first_login_required": false,
  "user": {
    "id": 1,
    "nome": "Administrador Master",
    "login": "admin",
    "email": "admin@icet.ufam.edu.br",
    "group_id": 1,
    "role": "admin",
    "grupo_nome": "Administradores"
  }
}
```

Regras:

- Usuario pendente recebe `403`.
- Usuario nao aprovado recebe `403`.
- Usuario inativo recebe `403`.
- Credencial invalida recebe `401`.
- Tokens expiram apos 8 horas.

### `POST /api/auth/register`

Solicita cadastro publico institucional.

Request:

```json
{
  "nome": "Usuario Teste",
  "login": "usuario.teste",
  "siape": "9988776",
  "cargo": "Docente"
}
```

Response `201`:

```json
{
  "mensagem": "Cadastro realizado com sucesso. Aguarde ate 24h para o administrador validar seu acesso."
}
```

Regras:

- A API deriva o e-mail como `login@ufam.edu.br`.
- Login aceita letras, numeros, ponto, hifen e sublinhado, sem `@` ou dominio.
- SIAPE deve conter exatamente 7 digitos numericos.
- E-mail, login e SIAPE nao podem duplicar cadastro existente.
- Cadastro nasce `pending`, `active = false` e `first_login_required = true`.

### `POST /api/auth/complete-first-access`

Conclui o primeiro acesso usando senha provisoria.

Request:

```json
{
  "temporary_password": "Ufam@123456",
  "new_password": "NovaSenha@123",
  "confirm_password": "NovaSenha@123"
}
```

### `POST /api/auth/forgot-password`

Gera codigo de redefinicao. Em ambiente local, grava arquivo em `dev_mailbox/`.

Request:

```json
{
  "login": "mariana.costa"
}
```

A API envia o codigo somente para o e-mail institucional derivado `login@ufam.edu.br`.

### `POST /api/auth/reset-password`

Redefine senha usando codigo valido.

Request:

```json
{
  "email": "mariana.costa@ufam.edu.br",
  "code": "123456",
  "new_password": "NovaSenha@123",
  "confirm_password": "NovaSenha@123"
}
```

## Bootstrap

### `GET /api/public/bootstrap`

Retorna dados publicos antes do login.

Response:

```json
{
  "demands": []
}
```

### `GET /api/admin/bootstrap`

Rota autenticada. Retorna usuario logado, permissoes, grupos, usuarios, demandas e solicitacoes conforme perfil.

Administradores recebem todas as solicitacoes. Usuarios comuns recebem apenas as proprias solicitacoes e listas administrativas vazias.

Cada solicitacao serializada inclui `prazo_estimado`, obtido da demanda correspondente.

## Solicitacoes

### `POST /api/requests`

Cria solicitacao autenticada.

Request:

```json
{
  "nome": "Mariana Costa",
  "siape": "2314578",
  "email": "mariana.costa@ufam.edu.br",
  "perfil": "Docente",
  "bloco": "Bloco B",
  "sala": "Laboratorio 03",
  "categoria": "Manutencao de Hardware",
  "descricao": "Computador nao liga."
}
```

Response `201`:

```json
{
  "request": {
    "id": 1,
    "protocolo": "OS-2026-00001",
    "status": "Aberto"
  }
}
```

Regras:

- Todo usuario, inclusive administrador, tem nome, SIAPE, e-mail e perfil derivados do proprio cadastro.
- SIAPE e obrigatorio e deve conter exatamente 7 digitos.
- Qualquer dado pessoal enviado no corpo e substituido pelo valor persistido no usuario autenticado.
- A solicitacao e vinculada ao usuario autenticado em `owner_user_id`.
- Administrador pode registrar solicitacao em nome de terceiros.
- O protocolo e gerado apos o insert, usando ano corrente e ID.

### `GET /api/requests/{id}`

Retorna solicitacao completa com interacoes e anexos.

Permissao:

- Administrador acessa qualquer solicitacao.
- Usuario comum acessa solicitacao propria ou com mesmo e-mail.

### `PUT /api/requests/{id}/status`

Atualiza status. Somente administradores.

Request:

```json
{
  "status": "Em Atendimento"
}
```

Se a solicitacao ja estiver `Resolvido`, a API retorna `403`.

## Interacoes

### `POST /api/requests/{id}/interactions`

Cria interacao com texto, anexos ou ambos.

JSON:

```json
{
  "mensagem": "Atendimento iniciado."
}
```

Multipart:

```text
mensagem=Segue evidencia do problema.
attachments=<arquivo>
attachments=<arquivo>
```

Regras:

- Usuario precisa ter acesso a solicitacao.
- Solicitacao resolvida nao aceita nova interacao.
- Extensoes permitidas: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.pdf`, `.doc`, `.docx`.
- Limite por arquivo: 8 MB.

### `PUT /api/interactions/{id}`

Edita mensagem de interacao.

Request:

```json
{
  "mensagem": "Texto atualizado."
}
```

Regras:

- Somente o autor pode editar.
- Preenche `edited_at`.
- Nao altera anexos.
- Solicitacao resolvida retorna `403`.

## Anexos

### `DELETE /api/attachments/{id}`

Exclui anexo.

Regras:

- Somente o autor da interacao vinculada ao anexo pode excluir.
- Solicitacao resolvida retorna `403`.
- O arquivo fisico e removido de `uploads/` se existir.

## Gerenciamento

As rotas abaixo exigem administrador.

### `POST /api/groups`

```json
{
  "nome": "Equipe de Redes",
  "descricao": "Grupo responsavel por infraestrutura de rede."
}
```

### `POST /api/users`

```json
{
  "nome": "Novo Usuario",
  "login": "novo.usuario",
  "siape": "1234567",
  "grupo_id": 2
}
```

### `PUT /api/groups/{id}`

```json
{
  "nome": "Equipe de Infraestrutura",
  "descricao": "Grupo atualizado.",
  "active": false
}
```

Permite editar, desativar e reativar grupos. O grupo `Administradores` retorna `403` e não pode ser alterado. Não existe endpoint de exclusão de grupos.

Efeitos:

- Deriva o e-mail `novo.usuario@ufam.edu.br`.
- Gera senha provisoria e grava e-mail simulado em `dev_mailbox/`.
- Cria o usuario ativo/aprovado com `first_login_required = true`.

### `PUT /api/users/{id}`

```json
{
  "nome": "Novo Nome",
  "login": "novo.login",
  "siape": "7654321",
  "grupo_id": 2,
  "active": true
}
```

Regras:

- Nao altera senha.
- Permite corrigir o SIAPE, mantendo a regra de exatamente 7 digitos e unicidade.
- Somente grupos ativos podem ser atribuidos.
- Usuario principal `admin` nao pode ser editado nem desativado.
- Usuario desativado nao autentica.

### `POST /api/users/{id}/approve`

Aprova cadastro pendente.

```json
{
  "grupo_id": 2
}
```

Efeitos:

- Ativa usuario.
- Define grupo.
- Gera senha provisoria.
- Marca `first_login_required = true`.
- Grava e-mail simulado em `dev_mailbox/`.

### `POST /api/demands`

```json
{
  "nome": "Instalacao de Software",
  "prazo": "3 dias uteis"
}
```

### `PUT /api/demands/{id}`

```json
{
  "nome": "Instalacao e Atualizacao de Software",
  "prazo": "5 dias uteis",
  "active": false
}
```

Permite editar nome e prazo, desativar e reativar. Ao renomear, a categoria das solicitacoes historicas e atualizada. Demandas inativas não aparecem em novas solicitações. Não existe endpoint de exclusão de demandas.

## Erros comuns

| Status | Significado |
| --- | --- |
| 401 | Usuario nao autenticado ou credenciais invalidas |
| 403 | Usuario autenticado sem permissao |
| 404 | Recurso nao encontrado |
| 422 | Dados invalidos |
| 500 | Erro interno |
