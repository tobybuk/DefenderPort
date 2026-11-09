import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {createFlightHarness} from '../demo/flight-harness.js';

// Run the exact shipping pilot, not a second simplified implementation.
const source=readFileSync(new URL('../browser/flight.js',import.meta.url),'utf8');
const first=source.indexOf('function createAttractPilot()');
const end=source.indexOf('const attractPilot=createAttractPilot();',first);
assert.ok(first>0&&end>first);
const create=new Script(source.slice(first,end)+';createAttractPilot;').runInContext(createContext({}));
const off={OPTR:10,SPTR:12,OLINK:2,OPICT:4,OCVECT:6,OXV:8,OYV:10,OY16:12,OBJX:14,OBJID:16,PADDR:18};
const layout={at:name=>off[name]??0};
function scenario({shipY=112,enemies=[{x:0x4c00,y:112,picture:0xe140,label:'LNDP1'}],shipDir=0x300}={}){
 const shipX=0x3000,mem=new Map([[off.OPTR,enemies.length?1000:0],[off.SPTR,0]]);
 const game={x:32,y:shipY,play16:shipY<<8,worldX:shipX,vx:0,vy:0,direction:shipDir,
     smartBombs:3,shipsInReserve:3,smartBombActive:0,gameOver:false,playerDeathActive:false,hyperspaceActive:false,bonus:null,wave:{wave:2}};
 const desc=enemies.map((e,i)=>{
  const id=1000+i*40,x=e.x??0x5000,y=e.y??112,sx=e.screenX??Math.round(32+(((x-shipX+32768)&65535)-32768)/64);
  mem.set(id+off.OLINK,i+1<enemies.length?id+40:0);
  mem.set(id+off.OPICT,e.picture??0xe140);
  mem.set(id+off.OCVECT,e.carrier?0xe22a:0xe228);
  mem.set(id+off.OXV,(e.vx??0)&65535);
  mem.set(id+off.OYV,Math.round((e.vy??0)*256)&65535);
  mem.set(id+off.OY16,(y<<8)&65535);
  mem.set(id+off.OBJX,(sx>=0&&sx<155)?((sx<<8)|y):0);
  return {object:id,label:e.label??'LNDP1',worldX:x,y,video:mem.get(id+off.OBJX)};
 });
 const ram={read16:a=>mem.get(a&65535)??0,read8:a=>(mem.get(a&65535)??0)>>>8};
 const astronauts={living:[]};
 return {game,desc,ram,astronauts,mem};
}
const update=(p,s)=>p.sample(s.game,s.desc,s.astronauts,s.ram,layout);

test('carried human: descend consistently until the ORIGINAL AFALL2 landing is complete',()=>{
 const s=scenario({shipY:130,enemies:[{x:0x4000,y:60,picture:0xe140}]});
 const astronaut=7000,proc=8200;
 s.astronauts.living=[{object:astronaut,worldX:0x3200,video:0}];
 s.mem.set(astronaut+off.OBJID,proc);s.mem.set(proc+off.PADDR,0xe29a);
 s.mem.set(astronaut+off.OCVECT,0xe234);s.mem.set(astronaut+off.OY16,0x8c00);
 const p=create();let up=0,down=0;
 for(let i=0;i<70;i++){
  const cmd=update(p,s);up+=+cmd.up;down+=+cmd.down;
  if(cmd.down){s.game.y=Math.min(230,s.game.y+2);s.game.play16=s.game.y<<8;}
  assert.match(p.state().reason,/DELIVER CARRIED HUMAN/);
  assert.equal(cmd.thrust,false,"don't chase enemies while carrying someone");
 }
 assert.equal(up,0,'never alternate upward during a committed delivery');
 assert.ok(down>28,'make sustained descent');
 assert.equal(p.state().carrying,true);
 // Simulate original ALAND output, not a fabricated AI pickup.
 s.mem.set(astronaut+off.OBJID,0);s.mem.set(astronaut+off.OCVECT,0xe232);
 update(p,s);
 assert.equal(p.state().completedDeliveries,1);
});

test('stale Lander descriptor that has mutated is classified by CURRENT OPICT',()=>{
 const s=scenario({enemies:[
  {x:0x4600,y:110,picture:0xe304,label:'LNDP1'}, // animation/explosion: NOT a target
  {x:0x4800,y:112,picture:0xe280,label:'LNDP1'}  // actual mutant sprite
 ]});
 const p=create();update(p,s);
 assert.equal(p.state().targetId,s.desc[1].object);
 assert.match(p.state().reason,/SCZP1/);
});

test('live bomber TIEP is sought and fired at, even with a stale original label',()=>{
 const s=scenario({enemies:[{x:0x3d00,y:111,picture:0xe430,label:'LNDP1'}]});
 const p=create(),cmds=Array.from({length:20},()=>update(p,s));
 assert.match(p.state().reason,/TIEP1/);
 assert.ok(cmds.filter(c=>c.fire).length>2,'should shoot at the Bomber');
});

test('close Pod is NEVER shot where spawned Swarmers would hit the player',()=>{
 // Stage 74: "close" is now under 16 columns (was 54); Pods at 20-50 columns
 // are deliberately engaged and the shield handles the released Swarmers.
 const close=scenario({enemies:[{x:0x3280,y:111,picture:0xe2ba,label:'LNDP1'}]});
 const p=create();
 const inputs=Array.from({length:40},()=>update(p,close));
 assert.ok(inputs.every(c=>!c.fire),'ordinary laser deliberately withheld at close Pod');
 assert.ok(p.state().podShotsDeclined>0);
 const far=scenario({enemies:[{x:0x4900,y:111,picture:0xe2ba,label:'PRBP1'}]});
 const q=create(),shots=Array.from({length:20},()=>update(q,far));
 assert.ok(shots.some(c=>c.fire),'Pod should be engaged safely from long range');
});

test('overhead approaching mutant triggers accelerate-away THEN reverse-to-fire phases',()=>{
 // Stage 73: Mutants are handled by the duel (SEPARATE, then SHOOT) rather
 // than the generic EXTEND/TURN_FIRE combat; the intent of this test is kept.
 const s=scenario({shipY:115,enemies:[{x:0x3500,y:82,picture:0xe280,label:'LNDP1',vx:-160,vy:0.8}]});
 const p=create();const opening=update(p,s);
 assert.equal(p.state().duelPhase,'SEPARATE');
 assert.equal(opening.reverse,true,'face away from an overhead enemy on the first source input scan');
 s.game.direction=0xfd00;
 let thrustSeen=false,turned=false;
 for(let i=0;i<84;i++){
  const c=update(p,s);thrustSeen||=c.thrust;
  if(p.state().duelPhase==='SHOOT')turned=true;
  // Simulate actual world-space separation on a sustained thrust pass.
  s.game.worldX=(s.game.worldX-0xc0)&65535;
  const d=((s.desc[0].worldX-s.game.worldX+32768)&65535)-32768;
  const sx=32+Math.round(d/64);
  s.desc[0].video=(sx>0&&sx<154)?(sx<<8)|82:0;
  s.mem.set(s.desc[0].object+off.OBJX,s.desc[0].video);
  if(turned&&c.reverse)break;
 }
 assert.equal(thrustSeen,true,'must build lateral clearance rather than charge the target');
 assert.equal(turned,true,'switch to aiming after opening distance');
});

test('original game is not patched; demo AI still uses finite weapons and normal collisions',()=>{
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});
 h.RESET();const p=create();let bomb=0,hyper=0;
 for(let i=0;i<3000;i++){
  const c=p.sample(h.STATE(),h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
  bomb+=+c.smartBomb;hyper+=+c.hyperspace;
  h.INPUT(c);h.STEP();if(h.STATE().gameOver)break;
 }
 assert.equal(bomb,0);assert.equal(hyper,0);
 assert.ok(h.STATE().laserShots>=20);
 assert.ok(h.STATE().laserHits>=8,'the actual game must register hits');
});
