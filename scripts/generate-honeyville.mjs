import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const assetDir = path.join(root, 'public/world/honeyville');
fs.mkdirSync(assetDir, { recursive: true });
const svg = (body, width = 256, height = 256) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
const shadow = '<ellipse cx="132" cy="232" rx="109" ry="17" fill="#234936" opacity=".14"/>';
const window = (x, y) => `<rect x="${x}" y="${y}" width="21" height="29" rx="9" fill="#315857"/><path d="M${x+3} ${y+12}h15M${x+10} ${y+3}v23" stroke="#a5c7b2" stroke-width="2"/>`;
const flower = (x,y,c='#ecbd64',s=1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0v13m0-5l-5-3m5 6l5-4" stroke="#597d52" stroke-width="2"/><circle cx="-3" cy="-1" r="3" fill="${c}"/><circle cx="3" cy="-1" r="3" fill="${c}"/><circle cy="-4" r="3" fill="${c}"/><circle cy="2" r="3" fill="${c}"/><circle r="2" fill="#89603f"/></g>`;
const art = {};
art.market = svg(`${shadow}<path d="M35 113h186v105q-93 20-186 0z" fill="#e5d4a3"/><path d="M35 116h186v17H35z" fill="#cdb982"/><path d="M26 104L75 41h111l47 63-105 20z" fill="#c58c40"/><path d="M75 41l53 83L26 104z" fill="#dfa64e"/><path d="M186 41l47 63-105 20z" fill="#aa7637"/><path d="M128 124V45" stroke="#e7b562" stroke-width="4"/><path d="M30 146h196v27H30z" fill="#3f7770"/><path d="M30 146h28v27H30zm56 0h28v27H86zm56 0h28v27h-28zm56 0h28v27h-28z" fill="#e8e1bc"/><path d="M34 174q12 11 24 0 14 11 28 0 14 11 28 0 14 11 28 0 14 11 28 0 14 11 28 0 14 11 28 0" fill="none" stroke="#315d58" stroke-width="4"/><rect x="105" y="180" width="47" height="49" rx="20" fill="#365c51"/>${window(53,185)}${window(184,185)}<rect x="90" y="120" width="77" height="22" rx="4" fill="#f5e8c6"/><text x="128" y="135" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#4c6350">HONEY</text><path d="M19 224h34v17H19zM205 220h32v18h-32z" fill="#a67c4c"/><path d="M21 227h29m159-4h25" stroke="#d8b87f" stroke-width="3"/>`);
art.factory = svg(`${shadow}<rect x="43" y="98" width="174" height="131" rx="8" fill="#c8c8b8"/><path d="M36 100V78l60-26v27l59-27v27l69-27v48z" fill="#527b76"/><path d="M36 101h188v12H36z" fill="#365c58"/><rect x="180" y="26" width="23" height="56" rx="4" fill="#a78863"/><rect x="175" y="23" width="33" height="9" rx="3" fill="#d2b486"/>${window(61,129)}${window(99,129)}${window(169,129)}<path d="M110 228v-44q0-22 23-22t23 22v44" fill="#315853"/><path d="M110 185h45m-22-22v65" stroke="#a2baaa" stroke-width="3"/><path d="M43 174h56m61 0h57M43 205h55m62 0h57" stroke="#a9b3a4" stroke-width="3"/><path d="M26 137v74h17M217 130h20v79h-20" fill="none" stroke="#b28b57" stroke-width="9"/><circle cx="237" cy="161" r="9" fill="#7d926e"/>`);
art.hive = svg(`${shadow}<path d="M55 107q2-35 73-35t73 35v112q-73 26-146 0z" fill="#d9b574"/><path d="M42 111l27-40 59-27 60 27 27 40-87 19z" fill="#d9a34d"/><path d="M128 44l60 27 27 40-87 19z" fill="#ba853c"/><path d="M53 139q76 22 151 0m-151 30q76 22 151 0m-151 30q76 22 151 0" fill="none" stroke="#bb975e" stroke-width="7"/><path d="M111 229v-34q0-18 18-18t18 18v34" fill="#385e50"/><path d="M80 118l17 10v21l-17 10-17-10v-21zm97 0l17 10v21l-17 10-17-10v-21z" fill="#5d8066" stroke="#f0cf8d" stroke-width="5"/><path d="M42 216h35m102 0h34" stroke="#827751" stroke-width="8"/>${flower(34,216,'#e8d49c',1.3)}${flower(221,214,'#d1a3a1',1.3)}`);
art.government = svg(`${shadow}<rect x="41" y="117" width="174" height="102" fill="#e1dfcb"/><path d="M25 114l103-62 104 62z" fill="#3f6c68"/><path d="M53 113l75-44 76 44z" fill="#5d8981"/><path d="M35 117h186v12H35z" fill="#c6c9b5"/><path d="M44 219h168v9H44zm-10 9h190v10H34z" fill="#bcc3ad"/><path d="M63 135v76m43-76v76m44-76v76m43-76v76" stroke="#f4efdb" stroke-width="14"/><path d="M57 137h143M54 212h150" stroke="#d1d2bc" stroke-width="7"/><rect x="114" y="163" width="29" height="51" rx="14" fill="#355e58"/><circle cx="128" cy="103" r="12" fill="#d4a14e"/><path d="M128 28v30m0-27h32l-8 9 8 8h-32" stroke="#a2814e" stroke-width="3" fill="#dcb45c"/>`);
art.square = svg(`<ellipse cx="128" cy="222" rx="115" ry="24" fill="#355f4820"/><ellipse cx="128" cy="162" rx="113" ry="67" fill="#d1cab0"/><ellipse cx="128" cy="155" rx="105" ry="61" fill="#f0e6c9"/><ellipse cx="128" cy="151" rx="73" ry="42" fill="#adbba2"/><ellipse cx="128" cy="145" rx="65" ry="36" fill="#91bdb0"/><ellipse cx="128" cy="145" rx="48" ry="23" fill="none" stroke="#b9d5c4" stroke-width="3"/><path d="M111 141v-36h34v36q-17 12-34 0" fill="#c9ccaf"/><ellipse cx="128" cy="104" rx="43" ry="19" fill="#ebe3c8"/><ellipse cx="128" cy="100" rx="36" ry="13" fill="#7aaba0"/><path d="M128 98V66" stroke="#cbded0" stroke-width="5"/><circle cx="128" cy="61" r="9" fill="#d2a355"/><path d="M19 181l29 16m160-6l25-14M56 104l22-12m103 0l23 12" stroke="#b2b49a" stroke-width="8"/>`);
art.field = svg(`<ellipse cx="127" cy="220" rx="111" ry="15" fill="#355f4818"/><path d="M20 81l109-30 107 32v120l-108 34L20 204z" fill="#a5a36d"/><path d="M25 87l103-28 103 29v106l-103 34-103-31z" fill="#83936a"/>${Array.from({length:6},(_,i)=>{const x=38+(i%3)*61,y=90+Math.floor(i/3)*65;return `<rect x="${x}" y="${y}" width="48" height="49" rx="8" fill="#9d8b60"/>`+flower(x+11,y+12,'#e9c779',.8)+flower(x+32,y+20,'#e4d9b3',1)+flower(x+17,y+33,'#c8acbd',.8)}).join('')}<path d="M22 87v114m106-143v165m105-135v111" stroke="#e4d6a7" stroke-width="5" fill="none"/><path d="M19 161l109 26 109-28" stroke="#d7c89a" stroke-width="5" fill="none"/>`);
art.tree = svg(`<ellipse cx="66" cy="144" rx="48" ry="12" fill="#294e3e20"/><path d="M61 91l-3 51h17l-5-59" fill="#81724e"/><path d="M64 110l-24-22m27 12l22-26" stroke="#81724e" stroke-width="6"/><circle cx="69" cy="65" r="43" fill="#476d50"/><circle cx="41" cy="80" r="30" fill="#5b8359"/><circle cx="92" cy="83" r="32" fill="#3b654c"/><circle cx="62" cy="46" r="31" fill="#6a915e"/><circle cx="83" cy="59" r="22" fill="#789963"/><path d="M40 47q17-14 31-7m-38 35l11-6m37 5l12-6" fill="none" stroke="#91ae72" stroke-width="4" stroke-linecap="round"/>`,128,160);
const tiles = Array.from({length:16},(_,i)=>{
  let b=''; const ground=['#a7b88a','#a4b588','#acbc90'];
  if(i<3) b=`<rect width="32" height="32" fill="${ground[i]}"/><path d="M5 9l2-3m12 18l3-2m-8-6h2" stroke="#8fa57b" stroke-width="1" opacity=".65"/><circle cx="27" cy="8" r="1" fill="#c5cea4"/>`;
  else if(i===3||i===4) b=`<rect width="32" height="32" fill="${i===3?'#ded3b1':'#ddd0ad'}"/><path d="M0 16h32m-16-16v16m16 0v16" stroke="#cfc29f" stroke-width="1"/><path d="M2 3h11m6 16h9" stroke="#eee5c9" stroke-width="1"/>`;
  else if(i===5) b=`<rect width="32" height="32" fill="#a7b88a"/>${flower(9,13,'#e7c771',.65)}${flower(24,17,'#e7dbc0',.7)}`;
  else if(i===6) b='<rect width="32" height="32" fill="#89aba0"/><path d="M4 9h12m0 14h13" stroke="#a6c6b6" stroke-width="2"/>';
  else if(i===7) b='<rect width="32" height="32" fill="#526f4d"/><circle cx="9" cy="12" r="11" fill="#648257"/><circle cx="24" cy="21" r="13" fill="#577b51"/>';
  else b='<rect width="32" height="32" fill="#acbc90"/>';
  return `<g transform="translate(${(i%8)*32} ${Math.floor(i/8)*32})">${b}</g>`;
}).join('');
art.terrain=svg(tiles,256,64);
let frames='';
for(let row=0;row<4;row++)for(let f=0;f<8;f++){
  const angle=[0,90,180,270][row], wing=3+Math.sin(f*Math.PI/2)*3;
  frames+=`<g transform="translate(${f*64+32} ${row*64+32})"><ellipse cx="2" cy="17" rx="15" ry="5" fill="#284737" opacity=".15"/><g transform="rotate(${angle})"><ellipse cx="-10" cy="-${wing}" rx="12" ry="${8+wing/2}" transform="rotate(-30 -10 -${wing})" fill="#edf2e3" stroke="#cadbc9" stroke-width="1" opacity=".92"/><ellipse cx="10" cy="-${wing}" rx="12" ry="${8+wing/2}" transform="rotate(30 10 -${wing})" fill="#f6f4df" stroke="#cadbc9" stroke-width="1" opacity=".92"/><ellipse cy="3" rx="9" ry="14" fill="#d9a348"/><path d="M-8 1h16m-16 7h16" stroke="#435146" stroke-width="4"/><circle cy="-10" r="8" fill="#46594a"/><path d="M-4-16l-4-6m12 6l4-6" stroke="#46594a" stroke-width="2" stroke-linecap="round"/><circle cx="-3" cy="-12" r="1.2" fill="#ede8cb"/><circle cx="3" cy="-12" r="1.2" fill="#ede8cb"/><path d="M0 18l-3-4h6z" fill="#46594a"/></g></g>`;
}
art.bee=svg(frames,512,256);
for(const [key,value] of Object.entries(art))fs.writeFileSync(path.join(assetDir,`${key}.svg`),value+'\n');

// Finite, orthogonal Tiled JSON: all placement lives here, outside the Phaser scene.
const W=64,H=48,terrain=[],roads=Array(W*H).fill(0),details=Array(W*H).fill(0),collisions=Array(W*H).fill(0);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  terrain.push(1+((x*17+y*23)%19===0?2:(x+y*3)%11===0?1:0));
  if(x===0||y===0||x===W-1||y===H-1){collisions[y*W+x]=8;details[y*W+x]=8;}
  if(!collisions[y*W+x]&&(x<3||x>60||y<3||y>44)&&((x*7+y)%5===0))details[y*W+x]=6;
}
function road(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)roads[yy*W+xx]=4+((xx+yy)%5===0?1:0)}
road(8,24,48,3);road(31,7,3,34);road(23,20,3,7);road(39,20,3,7);road(15,31,3,8);road(16,31,18,2);road(33,30,15,2);road(46,29,3,3);road(17,13,17,2);road(17,12,3,3);
for(let y=23;y<29;y++)for(let x=29;x<36;x++)roads[y*W+x]=4;
let id=1;
const props = o=>Object.entries(o).map(([name,value])=>({name,type:typeof value==='number'?'float':'string',value}));
const object=(name,type,x,y,width,height,p={})=>({id:id++,name,type,x,y,width,height,rotation:0,visible:true,properties:props(p)});
const facilities=[
  object('market.hall','Facility',768,640,232,232,{prefab:'market',label:'Honey Market',district:'Commerce',purpose:'The meeting place for buyers and sellers. Inspect the released market board; submit decisions in your session workspace.',number:'01'}),
  object('production.factory','Facility',1504,960,220,220,{prefab:'factory',label:'Production Factory',district:'Industry',purpose:'Honeyville’s production district. Production choices and outcomes depend on the active scenario; exploring this facility creates no output.',number:'02'}),
  object('residential.hive','Facility',512,992,212,212,{prefab:'hive',label:'Residential Hive',district:'Community',purpose:'A home for the hive community. This is a place to understand the setting, with no personal inventory, account or housing allocation.',number:'03'}),
  object('government.hall','Facility',1280,640,232,232,{prefab:'government',label:'Government Building',district:'Institutions',purpose:'The civic heart of Honeyville. Policy powers remain those assigned by the scenario and instructor; visiting does not grant a role or capability.',number:'04'}),
  object('public.square','Facility',1024,848,190,190,{prefab:'square',label:'Public Square',district:'Commons',purpose:'A shared space between the market and civic districts. Read the map, find your bearings and explore the connected paths.',number:'05'}),
  object('nectar.field','Facility',576,384,228,228,{prefab:'field',label:'Nectar Field',district:'Ecology',purpose:'A planted nectar garden at the edge of town. Environmental activity is decorative; resource amounts are only shown when provided by the active model.',number:'06'})
];
const interactions=facilities.map(f=>object(f.name+'.inspect','InteractionZone',f.x-(f.name==='public.square'?112:88),f.y-(f.name==='public.square'?44:0),f.name==='public.square'?224:176,f.name==='public.square'?208:128,{entityId:f.name,interactionId:f.name+'.inspect',kind:'information'}));
const solid=facilities.filter(f=>f.name!=='public.square'&&f.name!=='nectar.field').map(f=>object(f.name+'.collision','Collision',f.x-80,f.y-115,160,111,{entityId:f.name}));
const trees=[];for(const [x,y] of [[225,400],[340,560],[420,690],[650,820],[630,1120],[800,1160],[1180,1110],[1370,1140],[1650,800],[1660,520],[1450,400],[1090,370],[820,360],[390,290],[280,1110],[1690,1140],[360,900],[1430,720],[1180,440],[850,1020]])trees.push(object('tree.'+trees.length,'Decoration',x,y,100,125,{prefab:'tree'}));
for(const t of trees)solid.push(object(t.name+'.collision','Collision',t.x-11,t.y-17,22,16,{entityId:t.name}));
const layer=(name,data,visible=true)=>({id:id++,name,type:'tilelayer',x:0,y:0,width:W,height:H,opacity:1,visible,data});
const objects=(name,items)=>({id:id++,name,type:'objectgroup',opacity:1,visible:true,x:0,y:0,draworder:'topdown',objects:items});
const definition='honeyville.market-foundation:1;town:0,0,2048,1536;market.hall:768,640;market-board:default';
const map={type:'map',version:'1.10',tiledversion:'1.11.2',orientation:'orthogonal',renderorder:'right-down',infinite:false,width:W,height:H,tilewidth:32,tileheight:32,
  properties:props({worldId:'honeyville',mapVersion:'1.0.0',projectionTemplateId:'honeyville.market-foundation',projectionTemplateVersion:'1.0.0',projectionTemplateHash:crypto.createHash('sha256').update(definition).digest('hex'),projectorId:'Economics.CompetitiveMarket.World',projectorVersion:'1.0.0'}),
  tilesets:[{firstgid:1,name:'honeyville-terrain',tilewidth:32,tileheight:32,tilecount:16,columns:8,image:'../../../public/world/honeyville/terrain.svg',imagewidth:256,imageheight:64,margin:0,spacing:0}],
  layers:[layer('Terrain',terrain),layer('Roads',roads),layer('Details',details),layer('Collisions',collisions,false),objects('Facilities',facilities),objects('Interactions',interactions),objects('CollisionObjects',solid),objects('SpawnPoints',[object('arrival','Spawn',1008,980,0,0)]),objects('Decorations',trees)],nextobjectid:id+1,nextlayerid:id+2};
fs.mkdirSync(path.join(root,'src/features/world'),{recursive:true});fs.writeFileSync(path.join(root,'src/features/world/honeyville.json'),JSON.stringify(map)+'\n');
console.log('Generated original Honeyville SVG assets and 64×48 Tiled JSON map.');
