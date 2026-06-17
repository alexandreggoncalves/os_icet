# Deploy com Docker e Preparacao para Producao

Este documento orienta a execucao com Docker e os principais ajustes para homologacao e producao.

## Estado atual

O projeto possui:

- `Dockerfile` para imagem Django.
- `docker-compose.yml` com servicos `web` e `db`.
- PostgreSQL 16 Alpine.
- Gunicorn servindo `osicet.wsgi:application`.
- WhiteNoise para arquivos estaticos.
- Volumes para PostgreSQL, uploads e e-mails simulados.

## Subir localmente com Docker

```bash
docker compose up --build -d
```

Verificar:

```bash
docker compose ps
docker compose logs -f web
```

Acessar:

```text
http://127.0.0.1:8000
```

## Servicos do Compose

### `db`

- Imagem: `postgres:16-alpine`.
- Banco padrao: `os_icet`.
- Usuario padrao: `postgres`.
- Senha padrao: `123qwe`.
- Volume: `os_icet_postgres`.
- Porta host: `5433`.
- Porta interna: `5432`.

### `web`

- Build local.
- Executa migrations, seed inicial e Gunicorn.
- Porta: `8000`.
- Volumes:
  - `os_icet_uploads:/app/uploads`
  - `os_icet_mailbox:/app/dev_mailbox`
- Depende do healthcheck do PostgreSQL.

## Variaveis de ambiente

| Variavel | Exemplo producao | Finalidade |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | valor longo e secreto | Chave do Django |
| `DJANGO_DEBUG` | `0` | Desativa debug |
| `DJANGO_ALLOWED_HOSTS` | `os-icet.exemplo.edu.br` | Hosts aceitos |
| `POSTGRES_DB` | `os_icet` | Nome da base |
| `POSTGRES_USER` | `os_icet_user` | Usuario do banco |
| `POSTGRES_PASSWORD` | senha forte | Senha do banco |
| `DB_HOST` | `db` | Host interno do PostgreSQL |
| `DB_PORT` | `5432` | Porta interna do PostgreSQL |

## Exemplo de `.env` para servidor

```text
DJANGO_SECRET_KEY=trocar-por-chave-forte
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=os-icet.exemplo.edu.br,127.0.0.1
POSTGRES_DB=os_icet
POSTGRES_USER=os_icet_user
POSTGRES_PASSWORD=trocar-por-senha-forte
```

## Proxy reverso e HTTPS

Recomenda-se expor a aplicacao apenas por HTTPS via Nginx, Caddy, Traefik ou proxy institucional.

Exemplo conceitual com Nginx:

```nginx
server {
    listen 80;
    server_name os-icet.exemplo.edu.br;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name os-icet.exemplo.edu.br;

    client_max_body_size 16m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Em servidor, considere publicar a porta apenas localmente:

```yaml
ports:
  - "127.0.0.1:8000:8000"
```

## Atualizacao no servidor

Roteiro:

```bash
cd /opt/os-icet/app
git fetch origin
git status --short --branch
git pull --ff-only origin main
docker compose build
docker compose up -d
docker compose logs --tail=100 web
```

Antes de atualizar ambiente com dados reais:

1. Fazer backup do PostgreSQL.
2. Fazer backup de uploads.
3. Conferir migrations pendentes.
4. Subir nova versao.
5. Testar login, consulta, criacao de OS e anexos.

## Backup Docker

Backup do banco:

```bash
docker compose exec db pg_dump -U postgres -d os_icet -Fc -f /tmp/os_icet.dump
docker cp $(docker compose ps -q db):/tmp/os_icet.dump ./os_icet.dump
```

Backup de uploads:

```bash
docker run --rm \
  -v os_icet_os_icet_uploads:/uploads:ro \
  -v "$PWD/backups:/backup" \
  alpine sh -c "cp -a /uploads /backup/uploads"
```

O nome real do volume pode variar conforme o nome do projeto Compose. Consulte:

```bash
docker volume ls
```

## Checklist pos-deploy

- Abrir pagina inicial.
- Testar `GET /api/public/bootstrap`.
- Fazer login como administrador real.
- Criar usuario comum.
- Abrir solicitacao.
- Consultar solicitacao.
- Alterar status.
- Adicionar interacao.
- Enviar anexo permitido.
- Testar recuperacao de senha.
- Verificar logs do container.
- Conferir backup e restauracao em ambiente de teste.

## Pontos obrigatorios antes de producao

- `DJANGO_DEBUG=0`.
- `DJANGO_SECRET_KEY` forte e fora do Git.
- `DJANGO_ALLOWED_HOSTS` correto.
- HTTPS ativo.
- Senhas padrao trocadas.
- Contas de teste removidas ou desativadas.
- SMTP real configurado se o fluxo de e-mail for usado em producao.
- Backups automatizados.
- Monitoramento de disco, CPU, memoria e disponibilidade.
- Procedimento de restore testado.
- Politica de retencao de logs e backups.
