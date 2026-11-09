import {readFileSync} from 'node:fs'; import {Script,createContext} from 'node:vm';import {createFlightHarness} from '../demo/flight-harness.js';
const paths=process.argv.slice(2); for(const path of paths){ const src=readFileSync(path,'utf8'),a=src.indexOf('function createAttractPilot()'),b=src.indexOf('const attractPilot=createAttractPilot();',a),make=new Script(src.slice(a,b)+';createAttractPilot').runInContext(createContext({}));const out=[];
for(let seed=0;seed<16;seed++){
 let lab=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});lab.RESET();let r=lab.RANDOM_STATE();lab.RESET(null,{...r,seed:(r.seed+seed*43)&255,hseed:(r.hseed+seed*11)&255,lseed:(r.lseed+seed*67)&255});let p=make(),on=0,mutantTicks=0,shots=0,hits=0,kills=0,failed=0,last=0,decisions=0,opp=0,escapes=0,closeMutantFrames=0;const at=k=>lab.Layout.at(k);
for(let t=0;t<12000;t++){
 const s=lab.STATE(),en=lab.ENEMY_STATE(),ram=lab.ram;let ob=ram.read16(at('OPTR')),seen=new Set(),m=[];for(let n=0;ob&&n<95&&!seen.has(ob);n++){seen.add(ob);const pic=ram.read16(ob+at('OPICT'));if(pic===0xe280||pic===0xe2c4){m.push(ob);}ob=ram.read16(ob+at('OLINK'));}
 const cmd=p.sample(s,en,lab.ASTRONAUT_STATE(),ram,lab.Layout);if(m.length){mutantTicks++;if(cmd.fire)shots++;if(p.state().reason?.includes('SCZP'))decisions++;if(p.state().combatPhase==='EXTEND')escapes++;}
 const close=m.some(o=>Math.abs(((ram.read16(o+at('OX16'))-s.worldX+32768)&65535)-32768)/64<100);if(close)closeMutantFrames++;
 lab.INPUT(cmd);lab.STEP();const next=lab.STATE();if(next.laserHits>last){if(m.some(o=>![0xe280,0xe2c4].includes(ram.read16(o+at('OPICT')))))kills++;hits+=next.laserHits-last;}last=next.laserHits;
 if(next.gameOver){on=t;break;}
}
const s=lab.STATE();out.push({seed,ticks:on,hits,kills,mutantTicks,closeMutantFrames,decisions,escapes,wave:s.wave.wave,dead:s.playerDeaths});
}console.log(path,JSON.stringify({summary:{meanHits:out.reduce((s,o)=>s+o.hits,0)/out.length,mutantKills:out.reduce((s,o)=>s+o.kills,0),mutantTicks:out.reduce((s,o)=>s+o.mutantTicks,0),closeMutantFrames:out.reduce((s,o)=>s+o.closeMutantFrames,0),decisions:out.reduce((s,o)=>s+o.decisions,0),escapes:out.reduce((s,o)=>s+o.escapes,0)},out}));}
