/** Stage 71: investigate Mutant failure by checking source laser accessibility,
 * the *active* OPTR linked list and original collision accounting.
 * No source gameplay routine is altered by these fixtures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {createFlightHarness} from '../demo/flight-harness.js';
const src=readFileSync(new URL('../browser/flight.js',import.meta.url),'utf8');
const a=src.indexOf('function createAttractPilot()'), b=src.indexOf('const attractPilot=createAttractPilot();',a);
const make=new Script(src.slice(a,b)+';createAttractPilot').runInContext(createContext({}));
function inActiveObjects(h,id){const at=k=>h.Layout.at(k),ram=h.ram,seen=new Set();let p=ram.read16(at('OPTR'));for(let n=0;p&&n<95&&!seen.has(p);n++){if(p===id)return true;seen.add(p);p=ram.read16(p+at('OLINK'));}return false;}
function setup(i){
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});h.RESET();const seed=h.RANDOM_STATE();
 h.RESET(null,{...seed,seed:(seed.seed+(i+53)*57)&255,hseed:(seed.hseed+(i+53)*29)&255,lseed:(seed.lseed+(i+53)*37)&255});
 const s=h.STATE(),at=k=>h.Layout.at(k),r=h.ram;
 for(const e of h.ENEMY_STATE())if(e.object)r.write16(e.object+at('OX16'),(s.worldX+25000)&65535);
 const id=h.mutantStart.SCZST(1)[0].object;
 const dx=[10,20,30,45,60,85][i%6],dy=[-40,-60,-75,-95][Math.floor(i/6)%4];
 r.write16(id+at('OX16'),(s.worldX+dx*64)&65535);
 r.write16(id+at('OY16'),(Math.max(47,Math.min(225,s.y+dy))<<8));
 return {h,id};
}
test('real top-boundary Mutant is destroyed by standard laser with standard collision and input',()=>{
 const {h,id}=setup(44),pilot=make();let killed=false,offered=0;
 for(let tick=0;tick<360;tick++){
  const s=h.STATE(),cmd=pilot.sample(s,h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
  if(cmd.fire)offered++;
  assert.equal(cmd.smartBomb,false,'single Mutant never merits smart bomb');
  assert.equal(cmd.hyperspace,false,'single Mutant never merits hyperspace');
  h.INPUT(cmd);h.STEP();
  if(!inActiveObjects(h,id)&&h.STATE().laserHits>0){killed=true;break;}
 }
 assert.ok(offered>0,'AI fires real ordinary laser');
 assert.equal(killed,true,'Mutant at top must be destroyed, not chased forever');
});
test('retired source objects can retain their OPICT even after a confirmed hit',()=>{
 const {h,id}=setup(4),pilot=make(),at=k=>h.Layout.at(k);let hitAndRemoved=false;
 for(let tick=0;tick<360;tick++){
  const s=h.STATE(),cmd=pilot.sample(s,h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
  h.INPUT(cmd);h.STEP();
  if(!inActiveObjects(h,id)&&h.STATE().laserHits>0){hitAndRemoved=true;break;}
 }
 assert.equal(hitAndRemoved,true,'register hit and unlink Mutant from original OPTR');
 // It is NOT safe to demand a different OPICT after a source kill: the
 // unlinked record may still hold the old sprite pointer until reused.
 assert.equal(h.ram.read16(id+at('OPICT')),0xe280);
});
