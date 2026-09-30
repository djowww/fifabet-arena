# Revisão de segurança — Fifa GO

Revisão defensiva do código e da publicação, em 30/09/2026. Isto reduz riscos conhecidos, mas não garante que um sistema seja impossível de atacar nem substitui um teste de invasão independente.

## Proteções verificadas

- O backend usa Node.js e SQLite sem dependências npm de runtime. Consultas usam parâmetros SQL; arquivos do banco e evidências ficam fora da pasta publicada e com permissões privadas.
- Senhas são derivadas com `scrypt`. Sessões usam tokens aleatórios armazenados como hash, cookie `HttpOnly`/`SameSite=Lax` e `Secure` quando a origem é HTTPS. Operações autenticadas exigem origem exata e token CSRF.
- OAuth Google usa state, nonce, PKCE e validação das claims do token. O segredo OAuth fica no arquivo privado do serviço, fora do Git.
- O revisor é definido por configuração privada do servidor. Participantes não revisam seus próprios resultados ou comprovantes; fotos de placar e comprovantes têm autorização por partida/conta.
- Uploads aceitam apenas PNG, JPEG e WebP, limitam tamanho e dimensões e não aceitam SVG. O diretório total de evidências também tem limite configurável.
- O servidor HTTP usa timeouts e limite de corpo. O rate limiter agora tem teto de 10 mil chaves para evitar crescimento ilimitado de memória.
- A página envia CSP: scripts só da própria origem, sem scripts inline; objetos e enquadramento são bloqueados. HSTS é enviado quando o backend está configurado para HTTPS. A CSP também está no HTML para a publicação estática.
- A página usa `Referrer-Policy: no-referrer` e remove o token de convite da barra de endereço após lê-lo. O modelo Nginx não grava em access log a query da página inicial, o caminho dos convites nem o callback OAuth. Isso evita guardar tokens temporários no histórico, em referers ou nos logs da aplicação.
- A unidade systemd observada roda como `fifago`, com código em modo somente leitura, gravação limitada aos dados da aplicação, sem privilégios adicionais e com limites de CPU/memória. A API escuta apenas em loopback; o Nginx recebe o IP do visitante por uma configuração de IP real da Cloudflare.
- As rotas de consulta de jogador e ranking agora retornam só ID público, apelido e clube; não incluem UUID interno nem referência de conta de jogo.

## Estado da publicação observado

- O serviço Fifa GO no VPS estava ativo e respondeu localmente com SQLite, OAuth Google habilitado e pagamentos em `unconfigured`.
- A resposta pública de `https://betfifa.com.br/` veio do GitHub Pages. `https://betfifa.com.br/api/v1/status` retornou 404. Portanto, a página atualmente publicada não está conectada à API do VPS; login, sessões e banco não podem ser considerados disponíveis pelo domínio neste momento.
- A versão estática do GitHub Pages não permite configurar cabeçalhos HTTP como HSTS pelo repositório. A CSP em `<meta>` protege scripts da página; HSTS precisa estar no proxy HTTPS/CDN ou no backend quando o domínio voltar a passar por ele.

## Limitações e próximos controles

- Código JavaScript enviado ao navegador pode ser lido e copiado. A proteção está em não colocar segredos no cliente e em validar autorização e dados no backend.
- O rate limiter é local ao processo e não substitui proteção de borda. Para tráfego público, mantenha o proxy/CDN e configure limites de requisição e regras anti-bot no Cloudflare; ataques distribuídos volumosos precisam ser filtrados antes do VPS.
- Antes de cobrar dinheiro real ou abrir a produção, reconecte o domínio à API, valide os cabeçalhos HTTPS na resposta pública e configure recuperação de conta, alertas, backups e revisão de dependências/servidor.
- Este trabalho não executou carga de DoS nem teste de invasão externo. Nenhum segredo ou dado de usuário foi incluído neste relatório.
