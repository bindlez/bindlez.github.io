const geminiBase = 'https://generativelanguage.googleapis.com/v1beta';
export const providerBases = {
  openai: 'http://127.0.0.1:47831/v1',
  remote: '',
  ollama: 'http://127.0.0.1:11434',
  gemini: geminiBase
};

function serverBase(raw, provider) {
  if (provider === 'gemini') return geminiBase;
  if (!Object.hasOwn(providerBases, provider)) throw Error('Choose a supported provider.');
  if (!raw?.trim()) throw Error('Enter the Address for other devices shown in Strata.');
  const url = new URL(raw.trim());
  if (url.username || url.password || url.search || url.hash) throw Error('Use a base address without credentials, query or fragment.');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const privateIPv4 = /^(?:10\.\d+|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d+\.\d+$/.test(url.hostname);
  const permittedHTTP = local || (provider === 'remote' && privateIPv4);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && permittedHTTP)) throw Error('Use HTTPS, localhost, or the private IPv4 address shown by the second PC.');
  return url.href.replace(/\/+$/, '');
}

export function aiEndpoint(raw, provider, model) {
  const base = serverBase(raw, provider);
  if (provider === 'gemini') return base + '/models/' + encodeURIComponent(model) + ':generateContent';
  return base + (provider === 'ollama' ? '/api/chat' : '/chat/completions');
}

function auth(provider, key) {
  if (provider === 'gemini') {
    if (!key?.trim()) throw Error('Enter your Gemini API key.');
    return {'x-goog-api-key': key.trim()};
  }
  return ['openai','remote'].includes(provider) && key?.trim() ? {Authorization: 'Bearer ' + key.trim()} : {};
}

async function request(url, init) {
  let response;
  try {
    response = await fetch(url, {...init, redirect:'error', credentials:'omit', cache:'no-store'});
  } catch (error) {
    if (init.signal?.aborted) throw Error('Request timed out or was cancelled.');
    throw Error('Connection failed. Check that the server is running on this computer, allow local network access in the browser, or use the local bridge below.');
  }
  if ([401,403].includes(response.status)) throw Error('Access denied. Check the API key and allowed browser origin.');
  if (!response.ok) throw Error('Model server returned HTTP ' + response.status + '.');
  return response.json();
}

export async function listModels({provider, base, key, signal}) {
  const root = serverBase(base, provider);
  const path = provider === 'ollama' ? '/api/tags' : '/models';
  const data = await request(root + path, {headers:auth(provider,key), signal});
  let ids;
  if (provider === 'gemini') {
    ids = (data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name) && !/image|audio|tts|robotics/i.test(m.name)).map(m => m.name.replace(/^models\//,''));
    ids.sort((a,b) => Number(/flash/.test(b))-Number(/flash/.test(a)));
  } else if (provider === 'ollama') {
    ids = (data.models || []).map(m => m.name);
  } else {
    ids = (data.data || []).map(m => m.id);
  }
  const models = [...new Set(ids.filter(id => typeof id === 'string' && id.trim() && !/embed/i.test(id)))];
  if (!models.length) throw Error('No chat models found. Load a model on your server and refresh.');
  return models;
}

export async function askModel(options) {
  const {provider, base, key, messages, signal} = options;
  const model = options.model?.trim() || (await listModels(options))[0];
  let body = {model, messages, stream:false};
  if (provider === 'ollama') body.think = false;
  if (provider === 'gemini') {
    body = {
      systemInstruction:{parts:messages.filter(m => m.role === 'system').map(m => ({text:m.content}))},
      contents:messages.filter(m => m.role !== 'system').map(m => ({role:m.role === 'assistant' ? 'model' : 'user', parts:[{text:m.content}]}))
    };
  }
  const data = await request(aiEndpoint(base,provider,model), {
    method:'POST', signal, headers:{...auth(provider,key), 'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  const answer = provider === 'gemini' ? data.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text).join('') :
    provider === 'ollama' ? data.message?.content : data.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) throw Error('The model returned no text.');
  return answer.trim();
}
