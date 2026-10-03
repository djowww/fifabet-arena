import {renderAccountSecurity,renderRecoveryForm,renderRecoveryCodes} from './account-security-ui.mjs?v=1';

// Private account actions. The main controller retains session ownership and rendering.
export function createAccountTools(c){
 const context=()=>({owner:c.profile()?.id,epoch:c.epoch(),modal:c.modalRevision()});
 const current=t=>t.owner===c.profile()?.id&&t.epoch===c.epoch()&&t.modal===c.modalRevision();
 async function showSecurity(){const ticket=context(),data=await c.api.getAccountSecurity();if(!current(ticket))return;c.modal('Segurança da conta','Controle sua senha e os acessos conectados.',renderAccountSecurity(data,{esc:c.esc,owner:ticket.owner}));}
 async function handleAction(action,id){
  if(action==='recover-account'){c.modal('Recuperar acesso','Seu código guardado permite trocar a senha.',renderRecoveryForm({esc:c.esc,googleAvailable:c.googleAvailable()}));return true;}
  if(!['security','revoke-session','revoke-other-sessions','copy-recovery-codes','notifications','delete-account'].includes(action))return false;
  if(!c.profile())throw Error('Entre na sua conta para continuar.');
  if(action==='security'){await showSecurity();return true;}
  if(action==='copy-recovery-codes'){const codes=[...document.querySelectorAll('.recovery-code-list code')].map(node=>node.textContent).join('\n');if(!codes)throw Error('Gere novos códigos para copiar.');await c.copy(codes,'Códigos copiados. Guarde em local privado.');return true;}
  if(action==='notifications'){const owner=c.profile().id;await c.notices.toggle(owner);if(c.profile()?.id===owner){const state=c.notices.status(owner);c.toast(state.enabled?'Avisos ativados enquanto o aplicativo estiver aberto.':'Avisos do navegador desativados ou indisponíveis.');c.render();}return true;}
  if(action==='delete-account'){c.modal('Solicitar exclusão da conta','A equipe verifica pendências antes de anonimizar o perfil.',`<p class='hint'>Saldo, partidas e pedidos pendentes precisam ser resolvidos primeiro. Registros de movimentações, aceite dos termos e evidências privadas de disputas continuam protegidos para auditoria. A solicitação não apaga sua conta imediatamente.</p><form data-form='delete-account-request' data-owner='${c.esc(c.profile().id)}'><label class='form-label' for='deletionReason'>Sua solicitação</label><textarea id='deletionReason' name='reason' class='form-input' minlength='10' maxlength='1000' required></textarea><button class='btn secondary' type='submit'>Enviar solicitação à equipe</button></form>`);return true;}
  const ticket=context();await c.api.revokeAccountSessions(action==='revoke-session'?{id}:{allOthers:true});if(current(ticket)){c.toast('Acessos encerrados.');await showSecurity();}return true;
 }
 async function handleForm(kind,form,data){
  if(!['recover-account','recovery-codes','change-password','delete-account-request'].includes(kind))return false;
  const ticket=context();
  if(kind==='recover-account'){
   const response=await c.api.recoverAccount({identifier:String(data.get('identifier')||'').trim(),recoveryCode:String(data.get('recoveryCode')||'').trim(),newPassword:data.get('newPassword')});
   if(current(ticket))await c.afterRecovery(response.user);return true;
  }
  if(form.dataset.owner!==ticket.owner)throw Error('A conta mudou. Abra esta área novamente.');
  if(kind==='recovery-codes'){
   const response=await c.api.createRecoveryCodes({password:data.get('password')});
   if(current(ticket))c.modal('Guarde seus códigos','Cada código dá acesso à conta uma única vez.',renderRecoveryCodes(response.codes,{esc:c.esc}));return true;
  }
  if(kind==='change-password'){
   await c.api.changeAccountPassword({currentPassword:data.get('currentPassword'),newPassword:data.get('newPassword')});if(current(ticket)){c.toast('Senha atualizada. Os acessos antigos foram encerrados.');await showSecurity();}return true;
  }
  await c.api.requestAccountDeletion({reason:data.get('reason')});if(current(ticket)){c.closeModal();const refreshTicket=context();await c.refresh();if(current(refreshTicket))c.toast('Solicitação recebida. A equipe avaliará as pendências.');}return true;
 }
 return {handleAction,handleForm};
}
