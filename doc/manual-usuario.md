# Manual de Uso do Sistema OS ICET/UFAM

Este manual orienta solicitantes, docentes, tecnicos administrativos e administradores no uso da versao Django do sistema.

## Acesso ao sistema

Ambiente local:

```text
http://127.0.0.1:8000
```

Na tela inicial existem atalhos para:

- Abrir solicitacao.
- Acesso restrito.
- Primeiro acesso.

## Contas de teste

| Perfil | Usuario | Senha |
| --- | --- | --- |
| Administrador | `admin` | `admin1234` |
| Docente | `docente` | `Docente@1234` |
| Tecnico Administrativo | `tecnico` | `Tecnico@1234` |

Usuarios criados pelo seed de demonstracao usam:

```text
Demo@1234
```

## Primeiro acesso

Usuarios ainda nao cadastrados devem abrir o fluxo de primeiro acesso e informar:

- Nome completo.
- Login institucional; a tela completa `@ufam.edu.br` automaticamente.
- SIAPE com exatamente 7 numeros.
- Cargo.

Regras:

- O e-mail e gravado como `login@ufam.edu.br`.
- O sistema bloqueia e-mail ou SIAPE duplicado.
- O cadastro fica pendente ate aprovacao administrativa.
- Apos a aprovacao, o sistema gera senha provisoria e grava e-mail simulado em `dev_mailbox/`.

## Login

Na tela de login, informe usuario e senha.

Depois da autenticacao, o item `Login` deixa de aparecer no menu superior; a sessao pode ser encerrada pelo botao com o nome do usuario.

Depois de aprovado com senha provisoria, o sistema exige troca de senha no primeiro acesso.

Regras da nova senha:

- Minimo de 8 caracteres.
- Pelo menos uma letra maiuscula.
- Pelo menos um caractere especial.
- Confirmacao obrigatoria.

## Painel

Apos o login, o painel mostra indicadores de solicitacoes.

Administradores visualizam:

- Todas as solicitacoes.
- Relatorios.
- Gerenciamento.
- Pendencias de cadastro.

Docentes e tecnicos visualizam:

- Proprias solicitacoes.
- Abertura de novas solicitacoes.
- Interacoes nas solicitacoes permitidas.

## Cadastro de solicitacao

Usuarios autenticados podem abrir solicitacoes.

Para usuarios comuns:

- Nome, SIAPE, e-mail e perfil sao preenchidos a partir do cadastro.
- O SIAPE e obrigatorio, possui 7 digitos e nao pode ser substituido no formulario.
- O usuario informa tipo de demanda, bloco, sala e descricao.
- A mesma regra vale para administradores: o chamado usa os dados da conta conectada e fica vinculado a ela.
- Contas antigas sem SIAPE cadastrado devem ser regularizadas antes da abertura de chamados.
- Para efeito de cadastro e permissao no ambiente inicial, o administrador master usa o SIAPE reservado `0000000`.

Para administradores:

- Os dados do solicitante podem ser preenchidos manualmente.
- Quando a conta administrativa possui SIAPE cadastrado, todos os dados pessoais sao preenchidos pelo banco e bloqueados. Contas legadas sem SIAPE nao podem abrir chamado ate a regularizacao do cadastro.

Ao enviar, o sistema cria protocolo no formato:

```text
OS-ANO-NNNNN
```

## Consulta

A tela de consulta permite:

- Buscar solicitacoes.
- Filtrar por status.
- Filtrar por solicitante.
- Usar paginacao.
- Abrir detalhe ao clicar em uma linha.
- Conferir data/hora da abertura e prazo estimado da demanda na mesma coluna.

Administradores veem todas as solicitacoes. Usuarios comuns veem somente as solicitacoes vinculadas ao seu usuario ou e-mail.

## Detalhe da solicitacao

O detalhe exibe:

- Protocolo.
- Dados do solicitante.
- Localizacao.
- Categoria.
- Descricao.
- Status.
- Historico de interacoes.
- Anexos.
- Opcao de impressao/PDF.

Administradores podem alterar status. Ao marcar como `Resolvido`, a solicitacao passa a ser somente leitura.

## Interacoes e anexos

Usuarios autorizados podem adicionar mensagens e anexos.

Formatos aceitos:

- Imagens.
- PDF.
- DOC.
- DOCX.

Regras:

- Somente o autor edita sua propria interacao.
- Somente o autor da interacao exclui seus anexos.
- Solicitacao resolvida nao aceita novas interacoes, edicoes ou exclusoes.

## Cadastros pendentes

Administradores acessam a area de pendencias para aprovar novos usuarios.

Fluxo:

1. Conferir nome, e-mail, SIAPE e cargo.
2. Confirmar ou escolher grupo.
3. Aprovar cadastro.
4. Conferir e-mail simulado em `dev_mailbox/`, quando necessario em ambiente local.

## Gerenciamento

Restrito a administradores:

- Grupos.
- Usuarios.
- Demandas.

Usuarios, grupos e demandas nao sao excluidos. Use ativar/desativar para preservar historico.

Ao cadastrar usuario, informe nome, login, SIAPE de 7 digitos e grupo. O sistema deriva o e-mail institucional, gera uma senha provisoria e grava o envio simulado em `dev_mailbox/`. O usuario deve definir a senha definitiva no primeiro acesso.

Para editar um usuario, clique diretamente na linha. Nome, login, SIAPE de 7 digitos e grupo podem ser atualizados. O botao separado serve apenas para ativar ou desativar.

O usuario principal `admin` nao pode ser editado nem desativado pela tela administrativa.

Para editar grupos e demandas, clique na linha correspondente. Grupos permitem alterar nome e descricao; demandas permitem alterar nome e prazo. O botao separado ativa ou desativa o item.

O grupo `Administradores` e protegido: nao pode ser editado nem desativado. Grupos inativos nao podem ser atribuidos a usuarios, e demandas inativas nao aparecem no formulario de nova solicitacao.

## Relatorios

Administradores podem acessar relatorios, aplicar filtros e gerar saidas para impressao/PDF ou CSV conforme opcoes do frontend.

## Recuperacao de senha

Fluxo:

1. Abrir `Esqueci minha senha`.
2. Informar somente o login; a tela completa `@ufam.edu.br`.
3. Consultar o codigo no e-mail simulado em `dev_mailbox/` no ambiente local.
4. Informar codigo, nova senha e confirmacao.
5. Fazer login com a nova senha.

## Boas praticas

- Revise os dados antes de aprovar usuario.
- Desative usuarios em vez de apagar registros.
- Marque solicitacao como resolvida somente ao finalizar atendimento.
- Use anexos para evidencias.
- Gere PDF/impressao quando precisar arquivar uma OS.
