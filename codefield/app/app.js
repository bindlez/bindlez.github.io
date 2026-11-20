import { createEditor } from '../src/editor.js';
import { tokenizeRuby } from '../src/languages/ruby.js';
import { tokenizeJavaScript } from '../src/languages/javascript.js';
import { selectionContext } from '../src/completion.js';
import { inferContext, inferCurrent, inferVariables } from '../src/inference.js';
import { tokenizeRust } from '../src/languages/rust.js';
import { rustMethods } from './rust-methods.js';
import { tokenizeCpp } from '../src/languages/cpp.js';
import { cppMethods } from './cpp-methods.js';
import { content } from './content.js';
import { documentationUrl } from './documentation.js';
import { methodGuide } from './method-guides.js';
import { rustProgram } from './rust-snippet.js';
import { initStudio, queueStudioAnalysis } from './studio.js';
import { initAI } from './ai-studio.js';
const $ = selector => document.querySelector(selector);
const storageKey = 'codefield.workspace.v2';
let state = {language:'ruby',code:{},history:[],notes:''};
try { const saved=JSON.parse(localStorage.getItem(storageKey)); if(saved && content[saved.language] && saved.code && typeof saved.code==='object') state={...state,...saved}; } catch {}
// Start each page visit with the starter, but retain old drafts as recoverable versions.
state.versions=Array.isArray(state.versions)?state.versions:[];
for(const [language,code] of Object.entries(state.code))if(content[language]&&typeof code==='string'&&code!==content[language].starter&&!state.versions.some(v=>v.language===language&&v.code===code))state.versions.unshift({id:crypto.randomUUID(),language,code,name:'Previous draft',createdAt:new Date().toISOString()});
state.versions=state.versions.slice(0,50);state.code={};
let editor, worker, timer, ready=false, pending=false, booting=false, currentMethods=[], submittedCode="", completionId=0;
let selectionId=0, selectedItems=null, selectedReceiver='', selectedType='', selectedOwners={}, selectedIsInferred=false;
let inferTimer, rustAbort;
let activeProblem=null;
let previewTimer, previewWorker, previewTimeout, explorationKey='';
const learningPanel=document.createElement('section');
learningPanel.className='panel learning-panel';
learningPanel.setAttribute('aria-label','Method learning details');
learningPanel.innerHTML='<div class="learning-head"><p class="eyebrow">METHOD EXPLORER</p><h2>Learn as you type</h2><p>Highlight a suggestion or select code to explore it.</p></div><div id="parent-path" class="parent-path" aria-label="Expression parents"></div><div id="learning-detail"></div>';
$('#reference .reference').after(learningPanel);
$('#learning-detail').append($('#selected-detail'));
const previewPanel=document.createElement('section');
previewPanel.className='panel live-preview';
previewPanel.innerHTML='<div class="panel-bar"><div><span class="section-label">LIVE RESULT</span><p>Fresh browser session · runs after you pause</p></div><label class="preview-toggle"><input id="live-preview-toggle" type="checkbox"> Auto-run</label></div><pre id="live-preview-output" role="status">Enable auto-run to preview your code as you type.</pre><p class="live-note">Runs your whole editor in a separate worker. Code may have side effects; only run code you trust. Ruby and JavaScript only.</p>';
$('.output-panel').before(previewPanel);
const codeMap=document.createElement('section');codeMap.className='panel code-map';codeMap.setAttribute('aria-label','Code map');
codeMap.innerHTML='<div class="code-map-head"><div><span class="section-label">CODE MAP</span><p>Click a piece to explore its methods. Types are inferred without running code.</p></div><span class="code-map-badge">LIVE</span></div><div class="code-map-body"><div><span class="selected-caption">VARIABLES</span><div id="code-map-vars" class="code-map-chips"></div></div><div><span class="selected-caption">EXPRESSION PATH</span><div id="code-map-path" class="code-map-chips"></div></div></div>';
$('.editor-panel').after(codeMap);
function updateCodeMap(){
 if(!editor)return;const vars=inferVariables(editor.getValue(),editor.getCaret(),state.language),mount=$('#code-map-vars');mount.replaceChildren();
 for(const [name,type] of [...vars.entries()].slice(-24)){const button=document.createElement('button');button.type='button';button.className='map-chip';button.dataset.type=type;button.textContent=`${name} · ${type}`;button.title=`Inspect ${name}`;button.onclick=()=>inspectSelection(name);mount.append(button)}
 if(!mount.childElementCount){const empty=document.createElement('span');empty.className='map-empty';empty.textContent='Variables appear as you write.';mount.append(empty)}
}
const wrapLabel=document.createElement('label');wrapLabel.className='rust-wrap-toggle';wrapLabel.innerHTML='<input id="rust-wrap-toggle" type="checkbox" checked> Wrap snippets in fn main()';$('.editor-tools').append(wrapLabel);
const wrapStart=document.createElement('pre'),wrapEnd=document.createElement('pre');wrapStart.className=wrapEnd.className='rust-wrapper';wrapStart.textContent='fn main() {';wrapEnd.textContent='}';$('#editor').before(wrapStart);$('#editor').after(wrapEnd);
function refreshRustWrapper(){const rust=state.language==='rust';wrapLabel.hidden=!rust;const wrapped=rust&&editor&&rustProgram(editor.getValue(),$('#rust-wrap-toggle').checked).wrapped;wrapStart.hidden=wrapEnd.hidden=!wrapped}
$('#rust-wrap-toggle').onchange=refreshRustWrapper;
const completionRequests = new Map();
function save(){try{localStorage.setItem(storageKey,JSON.stringify(state));$('#save-status').textContent='Saved locally';return true}catch{$('#save-status').textContent='Local save unavailable';return false}}
function stop(){if(worker)worker.terminate();if(rustAbort)rustAbort.abort();rustAbort=null;worker=null;clearTimeout(timer);clearTimeout(inferTimer);selectionId++;for(const resolve of completionRequests.values())resolve({methods:[],receiverType:null});completionRequests.clear();ready=false;booting=false;pending=false;$('#run').disabled=false}
function requestMethods({receiver,chain,staticType}){
 if(state.language==='rust')return Promise.resolve({methods:rustMethods[staticType]||[],receiverType:staticType||null});
 if(state.language==='cpp')return Promise.resolve({methods:cppMethods[staticType]||[],receiverType:staticType||null});
 if(!worker || !ready || $('#run').disabled){
  const methods=state.language==='ruby' && staticType ? content.ruby.docs.filter(d=>d.name.startsWith(staticType+'#')).map(d=>d.name.split('#')[1]) : [];
  return Promise.resolve({methods,receiverType:staticType||null});
 }
 const id=++completionId;
 return new Promise(resolve=>{completionRequests.set(id,resolve);worker.postMessage({type:'complete',id,receiver,chain,staticType});setTimeout(()=>{if(completionRequests.has(id)){completionRequests.delete(id);resolve({methods:[],receiverType:null})}},3000)});
}
function documentationFor(label,type){
 return content[state.language].docs.find(d=>{
  const parts=d.name.split(/[.#]/), owner=parts[0], method=parts.at(-1).replace(/\(\)$/,'');
  return method===label && !!type && (owner===type || (state.language==='rust' && owner==='str' && ['&str','String'].includes(type)) || (state.language==='ruby' && owner==='Enumerable' && ['Array','Hash','Range'].includes(type)));
 });
}
async function complete(context){
 let inferred=inferContext(editor.getValue(),editor.getCaret(),state.language,context.receiver,context.chain);
 if(state.language==='ruby'&&context.blockResult&&context.chain.at(-1)==='map'){
  const receiver=inferContext(editor.getValue(),editor.getCaret(),state.language,context.receiver,context.chain.slice(0,-1));
  if(['Array','Enumerator','Hash'].includes(receiver?.type))inferred={...receiver,type:'Array',uncertain:true};
 }
 const result=await requestMethods({...context,staticType:inferred?.type});
 const parens=['rust','cpp'].includes(state.language);
 const noArgs=new Set(['as_bytes','as_mut_str','as_slice','as_str','back','begin','bytes','c_str','capacity','chars','clear','clone','count','empty','end','enumerate','first','front','is_ascii','is_empty','iter','iter_mut','last','len','length','lines','next','pop','pop_back','reverse','rev','size','sort','to_lowercase','to_owned','to_string','to_uppercase','trim','trim_end','trim_start']);
 return result.methods.filter(visibleMethod).map(label=>({label,display:parens?label+'()':label,insert:parens?label+'()':label,cursorOffset:parens?label.length+(noArgs.has(label)?2:1):undefined,detail:(inferred?.uncertain?'Tentative type · ':'')+(documentationFor(label,result.receiverType)?.description||'method'),explore:{context,result,inferred,language:state.language}}));
}
function renderParents(context){
 const path=$('#parent-path'),map=$('#code-map-path');path.replaceChildren();map.replaceChildren();if(!context){map.textContent='Select a value or type a method chain.';return}
 const title=document.createElement('span');title.className='parent-label';title.textContent='EXPRESSION PATH';path.append(title);
 const parts=[context.receiver,...context.chain];let expression='';
 parts.forEach((part,index)=>{expression+=index?(part.startsWith('[')?part:'.'+part):part;const current=expression;const type=inferContext(editor.getValue(),editor.getCaret(),state.language,context.receiver,context.chain.slice(0,index));const blockArray=context.blockResult&&index===parts.length-1&&part==='map';const label=part+(blockArray?' · Array (block)':type?.type?' · '+type.type:'');for(const target of [path,map]){const button=document.createElement('button');button.type='button';button.className='map-chip';button.dataset.type=blockArray?'Array':type?.type||'';button.textContent=label;button.title='Inspect '+current;button.onclick=()=>blockArray?inspectSelection(current,null,'Array'):inspectSelection(current);target.append(button)}});
}
function previewCompletion(item){
 if(!item?.explore||item.explore.language!==state.language)return;
 clearTimeout(inferTimer);const {context,result,inferred}=item.explore;const key=JSON.stringify([state.language,context.receiver,context.chain,result.receiverType]);
 selectionId++;selectedIsInferred=false;selectedItems=result.methods;selectedOwners=result.owners||{};selectedType=result.receiverType||inferred?.type||'';
 selectedReceiver=context.receiver+context.chain.map(step=>step.startsWith('[')?step:'.'+step).join('');
 if(key!==explorationKey){explorationKey=key;$('#selected-panel').hidden=false;$('#reference-list').hidden=true;$('#selected-expression').textContent=selectedReceiver;$('#selected-message').textContent=`${inferred?.uncertain?'Tentative · ':''}${selectedType} · ${selectedItems.length} methods`;$('#search').value='';renderSelectedMethods();renderParents(context)}
 showMethodDetail(item.label,documentationFor(item.label,selectedType),false);
}
function visibleMethod(name){return $('#show-operators').checked || (/^[A-Za-z]/.test(name) && !name.startsWith('__'))}
function queueInference(value,caret){
 clearTimeout(inferTimer);const language=state.language;
 inferTimer=setTimeout(async()=>{
  if(language!==state.language)return;
  const inferred=inferCurrent(value,caret,language);
  if(!inferred){
   const line=value.slice(0,caret).split('\n').at(-1);
   if(selectedIsInferred && line.trim()){$('#selected-message').textContent='No type can be determined here yet.';$('#selected-methods').replaceChildren();$('#selected-detail').hidden=true;selectedItems=[];selectionId++}
   return;
  }
  const id=++selectionId;
  const result=await requestMethods({receiver:'',chain:[],staticType:inferred.type});
  if(id!==selectionId || language!==state.language || !result.methods.length)return;
  selectedIsInferred=true;selectedReceiver=inferred.label;selectedItems=result.methods;selectedOwners=result.owners||{};selectedType=result.receiverType||inferred.type;
  renderParents(selectionContext(inferred.known||''));
  $('#selected-panel').hidden=false;$('#reference-list').hidden=true;$('#selected-expression').textContent=selectedReceiver;
  $('#selected-detail').hidden=true;$('#search').value='';
  $('#selected-message').textContent=`${inferred.uncertain?'Tentative type':'Inferred'}: ${selectedType} · ${selectedItems.length} ${['rust','cpp'].includes(language)?'suggested':'available'} methods. ${inferred.uncertain?'Some earlier code could not be verified.':''}`;
  renderSelectedMethods();
 },220);
}
async function inspectSelection(value,parent=null,overrideType=null){
 clearTimeout(inferTimer);
 const context=parent || selectionContext(value), id=++selectionId;
 selectedIsInferred=false;selectedReceiver=parent ? parent.receiver + parent.chain.map(step=>step.startsWith('[')?step:'.'+step).join('') : value.trim();selectedItems=[];selectedType='';
 $('#selected-panel').hidden=false;$('#reference-list').hidden=true;$('#selected-expression').textContent=selectedReceiver;
 if(!context){$('#selected-message').textContent='Select a single variable, string, array, or supported method chain to inspect it.';$('#selected-methods').replaceChildren();$('#selected-detail').hidden=true;return}
 explorationKey='';renderParents(context);
 $('#selected-message').textContent=ready?'Finding methods…':'Runtime is starting; try selecting the value again.';
 $('#selected-methods').replaceChildren();$('#selected-detail').hidden=true;$('#search').value='';
 if(!ready && state.language!=='ruby')return;
 const source=editor.getValue(), caret=editor.getCaret(), lineEnd=source.indexOf('\n',caret);
 let inferred=inferContext(source,lineEnd<0?source.length:lineEnd,state.language,context.receiver,context.chain);
 if(overrideType)inferred={...inferred,type:overrideType,uncertain:true};
 // A C++ string literal is an array, not a std::string. In a std::string
 // initializer show the destination's methods and make that context explicit.
 let initializer=false;
 if(state.language==='cpp' && inferred?.type==='CppStringLiteral'){
  const lineStart=source.lastIndexOf('\n',Math.max(0,caret-1))+1;
  const line=source.slice(lineStart,lineEnd<0?source.length:lineEnd);
  if(/\b(?:std::)?string\s+\w+\s*=\s*["']/.test(line)){inferred={type:'CppString'};initializer=true}
 }
 const result=await requestMethods({...context,staticType:inferred?.type});
 if(id!==selectionId)return;
 selectedItems=result.methods;selectedOwners=result.owners||{};selectedType=result.receiverType||'';
 $('#selected-message').textContent=selectedItems.length ? `${inferred?.uncertain?'Tentative type · ':inferred?'Inferred · ':''}${selectedType ? selectedType+' · ' : ''}${selectedItems.length} ${['rust','cpp'].includes(state.language)?'suggested':'available'} methods. Select one to learn more.` : 'Could not determine methods. Run the assignment first, or select a supported value.';
 if(initializer)$('#selected-message').textContent='This literal initializes a std::string. Showing methods of the destination variable.';
 renderSelectedMethods();
 if(parent && selectedItems.includes(value))showMethodDetail(value,documentationFor(value,selectedType));
}
function renderSelectedMethods(){
 const list=$('#selected-methods');list.replaceChildren();const query=$('#search').value.trim().toLowerCase();
 const matches=(selectedItems||[]).filter(name=>name.toLowerCase().includes(query) && (visibleMethod(name)||!!query)).sort((a,b)=>Number(!/^[A-Za-z]/.test(a))-Number(!/^[A-Za-z]/.test(b))||a.localeCompare(b));
 if(!matches.length){const p=document.createElement('p');p.className='selected-empty';p.textContent=query?'No matching methods.':'No methods to show yet.';list.append(p);return}
 for(const name of matches){const button=document.createElement('button');button.type='button';button.className='selected-method';button.dataset.method=name;button.textContent=name;const doc=documentationFor(name,selectedType);if(doc){const desc=document.createElement('small');desc.textContent=doc.description;button.append(desc)}button.onclick=()=>showMethodDetail(name,doc);button.onfocus=()=>showMethodDetail(name,doc,false);button.onkeydown=event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const buttons=[...list.querySelectorAll('button')],i=buttons.indexOf(button),next=buttons[(i+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length];next.focus()}};list.append(button)}
}
function showMethodDetail(name,doc,scroll=true){
 const detail=$('#selected-detail');detail.replaceChildren();detail.hidden=false;
 for(const button of $('#selected-methods').querySelectorAll('button')){const active=button.dataset.method===name;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active))}
 const guide=methodGuide(state.language,name,doc);
 const overview=document.createElement('div');overview.className='learning-card';const caption=document.createElement('span');caption.className='selected-caption';caption.textContent='METHOD';const title=document.createElement('strong');title.textContent=doc?.name||`${selectedType}#${name}`;const text=document.createElement('p');text.textContent=guide.description;overview.append(caption,title,text);detail.append(overview);
 const examples=document.createElement('div');examples.className='learning-card';const exampleTitle=document.createElement('span');exampleTitle.className='selected-caption';exampleTitle.textContent='EXAMPLES';examples.append(exampleTitle);
 if(guide.example){const example=document.createElement('pre');example.textContent=guide.example;examples.append(example)}else{const empty=document.createElement('p');empty.textContent='Examples are available in the linked reference when documented by the language.';examples.append(empty)}
 if(doc){const button=document.createElement('button');button.className='text-button';button.type='button';button.textContent='Use example';button.onclick=()=>{editor.setValue(doc.insert);state.code[state.language]=doc.insert;save();editor.focus()};examples.append(button)}detail.append(examples);
 const url=documentationUrl(state.language,selectedType,name,selectedOwners[name]||doc?.name.split('#')[0]);
 const anchor=document.createElement('a');anchor.textContent='Open full reference ↗';anchor.href=url;anchor.target='_blank';anchor.rel='noopener noreferrer';detail.append(anchor);
 if(['ruby','rust'].includes(state.language)){
  const read=document.createElement('button');read.className='outline doc-read';read.type='button';read.textContent='Read here';
  read.onclick=()=>{const frame=document.createElement('iframe');frame.className='doc-frame';frame.title=`Official documentation for ${name}`;frame.src=url;frame.loading='lazy';frame.referrerPolicy='no-referrer';detail.append(frame);read.remove()};detail.append(read);
 }
 const methods=(selectedItems||[]).filter(visibleMethod).sort((a,b)=>a.localeCompare(b));const index=methods.indexOf(name);
 if(index>=0){const navigation=document.createElement('div');navigation.className='doc-nav';for(const [label,next] of [['← Previous',methods[index-1]],['Next →',methods[index+1]]]){const button=document.createElement('button');button.className='text-button';button.type='button';button.textContent=label;button.disabled=!next;button.onclick=()=>showMethodDetail(next,documentationFor(next,selectedType));navigation.append(button)}detail.append(navigation)}
 if(scroll && matchMedia('(max-width: 760px)').matches)detail.scrollIntoView({block:'nearest'});
}
function status(text){$('#output-status').textContent='/ '+text}
function appendEntry(code,result){
  const div=document.createElement('article');div.className='history-entry';
  const command=document.createElement('pre');command.className='history-code';command.textContent='› '+code; div.append(command);
  const output=document.createElement('pre');output.className=result.ok?'history-result':'history-error';
  output.textContent=[result.output,result.stderr,result.ok?'⇒ '+result.value:result.error].filter(Boolean).join('\n');div.append(output);
  if(result.ok && result.type){const type=document.createElement('button');type.type='button';type.className='type-chip';type.textContent=result.type+' · inspect methods';type.onclick=()=>inspect(result);div.append(type)}
  $('#output').append(div);$('#output').scrollTop=$('#output').scrollHeight;
}
function inspect(result){currentMethods=result.methods||[];$('#inspection').hidden=false;$('#inspect-type').textContent=result.type;$('#inspect-value').textContent=result.value;renderMethods();}
function renderMethods(){const query=$('#method-search').value.toLowerCase();const methods=currentMethods.filter(m=>m.toLowerCase().includes(query));$('#methods').textContent=methods.slice(0,80).join('  ·  ')||'No matching methods.'}
function showReference(){
 if(selectedItems!==null){renderSelectedMethods();return}
 const query=$('#search').value.trim().toLowerCase(),list=$('#reference-list');list.replaceChildren();
 const docs=content[state.language].docs.filter(item=>`${item.name} ${item.description}`.toLowerCase().includes(query));
 if(!docs.length){const p=document.createElement('p');p.className='empty';p.textContent='No matches. Try another search.';list.append(p);return}
 for(const doc of docs){const article=document.createElement('article');article.className='reference-card';const title=document.createElement('h3');title.textContent=doc.name;const p=document.createElement('p');p.textContent=doc.description;const example=document.createElement('pre');example.textContent=doc.example;const button=document.createElement('button');button.className='text-button';button.type='button';button.textContent='Use example';button.onclick=()=>{editor.setValue(doc.insert);state.code[state.language]=doc.insert;save();editor.focus()};article.append(title,p,example,button);list.append(article)}
}
function ensureWorker(){
 if(worker || booting)return;
 if(state.language==='rust' || state.language==='cpp'){
  ready=true;status('READY');
  $('#execution-note').textContent=state.language==='rust'?'Rust runs as a fresh program. Run sends your code to the public Rust Playground service.':'C++ runs as a fresh program. Run sends your code to Compiler Explorer.';
  if(pending)execute();
  return;
 }
 booting=true;status('STARTING');$('#execution-note').textContent=state.language==='ruby'?'Loading Ruby into this browser. First load may take a moment.':'Starting JavaScript session…';
 try{worker=new Worker(state.language==='ruby'?'./ruby-worker.js':'./javascript-worker.js',{type:'module'})}catch(e){booting=false;status('ERROR');$('#execution-note').textContent=String(e);return}
 worker.onmessage=event=>{
  const message=event.data;
  if(message.type==='completion'){
   const resolve=completionRequests.get(message.id);completionRequests.delete(message.id);
   if(resolve)resolve({methods:message.methods,owners:message.owners||{},receiverType:message.receiverType});
   return;
  }
  if(message.type==='ready'){clearTimeout(timer);booting=false;ready=true;status('READY');$('#execution-note').textContent=state.language==='ruby'?'Ruby runs in your browser. State lasts until reset or reload.':'JavaScript runs in your browser. Use var or globalThis for names you want to reuse.';if(pending)execute();else queueInference(editor.getValue(),editor.getCaret());return}
  if(message.type==='result'){clearTimeout(timer);pending=false;$('#run').disabled=false;const code=submittedCode;appendEntry(code,message.result);state.history.push({language:state.language,code,result:message.result});state.history=state.history.slice(-50);save();if(message.result.ok)inspect(message.result);status(message.result.ok?'READY':'ERROR');if(selectedItems!==null){if(selectedIsInferred)queueInference(editor.getValue(),editor.getCaret());else inspectSelection(selectedReceiver)}return}
  if(message.type==='failure'){stop();status('ERROR');$('#execution-note').textContent='Runtime error: '+message.error+' Use Reset session to retry.'}
 };
 worker.onerror=()=>{stop();status('ERROR');$('#execution-note').textContent='Could not load the runtime. Check your network connection and retry.'};
 timer=setTimeout(()=>{stop();status('TIMEOUT');$('#execution-note').textContent='Runtime startup timed out. Reset the session to try again.'},60000);
 if(state.language==='ruby')worker.postMessage({type:'init'});
}
async function runRust(code){
 const controller=new AbortController();rustAbort=controller;
 timer=setTimeout(()=>controller.abort(),30000);
 try{
  const program=rustProgram(code,$('#rust-wrap-toggle').checked);
  const response=await fetch('https://play.rust-lang.org/execute',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({channel:'stable',mode:'debug',edition:'2021',crateType:'bin',tests:false,code:program.code,backtrace:false})});
  if(!response.ok)throw new Error(`Rust service returned HTTP ${response.status}`);
  const data=await response.json();if(rustAbort!==controller)return;
  const result={ok:!!data.success,output:data.stdout||'',stderr:data.stderr||'',value:data.success?'Program finished':'',error:data.success?'':(data.stderr?'Compilation or execution failed.':'Rust service reported a failure.')};
  appendEntry(code,result);state.history.push({language:'rust',code,result});state.history=state.history.slice(-50);save();status(result.ok?'READY':'ERROR');
 }catch(error){if(rustAbort!==controller)return;status('ERROR');$('#execution-note').textContent=error.name==='AbortError'?'Rust request timed out. Try again.':`Rust service unavailable: ${error.message}`}
 finally{clearTimeout(timer);if(rustAbort===controller){rustAbort=null;$('#run').disabled=false}}
}
async function runCpp(code){
 const controller=new AbortController();rustAbort=controller;timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch('https://godbolt.org/api/compiler/g132/compile',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},signal:controller.signal,body:JSON.stringify({source:code,options:{userArguments:'-std=c++20',compilerOptions:{executorRequest:true},filters:{execute:true},tools:[],libraries:[]},lang:'c++',allowStoreCodeDebug:false})});
  if(!response.ok)throw new Error(`Compiler Explorer returned HTTP ${response.status}`);
  const data=await response.json();if(rustAbort!==controller)return;
  const lines=items=>(items||[]).map(item=>item.text||'').join('\n').replace(/\x1b\[[0-9;]*[A-Za-z]/g,'');
  const ok=data.code===0 && (data.buildResult?.code??0)===0;
  const errors=[lines(data.buildResult?.stderr),lines(data.stderr)].filter(Boolean).join('\n');
  const result={ok,output:lines(data.stdout),stderr:errors,value:ok?'Program finished':'',error:ok?'':'Compilation or execution failed.'};
  appendEntry(code,result);state.history.push({language:'cpp',code,result});state.history=state.history.slice(-50);save();status(ok?'READY':'ERROR');
 }catch(error){if(rustAbort!==controller)return;status('ERROR');$('#execution-note').textContent=error.name==='AbortError'?'C++ request timed out. Try again.':`Compiler Explorer unavailable: ${error.message}`}
 finally{clearTimeout(timer);if(rustAbort===controller){rustAbort=null;$('#run').disabled=false}}
}
function stopLivePreview(){clearTimeout(previewTimer);clearTimeout(previewTimeout);if(previewWorker)previewWorker.terminate();previewWorker=null}
function queueLivePreview(){
 stopLivePreview();const output=$('#live-preview-output');
 if(!$('#live-preview-toggle').checked){output.textContent='Enable auto-run to preview your code as you type.';return}
 if(!['ruby','javascript'].includes(state.language)){output.textContent='Live preview is available for Ruby and JavaScript. Use Run code for Rust or C++.';return}
 const language=state.language,code=editor.getValue();output.textContent='Waiting for you to pause…';
 previewTimer=setTimeout(()=>{
  output.textContent=language==='ruby'?'Starting a fresh Ruby preview…':'Running preview…';
  let w;try{w=new Worker(language==='ruby'?'./ruby-worker.js':'./javascript-worker.js',{type:'module'});previewWorker=w}catch(error){output.textContent='Could not start preview: '+error.message;return}
  const expire=()=>{if(previewWorker===w){w.terminate();previewWorker=null;output.textContent='Preview timed out.'}};
  previewTimeout=setTimeout(expire,60000);
  w.onmessage=event=>{if(previewWorker!==w)return;const message=event.data;
   if(message.type==='ready'){clearTimeout(previewTimeout);previewTimeout=setTimeout(expire,5000);w.postMessage({type:'run',code});return}
   if(message.type==='result'){clearTimeout(previewTimeout);const r=message.result;output.textContent=[r.output,r.stderr,r.ok?'⇒ '+r.value:r.error].filter(Boolean).join('\n');w.terminate();previewWorker=null}
   if(message.type==='failure'){clearTimeout(previewTimeout);output.textContent='Preview error: '+message.error;w.terminate();previewWorker=null}
  };
  w.onerror=()=>{if(previewWorker===w){stopLivePreview();output.textContent='Could not load the preview runtime.'}};
  if(language==='ruby')w.postMessage({type:'init'});
 },900);
}
$('#live-preview-toggle').onchange=queueLivePreview;
function execute(){if($('#run').disabled)return;if(!ready){pending=true;ensureWorker();return}pending=false;$('#run').disabled=true;status('RUNNING');const code=editor.getValue();submittedCode=code;if(state.language==='rust'){runRust(code);return}if(state.language==='cpp'){runCpp(code);return}worker.postMessage({type:'run',code});timer=setTimeout(()=>{stop();status('TIMEOUT');$('#execution-note').textContent='Execution stopped after 10 seconds. The session was reset.'},10000)}
function selectLanguage(language){activeProblem=null;stop();stopLivePreview();explorationKey='';selectedItems=null;$('#selected-panel').hidden=true;$('#reference-list').hidden=false;$('#selected-detail').hidden=true;$('#parent-path').replaceChildren();state.language=language;const data=content[language];if(editor)editor.destroy();editor=createEditor('#editor',{value:typeof state.code[language]==='string'?state.code[language]:data.starter,label:`${language} code editor`,tokenize:language==='ruby'?tokenizeRuby:language==='rust'?tokenizeRust:language==='cpp'?tokenizeCpp:tokenizeJavaScript,complete,onCompletionHighlight:previewCompletion,onSelection:inspectSelection,onSetValue:()=>{refreshRustWrapper();updateCodeMap();queueLivePreview();queueStudioAnalysis()},autoIndent:true,onChange:(value,info)=>{state.code[state.language]=value;save();refreshRustWrapper();updateCodeMap();queueInference(value,info.caret);queueLivePreview();queueStudioAnalysis()}});refreshRustWrapper();updateCodeMap();$('#language').value=language;$('#file-name').textContent=data.filename;$('#editor-hint').textContent=language==='ruby'?'Ruby · persistent session':language==='rust'?'Rust · run sends code to Rust Playground':language==='cpp'?'C++ · run sends code to Compiler Explorer':'JavaScript · persistent worker';$('#challenge-title').textContent=data.exercise.title;$('#challenge-text').textContent=data.exercise.text;$('#hint-text').textContent=data.exercise.hint;$('#hint-text').hidden=true;$('#hint').textContent='Show hint';$('#search').value='';$('#inspection').hidden=true;$('#output').replaceChildren();for(const item of state.history.filter(h=>h.language===language))appendEntry(item.code,item.result);showReference();save();ensureWorker();queueLivePreview()}
$('#language').onchange=e=>selectLanguage(e.target.value);$('#search').oninput=showReference;$('#method-search').oninput=renderMethods;
$('#selected-clear').onclick=()=>{selectionId++;selectedItems=null;$('#selected-panel').hidden=true;$('#reference-list').hidden=false;$('#search').value='';showReference()};
$('#starter').onclick=()=>{const text=activeProblem?.language===state.language?activeProblem.starter:content[state.language].exercise.starter;editor.setValue(text);state.code[state.language]=text;save();editor.focus()};
$('#hint').onclick=()=>{const el=$('#hint-text');el.hidden=!el.hidden;$('#hint').textContent=el.hidden?'Show hint':'Hide hint'};
$('#reset').onclick=()=>{if(editor.getValue()!==content[state.language].starter)captureVersion('Before reset');stop();editor.setValue(content[state.language].starter);state.code[state.language]=content[state.language].starter;save();$('#inspection').hidden=true;$('#execution-note').textContent='Session reset. Starting a fresh runtime…';ensureWorker()};
$('#clear').onclick=()=>{$('#output').replaceChildren();state.history=state.history.filter(h=>h.language!==state.language);save()};
$('#notes').value=state.notes||'';$('#notes').oninput=e=>{state.notes=e.target.value;save()};
$('#find-toggle').onclick=()=>{ $('#find-bar').hidden=false; $('#find-input').focus(); };
$('#find-close').onclick=()=>{ $('#find-bar').hidden=true; $('#find-message').textContent=''; editor.focus(); };
function find(backwards=false){const term=$('#find-input').value;$('#find-message').textContent=term ? (editor.find(term,backwards)?'Match selected':'No matches') : '';}
$('#find-next').onclick=()=>find(); $('#find-prev').onclick=()=>find(true);
$('#find-input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();find(e.shiftKey)}else if(e.key==='Escape')$('#find-close').click()};
$('#indent').onclick=()=>editor.insert('  ');
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(editor.getValue());$('#copy').textContent='Copied';setTimeout(()=>$('#copy').textContent='Copy',1800)}catch{$('#copy').textContent='Copy unavailable';setTimeout(()=>$('#copy').textContent='Copy',2200)}};
$('#download').onclick=()=>{const blob=new Blob([editor.getValue()],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=content[state.language].filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
// Problems are local drafts. Checking compares printed output from the last run;
// it is deliberately not represented as a hidden-test judging system.
function refreshVersions(){const select=$('#version-select'),selected=select.value;select.replaceChildren(new Option('Choose a version',''));for(const v of state.versions)select.add(new Option(`${v.name} · ${v.language} · ${new Date(v.createdAt).toLocaleString()}`,v.id));select.value=selected}
function captureVersion(name){const version={id:crypto.randomUUID(),language:state.language,code:editor.getValue(),name,createdAt:new Date().toISOString()};state.versions.unshift(version);state.versions=state.versions.slice(0,50);save();refreshVersions();return version}
$('#version-save').onclick=()=>{const version=captureVersion($('#version-name').value.trim()||'Saved version');$('#version-select').value=version.id;$('#version-status').textContent='Version saved in this browser.'};
$('#version-restore').onclick=()=>{const version=state.versions.find(v=>v.id===$('#version-select').value);if(!version){$('#version-status').textContent='Choose a version first.';return}if(editor.getValue()!==version.code)captureVersion('Before restore');if(state.language!==version.language)selectLanguage(version.language);editor.setValue(version.code);state.code[state.language]=version.code;save();$('#version-status').textContent=`Restored ${version.name}.`;editor.focus()};
$('#version-delete').onclick=()=>{const id=$('#version-select').value;if(!id){$('#version-status').textContent='Choose a version first.';return}state.versions=state.versions.filter(v=>v.id!==id);save();refreshVersions();$('#version-status').textContent='Version deleted.'};
refreshVersions();
function refreshProblems(){const select=$('#problem-select'), selected=select.value;select.replaceChildren(new Option('Choose a problem',''));for(const problem of state.problems||[]){select.add(new Option(`${problem.title} · ${problem.language}`,problem.id))}select.value=selected}
$('#problem-save').onclick=()=>{const title=$('#problem-title').value.trim(),description=$('#problem-description').value.trim();if(!title||!description){$('#problem-status').textContent='Add a title and instructions first.';return}state.problems=Array.isArray(state.problems)?state.problems:[];const problem={id:crypto.randomUUID(),title,description,hint:$('#problem-hint').value.trim(),language:state.language,starter:$('#problem-starter').value,expected:$('#problem-expected').value};state.problems.push(problem);save();refreshProblems();$('#problem-select').value=problem.id;$('#problem-status').textContent='Problem saved in this browser.'};
$('#problem-load').onclick=()=>{const problem=(state.problems||[]).find(p=>p.id===$('#problem-select').value);if(!problem){$('#problem-status').textContent='Choose a saved problem first.';return}if(state.language!==problem.language)selectLanguage(problem.language);activeProblem=problem;editor.setValue(problem.starter);state.code[state.language]=problem.starter;save();$('#challenge-title').textContent=problem.title;$('#challenge-text').textContent=problem.description;$('#hint-text').textContent=problem.hint||'No hint was provided for this task.';$('#hint-text').hidden=true;$('#hint').textContent='Show hint';$('#problem-status').textContent='Problem loaded. Run your solution, then check the last run.';editor.focus()};
$('#problem-check').onclick=()=>{const problem=(state.problems||[]).find(p=>p.id===$('#problem-select').value);const last=state.history.filter(h=>h.language===state.language).at(-1);if(!problem||problem.language!==state.language){$('#problem-status').textContent='Load a problem for this language first.';return}if(!last||last.code!==editor.getValue()){$('#problem-status').textContent='Run the current code before checking.';return}$('#problem-status').textContent=!last.result.ok?'The last run failed. Check its error above.':last.result.output.trimEnd()===problem.expected.trimEnd()?'Passed: printed output matches.':'Not yet: printed output does not match the expected output.'};
initAI({
 context:()=>({language:state.language,code:editor.getValue(),challenge:$('#challenge-text').textContent,lastRun:state.history.filter(h=>h.language===state.language).at(-1)||null}),
 saveProblems: drafts=>{
   const previous=state.problems;
   const problems=drafts.map(d=>({...d,id:crypto.randomUUID()}));
   state.problems=[...(previous||[]),...problems];
   if(!save()){state.problems=previous;return false}
   refreshProblems();$('#problem-select').value=problems[0].id;return true;
 }
});
refreshProblems();
$('#run').onclick=execute;document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();execute()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&document.activeElement.closest('.code-editor')){e.preventDefault();$('#find-toggle').click()}});
selectLanguage(state.language);
initStudio({language:()=>state.language,code:()=>editor.getValue(),selection:()=>editor.getSelection(),insert:code=>editor.insert(code),open:(language,code)=>{if(language!==state.language)selectLanguage(language);editor.setValue(code);state.code[state.language]=code;save();editor.focus();queueStudioAnalysis()}});





