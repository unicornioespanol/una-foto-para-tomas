let csrf;
export async function api(path,options={}){
  if(!csrf){const r=await fetch('/api/csrf');if(!r.ok)throw new Error('Servidor no disponible');csrf=(await r.json()).csrf}
  const r=await fetch(path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,...options.headers}});
  if(!r.ok){const error=new Error(r.status===401?'Inicia sesión de nuevo.':'No se pudo completar la solicitud.');error.status=r.status;throw error}
  return r;
}
