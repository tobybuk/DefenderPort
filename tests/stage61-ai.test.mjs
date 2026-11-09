import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
const src=readFileSync(new URL('../browser/flight.js',import.meta.url),'utf8');
const start=src.indexOf('function createAttractPilot()');
const end=src.indexOf('const attractPilot=createAttractPilot();',start);
assert.ok(start!==-1&&end>start,'stage61 controller exists');
const create=runInNewContext(`${src.slice(start,end)}\ncreateAttractPilot;`);
const layout={at(name){return ({OPTR:10,OLINK:2,OPICT:4})[name]??0;}};
function make({enemyX=0x5000,enemyY=100,shipX=0x3000,shipY=100,ships=2,bombs=3,dir=0x300,extra=0}={}) {
 // A linked live enemy must have a genuine original OPICT pointer.
 const memory=new Map([[10,1000],[1002,0],[1004,0xe140]]);
 const enemies=[{object:1000,label:'LNDP1',worldX:enemyX,y:enemyY,
  video:((32+Math.round((enemyX-shipX)/64))<<8)|enemyY}];
 for(let i=0;i<extra;i++){
  const obj=1001+i*10;memory.set(1002,obj);memory.set(obj+2,0);memory.set(obj+4,0xe140);
  enemies.push({object:obj,label:'SCZP1',worldX:shipX+100+i*150,y:shipY+2});
 }
 const game={x:32,worldX:shipX,y:shipY,vy:0,vx:0,direction:dir,smartBombs:bombs,
  playerDeathActive:false,gameOver:false,hyperspaceActive:false,bonus:null,reverseActive:0};
 const ram={read16(n){return memory.get(n)||0;}};
 return {game,enemies,ram};
}
test('pilot returns ordinary switch fields and never changes game snapshot',()=>{
 const pilot=create();const fixture=make();const before=JSON.stringify(fixture.game);
 const input=pilot.sample(fixture.game,fixture.enemies,{living:[]},fixture.ram,layout);
 assert.deepEqual(Object.keys(input).sort(),['down','fire','hyperspace','reverse','smartBomb','thrust','up'].sort());
 assert.equal(JSON.stringify(fixture.game),before);
});
test('pilot fires through switch pulse when facing aligned target',()=>{
 const pilot=create();const f=make({enemyX:0x3900});
 const results=Array.from({length:16},()=>pilot.sample(f.game,f.enemies,{living:[]},f.ram,layout));
 assert.ok(results.some(i=>i.fire));assert.ok(results.some(i=>!i.fire));
});
test('pilot attempts source switch reverse and releases it',()=>{
 const pilot=create();const f=make({enemyX:0x1900});
 const results=Array.from({length:20},()=>pilot.sample(f.game,f.enemies,{living:[]},f.ram,layout));
 assert.ok(results.some(i=>i.reverse)); assert.ok(results.some(i=>!i.reverse));
});
test('pilot respects normal death/bonus/game-over phases',()=>{
 const pilot=create();const f=make();
 for(const property of ['gameOver','playerDeathActive','hyperspaceActive','bonus']){
  const state={...f.game,[property]:property==='bonus'?{phase:'hold'}:true};
  const input=pilot.sample(state,f.enemies,{living:[]},f.ram,layout);
  assert.ok(Object.values(input).every(v=>v===false),property);
 }
});
test('pilot cannot request smart bombs if source stock is zero',()=>{
 const pilot=create();const f=make({enemyX:0x3010,extra:3,bombs:0});
 for(let i=0;i<160;i++)assert.equal(pilot.sample(f.game,f.enemies,{living:[]},f.ram,layout).smartBomb,false);
});
test('pilot can track an object only while linked on live OPTR list',()=>{
 const pilot=create();const f=make();f.ram.read16=(n)=>n===1004?0xe140:0;
 const input=pilot.sample(f.game,f.enemies,{living:[]},f.ram,layout);
 assert.equal(pilot.state().targetId,0);
 assert.equal(input.smartBomb,false);
});

test('AI starts a real patrol rather than idling when the enemy list is empty',()=>{
 // Stage 68 reads the real OPTR list; clearing a stale adapter array no longer
 // makes active objects disappear. Clear OPTR to create an actual empty world.
 const pilot=create();const f=make();f.enemies.length=0;const oldRead=f.ram.read16;f.ram.read16=n=>n===10?0:oldRead(n);
 const moves=Array.from({length:24},()=>pilot.sample(f.game,f.enemies,{living:[]},f.ram,layout));
 assert.ok(moves.some(i=>i.thrust),'the pilot should accelerate during patrol');
 assert.match(pilot.state().reason,/SWEEP|PATROL/);
});
test('AI moves toward a distant live enemy rather than remaining stationary',()=>{
 const pilot=create();const f=make({enemyX:0x6800});
 const moves=Array.from({length:20},()=>pilot.sample(f.game,f.enemies,{living:[]},f.ram,layout));
 assert.ok(moves.some(i=>i.thrust));
 assert.equal(pilot.state().targetId,1000);
});
test('AI places a carrying Lander ahead of nearer ordinary enemies',()=>{
 const pilot=create();const f=make({enemyX:0x5b00});
 const carrier=1010;
 const extra={object:carrier,label:'LNDP1',worldX:0x6800,y:65};
 // Integrate second Lander in linked object list, with source LKIL1 vector.
 f.ram.read16=((old)=>n=>({1002:carrier,1012:0,1014:0xe140,1016:0xe22a}[n]??old(n)))(f.ram.read16);
 const extendedLayout={at(n){return ({OPTR:10,OLINK:2,OPICT:4,OCVECT:6,OXV:8,OYV:10})[n]??0;}};
 pilot.sample(f.game,[...f.enemies,extra],{living:[]},f.ram,extendedLayout);
 assert.equal(pilot.state().targetId,carrier);
 assert.equal(pilot.state().carrierPursuit,true);
});
test('AI avoids a direct collision trajectory rather than flying into target',()=>{
 const pilot=create();const f=make({enemyX:0x3200,enemyY:102,shipY:100});
 f.game.vx=135;
 const i=pilot.sample(f.game,f.enemies,{living:[]},f.ram,layout);
 assert.equal(i.thrust,false);
 assert.ok(i.up||i.down,'pilot must open a vertical safety gap');
 assert.match(pilot.state().reason,/DODGE|EVADE/);
});
test('AI shortcut exists in top cabinet toolbar and invokes normal pilot start',()=>{
 const html=readFileSync(new URL('../play.html',import.meta.url),'utf8');
 assert.match(html,/<button id="watchAI"/);
 assert.match(html,/getElementById\('watchAI'\)\.onclick\s*=\s*\(\)\s*=>\s*\{\s*startAttractPilot\(\)/);
});
