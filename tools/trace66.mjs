import {readFileSync} from 'node:fs';import {Script,createContext} from 'node:vm';import {createFlightHarness} from '../demo/flight-harness.js';
const path=process.argv[2]||'../browser/flight.js';const src=readFileSync(new URL(path,import.meta.url),'utf8');const start=src.indexOf('function createAttractPilot()'),end=src.indexOf('const attractPilot=createAttractPilot();',start);const f=new Script(src.slice(start,end)+';createAttractPilot').runInContext(createContext({}));
for(let seed=0;seed<4;seed++){
 const lab=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});lab.RESET();let r=lab.RANDOM_STATE();lab.RESET(null,{...r,seed:(r.seed+seed*43)&255,hseed:(r.hseed+seed*11)&255,lseed:(r.lseed+seed*67)&255});let p=f(),modes=new Map(),carryTicks=0,move=0,carryTransitions=0,was=false, shots=0;
 for(let t=0;t<12000;t++){
  let s=lab.STATE(),c=p.sample(s,lab.ENEMY_STATE(),lab.ASTRONAUT_STATE(),lab.ram,lab.Layout),ss=p.state();
  let a=ss.reason; modes.set(a,(modes.get(a)||0)+1); carryTicks+=+ss.carrying;carryTransitions+=+(!was&&ss.carrying);was=ss.carrying;move+=+c.thrust;shots+=+c.fire;
  lab.INPUT(c);lab.STEP();if(lab.STATE().gameOver)break;
 }
 const s=lab.STATE(),ss=p.state(); console.log(JSON.stringify({seed,gameOver:s.gameOver,dead:s.playerDeaths,hits:s.laserHits,score:s.scoreBCD,wave:s.wave.wave,humans:s.wave.astronautCount,stats:ss.stats,carrying:carryTicks,carryTransitions,deliveries:ss.completedDeliveries,attackTriggers:ss.tacticalTriggers, move,shots, topModes:Array.from(modes).sort((a,b)=>b[1]-a[1]).slice(0,15)}));
}
