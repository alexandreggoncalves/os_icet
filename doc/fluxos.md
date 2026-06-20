# Fluxos Principais

## Login

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant D as Django
    participant DB as PostgreSQL

    U->>F: informa login e senha
    F->>D: POST /api/auth/login
    D->>DB: busca usuario por login
    DB-->>D: dados do usuario
    D->>DB: cria SessionToken
    D-->>F: token e dados do usuario
    F->>D: GET /api/admin/bootstrap
    D-->>F: permissoes e dados conforme perfil
    F-->>U: painel do sistema
```

## Cadastro publico e aprovacao

```mermaid
sequenceDiagram
    participant U as Usuario novo
    participant F as Frontend
    participant D as Django
    participant DB as PostgreSQL
    participant A as Administrador
    participant M as dev_mailbox

    U->>F: informa nome, login, SIAPE e cargo
    F->>D: POST /api/auth/register
    D->>D: deriva login@ufam.edu.br e valida SIAPE de 7 digitos
    D->>DB: cria usuario pending/inativo
    A->>F: acessa pendencias
    F->>D: GET /api/admin/bootstrap
    A->>F: aprova cadastro
    F->>D: POST /api/users/{id}/approve
    D->>DB: ativa usuario e define senha provisoria
    D->>M: grava e-mail simulado
```

## Primeiro acesso

```mermaid
sequenceDiagram
    participant U as Usuario aprovado
    participant F as Frontend
    participant D as Django
    participant DB as PostgreSQL

    U->>F: login com senha provisoria
    F->>D: POST /api/auth/login
    D-->>F: first_login_required = true
    U->>F: informa senha provisoria e nova senha
    F->>D: POST /api/auth/complete-first-access
    D->>DB: valida senha provisoria e grava senha definitiva
    D-->>F: sucesso e solicita novo login
```

## Cadastro de solicitacao

```mermaid
sequenceDiagram
    participant U as Usuario autenticado
    participant F as Frontend
    participant D as Django
    participant DB as PostgreSQL

    U->>F: preenche formulario
    F->>D: POST /api/requests
    D->>DB: cria request
    D->>DB: atualiza protocolo OS-ANO-ID
    D->>DB: cria interacao inicial
    D-->>F: solicitacao criada
    F-->>U: mostra sucesso e detalhe
```

## Consulta e detalhe

```mermaid
flowchart TD
    A["Usuario acessa Consultar"] --> B["Frontend exibe lista permitida"]
    B --> C["Usuario aplica filtros e paginacao"]
    C --> D["Usuario clica na linha"]
    D --> E["GET /api/requests/{id}"]
    E --> F["Django valida permissao"]
    F --> G["Retorna dados, interacoes e anexos"]
    G --> H["Frontend abre detalhe"]
```

## Interacao com anexos

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant D as Django
    participant FS as uploads/
    participant DB as PostgreSQL

    U->>F: escreve mensagem e seleciona arquivos
    F->>D: POST multipart /api/requests/{id}/interactions
    D->>D: valida acesso, status, extensao e tamanho
    D->>FS: salva arquivos
    D->>DB: cria interacao e attachments
    D-->>F: detalhe atualizado
```

## Finalizacao como resolvido

```mermaid
flowchart TD
    A["Administrador seleciona Resolvido"] --> B["Frontend pede confirmacao"]
    B --> C{"Confirma?"}
    C -- "Nao" --> D["Status permanece"]
    C -- "Sim" --> E["PUT /api/requests/{id}/status"]
    E --> F["Django atualiza status"]
    F --> G["Frontend mostra modo leitura"]
    G --> H["Novas interacoes ficam bloqueadas"]
    I["Tentativa direta pela API"] --> J["Django retorna 403"]
```

## Recuperacao de senha

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant D as Django
    participant DB as PostgreSQL
    participant M as dev_mailbox/

    U->>F: informa login institucional
    F->>D: POST /api/auth/forgot-password
    D->>D: deriva login@ufam.edu.br
    D->>DB: salva hash do codigo e expiracao
    D->>M: grava arquivo com codigo
    U->>F: informa codigo e nova senha
    F->>D: POST /api/auth/reset-password
    D->>DB: valida codigo e atualiza senha
    D-->>F: sucesso
```
