// Runs user-authored JavaScript in a disposable worker. A worker is not a security sandbox.
self.onmessage = event => {
  const lines = [];
  const format = value => { if (typeof value === 'string') return value; if (value === undefined) return 'undefined'; try { return JSON.stringify(value, null, 2) ?? String(value); } catch { return String(value); } };
  const original = console.log;
  console.log = (...values) => lines.push(values.map(format).join(' '));
  try {
    const result = (0, eval)(event.data);
    if (result !== undefined) lines.push('=> ' + format(result));
    self.postMessage({ok:true, text:lines.join('\n') || '(no output)'});
  } catch (error) {
    self.postMessage({ok:false, text:[...lines, `${error.name}: ${error.message}`].join('\n')});
  } finally { console.log = original; }
};
