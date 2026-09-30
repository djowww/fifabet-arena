# Aposta entre amigos na FifaBet

O fluxo principal permite encontrar uma pessoa, combinar um desafio, jogar, registrar o resultado e acompanhar o histórico dentro da FifaBet. Os pontos da arena são fictícios e não podem ser convertidos em dinheiro. A publicação estática do GitHub funciona no modo local; o servidor incluído no projeto permite contas e partidas compartilhadas quando executado ou hospedado separadamente.

## Identidade e busca

Cada perfil possui um identificador público estável da FifaBet, separado do apelido e de qualquer EA ID. Alterar o apelido não muda esse ID nem os confrontos. Ele aparece no perfil e pode ser copiado: `FBA-` seguido de oito dígitos hexadecimais no modo local ou dez no servidor. A criação verifica colisões entre os perfis do ambiente correspondente. O UUID interno permanece separado desse código público.

No modo local, o formulário permite selecionar outro perfil cadastrado no mesmo navegador, mostrando apelido e ID. Com servidor, a busca por ID consulta uma conta cadastrada naquele servidor; também é possível criar um convite por link, sem escolher o destinatário antes. Um convite destinado a um ID específico só pode ser aceito por aquela conta. Jogadores fictícios da antiga demonstração não aparecem na lista principal de adversários.

## Ciclo do confronto

1. O desafiante escolhe o adversário, o modo e os pontos por pessoa. O convite informa as regras antes do aceite e reserva os pontos de quem o criou.
2. O rival aceita ou recusa o convite no seu próprio perfil. O remetente não aceita em nome dele.
3. O aceite reserva a mesma quantidade na conta do rival e deixa a partida pronta para jogar. Falta de saldo impede o aceite e mantém a reserva do criador; o rival não recebe uma cobrança parcial. Cancelar ou recusar um convite pendente devolve a reserva ao criador.
4. Depois da partida, um participante informa os gols dos dois lados e anexa a foto do placar. O envio fica associado ao autor e ao horário.
5. O rival confere o placar. A confirmação registra concordância e mantém os pontos bloqueados. Uma divergência abre disputa, preserva as versões e evidências anteriores e mantém a reserva.
6. Com servidor, uma conta autorizada da equipe confere as fotos e decide vitória ou empate. Um participante não pode revisar o próprio confronto. Somente essa decisão distribui os pontos, uma vez por partida. A confirmação do rival sozinha não libera saldo nem gera uma vitória no ranking.

Na vitória, o vencedor recebe as duas reservas. No empate aprovado, cada participante recupera a sua. Depois do aceite, o cancelamento depende da concordância dos dois, segundo as transições disponíveis no modo utilizado. No servidor, depois de um resultado enviado, cabe à equipe resolver a partida. O convite do servidor expira após sete dias se ninguém aceitar.

Não apresentar uma foto ou um placar informado como resultado verificado pela EA. O histórico pedido é o da FifaBet.

## Histórico e estatísticas

O histórico permite buscar pelo apelido ou ID do rival e pelo ID da partida, filtrar a situação e consultar modo, data, pontos por pessoa, placar, estado e foto. São registros criados na FifaBet, sem importação de jogos da EA. Resultados pendentes ou disputados não contam como vitórias. Convites cancelados, recusados ou expirados não se transformam em partidas concluídas.

A tela de resultados calcula números a partir dos confrontos concluídos disponíveis naquele ambiente. No servidor ela mostra vitórias, empates e derrotas da conta; no navegador, o ranking lista os perfis locais. Uma partida possui um registro compartilhado pelos dois lados. Compras de avatares e créditos de demonstração não aumentam vitórias.

## Onde os dados vivem

No modo local, os perfis, confrontos e fotos pertencem ao navegador. Trocar de perfil permite percorrer os dois lados do fluxo com pessoas cadastradas ali. Esse modo não autentica pessoas, não envia convites para outro dispositivo e não possui equipe conectada. Enviar ou confirmar um placar deixa os pontos reservados. A interface pública não oferece um botão para o participante aprovar a revisão. A função de simulação de revisão do modelo é destinada à verificação de desenvolvimento, sem representar uma autorização real.

No modo com servidor, os participantes entram por apelido ou ID e senha. O backend compartilha os confrontos, valida quem aceita e confirma, mantém fotos acessíveis aos participantes e revisores e controla saldo e reservas. A função de equipe é configurada no servidor; o perfil não pode conceder esse acesso a si mesmo. Consulte [SERVIDOR.md](SERVIDOR.md) para execução, dados privados, revisão e limitações de hospedagem.

O GitHub Pages apresenta a interface, mas não executa esse backend. A interface detecta a API e identifica o modo em uso. Hospedar o servidor exige um serviço Node.js com HTTPS e armazenamento persistente; essa publicação não acontece ao enviar arquivos ao GitHub.

## Critérios de uma demonstração funcional

- Criar dois perfis, copiar o ID de um e encontrá-lo pelo outro.
- Enviar o desafio por um lado e aceitá-lo pelo rival, com o valor e o modo conferidos.
- Impedir saldo negativo e preservar o saldo quando o convite não puder ser aceito.
- Registrar placar e foto; confirmar, contestar e consultar a evidência pelo fluxo disponível.
- Confirmar o placar pelo rival e conferir que os pontos continuam bloqueados.
- No servidor, revisar por uma terceira conta autorizada e conferir histórico e saldo dos dois participantes.
- Reabrir a arena e recuperar os mesmos IDs, saldos e confrontos sem duplicar créditos.

Esses critérios orientam a revisão da implementação. Este documento não declara que os fluxos foram executados ou que existe uma operação de apostas com dinheiro real.
