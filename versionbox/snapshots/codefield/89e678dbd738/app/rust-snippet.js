// A complete main is sent unchanged; snippet mode supplies a visible wrapper.
export function rustProgram(source,wrap=true){
 const wrapped=wrap&&!/^\s*(?:pub\s+)?(?:async\s+)?fn\s+main\s*\(/m.test(source);
 return {wrapped,code:wrapped?`fn main() {\n${source}\n}`:source};
}
