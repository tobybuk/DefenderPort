import {readFileSync} from 'node:fs';import {Script,createContext} from 'node:vm';import {createFlightHarness} from '../demo/flight-harness.js';
const path=process.argv[2]??'/mnt/data/defender_stage66/defender_stage66/browser/flight.js';let s=readFileSync(path,'utf8'),a=s.indexOf('function createAttractPilot()'),b=s.indexOf('const attractPilot=createAttractPilot();',a);const f=new Script(s.slice(a,b)+';createAttractPilot').runInContext(createContext({}));
let h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});h.RESET();let r=h.RANDOM_STATE(),seed=+(process.argv[3]??3);h.RESET(null,{...r,seed:(r.seed+seed*43)&255,hseed:(r.hseed+seed*11)&255,lseed:(r.lseed+seed*67)&255});let pilot=f();let prev=new Map();
for(let t=0;t<12000;t++){
 let st=h.STATE(),en=h.ENEMY_STATE(),a=h.ASTRONAUT_STATE(),cmd=pilot.sample(st,en,a,h.ram,h.Layout),state=pilot.state();
 let mutants=en.filter(e=>h.ram.read16(e.object+h.Layout.at('OPICT'))===0xe280).sort((a,b)=>Math.abs(a.worldX-st.worldX)-Math.abs(b.worldX-st.worldX));
 if(mutants.length&&t%12===0){let m=mutants[0],d=((m.worldX-st.worldX+32768)&65535)-32768;console.log(JSON.stringify({t,mode:state.reason,phase:state.combatPhase,sx:st.x,sy:st.y,sdir:(st.direction&0x8000)?-1:1,svx:st.vx,my:m.y,mx:m.video>>>8,mdx:Math.round(d/64),mvy:h.ram.read16(m.object+h.Layout.at('OYV')),aim:state.aim,cmd, wave:st.wave.wave}));}
 h.INPUT(cmd);h.STEP();if(h.STATE().gameOver)break;
}
