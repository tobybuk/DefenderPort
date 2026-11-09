import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, Script } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';

// This is the REAL Stage 64 host-side AI function, extracted from the
// shipping adapter. All source game routines remain untouched.
const source = readFileSync(new URL('../browser/flight.js', import.meta.url), 'utf8');
const begin = source.indexOf('function createAttractPilot()');
const end = source.indexOf('const attractPilot=createAttractPilot();', begin);
assert.ok(begin>0&&end>begin, 'AI controller lives strictly in browser adapter');
const factory = new Script(source.slice(begin,end)+'\ncreateAttractPilot;').runInContext(createContext({}));
const off={OPTR:10, SPTR:12, OLINK:2,OPICT:4,OCVECT:6,OXV:8,OYV:10,OY16:12,OBJX:14};
const layout={at:n=>off[n]??0};
function fixture({shipY=112,shipX=0x3000,shipVX=0,shipDir=0x300,
 bombs=3,ships=3,enemies=[{x:0x4700,y:112,label:'LNDP1'}],shells=[],wave=1}={}){
 const mem=new Map([[off.OPTR,enemies.length?1000:0],[off.SPTR,shells.length?6000:0]]);
 const game={x:32,worldX:shipX,y:shipY,play16:shipY<<8,vx:shipVX,vy:0,
  direction:shipDir,smartBombs:bombs,shipsInReserve:ships,smartBombActive:0,
  reverseActive:0,gameOver:false,playerDeathActive:false,
  hyperspaceActive:false,bonus:null,wave:{wave}};
 const desc=enemies.map((e,i)=>{
  const object=1000+i*40;
  const sx=(e.screenX??Math.round(32+((e.x-shipX+32768&65535)-32768)/64));
  const y=e.y??112;
  mem.set(object+off.OLINK,i+1===enemies.length?0:object+40);
  mem.set(object+off.OPICT,0xe140);
  mem.set(object+off.OCVECT,e.carrier?0xe22a:0xe228);
  mem.set(object+off.OXV,(e.vx??0)&65535);
  mem.set(object+off.OYV,Math.round((e.vy??0)*256)&65535);
  mem.set(object+off.OY16,(y<<8)&65535);
  mem.set(object+off.OBJX,(sx>0&&sx<154)?((sx<<8)|y):0);
  return {object,worldX:e.x&65535,y,label:e.label??'LNDP1',video:mem.get(object+off.OBJX)};
 });
 for(let i=0;i<shells.length;i++){
  const b=shells[i],object=6000+i*40;
  mem.set(object+off.OLINK,i+1===shells.length?0:object+40);
  mem.set(object+off.OBJX,(b.x<<8)|b.y);
  mem.set(object+off.OXV,Math.round((b.vx??0)*256)&65535);
  mem.set(object+off.OYV,Math.round((b.vy??0)*256)&65535);
 }
 const ram={read16:x=>mem.get(x&65535)??0,read8:x=>
  (mem.has(x)?(mem.get(x)>>>8):0)};
 return {game,enemies:desc,astronauts:{living:[]},ram,layout,mem};
}
const sample=(pilot,f)=>pilot.sample(f.game,f.enemies,f.astronauts,f.ram,f.layout);

test('1px target flutter cannot make the craft oscillate',()=>{
 const pilot=factory(),f=fixture({shipY:112});
 const outputs=[];
 for(let i=0;i<180;i++){
  f.enemies[0].y=111+(i&1);
  f.enemies[0].video=(f.enemies[0].video&0xff00)|f.enemies[0].y;
  f.mem.set(f.enemies[0].object+off.OY16,f.enemies[0].y<<8);
  outputs.push(sample(pilot,f));
 }
 assert.equal(outputs.filter(c=>c.up||c.down).length,0);
});
test('distant enemy is actively pursued instead of waiting for it',()=>{
 const p=factory(),f=fixture({shipX:0x3000,shipVX:0,enemies:[{x:0x4900,y:112}]});
 const out=Array.from({length:120},()=>sample(p,f));
 assert.ok(out.filter(v=>v.thrust).length>80);
 assert.match(p.state().reason,/HUNT/);
});
test('empty space is actively patrolled without permanent stationary periods',()=>{
 const p=factory(),f=fixture({enemies:[]});
 const outputs=[];
 for(let i=0;i<450;i++){
  const c=sample(p,f);outputs.push(c);
  if(c.reverse)f.game.direction=(f.game.direction&0x8000)?0x300:0xfd00;
  if(c.up)f.game.y--;if(c.down)f.game.y++;
 }
 assert.ok(outputs.filter(c=>c.thrust).length>370);
 assert.ok(outputs.some(c=>c.up));
 assert.ok(outputs.some(c=>c.down));
});
test('an overhead descending enemy prompts DOWN evasive steering',()=>{
 const p=factory(),f=fixture({shipY:115,enemies:[{x:0x3450,y:78,vy:3,vx:-100}]});
 const c=sample(p,f);
 assert.equal(c.down,true);assert.equal(c.up,false);
 assert.match(p.state().reason,/EVADE/);
});
test('an enemy rising from below prompts UP steering',()=>{
 const p=factory(),f=fixture({shipY:115,enemies:[{x:0x3450,y:145,vy:-3,vx:-100}]});
 const c=sample(p,f);
 assert.equal(c.up,true);assert.equal(c.down,false);
});
test('incoming shell (original SPTR) is treated as a collision hazard',()=>{
 const p=factory(),f=fixture({shipY:115,enemies:[],shells:[{x:37,y:84,vx:-.6,vy:4}]});
 const c=sample(p,f);
 assert.equal(c.down,true);
 assert.match(p.state().reason,/PROJECTILE/);
});
test('laser uses source NPLAYC+4 height and repeats via regular rising edges',()=>{
 const p=factory(),f=fixture({shipY:112,enemies:[{x:0x3d00,y:111}]});
 const r=Array.from({length:36},()=>sample(p,f));
 const fired=r.filter(c=>c.fire).length;
 assert.ok(fired>=10&&fired<=18,`must use normal rising edges, got ${fired}`);
 assert.ok(r.every((v,i)=>i===0||!v.fire||!r[i-1].fire),'never hold FIRE across consecutive PIA scans');
});
test('misaligned target is not blindly fired at',()=>{
 const p=factory(),f=fixture({shipY:110,enemies:[{x:0x3d00,y:177}]});
 for(let i=0;i<100;i++)assert.equal(sample(p,f).fire,false);
});
test('abductor takes target priority even when another enemy is closer',()=>{
 const p=factory(),f=fixture({enemies:[
  {x:0x3100,y:112,label:'UFOP1'},
  {x:0x7100,y:70,label:'LNDP1',carrier:true}]});
 sample(p,f);
 assert.equal(p.state().targetId,f.enemies[1].object);
 assert.equal(p.state().carrierPursuit,true);
});
test('never spend a smart bomb on an 8-enemy formation or off-screen enemies',()=>{
 const p=factory();
 const a=fixture({enemies:Array.from({length:8},(_,i)=>({x:0x3200+i*180,y:82+i*5}))});
 for(let i=0;i<2500;i++)assert.equal(sample(p,a).smartBomb,false);
 const q=factory();
 const b=fixture({enemies:Array.from({length:16},(_,i)=>({x:0xb000+i*60,y:82+i*5}))});
 for(let i=0;i<1500;i++)assert.equal(sample(q,b).smartBomb,false);
});
test('rare 15-visible-enemy bonanza allows only one bomb per wave',()=>{
 const p=factory(),f=fixture({enemies:Array.from({length:15},(_,i)=>({x:0x3200+i*220,y:85+i*8}))});
 let total=0;
 for(let i=0;i<3600;i++)total+=sample(p,f).smartBomb?1:0;
 assert.equal(total,1);
});
test('the last smart bomb is conserved even in a 13-target encounter',()=>{
 const p=factory(),f=fixture({bombs:1,enemies:Array.from({length:13},(_,i)=>({x:0x3200+i*220,y:85+i*8}))});
 for(let i=0;i<1600;i++)assert.equal(sample(p,f).smartBomb,false);
});
test('hyperspace is never used merely because two enemies approach',()=>{
 const p=factory(),f=fixture({enemies:[{x:0x3100,y:111},{x:0x2f00,y:112}]});
 for(let i=0;i<2400;i++)assert.equal(sample(p,f).hyperspace,false);
});
test('normal game-over/death state sends no controls and reset clears history',()=>{
 const p=factory(),f=fixture();sample(p,f);p.reset();assert.equal(p.state().ticks,0);
 f.game.playerDeathActive=true;
 assert.ok(Object.values(sample(p,f)).every(v=>v===false));
});
test('actual source engine: pilot survives opening 3,000 ticks and scores meaningful hits without special rules',()=>{
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});
 h.RESET();const p=factory();let thrust=0,smart=0,hyper=0,initialShots=0;
 for(let i=0;i<3000;i++){
  const c=p.sample(h.STATE(),h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
  thrust+=+c.thrust;smart+=+c.smartBomb;hyper+=+c.hyperspace;
  h.INPUT(c);h.STEP();
  if(h.STATE().gameOver)break;
 }
 const endState=h.STATE();
 assert.equal(endState.gameOver,false, 'must not lose all three ships in opening 3000 source ticks');
 assert.ok(endState.laserShots>=25, 'must shoot actively');
 // Stage 69 deliberately coasts during stand-off aiming instead of
 // thrusting blindly past the target; measure active play as well as thrust.
 assert.ok(thrust>=2250,'must hunt rather than sit and wait (at least 75% thrust)');
 assert.ok(endState.laserHits>=8,'normal engine must register repeated conventional hits');
 assert.ok(endState.scoreBCD.some(x=>x!==0),'must achieve real engine score');
 assert.equal(smart,0,'no cheap bomb in ordinary opening wave');
 assert.equal(hyper,0,'no hyperspace shortcut');
});
