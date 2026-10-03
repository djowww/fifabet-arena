# Fifa GO

Partidas entre amigos no EA SPORTS FC, com contas persistentes, IDs próprios do Fifa GO e foto do placar. A compra de saldo permanece em configuração. A versão conectada permite partidas gratuitas ou salas com Joga aí Coin já disponíveis na carteira, com reserva obrigatória ao criar e entrar.

**Domínio público:** https://betfifa.com.br/

**Repositório:** https://github.com/djowww/fifabet-arena

## Beta gratuito no celular

O Fifa GO pode ser adicionado à tela inicial como um aplicativo web (PWA), pelo próprio domínio. Na página inicial, **Instalar no celular** mostra os passos para Android/Chrome e iPhone/Safari; navegadores compatíveis também podem oferecer **Instalar app**. Não é uma publicação na Google Play ou App Store e não exige a compra das contas dessas lojas.

Contas, convites, carteira e fotos exigem internet. O service worker guarda somente ícones, manifesto e uma tela genérica sem conexão; não guarda respostas da API, perfis, saldos ou evidências privadas. Para o beta público, use cadastro por apelido e senha: o Google OAuth ainda pode limitar o acesso aos testadores autorizados. Consulte [publicação mobile](docs/PUBLICACAO-MOBILE.md).

A estrutura de publicação usa HTTPS em `betfifa.com.br`, pelo VPS e pelo proxy da zona exclusiva do domínio na Cloudflare, com registro do domínio na Hostinger. O Fifa GO tem usuário, serviço, runtime Node.js, pasta de código e dados próprios. O Nginx encaminha somente o host `betfifa.com.br` à porta interna `127.0.0.1:4174`. A atualização com SQLite e login social exige implantação e conferência da versão entregue pelo domínio; esta documentação descreve a arquitetura, sem confirmar que a atualização já foi instalada. Serviços, arquivos, domínios e regras de firewall do Tibia devem permanecer preservados.

Alguns resolvedores podem manter o destino anterior do GitHub Pages em cache durante a propagação. Nesse caso, a API pode retornar 404. No domínio de produção `betfifa.com.br`/`www.betfifa.com.br`, a interface exibe indisponibilidade e bloqueia cadastro/carteira locais até restabelecer a conexão; não cria contas ou saldos fictícios como alternativa. Não alterar os nameservers novamente para contornar esse cache.

Contas, convites, histórico e carteira da versão conectada ficam em SQLite privado no servidor e podem ser acessados de outro dispositivo. Perfis da demonstração local continuam separados: dados salvos no navegador não são migrados automaticamente para contas do servidor. O GitHub mantém o código e uma publicação estática; voltar a entregar essa versão pelo domínio exige alterar os registros DNS. Sem API, o domínio de produção permanece indisponível; a demonstração local é permitida somente em hosts de demonstração, como localhost ou github.io sem redirecionamento ao domínio de produção. **Um push no GitHub não instala uma atualização no VPS**.

**Configurações externas pendentes:** habilitar a conta da equipe para revisar resultados; criar e instalar o cliente Google OAuth (app em modo de teste) e deixar Apple desativado. O Pix manual possui implementação opcional, mas a produção permanece em `FIFABET_PAYMENT_MODE=unconfigured` até configurar, no servidor privado, a chave, os pacotes e o UUID de um revisor independente. Não há gateway nem confirmação automática de pagamento. Login por apelido/ID e senha funciona com o banco.

## Fluxo principal

1. Crie um perfil e receba um ID permanente.
2. Escolha sala aberta na arena ou privada por convite, modo, plataforma e regras. Defina zero para jogar gratuitamente ou um valor em Joga aí Coin; a parte do anfitrião é reservada ao criar.
3. O rival encontra a sala aberta na arena ou usa código/link. Entrar em uma sala com aposta exige saldo e reserva a parte do rival.
4. Na preparação, conversem em privado e confirmem compatibilidade e início. A prontidão vale dois minutos e pode ser retirada; o jogo só começa com ambos prontos, sem nova cobrança. Edição, geração/plataforma, crossplay e regras ficam no resumo da sala.
5. Envie placar e foto própria. O rival tem cinco minutos para confirmar com outra foto e os mesmos gols, ou sinalizar divergência. Ausência não concede vitória; avisos aparecem enquanto a página estiver aberta.
6. Leituras consistentes, fotos distintas e ausência de riscos podem permitir validação automática. Na política nova, entrada de 500 Coin ou mais por jogador, fotos visualmente semelhantes/fingerprint indisponível, contestações e prazo vencido exigem equipe independente. A taxa continua 9%; empate devolve reservas sem taxa.
7. Consulte rival, placar, situação, decisão e lançamentos pelo histórico e carteira paginados.

Os padrões operacionais são 24 horas para sala aberta, dez minutos de preparação após entrada, dois minutos de prontidão, 60 minutos de jogo e 24 horas para atendimento. Convite/preparação vencidos devolvem reservas; jogo vencido abre atendimento, sem vitória ou devolução automática. Prazo de atendimento sinaliza atraso, sem garantir disponibilidade humana. Prazos e limite de revisão por valor ficam guardados na sala; consulte [salas e regras](docs/SALAS.md).

A página inicial destaca **Criar minha partida**, com uma ilustração original de futebol, e o campo de código ou link para entrar. As fotos de atletas foram retiradas da entrada; os itens e as atribuições da coleção continuam preservados. A criação tem três etapas: rival/visibilidade/modo/plataforma, regras/Joga aí Coin e resumo. A confirmação final cria a sala e reserva a parte do anfitrião quando há Coin. Voltar para editar preserva o rascunho. Salas públicas são listadas apenas para contas conectadas, com apelido, clube, modo, plataforma e valores; salas privadas exigem convite.

Os convites recebidos aparecem primeiro na lista de partidas. Antes de aceitar, o jogador autenticado confere as regras. Códigos públicos do servidor usam `FG-` e 10 dígitos hexadecimais maiúsculos; a prévia anônima mostra somente código, modo, plataforma, stake/creditMode, estado e prazo, sem nomes, regras em texto livre, IDs de contas, saldo, fotos ou resultados. Aceitar exige autenticação e autorização. Links secretos continuam usando um token aleatório. Códigos da demonstração local usam `JOGO-XXXXXXXX` e permanecem separados dos códigos do servidor. A criação é idempotente e confere a conta que confirmou o resumo.

Contas conectadas novas começam com saldo zero, sem bônus financeiro. O saldo disponível e o reservado são separados; o próximo passo enquanto os pagamentos estão pendentes é jogar uma amistosa. Créditos anteriores da demonstração conectada ficam separados em `demoBalance`/`demoTransactions`, sem conversão para dinheiro real. A referência ao EA SPORTS FC identifica compatibilidade, mantendo claro o caráter independente do Fifa GO.

A classificação usa resultados atuais validados, rating Elo, pontuação e posição pessoal. Somente três confrontos do mesmo par por dia UTC contam para ranking; os demais mantêm histórico e premiação normal. Não há adversários ou resultados inventados. IDs EA/PSN/Xbox declarados são opcionais e ajudam a adicionar o rival; não há integração automática com essas contas. A Arena permite filtros de plataforma, modo e faixa de entrada/saldo sem publicar o saldo dos jogadores.

## Carteira e pagamentos pendentes

- Produção com `paymentMode:'unconfigured'` e compras indisponíveis. Partidas gratuitas usam `friendly`/`stake:0`; novas salas com saldo existente usam `coins`, sem ativar pagamentos.
- Carteira principal com saldo disponível, reservado e extrato próprios; nenhuma recarga real é apresentada como concluída.
- Saldo, extrato e reservas da demonstração anterior ficam separados. Partidas antigas recebem `creditMode:'legacy_demo'` e movimentam somente essa carteira demonstrativa.
- Cartão, Pix e transferência dependem da conexão futura do provedor comercial e sua confirmação no servidor.
- A simulação anterior de cartão/Pix/transferência permanece restrita ao ambiente `demo` de desenvolvimento local, sem valor financeiro.
- Pedidos e comprovantes existentes são preservados, privados e separados por jogador; não podem liberar saldo pela simulação no ambiente público.
- Saldo principal reconcilia abertura registrada uma única vez mais extrato. Depósito aprovado exige crédito correspondente; histórico demonstrativo migrado permanece no livro separado.
- Se Pix manual for configurado, aprovação humana exige referência bancária única, valor exato e data válida. Esses controles não ativam pagamentos nem substituem a conferência no banco.
- Extrato, depósitos e histórico oferecem páginas por cursor, com referência pública da partida. Carteira acompanha alterações remotas; atualizações durante modal/edição são aplicadas ao terminar, preservando formulários e foco.

Não há integração com processador de pagamentos, saques ou consulta automática aos resultados da EA. A organização do caixa é própria; não há vínculo com PokerStars nem sandbox oficial de outro provedor. Consulte [armazenamento e migração da carteira](docs/BANCO.md).

## Duas modalidades

| Modalidade | Como funciona |
| --- | --- |
| Estático em localhost/github.io (quando servido nesse host) / `node serve.mjs` | Perfis e desafios demonstrativos somente no navegador. Permite alternar dois perfis e experimentar convite, reserva, placar, contestação e histórico. Não envia fotos à equipe e não libera pontos por revisão real. No domínio de produção, API ausente bloqueia esse modo. |
| VPS / `node backend/server.mjs` | Contas persistentes com senha, partidas compartilhadas e fotos privadas. SQLite requer Node.js 24+. Google/Apple dependem das credenciais externas; revisão exige conta da equipe. Cada implantação deve ser conferida pelo domínio HTTPS. |

A publicação no VPS é manual e separada do GitHub Pages. O servidor usa SQLite com transações atômicas e uma única instância escritora. Migra o JSON legado uma vez, preservando original e backup. Operação comercial ainda exige configuração de provedores, backups e recuperação de conta. Os modos locais e compartilhados têm cadastros separados, sem migração automática entre eles.

O padrão do servidor é `FIFABET_PAYMENT_MODE=unconfigured`. Amistosas gratuitas não reservam saldo. Salas com Joga aí Coin exigem saldo disponível dos dois jogadores, independentemente do modo escolhido. Créditos demonstrativos antigos continuam separados, sem valor financeiro e sem representar dinheiro depositado.

## Executar

Node.js **24 ou superior**. SQLite usa `node:sqlite`; OCR local usa Tesseract.js e fingerprint visual usa Sharp 0.35.5. Instale dependências pelo lockfile antes de iniciar. O fingerprint indica semelhança, sem autenticar o jogo; falha de análise não libera prêmio automático em salas com política nova.

```powershell
# Contas e partidas compartilhadas
npm ci --ignore-scripts
node backend/server.mjs
# Abra http://127.0.0.1:4174
```

Alternativa reproduzível: `pnpm install --frozen-lockfile --ignore-scripts`. Antes de ativar uma versão no servidor, confirmar o carregamento nativo do Sharp com o runtime isolado, conforme [SERVIDOR.md](docs/SERVIDOR.md). Instalação de dependências ou push não confirma a publicação.

Os dados privados ficam fora da pasta publicada, em `%USERPROFILE%\.fifabet-arena` no Windows; o VPS usa `/var/lib/fifago`. SQLite grava mudanças incrementais com transação/rollback e instância única. Fotos de salas/depósitos encerrados há 30 dias podem ir ao arquivo privado, mantendo leitura autorizada; disputas abertas permanecem ativas e não há exclusão automática. O padrão de capacidade é 200 MiB ativos, configurável; a administração mostra também arquivo e total. Backups devem incluir todas essas áreas. Consulte [servidor e revisão](docs/SERVIDOR.md) e [banco e migração](docs/BANCO.md).

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

A suíte cobre contas, compatibilidade, prazos/prontidão, reservas, concorrência, confirmação com duas fotos, revisão por risco/valor, reconciliação de saldo, referência Pix repetida, histórico/páginas, arquivo privado, ranking e atualização com formulários. Dados e fotos de teste ficam fora do projeto publicado. OCR/fingerprint não certificam a autenticidade de uma fotografia.

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
- `backend/game-policy.mjs`, `backend/ranking-policy.mjs`: prazos, compatibilidade e ranking de resultados validados.
- `backend/evidence-storage.mjs`, `backend/visual-fingerprint.mjs`: arquivo privado e análise visual limitada em processo separado.
- `backend/oauth.mjs`: login Google/Apple verificado no servidor; ativação depende de credenciais externas.
- `deploy/fifago.service`, `deploy/nginx-fifago.conf`: modelos do serviço isolado e do novo host Nginx, sem substituição da configuração dos demais sites.
- `colecao.html`, `app.js`: coleção e personalização da demonstração anterior.
- [Fluxo de desafios](docs/FLUXO_AMIGOS.md) e [servidor](docs/SERVIDOR.md): funcionamento, limites e publicação.

O código original segue a [licença proprietária de Ricardo Zordan (Djow)](LICENSE). Consulte o [guia de publicação](docs/LICENCA_E_PUBLICACAO.md) antes de lançar nas lojas. A publicação reaproveita o VPS existente com limites próprios de recursos; não altera o serviço do Tibia.
