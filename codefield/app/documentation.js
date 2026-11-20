// Official references are loaded only when a learner requests a method.
export function documentationUrl(language, type, method, owner) {
  if (language === 'python') return 'https://docs.python.org/3/';
  if (language === 'csharp') return 'https://learn.microsoft.com/en-us/dotnet/csharp/';
  if (language === 'ruby') {
    const klass = /^[A-Z]\w*(?:::[A-Z]\w*)*$/.test(owner || type || '') ? (owner || type).replaceAll('::', '/') : null;
    if (!klass) return 'https://docs.ruby-lang.org/en/4.0/';
    const anchor = [...method].map(c => /[A-Za-z0-9_]/.test(c) ? c : `-${c.codePointAt(0).toString(16).toUpperCase()}`).join('');
    return `https://docs.ruby-lang.org/en/4.0/${klass}.html#method-i-${anchor}`;
  }
  if (language === 'rust') {
    const page = {Vec:'vec/struct.Vec',String:'string/struct.String',Iterator:'iter/trait.Iterator',Array:'primitive.slice','&str':'primitive.str'}[type];
    return page ? `https://doc.rust-lang.org/std/${page}.html#method.${encodeURIComponent(method)}` : 'https://doc.rust-lang.org/std/';
  }
  if (language === 'cpp') {
    const page = type === 'CppVector' ? 'container/vector' : type === 'CppString' ? 'string/basic_string' : null;
    return page ? `https://en.cppreference.com/w/cpp/${page}/${encodeURIComponent(method)}` : 'https://en.cppreference.com/w/cpp/';
  }
  const page = {String:'String',Array:'Array',number:'Number',Number:'Number',Object:'Object'}[type];
  return page ? `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/${page}/${encodeURIComponent(method)}` : 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference';
}
