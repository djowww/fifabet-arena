# Plano de dados e integração com EA SPORTS FC

> Pesquisa histórica de 29/09/2026. As descrições do aplicativo e as condições dos serviços externos abaixo são daquele período. Para o produto atual, consulte o [índice da documentação](../README.md).

Pesquisa revisada em 29/09/2026. O projeto atual é uma demonstração estática: perfis, desafios, EA ID informado e ranking são guardados localmente no navegador, então cada dispositivo tem seus próprios dados.

## O que foi implementado nesta versão

O perfil pode guardar o **EA ID público** e a plataforma preferida. Isso ajuda a identificar o jogador para um convite manual no jogo. O registro tem sempre o estado `unverified`: não autentica a Conta EA, não prova titularidade e não consulta partidas. A interface deve dizer **“EA ID informado · não verificado”**, inclusive depois de recarregar a página. Remover o vínculo apaga apenas essa referência local; não altera uma conta na EA.

Contrato do modelo:

```js
change(state, 'saveGameAccount', { eaId: 'MeuEA_ID', platform: 'playstation' });
change(state, 'unlinkGameAccount');
// current(state).gameAccount é null ou:
// { eaId, platform, status: 'unverified', savedAt: 'ISO-8601' }
```

`GAME_PLATFORMS` exporta `playstation`, `xbox`, `pc` e `switch`, com seus rótulos para a interface. O estado versão 5 migra as versões 2, 3 e 4. A restauração valida os campos, descarta propriedades extras e converte qualquer alegação local de verificação para `unverified`. Nenhuma senha, token ou sessão EA é coletada. O campo aceita um identificador público com 4 a 16 caracteres; essa verificação de formato não consulta a EA. A [ajuda oficial sobre EA ID](https://help.ea.com/en/articles/ea-account/how-to-create-ea-id/) confirma o tamanho e explica como encontrá-lo na conta.

Uma lista de confrontos registrada neste aplicativo deve usar o rótulo **“Partidas da arena”** ou **“Resultados informados”**. Não pode ser apresentada como histórico importado do EA SPORTS FC. Não existe serviço de sincronização implementado nesta versão.

## O que a EA oferece hoje

### Dados de conta e Ultimate Team

Em 27/07/2026, a EA anunciou a **FC Community API**. Ela permite que sites parceiros aprovados, mediante autorização do jogador no login da EA, consultem alguns dados da conta. A EA cita conteúdo de Ultimate Team, como atletas, formações e táticas; o site parceiro não recebe a senha. A retenção anunciada para dados consultados é de até 28 dias.

No momento da pesquisa, a EA lista apenas **FUTBIN, FUT.GG e FUTWIZ** como parceiros autorizados e diz que não está recebendo solicitações de outros sites. Portanto, a FifaBet não pode implementar essa conexão por conta própria agora; seria necessário que a EA abrisse o programa e aprovasse o projeto. Não devemos pedir nem armazenar credenciais da EA.

Fontes oficiais: [anúncio da API da Comunidade FC](https://www.ea.com/pt-br/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-community-api-update) e [artigo de ajuda sobre os parceiros aprovados](https://help.ea.com/pt-br/articles/ea-sports-fc/community-api/).

### Catálogo de jogadores e ratings

A [página oficial de classificações dos atletas](https://www.ea.com/games/ea-sports-fc/ratings) pode ser oferecida como referência externa. O link é distinto de uma API de catálogo. A documentação pública consultada não fornece à FifaBet um endpoint autorizado ou uma licença de exportação do catálogo. Uma eventual importação deve especificar a origem, a edição do jogo, a data da atualização e os direitos de uso de cada fotografia e estatística.

### Partidas, ranking e fila do próprio EA FC

A documentação publicada para a API da Comunidade descreve dados de conta, com foco em Ultimate Team. Ela não documenta uma API pública para procurar adversários, entrar na fila de matchmaking do jogo, criar salas de amistoso ou ler o resultado de uma partida entre amigos. Essa ausência é uma conclusão sobre a documentação pública encontrada, não uma afirmação de que a EA nunca ofereça integração privada a parceiros.

O contrato da EA também restringe extrair dados dos serviços ou contornar limitações técnicas sem autorização. Por isso, não recomendo automatizar login no Web/Companion App, usar endpoints privados descobertos por engenharia reversa, nem ler/interceptar tráfego do jogo. [Contrato do Usuário da EA](https://www.ea.com/legal/user-agreement).

## O que a FifaBet pode operar sem depender da EA

O ranking da FifaBet deve ser nosso, calculado pelo servidor a partir de resultados revisados segundo as regras da arena. A foto do placar e o acordo dos participantes são evidências sujeitas a análise; não são prova automática fornecida pela EA. Uma fila própria pode encontrar jogadores que também estão disponíveis na FifaBet e, depois do pareamento, orientar a dupla a abrir um amistoso no jogo manualmente. Ela não colocará ninguém na fila ranqueada da EA nem iniciará o jogo.

Para essa etapa, recomendo **Supabase com PostgreSQL**: o modelo tem relações claras entre perfis, amizades, desafios, resultados e temporadas; Auth resolve contas da FifaBet e Realtime pode atualizar presença/notificações. O Realtime do Supabase oferece Presence e atualizações de dados; políticas Postgres RLS permitem limitar quais linhas cada usuário pode ler ou alterar. A chave de serviço deve ficar somente no servidor.

Fontes técnicas oficiais: [visão geral do banco Supabase](https://supabase.com/docs/guides/database/overview), [Realtime](https://supabase.com/docs/guides/realtime) e [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Modelo inicial de dados

- `profiles`: conta FifaBet, apelido, avatar, plataforma e gamertag opcional.
- `game_accounts`: EA ID declarado, plataforma, estado de verificação e, somente após uma futura autenticação autorizada, identificador estável retornado pelo provedor.
- `friendships`: convites e amizades entre perfis.
- `duels`: desafiante, adversário, modo, estado, temporada e pontos fictícios.
- `result_reports`: placar enviado por cada lado, confirmação e disputa/auditoria.
- `result_evidence` e `review_decisions`: fotos em armazenamento privado, participantes autorizados, decisão da moderação, motivo, revisor e trilha de auditoria.
- `queue_entries`: usuário, modo, plataforma, faixa de habilidade e horário de entrada.
- `rating_events` e `achievements`: histórico das mudanças de rating e medalhas; o ranking pode ser agregado desses eventos.

Não guardar resultados diretamente enviados pelo navegador como se fossem confiáveis: um endpoint/RPC deve validar participantes, transições de estado e confirmações. Ative RLS nas tabelas expostas e escreva políticas para cada operação antes de abrir acesso ao cliente.

### Verificação de um resultado no servidor

1. Autenticar o participante e aceitar o placar apenas para um desafio ativo do qual ele faça parte.
2. Salvar o arquivo em armazenamento privado e criar um relatório imutável, com data e autoria. Uma denúncia deve preservar os envios anteriores.
3. Bloquear o encerramento e a alteração do ranking enquanto houver revisão ou disputa. A ação de moderar deve depender de uma função de servidor, com permissão própria.
4. Registrar a decisão e atualizar o ranking/pontos numa única transação, com chave única por desafio para impedir crédito duplicado.
5. Se a EA vier a autorizar dados de partidas, anexar a resposta validada do provedor a essa auditoria. Conferir IDs dos participantes, edição do jogo, modo, horário e um ID único de partida antes de comparar o placar. Dados incompletos devem manter a revisão humana.

Esse fluxo é um projeto de implementação para o backend. O protótipo não possui autenticação compartilhada, armazenamento privado, equipe conectada ou autoridade para liberar pontos reais.

### Fronteira para uma futura conexão oficial

A primeira dependência é obter aprovação da EA e a documentação técnica dos recursos permitidos. Só depois definir URLs, escopos e protocolo do login. Não presumir que a autorização para ver elenco também autorize ler histórico de amistosos.

O cliente deve pedir ao backend para iniciar a conexão. O backend conclui o fluxo oficial, associa o identificador retornado ao usuário autenticado, guarda credenciais de acesso fora do navegador e verifica a revogação. Um adaptador separado deve retornar capacidades explícitas como `canReadSquad` e `canReadMatchHistory`, cada uma habilitada apenas com permissão confirmada. O aplicativo deve mostrar o horário da última sincronização e os erros de acesso. A remoção da conexão deve revogar o acesso conforme o mecanismo da EA e aplicar a política de retenção contratada.

## Caminho recomendado

1. **Agora:** ligar a FifaBet a um backend próprio, migrar as contas locais para Supabase Auth/PostgreSQL, e sincronizar amizades, convites, resultados confirmados, medalhas e ranking.
2. **Depois:** criar uma fila social da FifaBet com filtros por plataforma/modo e faixa de rating. O aceite gera um desafio e instruções para os dois jogadores iniciarem o amistoso no FC.
3. **Catálogo:** começar com times escolhidos/informados pelos usuários. Se uma lista ampla de atletas e ratings for essencial, procurar licença ou autorização de dados antes de importar em massa.
4. **Integração EA:** acompanhar a abertura do programa FC Community API e solicitar aprovação. Se autorizada, implementar o fluxo oficial de consentimento para os campos que a EA realmente liberar; isso complementa a FifaBet, mas não substitui seu próprio ranking/queue.

## Decisão

Podemos construir já um produto compartilhado de desafios, fila amistosa e ranking da FifaBet usando um banco nosso. A integração oficial com dados de Ultimate Team é uma possibilidade futura sujeita à aprovação da EA; uma fila real do matchmaking da EA não está disponível na documentação pública consultada.
