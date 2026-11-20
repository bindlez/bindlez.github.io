// Parse the shape of a chain only; neither the receiver nor its arguments are run.
export function completionContext(source, caret = source.length, strict = false) {
  const before = source.slice(0, caret);
  // Resolve a completed Ruby block back to the expression that opened it.
  // The remaining chain is parsed by the same completion logic as a single line.
  if (!strict) {
    const block = before.match(/(?:^|\n)[ \t]*([^\n]+\.(?:map|collect|each|each_cons|select|filter|reject))[ \t]+do(?:[ \t]*\|[^|\n]*\|)?[ \t]*\n((?:(?![ \t]*(?:end|do)\b)[^\n]*\n)*)[ \t]*end((?:\.[a-zA-Z_]\w*[!?]?(?:\([^()\n]*\))?)*)\.([a-zA-Z_]\w*[!?=]?)?$/);
    if (block && !/\b(?:do|end)\b/.test(block[2])) {
      const parent = completionContext(block[1] + block[3] + '.');
      if (parent) return {...parent, prefix:block[4] || '', blockResult:true, blockMethod:block[1].match(/\.([a-z_]+)$/)[1]};
    }
  }
  const match = before.match(/(?:^|[\s=(,;])((?:String::from\(\s*"(?:\\.|[^"\\])*"\s*\))|(?:vec!\[[^\]\n]*\])|\d+(?:\.\d+)?|[a-zA-Z_$][\w$]*|\[[^\[\]\n]*\]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')((?:(?:\.[a-zA-Z_]\w*[!?]?(?:\((?:[^()"'\n]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\))?)|(?:\[-?\d+\]))*)\.([a-zA-Z_]\w*[!?=]?)?$/);
  if (!match || (strict && match.index !== 0)) return null;
  const chain = Array.from(match[2].matchAll(/\.([a-zA-Z_]\w*[!?]?)(?:\((?:[^()"'\n]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\))?|(?:(\[-?\d+\]))/g), step => step[1] || step[2]);
  return {receiver:match[1], chain, prefix:match[3] || ''};
}
export function selectionContext(selection) {
  const text = selection.trim();
  if (!text || /\n/.test(text)) return null;
  // Reject unrelated surrounding code instead of silently inspecting a suffix.
  return completionContext(text + '.', text.length + 1, true);
}
