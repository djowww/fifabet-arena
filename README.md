# FifaBet Arena

Protótipo front-end de uma arena para desafiar amigos no EA SPORTS FC, combinar o formato da partida e acompanhar vitórias, ranking, avatares e medalhas.

**GitHub Pages:** https://djowww.github.io/fifabet-arena/

## O que dá para explorar

- Criar um perfil local com apelido e avatar.
- Personalizar o perfil escolhendo entre 23 clubes brasileiros e europeus, com busca, prévia do brasão e fundo nas cores do time.
- Comprar com pontos fictícios caricaturas de Cristiano Ronaldo, Bruno Fernandes e Senne Lammens, montar uma coleção e usar uma delas como avatar.
- Explorar as categorias Ouro, Prata e Bronze e consultar as fontes das reproduções de assinaturas que acompanham as figurinhas.
- Descobrir jogadores de exemplo, aceitar convites e montar uma lista de amigos.
- Enviar um desafio de demonstração escolhendo modo de jogo e pontos simbólicos.
- Simular o aceite do desafio e enviar uma foto do placar para deixar o resultado pendente de revisão.
- Sinalizar suspeita de fraude com descrição e foto; resultados pendentes não contam no ranking.
- Ver um ranking ilustrativo, histórico local e uma sala de troféus com seis peças originais inspiradas na cultura do futebol brasileiro e europeu.
- Cadastrar EA ID e plataforma como referência **não verificada**, editar ou remover o cadastro.
- Consultar partidas locais pelo histórico ou painel de EA ID.
- Explorar a direção visual com fotos reais de Haaland, Alexia Putellas e Mbappé, com créditos acessíveis.
- Selecionar 1 contra 1, Ultimate Team ou Clubes na arena para abrir um desafio com o modo escolhido.
- Acessar classificações, estatísticas de atletas e FC Pro nos canais oficiais da EA.

Os perfis de oponentes, convites e números do ranking são demonstrativos. Os dados ficam no navegador; ainda não há contas compartilhadas, sincronização entre dispositivos, servidor de partidas ou apostas e pagamentos reais. As compras da loja descontam somente o saldo fictício local. Nos desafios, os pontos combinados não são transferidos, e nenhum ponto pode ser convertido em dinheiro.

## Perfil e clube do coração

A configuração do perfil permite buscar e selecionar um dos **23 clubes** do catálogo. A prévia mostra o brasão e as cores antes de salvar. O clube escolhido é persistido pelo seu identificador, permitindo recuperar a mesma identidade ao reabrir a arena. No Internacional, o vermelho `#E20613` foi extraído do próprio SVG publicado no site oficial.

Os perfis anteriores são migrados para o esquema 6, preservando avatares, coleção, conquistas e nomes de time personalizados que já estavam salvos. O catálogo organiza os clubes conhecidos sem apagar a personalização anterior.

Os brasões vêm de fontes oficiais documentadas; as cores de interface aproximam a identidade de cada clube. A origem de cada arquivo e as alterações estão em [assets/clubs/credits.json](assets/clubs/credits.json) e [fontes dos clubes](docs/CLUBES_FONTES.md), conferidas em 30/09/2026.

## Sala de troféus

As seis conquistas receberam taças, medalhas e uma chuteira desenhadas em SVG para a arena. A apresentação tem referências à arquibancada, à camisa 10, aos clássicos e às noites de copa do futebol brasileiro e europeu. São colecionáveis originais do aplicativo; não representam troféus oficiais ou vitórias em competições reais.

| Peça | Critério preservado |
| --- | --- |
| Taça de estreia | Criar um perfil local. |
| Alma de arquibancada | Salvar uma partida demo nos favoritos. |
| Camisa 10 | Registrar o primeiro palpite na simulação demo. |
| Chuteira de ouro | Concluir um palpite vencedor na simulação demo. |
| Clássico entre amigos | Adicionar o primeiro amigo de demonstração. |
| Noites europeias | Visitar as sete áreas principais da arena. |

Os identificadores e as regras das seis conquistas foram mantidos, assim como os registros de quem já as desbloqueou. Resultados de palpites continuam simulados; a mudança visual não aprova resultados de desafios pendentes de revisão.

## Loja e coleção

O catálogo atual tem três caricaturas geradas por IA: **Cristiano Ronaldo — Ouro**, **Bruno Fernandes — Prata** e **Senne Lammens — Bronze**. As categorias são uma escolha editorial subjetiva de reconhecimento público; não são OVR, notas da EA ou uma medição de popularidade ou desempenho. Todas as compras usam pontos de demonstração, sem pagamento real.

As ilustrações de Cristiano e Bruno foram geradas sem fotografias de atletas como referência; a de Bruno passou por uma edição de estilo sobre a própria imagem gerada. A ilustração de Lammens adapta uma fotografia de Bryan Berlin / WikiPortraits e mantém **CC BY-SA 4.0**, com atribuição e indicação da transformação. Os arquivos e a procedência estão em [assets/avatars/credits.json](assets/avatars/credits.json).

As assinaturas são reproduções de SVGs publicados, preservadas e sanitizadas separadamente das ilustrações. A documentação identifica sua origem e o que foi possível conferir. Não são autógrafos personalizados, certificados de autenticidade ou produtos endossados pelos atletas. Consulte [fontes das assinaturas](docs/ASSINATURAS_FONTES.md) e [créditos estruturados](assets/signatures/credits.json).

As quatro figurinhas fictícias anteriores — Nilo Raio, Maya Luz, Tito Rocha e Breno Vale — saíram do catálogo de compras. Quem já as possui mantém sua coleção e pode continuar usando esses avatares.

As fotografias editoriais da arena possuem atribuição e licença CC BY-SA 4.0 em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). São arquivos distintos das caricaturas da loja. Fotos, ilustrações e assinaturas não representam endosso; suas condições e direitos de terceiros permanecem separados da licença do código.

## Revisão de resultados

O protótipo exige uma foto para registrar o resultado e permite bloquear o desafio com uma denúncia de fraude. Nesta versão estática, a evidência fica apenas no navegador: ainda não existe envio para a equipe, painel de moderação ou distribuição de pontos após aprovação. Para uma revisão antifraude real entre dispositivos, é necessário conectar autenticação, armazenamento privado de imagens e decisões da equipe no backend; sem isso, não trate a foto local como prova revisada.

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

- `index.html`, `styles.css`, `arena.css`, `shop.css`, `app.js` e `model.mjs` — aplicação estática servida pelo GitHub Pages.
- `clubs.mjs` e `profile.css` — catálogo de clubes e apresentação da personalização de perfil.
- `football-trophies.mjs` e `achievements.css` — sala de troféus e apresentação das seis conquistas.
- `assets/avatars/`, `assets/signatures/` e `assets/players/` — caricaturas, reproduções de assinaturas e fotografias editoriais, com créditos separados.
- `assets/clubs/` — brasões com manifesto de fontes; `assets/trophies/` — seis ilustrações SVG originais da arena.
- `model.test.mjs` e `ui-flows.test.mjs` — testes das regras e dos fluxos da demonstração.
- `package.json` — comandos do projeto, sem dependências externas.

## EA ID e licença

O cadastro manual do EA ID não autentica a conta. A API oficial exige acesso aprovado e não há integração de histórico de partidas disponível neste app. Nenhuma senha ou token EA é solicitado. Consulte [PLANO_INTEGRACAO_EAFC.md](PLANO_INTEGRACAO_EAFC.md) para o caminho de banco próprio, autenticação e integração autorizada.

O código original segue a [licença proprietária](LICENSE) de Ricardo Zordan (Djow). Fotografias e a adaptação de Lammens mantêm suas licenças separadas; os demais ativos também têm sua procedência documentada. O [guia de publicação](docs/LICENCA_E_PUBLICACAO.md) descreve o que ainda falta para as lojas Android e iOS.

## Referência visual EA SPORTS FC

A interface usa como referência o site do jogo EA SPORTS FC: verde `#07F468`, carvão `#151616`, branco `#FAFAFA`, botões arredondados e composição editorial com fotografia e texto. A loja aplica essa paleta em `shop.css`, com acabamentos Ouro, Prata e Bronze nas figurinhas. As cores foram conferidas na página oficial em 29/09/2026. Grafismos e componentes da arena permanecem originais. [Referência visual: EA SPORTS FC](https://www.ea.com/pt-br/games/ea-sports-fc).
