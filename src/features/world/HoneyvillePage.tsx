import { useEffect,useMemo,useRef,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth,useRuntime } from '../../app/runtime';
import { useConnectionStatus } from '../../app/shell';
import { LoadingState,ErrorState } from '../../components/states';
import { ApiProblem } from '../../lib/errors/problem';
import { sessionExpired } from '../../lib/api/client';
import { createConnection,SessionConnection,type ConnectionStatus } from '../../lib/signalr/session-connection';
import { invalidateSession,keys } from '../../lib/api/query';
import { sessionService } from '../sessions/service';
import { isSessionId } from '../sessions/open-session';
import { recoverContext } from '../simulation/context';
import rawMap from './honeyville.json';
import { parseHoneyville,type Facility } from './map';
import { loadBootstrap,type WorldBootstrap } from './contracts';
import { WorldBridge } from './bridge';
import { PhaserWorld } from './PhaserWorld';
import './world.css';
import { createWorldConnection,WorldPresenceClient,type PresenceView } from './presence';

export const honeyville=parseHoneyville(rawMap);
export default function HoneyvillePage(){const {sessionId=''}=useParams();return isSessionId(sessionId)?<AuthorizedWorld key={sessionId} id={sessionId}/>:<section className="state"><h1>Invalid session ID</h1><p>Open Honeyville from an authorized session.</p></section>;}
function AuthorizedWorld({id}:{id:string}){
  const {api,auth,queries}=useRuntime();const {user}=useAuth();const uid=user!.id;
  const setShellStatus=useConnectionStatus();
  const [revoked,setRevoked]=useState(false);const [connection,setConnection]=useState<ConnectionStatus>('disconnected');
  const state=useQuery({queryKey:[...keys.state(uid,id),'student'],queryFn:({signal})=>sessionService(api).state(id,signal,'student'),refetchInterval:15_000});
  const team=state.data?.teamId??null;
  const bootstrap=useQuery({queryKey:['user',uid,'session',id,'world',team],queryFn:({signal})=>loadBootstrap(api,id,team,honeyville,signal),enabled:!!state.data&&!revoked,refetchInterval:15_000});
  const hasState=!!state.data;
  useEffect(()=>{
    if(!hasState||revoked)return;let active=true;
    const hub=createConnection(api.origin,async()=>{const token=await auth.getAccessToken();if(!token)throw sessionExpired();return token;});
    const revoke=(event:{sessionId?:string})=>{if(active&&event.sessionId===id){setRevoked(true);void queries.cancelQueries({queryKey:['user',uid,'session',id]});queries.removeQueries({queryKey:['user',uid,'session',id,'world']});}};
    hub.on('SessionAccessRevoked',revoke);
    const recover=()=>invalidateSession(queries,uid,id);
    const live=new SessionConnection(hub,id,recover,recover,value=>{if(active){setConnection(value);setShellStatus(value);}},()=>{if(active){setConnection('disconnected');setShellStatus('disconnected');}});
    void live.start();return()=>{active=false;setShellStatus(null);hub.off('SessionAccessRevoked',revoke);void live.dispose().catch(()=>{});};
  },[api,auth,queries,uid,id,hasState,revoked,setShellStatus]);
  const back=<Link className="button-link secondary" to={`/student/sessions/${id}`}>← Return to session</Link>;
  if(revoked||(state.error instanceof ApiProblem&&[401,403,404].includes(state.error.status))||(bootstrap.error instanceof ApiProblem&&[401,403,404].includes(bootstrap.error.status)))return <section className="state"><p className="eyebrow">Honeyville</p><h1>Session access unavailable</h1><p>Your permission to enter this world could not be confirmed. Your account’s classroom access is unchanged.</p>{back}</section>;
  if(state.isPending)return <LoadingState label="Confirming session access"/>;
  if(state.isError||!state.data)return <><ErrorState error={state.error} retry={()=>void state.refetch()}/>{back}</>;
  const context=recoverContext(state.data,uid);
  if(['completed','terminated','deleted'].includes(context.status.toLowerCase()))return <section className="state"><h1>This session has ended</h1>{back}</section>;
  if(!context.participant||!context.teamId||!context.roleCodes.length||['draft','setup','lobby','created','ready'].includes(context.status.toLowerCase()))return <section className="state"><h1>Honeyville is waiting</h1><p>Join a team and role, then wait for your instructor to start this session.</p>{back}</section>;
  if(bootstrap.isPending)return <LoadingState label="Recovering the world projection"/>;
  if(bootstrap.isError||!bootstrap.data)return <><ErrorState error={bootstrap.error} retry={()=>void bootstrap.refetch()}/>{back}</>;
  return <HoneyvilleExperience key={`${id}:${team}`} bootstrap={bootstrap.data} round={context.roundNumber} phase={context.phase} role={context.roleCodes.join(', ')} status={context.status} connection={connection} onRefresh={()=>void bootstrap.refetch()} refreshing={bootstrap.isFetching} back={back}/>;
}

function HoneyvilleExperience({bootstrap,round,phase,role,status,connection,onRefresh,refreshing,back}:{bootstrap:WorldBootstrap;round:number;phase:string;role:string;status:string;connection:ConnectionStatus;onRefresh:()=>void;refreshing:boolean;back:React.ReactNode}){
  const {api,auth}=useRuntime();
  const [presence,setPresence]=useState<PresenceView>({status:'connecting',count:0,controlled:false});
  const presenceClient=useRef<WorldPresenceClient|null>(null);
  const bridge=useMemo(()=>new WorldBridge(),[]);const [nearby,setNearby]=useState<string|null>(null);const [panel,setPanel]=useState<string|null>(null);
  const nearRef=useRef<string|null>(null);const close=useRef<HTMLButtonElement>(null);
  const paused=status.toLowerCase()==='paused';
  const presenceSession=bootstrap.snapshot?.sessionId;
  useEffect(()=>{
    if(!presenceSession)return;
    const hub=createWorldConnection(api.origin,async()=>{const token=await auth.getAccessToken();if(!token)throw sessionExpired();return token;});
    let active=true;const client=new WorldPresenceClient(hub,presenceSession,bridge,value=>{if(active)setPresence(value);});presenceClient.current=client;
    client.setPaused(paused);void client.start();
    return()=>{active=false;presenceClient.current=null;void client.dispose().catch(()=>{});};
  },[api,auth,bridge,presenceSession]);
  useEffect(()=>{presenceClient.current?.setPaused(paused);},[paused]);
  useEffect(()=>{
    const offNear=bridge.on('nearby',id=>{nearRef.current=id;setNearby(id);});
    const offInteract=bridge.on('interact',id=>{if(nearRef.current===id)setPanel(id);});
    return()=>{offNear();offInteract();bridge.clear();};
  },[bridge]);
  useEffect(()=>{bridge.emit('blocked',!!panel||paused);if(panel)close.current?.focus();},[bridge,panel,paused]);
  const facility=honeyville.facilities.find(f=>f.name===panel);const near=honeyville.facilities.find(f=>f.name===nearby);
  const market=bootstrap.snapshot?.entities.find(e=>e.id==='market.hall');
  function dismiss(){setPanel(null);document.querySelector<HTMLCanvasElement>('.hv-canvas canvas')?.focus({preventScroll:true});}
  return <section className="honeyville" aria-labelledby="honeyville-title">
    <header className="hv-heading"><div><p className="eyebrow">MODEL SIMULATOR / FIELD STATION 01</p><h1 id="honeyville-title">Honeyville<span aria-hidden="true">.</span></h1><p>A shared setting. A closer view of your decisions.</p></div>{back}</header>
    <div className="hv-statusbar"><span className="hv-world-label"><span className="hv-live-dot"/> {presenceSession?'SHARED EXPLORATION':'LOCAL EXPLORATION'}</span><span>Round <strong>{round}</strong></span><span>{phase}</span><span>{role.replaceAll('_',' ')}</span><span className="hv-network">{connection==='connected'?'Session linked':connection==='reconnecting'?'Reconnecting…':'Live updates unavailable'}</span></div>
    {presenceSession&&<p className="hv-presence" role="status">{presence.status==='connected'?`${presence.count} ${presence.count===1?'bee':'bees'} connected${presence.controlled?'':' · Observing; another tab may control movement'}`:presence.status==='unavailable'?'Multiplayer unavailable':presence.status==='reconnecting'?'Reconnecting to the hive…':'Connecting to the hive…'}{presence.status==='connected'&&!presence.controlled&&<button className="text-button" onClick={()=>void presenceClient.current?.claimControl()}>Check movement control</button>}{presence.status==='unavailable'&&<button className="text-button" onClick={()=>void presenceClient.current?.retry()}>Reconnect</button>}</p>}
    {paused&&<p className="hv-notice" role="status">Your instructor has paused the session. Exploration will resume with the session.</p>}
    {bootstrap.status!=='ready'&&<p className="hv-notice" role="status">{bootstrap.status==='not-bound'?'This scenario has no world projection. You can explore Honeyville; authoritative market data is unavailable.':'World projection is unavailable for this scenario. The town remains informational; no model values are being substituted.'}</p>}
    <div className="hv-layout"><div className="hv-stage">
      <PhaserWorld map={honeyville} bridge={bridge}/>
      <div className="hv-map-title" aria-hidden="true"><span>HONEYVILLE</span><small>THE NECTAR COMMONS</small></div>
      <div className="hv-interaction"><div><span className="hv-compass" aria-hidden="true">⌖</span><div><strong>{near?.label??'Explore the Nectar Commons'}</strong><small>{near?'You are within the information zone.':'Follow the paths to discover the six facilities.'}</small></div></div><button disabled={!near||!!panel||paused} onClick={()=>near&&setPanel(near.name)}>{near?'Inspect facility':'Approach a facility'} <kbd>E</kbd></button></div>
    </div>
    <aside className="hv-sidebar" aria-label="World guide"><p className="eyebrow">YOUR FIELD GUIDE</p><h2>One hive.<br/>Many perspectives.</h2><p className="hv-guide-copy">Walk the connected districts. Discover where your role meets the wider community.</p>
      <ol className="hv-facilities">{honeyville.facilities.map(f=><li key={f.name} className={nearby===f.name?'is-near':''}><span>{f.number}</span><div><strong>{f.label}</strong><small>{f.district}</small></div>{nearby===f.name&&<span className="hv-near-label">NEARBY</span>}</li>)}</ol>
      <div className="hv-controls"><p className="eyebrow">GETTING AROUND</p><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrow keys</p><p><kbd>E</kbd> Inspect nearby facility</p><p><kbd>Tab</kbd> Navigate interface</p><small>Focus the map before moving. Exploring never submits a simulation decision.</small></div>
      <details className="hv-touch"><summary>On-screen movement controls</summary><div aria-label="Movement controls" className="hv-dpad">{[['↑',0,-1],['←',-1,0],['↓',0,1],['→',1,0]].map(([label,x,y])=><button key={label} aria-label={`Move ${label==='↑'?'north':label==='↓'?'south':label==='←'?'west':'east'}`} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);document.querySelector<HTMLCanvasElement>('.hv-canvas canvas')?.focus();bridge.emit('direction',{x:Number(x),y:Number(y)});}} onPointerUp={()=>bridge.emit('direction',{x:0,y:0})} onPointerCancel={()=>bridge.emit('direction',{x:0,y:0})} onBlur={()=>bridge.emit('direction',{x:0,y:0})}>{label}</button>)}</div></details>
    </aside></div>
    <footer className="hv-footer"><span>HONEYVILLE / 01 <span className="hv-footer-line"/> EXPLORE · OBSERVE · UNDERSTAND</span><span>Economic decisions remain in your session workspace.</span></footer>
    {facility&&<aside className="hv-panel" aria-labelledby="facility-title" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();dismiss();}}}>
      <div className="hv-panel-heading"><p className="eyebrow">{facility.district} / {facility.number}</p><button ref={close} type="button" className="secondary" aria-label="Close facility panel" onClick={dismiss}>✕</button></div>
      <img className="hv-panel-art" src={`${import.meta.env.BASE_URL}world/honeyville/${facility.prefab}.svg`} alt=""/><h2 id="facility-title">{facility.label}</h2><p>{facility.purpose}</p>
      {facility.name==='market.hall'?<section className="hv-market-board" aria-labelledby="market-board-title"><div className="hv-board-title"><h3 id="market-board-title">Market board</h3><button className="text-button" onClick={onRefresh} disabled={refreshing}>{refreshing?'Updating…':'Refresh'}</button></div>
        {market?.indicators.some(i=>i.key==='price')?<><dl>{market.indicators.filter(i=>['round','price','quantityExchanged','unmatchedDemand','unmatchedSupply'].includes(i.key)).map(i=><div key={i.key}><dt>{{round:'Result round',price:'Model-reported price',quantityExchanged:'Units exchanged',unmatchedDemand:'Unmatched demand',unmatchedSupply:'Unmatched supply'}[i.key]}</dt><dd>{i.value}</dd></div>)}</dl><p className="muted">Released team-level results. These figures do not establish your personal trade or contribution.</p></>:<p className="muted">No released market result is available. Your instructor controls when outcomes are calculated and released.</p>}</section>:<div className="hv-panel-note"><strong>Observe first.</strong><p>Information panels never submit decisions, grant permissions or change simulation outcomes.</p></div>}
      <p className="hv-panel-back">Use “Return to session” for your authorized actions and instructor-led activity.</p>
    </aside>}
  </section>;
}
