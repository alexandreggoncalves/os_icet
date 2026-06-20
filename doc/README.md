# Documentacao da Aplicacao OS ICET/UFAM

Esta pasta concentra a documentacao tecnica e funcional da nova versao do sistema OS ICET/UFAM, migrada para Django 5 com PostgreSQL.

## Indice

- [Visao geral](./visao-geral.md)
- [Manual de uso do sistema](./manual-usuario.md)
- [Requisitos funcionais e regras de negocio](./requisitos.md)
- [Arquitetura da aplicacao](./arquitetura.md)
- [Modelo de dados e diagrama do banco](./banco-de-dados.md)
- [Contrato da API Django](./api.md)
- [Permissoes e seguranca](./permissoes-seguranca.md)
- [Fluxos principais](./fluxos.md)
- [Guia de operacao local e manutencao](./operacao-manutencao.md)
- [Deploy com Docker e preparacao para producao](./deploy-docker-producao.md)
- [Manual tecnico de manutencao](./manual-tecnico-manutencao.md)

## Estado atual

A aplicacao esta implementada como um sistema Django funcional:

- Backend em Django 5, no projeto `osicet/` e app `service/`.
- Banco PostgreSQL, configurado por variaveis de ambiente.
- Frontend React preservado e servido como assets estaticos do Django em `static/`.
- Templates em `templates/`, com entrada principal `templates/index.html`.
- Uploads locais em `uploads/`.
- Recuperacao de senha e aprovacao com e-mail simulado em `dev_mailbox/`.
- Login institucional com e-mail derivado automaticamente.
- SIAPE obrigatorio de 7 digitos e senha provisoria automatica.
- Solicitacoes com data/hora e prazo estimado na listagem.
- Testes de regressao em `service/tests.py`.
- Docker Compose com servicos `web` e `db`.

## Contas iniciais de teste

| Login | Senha | Grupo | Acesso |
| --- | --- | --- | --- |
| `admin` | `admin1234` | Administradores | Acesso total |
| `docente` | `Docente@1234` | Docentes | Cria, consulta e interage nas proprias solicitacoes |
| `tecnico` | `Tecnico@1234` | Tecnicos Administrativos | Cria, consulta e interage nas proprias solicitacoes |

## Dados de demonstracao

Para popular a base com usuarios, solicitacoes e interacoes de exemplo:

```bash
python manage.py seed_demo_data
```

Os usuarios de demonstracao usam a senha:

```text
Demo@1234
```

## Observacoes para producao

Antes do uso institucional em producao:

- Trocar `DJANGO_SECRET_KEY` e desativar `DJANGO_DEBUG`.
- Definir `DJANGO_ALLOWED_HOSTS` com o dominio real.
- Usar HTTPS por proxy reverso.
- Configurar backups do PostgreSQL e dos uploads.
- Integrar envio real de e-mails via SMTP institucional.
- Revisar contas de teste e senhas padrao.
- Adicionar logs, auditoria e monitoramento.
