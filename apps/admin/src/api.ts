import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({defaultOptions:{queries:{retry:1,staleTime:15000,refetchOnWindowFocus:false},mutations:{retry:false}}});
let token = sessionStorage.getItem('lagani.session.v1');
export function setToken(value:string|null){token=value;if(value)sessionStorage.setItem('lagani.session.v1',value);else sessionStorage.removeItem('lagani.session.v1');queryClient.clear();}
export function hasToken(){return Boolean(token);}
export async function privateDownload(path:string){const r=await fetch(path,{headers:token?{Authorization:`Bearer ${token}`}:{}});if(!r.ok)throw new Error('This private document link is unavailable or expired. Request a fresh link.');return r.blob();}
export function upload<T>(path:string,body:unknown,onProgress:(percent:number)=>void):Promise<T>{return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',`/api${path}`);xhr.setRequestHeader('Content-Type','application/json');if(token)xhr.setRequestHeader('Authorization',`Bearer ${token}`);xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};xhr.onerror=()=>reject(new Error('Upload interrupted. Please retry.'));xhr.onload=()=>{try{const result=JSON.parse(xhr.responseText);if(xhr.status>=200&&xhr.status<300)resolve(result);else reject(new Error(result.message||'Upload rejected.'));}catch{reject(new Error('Unexpected upload response.'));}};xhr.send(JSON.stringify(body));});}
export class ApiError extends Error { status:number; constructor(message:string,status:number){super(message);this.status=status;} }
export async function api<T>(path:string,method='GET',body?:unknown):Promise<T>{
  let response:Response;
  try{response=await fetch(`/api${path}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{throw new ApiError(method==='GET'?'Unable to reach Lagani. Check your connection and try again.':'Connection interrupted. Check Activity before retrying this action; its outcome may still be processing.',0);}
  const data=await response.json().catch(()=>({message:'The server returned an unexpected response.'}));
  if(!response.ok){if(response.status===401)window.dispatchEvent(new Event('lagani:session-expired'));throw new ApiError(Array.isArray(data.message)?data.message.join(' '):data.message||data.error?.message||'This action could not be completed.',response.status);}
  return data as T;
}
export function money(paisa:string|undefined,compact=false){if(paisa===undefined)return '—';try{const value=BigInt(paisa);const negative=value<0n;const abs=negative?-value:value;const rupees=abs/100n;const fraction=abs%100n;if(compact&&rupees>=10000000n)return `NPR ${Number(rupees/100000n)/100} cr`;if(compact&&rupees>=100000n)return `NPR ${Number(rupees/1000n)/100} lakh`;return `${negative?'−':''}NPR ${rupees.toLocaleString('en-IN')}${fraction?`.${fraction.toString().padStart(2,'0')}`:''}`;}catch{return '—';}}
export function toPaisa(value:string){if(!/^\d+(\.\d{1,2})?$/.test(value))throw new Error('Enter a valid NPR amount with up to two decimal places.');const [whole,decimal='']=value.split('.');return (BigInt(whole)*100n+BigInt(decimal.padEnd(2,'0'))).toString();}
export function date(value:string|undefined){if(!value)return '—';return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kathmandu'}).format(new Date(value));}
export function words(value:string){return value.replace(/[-_]/g,' ').replace(/^./,x=>x.toUpperCase());}
export function ratio(n:string,d:string){try{return Number(BigInt(n)*10000n/BigInt(d))/100;}catch{return 0;}}
