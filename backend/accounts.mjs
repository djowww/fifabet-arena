// Run only on the server. This lists account IDs without exposing passwords or sessions.
import {readFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {DATABASE_FILENAME,SCHEMA_VERSION} from './database.mjs';

const directory=resolve(process.env.FIFABET_DATA_DIR||join(homedir(),'.fifabet-arena'));
try{
  const path=join(directory,DATABASE_FILENAME);
  let databaseExists=false;
  try{databaseExists=(await stat(path)).isFile();}catch(error){if(error.code!=='ENOENT')throw error;}
  let rows;
  if(databaseExists){
    if(Number(process.versions.node.split('.')[0])<24)throw Error('Use Node.js 24 ou superior para consultar o banco.');
    const {DatabaseSync}=await import('node:sqlite');
    const db=new DatabaseSync(path,{readOnly:true,timeout:5000});
    try{
      if(db.prepare('PRAGMA user_version').get().user_version!==SCHEMA_VERSION)throw Error('Versão do banco não suportada.');
      rows=db.prepare('SELECT nickname, public_player_id AS publicPlayerId, id AS reviewerUserId FROM users ORDER BY nickname_normalized').all();
    }finally{db.close();}
  }else{
    const state=JSON.parse(await readFile(join(directory,'state.json'),'utf8'));
    if(state.version!==1||!state.users||typeof state.users!=='object'||Array.isArray(state.users))throw Error('Formato de dados inválido.');
    rows=Object.values(state.users).map(user=>({nickname:user.nickname,publicPlayerId:user.publicPlayerId,reviewerUserId:user.id}));
  }
  console.table(rows);
}catch(error){
  console.error(error.code==='ENOENT'?'Ainda não há contas neste servidor. Inicie o servidor e crie as contas pelo site.':`Não foi possível listar as contas: ${error.message}`);
  process.exitCode=1;
}
