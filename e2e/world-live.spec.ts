import { test,expect } from '@playwright/test';

// Opt-in only: no account/session creation and no economic writes.
const env=process.env;
const required=['WORLD_STUDENT_EMAIL','WORLD_STUDENT_PASSWORD','WORLD_PEER_EMAIL','WORLD_PEER_PASSWORD','WORLD_SESSION_ID'];
test('two real authorized students see movement and recover a world connection',async({browser,request,baseURL})=>{
  test.skip(required.some(key=>!env[key]),`Live backend prerequisites: ${required.join(', ')}; configure API_PROXY_TARGET for Vite`);
  const contexts=await Promise.all([browser.newContext({baseURL}),browser.newContext({baseURL})]);
  try{
    const pages=await Promise.all(contexts.map(async(context,index)=>{
      const response=await request.post(`${env.API_ORIGIN??'http://127.0.0.1:5070'}/api/v1/auth/login`,{data:{email:env[index?'WORLD_PEER_EMAIL':'WORLD_STUDENT_EMAIL'],password:env[index?'WORLD_PEER_PASSWORD':'WORLD_STUDENT_PASSWORD']}});
      expect(response.ok()).toBe(true);const tokens=await response.json();
      await context.addInitScript(t=>sessionStorage.setItem('simulation.auth.v1',JSON.stringify(t)),tokens);
      const page=await context.newPage();await page.goto(`/student/sessions/${env.WORLD_SESSION_ID}/world`);await expect(page.getByTestId('honeyville-canvas')).toHaveAttribute('data-scene-ready','true');return page;
    }));
    for(const page of pages)await expect.poll(async()=>Number(await page.getByTestId('honeyville-canvas').getAttribute('data-remote-count'))).toBeGreaterThanOrEqual(1);
    const first=pages[0].getByTestId('honeyville-canvas');await expect(first).toHaveAttribute('data-local-player-id',/^[\da-f-]{36}$/i);const ownId=await first.getAttribute('data-local-player-id');
    const peer=pages[1].getByTestId('honeyville-canvas');const remoteX=async()=>{const poses=JSON.parse(await peer.getAttribute('data-remote-positions')??'[]') as {playerId:string;x:number}[];return poses.find(p=>p.playerId===ownId)?.x??NaN;};
    await expect.poll(remoteX).not.toBeNaN();const before=await remoteX();
    await pages[0].bringToFront();await first.locator('canvas').focus();await pages[0].keyboard.down('d');await pages[0].waitForTimeout(500);await pages[0].keyboard.up('d');
    await expect.poll(remoteX).toBeGreaterThan(before+5);
    await contexts[1].setOffline(true);await pages[1].waitForTimeout(1500);await contexts[1].setOffline(false);
    await expect(pages[1].getByText(/bees connected/)).toBeVisible({timeout:45000});
    await expect.poll(async()=>Number(await pages[1].getByTestId('honeyville-canvas').getAttribute('data-remote-count'))).toBeGreaterThanOrEqual(1);
  }finally{await Promise.all(contexts.map(context=>context.close()));}
});
