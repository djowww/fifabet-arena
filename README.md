# FifaBet Arena

Protótipo de uma arena de EA SPORTS FC com partidas de exemplo, palpites com pontos fictícios e recursos sociais demonstrativos.

**GitHub Pages:** https://djowww.github.io/fifabet-arena/
**Site original:** https://fifabet.ricardozordan1994.chatgpt.site

## Recursos da demonstração

- Perfis locais, favoritos e lembretes de partidas.
- Palpites, resultados simulados, carteira e extrato com pontos fictícios.
- Fluxos de Pix e cartão de demonstração, sem transferência ou cobrança.
- Troféus, níveis, lista de amigos, convites e desafios amistosos.

As partidas, os placares, os jogadores e os pagamentos são ilustrativos. O estado fica no navegador do visitante; não há servidor de contas, autenticação ou pagamentos reais.

## Executar localmente

Com Node.js 18 ou superior, sem instalar dependências:

```bash
npm test
python3 -m http.server 4173
```

Depois, acesse http://localhost:4173.

## Arquivos

- `index.html`, `styles.css`, `app.js` e `model.mjs` — arquivos servidos pelo GitHub Pages.
- `model.test.mjs` e `ui-flows.test.mjs` — testes das regras e dos fluxos da demonstração.
- `package.json` — comando local de testes, sem dependências externas.
