# Fifa GO no celular: beta público gratuito

Atualizado em **1º de outubro de 2026**.

## Decisão atual

O beta será oferecido gratuitamente como **PWA em https://betfifa.com.br/**, com partidas amistosas entre amigos e instalação pelo navegador. Não haverá envio ao Google Play, App Store ou TestFlight nesta etapa.

O usuário interrompeu a preparação das lojas por não dispor de recursos para as inscrições e ferramentas necessárias. Na verificação realizada nesta sessão, foram encontrados o cadastro/acesso ao Google Play sem inscrição de desenvolvedor paga concluída e o login no portal Apple. Isso não confirma contas de desenvolvedor ativas nem autorização de distribuição pelas lojas.

A implementação do manifest, ícones, `pwa.mjs`, `sw.js` e página offline está em andamento. A integração em `index.html` e no servidor também precisa ser concluída. Este documento registra a decisão e os critérios de entrega; a publicação efetiva deve ser confirmada pelo domínio após a implantação. Não foi gerado convite de partida, conta ou dado de usuário para elaborar este documento.

Uma PWA pode ser instalada a partir do navegador sem produzir ou assinar um pacote nativo. Os critérios e a aparência da instalação variam entre navegador e aparelho. [Instalação de PWAs — web.dev](https://web.dev/learn/pwa/installation).

## Como instalar

### Android com Chrome

1. Abra **https://betfifa.com.br/** no Chrome do celular.
2. Abra o menu de três pontos.
3. Escolha **Instalar app** e confirme. Dependendo do aparelho/versão, a opção pode aparecer como **Adicionar à tela inicial**.
4. Abra o Fifa GO pelo ícone criado.

Se o navegador não oferecer a instalação, continue usando o endereço no Chrome e confira se a versão PWA já está implantada. O nome do item e o resultado podem variar entre um aplicativo web instalado e um atalho. [Orientação de instalação Android — web.dev](https://web.dev/learn/pwa/installation#android_installation).

### iPhone com Safari

1. Abra **https://betfifa.com.br/** no Safari.
2. Toque em **Compartilhar**; conforme o layout do Safari, o botão pode estar no menu da página.
3. Escolha **Adicionar à Tela de Início**.
4. Ative **Abrir como App**, quando essa opção aparecer, e toque em **Adicionar**.
5. Abra o Fifa GO pelo ícone da tela inicial.

Se a ação não aparecer, abra **Editar Ações** na lista de compartilhamento e adicione **Adicionar à Tela de Início**. [Adicionar um site à Tela de Início — Suporte Apple](https://support.apple.com/guide/iphone/bookmark-a-website-iph42ab2f3a7/ios).

## Uso gratuito e login

A versão do beta deve manter `FIFABET_PAYMENT_MODE=unconfigured`: novas partidas são amistosas com `stake:0`, sem compra de créditos, reserva financeira, saque ou prêmio em dinheiro. Conferir no ambiente publicado `paymentMode:'unconfigured'`, `paymentsAvailable:false` e `realMoney:false`. O código inclui outros modos de pagamento; essa presença não significa que estejam habilitados neste beta.

O cadastro e login por **apelido ou ID e senha** são o caminho disponível para o público. O cliente Google OAuth Web está documentado em **modo de teste**. Pessoas fora da lista de usuários de teste autorizados podem não conseguir entrar com Google; não apresentar o botão como acesso garantido a qualquer pessoa. Enquanto o provedor permanecer em teste, orientar o cadastro e a entrada por apelido/senha.

As contas Google e de senha são identificadas separadamente no servidor. Não prometer que entrar por outro método recupera ou une automaticamente uma conta anterior. A PWA usa o mesmo serviço web e exige internet para contas, convites, partidas, saldo, histórico e envio/consulta de fotos.

## Cache e privacidade

O service worker deve armazenar **somente a página offline genérica e os ícones públicos declarados**. A página offline informa a perda de conexão e permite tentar novamente; não apresenta dados da última conta.

Não colocar em Cache Storage:

- Respostas de `/api/**`, sessão, cadastro, login, logout ou callbacks OAuth.
- Saldos, carteiras, extratos, nomes, partidas, convites e históricos autenticados.
- Fotos do placar, contestações ou comprovantes privados.
- Respostas a métodos diferentes de GET e URLs com parâmetros de convite/autenticação.
- A página principal renderizada como fotografia da sessão ou um fallback HTML usado como resposta de API.

A API e as fotos privadas já recebem `Cache-Control: no-store` no servidor observado. Esse cabeçalho não substitui uma lista explícita no service worker: uma gravação manual pela Cache API pode armazenar conteúdo mesmo assim. Não implementar um cache genérico de toda resposta 200.

A ativação deve remover apenas os caches próprios de versões anteriores do Fifa GO. As páginas navegadas normalmente devem vir da rede; numa falha, só uma navegação HTML pode receber o offline genérico. A API deve manter seu erro de rede e o aplicativo deve oferecer nova tentativa sem simular contas/saldos locais em produção.

Instalar/remover o ícone não exclui a conta do servidor. A política atual está em `legal.html#privacidade`, versão `2026-10-01`, com orientação de contato para consulta, correção ou exclusão de dados e prazos de retenção ainda em definição. O helper de exclusão automática preparado para uma futura distribuição nas lojas foi interrompido antes de ser criado. Concluir retenção, tratamento de pedidos e política de backups em trabalho específico; não prometer apagamento automático de cópias que ainda não foi implementado.

## Checklist da publicação PWA

- [ ] Implantar manifest, ícones, `pwa.mjs`, `sw.js` e página offline no host HTTPS.
- [ ] Vincular o manifest, ícone Apple e registro do service worker em `index.html`; disponibilizar os arquivos no servidor com tipos MIME corretos.
- [ ] Conferir nome Fifa GO, `start_url` sem tokens/convites, escopo, cores e abertura como aplicativo.
- [ ] Conferir o cache limitado a offline genérico e ícones, sem API ou imagens privadas.
- [ ] Confirmar a configuração amistosa e a API conectada em https://betfifa.com.br/.
- [ ] Validar instalação e abertura em Android Chrome e iPhone Safari reais.
- [ ] Validar cadastro por senha, entrada/saída, convite, foto, contestação, revisão e histórico com dados de teste autorizados, separados dos dados reais.
- [ ] Conferir perda/retorno de rede: mensagem offline genérica e nenhum saldo, histórico ou foto armazenado pelo service worker.
- [ ] Conferir atualização da PWA instalada após uma nova implantação.
- [ ] Publicar instruções de instalação e contato de feedback; descrever a limitação do Google em modo de teste.

Este documento não afirma que essas verificações foram executadas. Seu levantamento original foi somente de leitura; não executou testes, instalação em aparelho, compilação nativa nem acesso aos dados privados do VPS.

## Lojas: trabalho futuro, sem pacote nativo pronto

A publicação nas lojas foi adiada. Não há AAB Android ou build iOS de distribuição confirmados, assinatura pronta ou submissão realizada. Os materiais nativos iniciados nesta sessão não devem ser apresentados como aplicativo pronto para loja. O plano futuro depende de orçamento, contas ativas e retomada explícita dessa frente.

| Pendência futura | O que confirmar |
| --- | --- |
| Contas | Titular, tipo de conta, inscrição/verificação Google Play e Apple Developer Program, contratos e papéis de acesso. Login em um portal não conclui a inscrição. |
| Identificadores | `applicationId` Android e bundle ID iOS definitivos antes do primeiro envio. |
| Build Android | SDK, ferramentas de build, JDK e Gradle compatíveis; produzir AAB de release. Em 01/10/2026, novas submissões móveis precisam mirar API 36+. |
| Build iOS | Mac ou executor macOS, Xcode 26+/SDK iOS 26+ e alvo compatível; gerar arquivo de distribuição. Não foi identificado Mac nesta sessão. |
| Assinatura | Chave de upload Android/Play App Signing; certificado e provisioning iOS ou serviço autorizado de assinatura. |
| Privacidade | Retenção, exclusão dentro do app e recurso web de solicitação; Data safety/App Privacy coerentes com os dados efetivos. |
| Conteúdo/login | Completar moderação, bloqueio de abusos e solução iOS para login de terceiros; atender às regras aplicáveis à build final. |
| Materiais | Ícones e screenshots nativos, descrições, classificação etária, suporte, acesso de revisão e permissões das imagens/marcas. |

Fontes para a retomada: [API alvo Android](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [requisitos de build Apple](https://developer.apple.com/news/upcoming-requirements/), [exclusão de contas Play](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [diretrizes Apple](https://developer.apple.com/app-store/review/guidelines/).

Quando essa frente for retomada, o Play permite teste interno com até 100 pessoas. Contas pessoais criadas após 13/11/2023 precisam cumprir o teste fechado exigido para solicitar acesso à produção: pelo menos 12 pessoas inscritas continuamente durante 14 dias. No iOS, TestFlight externo exige revisão da primeira build. Esses caminhos não fazem parte do beta PWA atual. [Trilhas Play](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en), [novas contas pessoais](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [TestFlight](https://developer.apple.com/testflight/).

### Ferramentas observadas antes da mudança de plano

A máquina Windows tem Node.js `v24.19.0` e Java **JRE 8u481**. `javac`, `adb`, `sdkmanager`, `gradle` e `xcodebuild` não foram encontrados no PATH; os caminhos padrão de Android Studio e SDK estavam ausentes. `JAVA_HOME`, `ANDROID_HOME` e `ANDROID_SDK_ROOT` não estavam configuradas. Isso não descarta ferramentas em outro local. Nenhuma instalação foi realizada por este levantamento.

### Chaves e dados privados

Nunca publicar no Git, JavaScript público ou chat: chaves de assinatura, `.jks`, `.keystore`, `.p12`, `.p8`, senhas, tokens, client secrets, arquivos de propriedades com credenciais, banco, fotos privadas e backups. O `.gitignore` observado já cobre `.env`, `.p8`, `.pem` e `.key`; conferir os demais formatos antes de criar materiais de assinatura. Guardar segredos e seus backups em local privado fora da árvore publicada.

## Artes e materiais reaproveitáveis

| Arquivo | Origem registrada | Reaproveitamento possível |
| --- | --- | --- |
| `assets/brand/football-duel.webp` | 640 × 640, transparente; bola e controles genéricos, manifesto `football-duel.json` | Referência de direção visual e composição de ícones. |
| `assets/brand/lobby-footballer-v1.png` | 1942 × 809; jogador abstrato genérico, manifesto `lobby-footballer-v1.json` | Fundo decorativo do beta ou material promocional. |
| `assets/brand/admin-footballer-v1.png` | 1024 × 1536, transparente; figura anônima, manifesto `admin-footballer-v1.json` | Elemento decorativo original. A aprovação descrita no manifesto é editorial interna. |

As habilidades disponíveis `imagegen`, `impeccable` e `mobile-native` podem apoiar arte original e adaptação ao celular. Nenhuma foi acionada para gerar/editar imagens neste levantamento documental.

Consultar `THIRD_PARTY_NOTICES.md` e os documentos de avatares, clubes, uniformes e assinaturas antes de reaproveitar materiais de terceiros. Logo EA SPORTS FC, escudos, fotografias, caricaturas de atletas e assinaturas têm direitos separados; sua presença no repositório não concede autorização comercial. A licença do código ou a geração por IA não concede direitos de marcas ou imagem pessoal. A referência ao jogo identifica compatibilidade; o Fifa GO é independente de EA, FIFA e clubes. [Licença e publicação](LICENCA_E_PUBLICACAO.md).

O beta gratuito e este documento não determinam um enquadramento regulatório do serviço nem confirmam aprovação das lojas.
