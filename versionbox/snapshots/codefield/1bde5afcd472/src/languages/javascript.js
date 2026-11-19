const tokenPattern = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|of|in|new|class|this|true|false|null|undefined|async|await|throw|try|catch|import|export)\b|\b\d+(?:\.\d+)?\b/g;
export function tokenizeJavaScript(source) {
  const tokens=[]; let cursor=0;
  for (const match of source.matchAll(tokenPattern)) {
    if(match.index>cursor)tokens.push({text:source.slice(cursor,match.index)});
    const text=match[0];
    const type=text.startsWith('/')?'comment':/["'`]/.test(text[0])?'string':/\d/.test(text[0])?'number':'keyword';
    tokens.push({text,type}); cursor=match.index+text.length;
  }
  if(cursor<source.length)tokens.push({text:source.slice(cursor)});
  return tokens;
}
