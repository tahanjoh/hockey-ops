const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');const Module=require('node:module');const path=require('node:path');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,filename);
require.extensions['.tsx']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
const originalRequire=Module.prototype.require;
Module.prototype.require=function(name){
 if(name==='next/navigation')return {useRouter:()=>({replace(){},refresh(){}})};
 if(name==='./createShowcaseActions')return {saveShowcase:async()=>({})};
 if(name.startsWith('@/lib/hockey/'))return require(path.resolve('src/lib/hockey',name.split('/').pop()+'.ts'));
 return originalRequire.apply(this,arguments);
};
const Create=require('../src/app/players/[id]/showcase/CreateShowcaseForm.tsx').default;
Module.prototype.require=originalRequire;
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const html=renderToStaticMarkup(React.createElement(Create,{id:'player',games:[],initial:null}));
assert(html.includes('Showcase title'));assert(html.includes('Custom note'));assert(html.includes('name="message"'));assert(html.includes('Here are the results from my tournament this weekend.'));
assert(html.indexOf('Custom note')<html.indexOf('Team'));
assert(html.includes('Create Showcase'));assert(!html.includes('Replace link'));assert(!html.includes('Disable sharing'));
const file=path.resolve('src/app/players/[id]/showcase/createShowcaseActions.ts');const loaded=new Module(file,module);loaded.filename=file;loaded.paths=module.paths;
let publication;
const db = {
 auth: {getUser: async()=>({data:{user:{id:'parent'}}})},
 rpc: async(name,args)=>{if(name==='hockey_is_parent')return {data:true};publication=args;return {data:{id:'publication',code:'123456'}};},
 from: name=>{
  const chain={
   select(){return chain;},eq(){return chain;},in(){return chain;},
   async single(){return {data:{first_name:'Taylor',last_name:'Tahan'}};},
   async order(){return {data:[{id:'game',opponent:'Dallas',game_date:'2026-11-15',position:'forward',team_score:2,opponent_score:1,game_events:[{event_type:'goal'}]}]};},
  };
  return chain;
 },
};
loaded.require=name=>{if(name==='next/cache')return {revalidatePath(){}};if(name==='@/lib/supabase/server')return {createClient:async()=>db};if(name.startsWith('@/lib/hockey/'))return require(path.resolve('src/lib/hockey',name.split('/').pop()+'.ts'));return require(name);};
loaded._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,file);
(async()=>{const form=new FormData();for(const [k,v] of Object.entries({player:'player',action:'publish',title:'Tournament weekend',message:'Here are my results!',game:'game'}))form.set(k,v);const result=await loaded.exports.saveShowcase(form);assert.equal(result.token,'123456');assert.equal(publication.p_title,'Tournament weekend');assert.equal(publication.p_snapshot.message,'Here are my results!');console.log('PASS: Create Showcase form, custom note placement, separate saved-link controls, and saving the title/note into the published showcase.');})().catch(e=>{console.error(e);process.exitCode=1;});
