# Visao Geral

## Proposito

O sistema OS ICET/UFAM registra, acompanha e gerencia solicitacoes de atendimento de TI no ambito do ICET/UFAM.

A nova versao preserva a experiencia funcional do prototipo original, mas substitui o backend local em Python simples e SQLite por uma aplicacao Django com PostgreSQL e migracoes versionadas.

## Publico-alvo

- Docentes.
- Tecnicos administrativos.
- Equipe de TI e administradores.

## Modulos da interface

| Modulo | Descricao |
| --- | --- |
| Inicio | Tela inicial com apresentacao e atalhos |
| Solicitacao | Cadastro autenticado de nova ordem de servico |
| Login | Autenticacao, primeiro acesso e recuperacao de senha |
| Painel TI | Indicadores conforme perfil do usuario |
| Consultar | Listagem, filtros, paginacao e abertura de detalhes |
| Relatorios | Indicadores e exportacoes para administradores |
| Gerenciamento | Cadastro de grupos, usuarios e demandas |
| Pendencias | Aprovacao administrativa de cadastros publicos |
| Detalhe da solicitacao | Dados completos, status, interacoes e anexos |

## Funcionalidades implementadas

- Login por token Bearer persistido em tabela `session_tokens`.
- Auto-cadastro institucional com e-mail `@ufam.edu.br`.
- Aprovacao administrativa de cadastros pendentes.
- Primeiro acesso com senha provisoria.
- Recuperacao de senha com codigo e e-mail simulado.
- Cadastro de solicitacoes por usuarios autenticados.
- Controle de acesso por administrador e usuario comum.
- Alteracao de status por administradores.
- Bloqueio de alteracoes em solicitacoes resolvidas.
- Historico de interacoes em formato de conversa.
- Upload, listagem e exclusao de anexos.
- Gerenciamento de grupos, usuarios e demandas.
- Relatorios e exportacao CSV pelo frontend preservado.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Backend | Django 5 |
| Banco | PostgreSQL |
| Driver banco | psycopg2-binary |
| Servidor producao | Gunicorn |
| Arquivos estaticos | WhiteNoise |
| Frontend | React servido como JavaScript estatico |
| Estilizacao | Bootstrap local e `static/styles.css` |
| Container | Docker e Docker Compose |

## URLs locais

Execucao local:

```text
http://127.0.0.1:8000
```

API:

```text
http://127.0.0.1:8000/api/...
```
