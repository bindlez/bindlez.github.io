// Network requests occur only after an explicit user action. Secrets stay in memory.
export function aiEndpoint(raw,provider){
 const url=new URL(raw.trim());
 if(url.username||url.password)throw Error('Remove credentials from the address.');
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw Error('Use HTTPS, or HTTP on this computer (localhost).');
 const prefix=url.pathname.replace(/\/+$/,'');
 return url.origin+prefix+(provider==='ollama'?'/api/chat':'/chat/completions');
}
export async function askModel({provider,base,model,key,messages,signal}){
 if(!model.trim())throw Error('Enter a model name.');
 const endpoint=aiEndpoint(base,provider);
 const headers={'Content-Type':'application/json'};if(provider==='openai'&&key)headers.Authorization=`Bearer ${key}`;
 const body=provider==='ollama'?{model:model.trim(),stream:false,think:false,messages}:{model:model.trim(),stream:false,messages};
 const response=await fetch(endpoint,{method:'POST',headers,signal,body:JSON.stringify(body)});
 if(!response.ok)throw Error(`Model server returned HTTP ${response.status}.`);
 const data=await response.json();const answer=provider==='ollama'?data.message?.content:data.choices?.[0]?.message?.content;
 if(typeof answer!=='string'||!answer.trim())throw Error('The model returned no text.');
 return answer.trim();
}
