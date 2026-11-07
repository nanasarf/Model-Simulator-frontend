export type WorldEvents={ ready:undefined; progress:number; nearby:string|null; interact:string; error:string; blocked:boolean; direction:{x:number;y:number} };
export class WorldBridge{
  private blockedState=false;
  get blocked(){return this.blockedState;}
  private listeners=new Map<keyof WorldEvents,Set<(data:never)=>void>>();
  on<K extends keyof WorldEvents>(name:K,fn:(data:WorldEvents[K])=>void){const listeners=this.listeners.get(name)??new Set();listeners.add(fn as (data:never)=>void);this.listeners.set(name,listeners);return()=>{listeners.delete(fn as (data:never)=>void);if(!listeners.size)this.listeners.delete(name);};}
  emit<K extends keyof WorldEvents>(name:K,data:WorldEvents[K]){if(name==='blocked')this.blockedState=data as boolean;this.listeners.get(name)?.forEach(fn=>fn(data as never));}
  clear(){this.listeners.clear();}
}
