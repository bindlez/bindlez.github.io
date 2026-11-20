// Lightweight lexical overview, not a parser or semantic analysis.
const keywords=new Set('if else for while do end def class module return let mut fn pub use impl struct enum const var function new true false nil null None Some match loop in async await import from int string auto std void include using namespace'.split(' '));
export function codeInsights(source){
 const counts={Identifiers:0,Methods:0,Keywords:0,Literals:0,Operators:0,Comments:0};
 const token=/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|[+*/%=!<>|&^~-]+)/g;
 for(const m of source.matchAll(token)){const t=m[0];if(/^(?:\/\/|#|\/\*)/.test(t))counts.Comments++;else if(/^["'\d]/.test(t))counts.Literals++;else if(/^[A-Za-z_$]/.test(t))counts[keywords.has(t)?'Keywords':/\.\s*$/.test(source.slice(Math.max(0,m.index-64),m.index))?'Methods':'Identifiers']++;else counts.Operators++}
 const variables=[...new Set([...source.matchAll(/\b(?:let\s+(?:mut\s+)?|var\s+|const\s+|auto\s+|(?:std::)?string\s+)?([A-Za-z_]\w*)\s*=(?!=)/g)].map(m=>m[1]))].slice(0,30);
 const methods=[...new Set([...source.matchAll(/\.\s*([A-Za-z_]\w*[!?]?)/g)].map(m=>m[1]))].slice(0,30);
 return {counts,variables,methods,total:Object.values(counts).reduce((a,b)=>a+b,0)};
}
