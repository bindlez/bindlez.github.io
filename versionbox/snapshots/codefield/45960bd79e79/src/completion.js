// Parse the shape of a chain only; neither the receiver nor its arguments are run.
export function completionContext(source, caret = source.length, strict = false) {
  const before = source.slice(0, caret);
  const match = before.match(/(?:^|[\s=(,;])((?:String::from\(\s*"(?:\\.|[^"\\])*"\s*\))|(?:vec!\[[^\]\n]*\])|[a-zA-Z_$][\w$]*|\[[^\[\]\n]*\]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')((?:(?:\.[a-zA-Z_]\w*[!?]?(?:\((?:[^()"'\n]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\))?)|(?:\[-?\d+\]))*)\.([a-zA-Z_]\w*[!?=]?)?$/);
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
