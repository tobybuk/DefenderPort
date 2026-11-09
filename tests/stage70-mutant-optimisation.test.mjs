/** Stage 70: checks the selected, empirically evaluated Mutant policy.
 * These fixtures exercise only source object observations and ordinary PIA
 * outputs. No original movement/collision routine is replaced or patched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script, createContext} from 'node:vm';
const file=readFileSync(new URL('../browser/flight.js', import.meta.url),'utf8');
const a=file.indexOf('function createAttractPilot()'),b=file.indexOf('const attractPilot=createAttractPilot();',a);
const create=new Script(file.slice(a,b)+';createAttractPilot').runInContext(createContext({}));
const offsets={OPTR:10,SPTR:12,OLINK:2,OPICT:4,OCVECT:6,OXV:8,OYV:10,OY16:12,OBJX:14,OX16:24,OBJID:16,PADDR:18,
 YMIN:42,YMAX:240};
const layout={at:key=>offsets[key]??0};
function fixture({mutX=40, mutY=56, shipY=130, shipVX=0, mutVX=-80, mutVY=0.5, additional=[]}={}){
 const shipWorld=0x3000,m=new Map(),en=[{dx:mutX,y:mutY,picture:0xe280,vx:mutVX,vy:mutVY},...additional];
 m.set(offsets.OPTR,1000);m.set(offsets.SPTR,0);
 const state={x:32,worldX:shipWorld,y:shipY,play16:shipY*256,vx:shipVX,direction:0x300,smartBombs:3,
  shipsInReserve:3,gameOver:false,playerDeathActive:false,hyperspaceActive:false,smartBombActive:0,bonus:null,wave:{wave:2}};
 const ids=[];en.forEach((e,i)=>{
  const id=1000+i*64,dx=e.dx,world=(shipWorld+dx*64)&65535,sx=32+dx,y=e.y;ids.push(id);
  const values={OLINK:i===en.length-1?0:id+64,OPICT:e.picture,OCVECT:0xe284,
   OXV:e.vx&65535,OYV:Math.round(e.vy*256)&65535,OX16:world,OY16:(y<<8),OBJX:sx>0&&sx<150?(sx<<8)|y:0};
  for(const [k,v] of Object.entries(values))m.set(id+offsets[k],v);
 });
 const ram={read16:x=>m.get(x&65535)??0,read8:x=>(m.get(x&65535)??0)>>>8};
 const astronauts={living:[]};
 return {ids,m,state,ram,astronauts,sample:pilot=>pilot.sample(state,[],astronauts,ram,layout)};
}
test('an ordinary reachable Mutant remains a shooting target without wasteful breakaway',()=>{
 const s=fixture({mutX:64,mutY:128,shipY:130,mutVY:0}),p=create();
 const commands=Array.from({length:22},()=>s.sample(p));
 assert.equal(p.state().mutPhase,'');
 assert.ok(commands.some(c=>c.fire),'normal laser shots still offered');
 assert.equal(p.state().targetId,s.ids[0]);
});
test('source YMAX-to-YMIN wrap is not interpreted as a 196-pixel tactical move',()=>{
 const s=fixture({mutX:80,mutY:45,shipY:70,mutVY:0}),p=create();
 s.sample(p);let last=0,flips=0,largest=0;
 for(let i=0;i<50;i++){
  const y=[44,43,240,44,45][i%5];
  s.m.set(s.ids[0]+offsets.OY16,(y<<8));s.m.set(s.ids[0]+offsets.OBJX,(112<<8)|y);
  const cmd=s.sample(p),v=cmd.up?-1:cmd.down?1:0;
  if(last&&v&&v!==last)flips++;if(v)last=v;
  largest=Math.max(largest,Math.abs(p.state().aim-70));
 }
 assert.ok(flips<=2,`wrapped Mutant caused ${flips} vertical reversals`);
 assert.ok(largest<45,`wrap was misinterpreted as a full screen move (${largest})`);
});
test('an attached passenger always overrides the Mutant fighter',()=>{
 const s=fixture({mutX:15,mutY:40,shipY:136}),p=create();
 const h=7000,proc=8200;s.astronauts.living=[{object:h,worldX:0x3000}];
 s.m.set(h+offsets.OBJID,proc);s.m.set(proc+offsets.PADDR,0xe29a);
 s.m.set(h+offsets.OCVECT,0xe234);
 for(let t=0;t<20;t++){const c=s.sample(p);assert.equal(c.up,false);assert.equal(c.thrust,false);assert.equal(p.state().mutPhase,'');}
 assert.equal(p.state().carrying,true);
});
test('the Mutant fighter cannot spend smart bombs or hyperspace during a duel',()=>{
 const s=fixture({mutX:20,mutY:40,shipY:145}),p=create();
 const cmds=Array.from({length:90},()=>{const c=s.sample(p);if(c.reverse)s.state.direction=0xfd00;return c;});
 assert.ok(cmds.some(c=>c.thrust));
 assert.equal(cmds.some(c=>c.smartBomb||c.hyperspace),false);
});
