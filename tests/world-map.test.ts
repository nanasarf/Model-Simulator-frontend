import { describe,it,expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import raw from '../src/features/world/honeyville.json';
import { parseHoneyville,blocked,interactionAt } from '../src/features/world/map';
import { WorldBridge } from '../src/features/world/bridge';
import { parseBootstrap,loadBootstrap } from '../src/features/world/contracts';
import { ApiClient } from '../src/lib/api/client';
const map=parseHoneyville(raw);const session='22222222-2222-2222-2222-222222222222';const team='33333333-3333-3333-3333-333333333333';
const binding={templateId:map.metadata.projectionTemplateId,templateVersion:map.metadata.projectionTemplateVersion,templateHash:map.metadata.projectionTemplateHash,projectorId:map.metadata.projectorId,projectorVersion:map.metadata.projectorVersion,schemaVersion:1};
const bootstrap=()=>({protocolVersion:1,status:'ready',snapshot:{schemaVersion:1,sessionId:session,teamId:team,sourceStamp:'source',contentHash:'hash',binding:{...binding},regions:[],entities:[{id:'market.hall',kind:'building',regionId:'town',transform:{x:768,y:640,rotation:0},visual:{prefabKey:'market-board',variantKey:'default'},indicators:[{key:'price',value:'12345678901234567890.125',unitKey:'model-price'}]}]}});
describe('structured Honeyville map',()=>{
  it('resolves the atlas from the map source when opened by a Tiled-compatible editor',()=>{expect(existsSync(path.resolve(process.cwd(),'src/features/world',raw.tilesets[0].image))).toBe(true);});
  it('has independent terrain, road, detail, collision, object and interaction data',()=>{expect(map.width).toBe(2048);expect(map.height).toBe(1536);expect(map.facilities).toHaveLength(6);expect(new Set(map.facilities.map(f=>f.name)).size).toBe(6);expect(map.zones).toHaveLength(6);expect(map.tiled.layers.map(l=>l.name)).toEqual(['Terrain','Roads','Details','Collisions','Facilities','Interactions','CollisionObjects','SpawnPoints','Decorations']);expect(map.facilities.find(f=>f.name==='market.hall')).toMatchObject({x:768,y:640});});
  it('has a valid spawn and blocking perimeter and building footprints',()=>{expect(blocked(map,map.spawn)).toBe(false);expect(blocked(map,{x:8,y:800})).toBe(true);expect(blocked(map,{x:2040,y:800})).toBe(true);expect(blocked(map,{x:768,y:560})).toBe(true);expect(blocked(map,{x:768,y:690})).toBe(false);});
  it('all interaction centers are walkable and reachable from arrival on the navigation grid',()=>{
    const visited=new Set<string>();const queue=[{x:Math.floor(map.spawn.x/16)*16+8,y:Math.floor(map.spawn.y/16)*16+8}];
    while(queue.length){const p=queue.shift()!,key=`${p.x}:${p.y}`;if(visited.has(key)||blocked(map,p))continue;visited.add(key);for(const [dx,dy]of [[0,16],[0,-16],[16,0],[-16,0]])queue.push({x:p.x+dx,y:p.y+dy});}
    for(const z of map.zones){const center={x:z.x+z.width/2,y:z.y+z.height/2};expect(blocked(map,center)).toBe(false);expect(interactionAt(map,center)?.entityId).toBe(z.entityId);expect([...visited].some(key=>{const[x,y]=key.split(':').map(Number);return interactionAt(map,{x,y})?.entityId===z.entityId;})).toBe(true);}
    expect(interactionAt(map,map.spawn)?.entityId).toBe('public.square');
  });
  it('rejects malformed dimensions, duplicate facilities, absent layers, invalid spawns and arbitrary prefab keys',()=>{
    const change=(fn:(m:any)=>void)=>{const value=structuredClone(raw);fn(value);return()=>parseHoneyville(value);};
    expect(change(m=>m.width=10000)).toThrow();expect(change(m=>m.layers=m.layers.filter((l:any)=>l.name!=='Interactions'))).toThrow();
    expect(change(m=>{const f=m.layers.find((l:any)=>l.name==='Facilities').objects;f[1].name=f[0].name;})).toThrow();
    expect(change(m=>{const spawn=m.layers.find((l:any)=>l.name==='SpawnPoints').objects[0];spawn.x=5;spawn.y=5;})).toThrow('Arrival point is blocked');
    expect(change(m=>m.layers.find((l:any)=>l.name==='Facilities').objects[0].properties.find((p:any)=>p.name==='prefab').value='https://untrusted.example/x')).toThrow();
  });
});
describe('bootstrap protocol and projection separation',()=>{
  it('preserves decimal text and accepts explicit unavailable states without fabricating entities',()=>{expect(parseBootstrap(bootstrap(),session,team,map).snapshot!.entities[0].indicators[0].value).toBe('12345678901234567890.125');expect(parseBootstrap({protocolVersion:1,status:'not-bound',snapshot:null},session,team,map).snapshot).toBeNull();});
  it('rejects foreign sessions/teams, unsupported bindings, duplicate IDs and unsupported protocols',()=>{
    const change=(fn:(b:ReturnType<typeof bootstrap>)=>void)=>{const b=bootstrap();fn(b);return()=>parseBootstrap(b,session,team,map);};
    expect(change(b=>b.snapshot.sessionId='foreign')).toThrow();expect(change(b=>b.snapshot.teamId='foreign')).toThrow();expect(change(b=>b.snapshot.binding.templateHash='other')).toThrow();expect(change(b=>b.protocolVersion=2)).toThrow();expect(change(b=>b.snapshot.entities.push(b.snapshot.entities[0]))).toThrow();
  });
  it('uses the existing authorized read-only API client with cancellation and no movement/action endpoints',async()=>{
    const calls:RequestInit[]=[];const urls:string[]=[];const abort=new AbortController();
    const api=new ApiClient('',{getAccessToken:async()=>'TOKEN',refresh:async()=>'TOKEN',invalidate:()=>{}},async(input,init)=>{calls.push(init!);urls.push(String(input));return new Response(JSON.stringify(bootstrap()));});
    await loadBootstrap(api,session,team,map,abort.signal);expect(urls).toEqual([`/api/v1/sessions/${session}/world/bootstrap`]);expect(calls[0].method).toBe('GET');expect(calls[0].signal).toBe(abort.signal);expect(new Headers(calls[0].headers).get('Authorization')).toBe('Bearer TOKEN');expect(calls[0].body).toBeUndefined();
  });
});
describe('per-world React/Phaser bridge',()=>{
  it('retains the paused state while the renderer module is still loading',()=>{const bridge=new WorldBridge();bridge.emit('blocked',true);expect(bridge.blocked).toBe(true);bridge.emit('blocked',false);expect(bridge.blocked).toBe(false);});
  it('isolates listeners between worlds and removes exactly owned callbacks',()=>{const first=new WorldBridge(),second=new WorldBridge();const a:string[]=[],b:string[]=[];const off=first.on('interact',id=>a.push(id));second.on('interact',id=>b.push(id));first.emit('interact','market.hall');expect(a).toEqual(['market.hall']);expect(b).toEqual([]);off();first.emit('interact','government.hall');expect(a).toHaveLength(1);second.clear();second.emit('interact','x');expect(b).toEqual([]);});
});
