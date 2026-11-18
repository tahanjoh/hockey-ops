const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),path=require('node:path'),Module=require('node:module');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {restoreShowcaseSelection}=require('../src/lib/hockey/showcaseEditing.ts');
const published={name:'Taylor',games:[{opponent:'Dallas',date:'2026-11-15',goals:1,assists:0,sog:1,clips:[{url:'https://youtu.be/goal'}]}],clips:[{url:'https://youtu.be/goal',opponent:'Dallas',date:'2026-11-15'}]};
const games=[{id:'game',opponent:'Dallas',date:'2026-11-15',clips:[{key:'game:changed-index',url:'https://youtu.be/goal'}]}];
assert.deepEqual(restoreShowcaseSelection(games,published),{games:['game'],clips:['game:changed-index'],missing:false});
assert.equal(restoreShowcaseSelection([],published).missing,true);
assert.equal(restoreShowcaseSelection([games[0],{...games[0],id:'duplicate'}],published).missing,true);
assert.deepEqual(restoreShowcaseSelection(games,published,{games:['game'],clips:[{gameId:'game',url:'https://youtu.be/goal'}]}).clips,['game:changed-index']);
let rpcSave,gameQueries=0,originalReads=0;
const db={auth:{getUser:async()=>({data:{user:{id:'parent'}}})},rpc:async(name,args)=>{
 if(name==='hockey_is_parent')return {data:true};
 if(name==='hockey_showcase_publication_manage'){originalReads++;return {data:{snapshot:published,selection:null}};}
 rpcSave=args;return {data:{id:'saved',code:'123456'}};
},from:name=>{
 if(name==='games')gameQueries++;
 const c={select(){return c},eq(){return c},in(){return c},single:async()=>({data:{first_name:'Taylor',last_name:'Tahan'}}),order:async()=>({data:[{id:'game',opponent:'Dallas',game_date:'2026-11-15',position:'forward',game_events:[{event_type:'assist'}]}]})};return c;
}};
const file=path.resolve('src/app/players/[id]/showcase/createShowcaseActions.ts');const loaded=new Module(file,module);loaded.filename=file;loaded.paths=module.paths;
loaded.require=name=>{if(name==='next/cache')return {revalidatePath(){}};if(name==='@/lib/supabase/server')return {createClient:async()=>db};if(name.startsWith('@/lib/hockey/'))return require(path.resolve('src/lib/hockey',name.split('/').pop()+'.ts'));return require(name);};
loaded._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,file);
(async()=>{
 const form=new FormData();Object.entries({player:'player',publication:'saved',version:'2026-11-18T12:00:00Z',action:'update',title:'Edited title',message:'Edited note',selection_changed:'false'}).forEach(([k,v])=>form.set(k,v));
 const result=await loaded.exports.saveShowcase(form);assert.equal(result.token,'123456');assert.equal(originalReads,1);assert.equal(gameQueries,0);assert.equal(rpcSave.p_publication,'saved');assert.equal(rpcSave.p_title,'Edited title');assert.equal(rpcSave.p_snapshot.message,'Edited note');assert.deepEqual(rpcSave.p_snapshot.games,published.games);assert.deepEqual(rpcSave.p_snapshot.clips,published.clips);assert(rpcSave.p_expected_updated);
 form.set('action','publish');await loaded.exports.saveShowcase(form);assert.equal(rpcSave.p_publication,null);
 form.set('action','update');form.set('selection_changed','true');form.set('game','game');await loaded.exports.saveShowcase(form);assert.equal(gameQueries,1);assert.equal(rpcSave.p_snapshot.games[0].assists,1);assert.deepEqual(rpcSave.p_selection.games,['game']);assert(!JSON.stringify(rpcSave.p_snapshot).includes('gameId'));
 console.log('PASS: selection restoration, ambiguous/missing legacy records, preserving archived clips/stats for profile edits, scoped updates, stable-link save intent, and save-as-new.');
})().catch(error=>{console.error(error);process.exitCode=1});
