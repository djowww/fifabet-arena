# FifaBet Arena

Protótipo front-end de uma arena para desafiar amigos no EA SPORTS FC, combinar o formato da partida e acompanhar vitórias, ranking, avatares e medalhas.

**GitHub Pages:** https://djowww.github.io/fifabet-arena/

## O que dá para explorar

- Criar um perfil local com apelido e avatar.
- Personalizar o perfil com o nome do time e uma bandeira de fundo estilizada.
- Comprar figurinhas demonstrativas com pontos fictícios, montar uma coleção e usar uma delas como avatar.
- Descobrir jogadores de exemplo, aceitar convites e montar uma lista de amigos.
- Enviar um desafio de demonstração escolhendo modo de jogo e pontos simbólicos.
- Simular o aceite do desafio, registrar o vencedor e atualizar o ranking local.
- Ver um ranking ilustrativo, histórico local e coleção de medalhas.

Os jogadores, convites e números do ranking são demonstrativos. Os dados ficam no navegador; ainda não há contas compartilhadas, sincronização entre dispositivos, servidor de partidas ou apostas e pagamentos reais. Os pontos simbólicos não são descontados, transferidos nem convertidos em dinheiro.

As figurinhas atuais têm personagens e rubricas fictícias, feitas para a demonstração. Fotos de atletas e assinaturas oficiais precisam de ativos licenciados antes de serem incluídas.

## Por onde continuar

O próximo passo de produto é validar o ciclo **adicionar amigo → enviar desafio → confirmar resultado → atualizar ranking**. Para que duas pessoas participem de verdade em dispositivos diferentes, a etapa seguinte de engenharia é adicionar autenticação e um backend compartilhado para convites, resultados e estatísticas. Pagamentos reais não fazem parte deste MVP.

## Executar localmente

Com Node.js 18 ou superior, sem dependências externas:

```bash
node --test
node serve.mjs
```

Depois, acesse http://127.0.0.1:4173. Mantenha o terminal aberto enquanto usa a arena. Não abra `index.html` diretamente: o navegador bloqueia os módulos JavaScript em páginas `file://`.

## Arquivos

- `index.html`, `styles.css`, `app.js` e `model.mjs` — aplicação estática servida pelo GitHub Pages.
- `model.test.mjs` e `ui-flows.test.mjs` — testes das regras e dos fluxos da demonstração.
- `package.json` — comandos do projeto, sem dependências externas.
