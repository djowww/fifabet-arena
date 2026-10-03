# Fifa GO

**Partidas entre amigos. Regras combinadas. Resultados acompanhados.**

O Fifa GO organiza desafios no EA SPORTS FC: encontre um rival na arena, converse na sala, confirme o início e acompanhe o resultado pela mesma conta, no celular ou computador.

[**Acessar o aplicativo**](https://betfifa.com.br/) · [Documentação](docs/README.md) · [Relatar um problema](https://github.com/djowww/fifabet-arena/issues/new/choose)

[![Testes](https://github.com/djowww/fifabet-arena/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/djowww/fifabet-arena/actions/workflows/tests.yml)

## O que o aplicativo oferece

| Área | Funcionalidades |
| --- | --- |
| Conta | Apelido, país, ID próprio, login por senha ou Google configurado, sessões e recuperação de acesso. |
| Arena | Salas públicas e privadas, convites por código/link e filtros de plataforma, modo e valor por jogador. |
| Partida | Chat privado, regras, reservas individuais e início confirmado pelos dois participantes. |
| Resultado | Placar e foto de cada jogador, confirmação do rival e análise de divergências. |
| Carteira | Joga aí Coin disponíveis e reservadas, extrato e movimentações vinculadas às partidas. |
| Histórico e ranking | Partidas da conta, resultados validados, classificação e evolução do rating. |
| Administração | Revisão de resultados, conferência da carteira e ferramentas com autorização no servidor. |

## Como funciona uma partida

1. Crie uma conta e receba seu ID Fifa GO.
2. Abra uma sala ou entre em uma sala disponível por código, link ou pela arena.
3. Confira plataforma, modo, regras e Joga aí Coin por jogador. Uma amistosa com valor zero não reserva saldo; salas com Coin exigem saldo disponível dos dois participantes.
4. Converse com o rival e confirme o início. A partida começa quando ambos estiverem prontos.
5. Envie o placar e sua foto. O rival confirma com uma foto própria ou sinaliza divergência. A ausência de confirmação não concede vitória automaticamente.
6. Acompanhe a decisão, o histórico e a carteira. Quando há premiação em Coin, a taxa acordada é de 9%; empate devolve as reservas sem taxa.

As regras completas de prazos, revisão por risco/valor e placares de prorrogação/pênaltis estão em [Salas e resultados](docs/SALAS.md). A leitura de imagem auxilia a conferência; não certifica a autenticidade de uma foto.

## Estado atual

- **Pagamentos em configuração:** compras e recargas estão desativadas na publicação atual. Novas contas começam com saldo zero; podem jogar amistosas gratuitas. Coin já existentes na carteira principal podem ser reservadas em salas.
- **Ambientes separados:** a demonstração local e seu saldo ilustrativo não são convertidos em contas ou saldo da versão conectada.
- **Login social:** Google depende da configuração do provedor e pode restringir o acesso a testadores autorizados. Apple permanece desativado nesta etapa.
- **Integrações externas:** IDs de EA/PSN/Xbox são declarados pelo jogador. Não há importação automática de partidas da EA, gateway de pagamentos ou saques.
- **Avisos opcionais:** funcionam enquanto o aplicativo estiver aberto, mediante permissão. Contas, salas, carteira e fotos precisam de conexão à internet.

O Fifa GO é um serviço independente, sem vínculo oficial com EA ou FIFA. EA SPORTS FC identifica o jogo compatível.

## Executar localmente

Requisitos: **Node.js 24 ou superior** e Git. O backend utiliza SQLite nativo do Node.js, Sharp e Tesseract.js.

```sh
git clone https://github.com/djowww/fifabet-arena.git
cd fifabet-arena
npm ci --ignore-scripts
npm run server
```

Abra **http://127.0.0.1:4174** para usar contas e partidas compartilhadas no ambiente local. Credenciais externas não acompanham o repositório. Os dados privados ficam fora da pasta do código; configuração, limites e cuidados estão em [Servidor](docs/SERVIDOR.md).

Para experimentar apenas a demonstração estática, execute `npm run dev` e abra **http://127.0.0.1:4173**. Não abra o HTML diretamente por `file://`.

### Verificações

```sh
npm test
```

A suíte cobre interface, contas, salas, reservas, resultados, evidências, carteira e controles administrativos. O [CI](.github/workflows/tests.yml) usa Node.js 24, dependências fixadas e auditoria das dependências de produção.

## Estrutura do projeto

| Caminho | Responsabilidade |
| --- | --- |
| `index.html`, `play.js` e módulos da raiz | Interface, navegação e fluxos das partidas. |
| `backend/` | API, autenticação, SQLite, carteira, evidências e revisão. |
| `assets/` | Ilustrações, ícones e materiais visuais com suas atribuições. |
| `deploy/` | Modelos de publicação do serviço e do host da aplicação. |
| `docs/` | Guias do produto, desenvolvimento, operação e registros históricos. |
| `.github/` | CI, modelos de issues/PRs e responsáveis pela revisão. |
| `colecao.html`, `app.js` e `model.mjs` | Coleção e demonstração local preservadas, separadas da versão conectada. |

## Usar no celular

O site pode ser instalado na tela inicial como **PWA**. A interface oferece instruções para Android/Chrome e iPhone/Safari. Dados privados não são guardados pelo cache offline do service worker. A versão atual não é uma publicação na Google Play ou App Store; consulte [Publicação mobile](docs/PUBLICACAO-MOBILE.md).

## Documentação, contribuição e segurança

- [Índice dos guias](docs/README.md) e [histórico de mudanças](CHANGELOG.md).
- [Como contribuir](CONTRIBUTING.md) e [modelos de issues](https://github.com/djowww/fifabet-arena/issues/new/choose).
- [Relatar uma vulnerabilidade em privado](SECURITY.md).
- [Privacidade e retenção de dados](docs/PRIVACIDADE-RETENCAO.md).

A publicação da aplicação conectada é **separada do GitHub**. Um push ou merge não instala uma nova versão no site oficial.

## Licença e créditos

O código original tem [licença proprietária](LICENSE), mantida por [@djowww](https://github.com/djowww). O repositório público não concede autorização para redistribuir ou explorar comercialmente o produto.

Materiais de terceiros têm direitos e condições próprios, descritos em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e nos [guias de identidade visual](docs/README.md#identidade-visual-e-direitos). Esta licença não concede direitos sobre marcas, fotografias, escudos, uniformes ou assinaturas de terceiros.
