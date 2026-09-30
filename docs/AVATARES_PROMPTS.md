# Prompts e procedência dos avatares

Atualizado em 30 de setembro de 2026. O catálogo ativo reúne **13 jogadores: 12 caricaturas geradas por IA e uma fotografia licenciada de Messi**. As quatro figurinhas fictícias antigas permanecem apenas nas coleções já adquiridas.

## Geração da expansão

As nove novas caricaturas foram criadas com **`builtin image_gen.imagegen`**, em modo **`generate`**, por descrição e sem fotografia de atleta fornecida como referência. Os prompts pedem um retrato de cabeça e ombros, fundo transparente, camisa preta com detalhes verdes `#07F468` e proporções de caricatura. Assinaturas, bandeiras, emblemas e textos foram explicitamente excluídos das imagens; a interface fornece esses elementos separadamente.

Os PNGs foram copiados para o projeto sem edição local. O registro de dimensões, SHA-256, licença e estado da assinatura está em [assets/avatars/credits.json](../assets/avatars/credits.json).

| Atleta | Arquivo final | Prompt e manifesto |
| --- | --- | --- |
| Neymar | `assets/avatars/neymar.png` | [Grupo A](../assets/avatars/generation-group-a.json) |
| Vini Jr. | `assets/avatars/vinicius-junior.png` | [Grupo A](../assets/avatars/generation-group-a.json) |
| Erling Haaland | `assets/avatars/erling-haaland.png` | [Grupo A](../assets/avatars/generation-group-a.json) |
| Kylian Mbappé | `assets/avatars/kylian-mbappe.png` | [Grupo A](../assets/avatars/generation-group-a.json) |
| Mohamed Salah | `assets/avatars/mohamed-salah.png` | [Grupo B](../assets/avatars/generation-group-b.json) |
| Jude Bellingham | `assets/avatars/jude-bellingham.png` | [Grupo B](../assets/avatars/generation-group-b.json) |
| Robert Lewandowski | `assets/avatars/robert-lewandowski.png` | [Grupo B](../assets/avatars/generation-group-b.json) |
| Luka Modrić | `assets/avatars/luka-modric.png` | [Grupo B](../assets/avatars/generation-group-b.json) |
| Kevin De Bruyne | `assets/avatars/kevin-de-bruyne.png` | [Grupo B](../assets/avatars/generation-group-b.json) |

O Grupo A registra o estilo de Cristiano como referência apenas visualizada; nenhuma imagem foi enviada à geração das quatro artes. O Grupo B também usa somente descrição. Os prompts completos e caminhos retornados pela ferramenta ficam nos dois manifestos.

## Messi: fotografia como exceção

A solicitação de caricatura de Messi foi recusada pelo serviço de imagens com a categoria **`public-figure`**. A recusa está registrada no [manifesto do Grupo A](../assets/avatars/generation-group-a.json). Não houve nova tentativa, mudança de ferramenta ou transformação de uma foto para contornar a recusa.

Foi adotada a fotografia já publicada **Lionel Messi 20180626 (cropped)**, por **Kirill Venediktov / soccer.ru**, sob **CC BY-SA 3.0 Unported**. O JPEG foi baixado intacto, sem geração ou edição local, e aparece como fotografia: `assets/avatars/lionel-messi.jpg`. O enquadramento e gradiente aplicados pela interface mantêm a mesma licença. [Crédito completo, fonte e hash](../assets/avatars/messi-photo-credit.json).

## Artes anteriores e assinaturas

Os prompts de Cristiano Ronaldo, Bruno Fernandes e Senne Lammens estão em [assets/avatars/prompts.json](../assets/avatars/prompts.json). A caricatura de Lammens deriva de fotografia e mantém **CC BY-SA 4.0**; seus créditos foram preservados na expansão.

As três reproduções de assinaturas anteriores continuam separadas das imagens. As assinaturas dos dez atletas novos estão em curadoria, sem autógrafos gerados ou imitados. Consulte [fontes das assinaturas](ASSINATURAS_FONTES.md) e [pesquisa da expansão](../assets/signatures/expansion-research.json).
