/** Stage 68 regressions: the original OPTR chain is the sole source of live
 * enemies, including original TIEST Bombers and PRBST Pods which never enter
 * the adapter's historical ENEMY_STATE() array. Only PIA controls are emitted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {createFlightHarness} from '../demo/flight-harness.js';
const source=readFileSync(new URL('../browser/flight.js',import.meta.url),'utf8');
const a=source.indexOf('function createAttractPilot()'),b=source.indexOf('const attractPilot=createAttractPilot();',a);
assert.ok(a>=0&&b>a);
const factory=new Script(source.slice(a,b)+';createAttractPilot').runInContext(createContext({}));
const offsets={OPTR:10,SPTR:12,OLINK:2,OPICT:4,OCVECT:6,OXV:8,OYV:10,OY16:12,OBJX:14,OX16:24};
const layout={at:k=>offsets[k]??0};
function scene({picture=0xe430,dx=65,dy=0,shipY=115,shipVX=0,enemyVX=0,enemyVY=0,shipDir=0x300}={}){
 const id=1000,worldX=0x3000, y=shipY+dy,x=worldX+dx*64, sx=32+dx;
 const memory=new Map([[offsets.OPTR,id],[offsets.SPTR,0],
    [id+offsets.OLINK,0],[id+offsets.OPICT,picture],[id+offsets.OXV,enemyVX&65535],
    [id+offsets.OYV,Math.round(enemyVY*256)&65535],
    [id+offsets.OY16,y<<8],[id+offsets.OX16,x&65535],
    [id+offsets.OBJX,sx>0&&sx<151?(sx<<8)|y:0]]);
 const ram={read16:p=>memory.get(p&65535)??0,read8:p=>(memory.get(p&65535)??0)>>>8};
 const game={x:32,y:shipY,play16:shipY<<8,worldX,vx:shipVX,vy:0,direction:shipDir,
    smartBombs:3,shipsInReserve:2,smartBombActive:0,gameOver:false,playerDeathActive:false,
    hyperspaceActive:false,bonus:null,wave:{wave:2}};
 const run=p=>p.sample(game,[],{living:[]},ram,layout);
 return {id,game,memory,ram,run};
}

test('all four original animated Bomber frames are recognised directly through OPTR, without ENEMY_STATE',()=>{
 for(const picture of [0xe430,0xe43a,0xe444,0xe44e]){
  const s=scene({picture,dx:65,dy:0}),p=factory();
  const commands=Array.from({length:8},()=>s.run(p));
  assert.equal(p.state().targetId,s.id,`TIE sprite ${picture.toString(16)} is live`);
  assert.match(p.state().reason,/TIEP1/);
  assert.ok(commands.some(c=>c.fire),'pilot offers conventional shots at a Bomber');
  assert.equal(commands.some(c=>c.smartBomb||c.hyperspace),false);
 }
});

test('source-created Bomber and Pod are visible to AI although absent from historical ENEMY_STATE',()=>{
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});h.RESET();
 const at=k=>h.Layout.at(k),s=h.STATE();
 // Outside-game fixture only: move the opening Landers out of pursuit range.
 for(const e of h.ENEMY_STATE())if(e.object)h.ram.write16(e.object+at('OX16'),(s.worldX+22000)&65535);
 const bomber=h.tie.TIEST(1)[0].object;
 const owner=h.procs.MKPROC(0xe200,at('STYPE')); // no stepping; only the original PRBST allocation
 const pod=h.probe.PRBST(1,owner)[0];
 for(const [id,dx] of [[bomber,70],[pod,60]]){
   h.ram.write16(id+at('OX16'),(s.worldX+dx*64)&65535);
   h.ram.write16(id+at('OY16'),(s.y-1)<<8);
   h.ram.write16(id+at('OBJX'),((s.x+dx)<<8)|(s.y-1));
 }
 assert.equal(h.ENEMY_STATE().some(e=>e.object===bomber||e.object===pod),false,
   'these original source spawns are omitted from the old adapter array');
 const pilot=factory();pilot.sample(s,h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
 assert.ok(pilot.state().observedClasses.TIEP1>0,'Bomber discovered from OPTR');
 assert.ok(pilot.state().observedClasses.PRBP1>0,'Pod discovered from OPTR');
});

test('a Pod is attacked at safe range, but never detonated immediately beside the ship',()=>{
 const far=scene({picture:0xe2ba,dx:88,dy:-1}),p=factory();
 const shots=Array.from({length:18},()=>far.run(p));
 assert.equal(p.state().targetId,far.id);
 assert.ok(shots.some(c=>c.fire),'attack a distant Pod with normal lasers');
 const near=scene({picture:0xe2ba,dx:18,dy:-1}),q=factory();
 const nearShots=Array.from({length:35},()=>near.run(q));
 assert.ok(nearShots.every(c=>!c.fire),'avoid spawning Swarmers at point blank range');
 assert.ok(q.state().podShotsDeclined>0);
});

test('a distant Mutant moving away above the ship does not trigger wasteful retreat',()=>{
 const s=scene({picture:0xe280,dx:100,dy:-80,shipY:150,enemyVX:160,enemyVY:-.3}),p=factory();
 s.run(p);
 assert.notEqual(p.state().combatPhase,'EXTEND');
});
