/** Stage 72: the special escape is conditional on an actual collision forecast.
 * Only the external AI's switch commands change; the Williams Mutant, player,
 * laser, collision and input routines are never modified for the demo. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {createFlightHarness} from '../demo/flight-harness.js';
const src=readFileSync(new URL('../browser/flight.js',import.meta.url),'utf8');
const a=src.indexOf('function createAttractPilot()'),b=src.indexOf('const attractPilot=createAttractPilot();',a);
const make=new Script(src.slice(a,b)+';createAttractPilot').runInContext(createContext({}));
function arrange(dx,dy,seed=0){
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});
 h.RESET();const r=h.RANDOM_STATE();h.RESET(null,{...r,seed:(r.seed+seed*41)&255,hseed:(r.hseed+seed*17)&255,lseed:(r.lseed+seed*83)&255});
 const ram=h.ram,at=n=>h.Layout.at(n),s=h.STATE();
 for(const e of h.ENEMY_STATE())if(e.object)ram.write16(e.object+at('OX16'),(s.worldX+25000)&65535);
 const x=h.mutantStart.SCZST(1)[0].object;
 ram.write16(x+at('OX16'),(s.worldX+dx*64)&65535);
 ram.write16(x+at('OY16'),(Math.max(47,Math.min(225,s.y+dy))<<8));
 return {h,x};
}
test('a nearby Mutant falling onto the ship causes a sustained manoeuvre through ordinary controls',()=>{
 const {h}=arrange(6,-20),p=make();
 let committed=0,flips=0,last=0,shipDeaths=0;
 for(let t=0;t<28;t++){
  const s=h.STATE(),c=p.sample(s,h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
  if(p.state().mutPhase==='SEPARATE'||p.state().combatPhase==='EXTEND')committed++;
  const d=c.up?-1:c.down?1:0;if(d&&last&&d!==last)flips++;if(d)last=d;
  assert.equal(c.smartBomb,false);assert.equal(c.hyperspace,false);
  h.INPUT(c);h.STEP();shipDeaths=h.STATE().playerDeaths;
 }
 assert.ok(committed>=10,'AI should commit to escaping rather than alternating goals');
 assert.ok(flips<=4,'vertical steering must not chatter');
 assert.equal(shipDeaths,0,'ship survived the initial overhead interception');
});
test('close diving encounter does not need a smart bomb and is resolved by source laser',()=>{
 const {h,x}=arrange(6,-20,1),p=make();let dead=false,killed=false;
 for(let t=0;t<360;t++){
  const s=h.STATE(),c=p.sample(s,h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
  h.INPUT(c);h.STEP();dead||=h.STATE().playerDeaths>0;
  let q=h.ram.read16(h.Layout.at('OPTR')),seen=new Set(),live=false;
  while(q&&!seen.has(q)){seen.add(q);if(q===x){live=true;break;}q=h.ram.read16(q+h.Layout.at('OLINK'));}
  if(!live&&h.STATE().laserHits>0){killed=true;break;}
 }
 assert.equal(dead,false);
 assert.equal(killed,true);
});
