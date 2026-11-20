import {loadPyodide} from 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs';
let output=[],errors=[];
try {
 const python=await loadPyodide({stdout:line=>output.push(line),stderr:line=>errors.push(line)});
 self.onmessage=async ({data})=>{
  if(data.type==='complete'){self.postMessage({type:'completion',id:data.id,methods:[]});return}
  output=[];errors=[];
  try {const value=await python.runPythonAsync(data.code);self.postMessage({type:'result',result:{ok:true,output:output.join('\n'),stderr:errors.join('\n'),value:value==null?'':String(value),methods:[]}});if(value?.destroy)value.destroy()}
  catch(error){self.postMessage({type:'result',result:{ok:false,output:output.join('\n'),stderr:errors.join('\n'),error:String(error.message||error)}})}
 };
 self.postMessage({type:'ready'});
} catch(error){self.postMessage({type:'failure',error:String(error)})}
