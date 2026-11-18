const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
const file=path.resolve('src/app/players/[id]/showcase/deleteShowcaseActions.ts');
let options,calls;
const loaded=new Module(file,module);loaded.filename=file;loaded.paths=module.paths;
loaded.require=name=>{
 if(name==='next/cache')return {revalidatePath:p=>calls.push(['refresh',p])};
 if(name==='@/lib/supabase/server')return {createClient:async()=>({auth:{getUser:async()=>({data:{user:options.user?{id:'parent'}:null}})},rpc:async(name,args)=>{calls.push([name,args]);return {data:options.deleted,error:options.error?{message:'Access denied'}:null};}})};
 return require(name);
};
loaded._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,file);
const run=async(patch={},confirmation='DELETE')=>{options={user:true,deleted:true,error:false,...patch};calls=[];return loaded.exports.deleteShowcase('player','publication',confirmation);};
(async()=>{
 assert.match((await run({},'')).error,/Type DELETE/);assert.equal(calls.length,0);
 assert.match((await run({user:false})).error,/sign in/);assert.equal(calls.length,0);
 assert.match((await run({error:true})).error,/Access denied/);assert.equal(calls.length,1);
 assert.match((await run({deleted:false})).error,/not found/);assert.equal(calls.length,1);
 assert.equal((await run()).deleted,true);assert.deepEqual(calls[0],['hockey_showcase_publication_delete',{p_player:'player',p_publication:'publication'}]);assert.deepEqual(calls[1],['refresh','/players/player/showcase']);
 console.log('PASS: explicit confirmation, sign-in, scoped deletion RPC, denied/missing results, and saved-list refresh after successful deletion.');
})().catch(error=>{console.error(error);process.exitCode=1});
