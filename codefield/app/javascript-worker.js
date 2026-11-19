// JavaScript sessions use a persistent worker. Use var or globalThis for persistent bindings.
self.onmessage = event => {
  if (event.data.type === 'complete') {
    // Parenthesized JavaScript calls need semantic analysis; do not guess.
    if (event.data.chain?.length && !event.data.staticType) { self.postMessage({type:'completion',id:event.data.id,methods:[]}); return; }
    let value;
    const receiver = event.data.receiver;
    if (event.data.staticType === 'String') value = '';
    else if (event.data.staticType === 'Array') value = [];
    else if (/^["']/.test(receiver)) value = '';
    else if (receiver.startsWith('[')) value = [];
    else {
      const descriptor = Object.getOwnPropertyDescriptor(self, receiver);
      if (descriptor && 'value' in descriptor) value = descriptor.value;
    }
    const methods = new Set();
    try { for (let current = value == null ? null : Object(value); current; current = Object.getPrototypeOf(current)) for (const key of Object.getOwnPropertyNames(current)) methods.add(key); } catch {}
    const receiverType = value == null ? null : Array.isArray(value) ? 'Array' : typeof value === 'string' ? 'String' : typeof value;
    self.postMessage({type:'completion',id:event.data.id,methods:[...methods].sort(),receiverType});
    return;
  }
  const lines=[];
  const format = v => {if(typeof v==='string') return v;if(v===undefined)return 'undefined';try{return JSON.stringify(v,null,2) ?? String(v)}catch{return String(v)}};
  const old=console.log; console.log=(...args)=>{lines.push(args.map(format).join(' '));};
  try { const value=(0,eval)(event.data.code); self.postMessage({type:'result',result:{ok:true,value:format(value),type:value===null?'null':typeof value,output:lines.join('\n'),methods:value == null?[]:Object.getOwnPropertyNames(Object.getPrototypeOf(value)).sort()}}); }
  catch(error){self.postMessage({type:'result',result:{ok:false,error:`${error.name}: ${error.message}`,output:lines.join('\n')}})} finally {console.log=old}
};
self.postMessage({type:'ready'});
