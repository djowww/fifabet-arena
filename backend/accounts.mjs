// Run only on the server. This lists account IDs without exposing passwords or sessions.
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';

const directory=resolve(process.env.FIFABET_DATA_DIR||join(homedir(),'.fifabet-arena'));
try{
  const state=JSON.parse(await readFile(join(directory,'state.json'),'utf8'));
  if(state.version!==1||!state.users)throw Error('Formato de dados inválido.');
  const rows=Object.values(state.users).map(user=>({nickname:user.nickname,publicPlayerId:user.publicPlayerId,reviewerUserId:user.id}));
  console.table(rows);
}catch(error){
  console.error(error.code==='ENOENT'?'Ainda não há contas neste servidor. Inicie o servidor e crie as contas pelo site.':`Não foi possível listar as contas: ${error.message}`);
  process.exitCode=1;
}
