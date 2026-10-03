# Política de segurança

## Escopo de manutenção

As correções são aplicadas à branch `main`. A aplicação conectada é publicada separadamente; um commit no GitHub não comprova que o site já recebeu a correção. Não há suporte prometido para cópias antigas ou instalações de terceiros.

## Comunicar uma vulnerabilidade

Use **Security → Report a vulnerability** neste repositório para enviar um relato privado ao mantenedor:

[Enviar relato privado](https://github.com/djowww/fifabet-arena/security/advisories/new)

Se o recurso estiver indisponível, solicite um canal privado ao mantenedor [@djowww](https://github.com/djowww) sem publicar detalhes técnicos. Não exponha a vulnerabilidade, credenciais, dados de contas, convites secretos, fotos ou comprovantes em Issues ou pull requests públicos.

Inclua apenas o necessário para analisar:

- A versão ou commit e o recurso afetado.
- O comportamento observado e o impacto possível.
- Uma reprodução mínima com dados sintéticos ou contas próprias de teste.
- A sugestão de correção, se houver.

Não envie senhas, tokens ativos, chaves OAuth ou dados de outros jogadores. Não execute carga, indisponibilidade, movimentação de saldo ou exploração em contas de terceiros para demonstrar o problema. Este documento não autoriza testes em produção nem oferece recompensa financeira.

## Cuidados no desenvolvimento

- Credenciais e dados privados ficam fora do código publicado e do Git.
- Autorizações e movimentações da carteira precisam ser validadas no servidor.
- Fotos e comprovantes exigem acesso autenticado; não devem aparecer em logs ou links públicos.
- Alterações sensíveis devem preservar migrações, reservas e registros financeiros existentes.

Consulte [contribuição](CONTRIBUTING.md), [servidor](docs/SERVIDOR.md) e [privacidade e retenção](docs/PRIVACIDADE-RETENCAO.md). A [revisão de 30/09/2026](docs/SECURITY_REVIEW.md) é um registro histórico, não uma certificação do estado atual.
