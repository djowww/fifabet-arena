# Licença e publicação da FifaBet Arena

Atualizado em 29 de setembro de 2026.

## O que foi criado

O arquivo [LICENSE](../LICENSE) estabelece uma licença proprietária, adequada à intenção de manter o controle comercial do projeto. Identifica Ricardo Zordan (Djow), permite o uso pessoal da versão oficial e a avaliação local, e reserva a redistribuição e a exploração comercial por terceiros. Não é uma licença de código aberto.

Este é um texto inicial para revisão jurídica antes da distribuição comercial. Ele não registra uma marca, não concede autorização da EA ou da FIFA e não equivale à aprovação na App Store ou no Google Play.

## Código, fotografia e marca têm permissões diferentes

A licença abrange somente os materiais originais pertencentes ao titular. As licenças de dependências, fotos, fontes e demais conteúdos de terceiros devem permanecer identificadas e ser cumpridas separadamente. Uma foto com licença aberta pode exigir crédito, link da licença e indicação de alterações; essa permissão não transfere automaticamente direitos de imagem do atleta ou marcas visíveis.

Antes de vender figurinhas com atletas, escudos ou assinaturas oficiais, documentar os direitos necessários para esse uso. Não chamar uma assinatura ilustrativa de autógrafo oficial. Revisar também a disponibilidade e a apresentação comercial do nome “FifaBet Arena”, para evitar confusão sobre vínculo com FIFA ou EA. O Google exige respeito à propriedade intelectual e pode solicitar comprovação das permissões de materiais usados no app e em sua página na loja. [Política de propriedade intelectual do Google Play](https://support.google.com/googleplay/android-developer/answer/9888072?hl=pt-BR).

## Licença de usuário final na Apple

A Apple aplica sua EULA padrão quando o desenvolvedor não cadastra uma personalizada. Esse é um caminho disponível para a primeira distribuição iOS; o arquivo `LICENSE` do repositório não deve ser colado no campo de EULA como se já cobrisse todas as exigências da Apple. [Cadastro de EULA no App Store Connect](https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement).

Se for escolhida uma EULA própria, preparar uma versão específica com os termos mínimos da Apple: responsabilidades do desenvolvedor, escopo de uso, suporte, garantias, reclamações, direitos de terceiros e demais condições exigidas. O texto também precisa da identificação e do endereço do desenvolvedor e dos contatos reais para reclamações e suporte. Esses dados ainda não foram fornecidos e não foram inventados neste projeto. [Termos mínimos para uma EULA personalizada](https://www.apple.com/legal/internet-services/itunes/dev/minterms/).

## O que falta para o lançamento

1. **Produto e distribuição:** gerar as versões Android e iOS, configurar contas de desenvolvedor, assinatura, metadados e suporte. A versão atual é uma demonstração web. Na Apple, testes de versões beta devem passar pelo TestFlight; a submissão à loja precisa estar funcional, inclusive com backend acessível quando houver contas e serviços online. [Diretrizes de revisão, seções 2.1 e 2.2](https://developer.apple.com/app-store/review/guidelines/).
2. **Privacidade e exclusão:** publicar uma política que descreva o comportamento real do app: perfil, EA ID informado, imagens de placar, retenção, terceiros e contato. Preencher a seção Data safety de forma consistente. Quando houver criação de contas online, implementar exclusão dentro do app e por um recurso web externo, com tratamento dos dados associados e explicação de eventual retenção necessária. [Política de dados do Google Play](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).
3. **Moderação e resultados:** implementar autenticação, evidências em armazenamento privado, controle de acesso da equipe, denúncias e decisões auditáveis. O envio local de foto não entrega a evidência a moderadores. Conteúdo enviado por usuários exige recursos efetivos de denúncia, bloqueio e moderação para a distribuição pela Apple. [Diretrizes de revisão, seção 1.2](https://developer.apple.com/app-store/review/guidelines/).
4. **Catálogo e cobrança:** concluir as permissões dos ativos antes da venda. As compras atuais usam pontos fictícios. Uma futura cobrança por figurinhas digitais precisa ser implementada de acordo com as condições de pagamento da loja e dos países de lançamento; não é ativada por esta licença.
5. **Identidade comercial:** confirmar o titular que aparecerá nas lojas, endereço e contatos de suporte e privacidade. Se o lançamento ocorrer por uma empresa, formalizar a titularidade ou autorização necessária antes de substituir os dados do titular.

## Limites da versão atual

Os dados da demonstração ficam no navegador. A licença não muda esse funcionamento nem cria autenticação, uma equipe de revisão ou acesso à API da EA. Cadastrar um EA ID manualmente não comprova sua titularidade e não autoriza consultar partidas privadas. A documentação de integração do projeto trata desse acesso separadamente.

Antes de cada submissão, conferir novamente as regras oficiais vigentes e ajustar os documentos à versão distribuída, aos países escolhidos e aos dados efetivamente tratados.
