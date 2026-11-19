// A deliberately small Ruby tokenizer. Complex Ruby syntax is not yet fully supported.
const tokenPattern = /#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:class|module|def|end|do|if|else|elsif|unless|while|until|for|in|return|yield|require|begin|rescue|ensure|case|when|then|true|false|nil|self|and|or|not)\b|\b\d+(?:\.\d+)?\b|:[a-zA-Z_]\w*[!?]?/g;
export function tokenizeRuby(source) {
  const tokens = [];
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    if (match.index > cursor) tokens.push({ text: source.slice(cursor, match.index) });
    const text = match[0];
    const type = text[0] === '#' ? 'comment' : /["']/.test(text[0]) ? 'string' : /\d/.test(text[0]) ? 'number' : text[0] === ':' ? 'symbol' : 'keyword';
    tokens.push({ text, type });
    cursor = match.index + text.length;
  }
  if (cursor < source.length) tokens.push({ text: source.slice(cursor) });
  return tokens;
}
