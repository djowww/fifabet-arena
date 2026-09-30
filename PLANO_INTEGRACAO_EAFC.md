# Plano de dados e integração com EA SPORTS FC

Pesquisa feita em 29/09/2026. O projeto atual é uma demonstração estática: perfis, desafios e ranking são guardados localmente no navegador, então cada dispositivo tem seus próprios dados.

## O que a EA oferece hoje

### Dados de conta e Ultimate Team

Em 27/07/2026, a EA anunciou a **FC Community API**. Ela permite que sites parceiros aprovados, mediante autorização do jogador no login da EA, consultem alguns dados da conta. A EA cita conteúdo de Ultimate Team, como atletas, formações e táticas; o site parceiro não recebe a senha. A retenção anunciada para dados consultados é de até 28 dias.

No momento da pesquisa, a EA lista apenas **FUTBIN, FUT.GG e FUTWIZ** como parceiros autorizados e diz que não está recebendo solicitações de outros sites. Portanto, a FifaBet não pode implementar essa conexão por conta própria agora; seria necessário que a EA abrisse o programa e aprovasse o projeto. Não devemos pedir nem armazenar credenciais da EA.

Fontes oficiais: [anúncio da API da Comunidade FC](https://www.ea.com/pt-br/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-community-api-update) e [artigo de ajuda sobre os parceiros aprovados](https://help.ea.com/pt-br/articles/ea-sports-fc/community-api/).

### Catálogo de jogadores e ratings

A EA mantém a página oficial [FC 26 Player Ratings](https://www.ea.com/games/ea-sports-fc/ratings), com busca e ratings/PlayStyles para mais de 17 mil jogadores. Isso é um catálogo para consulta, mas a página e a documentação pública consultada não oferecem um endpoint ou licença de exportação para a FifaBet. Até confirmar autorização, podemos usar a página como referência ou deixar que cada usuário selecione/informe seus times; não devemos copiar o catálogo inteiro nem depender de scraping.

### Partidas, ranking e fila do próprio EA FC

A documentação publicada para a API da Comunidade descreve dados de conta, com foco em Ultimate Team. Ela não documenta uma API pública para procurar adversários, entrar na fila de matchmaking do jogo, criar salas de amistoso ou ler o resultado de uma partida entre amigos. Essa ausência é uma conclusão sobre a documentação pública encontrada, não uma afirmação de que a EA nunca ofereça integração privada a parceiros.

O contrato da EA também restringe extrair dados dos serviços ou contornar limitações técnicas sem autorização. Por isso, não recomendo automatizar login no Web/Companion App, usar endpoints privados descobertos por engenharia reversa, nem ler/interceptar tráfego do jogo. [Contrato do Usuário da EA](https://www.ea.com/legal/user-agreement).

## O que a FifaBet pode operar sem depender da EA

O ranking da FifaBet deve ser nosso, calculado a partir de resultados confirmados pelos dois participantes. Uma fila própria pode encontrar jogadores que também estão disponíveis na FifaBet e, depois do pareamento, orientar a dupla a abrir um amistoso no jogo manualmente. Ela não colocará ninguém na fila ranqueada da EA nem iniciará o jogo.

Para essa etapa, recomendo **Supabase com PostgreSQL**: o modelo tem relações claras entre perfis, amizades, desafios, resultados e temporadas; Auth resolve contas da FifaBet e Realtime pode atualizar presença/notificações. O Realtime do Supabase oferece Presence e atualizações de dados; políticas Postgres RLS permitem limitar quais linhas cada usuário pode ler ou alterar. A chave de serviço deve ficar somente no servidor.

Fontes técnicas oficiais: [visão geral do banco Supabase](https://supabase.com/docs/guides/database/overview), [Realtime](https://supabase.com/docs/guides/realtime) e [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Modelo inicial de dados

- `profiles`: conta FifaBet, apelido, avatar, plataforma e gamertag opcional.
- `friendships`: convites e amizades entre perfis.
- `duels`: desafiante, adversário, modo, estado, temporada e pontos fictícios.
- `result_reports`: placar enviado por cada lado, confirmação e disputa/auditoria.
- `queue_entries`: usuário, modo, plataforma, faixa de habilidade e horário de entrada.
- `rating_events` e `achievements`: histórico das mudanças de rating e medalhas; o ranking pode ser agregado desses eventos.

Não guardar resultados diretamente enviados pelo navegador como se fossem confiáveis: um endpoint/RPC deve validar participantes, transições de estado e confirmações. Ative RLS nas tabelas expostas e escreva políticas para cada operação antes de abrir acesso ao cliente.

## Caminho recomendado

1. **Agora:** ligar a FifaBet a um backend próprio, migrar as contas locais para Supabase Auth/PostgreSQL, e sincronizar amizades, convites, resultados confirmados, medalhas e ranking.
2. **Depois:** criar uma fila social da FifaBet com filtros por plataforma/modo e faixa de rating. O aceite gera um desafio e instruções para os dois jogadores iniciarem o amistoso no FC.
3. **Catálogo:** começar com times escolhidos/informados pelos usuários. Se uma lista ampla de atletas e ratings for essencial, procurar licença ou autorização de dados antes de importar em massa.
4. **Integração EA:** acompanhar a abertura do programa FC Community API e solicitar aprovação. Se autorizada, adicionar conexão OAuth/consentimento oficial para os campos que a EA realmente liberar; isso complementa a FifaBet, mas não substitui seu próprio ranking/queue.

## Decisão

Podemos construir já um produto compartilhado de desafios, fila amistosa e ranking da FifaBet usando um banco nosso. A integração oficial com dados de Ultimate Team é uma possibilidade futura sujeita à aprovação da EA; uma fila real do matchmaking da EA não está disponível na documentação pública consultada.
