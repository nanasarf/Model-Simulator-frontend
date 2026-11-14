import { HubConnectionBuilder,LogLevel } from '@microsoft/signalr';
import type { Connection } from '../../lib/signalr/session-connection';
import type { PresenceEvent,PresencePlayer,PresenceSnapshot,WorldMove } from './presence-contracts';
import type { WorldBridge } from './bridge';
import geometry from './navigation-v1.json';

const EMPTY='00000000-0000-0000-0000-000000000000';
export type PresenceView={status:'connecting'|'connected'|'reconnecting'|'unavailable';count:number;controlled:boolean};
export function createWorldConnection(origin:string,token:()=>Promise<string>){return new HubConnectionBuilder().withUrl(`${origin}/hubs/world`,{accessTokenFactory:token}).withAutomaticReconnect([0,2000,10000,30000]).configureLogging(LogLevel.None).build();}
const integer=(n:number)=>Number.isSafeInteger(n)&&n>=0;
export function validPlayer(p:PresencePlayer){return !!p&&typeof p.playerId==='string'&&(p.teamId===null||typeof p.teamId==='string')&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=42&&p.x<=2006&&p.y>=42&&p.y<=1494&&integer(p.sequence)&&['north','east','south','west'].includes(p.facing)&&['idle','moving'].includes(p.movement)&&Number.isFinite(Date.parse(p.serverTimestamp));}
export async function geometryVersion(){const bytes=new TextEncoder().encode(JSON.stringify(geometry));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}

/** One serialized invocation, bounded event buffer, no movement replay across recovery. */
export class WorldPresenceClient{
  private disposed=false;private connected=false;private busy=false;private recovering=true;private paused=false;
  private snapshot?:PresenceSnapshot;private players=new Map<string,PresencePlayer>();private buffer:PresenceEvent[]=[];
  private sequence=0;private lastAttempt=0;private lastRecovery=0;private lastHealthy=0;private recoveryNeeded=true;
  private pose?:Omit<WorldMove,'protocolVersion'|'sessionId'|'epoch'|'leaseId'|'sequence'>;
  private timer?:ReturnType<typeof setInterval>;private offPose:()=>void;private expectedGeometry='';
  private retryAt=0;
  private lastView='';
  private overflow=false;private starting=false;private retrying=false;
  constructor(private hub:Connection,private sessionId:string,private bridge:WorldBridge,private view:(v:PresenceView)=>void){
    hub.on('WorldPresenceChanged',this.event);
    hub.onreconnecting(()=>this.disconnect('reconnecting'));
    hub.onclose(()=>this.disconnect('unavailable'));
    hub.onreconnected(()=>{if(!this.disposed){this.connected=true;this.snapshot=undefined;this.recoveryNeeded=true;void this.tick();}});
    this.offPose=bridge.on('pose',p=>{this.pose=p;});
  }
  private publish(status:PresenceView['status']='connected'){
    const controlled=status==='connected'&&!this.recovering&&!!this.snapshot&&this.snapshot.leaseId!==EMPTY;
    this.bridge.emit('presence',{epoch:this.snapshot?.epoch??null,players:[...this.players.values()],playerId:this.snapshot?.playerId??null,controlled});
    const key=`${status}:${this.players.size}:${controlled}`;
    if(key!==this.lastView){this.lastView=key;this.view({status,count:this.players.size,controlled});}
  }
  private disconnect(status:PresenceView['status']){if(this.disposed)return;this.connected=false;this.recovering=true;this.pose=undefined;this.players.clear();this.buffer=[];this.snapshot=undefined;this.publish(status);}
  setPaused(value:boolean){if(this.paused!==value){this.paused=value;this.recoveryNeeded=true;this.pose=undefined;}}
  async claimControl(){if(this.busy||this.disposed||!this.connected)return;this.snapshot=undefined;this.recoveryNeeded=true;await this.tick();}
  async retry(){if(this.disposed||this.connected||this.busy||this.retrying)return;this.retrying=true;try{clearInterval(this.timer);await this.hub.stop();this.snapshot=undefined;this.recoveryNeeded=true;this.retryAt=0;await this.start();}finally{this.retrying=false;}}
  private event=(raw:unknown)=>{
    if(this.disposed)return;const e=raw as PresenceEvent;
    if(e?.sessionId!==this.sessionId)return;
    if(e.protocolVersion!==1||!integer(e.revision)||!validPlayer(e.player)||!['joined','moved','updated','left'].includes(e.kind)){this.recoveryNeeded=true;return;}
    if(this.recovering||!this.snapshot||e.epoch!==this.snapshot.epoch||e.revision>this.snapshot.revision+1){
      if(this.buffer.length<128)this.buffer.push(e);else {this.buffer=[];this.overflow=true;}
      if(!this.recovering){this.recovering=true;this.pose=undefined;this.publish('reconnecting');}
      this.recoveryNeeded=true;return;
    }
    if(e.revision<=this.snapshot.revision)return;
    this.snapshot.revision=e.revision;
    if(e.kind==='left')this.players.delete(e.player.playerId);else this.players.set(e.player.playerId,e.player);
    // A peer control reset carries no private lease: fence movement until recovery confirms it.
    if(e.player.playerId===this.snapshot.playerId&&e.kind!=='moved'){this.recoveryNeeded=true;this.recovering=true;this.pose=undefined;}
    this.publish();
  };
  async start(){
    if(this.disposed||this.starting||this.connected)return;this.starting=true;
    this.publish('connecting');
    try{this.expectedGeometry=await geometryVersion();if(this.disposed)return;await this.hub.start();if(this.disposed){await this.hub.stop();return;}this.connected=true;this.timer=setInterval(()=>void this.tick(),100);await this.tick();}
    catch{this.disconnect('unavailable');}finally{this.starting=false;}
  }
  private async recover(){
    this.recovering=true;this.pose=undefined;this.publish('reconnecting');this.recoveryNeeded=false;
    let raw:unknown;
    try{raw=this.snapshot?await this.hub.invoke('RecoverWorld',{protocolVersion:1,sessionId:this.sessionId}):await this.hub.invoke('EnterWorld',this.sessionId);}
    catch(error){if(this.disposed||!this.connected)return;if(String(error).includes('world.entry_required')){this.snapshot=undefined;raw=await this.hub.invoke('EnterWorld',this.sessionId);}else throw error;}
    if(this.disposed||!this.connected)return;
    const s=raw as PresenceSnapshot;
    if(!s||s.protocolVersion!==1||s.sessionId!==this.sessionId||typeof s.epoch!=='string'||typeof s.leaseId!=='string'||!integer(s.revision)||s.geometryVersion!==this.expectedGeometry||!Array.isArray(s.players)||s.players.length>64||!s.players.every(validPlayer)||new Set(s.players.map(p=>p.playerId)).size!==s.players.length||!s.players.some(p=>p.playerId===s.playerId))throw Error('world.contract_invalid');
    this.snapshot=s;this.players=new Map(s.players.map(p=>[p.playerId,p]));this.sequence=this.players.get(s.playerId)!.sequence;
    this.recovering=false;this.recoveryNeeded=this.overflow;this.overflow=false;this.lastRecovery=this.lastHealthy=performance.now();
    this.bridge.emit('correction',this.players.get(s.playerId)!);
    const pending=this.buffer;this.buffer=[];
    for(const event of pending.filter(e=>e.epoch===s.epoch&&e.revision>s.revision).sort((a,b)=>a.revision-b.revision))this.event(event);
    this.publish();
  }
  private async tick(){
    if(!this.disposed&&performance.now()-this.lastHealthy>30000&&this.players.size){this.players.clear();this.recovering=true;this.publish('reconnecting');}
    if(this.disposed||!this.connected||this.busy||performance.now()<this.retryAt)return;
    const now=performance.now();this.busy=true;
    try{
      if(this.recoveryNeeded||now-this.lastRecovery>=10000){await this.recover();return;}
      const s=this.snapshot,p=this.pose;
      if(!s||this.recovering||this.paused||s.leaseId===EMPTY||!p||now-this.lastAttempt<100)return;
      const accepted=this.players.get(s.playerId)!;
      if(p.movement==='idle'&&accepted.movement==='idle'&&p.facing===accepted.facing&&p.x===accepted.x&&p.y===accepted.y)return;
      this.lastAttempt=now;this.pose=undefined;
      const ack=await this.hub.invoke('MoveWorld',{...p,protocolVersion:1,sessionId:this.sessionId,epoch:s.epoch,leaseId:s.leaseId,sequence:++this.sequence}) as PresencePlayer;
      if(this.disposed||!this.connected)return;
      if(!validPlayer(ack)||ack.playerId!==s.playerId||ack.sequence!==this.sequence)throw Error('world.contract_invalid');
      const previous=this.players.get(ack.playerId);if(!previous||ack.sequence>=previous.sequence)this.players.set(ack.playerId,ack);
      this.lastHealthy=performance.now();
      // Accepted proposals acknowledge prediction; rejected proposals recover instead of replaying.
    }catch(error){
      if(this.disposed)return;
      this.recovering=true;this.pose=undefined;this.recoveryNeeded=true;
      this.retryAt=performance.now()+2000;
      if(/world.binding_unsupported|world.session_inactive|session.not_found|world.contract_invalid/.test(String(error))){this.connected=false;this.players.clear();this.snapshot=undefined;this.publish('unavailable');void this.hub.stop().catch(()=>{});}
      else {if(performance.now()-this.lastHealthy>30000)this.players.clear();this.publish('reconnecting');this.lastRecovery=performance.now();}
    }finally{this.busy=false;}
  }
  async dispose(){if(this.disposed)return;this.disposed=true;clearInterval(this.timer);this.offPose();this.hub.off('WorldPresenceChanged',this.event);this.players.clear();this.bridge.emit('presence',{epoch:null,players:[],playerId:null,controlled:false});try{if(this.connected&&!this.busy)await this.hub.invoke('LeaveWorld',this.sessionId);}finally{await this.hub.stop();}}
}
