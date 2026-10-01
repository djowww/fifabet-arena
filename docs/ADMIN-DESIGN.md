---
name: Fifa GO — Administração
description: Superfície administrativa que herda o visual escuro da arena.
colors:
  background: "#151616"
  sidebar: "#111212"
  surface: "#1c1e1d"
  surface-hover: "#242725"
  divider: "#3d4540"
  text: "#f6f8f6"
  muted: "#b8c1bb"
  action: "#07f468"
  action-ink: "#092914"
  input-background: "#121613"
  input-border: "#65746a"
  player-selected: "#20392a"
  error-background: "#42272b"
  error-text: "#ffd5d9"
  success-background: "#203e2a"
  success-text: "#c9f6d7"
typography:
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.5
  headline:
    fontSize: "2rem"
    lineHeight: 1.2
    letterSpacing: "-.035em"
  title:
    fontSize: "1.15rem"
    lineHeight: 1.4
    letterSpacing: "-.02em"
  label:
    fontSize: ".875rem"
    fontWeight: 650
rounded:
  control: "7px"
  editor: "12px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.input-background}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  credit-editor:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.editor}"
    padding: "1.35rem"
---

# Design da administração

## Overview

Modo **Operate**: consultar jogadores, revisar resultados e preparar uma adição de créditos. A rota `#admin` estende a arena existente, com português brasileiro, identidade Fifa GO, fundo escuro e verde nas ações. Este documento descreve essa superfície; as fontes visuais são `styles.css`, `practical.css`, `lobby.css` e `admin.css`, nessa ordem de carregamento.

## Colors

Os tokens da arena definem fundos, texto, divisórias e ações. O diretório usa fundo transparente, a passagem do ponteiro usa `surface-hover` e a seleção usa `player-selected`. O editor usa `surface`; erros e sucesso têm seus pares próprios de fundo e texto. O verde também destaca a quantidade a adicionar e o estado conectado. O estado dos serviços é escrito por extenso.

## Typography

A família é a pilha declarada no estilo global, herdada pelos controles. O título principal usa `headline`; os títulos de seção usam `title`. Os indicadores têm valores de 1.55rem, peso 650 e entrelinha 1.3. Apelidos nas linhas usam .95rem e peso 600; IDs e legendas de saldo usam .78rem. Números usam algarismos tabulares e formatação `pt-BR`. Textos auxiliares têm entrelinha de 1.5 a 1.6; nomes, IDs e motivos podem quebrar palavras longas.

## Layout

O conteúdo tem largura máxima de 76rem, centralizada dentro da estrutura da arena. A sequência é cabeçalho com atualização, quatro indicadores separados por linhas, acesso à revisão, diretório com editor, atividade administrativa e estado dos serviços. O espaço de trabalho tem colunas de 1.2fr e .8fr, mínimo de 19rem no editor e intervalo de 2rem. As linhas de jogadores têm altura mínima de 78px, identidade à esquerda e saldo à direita.

Até 1000px, as colunas passam a 1fr e 1fr, com mínimo de 17rem no editor e intervalo de 1.2rem. Até 760px, o editor fica abaixo do diretório, os indicadores formam duas colunas, o cabeçalho e a revisão quebram linha, o título principal passa a 1.65rem e os campos a 16px. O editor recebe 1.15rem de preenchimento. A estrutura herdada troca a barra lateral por navegação inferior até 820px; contas administrativas têm seis destinos. Até 480px, o conteúdo herda margens internas de 12px.

## Elevation & Depth

O painel organiza profundidade por tons de fundo e bordas de 1px. O editor tem contorno; os indicadores, jogadores e registros de atividade usam divisórias. Os componentes administrativos não acrescentam sombras. A passagem do ponteiro nas linhas altera o fundo em 160ms; a preferência por movimento reduzido remove as transições pela regra herdada da arena.

O painel inclui um jogador original como fundo decorativo na parte superior direita, com transparência, saturação reduzida e máscaras de desvanecimento à esquerda e abaixo. A camada não recebe eventos do ponteiro e fica atrás do conteúdo, sem alterar o fluxo ou recortar o foco. No celular, a ilustração é menor e mais transparente. O editor e os campos preservam fundos sólidos. A composição foi aprovada em 1º de outubro de 2026 após a apresentação das prévias de computador e celular.

## Shapes

Controles e mensagens usam `control`; o editor usa `editor`. A lista e o histórico mantêm linhas abertas. Avatares e ícones continuam os componentes existentes da arena.

## Components

- **Navegação e ações:** Admin recebe o estado ativo herdado. Botões têm altura mínima de 44px; a busca usa 46px. A ação principal preenche a largura do editor, enquanto atualização, busca e abertura da revisão usam a variante secundária com contorno.
- **Diretório:** cada jogador é um botão com nome acessível e `aria-pressed` para a seleção. A busca tem rótulo associado e envia apelido ou ID. A contagem e o aviso de limite acompanham a lista.
- **Editor:** começa com uma instrução de seleção. Depois mostra identidade, saldos disponível e reservado, contato verificado recolhido quando presente, quantidade e motivo. Quantidade aceita inteiros de 1 a 100.000; motivo aceita 10 a 1.000 caracteres.
- **Confirmação:** substitui o formulário no mesmo editor e mostra saldo atual, adição, saldo previsto e motivo. O texto informa que o servidor calcula o saldo final. Há ação de confirmação e retorno à edição. Uma resposta incerta mantém a operação, oferece “Consultar e confirmar operação” e impede trocar de jogador ou editar essa operação.
- **Feedback:** carregamento usa mensagem de estado, `aria-busy` e três faixas estáticas. Listas e histórico vazios mostram instruções textuais. Erros usam `role="alert"`; sucesso usa `role="status"`. Durante o envio, o botão mostra “Confirmando…” e `aria-busy`. O acesso negado apresenta explicação e link para a arena.
- **Foco:** botões, links, campos e o resumo do contato herdam contorno verde de 3px com afastamento de 3px. Selecionar um jogador ou voltar à edição direciona o foco à quantidade. Revisão, erro e sucesso direcionam o foco ao título do editor, com `tabindex="-1"`; o elemento é trazido à área visível.
- **Atividade:** lista cronológica com adição, destinatário, data, motivo, ator, ID público e saldo antes/depois. As linhas permitem quebra nos metadados e preservam as quebras do motivo.

## Do's and Don'ts

- **Do:** preservar a relação entre lista, jogador selecionado e editor; manter o estado e o próximo passo próximos à operação.
- **Do:** usar dados retornados pela API e instruções nos estados vazios. As capturas locais desta implementação usam contas sintéticas.
- **Don't:** apresentar saldo previsto como saldo confirmado ou uma adição administrativa como confirmação de Pix ou compra.
- **Don't:** copiar e-mails de produção para documentação, exemplos ou capturas de demonstração.
