import Phaser from 'phaser';
import type { HoneyvilleMap } from './map';
import { interactionAt, properties } from './map';
import { WorldBridge } from './bridge';
import { FACILITY_PREFABS } from './prefabs';
import type { PresencePlayer } from './presence-contracts';
import { interpolatePosition } from './interpolation';
import { canTravel } from './navigation';

export const ASSET_KEYS=['terrain','bee','market','factory','hive','government','square','field','tree'] as const;
export function createHoneyvilleGame(host:HTMLElement,mapData:HoneyvilleMap,bridge:WorldBridge){
  let disposed=false;
  class HoneyvilleScene extends Phaser.Scene{
    private bee!:Phaser.Physics.Arcade.Sprite;
    private keys=new Set<string>();private touch={x:0,y:0};private blocked=false;private nearby:string|null=null;private facing=0;private lastSample=0;
    private reducedMotion=false;
    private remotes=new Map<string,{sprite:Phaser.GameObjects.Sprite;label:Phaser.GameObjects.Text;from:{x:number;y:number};target:PresencePlayer;at:number}>();
    private correction?:PresencePlayer;
    private reconciliation={x:0,y:0};private initializedPlayer:string|null=null;
    private renderedEpoch:string|null=null;
    private previous={x:mapData.spawn.x,y:mapData.spawn.y};
    constructor(){super('Honeyville');}
    preload(){
      this.load.on('progress',(value:number)=>bridge.emit('progress',value));
      this.load.on('loaderror',()=>{this.blocked=true;bridge.emit('error','A Honeyville asset could not be loaded. Retry loading the world.');});
      for(const key of ASSET_KEYS){
        const url=`${import.meta.env.BASE_URL}world/honeyville/${key}.svg`;
        if(key==='bee')this.load.spritesheet(key,url,{frameWidth:64,frameHeight:64});else this.load.image(key,url);
      }
    }
    create(){
      if(disposed)return;
      if(ASSET_KEYS.some(key=>!this.textures.exists(key))){bridge.emit('error','Required Honeyville assets are unavailable.');return;}
      this.cache.tilemap.add('honeyville',{format:Phaser.Tilemaps.Formats.TILED_JSON,data:mapData.tiled});
      const tilemap=this.make.tilemap({key:'honeyville'});
      const tiles=tilemap.addTilesetImage('honeyville-terrain','terrain',32,32,0,0)!;
      for(const [index,name] of ['Terrain','Roads','Details'].entries())tilemap.createLayer(name,tiles)!.setDepth(-10000+index);
      const boundaries=tilemap.createLayer('Collisions',tiles)!.setVisible(false).setCollisionByExclusion([-1]);
      const solids=this.physics.add.staticGroup();
      const collisionLayer=mapData.tiled.layers.find(l=>l.name==='CollisionObjects')!;
      for(const r of collisionLayer.objects??[]){const box=this.add.rectangle(r.x+r.width/2,r.y+r.height/2,r.width,r.height,0,0);this.physics.add.existing(box,true);solids.add(box);}
      for(const f of mapData.facilities){
        const prefab=FACILITY_PREFABS[f.prefab];
        this.add.image(f.x,f.y,prefab.texture).setOrigin(.5,1).setDisplaySize(f.width,f.height).setDepth(f.y);
        if(prefab.waterRipple){
          const ripple=this.add.ellipse(f.x,f.y-110*f.height/256,45*f.width/256,17*f.height/256).setStrokeStyle(1.5,0xe5edcf,.65).setDepth(f.y+.1);
          this.tweens.add({targets:ripple,scaleX:1.7,scaleY:1.7,alpha:0,duration:2300,repeat:-1,repeatDelay:400});
        }
        const label=this.add.text(f.x,f.y-f.height+16,f.label,{fontFamily:'Segoe UI, sans-serif',fontSize:'15px',fontStyle:'600',color:'#325648',backgroundColor:'#eee9ce',padding:{x:10,y:5}}).setOrigin(.5,1).setDepth(5000+f.y);
        label.setAlpha(.95);
      }
      for(const item of mapData.decorations){
        if(properties(item).prefab!=='tree')continue;
        this.add.image(item.x,item.y,'tree').setOrigin(.5,1).setDisplaySize(item.width,item.height).setDepth(item.y);
      }
      for(let direction=0;direction<4;direction++){
        this.anims.create({key:`fly-${direction}`,frames:this.anims.generateFrameNumbers('bee',{start:direction*8,end:direction*8+7}),frameRate:18,repeat:-1});
        this.anims.create({key:`idle-${direction}`,frames:[{key:'bee',frame:direction*8},{key:'bee',frame:direction*8+2}],frameRate:3,repeat:-1});
      }
      this.bee=this.physics.add.sprite(mapData.spawn.x,mapData.spawn.y,'bee',16).setScale(.82).setCollideWorldBounds(true);
      this.bee.body!.setCircle(10/.82,32-10/.82,32-10/.82);this.bee.setMaxVelocity(180,180);
      this.physics.world.setBounds(0,0,mapData.width,mapData.height);
      this.physics.add.collider(this.bee,boundaries);this.physics.add.collider(this.bee,solids);
      const camera=this.cameras.main;camera.setBounds(0,0,mapData.width,mapData.height);camera.setZoom(.85);camera.startFollow(this.bee,false,.10,.10,0,190);camera.setBackgroundColor('#a7b88a');
      this.bee.play('idle-2');this.facing=2;
      const canvas=this.game.canvas;canvas.tabIndex=0;canvas.setAttribute('aria-label','Honeyville map. Use W A S D or arrow keys to move, E to inspect, and Tab to reach controls.');
      const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
      const syncMotion=()=>{this.reducedMotion=motion.matches;if(motion.matches)this.tweens.pauseAll();else this.tweens.resumeAll();};
      syncMotion();motion.addEventListener('change',syncMotion);
      const keydown=(event:KeyboardEvent)=>{
        if(!['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','e'].includes(event.key.toLowerCase()))return;
        event.preventDefault();this.keys.add(event.key.toLowerCase());this.steer();
        if(event.key.toLowerCase()==='e'&&!event.repeat&&!this.blocked&&this.nearby)bridge.emit('interact',this.nearby);
      };
      const keyup=(event:KeyboardEvent)=>{this.keys.delete(event.key.toLowerCase());this.steer();};
      const reset=()=>{this.keys.clear();this.touch={x:0,y:0};this.bee?.setVelocity(0);};
      const focus=()=>canvas.focus({preventScroll:true});
      canvas.addEventListener('keydown',keydown);canvas.addEventListener('keyup',keyup);canvas.addEventListener('blur',reset);canvas.addEventListener('pointerdown',focus);
      window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
      this.blocked=bridge.blocked;
      const offBlock=bridge.on('blocked',value=>{this.blocked=value;reset();});
      const offDirection=bridge.on('direction',value=>{this.touch=value;this.steer();});
      const offCorrection=bridge.on('correction',value=>{this.correction=value;});
      const offPresence=bridge.on('presence',()=>{if(!bridge.presence?.controlled)this.bee.setVelocity(0);});
      this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{offCorrection();offPresence();for(const remote of this.remotes.values()){remote.sprite.destroy();remote.label.destroy();}this.remotes.clear();});
      this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{offBlock();offDirection();reset();motion.removeEventListener('change',syncMotion);canvas.removeEventListener('keydown',keydown);canvas.removeEventListener('keyup',keyup);canvas.removeEventListener('blur',reset);canvas.removeEventListener('pointerdown',focus);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);});
      host.dataset.localX=this.bee.x.toFixed(1);host.dataset.localY=this.bee.y.toFixed(1);host.dataset.facing=String(this.facing);
      host.dataset.sceneReady='true';bridge.emit('ready',undefined);
    }
    private steer(){
      if(!this.bee?.body||disposed)return 0;
      const allowed=!this.blocked&&(!bridge.presence||bridge.presence.controlled)&&!document.hidden&&document.activeElement===this.game.canvas;
      const x=allowed?(Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft'))+this.touch.x):0;
      const y=allowed?(Number(this.keys.has('s')||this.keys.has('arrowdown'))-Number(this.keys.has('w')||this.keys.has('arrowup'))+this.touch.y):0;
      const length=Math.hypot(x,y);this.bee.setVelocity(length?x/length*170:0,length?y/length*170:0);
      if(length)this.facing=Math.abs(x)>Math.abs(y)?(x>0?1:3):(y>0?2:0);
      return length;
    }
    update(time:number){
      if(!this.bee?.body||disposed)return;
      const presence=bridge.presence;
      if(presence){
        if(presence.epoch!==this.renderedEpoch){for(const remote of this.remotes.values()){remote.sprite.destroy();remote.label.destroy();}this.remotes.clear();this.initializedPlayer=null;this.reconciliation={x:0,y:0};this.renderedEpoch=presence.epoch;}
        if(presence.controlled&&!this.correction&&!canTravel(this.previous.x,this.previous.y,this.bee.x,this.bee.y)){
          if(canTravel(this.previous.x,this.previous.y,this.bee.x,this.previous.y))this.bee.setY(this.previous.y);
          else if(canTravel(this.previous.x,this.previous.y,this.previous.x,this.bee.y))this.bee.setX(this.previous.x);
          else this.bee.setPosition(this.previous.x,this.previous.y);
        }
        const ids=new Set(presence.players.filter(p=>p.playerId!==presence.playerId).map(p=>p.playerId));
        for(const [id,remote] of this.remotes)if(!ids.has(id)){remote.sprite.destroy();remote.label.destroy();this.remotes.delete(id);}
        for(const player of presence.players){
          if(player.playerId===presence.playerId){if(!presence.controlled||this.initializedPlayer!==player.playerId){this.bee.setPosition(player.x,player.y);this.previous={x:player.x,y:player.y};this.initializedPlayer=player.playerId;}continue;}
          let remote=this.remotes.get(player.playerId);
          if(!remote){
            const sprite=this.add.sprite(player.x,player.y,'bee').setScale(.82).setInteractive();
            const name=`Bee ${player.playerId.slice(0,4)}`;
            const label=this.add.text(player.x,player.y-30,name,{fontFamily:'Segoe UI, sans-serif',fontSize:'12px',color:'#234a3b',backgroundColor:'#f5f0db',padding:{x:5,y:2}}).setOrigin(.5,1).setAlpha(.9);
            sprite.on('pointerover',()=>{const team=this.remotes.get(player.playerId)?.target.teamId;label.setText(name+(team?` · Team ${team.slice(0,4)}`:''));});
            sprite.on('pointerout',()=>label.setText(name));
            remote={sprite,label,from:{x:player.x,y:player.y},target:player,at:time};this.remotes.set(player.playerId,remote);
          }
          if(remote.target!==player){remote.from={x:remote.sprite.x,y:remote.sprite.y};remote.target=player;remote.at=time;}
          const point=interpolatePosition(remote.from,remote.target,time-remote.at);remote.sprite.setPosition(point.x,point.y).setDepth(point.y);remote.label.setPosition(point.x,point.y-30).setDepth(point.y+1);
          const facing=['north','east','south','west'].indexOf(player.facing);
          if(this.reducedMotion)remote.sprite.stop().setFrame(facing*8);else remote.sprite.play(`${player.movement==='moving'&&time-remote.at<250?'fly':'idle'}-${facing}`,true);
        }
        host.dataset.remoteCount=String(this.remotes.size);host.dataset.fps=this.game.loop.actualFps.toFixed(1);
      }
      if(this.correction){const p=this.correction;this.correction=undefined;if(Math.hypot(p.x-this.bee.x,p.y-this.bee.y)>80){this.bee.setPosition(p.x,p.y);this.reconciliation={x:0,y:0};}else this.reconciliation={x:p.x-this.bee.x,y:p.y-this.bee.y};}
      if(presence?.controlled){const offset=this.reconciliation;this.bee.setPosition(this.bee.x+offset.x*.35,this.bee.y+offset.y*.35);offset.x*=.65;offset.y*=.65;if(Math.hypot(offset.x,offset.y)<.1)this.reconciliation={x:0,y:0};}else this.reconciliation={x:0,y:0};
      const length=this.steer();
      const observed=presence&&!presence.controlled?presence.players.find(p=>p.playerId===presence.playerId):undefined;
      if(observed)this.facing=['north','east','south','west'].indexOf(observed.facing);
      if(this.reducedMotion)this.bee.stop().setFrame(this.facing*8);else this.bee.play(`${observed?observed.movement==='moving'?'fly':'idle':length?'fly':'idle'}-${this.facing}`,true);
      this.bee.setDepth(this.bee.y);
      this.bee.setPosition(Phaser.Math.Clamp(this.bee.x,42,2006),Phaser.Math.Clamp(this.bee.y,42,1494));
      this.previous={x:this.bee.x,y:this.bee.y};
      bridge.emit('pose',{x:this.bee.x,y:this.bee.y,facing:(['north','east','south','west'] as const)[this.facing],movement:length?'moving':'idle'});
      const zone=interactionAt(mapData,{x:this.bee.x,y:this.bee.y});
      if((zone?.entityId??null)!==this.nearby){this.nearby=zone?.entityId??null;bridge.emit('nearby',this.nearby);}
      // Bounded browser diagnostics; server validation remains authoritative for pose proposals.
      if(time-this.lastSample>100){this.lastSample=time;host.dataset.localX=this.bee.x.toFixed(1);host.dataset.localY=this.bee.y.toFixed(1);host.dataset.facing=String(this.facing);host.dataset.nearby=this.nearby??'';host.dataset.localPlayerId=presence?.playerId??'';host.dataset.remotePositions=JSON.stringify([...this.remotes].map(([playerId,r])=>({playerId,x:r.sprite.x,y:r.sprite.y})));}
    }
  }
  const game=new Phaser.Game({type:Phaser.AUTO,parent:host,width:1024,height:680,backgroundColor:'#a7b88a',antialias:true,fps:{target:60,min:30,smoothStep:true,deltaHistory:3},
    audio:{noAudio:true},physics:{default:'arcade',arcade:{gravity:{x:0,y:0},debug:false}},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[HoneyvilleScene]});
  return ()=>{disposed=true;for(const scene of game.scene.getScenes(true))scene.scene.stop();game.destroy(true);delete host.dataset.sceneReady;host.replaceChildren();};
}
