import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createFlightHarness } from '../demo/flight-harness.js';

// Run the EXACT shipping pilot extracted from the browser adapter.
const src=readFileSync(new URL('../browser/flight.js',import.meta.url),'utf8');
const a=src.indexOf('function createAttractPilot()'),b=src.indexOf('const attractPilot=createAttractPilot();',a);
assert.ok(a>=0&&b>a);
const create=new Script(src.slice(a,b)+';createAttractPilot').runInContext(createContext({}));
const off={OPTR:10,SPTR:12,OLINK:2,OPICT:4,OCVECT:6,OXV:8,OYV:10,OY16:12,OBJX:14,OBJID:16,PADDR:18};
const layout={at:k=>off[k]??0};
function scene({y=150,dx=40,enemyY=110,vx=-90,vy=.75,picture=0xe280}={}){
 const mem=new Map([[off.OPTR,1000],[off.SPTR,0]]), x=0x3000, ex=(x+dx*64)&0xffff, sx=32+dx;
 for(const [k,v] of Object.entries({OLINK:0,OPICT:picture,OCVECT:0xe284,OXV:vx&0xffff,OYV:(Math.round(vy*256)&65535),OY16:enemyY<<8,OBJX:(sx<<8)|enemyY}))mem.set(1000+off[k],v);
 const game={x:32,y,play16:y<<8,worldX:x,vx:0,vy:0,direction:0x300,smartBombs:3,shipsInReserve:2,smartBombActive:0,gameOver:false,playerDeathActive:false,hyperspaceActive:false,bonus:null,wave:{wave:2}};
 const enemies=[{object:1000,label:'LNDP1',worldX:ex,y:enemyY,video:(sx<<8)|enemyY}];
 return {mem,game,enemies,ram:{read16:a=>mem.get(a&0xffff)??0,read8:a=>(mem.get(a&0xffff)??0)>>>8},astronauts:{living:[]}};
}
const sample=(p,s)=>p.sample(s.game,s.enemies,s.astronauts,s.ram,layout);

test('mutant is recognised from its live picture even if its stale allocation label says Lander',()=>{
 const s=scene({dx:70,enemyY:150,vy:0}),p=create();
 const inputs=Array.from({length:20},()=>sample(p,s));
 assert.match(p.state().reason,/SCZP1/);
 assert.ok(inputs.some(c=>c.fire),'fire ordinary lasers when target occupies the beam corridor');
});

test('source-process opponent game remains finite and under original collision/weapon rules',()=>{
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true}),p=create();
 h.RESET();let nFire=0,nBomb=0,nHyper=0;
 for(let i=0;i<2200;i++){
  const c=p.sample(h.STATE(),h.ENEMY_STATE(),h.ASTRONAUT_STATE(),h.ram,h.Layout);
  nFire+=+c.fire;nBomb+=+c.smartBomb;nHyper+=+c.hyperspace;
  h.INPUT(c);h.STEP();if(h.STATE().gameOver)break;
 }
 assert.ok(nFire>10,'pilot must actively engage');
 assert.equal(nBomb,0,'reserve smart bombs for exceptionally large clusters');
 assert.equal(nHyper,0,'hyperspace is an absolute last resort');
 assert.ok(Number.isFinite(h.STATE().scoreHits));
});
