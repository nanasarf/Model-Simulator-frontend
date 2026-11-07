import type { ApiClient } from '../../lib/api/client';
import type { HoneyvilleMap } from './map';
export type Indicator = { key:string; value:string; unitKey:string };
export type WorldEntity = { id:string; kind:string; regionId:string; transform:{x:number;y:number;rotation:number}; visual:{prefabKey:string;variantKey:string}; indicators:Indicator[] };
export type WorldBinding = { templateId:string;templateVersion:string;templateHash:string;projectorId:string;projectorVersion:string;schemaVersion:number };
export type WorldSnapshot = { schemaVersion:number; sessionId:string;teamId:string;sourceStamp:string;contentHash:string;binding:WorldBinding;regions:{id:string;x:number;y:number;width:number;height:number}[];entities:WorldEntity[] };
export type WorldStatus='ready'|'not-bound'|'team-required'|'projector-unavailable'|'projection-unavailable';
export type WorldBootstrap={ protocolVersion:1;status:WorldStatus;snapshot:WorldSnapshot|null };
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function parseBootstrap(input:unknown,sessionId:string,teamId:string|null,map:HoneyvilleMap):WorldBootstrap{
  if(!record(input)||input.protocolVersion!==1||!['ready','not-bound','team-required','projector-unavailable','projection-unavailable'].includes(String(input.status)))throw new Error('Unsupported world bootstrap response.');
  if(input.status!=='ready'){if(input.snapshot!==null)throw new Error('Unexpected world data in unavailable response.');return input as WorldBootstrap;}
  const s=input.snapshot;
  if(!record(s)||s.schemaVersion!==1||typeof s.sessionId!=='string'||s.sessionId.toLowerCase()!==sessionId.toLowerCase()||s.teamId!==teamId||typeof s.sourceStamp!=='string'||typeof s.contentHash!=='string'||!record(s.binding)||!Array.isArray(s.entities)||s.entities.length>5000||!Array.isArray(s.regions))throw new Error('World snapshot does not match your authorized session.');
  const b=s.binding,meta=map.metadata;
  if(b.schemaVersion!==1||b.templateId!==meta.projectionTemplateId||b.templateVersion!==meta.projectionTemplateVersion||b.templateHash!==meta.projectionTemplateHash||b.projectorId!==meta.projectorId||b.projectorVersion!==meta.projectorVersion)throw new Error('This world template is not supported by Honeyville. Return to your session workspace.');
  const ids=new Set<string>();
  for(const e of s.entities){
    if(!record(e)||typeof e.id!=='string'||ids.has(e.id)||!record(e.transform)||![e.transform.x,e.transform.y,e.transform.rotation].every(v=>typeof v==='number'&&Number.isFinite(v))||!Array.isArray(e.indicators)||e.indicators.length>100)throw new Error('Invalid projected world entity.');
    ids.add(e.id);
    const keys=new Set<string>();for(const i of e.indicators){if(!record(i)||typeof i.key!=='string'||keys.has(i.key)||typeof i.value!=='string'||i.value.length>128||typeof i.unitKey!=='string')throw new Error('Invalid projected indicator.');keys.add(i.key);}
  }
  return input as WorldBootstrap;
}
export async function loadBootstrap(api:ApiClient,sessionId:string,teamId:string|null,map:HoneyvilleMap,signal?:AbortSignal){
  return parseBootstrap(await api.json<unknown>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/world/bootstrap`,{signal}),sessionId,teamId,map);
}
