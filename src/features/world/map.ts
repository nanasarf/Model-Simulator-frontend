export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
type Property = { name: string; value: unknown };
type MapObject = Rect & { id: number; name: string; type: string; rotation: number; properties?: Property[] };
type Layer = { name: string; type: string; data?: number[]; objects?: MapObject[]; width?: number; height?: number };
export type TiledMap = { orientation: string; infinite: boolean; width: number; height: number; tilewidth: number; tileheight: number; layers: Layer[]; properties: Property[]; tilesets: { name: string; firstgid: number; tilecount: number }[] };
export type Facility = MapObject & { prefab: 'market'|'factory'|'hive'|'government'|'square'|'field'; label: string; district: string; purpose: string; number: string };
export type InteractionZone = Rect & { entityId: string; interactionId: string };
export type HoneyvilleMap = { tiled: TiledMap; width: number; height: number; tileSize: number; facilities: Facility[]; zones: InteractionZone[]; walls: Rect[]; spawn: Point; decorations: MapObject[]; metadata: Record<string,string> };
export const properties = (object: { properties?: Property[] }) => Object.fromEntries((object.properties ?? []).map(p => [p.name, p.value]));
const rect = (o: Rect) => [o.x,o.y,o.width,o.height].every(Number.isFinite) && o.width >= 0 && o.height >= 0;
export const contains = (r: Rect, p: Point, margin=0) => p.x >= r.x-margin && p.x <= r.x+r.width+margin && p.y >= r.y-margin && p.y <= r.y+r.height+margin;
export const blocked = (map: HoneyvilleMap, point: Point, radius=11) => point.x < radius || point.y < radius || point.x > map.width-radius || point.y > map.height-radius || map.walls.some(r => contains(r,point,radius));
export const interactionAt = (map: HoneyvilleMap, point: Point): InteractionZone | null => map.zones.filter(z=>contains(z,point)).sort((a,b)=>Math.hypot(point.x-a.x-a.width/2,point.y-a.y-a.height/2)-Math.hypot(point.x-b.x-b.width/2,point.y-b.y-b.height/2))[0] ?? null;
export function parseHoneyville(raw: unknown): HoneyvilleMap {
  const m = raw as TiledMap;
  if (!m || m.orientation !== 'orthogonal' || m.infinite !== false || !Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width<1 || m.height<1 || m.width>128 || m.height>128 || m.tilewidth!==32 || m.tileheight!==32 || !Array.isArray(m.layers) || !Array.isArray(m.properties) || m.tilesets?.length!==1 || m.tilesets[0].name!=='honeyville-terrain') throw new Error('Unsupported Honeyville map format.');
  const width=m.width*32,height=m.height*32;
  if(new Set(m.layers.map(l=>l.name)).size!==m.layers.length)throw new Error('Duplicate map layer.');
  const layer=(name:string,type:string)=>{const l=m.layers.find(l=>l.name===name&&l.type===type);if(!l)throw new Error(`Map layer missing: ${name}`);return l;};
  for(const name of ['Terrain','Roads','Details','Collisions']){
    const l=layer(name,'tilelayer');if(l.width!==m.width||l.height!==m.height||!Array.isArray(l.data)||l.data.length!==m.width*m.height||l.data.some(v=>!Number.isInteger(v)||v<0||v>16))throw new Error(`Invalid tile data: ${name}`);
  }
  const objects=(name:string)=>{const result=layer(name,'objectgroup').objects;if(!Array.isArray(result)||result.some(o=>!rect(o)||o.rotation!==0||o.x<0||o.y<0||o.x>width||o.y>height))throw new Error(`Invalid objects: ${name}`);return result;};
  const facilityObjects=objects('Facilities');
  const facilities=facilityObjects.map(o=>{const p=properties(o);if(!['market','factory','hive','government','square','field'].includes(String(p.prefab))||['label','district','purpose','number'].some(k=>typeof p[k]!=='string'||String(p[k]).length>1000))throw new Error('Invalid facility prefab or metadata.');return {...o,...p} as Facility;});
  if(facilities.length!==6||new Set(facilities.map(f=>f.name)).size!==facilities.length)throw new Error('Honeyville requires six unique facilities.');
  const zones=objects('Interactions').map(o=>{const p=properties(o);if(typeof p.entityId!=='string'||typeof p.interactionId!=='string'||!facilities.some(f=>f.name===p.entityId)||o.width<1||o.height<1)throw new Error('Invalid interaction reference.');return {x:o.x,y:o.y,width:o.width,height:o.height,entityId:p.entityId,interactionId:p.interactionId};});
  if(zones.length!==facilities.length||new Set(zones.map(z=>z.interactionId)).size!==zones.length||new Set(zones.map(z=>z.entityId)).size!==facilities.length)throw new Error('Missing or duplicated facility interaction.');
  const walls:Rect[]=objects('CollisionObjects').map(o=>({x:o.x,y:o.y,width:o.width,height:o.height}));
  layer('Collisions','tilelayer').data!.forEach((v,i)=>{if(v)walls.push({x:(i%m.width)*32,y:Math.floor(i/m.width)*32,width:32,height:32});});
  const spawns=objects('SpawnPoints');if(spawns.length!==1)throw new Error('Exactly one arrival point is required.');
  const metadata=Object.fromEntries(Object.entries(properties(m)).filter(([,v])=>typeof v==='string')) as Record<string,string>;
  const map={tiled:m,width,height,tileSize:32,facilities,zones,walls,spawn:{x:spawns[0].x,y:spawns[0].y},decorations:objects('Decorations'),metadata};
  if(blocked(map,map.spawn))throw new Error('Arrival point is blocked.');
  if(zones.some(z=>z.x+z.width>width||z.y+z.height>height))throw new Error('Interaction extends outside map.');
  return map;
}
