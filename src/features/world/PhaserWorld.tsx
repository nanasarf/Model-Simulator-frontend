import { useEffect,useRef,useState } from 'react';
import type { HoneyvilleMap } from './map';
import { WorldBridge } from './bridge';
type GameModule={createHoneyvilleGame:(host:HTMLElement,map:HoneyvilleMap,bridge:WorldBridge)=>()=>void};
const defaultLoader=()=>import('./game');
export function PhaserWorld({map,bridge,loadGame=defaultLoader}:{map:HoneyvilleMap;bridge:WorldBridge;loadGame?:()=>Promise<GameModule>}){
  const host=useRef<HTMLDivElement>(null);const [error,setError]=useState<string|null>(null);const [progress,setProgress]=useState(0);const [ready,setReady]=useState(false);const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let cancelled=false;let dispose:(()=>void)|undefined;setError(null);setReady(false);setProgress(0);
    const offError=bridge.on('error',message=>setError(message));const offProgress=bridge.on('progress',setProgress);const offReady=bridge.on('ready',()=>setReady(true));
    loadGame().then(({createHoneyvilleGame})=>{if(!cancelled&&host.current)dispose=createHoneyvilleGame(host.current,map,bridge);}).catch(()=>{if(!cancelled)setError('The world renderer could not start. Try again or return to your session.');});
    return()=>{cancelled=true;offError();offProgress();offReady();dispose?.();};
  },[map,bridge,attempt,loadGame]);
  return <div className="hv-game-frame">
    <div className="hv-canvas" ref={host} data-testid="honeyville-canvas" aria-label="Honeyville game viewport"/>
    {!ready&&!error&&<div className="hv-game-state" role="status"><span className="hv-loader"/><h2>Opening Honeyville</h2><p>Preparing the landscape · {Math.round(progress*100)}%</p></div>}
    {error&&<div className="hv-game-state hv-game-error" role="alert"><h2>World assets unavailable</h2><p>{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Retry world</button></div>}
    <button className="hv-focus" type="button" disabled={!ready||!!error} onClick={()=>host.current?.querySelector('canvas')?.focus({preventScroll:true})}>Focus map <span aria-hidden="true">↗</span></button>
  </div>;
}
