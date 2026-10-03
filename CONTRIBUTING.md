# Como contribuir

O Fifa GO tem [licença proprietária](LICENSE). O repositório público permite acompanhar o desenvolvimento e propor melhorias; sua visibilidade não concede autorização para redistribuir o produto ou publicar um serviço derivado.

## Relatar um problema

Use o modelo de bug em [Issues](https://github.com/djowww/fifabet-arena/issues/new/choose). Informe:

- A página e o dispositivo/navegador utilizados.
- O comportamento esperado e o que ocorreu.
- Os passos mínimos para reproduzir com contas de teste.
- Uma captura sem dados pessoais, saldo, códigos de convite privados ou comprovantes.

Possíveis vulnerabilidades devem seguir [SECURITY.md](SECURITY.md), sem detalhes em uma issue pública. Suporte a uma conta ou disputa real também não deve expor dados na issue.

## Propor uma melhoria

Descreva o problema do usuário, a solução proposta e os critérios de conclusão. Mudanças em carteira, reservas, premiação, autenticação e evidências precisam explicar o efeito sobre registros existentes e privacidade.

## Preparar o ambiente

Requisitos: Git e Node.js 24 ou superior.

```sh
git clone https://github.com/djowww/fifabet-arena.git
cd fifabet-arena
npm ci --ignore-scripts
npm run server
```

A aplicação conectada local abre em `http://127.0.0.1:4174`. Para a demonstração estática, use `npm run dev` e `http://127.0.0.1:4173`. Consulte [o guia do servidor](docs/SERVIDOR.md) antes de configurar provedores ou mudar o diretório de dados.

## Enviar um pull request

1. Crie uma branch com uma descrição curta, por exemplo `fix/convite-expirado`.
2. Mantenha a mudança focada e preserve fluxos e dados existentes.
3. Atualize a documentação quando houver alteração de comportamento ou configuração.
4. Verifique a mudança com dados temporários; nunca use contas, fotos ou saldos de produção para testes.
5. Execute `npm test` quando alterar código e descreva no PR o que foi verificado e qualquer limitação.
6. Preencha o modelo de pull request, incluindo impacto nos dados e na carteira quando aplicável.

O CI existente usa Node.js 24, dependências fixadas, auditoria das dependências de produção e a suíte de testes. Mudanças exclusivamente documentais devem conferir os links e a correspondência das instruções com o código.

Não versione segredos, arquivos de ambiente, bancos, chaves, comprovantes ou evidências de jogadores. Mantenha as atribuições de terceiros e a licença existente.

Um push ou merge atualiza o GitHub; a aplicação conectada exige publicação separada. A aceitação de um PR cabe ao mantenedor [@djowww](https://github.com/djowww).
