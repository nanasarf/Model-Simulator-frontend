import type { PresencePlayer } from './presence-contracts';
export function interpolatePosition(from:{x:number;y:number},to:PresencePlayer,elapsed:number){
  const alpha=Math.min(1,Math.max(0,elapsed/120));
  return {x:from.x+(to.x-from.x)*alpha,y:from.y+(to.y-from.y)*alpha};
}
