import { nextLineIndent } from './indent.js';
import { completionContext } from './completion.js';

/** A small native-input editor. Language tokenizers are supplied separately. */
export function createEditor(target, options = {}) {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(container instanceof HTMLElement)) throw new Error('Editor target not found');
  const root = document.createElement('div');
  root.className = 'code-editor';
  const gutter = document.createElement('pre');
  gutter.className = 'code-gutter';
  gutter.setAttribute('aria-hidden', 'true');
  root.append(gutter);
  const input = document.createElement('textarea');
  input.className = 'code-input';
  input.setAttribute('aria-label', options.label || 'Code editor');
  input.spellcheck = false;
  input.autocapitalize = 'off';
  input.autocomplete = 'off';
  input.wrap = 'off';
  input.value = options.value ?? '';
  let display;
  if (options.tokenize) {
    root.classList.add('code-editor--highlighted');
    display = document.createElement('pre');
    display.className = 'code-highlight';
    display.setAttribute('aria-hidden', 'true');
    root.append(display);
  }
  root.append(input);
  container.append(root);
  let completion, completionItems = [], completionIndex = 0, completionRequest = 0, completionTimer, selectionTimer;
  if (options.complete) {
    completion = document.createElement('div');
    completion.className = 'code-completions';
    completion.hidden = true;
    completion.setAttribute('role', 'listbox');
    completion.setAttribute('aria-label', 'Method suggestions');
    completion.id = `code-completions-${Math.random().toString(36).slice(2)}`;
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', completion.id);
    input.setAttribute('aria-expanded', 'false');
    container.append(completion);
  }
  const closeCompletion = () => {
    completionRequest++;
    clearTimeout(completionTimer);
    if (!completion) return;
    completion.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };
  const paintCompletion = () => {
    completion.replaceChildren();
    completionItems.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'code-completion' + (index === completionIndex ? ' selected' : '');
      row.id = `${completion.id}-${index}`;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(index === completionIndex));
      const name = document.createElement('span'); name.textContent = item.display || item.label;
      const detail = document.createElement('small'); detail.textContent = item.detail || 'method';
      row.append(name, detail);
      row.addEventListener('mousedown', event => { event.preventDefault(); completionIndex = index; acceptCompletion(); });
      completion.append(row);
    });
    input.setAttribute('aria-activedescendant', `${completion.id}-${completionIndex}`);
    const selected = completion.children[completionIndex];
    if (selected.offsetTop < completion.scrollTop) completion.scrollTop = selected.offsetTop;
    else if (selected.offsetTop + selected.offsetHeight > completion.scrollTop + completion.clientHeight) completion.scrollTop = selected.offsetTop + selected.offsetHeight - completion.clientHeight;
    options.onCompletionHighlight?.(completionItems[completionIndex]);
  };
  const acceptCompletion = () => {
    const item = completionItems[completionIndex];
    if (!item) return;
    input.setSelectionRange(item.from, input.selectionStart);
    const start=item.from;
    insertText(item.insert || item.label);
    if(item.cursorOffset !== undefined) input.setSelectionRange(start+item.cursorOffset,start+item.cursorOffset);
    closeCompletion(); input.focus();
  };
  const requestCompletion = () => {
    if (!completion || input.selectionStart !== input.selectionEnd) { closeCompletion(); return; }
    const context = completionContext(input.value, input.selectionStart);
    if (!context) { closeCompletion(); return; }
    const { receiver, chain, prefix } = context, caret = input.selectionStart;
    const request = ++completionRequest;
    clearTimeout(completionTimer);
    completionTimer = setTimeout(async () => {
      try {
        const items = await options.complete(context);
        if (request !== completionRequest || input.selectionStart !== caret || document.activeElement !== input) return;
        completionItems = (items || []).filter(item => item.label.startsWith(prefix)).map(item => ({...item, from:caret-prefix.length}));
        if (!completionItems.length) { closeCompletion(); return; }
        completionIndex = 0; completion.hidden = false; input.setAttribute('aria-expanded','true'); paintCompletion();
      } catch { if (request === completionRequest) closeCompletion(); }
    }, 120);
  };
  const render = () => {
    const lineCount = input.value.split('\n').length;
    gutter.textContent = Array.from({length: lineCount}, (_, i) => i + 1).join('\n');
    gutter.scrollTop = input.scrollTop;
    if (!display) return;
    const fragment = document.createDocumentFragment();
    for (const token of options.tokenize(input.value)) {
      if (token.type && /^[a-z-]+$/.test(token.type)) {
        const span = document.createElement('span');
        span.className = `code-token-${token.type}`;
        span.textContent = token.text;
        fragment.append(span);
      } else fragment.append(document.createTextNode(token.text));
    }
    // Preserve the final empty line in the visual layer.
    fragment.append(document.createTextNode('\n'));
    display.replaceChildren(fragment);
    display.scrollTop = input.scrollTop;
    display.scrollLeft = input.scrollLeft;
  };
  // insertText uses the browser's editing history when supported, preserving undo.
  const insertText = text => {
    if (!document.execCommand('insertText', false, text)) {
      input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
      input.dispatchEvent(new Event('input', {bubbles:true}));
    }
  };
  const onInput = () => { render(); options.onChange?.(input.value,{caret:input.selectionStart}); requestCompletion(); };
  const onScroll = () => { gutter.scrollTop=input.scrollTop; if (display) { display.scrollTop = input.scrollTop; display.scrollLeft = input.scrollLeft; } };
  const notifySelection = (value, start) => {
    const before = input.value.slice(0, start);
    const parent = before.endsWith('.') ? completionContext(before) : null;
    options.onSelection(value, parent);
  };
  const onSelect = () => {
    clearTimeout(selectionTimer);
    if (!options.onSelection || input.selectionStart === input.selectionEnd) return;
    const start=input.selectionStart, value = input.value.slice(start, input.selectionEnd);
    selectionTimer = setTimeout(() => notifySelection(value, start), 180);
  };
  const onClick = () => {
    closeCompletion();
    if (!options.onSelection || input.selectionStart !== input.selectionEnd) return;
    const at = input.selectionStart, source = input.value;
    let start=at, end=at;
    while(start>0 && /[A-Za-z0-9_$]/.test(source[start-1])) start--;
    while(end<source.length && /[A-Za-z0-9_$!?]/.test(source[end])) end++;
    if(end>start) { clearTimeout(selectionTimer); const value=source.slice(start,end); selectionTimer=setTimeout(()=>notifySelection(value,start),180); }
  };
  // Opt in: preserve indentation on Enter. Tab remains available for keyboard navigation.
  const onKeyDown = event => {
    if (event.isComposing) return;
    if (completion && !completion.hidden) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); completionIndex = (completionIndex + (event.key === 'ArrowDown' ? 1 : -1) + completionItems.length) % completionItems.length; paintCompletion(); return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.ctrlKey && !event.metaKey) { event.preventDefault(); acceptCompletion(); return; }
      if (event.key === 'Escape') { event.preventDefault(); closeCompletion(); return; }
    }
    if ((event.ctrlKey || event.metaKey) && event.key === ']') {
      event.preventDefault(); insertText('  '); return;
    }
    if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && options.autoClose !== false) {
      const pairs = {'(':')','[':']','{':'}','"':'"',"'":"'"};
      if (input.selectionStart === input.selectionEnd && /[)\]}"']/.test(event.key) && input.value[input.selectionStart] === event.key) {
        event.preventDefault(); input.setSelectionRange(input.selectionStart+1,input.selectionStart+1); return;
      }
      if (pairs[event.key] && input.selectionStart !== input.selectionEnd) {
        event.preventDefault(); const selected=input.value.slice(input.selectionStart,input.selectionEnd); insertText(event.key+selected+pairs[event.key]); return;
      }
      if (pairs[event.key] && input.selectionStart === input.selectionEnd) {
        event.preventDefault(); const at=input.selectionStart; insertText(event.key+pairs[event.key]); input.setSelectionRange(at+1,at+1); return;
      }
    }
    if (!options.autoIndent || event.key !== 'Enter' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const indent = nextLineIndent(input.value, input.selectionStart);
    if (!indent) return;
    event.preventDefault();
    insertText('\n' + indent);
  };
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('input', onInput);
  input.addEventListener('scroll', onScroll);
  input.addEventListener('blur', closeCompletion);
  input.addEventListener('click', onClick);
  input.addEventListener('select', onSelect);
  render();
  return {
    getValue: () => input.value,
    getSelection: () => input.value.slice(input.selectionStart,input.selectionEnd),
    getCaret: () => input.selectionStart,
    setValue(value) { closeCompletion(); input.value = String(value); render(); options.onSetValue?.(input.value); },
    focus: () => input.focus(),
    find(text, backwards = false) {
      if (!text) return false;
      const source=input.value.toLocaleLowerCase(), query=text.toLocaleLowerCase();
      let index = backwards ? source.lastIndexOf(query, Math.max(0,input.selectionStart-1)) : source.indexOf(query,input.selectionEnd);
      if(index<0) index=backwards ? source.lastIndexOf(query) : source.indexOf(query);
      if(index<0)return false;
      input.focus(); input.setSelectionRange(index,index+text.length); return true;
    },
    insert(text) { input.focus(); insertText(String(text)); },
    destroy() { closeCompletion(); clearTimeout(selectionTimer); input.removeEventListener('keydown', onKeyDown); input.removeEventListener('input', onInput); input.removeEventListener('scroll', onScroll); input.removeEventListener('blur', closeCompletion); input.removeEventListener('click', onClick); input.removeEventListener('select', onSelect); root.remove(); completion?.remove(); }
  };
}

