import solids from './navigation-v1.json';
/** Matches HoneyvilleGeometry.CanTravel v1, including conservative expanded corners. */
export function canTravel(x:number,y:number,nx:number,ny:number){
  if(![x,y,nx,ny].every(Number.isFinite)||nx<42||nx>2006||ny<42||ny>1494)return false;
  for(const box of solids){
    let lo=0,hi=1;
    const axis=(origin:number,delta:number,min:number,max:number)=>{
      if(delta===0)return origin>=min&&origin<=max;
      const a=(min-origin)/delta,b=(max-origin)/delta;
      lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));return lo<=hi;
    };
    if(axis(x,nx-x,box.X-10,box.X+box.Width+10)&&axis(y,ny-y,box.Y-10,box.Y+box.Height+10))return false;
  }
  return true;
}
