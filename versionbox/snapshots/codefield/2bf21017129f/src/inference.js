// Conservative static inference for simple local assignments; never evaluates user code.
const rubyTransitions={String:{chars:'Array',bytes:'Array',lines:'Array',split:'Array',upcase:'String',downcase:'String',strip:'String',reverse:'String',chomp:'String',to_s:'String',length:'Integer',size:'Integer'},Array:{tally:'Hash',each_cons:'Enumerator',reverse:'Array',uniq:'Array',compact:'Array',flatten:'Array',sort:'Array',to_a:'Array',join:'String',length:'Integer',size:'Integer'},Enumerator:{map:'Enumerator',collect:'Enumerator',to_a:'Array'},Hash:{keys:'Array',values:'Array',to_a:'Array',invert:'Hash',compact:'Hash',length:'Integer',size:'Integer'}};
const rustTransitions={'&str':{to_string:'String',to_owned:'String',trim:'&str',trim_start:'&str',trim_end:'&str',to_uppercase:'String',to_lowercase:'String',chars:'Iterator',bytes:'Iterator',lines:'Iterator',split:'Iterator'},String:{as_str:'&str',trim:'&str',to_uppercase:'String',to_lowercase:'String',chars:'Iterator',bytes:'Iterator',lines:'Iterator',split:'Iterator',clone:'String'},Vec:{len:'usize',is_empty:'bool',iter:'Iterator',iter_mut:'Iterator',clone:'Vec'},Array:{len:'usize',is_empty:'bool',iter:'Iterator',iter_mut:'Iterator'},Iterator:{map:'Iterator',filter:'Iterator',skip:'Iterator',take:'Iterator',enumerate:'Iterator',rev:'Iterator'}};
const cppTransitions={CppString:{substr:'CppString',append:'CppString'},CppVector:{}};
const jsTransitions={String:{trim:'String',toUpperCase:'String',toLowerCase:'String',split:'Array',slice:'String'},Array:{slice:'Array',concat:'Array',reverse:'Array',join:'String'}};
const tables={ruby:rubyTransitions,rust:rustTransitions,javascript:jsTransitions,cpp:cppTransitions};
function baseType(expr,vars,language){
 const text=expr.trim();
 if(language==='rust' && /^String::from\(\s*"(?:\\.|[^"\\])*"\s*\)/.test(text))return {type:'String',length:text.match(/^String::from\(\s*"(?:\\.|[^"\\])*"\s*\)/)[0].length};
 if(language==='rust' && /^vec!\[[^\]\n]*\]/.test(text))return {type:'Vec',length:text.match(/^vec!\[[^\]\n]*\]/)[0].length};
 if(language==='cpp' && /^(?:std::)?string\(\s*"(?:\\.|[^"\\])*"\s*\)/.test(text))return {type:'CppString',length:text.match(/^(?:std::)?string\(\s*"(?:\\.|[^"\\])*"\s*\)/)[0].length};
 const string=text.match(/^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/);
 if(string)return {type:language==='rust'?(string[0][0]==="'"?'char':'&str'):language==='cpp'?'CppStringLiteral':'String',length:string[0].length};
 if(language==='ruby'){const number=text.match(/^\d+(?:\.\d+)?\b/);if(number)return {type:number[0].includes('.')?'Float':'Integer',length:number[0].length}}
 const array=text.match(/^\[[^\[\]\n]*\]/);
 if(array){const parts=array[0].slice(1,-1).trim();const allStrings=parts && /^(?:\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*,?\s*)+$/.test(parts);return {type:'Array',element:allStrings?'String':null,length:array[0].length}}
 const name=text.match(/^[A-Za-z_]\w*/);if(name && vars.has(name[0]))return {type:vars.get(name[0]),element:vars.elements?.get(name[0])||null,tentative:vars.tentative?.has(name[0])||false,length:name[0].length};
 return null;
}
export function inferExpression(expression,vars=new Map(),language='ruby'){
 const text=expression.trim(),base=baseType(text,vars,language);if(!base)return null;
 let type=base.type, element=base.element||null, consumed=base.length, uncertain=!!base.tentative, unknown=false;
 const rest=text.slice(consumed);
 const step=/^\.([A-Za-z_]\w*[!?]?)(?:\((?:[^()"'\n]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\))?/;
 let cursor=0;
 while(cursor<rest.length){
  const tail=rest.slice(cursor);if(/^\s*(?:;|#|$)/.test(tail))break;
  const index=tail.match(/^\[-?\d+\]/);
  if(index){cursor+=index[0].length;if(type==='Array'&&element){type=element;element=null;uncertain=true;consumed=base.length+cursor;continue}uncertain=true;unknown=true;break}
  const match=tail.match(step);if(!match){uncertain=true;unknown=true;break}
  if(type==='Array' && element && (match[1]==='first'||match[1]==='last') && (!match[0].includes('(')||/\(\s*\)$/.test(match[0]))){
   type=element;element=null;uncertain=true;cursor+=match[0].length;consumed=base.length+cursor;continue;
  }
  const next=tables[language]?.[type]?.[match[1]];
  cursor+=match[0].length;
  if(!next){uncertain=true;unknown=true;continue}
  if(language==='ruby' && type==='String' && next==='Array')element=['chars','lines','split'].includes(match[1])?'String':null;
  else if(next!=='Array')element=null;
  type=next;consumed=base.length+cursor;
 }
 return {type,element,known:text.slice(0,consumed),uncertain,unknown};
}
export function inferVariables(source,caret=source.length,language='ruby'){
 const vars=new Map();
 Object.defineProperty(vars,'elements',{value:new Map()});
 Object.defineProperty(vars,'tentative',{value:new Set()});
 const lines=[];let current='',quote='',escaped=false;
 for(const char of source.slice(0,caret)){
  if(quote){current+=char;if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue}
  if(char==='"'||char==="'"){quote=char;current+=char;continue}
  if(char==='\n'||char===';'||((language==='rust'||language==='cpp')&&(char==='{'||char==='}'))){lines.push(current);current='';continue}
  current+=char;
 }
 lines.push(current);
 for(const line of lines){
  if(language==='ruby'){
   const loop=line.match(/^\s*for\s+([A-Za-z_]\w*)\s+in\s+(.+?)\s*(?:do\s*)?$/);
   if(loop){const iterable=inferExpression(loop[2],vars,language);if(iterable?.element)vars.set(loop[1],iterable.element);else vars.delete(loop[1]);continue}
   const mutation=line.match(/^\s*([A-Za-z_]\w*)\s*(?:<<|\[[^\]]*\]\s*=|\.(?:push|append|unshift|concat|insert|replace|fill|map!|collect!)(?=[^A-Za-z0-9_]|$))/);
   if(mutation)vars.elements.delete(mutation[1]);
  }
  const cpp=language==='cpp'&&line.match(/^\s*(?:const\s+)?(?:std::)?(string|vector\s*<[^>]+>)\s+([A-Za-z_]\w*)\s*(?:=(?!=)\s*(.*))?$/);
  if(cpp){vars.set(cpp[2],cpp[1]==='string'?'CppString':'CppVector');continue}
  const match=line.match(/^\s*(?:(?:let|const|var|auto)\s+(?:mut\s+)?)?([A-Za-z_]\w*)\s*(?::\s*[^=]+)?\s*=(?!=)\s*(.*)$/);
  if(!match)continue;
  const result=inferExpression(match[2],vars,language);
  // Unknown reassignment must not retain an earlier, potentially wrong type.
  if(result && !result.unknown){vars.set(match[1],result.type);if(result.element)vars.elements.set(match[1],result.element);else vars.elements.delete(match[1]);if(result.uncertain)vars.tentative.add(match[1]);else vars.tentative.delete(match[1])}else {vars.delete(match[1]);vars.elements.delete(match[1]);vars.tentative.delete(match[1])}
 }
 return vars;
}
export function inferContext(source,caret,language,receiver,chain=[]){
 const vars=inferVariables(source,caret,language);
 const expr=receiver+chain.map(name=>name.startsWith('[')?name:'.'+name).join('');
 return inferExpression(expr,vars,language);
}
export function inferCurrent(source,caret,language){
 const before=source.slice(0,caret);let start=0,quote='',escaped=false;
 for(let i=0;i<before.length;i++){
  const char=before[i];
  if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue}
  if(char==='"'||char==="'"){quote=char;continue}
  if(char==='\n'||char===';'||((language==='rust'||language==='cpp')&&(char==='{'||char==='}')))start=i+1;
 }
 const line=before.slice(start),previous=before.slice(0,start);
 if(language==='cpp'){
  const typed=line.match(/^\s*(?:const\s+)?(?:std::)?(string|vector\s*<[^>]+>)\s+([A-Za-z_]\w*)\b/);
  if(typed)return {type:typed[1]==='string'?'CppString':'CppVector',label:typed[2],known:typed[2],uncertain:false,unknown:false};
 }
 const assignment=line.match(/^\s*(?:(?:let|const|var|auto)\s+(?:mut\s+)?)?([A-Za-z_]\w*)\s*(?::\s*[^=]+)?\s*=(?!=)\s*(.*)$/);
 if(assignment){const vars=inferVariables(previous,undefined,language);const result=inferExpression(assignment[2],vars,language);return result?{...result,label:assignment[1]+(result.known?` = ${result.known}`:'')}:null}
 const expression=language==='ruby'?line.replace(/^\s*(?:p|puts|print)\s+/, ''):line;
 const result=inferExpression(expression,inferVariables(previous,undefined,language),language);
 return result?{...result,label:result.known}:null;
}
