# Páginas da conta — Fifa GO

## Direção visual

Redesign aplicado à carteira, histórico, ranking e perfil, preservando o app existente. Carbono, verde de ação e ilustrações geométricas originais de futebol; sem fontes, imagens ou bibliotecas externas novas. Títulos e espaçamento compartilhados, controles de pelo menos 44 px, foco visível e valores numéricos alinhados.

As ilustrações de carteira, ficha de partida, troféu e camisa são decorativas e ficam fora da árvore de acessibilidade. No celular, histórico e ranking apresentam registros empilhados, mantendo os cabeçalhos semânticos das tabelas.

## Contratos preservados

- Sem login: convite para entrar ou criar conta, sem consultas privadas de carteira ou ranking.
- Carteira: saldo, reservas e recargas vêm da API. Compra Pix requer modo correto, disponibilidade explícita e catálogo não vazio. Sem configuração, explica saldo zero e oferece amistosa sem créditos.
- Histórico: procura apelido, ID público do rival, código público da partida e modo. Filtros distinguem histórico vazio de busca sem resultados. O placar respeita a posição do usuário na partida.
- Ranking: somente entradas aprovadas retornadas pela API; sem adversários ou resultados inventados. Dados privados da conta não são renderizados.
- Perfil: avatar existente, time, país e ID público; edição, cópia e histórico preservados. Controles de sessão separados das ações de jogo.
- Respostas atrasadas não substituem outra rota nem revelam o saldo após logout ou troca de conta.

## Revisão e verificação

Skills utilizadas: redesign-existing-projects e impeccable. Detector estático dos três arquivos de interface: nenhum achado. Revisão manual: contraste, foco, hierarquia, estados vazios, loading, erro, privacidade e integração com os fluxos existentes.

- 18 testes novos em account-pages.test.mjs passaram.
- 63 testes de páginas, autenticação, administração e backend passaram.
- Suíte completa: 78/146 aprovados. As 68 falhas já existentes envolvem contratos antigos de demonstração e harnesses desatualizados; não são apresentadas como testes aprovados.
- Navegador: desktop, 390 px e 320 px; sem transbordamento horizontal da página, controles principais com altura mínima de 44 px. Dados preenchidos foram verificados em fixture local, sem criar contas ou movimentar créditos no servidor de produção.

## Publicação

Os assets novos estão na lista pública explícita dos servidores. Fontes de teste e arquivos privados permanecem fora dela. index.html referencia a nova folha de estilos e incrementa a versão do módulo principal para evitar código antigo em cache. A publicação usa release versionado, backup privado e reinício somente do serviço do Fifa GO.
