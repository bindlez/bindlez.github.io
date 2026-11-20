/** Preserve the current line's leading whitespace on the next line. */
export function nextLineIndent(value, cursor) {
  const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
  const beforeCursor = value.slice(lineStart, cursor);
  return (beforeCursor.match(/^[\t ]*/) || [''])[0];
}
