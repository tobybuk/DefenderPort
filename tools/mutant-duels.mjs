import {readFileSync} from 'node:fs';import {Script,createContext} from 'node:vm';import {createFlightHarness} from '../demo/flight-harness.js';
const paths=process.argv.slice(2).length?process.argv.slice(2):[new URL('../browser/flight.js',import.meta.url).pathname];
for(const path of paths){
 const src=readFileSync(path,'utf8'),a=src.indexOf('function createAttractPilot()'),b=src.indexOf('const attractPilot=createAttractPilot();',a),f=new Script(src.slice(a,b)+';createAttractPilot').runInContext(createContext({}));let results=[];
 for(let i=0;i<24;i++){
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});h.RESET();let seed=h.RANDOM_STATE();h.RESET(null,{...seed,seed:(seed.seed+i*41)&255,hseed:(seed.hseed+i*17)&255,lseed:(seed.lseed+i*83)&255});const lay=h.Layout,ram=h.ram,at=n=>lay.at(n),s=h.STATE();
 // Place other enemies far away, just as a test fixture to isolate combat.
 for(const e of h.ENEMY_STATE())if(e.object)ram.write16(e.object+at('OX16'),(s.worldX+21000)&65535);
 const {object:x}=h.mutantStart.SCZST(1)[0];const dx=([20,40,60,85,110,145][i%6]),vert=[-20,-45,-80,-115][Math.floor(i/6)%4];
 ram.write16(x+at('OX16'),(s.worldX+(i%2===0?1:-1)*dx*64)&65535);
 ram.write16(x+at('OY16'),(Math.max(47,Math.min(219,s.y+vert))<<8));
 const p=f();let hit=-1,death=-1,shots=0,phases=0,mutantSeen=0,prevHits=0,shotAtMutant=0;
 for(let t=0;t<430;t++){
 const state=h.STATE(),en=h.ENEMY_STATE();if(state.laserHits>prevHits)shotAtMutant+=state.laserHits-prevHits;prevHits=state.laserHits;
 const cmd=p.sample(state,en,h.ASTRONAUT_STATE(),ram,lay);phases+=p.state().combatPhase==='EXTEND';mutantSeen+= +(p.state().reason?.includes('SCZP1')||false);shots+=cmd.fire;
 h.INPUT(cmd);h.STEP();
 if(death<0&&h.STATE().playerDeaths>0)death=t;
 if(hit<0&&ram.read16(x+at('OPICT'))!==0xe280){hit=t;break;}
 if(h.STATE().gameOver)break;
 }
 results.push({i,dx,vert,hit,death,shots,phases,mutantSeen,shotAtMutant});
 }
 console.log(path, JSON.stringify({kills:results.filter(r=>r.hit>=0).length,deaths:results.filter(r=>r.death>=0).length,meanKillsAt:results.filter(r=>r.hit>=0).reduce((a,r)=>a+r.hit,0)/Math.max(1,results.filter(r=>r.hit>=0).length),results}));
}
