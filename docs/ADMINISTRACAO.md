# Administração do Fifa GO

O painel `#admin` recebe as contas administrativas após o login e fica disponível no menu **Admin**. A interface mostra jogadores, saldos disponíveis e reservados, revisão de resultados, serviços configurados e histórico das adições de créditos. Os dados vêm da API conectada; a demonstração estática não concede privilégios.

## Autorização

Configure `FIFABET_ADMIN_EMAILS` somente no arquivo privado de ambiente do servidor, com os e-mails autorizados separados por vírgula. Não publique os endereços no repositório. A configuração vazia desativa o acesso administrativo.

A permissão exige uma identidade Google ou Apple com e-mail verificado pelo provedor e vinculada à conta no banco. O apelido, ID público, dados enviados pelo navegador e campos `isAdmin` no perfil não concedem acesso. O servidor verifica a permissão em todas as rotas administrativas; retirar um e-mail da configuração e reiniciar o serviço revoga o acesso inclusive para sessões existentes.

Se a conta não tem identidade social verificada, entre pelo Google autorizado. A aplicação não une automaticamente contas por apelido ou por e-mail. Não há ferramenta pública para promover usuários.

## Créditos e histórico

Selecione o jogador, informe uma quantidade inteira de **1 a 100.000 créditos** e um motivo de **10 a 1.000 caracteres**. O painel exibe uma confirmação antes de enviar a operação. O servidor calcula o saldo final no momento da confirmação.

Cada adição grava, na mesma transação SQLite, o saldo, um lançamento `admin_adjustment` no extrato e a operação administrativa com ator, destinatário, motivo, quantidade e saldos antes/depois. O histórico não pode ser editado pelo painel. Retentativas com a mesma chave retornam a operação existente e não duplicam os créditos; uma chave reutilizada com conteúdo diferente é recusada.

Antes de confirmar, o navegador guarda somente a operação pendente no armazenamento da sessão, vinculada ao administrador. Se a resposta for interrompida, inclusive após recarregar a página, o painel recupera a mesma chave para consultar e confirmar sem duplicar a adição. O registro local é removido após sucesso; não guarda e-mails nem credenciais. Se o navegador bloquear esse armazenamento, o painel não envia a operação.

Uma adição administrativa não confirma Pix, não cria depósito e não ativa pagamentos. Partidas com créditos continuam dependendo das regras do modo de pagamento configurado. Em `unconfigured`, é possível criar amistosas gratuitas ou salas com Joga aí Coin principal já disponível; compras permanecem indisponíveis.

Os administradores também acessam a revisão existente, respeitando a proibição de aprovar o próprio resultado ou o próprio comprovante. A conferência de pagamentos continua sujeita à configuração e às regras existentes da carteira.

## Proteções e limites

As rotas exigem sessão autenticada; gravações também exigem origem válida, token CSRF e limites de requisições. Busca retorna até 50 contas; histórico retorna as últimas 100 adições. Senhas, tokens de sessão e evidências não fazem parte da listagem de usuários. O e-mail verificado fica em uma seção recolhida do jogador selecionado.

O painel não remove créditos, não oferece saques e não substitui conciliação financeira. Solicitações de remoção da conta têm revisão administrativa independente: podem ser rejeitadas com motivo ou resultar em desativação e anonimização do perfil quando saldos e operações pendentes estiverem resolvidos. A operação preserva registros financeiros, histórico e evidências privadas; não elimina a linha da conta nem reescreve backups. Consulte [privacidade e retenção](PRIVACIDADE-RETENCAO.md). O registro de operações cresce com o uso; eliminação definitiva e retenção de backups ainda precisam de planejamento operacional antes de ativar pagamentos.

## Revisão visual

A nova superfície usa o modo **Operate** da skill Impeccable e herda o visual existente: fundo escuro, neutros esverdeados, verde para ações, formulários conhecidos e dados numéricos alinhados. A diretoria de jogadores é uma lista de linhas; o editor de créditos fica ao lado no computador e abaixo no celular. A confirmação é apresentada no próprio editor. Nenhum dado de produção é inventado para preencher estados vazios.
