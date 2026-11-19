import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
const base = 'http://localhost:8080'
async function user(request: APIRequestContext, label: string) {
 const username=label+crypto.randomUUID().replaceAll('-','').slice(0,10)
 const response=await request.post(base+'/auth/register',{data:{email:username+'@example.com',username,password:'password123',name:label}})
 expect(response.status()).toBe(201);const body=await response.json()
 const u={token:body.token as string,id:body.user.user_id as string,username}
 await action(request,u.token,{type:'setLocation',location:{status:'manual',center:{lat:19.432,lng:-99.134}}})
 return u
}
async function action(request: APIRequestContext,token: string,body: Record<string,unknown>) {
 const r=await request.post(base+'/app/actions',{headers:{Authorization:'Bearer '+token},data:{...body,requestId:crypto.randomUUID()}})
 expect(r.status(),await r.text()).toBe(200);return (await r.json()).result
}
async function login(page: Page, token: string,path: string) {
 await page.addInitScript(token=>sessionStorage.setItem('friends-nearby.token',token),token)
 await page.goto(path)
 await expect(page.getByRole('button',{name:'Reintentar'})).toHaveCount(0)
}
async function friends(request: APIRequestContext,a:Awaited<ReturnType<typeof user>>,b:Awaited<ReturnType<typeof user>>) {
 expect((await request.post(base+'/friends/requests',{headers:{Authorization:'Bearer '+a.token},data:{username:b.username}})).status()).toBe(201)
 expect((await request.post(base+'/friends/'+a.id+'/accept',{headers:{Authorization:'Bearer '+b.token}})).status()).toBe(200)
}
const plan=()=>({type:'publishPlan',category:'cafe',line:'Café de integración',startsAt:new Date(Date.now()-60_000).toISOString(),durationMin:60,joinPolicy:'friends',lateJoin:true,place:{name:'Plaza del museo',center:{lat:19.434,lng:-99.134}}})
test('el anfitrión abre el encuentro desde notificaciones y cancelar no lo resucita',async({page,request})=>{
 const a=await user(request,'anfitrion'),b=await user(request,'invitado');await friends(request,a,b)
 const p=await action(request,a.token,plan());await action(request,b.token,{type:'jalo',id:p.id})
 await login(page,a.token,'/notificaciones')
 await page.getByRole('link',{name:/Abrir encuentro/}).click()
 await expect(page).toHaveURL(/\/match\//);await expect(page.getByText('Plaza del museo',{exact:true})).toBeVisible()
 await action(request,a.token,{type:'removePlan',id:p.id});await page.reload();await expect(page).not.toHaveURL(/\/match\//)
 await page.goto('/planes');await expect(page.getByText('Café de integración',{exact:true})).toHaveCount(0)
})
test('un plan de autor con ubicación manual aparece en el mapa',async({page,request})=>{
 const a=await user(request,'autor'),b=await user(request,'lector');await friends(request,a,b);await action(request,a.token,plan())
 await login(page,b.token,'/mapa')
 await expect(page.getByRole('button',{name:/plan en Plaza del museo/}).first()).toBeVisible({timeout:15000})
})
test('la asistencia sigue accesible y permite salir con modo abierto apagado',async({page,request})=>{
 const a=await user(request,'organiza'),b=await user(request,'asiste')
 for(const u of [a,b]) await action(request,u.token,{type:'setOpenMode',openMode:{enabled:true,adult:true,bigEvents:true,smallPlans:true}})
 const ev=await action(request,a.token,{type:'publishEvent',eventType:'arte',title:'Museo de integración',startsAt:new Date(Date.now()+3600000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString(),capacity:10,placeName:'Museo público',center:{lat:19.434,lng:-99.134},requiresApproval:false})
 await action(request,b.token,{type:'joinEvent',id:ev.id});await action(request,b.token,{type:'setOpenMode',openMode:{enabled:false,adult:true,bigEvents:true,smallPlans:true}})
 await login(page,b.token,'/evento/'+ev.id)
 await expect(page.getByRole('heading',{name:'Museo de integración'})).toBeVisible()
 await page.getByRole('button',{name:/Salirme/}).click()
 await expect.poll(async()=>{const r=await request.get(base+'/app/state',{headers:{Authorization:'Bearer '+b.token}});return (await r.json()).attendances.length}).toBe(0)
})
test('un fallo al refrescar conserva la escritura confirmada',async({page,request})=>{
 const a=await user(request,'sesion')
 await page.goto('/entrar');await page.getByLabel('Correo').fill(a.username+'@example.com');await page.getByLabel('Contraseña',{exact:true}).fill('password123');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page).not.toHaveURL(/entrar/)
 await page.goto('/perfil/editar');await expect(page.getByRole('heading',{name:/Editar perfil/})).toBeVisible()
 await page.route('**/app/state*',route=>route.abort())
 await page.getByLabel('Nombre',{exact:true}).fill('Nombre confirmado')
 await page.getByRole('button',{name:'Guardar nombre',exact:true}).click()
 await expect(page.getByText('Nombre actualizado',{exact:true})).toBeVisible()
 const r=await request.get(base+'/me',{headers:{Authorization:'Bearer '+a.token}})
 expect((await r.json()).display_name).toBe('Nombre confirmado')
})

test('publicar desde la interfaz conserva el lugar público elegido',async({page,request})=>{
 const a=await user(request,'publica');await login(page,a.token,'/publicar')
 await page.getByLabel('Cuéntales en una línea').fill('Plan publicado desde interfaz')
 await page.getByLabel('¿Dónde es?',{exact:true}).fill('Parque público')
 await page.getByRole('button',{name:'Elegir en el mapa',exact:true}).click()
 await page.getByRole('button',{name:'Mover 100 m al norte'}).click()
 await page.getByRole('button',{name:'Usar este lugar'}).click()
 await page.getByRole('button',{name:/^Publicar plan ·/}).click()
 await expect(page).not.toHaveURL(/publicar/)
 const r=await request.get(base+'/app/state',{headers:{Authorization:'Bearer '+a.token}});const plans=(await r.json()).plans
 expect(plans).toHaveLength(1);expect(plans[0].place.name).toBe('Parque público');expect(plans[0].place.center.lat).not.toBe(19.432)
})
