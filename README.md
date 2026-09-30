# Fifa GO

Partidas entre amigos no EA SPORTS FC, com ID próprio do Fifa GO, carteira de créditos de teste, foto do placar e revisão pela equipe.

**Domínio público:** https://betfifa.com.br/

**Repositório:** https://github.com/djowww/fifabet-arena

A interface e a API estão instaladas no VPS, com HTTPS para `betfifa.com.br`. A zona exclusiva do domínio está configurada na Cloudflare e os novos nameservers foram salvos no registro da Hostinger; a disponibilidade pública aguarda propagação e conferência pelo domínio. O Fifa GO usa usuário, serviço, runtime Node.js, pasta de código e dados próprios. O Nginx encaminha somente o host `betfifa.com.br` à porta interna `127.0.0.1:4174`. Os serviços, arquivos, domínios e regras de firewall do Tibia permanecem preservados.

Contas, convites, histórico e créditos de teste da versão conectada ficam no servidor e poderão ser acessados de outro dispositivo quando a rota pública estiver confirmada. Perfis da demonstração local continuam separados: dados salvos no navegador não são migrados automaticamente para contas do servidor. O GitHub mantém o código e uma publicação estática; voltar a entregar essa versão pelo domínio exige alterar os registros DNS. Se a API não estiver disponível, a interface identifica somente a demonstração local, sem tornar as contas do VPS acessíveis. **Um push no GitHub não instala uma atualização no VPS**.

**Revisão pendente de configuração:** ainda não há conta da equipe habilitada no VPS. Resultados enviados e comprovantes de transferência ficam em análise; os pontos dessas operações só serão liberados após uma decisão de revisor autorizado. Todos os créditos continuam fictícios, sem pagamentos reais.

## Fluxo principal

1. Crie um perfil e receba um ID permanente.
2. Escolha o amigo pelo ID, modo, plataforma, regras e pontos por jogador.
3. Seus pontos ficam reservados no convite. O rival entra na própria conta e aceita, reservando a mesma quantidade.
4. Envie o placar com uma foto. O rival pode confirmar ou sinalizar fraude/divergência com outra foto.
5. Uma conta autorizada da equipe revisa a evidência antes de distribuir pontos. Um participante não pode julgar o próprio desafio.
6. Consulte rival, placar, situação e decisão no histórico dos dois jogadores.

A página inicial usa a chamada **Joga aí com seus amigos**, com a marca **Fifa GO**, e tem dois cartões práticos: **Entrar em uma partida**, com campo direto para código ou link, e **Criar minha partida**, com uma ilustração original de futebol. As fotos de atletas foram retiradas da entrada; os itens e as atribuições da coleção continuam preservados. A criação tem três etapas: amigo/modo/plataforma, créditos/regras e resumo. Só a confirmação final cria o convite e reserva os créditos. Voltar para editar preserva o rascunho.

Os convites recebidos aparecem primeiro na lista de partidas. Antes de aceitar, o jogador confere as regras e a reserva necessária. Códigos locais usam `JOGO-XXXXXXXX`, independente do ID interno; códigos antigos continuam aceitos. Links da versão conectada usam apenas um token, sem saldo, fotos ou resultados. A consulta exige autenticação e permissão, e informa convites expirados, cancelados ou já aceitos. A criação no servidor é idempotente e confere a conta que confirmou o resumo.

Sem perfil, a página oferece começar com 1.000 créditos de teste; com perfil, mostra disponíveis e reservados separadamente. Todas as ações de recarga usam **Adicionar créditos de teste**. Saldo zero e créditos reservados têm instruções para o próximo passo. A página identifica a demonstração local e a referência ao EA SPORTS FC como compatibilidade, mantendo claro o caráter independente do Fifa GO.

A classificação usa resultados revisados; não há adversários nem resultados inventados no fluxo principal. O ID e o histórico são internos do Fifa GO; não há consulta automática ao histórico da EA.

## Carteira em ambiente de teste

- Saldo disponível, créditos reservados em partidas, pedidos pendentes e extrato.
- Pacotes de 100, 250, 500 ou 1.000 créditos fictícios.
- Cartão com 1 a 6 parcelas demonstrativas; Pix com confirmação de teste.
- Aprovação ou recusa simulada em uma etapa separada. Criar o pedido não altera o saldo; confirmar adiciona créditos uma única vez.
- Transferência com imagem de comprovante fictício. No servidor, outra conta autorizada da equipe confere a imagem e registra aprovação ou recusa. No modo local, o comprovante fica salvo em análise, sem liberação automática.
- Pedidos e comprovantes ficam separados por jogador. No servidor, as imagens são privadas e decisões sobre versões antigas do comprovante são rejeitadas.

Esta carteira é uma simulação própria do Fifa GO, sem integração com processador de pagamentos. Não recebe cartão real, chave Pix nem dados bancários. A organização do caixa usa como referência a escolha de métodos descrita no [suporte oficial do PokerStars](https://www.pokerstars.com/help/articles/dep-options-avail-general/), com identidade própria.

## Duas modalidades

| Modalidade | Como funciona |
| --- | --- |
| GitHub Pages / `node serve.mjs` | Perfis e desafios somente no navegador. Permite alternar dois perfis e experimentar convite, reserva, placar, contestação e histórico. Não envia fotos à equipe e não libera pontos por revisão real. |
| VPS / `node backend/server.mjs` | Contas com senha, partidas compartilhadas e fotos privadas. Instalado com HTTPS para `betfifa.com.br`; nameservers salvos, aguardando propagação e confirmação pública. A revisão exige uma conta da equipe configurada. |

A publicação no VPS é manual e separada do GitHub Pages. O servidor usa JSON com gravação atômica e uma única instância; é um protótipo funcional, ainda sem a infraestrutura de banco e operação de um lançamento comercial. Os modos locais e compartilhados têm cadastros separados, sem migração automática.

Todas as operações usam **créditos fictícios, sem valor financeiro**. Os métodos de recarga são demonstrativos: não há pagamento real, saque ou integração automática com resultados da EA. O modo de pagamento do servidor está fixado em `demo`.

## Executar

Node.js 18 ou superior, sem dependências externas.

```powershell
# Contas e partidas compartilhadas
node backend/server.mjs
# Abra http://127.0.0.1:4174
```

Os dados privados ficam fora da pasta publicada, em `%USERPROFILE%\.fifabet-arena` no Windows. No VPS, ficam em `/var/lib/fifago`. Consulte [configuração do servidor e revisão](docs/SERVIDOR.md) para habilitar a equipe, operar a publicação e consultar o procedimento de retorno ao GitHub Pages.

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

Fontes: [uniformes](docs/UNIFORMES_FONTES.md), [clubes](docs/CLUBES_FONTES.md), [avatares](docs/AVATARES_PROMPTS.md), [assinaturas](docs/ASSINATURAS_FONTES.md) e [avisos de terceiros](THIRD_PARTY_NOTICES.md). Fotografias, brasões, uniformes e marcas têm direitos separados da licença do código. Fifa GO é independente da EA e da FIFA.

## Arquivos principais

- `index.html`, `play.js`, `practical.css`, `lobby.css`, `wizard.css`: entrada, criação em etapas, partidas, carteira, ID, histórico e revisão.
- `model.mjs`: regras e persistência da demonstração local.
- `backend-client.mjs`: comunicação autenticada com a API na mesma origem.
- `backend/server.mjs`, `backend/accounts.mjs`: servidor, contas, fotos, decisões e consulta administrativa dos IDs.
- `deploy/fifago.service`, `deploy/nginx-fifago.conf`: modelos do serviço isolado e do novo host Nginx, sem substituição da configuração dos demais sites.
- `colecao.html`, `app.js`: coleção e personalização da demonstração anterior.
- [Fluxo de desafios](docs/FLUXO_AMIGOS.md) e [servidor](docs/SERVIDOR.md): funcionamento, limites e publicação.

O código original segue a [licença proprietária de Ricardo Zordan (Djow)](LICENSE). Consulte o [guia de publicação](docs/LICENCA_E_PUBLICACAO.md) antes de lançar nas lojas. A publicação reaproveita o VPS existente com limites próprios de recursos; não altera o serviço do Tibia.
