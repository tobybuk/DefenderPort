import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {createFlightHarness} from '../demo/flight-harness.js';
const file=process.argv[2]??new URL('../browser/flight.js',import.meta.url).pathname;
const src=readFileSync(file,'utf8');
const a=src.indexOf('function createAttractPilot()'),b=src.indexOf('const attractPilot=createAttractPilot();',a);
if(a<0||b<0)throw new Error('pilot missing');
const create=new Script(src.slice(a,b)+';createAttractPilot').runInContext(createContext({}));
for(const seed of [null]){
 const lab=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});
 lab.RESET(null,seed);
 const pilot=create();let lastFlipAt=-1000,fastFlips=0,flipGaps=[],count=0,up=0,down=0,flip=0,bombs=0,hypers=0,fire=0,thrust=0,reverse=0,previous='-',stills=0,lastX=null,lastShots=0;
 const begin=Date.now();
 for(let tick=0;tick<3000;tick++){
  const state=lab.STATE(),cmd=pilot.sample(state,lab.ENEMY_STATE(),lab.ASTRONAUT_STATE(),lab.ram,lab.Layout);
  const d=cmd.up?'U':cmd.down?'D':'-';
  if(d!=='-'&&previous!=='-'&&d!==previous){flip++;flipGaps.push(tick-lastFlipAt);if(tick-lastFlipAt<12){fastFlips++; console.error("FLIP",tick,"gap",tick-lastFlipAt,"from",previous,"to",d,"shipY",state.y,"target",pilot.state());}lastFlipAt=tick;}
  if(d!=='-')previous=d;
  up+=cmd.up;down+=cmd.down;thrust+=cmd.thrust;fire+=cmd.fire;
  bombs+=cmd.smartBomb;hypers+=cmd.hyperspace;reverse+=cmd.reverse;
  if(lastX!==null&&Math.abs((state.worldX-lastX+32768&65535)-32768)<1)stills++;
  lastX=state.worldX;
  lab.INPUT(cmd);
  lab.STEP();
  count++;
  if(tick%100===0){const s=lab.STATE();console.log('t',tick,'x',s.worldX,'y',s.y,'score',s.scoreBCD,'deaths',s.playerDeaths,'wave',s.wave.wave,'kills',s.laserHits,'shots',s.laserShots,'bomb',s.smartBombs,'target',pilot.state().targetId,'reason',pilot.state().reason,'controls',cmd,'time',Date.now()-begin)}
  if(lab.STATE().gameOver)break;
 }
 const end=lab.STATE();console.log('RESULT', {count,deaths:end.playerDeaths,wave:end.wave.wave,hits:end.laserHits,laserShots:end.laserShots,bombs,hypers,up,down,flip,thrust,fire,reverse,stills,fastFlips,shortestFlipGaps:flipGaps.sort((a,b)=>a-b).slice(0,20),timeMs:Date.now()-begin});
}
