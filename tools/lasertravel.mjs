import {createFlightHarness} from '../demo/flight-harness.js';
for(let dist of [15,30,50,70,90]){
 const h=createFlightHarness({infiniteSmartBombs:false,playerCollisions:true,sourceCabinetInput:true});h.RESET();const a=n=>h.Layout.at(n),r=h.ram,s=h.STATE();const all=h.ENEMY_STATE();const enemies=all.filter(e=>e.label==='LNDP1');
 for(const e of enemies){r.write16(e.object+a('OX16'),(s.worldX+20000)&65535);}
 const e=enemies[0];r.write16(e.object+a('OX16'),(s.worldX+dist*64)&65535);r.write16(e.object+a('OY16'),(s.y<<8)&65535);r.write16(e.object+a('OXV'),0);r.write16(e.object+a('OYV'),0);
 for(let z=0;z<24;z++){h.INPUT({});h.STEP();}
 let screenY=h.ram.read16(e.object+a('OBJX'))&255;for(let key of ['PLAY16'])r.write16(a(key),(screenY-3)<<8);for(let key of ['NPLAYC','PLAYC'])r.write8(a(key),screenY-3);
 let firedAt=-1,hitAt=-1,shots=0;
 // debug current screen-state output for target
 console.log('obj',dist,h.ENEMY_STATE().find(v=>v.object===e.object));
 for(let i=0;i<110;i++){
   let state=h.STATE();let fire=i<3;h.INPUT({fire});h.STEP();let after=h.STATE();if(firedAt<0&&after.laserShots>0)firedAt=i;if(hitAt<0&&after.laserHits>0){hitAt=i;break;}
 }
 console.log({dist,firedAt,hitAt,travel:hitAt-firedAt});
}
