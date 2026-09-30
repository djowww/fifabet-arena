# FifaBet Arena

Desafios entre amigos no EA SPORTS FC, com ID próprio do FifaBet, pontos de demonstração, foto do placar e revisão pela equipe.

**Interface pública:** https://djowww.github.io/fifabet-arena/

## Fluxo principal

1. Crie um perfil e receba um ID permanente.
2. Escolha o amigo pelo ID, modo, plataforma, regras e pontos por jogador.
3. Seus pontos ficam reservados no convite. O rival entra na própria conta e aceita, reservando a mesma quantidade.
4. Envie o placar com uma foto. O rival pode confirmar ou sinalizar fraude/divergência com outra foto.
5. Uma conta autorizada da equipe revisa a evidência antes de distribuir pontos. Um participante não pode julgar o próprio desafio.
6. Consulte rival, placar, situação e decisão no histórico dos dois jogadores.

A página inicial foi reduzida ao formulário, ID, saldos e desafios. A classificação usa resultados revisados; não há adversários nem resultados inventados no fluxo principal. O ID e o histórico são internos do FifaBet; não há consulta automática ao histórico da EA.

## Duas modalidades

| Modalidade | Como funciona |
| --- | --- |
| GitHub Pages / `node serve.mjs` | Perfis e desafios somente no navegador. Permite alternar dois perfis e experimentar convite, reserva, placar, contestação e histórico. Não envia fotos à equipe e não libera pontos por revisão real. |
| `node backend/server.mjs` | Contas com senha, partidas compartilhadas, fotos privadas e painel da equipe. Os dados ficam no servidor. Para celulares fora da rede local, é necessário hospedar o servidor com HTTPS e armazenamento persistente. |

Publicar no GitHub não publica a API. O servidor incluído usa JSON com gravação atômica e uma única instância; é um protótipo funcional, ainda sem a infraestrutura de banco e operação de um lançamento comercial. Os modos locais e compartilhados têm cadastros separados, sem migração automática.

Todas as operações usam **pontos fictícios, sem valor financeiro**. Não há Pix, depósitos, saques, cobrança real ou integração automática com resultados da EA.

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

Os testes cobrem IDs estáveis, reservas sem saldo negativo, permissões de aceite, fotos, contestação, aprovação por terceiro, distribuição única, histórico, cancelamento e persistência. Dados de teste do servidor ficam fora do projeto.

## Perfil e coleção preservados

A camiseta oficial do time preferido continua no avatar. O catálogo tem 23 clubes com brasões e cores. A coleção anterior fica acessível em `colecao.html`, pelo perfil local, com seus dados preservados. Essa área é a demonstração anterior de personalização; compras, troféus, adversários e ranking nela continuam ilustrativos e não representam as partidas compartilhadas.

O catálogo preservado tem 13 avatares: 12 caricaturas e uma fotografia licenciada de Messi. Bandeiras, medalhas editoriais Ouro/Prata/Bronze e fontes das assinaturas estão documentadas. As três reproduções de assinaturas existentes são arquivos publicados, não autógrafos certificados; as dez restantes seguem em curadoria, sem assinaturas inventadas.

Fontes: [uniformes](docs/UNIFORMES_FONTES.md), [clubes](docs/CLUBES_FONTES.md), [avatares](docs/AVATARES_PROMPTS.md), [assinaturas](docs/ASSINATURAS_FONTES.md) e [avisos de terceiros](THIRD_PARTY_NOTICES.md). Fotografias, brasões, uniformes e marcas têm direitos separados da licença do código. FifaBet é independente da EA e da FIFA.

## Arquivos principais

- `index.html`, `play.js`, `practical.css`: interface de desafios, ID, histórico e revisão.
- `model.mjs`: regras e persistência da demonstração local.
- `backend-client.mjs`: comunicação autenticada com a API na mesma origem.
- `backend/server.mjs`, `backend/accounts.mjs`: servidor, contas, fotos, decisões e consulta administrativa dos IDs.
- `colecao.html`, `app.js`: coleção e personalização da demonstração anterior.
- [Fluxo de desafios](docs/FLUXO_AMIGOS.md) e [servidor](docs/SERVIDOR.md): funcionamento, limites e publicação.

O código original segue a [licença proprietária de Ricardo Zordan (Djow)](LICENSE). Consulte o [guia de publicação](docs/LICENCA_E_PUBLICACAO.md) antes de lançar nas lojas. Nenhuma hospedagem foi contratada e nenhuma infraestrutura de Tibia foi alterada.