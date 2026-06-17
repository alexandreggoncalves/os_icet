# Operacao Local e Manutencao

Este guia concentra comandos praticos para executar, validar e manter a aplicacao Django.

## Preparar ambiente local

Criar ambiente virtual:

```bash
python -m venv .venv
```

Ativar no Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Instalar dependencias:

```bash
pip install -r requirements.txt
```

## Configurar `.env`

Crie `.env` a partir de `.env.example`.

Exemplo local com PostgreSQL na porta padrao:

```text
DJANGO_SECRET_KEY=dev-local-os-icet
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
POSTGRES_DB=os_icet
POSTGRES_USER=postgres
POSTGRES_PASSWORD=123qwe
DB_HOST=127.0.0.1
DB_PORT=5432
```

## Criar banco local

Com PostgreSQL instalado:

```bash
createdb -U postgres os_icet
```

No Windows, tambem e possivel criar a base pelo pgAdmin.

## Executar migrations e seeds

```bash
python manage.py migrate
python manage.py seed_data
```

Para popular demonstracao:

```bash
python manage.py seed_demo_data
```

## Rodar servidor

```bash
python manage.py runserver 127.0.0.1:8000
```

URL:

```text
http://127.0.0.1:8000
```

## Rodar com Docker

```bash
docker compose up --build
```

URL:

```text
http://127.0.0.1:8000
```

Parar:

```bash
docker compose down
```

Parar removendo volumes, somente se quiser apagar banco/uploads/mailbox:

```bash
docker compose down -v
```

## Validacoes rapidas

Checar Django:

```bash
python manage.py check
```

Listar migrations:

```bash
python manage.py showmigrations
```

Testar endpoint publico:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/public/bootstrap"
```

Testar login:

```powershell
Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{login="admin"; password="admin1234"} | ConvertTo-Json)
```

## Arquivos e pastas importantes

| Caminho | Finalidade |
| --- | --- |
| `manage.py` | Entrada de comandos Django |
| `osicet/settings.py` | Configuracoes |
| `osicet/urls.py` | Rotas |
| `service/models.py` | Modelos ORM |
| `service/views.py` | Views e API |
| `service/migrations/` | Migracoes |
| `service/management/commands/seed_data.py` | Dados iniciais |
| `service/management/commands/seed_demo_data.py` | Dados de demonstracao |
| `templates/index.html` | Entrada HTML |
| `static/app.compiled.js` | Frontend React compilado |
| `static/styles.css` | Estilos |
| `uploads/` | Anexos enviados |
| `dev_mailbox/` | E-mails simulados |
| `Dockerfile` | Imagem web |
| `docker-compose.yml` | Web + PostgreSQL |

## Backups locais

Backup PostgreSQL:

```bash
pg_dump -U postgres -d os_icet -Fc -f os_icet.backup.dump
```

Restore:

```bash
pg_restore -U postgres -d os_icet --clean --if-exists os_icet.backup.dump
```

Backup de anexos:

```powershell
Copy-Item uploads uploads_backup -Recurse
```

## Manutencao frequente

### Alterar modelo de dados

1. Editar `service/models.py`.
2. Gerar migration com `python manage.py makemigrations`.
3. Aplicar com `python manage.py migrate`.
4. Atualizar `doc/banco-de-dados.md` e `doc/api.md` se houver impacto externo.

### Alterar regra de negocio

1. Editar `service/views.py`.
2. Validar permissoes afetadas.
3. Rodar `python manage.py check`.
4. Testar fluxo manualmente.
5. Atualizar documentacao relacionada.

### Alterar frontend

O frontend carregado e `static/app.compiled.js`.

Se a origem editavel do React nao estiver no repositorio, alteracoes precisam ser feitas no bundle atual ou no projeto de origem e recompiladas para substituir `static/app.compiled.js`.

### Limpar sessoes expiradas

As sessoes expiradas sao removidas durante validacao de usuario. Se necessario, usar shell Django:

```bash
python manage.py shell
```

```python
from django.utils import timezone
from service.models import SessionToken
SessionToken.objects.filter(expires_at__lt=timezone.now()).delete()
```
