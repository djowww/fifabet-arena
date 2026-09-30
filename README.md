# Fifa GO

Partidas entre amigos no EA SPORTS FC, com contas persistentes, IDs próprios do Fifa GO, foto do placar e revisão pela equipe. A integração de pagamentos reais está pendente; enquanto isso, a versão conectada permite partidas amistosas sem créditos.

**Domínio público:** https://betfifa.com.br/

**Repositório:** https://github.com/djowww/fifabet-arena

A estrutura de publicação usa HTTPS em `betfifa.com.br`, pelo VPS e pelo proxy da zona exclusiva do domínio na Cloudflare, com registro do domínio na Hostinger. O Fifa GO tem usuário, serviço, runtime Node.js, pasta de código e dados próprios. O Nginx encaminha somente o host `betfifa.com.br` à porta interna `127.0.0.1:4174`. A atualização com SQLite e login social exige implantação e conferência da versão entregue pelo domínio; esta documentação descreve a arquitetura, sem confirmar que a atualização já foi instalada. Serviços, arquivos, domínios e regras de firewall do Tibia devem permanecer preservados.

Alguns resolvedores podem manter o destino anterior do GitHub Pages em cache durante a propagação. Nesse caso, a API pode retornar 404. No domínio de produção `betfifa.com.br`/`www.betfifa.com.br`, a interface exibe indisponibilidade e bloqueia cadastro/carteira locais até restabelecer a conexão; não cria contas ou saldos fictícios como alternativa. Não alterar os nameservers novamente para contornar esse cache.

Contas, convites, histórico e carteira da versão conectada ficam em SQLite privado no servidor e podem ser acessados de outro dispositivo. Perfis da demonstração local continuam separados: dados salvos no navegador não são migrados automaticamente para contas do servidor. O GitHub mantém o código e uma publicação estática; voltar a entregar essa versão pelo domínio exige alterar os registros DNS. Sem API, o domínio de produção permanece indisponível; a demonstração local é permitida somente em hosts de demonstração, como localhost ou github.io sem redirecionamento ao domínio de produção. **Um push no GitHub não instala uma atualização no VPS**.

**Configurações externas pendentes:** habilitar a conta da equipe para revisar resultados; criar e instalar o cliente Google OAuth (app em modo de teste) e deixar Apple desativado. O Pix manual possui implementação opcional, mas a produção permanece em `FIFABET_PAYMENT_MODE=unconfigured` até configurar, no servidor privado, a chave, os pacotes e o UUID de um revisor independente. Não há gateway nem confirmação automática de pagamento. Login por apelido/ID e senha funciona com o banco.

## Fluxo principal

1. Crie um perfil e receba um ID permanente.
2. Escolha o amigo pelo ID, modo, plataforma e regras. Na configuração atual, crie uma amistosa sem créditos.
3. Compartilhe o código público `FG-XXXXXXXXXX` ou link de convite. O rival entra na própria conta e aceita.
4. Envie o placar com uma foto. O rival pode confirmar ou sinalizar fraude/divergência com outra foto.
5. Uma conta autorizada da equipe revisa a evidência antes de concluir o resultado. Um participante não pode julgar o próprio desafio.
6. Consulte rival, placar, situação e decisão no histórico dos dois jogadores.

A página inicial usa a chamada **Joga aí com seus amigos**, com a marca **Fifa GO**, e tem dois cartões práticos: **Entrar em uma partida**, com campo direto para código ou link, e **Criar minha partida**, com uma ilustração original de futebol. As fotos de atletas foram retiradas da entrada; os itens e as atribuições da coleção continuam preservados. A criação tem três etapas: amigo/modo/plataforma, regras/créditos e resumo. A confirmação final cria o convite; na versão conectada sem provedor, `stake:0` permite jogar sem reserva. Voltar para editar preserva o rascunho.

Os convites recebidos aparecem primeiro na lista de partidas. Antes de aceitar, o jogador autenticado confere as regras. Códigos públicos do servidor usam `FG-` e 10 dígitos hexadecimais maiúsculos; a prévia anônima mostra somente código, modo, plataforma, stake/creditMode, estado e prazo, sem nomes, regras em texto livre, IDs de contas, saldo, fotos ou resultados. Aceitar exige autenticação e autorização. Links secretos continuam usando um token aleatório. Códigos da demonstração local usam `JOGO-XXXXXXXX` e permanecem separados dos códigos do servidor. A criação é idempotente e confere a conta que confirmou o resumo.

Contas conectadas novas começam com saldo zero, sem bônus financeiro. O saldo disponível e o reservado são separados; o próximo passo enquanto os pagamentos estão pendentes é jogar uma amistosa. Créditos anteriores da demonstração conectada ficam separados em `demoBalance`/`demoTransactions`, sem conversão para dinheiro real. A referência ao EA SPORTS FC identifica compatibilidade, mantendo claro o caráter independente do Fifa GO.

A classificação usa resultados revisados; não há adversários nem resultados inventados no fluxo principal. O ID e o histórico são internos do Fifa GO; não há consulta automática ao histórico da EA.

## Carteira e pagamentos pendentes

- Produção com `paymentMode:'unconfigured'`, compras indisponíveis e partidas `friendly` com `stake:0`.
- Carteira principal com saldo disponível, reservado e extrato próprios; nenhuma recarga real é apresentada como concluída.
- Saldo, extrato e reservas da demonstração anterior ficam separados. Partidas antigas recebem `creditMode:'legacy_demo'` e movimentam somente essa carteira demonstrativa.
- Cartão, Pix e transferência dependem da conexão futura do provedor comercial e sua confirmação no servidor.
- A simulação anterior de cartão/Pix/transferência permanece restrita ao ambiente `demo` de desenvolvimento local, sem valor financeiro.
- Pedidos e comprovantes existentes são preservados, privados e separados por jogador; não podem liberar saldo pela simulação no ambiente público.

Não há integração com processador de pagamentos, saques ou consulta automática aos resultados da EA. A organização do caixa é própria; não há vínculo com PokerStars nem sandbox oficial de outro provedor. Consulte [armazenamento e migração da carteira](docs/BANCO.md).

## Duas modalidades

| Modalidade | Como funciona |
| --- | --- |
| Estático em localhost/github.io (quando servido nesse host) / `node serve.mjs` | Perfis e desafios demonstrativos somente no navegador. Permite alternar dois perfis e experimentar convite, reserva, placar, contestação e histórico. Não envia fotos à equipe e não libera pontos por revisão real. No domínio de produção, API ausente bloqueia esse modo. |
| VPS / `node backend/server.mjs` | Contas persistentes com senha, partidas compartilhadas e fotos privadas. SQLite requer Node.js 24+. Google/Apple dependem das credenciais externas; revisão exige conta da equipe. Cada implantação deve ser conferida pelo domínio HTTPS. |

A publicação no VPS é manual e separada do GitHub Pages. O servidor usa SQLite com transações atômicas e uma única instância escritora. Migra o JSON legado uma vez, preservando original e backup. Operação comercial ainda exige configuração de provedores, backups e recuperação de conta. Os modos locais e compartilhados têm cadastros separados, sem migração automática entre eles.

O padrão do servidor é `FIFABET_PAYMENT_MODE=unconfigured`. Novas amistosas não usam créditos; créditos demonstrativos antigos continuam sem valor financeiro e não representam dinheiro depositado.

## Executar

Node.js **24 ou superior**, sem dependências externas. O SQLite é o módulo nativo `node:sqlite`.

```powershell
# Contas e partidas compartilhadas
node backend/server.mjs
# Abra http://127.0.0.1:4174
```

Os dados privados ficam fora da pasta publicada, em `%USERPROFILE%\.fifabet-arena` no Windows. A estrutura do VPS usa `/var/lib/fifago`. `arena.sqlite` contém os registros; imagens e backups permanecem privados. Consulte [configuração do servidor e revisão](docs/SERVIDOR.md) e [banco e migração](docs/BANCO.md).

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

A suíte existente documenta os fluxos anteriores de IDs, convites, reservas, fotos, revisão e carteira demonstrativa. Os casos do servidor precisam acompanhar o contrato SQLite, a carteira separada e o padrão `unconfigured`. A suíte não foi executada nesta atualização; dados temporários de testes devem ficar fora do projeto.

## Perfil e coleção preservados

A camiseta oficial do time preferido continua no avatar. O catálogo tem 23 clubes com brasões e cores. A coleção anterior fica acessível em `colecao.html`, pelo perfil local, com seus dados preservados. Essa área é a demonstração anterior de personalização; compras, troféus, adversários e ranking nela continuam ilustrativos e não representam as partidas compartilhadas.

O catálogo preservado tem 13 avatares: 12 caricaturas e uma fotografia licenciada de Messi. Bandeiras, medalhas editoriais Ouro/Prata/Bronze e fontes das assinaturas estão documentadas. As três reproduções de assinaturas existentes são arquivos publicados, não autógrafos certificados; as dez restantes seguem em curadoria, sem assinaturas inventadas.

Fontes: [uniformes](docs/UNIFORMES_FONTES.md), [clubes](docs/CLUBES_FONTES.md), [avatares](docs/AVATARES_PROMPTS.md), [assinaturas](docs/ASSINATURAS_FONTES.md) e [avisos de terceiros](THIRD_PARTY_NOTICES.md). Fotografias, brasões, uniformes e marcas têm direitos separados da licença do código. Fifa GO é independente da EA e da FIFA.

## Arquivos principais

- `index.html`, `play.js`, `practical.css`, `lobby.css`, `wizard.css`: entrada, criação em etapas, partidas, carteira, ID, histórico e revisão.
- `model.mjs`: regras e persistência da demonstração local.
- `backend-client.mjs`: comunicação autenticada com a API na mesma origem.
- `backend/server.mjs`, `backend/accounts.mjs`: servidor, contas, fotos, decisões e consulta administrativa dos IDs.
- `backend/database.mjs`: SQLite privado, restrições, gravação atômica e migração do JSON legado.
- `backend/oauth.mjs`: login Google/Apple verificado no servidor; ativação depende de credenciais externas.
- `deploy/fifago.service`, `deploy/nginx-fifago.conf`: modelos do serviço isolado e do novo host Nginx, sem substituição da configuração dos demais sites.
- `colecao.html`, `app.js`: coleção e personalização da demonstração anterior.
- [Fluxo de desafios](docs/FLUXO_AMIGOS.md) e [servidor](docs/SERVIDOR.md): funcionamento, limites e publicação.

O código original segue a [licença proprietária de Ricardo Zordan (Djow)](LICENSE). Consulte o [guia de publicação](docs/LICENCA_E_PUBLICACAO.md) antes de lançar nas lojas. A publicação reaproveita o VPS existente com limites próprios de recursos; não altera o serviço do Tibia.
