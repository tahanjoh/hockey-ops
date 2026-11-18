const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const filename = require('node:path').resolve('src/app/games/gameRecordActions.ts');
let calls, options;
const client = {
  auth:{ getUser:async()=>({data:{user:options.user ? {id:'parent'} : null}}) },
  rpc: async (name,args)=>{calls.push(['access',name,args]);return {data:options.allowed,error:null};},
  from: name=>{
    calls.push(['table',name]);
    const chain = { delete(){calls.push(['delete']);return chain;},eq(k,v){calls.push(['eq',k,v]);return chain;},select(){return chain;},async maybeSingle(){return {data:options.deleted ? {id:'game'} : null,error:options.error ? {message:'Database refused'} : null};} };
    return chain;
  }
};
const loaded = new Module(filename,module); loaded.filename=filename; loaded.paths=module.paths;
loaded.require = name => {
  if(name==='next/cache') return {revalidatePath:path=>calls.push(['refresh',path])};
  if(name==='next/navigation') return {redirect:path=>{throw new Error('REDIRECT:'+path);}};
  if(name==='@/lib/supabase/server') return {createClient:async()=>client};
  return require(name);
};
loaded._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
const run=async(patch={},confirmation='DELETE')=>{
 calls=[];options={user:true,allowed:true,deleted:true,error:false,...patch};
 const form=new FormData();form.set('confirmation',confirmation);
 return loaded.exports.deleteGameRecord('game','player',{error:''},form);
};
(async()=>{
 assert.match((await run({},'')).error,/Type DELETE/);assert.equal(calls.length,0);
 assert.match((await run({user:false})).error,/sign in/);assert.equal(calls.length,0);
 assert.match((await run({allowed:false})).error,/permission/);assert(!calls.some(c=>c[0]==='delete'));
 assert.match((await run({deleted:false})).error,/not found/);assert(!calls.some(c=>c[0]==='refresh'));
 assert.match((await run({error:true})).error,/could not be deleted/);assert(!calls.some(c=>c[0]==='refresh'));
 await assert.rejects(()=>run(),/REDIRECT:\/players\/player\/games/);
 assert(calls.some(c=>c[0]==='eq' && c[1]==='id' && c[2]==='game'));
 assert(calls.some(c=>c[0]==='eq' && c[1]==='player_id' && c[2]==='player'));
 for(const path of ['/players/player/games','/players/player/summary','/players/player/showcase'])assert(calls.some(c=>c[0]==='refresh'&&c[1]===path));
 console.log('PASS: explicit confirmation, authentication, parent authorization, game/player scoping, failed deletion handling, and refreshing history/summary/showcase.');
})().catch(error=>{console.error(error);process.exitCode=1;});
