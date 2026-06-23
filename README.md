# OS ICET - Django + PostgreSQL + Docker

Migração paralela do projeto `gti-os-icet/os-frontend`, preservando a interface e o contrato funcional em uma nova aplicação Django com PostgreSQL.

## Stack

- Django 5
- PostgreSQL
- Docker / Docker Compose
- Frontend React original servido como assets estáticos do Django

## Rodando com Docker

```bash
docker compose up --build
```

Acesse:

```text
http://127.0.0.1:8000
```

O compose cria o PostgreSQL com:

```text
banco: os_icet
usuario: postgres
senha: 123qwe
porta interna: 5432
porta no host: 5433
```

O mapeamento usa `5433:5432` para não conflitar com um PostgreSQL local já instalado na porta padrão.

## Rodando com PostgreSQL local

Crie um arquivo `.env` a partir de `.env.example` e garanta que exista o banco `os_icet`.

```bash
createdb -U postgres os_icet
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver 127.0.0.1:8000
```

No Windows, se `createdb` não estiver no PATH, crie o banco `os_icet` pelo pgAdmin ou pelo terminal do PostgreSQL.

No Windows, depois de criar `.venv` e instalar as dependencias, tambem e possivel iniciar com:

```bat
run-local.cmd
```

## Usuários de teste

```text
admin / admin1234
docente / Docente@1234
tecnico / Tecnico@1234
```

## Funcionalidades migradas

- Login por token Bearer com expiração
- Auto-cadastro institucional e aprovação administrativa
- Primeiro acesso com senha provisória
- Recuperação de senha com e-mail simulado em `dev_mailbox/`
- Cadastro e consulta de solicitações
- Controle de acesso por administrador/usuário comum
- Alteração de status por administradores
- Histórico de interações em formato de chat
- Upload, listagem e exclusão de anexos
- Gerenciamento de grupos, usuários e demandas com edição e ativação/desativação sem exclusão
- Gerenciamento de locais e blocos usados na abertura das solicitações
- Atribuição de solicitações em atendimento a usuários administradores
- Aprovação ou rejeição de cadastros pendentes
- Proteção do grupo `Administradores` contra edição e desativação
- Login institucional com e-mail derivado automaticamente como `login@ufam.edu.br`
- SIAPE obrigatorio com exatamente 7 digitos
- Senha provisoria gerada pelo sistema para novos usuarios administrativos
- Lista de solicitacoes com data/hora e prazo estimado da demanda
- Edicao de usuario pelo clique na linha da tabela
- Relatórios e exportação CSV pelo frontend preservado
