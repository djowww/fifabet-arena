# FifaBet Arena

Partidas entre amigos no EA SPORTS FC, com ID próprio do FifaBet, carteira de créditos de teste, foto do placar e revisão pela equipe.

**Domínio público:** https://betfifa.com.br/

**Repositório:** https://github.com/djowww/fifabet-arena

O frontend usa GitHub Pages. O domínio é administrado na Hostinger e aponta para essa publicação; não usa o VPS do Tibia. O endereço `djowww.github.io/fifabet-arena/` passa a redirecionar para o domínio personalizado.

Os perfis e créditos da demonstração local são salvos por origem no navegador. Os dados do endereço antigo não migram automaticamente para o domínio novo. A API de contas compartilhadas continua dependendo da hospedagem do servidor descrita abaixo.

## Fluxo principal

1. Crie um perfil e receba um ID permanente.
2. Escolha o amigo pelo ID, modo, plataforma, regras e pontos por jogador.
3. Seus pontos ficam reservados no convite. O rival entra na própria conta e aceita, reservando a mesma quantidade.
4. Envie o placar com uma foto. O rival pode confirmar ou sinalizar fraude/divergência com outra foto.
5. Uma conta autorizada da equipe revisa a evidência antes de distribuir pontos. Um participante não pode julgar o próprio desafio.
6. Consulte rival, placar, situação e decisão no histórico dos dois jogadores.

A página inicial tem dois cartões: **Entrar em uma partida** e **Criar minha partida**, com referências discretas de Haaland e Alexia Putellas. O formulário completo abre somente na criação. Na entrada, o jogador consulta os convites recebidos ou usa um link/código, confere a partida e aceita pelo próprio perfil.

A classificação usa resultados revisados; não há adversários nem resultados inventados no fluxo principal. O ID e o histórico são internos do FifaBet; não há consulta automática ao histórico da EA.

## Carteira em ambiente de teste

- Saldo disponível, créditos reservados em partidas, pedidos pendentes e extrato.
- Pacotes de 100, 250, 500 ou 1.000 créditos fictícios.
- Cartão com 1 a 6 parcelas demonstrativas; Pix com confirmação de teste.
- Aprovação ou recusa simulada em uma etapa separada. Criar o pedido não altera o saldo; confirmar adiciona créditos uma única vez.
- Transferência com imagem de comprovante fictício. No servidor, outra conta autorizada da equipe confere a imagem e registra aprovação ou recusa. No modo local, o comprovante fica salvo em análise, sem liberação automática.
- Pedidos e comprovantes ficam separados por jogador. No servidor, as imagens são privadas e decisões sobre versões antigas do comprovante são rejeitadas.

Esta carteira é uma simulação própria do FifaBet, sem integração com processador de pagamentos. Não recebe cartão real, chave Pix nem dados bancários. A organização do caixa usa como referência a escolha de métodos descrita no [suporte oficial do PokerStars](https://www.pokerstars.com/help/articles/dep-options-avail-general/), com identidade própria.

## Duas modalidades

| Modalidade | Como funciona |
| --- | --- |
| GitHub Pages / `node serve.mjs` | Perfis e desafios somente no navegador. Permite alternar dois perfis e experimentar convite, reserva, placar, contestação e histórico. Não envia fotos à equipe e não libera pontos por revisão real. |
| `node backend/server.mjs` | Contas com senha, partidas compartilhadas, fotos privadas e painel da equipe. Os dados ficam no servidor. Para celulares fora da rede local, é necessário hospedar o servidor com HTTPS e armazenamento persistente. |

Publicar no GitHub não publica a API. O servidor incluído usa JSON com gravação atômica e uma única instância; é um protótipo funcional, ainda sem a infraestrutura de banco e operação de um lançamento comercial. Os modos locais e compartilhados têm cadastros separados, sem migração automática.

Todas as operações usam **créditos fictícios, sem valor financeiro**. Os métodos de recarga são demonstrativos: não há pagamento real, saque ou integração automática com resultados da EA. O modo de pagamento do servidor está fixado em `demo`.

## Executar

Node.js 18 ou superior, sem dependências externas.

```powershell
# Contas e partidas compartilhadas
node backend/server.mjs
# Abra http://127.0.0.1:4174
```

Os dados privados ficam fora da pasta publicada, em `%USERPROFILE%\.fifabet-arena` no Windows. Consulte [configuração do servidor e revisão](docs/SERVIDOR.md) para habilitar a equipe, testar dois dispositivos e preparar hospedagem separada.

Para a demonstração estática:

```powershell
node serve.mjs
# Abra http://127.0.0.1:4173
```

Não abra o HTML diretamente por `file://`: módulos JavaScript precisam do servidor.

Para verificar regras, integração da interface e API:

```powershell
node --test *.test.mjs backend/*.test.mjs
```

Os testes cobrem IDs estáveis, convites e códigos, reservas sem saldo negativo, permissões de aceite, fotos, contestação, aprovação por terceiro, distribuição única, histórico, cancelamento e persistência. A carteira verifica parcelamento, pedido sem crédito automático, confirmação única, recusa, privacidade dos comprovantes e revisão de transferências. Dados de teste do servidor ficam fora do projeto.

## Perfil e coleção preservados

A camiseta oficial do time preferido continua no avatar. O catálogo tem 23 clubes com brasões e cores. A coleção anterior fica acessível em `colecao.html`, pelo perfil local, com seus dados preservados. Essa área é a demonstração anterior de personalização; compras, troféus, adversários e ranking nela continuam ilustrativos e não representam as partidas compartilhadas.

O catálogo preservado tem 13 avatares: 12 caricaturas e uma fotografia licenciada de Messi. Bandeiras, medalhas editoriais Ouro/Prata/Bronze e fontes das assinaturas estão documentadas. As três reproduções de assinaturas existentes são arquivos publicados, não autógrafos certificados; as dez restantes seguem em curadoria, sem assinaturas inventadas.

Fontes: [uniformes](docs/UNIFORMES_FONTES.md), [clubes](docs/CLUBES_FONTES.md), [avatares](docs/AVATARES_PROMPTS.md), [assinaturas](docs/ASSINATURAS_FONTES.md) e [avisos de terceiros](THIRD_PARTY_NOTICES.md). Fotografias, brasões, uniformes e marcas têm direitos separados da licença do código. FifaBet é independente da EA e da FIFA.

## Arquivos principais

- `index.html`, `play.js`, `practical.css`, `lobby.css`: entrada, partidas, carteira, ID, histórico e revisão.
- `model.mjs`: regras e persistência da demonstração local.
- `backend-client.mjs`: comunicação autenticada com a API na mesma origem.
- `backend/server.mjs`, `backend/accounts.mjs`: servidor, contas, fotos, decisões e consulta administrativa dos IDs.
- `colecao.html`, `app.js`: coleção e personalização da demonstração anterior.
- [Fluxo de desafios](docs/FLUXO_AMIGOS.md) e [servidor](docs/SERVIDOR.md): funcionamento, limites e publicação.

O código original segue a [licença proprietária de Ricardo Zordan (Djow)](LICENSE). Consulte o [guia de publicação](docs/LICENCA_E_PUBLICACAO.md) antes de lançar nas lojas. Nenhuma hospedagem foi contratada e nenhuma infraestrutura de Tibia foi alterada.
