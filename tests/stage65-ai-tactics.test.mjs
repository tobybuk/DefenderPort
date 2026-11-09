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

// A visible fly-by must generate a legal fire *edge*, not simply select the
// target or hold FIRE down. This used to be a common visual failure.
test('shoots at an aligned enemy during a fast left-to-right fly-by',()=>{
 const p=factory(),f=fixture({shipY:112,enemies:[{x:0x3c00,y:111}]});
 let fire=0;
 for(let tick=0;tick<32;tick++){
  const object=f.enemies[0];
  object.worldX=(0x3c00-tick*125)&0xffff;
  const dx=((object.worldX-f.game.worldX+32768)&65535)-32768;
  const sx=Math.round(f.game.x+dx/64);
  object.video=(sx>0&&sx<154)?((sx<<8)|111):0;
  fire+=+sample(p,f).fire;
 }
 assert.ok(fire>=3,`passed an aligned enemy without enough laser attempts (${fire})`);
});

test('reverses to attack an enemy already behind the ship',()=>{
 const p=factory(),f=fixture({enemies:[{x:0x2900,y:111}]});
 const c=sample(p,f);
 assert.equal(c.reverse,true,'turn the existing gun rather than drifting away');
 f.game.direction=0xfd00; // source REV outcome from the normal engine
 const shots=Array.from({length:10},()=>sample(p,f));
 assert.ok(shots.some(s=>s.fire),'shoot after the ordinary reverse switch fires');
});

test('opportunistic fire is independent of currently selected distant target',()=>{
 const p=factory(),f=fixture({shipY:112,enemies:[
  {x:0x3e00,y:114,label:'UFOP1'},
  {x:0x7100,y:69,label:'LNDP1',carrier:true}
 ]});
 const outputs=Array.from({length:12},()=>sample(p,f));
 assert.equal(p.state().targetId,f.enemies[1].object,'distant carrier remains strategic target');
 assert.ok(outputs.some(c=>c.fire),'fire at immediate targets on the way');
});

test('detects a genuinely falling astronaut and commits to its intercept',()=>{
 const p=factory(),f=fixture({shipY:118,enemies:[{x:0x6f00,y:90,label:'UFOP1'}]});
 const human=7000,y=162,wx=0x3400;
 f.astronauts={living:[{object:human,worldX:wx,video:(45<<8)|y}]};
 f.mem.set(human+off.OCVECT,0xe234); // original AKIL1 pickup vector
 f.mem.set(human+off.OY16,y<<8);
 f.mem.set(human+off.OYV,0x0100); // falling 1 pixel/source tick
 const first=sample(p,f);
 assert.equal(p.state().rescueId,human);
 assert.match(p.state().reason,/RESCUE FALLING HUMAN/);
 assert.equal(first.down,true,'move towards intercept altitude');
 for(let i=0;i<14;i++){
  if(first.down)f.game.y++;
  sample(p,f);
 }
 assert.equal(p.state().rescueId,human,'do not discard a recoverable astronaut immediately');
});

test('an ascending Lander with a captive outranks an ordinary distant enemy',()=>{
 const p=factory(),f=fixture({shipY:115,enemies:[
  {x:0x3600,y:110,label:'UFOP1'},
  {x:0x5300,y:65,label:'LNDP1',carrier:true}
 ]});
 sample(p,f);
 assert.equal(p.state().targetId,f.enemies[1].object);
 assert.equal(p.state().carrierPursuit,true);
});

test('a one-pixel quantisation oscillation produces no ship oscillation',()=>{
 const p=factory(),f=fixture({shipY:112,enemies:[{x:0x4800,y:111}]});
 const moves=[];
 for(let t=0;t<180;t++){
  const e=f.enemies[0];e.y=111+(t&1);e.video=(e.video&0xff00)|e.y;
  f.mem.set(e.object+off.OY16,e.y<<8);
  moves.push(sample(p,f));
 }
 assert.equal(moves.filter(c=>c.up||c.down).length,0);
});

test('one observation never writes to the original source RAM',()=>{
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});
 h.RESET();const p=factory();
 const before=h.ram.snapshot(0,65536);
 p.sample(h.STATE(),h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
 const after=h.ram.snapshot(0,65536);
 assert.deepEqual(after,before,'the pilot may read source state, but cannot alter gameplay internals');
});

test('no emergency weapons are wasted in an ordinary 3000-tick real-engine game',()=>{
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});
 h.RESET();const p=factory();let bomb=0,hyper=0,fire=0;
 for(let i=0;i<3000;i++){
  const c=p.sample(h.STATE(),h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
  bomb+=+c.smartBomb;hyper+=+c.hyperspace;fire+=+c.fire;
  h.INPUT(c);h.STEP();if(h.STATE().gameOver)break;
 }
 assert.equal(bomb,0);assert.equal(hyper,0);
 assert.ok(fire>30,'sustained conventional engagement rather than hiding');
 assert.ok(h.STATE().scoreBCD.some(x=>x!==0),'must score real points');
});
