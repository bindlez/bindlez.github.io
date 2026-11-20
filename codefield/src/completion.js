// Parse the shape of a chain only; neither the receiver nor its arguments are run.
export function completionContext(source, caret = source.length, strict = false) {
  const before = source.slice(0, caret);
  // Recognize a simple multiline Ruby map block whose result is followed by a
  // dot. Nested blocks are deliberately excluded rather than guessed.
  if (!strict) {
    const block = before.match(/(?:^|\n)[ \t]*([^\n]+\.map)[ \t]+do(?:[ \t]*\|[^|\n]*\|)?[ \t]*\n((?:(?![ \t]*(?:end|do)\b)[^\n]*\n)*)[ \t]*end\.([a-zA-Z_]\w*[!?=]?)?$/);
    if (block && !/\b(?:do|end)\b/.test(block[2])) {
      const parent = completionContext(block[1]+'.');
      if (parent) return {...parent,prefix:block[3]||'',blockResult:true};
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
