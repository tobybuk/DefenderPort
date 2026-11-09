/** Offline policy-selection arena. These are genuine 6809-transliterated
 * processes and physics, with only the initial scene arranged for testing.
 * Starts are divided by position/height/seed; reports kills and player deaths.
 */
import {readFileSync} from 'node:fs';import {Script,createContext} from 'node:vm';import {createFlightHarness} from '../demo/flight-harness.js';
const paths=process.argv.slice(2);for(const path of paths){const src=readFileSync(path,'utf8'),a=src.indexOf('function createAttractPilot()'),b=src.indexOf('const attractPilot=createAttractPilot();',a),create=new Script(src.slice(a,b)+';createAttractPilot').runInContext(createContext({}));const out=[];
for(let i=0;i<48;i++){
 const dx=[6,14,25,38,55,75][i%6],dy=[-30,-55,-80,-100][Math.floor(i/6)%4],seedJ=Math.floor(i/24);
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});h.RESET();let seed=h.RANDOM_STATE();h.RESET(null,{...seed,seed:(seed.seed+i*41)&255,hseed:(seed.hseed+i*17)&255,lseed:(seed.lseed+i*83)&255});const lay=h.Layout,ram=h.ram,at=n=>lay.at(n),s=h.STATE();
 for(const e of h.ENEMY_STATE())if(e.object)ram.write16(e.object+at('OX16'),(s.worldX+25000)&65535);
 const {object:x}=h.mutantStart.SCZST(1)[0];ram.write16(x+at('OX16'),(s.worldX+dx*64)&65535);
 ram.write16(x+at('OY16'),(Math.max(47,Math.min(225,s.y+dy))<<8));
 const p=create();let kill=-1,death=-1,shots=0,flips=0,prevDir=0,everOnScreen=0,mutantMissing=0,offscreen=0,lastHits=0,mutantHits=0;
 for(let t=0;t<360;t++){
 const state=h.STATE(),cmd=p.sample(state,h.ENEMY_STATE(),h.ASTRONAUT_STATE(),ram,lay);const yDir=cmd.up?-1:cmd.down?1:0;if(prevDir&&yDir&&prevDir!==yDir)flips++;if(yDir)prevDir=yDir;
 shots+=cmd.fire;const vid=ram.read16(x+at('OBJX'));if((vid>>>8)>0)everOnScreen++;else offscreen++;
 if(ram.read16(at('OPTR'))===0)mutantMissing++;
 h.INPUT(cmd);h.STEP();const n=h.STATE();if(n.laserHits>lastHits){if(ram.read16(x+at('OPICT'))!==0xe280)mutantHits+=n.laserHits-lastHits;}lastHits=n.laserHits;
 if(death<0&&n.playerDeaths>0)death=t;
 if(ram.read16(x+at('OPICT'))!==0xe280){kill=t;break;}
 if(n.gameOver)break;
 }
 out.push({i,dx,dy,seedJ,kill,death,shots,flips,everOnScreen,offscreen,mutantHits});
 }
 const kills=out.filter(x=>x.kill>=0).length,deaths=out.filter(x=>x.death>=0).length,slow=out.filter(x=>x.kill>=0).reduce((s,x)=>s+x.kill,0)/Math.max(1,kills);
 console.log(path,JSON.stringify({summary:{kills,deaths,slow,shotTotal:out.reduce((s,x)=>s+x.shots,0),flips:out.reduce((s,x)=>s+x.flips,0)},out}));}
