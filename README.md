# FifaBet Arena

Protótipo front-end de uma arena para desafiar amigos no EA SPORTS FC, combinar o formato da partida e acompanhar vitórias, ranking, avatares e medalhas.

**GitHub Pages:** https://djowww.github.io/fifabet-arena/

## O que dá para explorar

- Criar um perfil local com apelido e avatar.
- Personalizar o perfil escolhendo entre 23 clubes brasileiros e europeus, com busca, prévia do brasão e fundo nas cores do time.
- Comprar com pontos fictícios 13 avatares de jogadores: 12 caricaturas e uma fotografia licenciada de Messi, montar uma coleção e equipar o avatar no perfil.
- Ver a bandeira da seleção de cada atleta, explorar as categorias Ouro, Prata e Bronze e consultar os créditos das artes e assinaturas disponíveis.
- Descobrir jogadores de exemplo, aceitar convites e montar uma lista de amigos.
- Enviar um desafio de demonstração escolhendo modo de jogo e pontos simbólicos.
- Simular o aceite do desafio e enviar uma foto do placar para deixar o resultado pendente de revisão.
- Sinalizar suspeita de fraude com descrição e foto; resultados pendentes não contam no ranking.
- Ver um ranking ilustrativo, histórico local e uma sala de troféus com seis peças originais inspiradas na cultura do futebol brasileiro e europeu.
- Cadastrar EA ID e plataforma como referência **não verificada**, editar ou remover o cadastro.
- Consultar partidas locais pelo histórico ou painel de EA ID.
- Explorar a arena com Haaland na capa e uma seção visual sobre desafiar um amigo no EA SPORTS FC, combinar um valor e registrar o placar.
- Ver o símbolo oficial EA SPORTS FC e um exemplo de R$50 por jogador, identificado como conceito: dinheiro real ainda não está disponível no protótipo.
- Explorar os cartões 1v1, Torneios e Aposte agora, com foco na rivalidade entre amigos. 1v1 e Aposte agora abrem a escolha de amigo para um desafio demo; Torneios abre uma prévia ilustrativa de mata-mata com quatro vagas, sem inscrições.
- Escolher 1 contra 1, Ultimate Team ou Clubes no formulário de desafio.
- Acessar classificações, estatísticas de atletas e FC Pro nos canais oficiais da EA.

Os perfis de oponentes, convites e números do ranking são demonstrativos. Os dados ficam no navegador; ainda não há contas compartilhadas, sincronização entre dispositivos, servidor de partidas ou apostas e pagamentos reais. As compras da loja descontam somente o saldo fictício local. Nos desafios, os pontos combinados não são transferidos, e nenhum ponto pode ser convertido em dinheiro.

## Desafio entre amigos

A antiga vitrine editorial com três fotografias foi substituída por três peças sobre o próprio jogo: confronto no EA SPORTS FC, valor combinado entre amigos e registro do placar. O exemplo de R$50 por jogador e R$100 no confronto apresenta a direção futura do produto; não cria um saldo, uma cobrança ou uma premiação real. O botão de desafio abre o fluxo existente com pontos de demonstração.

O logotipo genérico EA SPORTS FC foi obtido da página oficial do jogo, com procedência em [assets/brand/credits.json](assets/brand/credits.json). A marca pertence à Electronic Arts; o aplicativo permanece independente.

A seção “Escolha a disputa. Chame seu rival.” destaca 1v1, Torneios e Aposte agora. As ações de desafio usam o fluxo local existente e pontos fictícios. A prévia de torneio mostra duas semifinais e uma final, sem registrar inscrições, resultados ou premiações; a gestão de campeonatos ainda não está implementada.

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

O catálogo tem **13 avatares ativos: 12 caricaturas geradas por IA e uma fotografia licenciada de Lionel Messi**. Além de Cristiano Ronaldo, Bruno Fernandes e Senne Lammens, a expansão inclui Neymar, Vini Jr., Erling Haaland, Lionel Messi, Kylian Mbappé, Mohamed Salah, Jude Bellingham, Robert Lewandowski, Luka Modrić e Kevin De Bruyne.

As bandeiras identificam a seleção representada por cada atleta. Inglaterra usa a cruz de São Jorge, não a bandeira do Reino Unido. Os arquivos são do projeto **flag-icons**, sob MIT, com fontes em [assets/flags/credits.json](assets/flags/credits.json) e aviso preservado em [assets/flags/LICENSE](assets/flags/LICENSE).

Ouro, Prata e Bronze são escolhas editoriais subjetivas de reconhecimento público; não são OVR, notas da EA ou uma medição de popularidade ou desempenho. Todas as compras usam pontos de demonstração, sem pagamento real.

As ilustrações de Cristiano e Bruno foram geradas sem fotografias de atletas como referência; a de Bruno passou por uma edição de estilo sobre a própria imagem gerada. A ilustração de Lammens adapta uma fotografia de Bryan Berlin / WikiPortraits e mantém **CC BY-SA 4.0**, com atribuição e indicação da transformação. Os arquivos e a procedência estão em [assets/avatars/credits.json](assets/avatars/credits.json).

As nove novas caricaturas foram geradas por descrição, sem fotografia de referência, com prompts e manifestos em [docs/AVATARES_PROMPTS.md](docs/AVATARES_PROMPTS.md). Messi aparece como **fotografia de 2018**, por Kirill Venediktov / soccer.ru, sob **CC BY-SA 3.0**, baixada intacta; os créditos estão em [assets/avatars/messi-photo-credit.json](assets/avatars/messi-photo-credit.json).

As assinaturas são reproduções de SVGs publicados, preservadas e sanitizadas separadamente das ilustrações. A documentação identifica sua origem e o que foi possível conferir. Não são autógrafos personalizados, certificados de autenticidade ou produtos endossados pelos atletas. Consulte [fontes das assinaturas](docs/ASSINATURAS_FONTES.md) e [créditos estruturados](assets/signatures/credits.json).

As três reproduções existentes foram mantidas. As assinaturas dos dez jogadores novos estão **em curadoria**: nesta pesquisa não foi encontrado um arquivo que atingisse o critério de procedência do projeto. Nenhuma assinatura foi desenhada ou gerada para preencher essa ausência. [Registro da pesquisa](assets/signatures/expansion-research.json).

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
- `rivalry-section.mjs` e `rivalry.css` — apresentação dos desafios entre amigos e do conceito de valor combinado.
- `competitive-modes.css` — cartões de rivalidade e apresentação da prévia de torneio.
- `assets/brand/` — símbolo EA SPORTS FC e registro de procedência.
- `assets/avatars/`, `assets/signatures/` e `assets/players/` — caricaturas, fotografia de Messi, reproduções de assinaturas e fotografias editoriais, com créditos separados.
- `assets/flags/` — bandeiras SVG de flag-icons e sua licença MIT.
- `assets/clubs/` — brasões com manifesto de fontes; `assets/trophies/` — seis ilustrações SVG originais da arena.
- `model.test.mjs` e `ui-flows.test.mjs` — testes das regras e dos fluxos da demonstração.
- `package.json` — comandos do projeto, sem dependências externas.

## EA ID e licença

O cadastro manual do EA ID não autentica a conta. A API oficial exige acesso aprovado e não há integração de histórico de partidas disponível neste app. Nenhuma senha ou token EA é solicitado. Consulte [PLANO_INTEGRACAO_EAFC.md](PLANO_INTEGRACAO_EAFC.md) para o caminho de banco próprio, autenticação e integração autorizada.

O código original segue a [licença proprietária](LICENSE) de Ricardo Zordan (Djow). Fotografias e a adaptação de Lammens mantêm suas licenças separadas; os demais ativos também têm sua procedência documentada. O [guia de publicação](docs/LICENCA_E_PUBLICACAO.md) descreve o que ainda falta para as lojas Android e iOS.

## Referência visual EA SPORTS FC

A interface usa como referência o site do jogo EA SPORTS FC: verde `#07F468`, carvão `#151616`, branco `#FAFAFA`, botões arredondados e composição editorial com fotografia e texto. A loja aplica essa paleta em `shop.css`, com acabamentos Ouro, Prata e Bronze nas figurinhas. As cores foram conferidas na página oficial em 29/09/2026. Grafismos e componentes da arena permanecem originais. [Referência visual: EA SPORTS FC](https://www.ea.com/pt-br/games/ea-sports-fc).
