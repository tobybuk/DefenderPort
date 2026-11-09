import {readFileSync} from 'node:fs';import {Script,createContext} from 'node:vm';import {createFlightHarness} from '../demo/flight-harness.js';
const paths=process.argv.slice(2).length?process.argv.slice(2):['../browser/flight.js'];
for(const path of paths){
 const src=readFileSync(new URL(path, import.meta.url),'utf8'); const a=src.indexOf('function createAttractPilot()');const b=src.indexOf('const attractPilot=createAttractPilot();',a);const factory=new Script(src.slice(a,b)+';createAttractPilot').runInContext(createContext({}));
 let results=[];
 for(let seed=0;seed<4;seed++){
 const lab=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});lab.RESET();const saved=lab.RANDOM_STATE();lab.RESET(null,{...saved,seed:(saved.seed+seed*43)&255,hseed:(saved.hseed+seed*11)&255,lseed:(saved.lseed+seed*67)&255});
 const p=factory();let lastHits=0,totalHits=0,shots=0,lastShots=0,bombs=0,death=0,move=0,freeze=0,lostHumans=0,oldHumans=10,alive=0,seedTick=0,fallingFrames=0,activeCarriers=0,carrierPriority=0;
 let perWave=[];
 for(let t=0;t<12000;t++){
 const s=lab.STATE(),en=lab.ENEMY_STATE(),as=lab.ASTRONAUT_STATE(),cmd=p.sample(s,en,as,lab.ram,lab.Layout);
 if(as.count<oldHumans)lostHumans+=oldHumans-as.count;
 oldHumans=as.count;
 if(s.laserHits<lastHits)lastHits=0;
 totalHits+=s.laserHits-lastHits;lastHits=s.laserHits;
 if(s.laserShots<lastShots)lastShots=0;shots+=s.laserShots-lastShots;lastShots=s.laserShots;
 bombs+=+cmd.smartBomb;move+=+cmd.thrust; if(s.playerDeathActive||s.bonus)freeze++;
 if(t%1200===0)perWave.push({t,w:s.wave.wave,dead:s.playerDeaths,people:s.wave.astronautCount,hits:totalHits,shots});
 lab.INPUT(cmd);lab.STEP();seedTick=t+1;
 if(lab.STATE().gameOver)break;
 }
 const final=lab.STATE();results.push({seed,seedTick,wave:final.wave.wave,dead:final.playerDeaths,humans:final.wave.astronautCount,lostHumans,score:final.scoreBCD, hits:totalHits, shots,bombs,move,freeze,perWave});
 }
 console.log(path,JSON.stringify(results));
}
