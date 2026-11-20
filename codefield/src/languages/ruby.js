// Lightweight, best-effort highlighting; never evaluates the user's code.
import {completionContext} from '../completion.js';
import {inferContext} from '../inference.js';
const tokenPattern = /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:class|module|def|end|do|if|else|elsif|unless|while|until|for|in|return|yield|require|begin|rescue|ensure|case|when|then|true|false|nil|self|and|or|not)\b|\b\d+(?:\.\d+)?\b|:[a-zA-Z_]\w*[!?]?|\.[a-zA-Z_]\w*[!?]?/g;
export function tokenizeRuby(source) {
  const tokens = [];
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    if (match.index > cursor) tokens.push({ text: source.slice(cursor, match.index) });
    const text = match[0];
    if(text[0]==='.'){
      const context=completionContext(source,match.index+1);
      const inferred=context&&inferContext(source,match.index,'ruby',context.receiver,context.chain);
      let kind=context?.blockResult?'array':({String:'string',Array:'array',Hash:'hash',Integer:'integer',Float:'integer',Enumerator:'enumerator'})[inferred?.type]||'generic';
      tokens.push({text:'.'},{text:text.slice(1),type:`method-${kind}`});cursor=match.index+text.length;continue;
    }
    const type = text[0] === '#' ? 'comment' : /["']/.test(text[0]) ? 'string' : /\d/.test(text[0]) ? 'number' : text[0] === ':' ? 'symbol' : 'keyword';
    tokens.push({ text, type });
    cursor = match.index + text.length;
  }
  if (cursor < source.length) tokens.push({ text: source.slice(cursor) });
  return tokens;
}
