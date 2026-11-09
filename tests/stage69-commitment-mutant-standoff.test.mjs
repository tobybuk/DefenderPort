/** Stage 69 pilot regressions. These tests use the exact shipped pilot and
 * synthetic RAM object records; no game engine control is patched or mocked.
 * Player commands are the same PIA input structure as real cabinet inputs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {createFlightHarness} from '../demo/flight-harness.js';

const source=readFileSync(new URL('../browser/flight.js',import.meta.url),'utf8');
const first=source.indexOf('function createAttractPilot()'),last=source.indexOf('const attractPilot=createAttractPilot();',first);
assert.ok(first>=0&&last>first);
const create=new Script(source.slice(first,last)+';createAttractPilot').runInContext(createContext({}));
const offsets={OPTR:10,SPTR:12,OLINK:2,OPICT:4,OCVECT:6,OXV:8,OYV:10,OY16:12,OBJX:14,OX16:24};
const layout={at:k=>offsets[k]??0};
function scene({shipY=150,shipDir=0x300,shipVX=0,enemies=[]}={}){
  const memory=new Map([[offsets.OPTR,enemies.length?1000:0],[offsets.SPTR,0]]);
  const shipWorld=0x3000;
  const game={x:32,y:shipY,play16:shipY<<8,worldX:shipWorld,vx:shipVX,vy:0,direction:shipDir,
    smartBombs:3,shipsInReserve:2,smartBombActive:0,gameOver:false,playerDeathActive:false,
    hyperspaceActive:false,bonus:null,wave:{wave:2}};
  const records=enemies.map((e,i)=>{
    const object=1000+i*64,dx=e.dx??75,y=shipY+(e.dy??0),worldX=(shipWorld+dx*64)&65535;
    const sx=32+dx;
    const values={OLINK:i===enemies.length-1?0:object+64,OPICT:e.picture??0xe140,
      OCVECT:e.carrier?0xe22a:0xe228,OXV:(e.vx??0)&65535,
      OYV:(Math.round((e.vy??0)*256)&65535),OY16:(y<<8)&65535,
      OX16:worldX,OBJX:sx>0&&sx<150?(sx<<8)|y:0};
    for(const [k,v] of Object.entries(values))memory.set(object+offsets[k],v);
    return {object,worldX,y};
  });
  const ram={read16:p=>memory.get(p&65535)??0,read8:p=>(memory.get(p&65535)??0)>>>8};
  return {game,memory,records,ram,run:p=>p.sample(game,[],{living:[]},ram,layout)};
}

test('nearby enemy stays selected instead of reversing for a distant, newly high-scoring carrier',()=>{
  const s=scene({shipY:150,enemies:[
    {dx:27,dy:0,picture:0xe140},{dx:-200,dy:-75,picture:0xe140}]});
  const pilot=create();s.run(pilot);
  const firstId=s.records[0].object,secondId=s.records[1].object;
  assert.equal(pilot.state().targetId,firstId,'the approaching enemy is selected');
  s.memory.set(secondId+offsets.OCVECT,0xe22a); // becomes carrier; no physical movement
  const commands=Array.from({length:25},()=>s.run(pilot));
  assert.equal(pilot.state().targetId,firstId,'do not abandon a live, very close target');
  assert.ok(commands.every(c=>!c.reverse),'no inexplicable U-turn for a distant enemy');
  // After destruction, normal selection MUST be allowed again.
  s.memory.set(firstId+offsets.OPICT,0);
  s.run(pilot);
  assert.equal(pilot.state().targetId,secondId,'destroyed target releases the attack commitment');
});

test('near target is not an unconditional lock: ordinary nearby threats remain selectable',()=>{
  const s=scene({enemies:[{dx:22,dy:0},{dx:-20,dy:0}]});
  const p=create();s.run(p);
  assert.equal(p.state().targetId,s.records[0].object);
  s.memory.set(s.records[0].object+offsets.OPICT,0);
  s.run(p);
  assert.equal(p.state().targetId,s.records[1].object);
});

test('Mutant one- and two-pixel bobbing does not make the ship continually reverse its vertical controls',()=>{
  const s=scene({shipY:136,enemies:[{dx:75,dy:-12,picture:0xe280}]});
  const p=create();let previous=0,flips=0;const moving=[];
  for(let i=0;i<90;i++){
    const y=124+(i%4===0?2:i%4===2?-2:0), id=s.records[0].object;
    s.memory.set(id+offsets.OY16,y<<8);
    s.memory.set(id+offsets.OBJX,(107<<8)|y);
    const cmd=s.run(p),direction=cmd.up?-1:cmd.down?1:0;
    if(previous&&direction&&previous!==direction)flips++;
    if(direction){previous=direction;moving.push(direction);s.game.y+=direction;s.game.play16=s.game.y<<8;}
  }
  assert.ok(flips<=1,`small Mutant bobbing caused ${flips} vertical reversals`);
  assert.equal(moving.filter(d=>d===-1).length>0,true,'pilot can still adjust to a genuine aiming error');
});

test('normal engine still recognises original collisions, finite resources and laser hits',()=>{
  const lab=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});
  lab.RESET();const p=create();let bomb=0,hyper=0;
  for(let i=0;i<2800;i++){
    const input=p.sample(lab.STATE(),lab.ENEMY_STATE(),lab.ASTRONAUT_STATE(),lab.ram,lab.Layout);
    bomb+=+input.smartBomb;hyper+=+input.hyperspace;
    lab.INPUT(input);lab.STEP();if(lab.STATE().gameOver)break;
  }
  assert.equal(bomb,0);assert.equal(hyper,0);
  assert.ok(lab.STATE().laserShots>=15);
  assert.ok(lab.STATE().scoreHits>=0);
});
