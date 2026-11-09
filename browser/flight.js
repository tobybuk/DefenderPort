import { createFlightHarness } from '../demo/flight-harness.js';
import { createAmode1Attract } from '../original/amode1-attract.js';
import { createAmode1HallOfFame, decodePackedScore, validHallRows } from '../original/amode1-hall-of-fame.js';
import { DEFAULT_HALL_OF_FAME } from '../original/amode1-presentation-data.js';
import { presentFrame } from './video-presenter.js';
import { PHR6_LAYOUT } from '../runtime/phr6-layout.js';
import { createSourceFrameClock, VIDEO_CLOCK_HZ } from './source-clock.js';
import { createSourceProcessWorkbench } from '../demo/process-harness.js';
import { createSourceEnemyWorkbench } from '../demo/enemy-harness.js';
import { createSourceSoundOutput } from './source-sound-output.js';
import { createSourceLanderWorkbench } from '../demo/lander-harness.js';
import { createCabinetOperator, CABINET_DEFAULTS, OPERATOR_LABELS, AUDIT_LABELS } from './cabinet-operator.js';
import { createCabinetBoot, SERVICE_TESTS, drawCabinetService, createSourceTextBanner } from './cabinet-boot.js';
import { defenderDacRGB } from './defender-palette.js';
import { DEFENDER_VISIBLE } from './video-presenter.js';
import { TOUCH_ACTIONS, createTouchInputState, createFloatingJoystick, hybridJoystickKeys, createHybridReverseSequencer, createAltitudeController } from './touch-controls.js';
import { CONTROL_ACTIONS, DEFAULT_CONTROL_BINDINGS, loadControlBindings, saveControlBindings, assignControl, logicalKeyForCode, displayKeyName } from './control-bindings.js';
const audio = createSourceSoundOutput();
let cabinetStorage = null;
try { cabinetStorage = window.localStorage; } catch { /* file/opaque origins */ }
const cabinet = createCabinetOperator(cabinetStorage);
/* Stage 70: independent arcade demonstrator. Reads the original game state and
 * linked object/shell records, outputs ONLY regular player PIA switches via
 * lab.INPUT(). Neither collision, physics nor resource rules are modified.
 *
 * The controller is intentionally model-based rather than a shortest-distance
 * reactive chaser. It separates target acquisition, flight run, stable aiming,
 * and committed evasion. The 1981 game remains the sole authority for hits.
 */
/** Stage 70: host-side tactical opponent. The input boundary is the *only* actuator.
 * All objects are observed through source RAM; no game routines are patched.
 * Modes: emergency avoidance, intercept a falling astronaut, intercept an
 * abducting Lander, fly-by attack, pursuit, and patrol. They share one planner.
 */
function createAttractPilot() {
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const s16=v=>(v<<16)>>16;
    const delta=(a,b)=>((Math.round(a)-Math.round(b)+32768)&65535)-32768;
    const blank=()=>({thrust:false,up:false,down:false,reverse:false,fire:false,smartBomb:false,hyperspace:false});
    const height=e=>/UFOP|SWPIC|BMBP/.test(e.label)?4:/SCZP/.test(e.label)?8:8;
    const width=e=>/LNDP|SCZP/.test(e.label)?5:/UFOP/.test(e.label)?6:/TIEP|PRBP/.test(e.label)?4:8;
    // Source enemy shell records are reused. The label in ENEMY_STATE() was
    // captured at allocation time, not at this instant. The live OPICT field
    // (the original sprite pointer) is authoritative. Without this mapping
    // the pilot aims at explosions and fails to recognise mutated Landers.
    const enemyKind=pic=>{
        if(pic>=0xe140&&pic<=0xe154&&(pic-0xe140)%10===0)return 'LNDP1';
        if(pic===0xe280||pic===0xe2c4)return 'SCZP1';
        if(pic===0xe130)return 'SWPIC1';
        if(pic>=0xe100&&pic<=0xe114&&(pic-0xe100)%10===0)return 'UFOP1';
        if(pic>=0xe430&&pic<=0xe44e&&(pic-0xe430)%10===0)return 'TIEP1';
        if(pic===0xe2ba)return 'PRBP1';
        return null; // inert/explosion/asteroid/shot/astronaut: no target
    };
    let ticks,targetId,targetUntil,targetY,aimY,heading,reverseCooldown,lastFire;
    let mode,modeSince,patrolLane,patrolDir,patrolTick,evadeUntil,evadeY,evadeSource;
    let yDir,lastYChange,vertHoldUntil,previousLocations,bombLock,lastBombWave,hyperLock;
    let rescueId,rescueLock, lastEngagementTick, stats, lastEnemyShot, lastCarrierSelected;
    // Source-process passenger recognition plus a deliberately committed landing.
    let carrying,previousCarrying,completedDeliveries,lastCarriedId;
    // Tactical horizontal spacing manoeuvre: extend away, turn, shoot from range.
    let combatPhase,combatId,combatSince,combatUntil,combatEscapeDir,combatReengage,combatEscapeY;
    let tacticalTriggers, podShotsDeclined, observedClasses;
    let mutantLaneUntil, mutantLaneId, verticalRestUntil;
    // ---- Stage 73: Mutant duel and collision shield -------------------------
    // Facts from the translated source that the duel relies on (defb6-lander.js
    // SCZ0; defa7-player.js PLAYER/VELO), confirmed in the engine:
    //  * Every 3 ticks a Mutant sets OXV = +/-SZXV towards PLABX, so it always
    //    chases horizontally. SZXV grows during a wave (12 world units/tick at
    //    the start of wave 1; 44-96 later), so a ship starting from rest cannot
    //    outrun a late-wave Mutant for roughly 35 ticks.
    //  * It homes on the ship's height (OYV = +/-SZYV) only while
    //    PLABX-OX16+380 <= $700: from 22 columns LEFT of the ship's left edge to
    //    5 columns RIGHT of it. Elsewhere it holds itself >8px off the ship's line.
    //  * The laser is horizontal, so a Mutant overlapping the ship from above or
    //    below cannot be shot, and that is how every Mutant attack arrives.
    // The duel therefore keeps horizontal distance (SEPARATE) and fights only from
    // range (SHOOT). A final shield simulates those source rules for each
    // candidate input and refuses inputs that lead into a Mutant collision.
    const DUEL={engage:36,separateUntil:18,minGap:6,maxShoot:80,maxSeparate:110};
    const HOME_LEFT=-1412, HOME_RIGHT=380;        // OX16-PLABX homing window (SCZ0)
    const SHIP_COLS=8, SHIP_ROWS=6, MUT_COLS=5, MUT_ROWS=8;
    const SHIELD_HORIZON=40, SHIELD_TRIGGER=24, SHIP_TOP=43, SHIP_BOTTOM=238;
    // The shield also treats shells and other enemies as straight-line movers.
    const SHELL_COLS=2, SHELL_ROWS=3;
    const SHIELD_PLANS=[];
    for(const h of [0,-1,1])for(const v of [0,-1,1])SHIELD_PLANS.push({h,v});
    // ---- Stage 74: wave tactics ---------------------------------------------
    //  * Pods: PRBKIL releases 1-7 Swarmers at the Pod (MMSW). The shield copes
    //    with them, so Pods are hunted and shot from podMinRange columns out
    //    instead of being fled from.
    //  * Humans: a carried human (AFALL2) hangs 10px under the ship and lands
    //    only when that point passes the terrain altitude (GETALT). The highest
    //    terrain in ALTTBL is 160, so a ship at y<=keepFloor never sets him
    //    down. Landers cannot abduct a carried human, so when humans are scarce
    //    the pilot keeps one aboard: if ASTCNT reaches zero, TERBLO destroys the
    //    planet and every Lander becomes a Mutant.
    //  * Planet gone: let Mutants converge, then smart bomb when enough of them
    //    are on screen at once (SBOMB kills every on-screen enemy).
    //  * Baiters (UFOST) arrive faster once WVCHK counts <= 8 enemies, and don't
    //    count towards ending the wave. While they are present, finish the
    //    wave's other enemies first, but don't let Baiters accumulate.
    const TACTICS={podMinRange:16,keepHumansAt:3,keepFloor:148,gatherTarget:5,gatherReserve:2,gatherCooldown:150,
        baiterWaveBonus:140,baiterSwarm:3,baiterCloseCols:24,
        endgameEnemies:2,endgameBaiter:-260,lastHumanGuardCols:150,lastHumanGuard:260};
    let duelId,duelPhase,duelSince,duelShots,duelSide;
    let keepTicks,gatherBombs,lastGatherBomb,keepFloor=148,humanShotsHeld,hyperspaces;
    let shieldTriggers,shieldUntil,shieldPlan,emergencyBombs,lastEmergencyBomb,lastReverseTick;
    // Kept for observers of earlier stages: mutPhase/mutId mirror the duel.
    let mutId,mutPhase,mutShots;
    /** Simulate the ship holding `plan` = {h: thrust direction -1/0/+1
     * (0 = coast), v: -1 up / 0 hold / +1 down} for `horizon` ticks against
     * `obstacles`. Mutants follow the source SCZ0/VELO rules; shells and other
     * enemies keep their current velocity. Ship model measured from PLAYER:
     * thrust adds ~3 world units/tick per tick with 1/64 drag; vertical speed
     * starts at 1px/tick and rises by 1/32 to 2px/tick, with no inertia on
     * release. Returns the first overlap tick with a Mutant (mutantHit) and
     * with anything (hit), and the smallest clearance seen (pixels; one video
     * column counts as two pixels). */
    function simulatePlan(plan,ship,obstacles,speed,horizon){
        let x=0,y=ship.y,vx=ship.vx,vy=ship.vy,facing=ship.facing,revWait=ship.revWait;
        const os=obstacles.map(o=>({...o}));
        let hit=Infinity,mutantHit=Infinity,clear=Infinity,hitKind='';
        for(let t=1;t<=horizon&&hit===Infinity;t++){
            let thrust=0;
            if(plan.h){
                if(facing!==plan.h){if(revWait<=0)facing=plan.h;else revWait--;}
                else thrust=facing;
            }
            vx=clamp(vx-vx/64+thrust*3,-256,256);
            x+=vx;
            if(plan.v)vy=Math.sign(vy)===plan.v?plan.v*Math.min(2,Math.abs(vy)+1/32):plan.v;
            else vy=0;
            y=clamp(y+vy,SHIP_TOP,ship.bottom??SHIP_BOTTOM);
            for(const o of os){
                if(o.mutant){
                    const rel=o.x-x;
                    o.x+=rel>0?-speed.x:speed.x;
                    let mvy;
                    if(rel>=HOME_LEFT&&rel<=HOME_RIGHT)mvy=y>=o.y?speed.y:-speed.y;
                    else{const A=y-o.y;mvy=A>0?(A>8?0:-speed.y):(A>-8?speed.y:0);}
                    o.y+=mvy;
                }else if(o.kind==='swarmer'){
                    // MSWLP (every 3 ticks, spread per tick): accelerate by PD2
                    // towards PLAYC, clamp +/-2px, damp ~1/64; MSWM resets OXV to
                    // +/-SWXV towards PLABX only when more than 150*32 away.
                    const rel=o.x-x;
                    if(rel>4800||rel< -4800)o.vx=rel>0?-o.swxv:o.swxv;
                    o.vy=clamp(o.vy+(y<=o.y?-o.accel:o.accel)/3,-2,2)*(1-1/192);
                    o.x+=o.vx;o.y+=o.vy;
                }else if(o.kind==='baiter'){
                    // UFOLP: a Baiter flies straight and may re-aim (UFONV, when
                    // SEED>UFOSK) only as its UFOP1-3 animation wraps, every 18
                    // ticks. Assume each such chance is taken (cautious). UFONV0:
                    // beyond 20 columns OXV = PLAXV +/- $40 towards the ship;
                    // beyond 10px OYV = (+/-1px + PLAYV)/2 towards it.
                    if(t>=o.reaimAt){
                        o.reaimAt+=18;
                        const rel=o.x-x, dy=o.y-y;
                        if(rel>1280||rel< -1280)o.vx=vx+(rel>0?-64:64);
                        if(dy>10||dy< -10)o.vy=((dy>0?-1:1)+vy)/2;
                    }
                    o.x+=o.vx;o.y+=o.vy;
                }else{o.x+=o.vx;o.y+=o.vy;}
                const c=(o.x-x)/64,dy=o.y-y;
                const gx=Math.max(0,c>=0?c-SHIP_COLS:-c-o.w);
                const gy=Math.max(0,dy>=0?dy-SHIP_ROWS:-dy-o.h);
                if(gx<=0&&gy<=o.margin){
                    hit=t;hitKind=o.mutant?'mutant':o.kind||'other';if(o.mutant)mutantHit=t;
                    break;
                }
                clear=Math.min(clear,Math.max(gx*2,gy));
            }
        }
        return {hit,mutantHit,hitKind,clear,y};
    }
    function reset(){
        ticks=0;targetId=0;targetUntil=0;targetY=133;aimY=133;
        heading=1;reverseCooldown=0;lastFire=false;mode='INITIALISING';modeSince=0;
        patrolLane=88;patrolDir=1;patrolTick=0;evadeUntil=0;evadeY=null;evadeSource=0;
        yDir=0;lastYChange=-999;vertHoldUntil=0;previousLocations=new Map();
        bombLock=0;lastBombWave=-1;hyperLock=0;rescueId=0;rescueLock=0;
        lastEngagementTick=0;lastEnemyShot=-999;lastCarrierSelected=false;
        carrying=false;previousCarrying=false;completedDeliveries=0;lastCarriedId=0;
        combatPhase='';combatId=0;combatSince=0;combatUntil=0;combatEscapeDir=1;combatReengage=0;combatEscapeY=0;
        tacticalTriggers=0;podShotsDeclined=0;observedClasses={};
        mutantLaneUntil=0;mutantLaneId=0;verticalRestUntil=0;
        duelId=0;duelPhase='';duelSince=0;duelShots=0;duelSide=0;
        keepTicks=0;gatherBombs=0;lastGatherBomb=-999;humanShotsHeld=0;hyperspaces=0;
        shieldTriggers=0;shieldUntil=0;shieldPlan=null;emergencyBombs=0;lastEmergencyBomb=-999;lastReverseTick=-999;
        mutId=0;mutPhase='';mutShots=0;
        stats={shotsOffered:0,carriersPursued:0,rescuesPursued:0,targetChanges:0,passes:0};
    }
    reset();
    function sample(game,enemies,astronauts,ram,layout,terrain){
        ticks++;
        if(game.gameOver||game.playerDeathActive||game.hyperspaceActive||game.bonus){
            lastFire=false;mode='GAME TRANSITION';return blank();
        }
        const at=k=>layout.at(k),r16=(p,k)=>ram.read16((p+at(k))&65535);
        const r8=(p,k)=>typeof ram.read8==='function'
            ?ram.read8((p+at(k))&65535):ram.read16((p+at(k))&65535)>>>8;
        const facing=(game.direction&0x8000)?-1:1;
        const live=new Set();let p=ram.read16(at('OPTR'));
        for(let i=0;p&&i<95&&!live.has(p);i++){
            if(p<256||p>=65500)break;
            live.add(p);p=r16(p,'OLINK');
        }
        // Stage 78: OSCAN parks every object outside a 500-pixel band around
        // the screen on the inactive list IPTR. Those enemies are still on the
        // scanner, which a player reads; without them the pilot believed the
        // last enemies did not exist and patrolled in an arbitrary direction,
        // often the long way round the planet.
        const inactive=new Set();
        let ip=0;try{const ia=at('IPTR');if(Number.isInteger(ia))ip=ram.read16(ia);}catch{}
        for(let i=0;ip&&i<95&&!inactive.has(ip)&&!live.has(ip);i++){
            if(ip<256||ip>=65500)break;
            inactive.add(ip);ip=r16(ip,'OLINK');
        }
        for(const q of inactive)live.add(q);
        const shipX=game.worldX,shipY=game.y;
        // An astronaut in AFALL2 is physically attached to the PLAYER. Only
        // that exact original source process proves a passenger is aboard.
        // Unlike nearby falling/abducted humans it is a landing job, NOT a
        // target for another pursuit. AFALL2 normally ends at terrain contact.
        const passenger=(astronauts?.living||[]).find(h=>{
            if(!h.object)return false;
            const process=r16(h.object,'OBJID');
            return process && r16(process,'PADDR')===0xe29a;
        });
        carrying=!!passenger;
        if(previousCarrying&&!carrying&&lastCarriedId &&
           (astronauts?.living||[]).some(h=>h.object===lastCarriedId) &&
           r16(lastCarriedId,'OCVECT')===0xe232&&
           r16(lastCarriedId,'OBJID')===0){
            // ALAND actually completed; mere passenger loss/death isn't rescue.
            completedDeliveries++;
        }
        if(passenger)lastCarriedId=passenger.object;
        else if(!carrying)lastCarriedId=0;
        previousCarrying=carrying;
        const objs=[];
        // Stage 68 roster, retained: the adapter's ENEMY_STATE list is only a historical
        // allocation log. It omits native TIEST Bombers and PRBST Pods (as well
        // as some Swarmers). Walk the actual source OPTR chain, which is the
        // definitive live enemy roster, without changing game engine or
        // original object creation routines. Supplement only incomplete test
        // fixtures, which don't populate OX16 yet.
        const supplied=new Map((enemies||[]).map(e=>[e.object,e]));
        for(const object of live){
            const pic=r16(object,'OPICT');
            const currentLabel=enemyKind(pic);
            if(!currentLabel)continue;
            const hint=supplied.get(object);
            const rawWorld=r16(object,'OX16');
            const worldX=rawWorld || hint?.worldX || 0;
            const video=inactive.has(object)?0:(r16(object,'OBJX') || hint?.video || 0);
            const y=typeof ram.read8==='function'?r8(object,'OY16'):(hint?.y??(video&255));
            const vy=s16(r16(object,'OYV'))/256;
            const vx=s16(r16(object,'OXV'));
            const d=delta(worldX,shipX);
            const sx=video>>>8,sy=video&255;
            const visible=!!video&&sx>0&&sx<150&&sy>=42&&sy<237;
            const previous=previousLocations.get(object);
            // Estimate velocity over an 8-update window, rather than from
            // the last two quantised high-byte Y readings. A 1px up/down
            // alternation has a zero average and cannot whip the gun around.
            const mutant=currentLabel==='SCZP1';
            // Source VELO wraps objects from YMIN to YMAX (and back).
            // A Mutant hopping at YMIN appears to jump ~195 pixels each
            // update. Unwrap the observation history before estimating
            // velocity or commanding the ship's vertical steering.
            const yMin=layout.at('YMIN')||42, yMax=layout.at('YMAX')||240;
            const wrapSize=yMax-yMin+1;
            let unwrappedY=y;
            if(mutant&&previous){
                let dy=y-previous.y;
                if(dy>wrapSize/2)dy-=wrapSize;
                if(dy< -wrapSize/2)dy+=wrapSize;
                unwrappedY=previous.unwrappedY+dy;
            }
            const visualAimY=mutant?clamp(unwrappedY,yMin+4,yMax-6):y;
            const recent=previous?.samples||[];
            const old=recent[0];
            const longStep=old&&ticks-old.tick>=3&&Math.abs(unwrappedY-old.y)<34
                ? (unwrappedY-old.y)/(ticks-old.tick):null;
            const sampleY=[...recent.map(r=>r.y),unwrappedY];
            const amplitude=Math.max(...sampleY)-Math.min(...sampleY);
            // A Mutant's few-pixel up/down hop is not a sustained climb.
            // Extrapolating that hop by laser flight time caused 20px aiming
            // swings and the visible fine-grained up/down oscillation.
            const quantisationJitter=(amplitude<=1 ||
                (currentLabel==='SCZP1'&&amplitude<=5&&Math.abs(unwrappedY-sampleY[0])<=2&&sampleY.slice(1).some((v,i)=>v>sampleY[i])&&sampleY.slice(1).some((v,i)=>v<sampleY[i])))&&Math.abs(vy)<.55;
            const drift=quantisationJitter?0:(longStep===null?vy:clamp(.65*longStep+.35*vy,-2.5,2.5));
            const recentSamples=[...recent.slice(-6),{tick:ticks,y:unwrappedY}];
            const carrier=currentLabel==='LNDP1'&&r16(object,'OCVECT')===0xe22a;
            const pod=currentLabel==='PRBP1';
            const bomber=currentLabel==='TIEP1';
            const swarmer=currentLabel==='SWPIC1';
            const lander=currentLabel==='LNDP1';
            const named={label:currentLabel};
            objs.push({id:object,label:currentLabel,worldX,d,x:sx,y,aimY:visualAimY,unwrappedY,sy,vx,vy,drift,visible,carrier,lander,pod,mutant,bomber,swarmer,h:height(named),w:width(named),video,samples:recentSamples});
            observedClasses[currentLabel]=(observedClasses[currentLabel]||0)+1;
        }
        previousLocations=new Map(objs.map(e=>[e.id,{y:e.y,unwrappedY:e.unwrappedY,worldX:e.worldX,samples:e.samples||[]} ]));
        // Read *all* source astronauts, including those falling just outside
        // the camera. AKIL1 ($e234) is the genuine player pickup collision path.
        const falling=[];
        for(const h of (astronauts?.living||[])){
            if(!h.object)continue;
            const cv=r16(h.object,'OCVECT');
            if(cv!==0xe234)continue;  // normal walkers are not recoverable yet
            const d=delta(h.worldX,shipX);
            const y=typeof ram.read8==='function'?r8(h.object,'OY16'):(h.video&255);
            const vy=s16(r16(h.object,'OYV'))/256;
            if(y<43||y>235)continue;
            // An astronaut may already be attached to an ascending Lander.
            if(objs.some(e=>e.carrier&&Math.abs(delta(e.worldX,h.worldX))<180&&Math.abs(e.y-y)<26))continue;
            const reachable=Math.abs(d)/Math.max(60,Math.abs(game.vx)+65);
            const fallTime=vy>0.05?Math.max(0,(230-y)/vy):130;
            const altitudeTime=Math.abs(y-shipY)/1.6;
            const possible=reachable<fallTime+18 && altitudeTime<fallTime+25;
            falling.push({id:h.object,d,y,vy,fallTime,reachable,possible,
                score:reachable*1.3+altitudeTime*.7+(possible?0:150)});
        }
        falling.sort((a,b)=>a.score-b.score);
        const shells=[];let q=ram.read16(at('SPTR')),seen=new Set();
        for(let i=0;q&&i<95&&!seen.has(q);i++){
            if(q<256||q>=65500)break;
            seen.add(q);
            const a=r16(q,'OBJX'), x=a>>>8, y=a&255;
            if(a&&x<151&&y>41&&y<240) shells.push({id:q,x,y,
                vx:s16(r16(q,'OXV'))/256,vy:s16(r16(q,'OYV'))/256});
            q=r16(q,'OLINK');
        }
        // Shootable intercept candidate: account for the source laser's
        // four display columns/tick, the player's camera motion, and target
        // sprite (5x8 Landers, 6x4 UFOs).  Use *presented* screen coords.
        const laserOpportunity=(e,dir,assumedY=shipY)=>{
            if(!e.visible)return null;
            const muzzle=game.x+(dir>0?7:0);
            const range=(e.x+(dir>0?e.w:0)-muzzle)*dir;
            if(range<=1||range>124)return null;
            const closing=4-dir*(e.vx-game.vx)/64;
            if(closing<=0.8)return null;
            const flight=range/closing;
            if(flight>30)return null;
            const y=e.sy+e.drift*flight*(e.mutant?.5:1);
            const beam=assumedY+4;
            const miss=beam-clamp(beam,y,y+e.h-1);
            return {flight,miss,ideal:y+e.h*.5-4,range};
        };
        // ---- Stage 74: wave state ---------------------------------------------
        // ASTCNT from the harness (WAVE_STATE / ASTRONAUT_STATE). Unknown in
        // some test fixtures: then no human-economy tactic applies.
        const humansLeft=Number.isInteger(game.wave?.astronautCount)?game.wave.astronautCount:
            Number.isInteger(astronauts?.count)?astronauts.count:null;
        const planetGone=humansLeft===0;
        const humansScarce=humansLeft!==null&&humansLeft>0&&humansLeft<=TACTICS.keepHumansAt;
        const baiters=objs.filter(e=>e.label==='UFOP1');
        const baiterPressure=baiters.length>0;
        const waveEnemy=e=>e.lander||e.mutant||e.bomber||e.pod||e.swarmer;
        let keepCarry=carrying&&humansScarce;
        // Stage 75: the kept human (AFALL2: ship y+10 at PLABX+$80) lands once
        // GETALT there is below him. With the harness GETALT observer, keep the
        // ship above the real terrain under and ahead of him (20 ticks of travel,
        // as the ship climbs at most 2px/tick); otherwise use the highest peak.
        keepFloor=TACTICS.keepFloor;
        if(keepCarry&&typeof terrain?.altitude==='function'){
            const hx=(shipX+0x80)&65535, dir=Math.sign(game.vx)||facing;
            const ahead=Math.ceil(Math.abs(game.vx)/64*20)+8;
            let lowest=255;
            for(let c=-4;c<=ahead;c++)lowest=Math.min(lowest,terrain.altitude((hx+dir*c*64)&65535));
            keepFloor=clamp(lowest-13,60,225);
        }
        // Never let keeping a human stall the wave: with Baiters arriving and
        // every remaining wave enemy below the keep height, set him down.
        const waveLeft=objs.filter(waveEnemy);
        // Stage 78: the wave's last enemies (no Landers left in reserve). The
        // wave ends when they die; a Baiter only prolongs it, so finish the
        // wave and leave Baiters to the shield and the opportunistic gun.
        const reserve=Number.isInteger(game.wave?.landerReserve)?game.wave.landerReserve:1;
        const endgame=reserve===0&&waveLeft.length>0&&waveLeft.length<=TACTICS.endgameEnemies&&
            baiters.length<TACTICS.baiterSwarm;
        // Stage 78: one human left. Losing him destroys the planet, so guard
        // him: Landers near him come first, and with nothing to hunt the ship
        // waits over him instead of patrolling.
        const lastHuman=humansLeft===1&&!carrying?
            (astronauts?.living||[]).find(h=>h.object&&Number.isInteger(h.worldX))||null:null;
        if(keepCarry&&baiterPressure&&waveLeft.length&&waveLeft.every(e=>e.y+e.h/2-4>keepFloor))keepCarry=false;
        // Only an ordinary (non-kept) passenger is flown down for delivery.
        const delivering=carrying&&!keepCarry;
        if(keepCarry)keepTicks++;
        // An abduction in progress is a race (~116 ticks from grab to Mutant):
        // generic retreats and non-imminent Mutant duels must not delay it.
        const abduction=!carrying&&objs.some(e=>e.carrier);
        const priority=e=>{
            const dist=Math.abs(e.d)/110, vdist=Math.abs((e.aimY+e.h/2-4)-shipY);
            const dir=e.d<0?-1:1;
            const fire=laserOpportunity(e,dir);
            const urgentAbduction=e.carrier? (e.y<90?850:650)+(humansScarce?250:0):0;
            // Mutants track the ship aggressively; Bomber TIE formations
            // continually approach and launch mines. Neither can be treated
            // as a low-value background Lander when present.
            const special=e.mutant?135:e.bomber?185:e.swarmer?140:e.pod?155:0;
            // Targets that can be engaged on the current pass outweigh a
            // distant target that happens to be an abductor.
            const engagement=e.visible&&fire&&Math.abs(fire.miss)<12?195:0;
            const visible=e.visible?45:0;
            const stick=e.id===targetId?55:0;
            const inFront=e.d*facing>0?20:0;
            // Scarce humans: a Lander down near the ground is about to grab one.
            const guard=e.lander&&!e.carrier&&e.y>150?(humansScarce?160:60):0;
            // Baiters present: the wave ends only when its other enemies are
            // gone, so chase those (even far away) and leave Baiters to the
            // opportunistic gun unless they are close or multiplying.
            let baiterTerm=0,distWeight=2.2;
            if(baiterPressure){
                // A swarm of baiterSwarm or more: stop favouring the rest of
                // the wave and deal with the Baiters.
                const swarm=baiters.length>=TACTICS.baiterSwarm;
                if(waveEnemy(e)){if(!swarm){baiterTerm=TACTICS.baiterWaveBonus;distWeight=1.1;}}
                else if(e.label==='UFOP1')
                    baiterTerm=swarm||Math.abs(e.d)/64<TACTICS.baiterCloseCols?150:-80;
            }
            if(endgame){
                if(e.label==='UFOP1')baiterTerm=Math.abs(e.d)/64<TACTICS.baiterCloseCols?0:TACTICS.endgameBaiter;
                else if(waveEnemy(e)){baiterTerm=Math.max(baiterTerm,TACTICS.baiterWaveBonus);distWeight=Math.min(distWeight,1.1);}
            }
            let lastGuard=0;
            if(lastHuman&&e.lander){
                // With one human left every Lander is heading for him (GTARG).
                // Rank Landers by how close they are to HIM, not to the ship:
                // an abduction is over in ~116 ticks, too fast to cross the
                // planet once it starts. Lower (descending to grab) is worse.
                const gap=Math.abs(delta(e.worldX,lastHuman.worldX))/64;
                lastGuard=TACTICS.lastHumanGuard*(1-gap/512)+
                    (gap<TACTICS.lastHumanGuardCols?150:0)+(gap<60&&e.y>120?120:0);
                distWeight=Math.min(distWeight,1.1);
            }
            return urgentAbduction+engagement+visible+stick+inFront+special+guard+baiterTerm+lastGuard+
                (e.lander?75:0)-dist*distWeight-vdist*1.5;
        };
        const ranked=objs.map(e=>({...e,score:priority(e)})).sort((a,b)=>b.score-a.score);
        let chosen=ranked.find(e=>e.id===targetId)||null;
        const best=ranked[0]||null;
        // A committed 20-frame attack does not react to every passing object.
        // Interrupt only for an exceptionally high-value capture/fly-by.
        // Never abandon an enemy just as our ship reaches shooting range
        // solely because a *distant* enemy behind us gains a score bonus.
        // Retain normal tactical switching for all other circumstances.
        const atIntercept=chosen?.visible&&chosen.d*facing>0&&
            Math.abs(chosen.d)/64<=45&&Math.abs(chosen.d)/64>5;
        const distantUturn=best&&best.d*facing<0&&
            Math.abs(best.d)>Math.max(70*64,Math.abs(chosen?.d??0)*2);
        const preserveCurrent=!!(atIntercept&&distantUturn&&!chosen?.carrier&&
            best?.id!==chosen.id);
        if(!preserveCurrent&&(!chosen||ticks>=targetUntil&&best?.score>chosen.score+18 ||
            best&&best.score>chosen?.score+210)){
            if(best&&best.id!==targetId){targetId=best.id;targetUntil=ticks+22;stats.targetChanges++;}
            chosen=best;
        }
        if(!chosen){targetId=0;}
        lastCarrierSelected=!!chosen?.carrier;
        // A *falling* astronaut is a time-critical rescue, but a carrying
        // Lander that is about to mutate takes precedence.
        let human=falling.find(h=>h.id===rescueId)||null;
        if(!human||!human.possible)human=falling.find(h=>h.possible)||null;
        const rescueUrgent=human&&!carrying&&human.score<(humansScarce?320:175)&&(!chosen?.carrier||chosen.y>72);
        if(rescueUrgent){
            if(rescueId!==human.id){rescueId=human.id;rescueLock=ticks+85;stats.rescuesPursued++;}
        } else if(ticks>rescueLock){rescueId=0;}
        if(rescueId)human=falling.find(h=>h.id===rescueId)||null;
        if(human&&!human.possible&&ticks>rescueLock)human=null;
        // React to specific geometries, not only target score. In particular,
        // an overhead hostile must first be *opened up* in X to permit a
        // horizontal laser shot. A close Pod is just as dangerous to destroy:
        // PRBKIL invokes MMSW, releasing Swarmers at the destroyed Pod's X/Y.
        const threats=objs.filter(e=>{
            const dx=Math.abs(e.d)/64, dy=e.y-shipY;
            // Stage 74: no retreat from Pods; they drift slowly and the shield
            // handles collisions, so they are hunted and shot from range.
            if(e.pod)return false;
            if(e.mutant)return false; // Stage 73: Mutants belong to the duel below.
            if(e.swarmer)return dx<22&&dy< -12&&dy> -45;
            return dx<24&&dy< -13&&dy> -62 &&
                (e.vy>0.45||e.d*(e.vx-game.vx)<-1200);
        }).sort((a,b)=>
            (b.pod?80:b.mutant?45:b.swarmer?40:0)-(a.pod?80:a.mutant?45:a.swarmer?40:0) ||
            Math.abs(a.d)-Math.abs(b.d));
        // ---- Stage 73: Mutant duel ------------------------------------------
        // Source Mutant speeds. Test fixtures without these RAM symbols fall
        // back to what the Mutant objects themselves show (OXV = +/-SZXV).
        const mutants=objs.filter(e=>e.mutant);
        const speed={x:0,y:0,hop:2};
        try{speed.x=r8(0,'SZXV');speed.y=r16(0,'SZYV')/256;speed.hop=r8(0,'SZRY');}catch{}
        for(const e of mutants)speed.x=Math.max(speed.x,Math.abs(e.vx));
        speed.x=Math.max(12,speed.x);
        if(!(speed.y>0.05&&speed.y<=2.5))speed.y=1;
        if(!(speed.hop>=0&&speed.hop<=4))speed.hop=2;
        const shipModel={y:shipY,vx:game.vx,vy:s16(game.vy||0)/256,facing,
            revWait:Math.max(0,reverseCooldown-ticks),bottom:keepCarry?keepFloor:SHIP_BOTTOM};
        const mutantObstacle=e=>({mutant:true,x:e.d,y:e.y,w:MUT_COLS,h:MUT_ROWS,margin:speed.hop+1});
        const geometry=e=>{
            const c=e.d/64;                              // Mutant left edge vs ship left edge
            const centre=c+MUT_COLS/2-SHIP_COLS/2;        // >0: Mutant right of ship centre
            const dy=e.y-shipY;                           // >0: Mutant below
            return {centre,side:centre<0?-1:1,dy,
                gapX:Math.max(0,c>=0?c-SHIP_COLS:-c-MUT_COLS),
                gapY:Math.max(0,dy>=0?dy-SHIP_ROWS:-dy-MUT_ROWS),
                homing:e.d>=HOME_LEFT&&e.d<=HOME_RIGHT,
                coastHit:simulatePlan({h:0,v:0},shipModel,[mutantObstacle(e)],speed,SHIELD_HORIZON).mutantHit};
        };
        let duel=null;
        if(!delivering&&mutants.length){
            const scored=mutants.map(e=>({e,g:geometry(e)}))
                .filter(({g})=>g.coastHit<=SHIELD_HORIZON||!abduction&&Math.abs(g.centre)<=DUEL.engage)
                .sort((a,b)=>(a.g.coastHit-b.g.coastHit)||(Math.abs(a.g.centre)-Math.abs(b.g.centre)));
            const current=scored.find(s=>s.e.id===duelId);
            duel=current&&!(scored[0].g.coastHit<current.g.coastHit-10)?current:scored[0]||null;
        }
        if(duel){
            const {e,g}=duel;
            if(duelId!==e.id){duelId=e.id;duelPhase='';duelSince=ticks;}
            // Opening speed: positive while the ship travels away from the Mutant.
            const opening=-g.side*game.vx-speed.x;
            if(!duelPhase){duelPhase=g.gapX>=DUEL.separateUntil?'SHOOT':'SEPARATE';duelSince=ticks;}
            if(duelPhase==='SEPARATE'&&(g.gapX>=DUEL.separateUntil&&opening>=20||
                g.gapX>=DUEL.separateUntil+12||ticks-duelSince>DUEL.maxSeparate)){
                duelPhase='SHOOT';duelSince=ticks;
            }else if(duelPhase==='SHOOT'&&(g.gapX<DUEL.minGap||
                g.gapX<DUEL.minGap+6&&opening< -40||g.coastHit<=10||ticks-duelSince>DUEL.maxShoot)){
                duelPhase='SEPARATE';duelSince=ticks;
            }
            duelSide=g.side;
            targetId=e.id;targetUntil=ticks+30;
            combatPhase='';combatId=0;
        }else{duelId=0;duelPhase='';}
        mutId=duelId;mutPhase=duelPhase;
        let combatObj=objs.find(e=>e.id===combatId);
        if(mutPhase){combatPhase='';combatId=0;combatObj=null;}
        if(combatPhase&&!combatObj){combatPhase='';combatId=0;}
        if(combatPhase&&ticks>combatUntil){combatPhase='';combatId=0;}
        // Never change engagement geometry during an attached-human landing.
        // The original source still detects normal collisions and laser hits.
        if(delivering){combatPhase='';combatId=0;evadeUntil=0;evadeY=null;}
        if(!mutPhase&&!delivering&&!abduction&&!combatPhase&&ticks>=combatReengage&&threats.length){
            const e=threats[0];
            combatPhase='EXTEND';combatId=e.id;combatSince=ticks;
            combatEscapeY=clamp(shipY+(e.y<shipY?20:-20),54,221);
            combatUntil=ticks+72;
            combatReengage=ticks+145;
            // Commit now; the next source input scan begins the reversal.
            combatEscapeDir=e.d>0?-1:e.d<0?1:(game.vx>=0?1:-1);
            tacticalTriggers++;
        }
        if(combatPhase==='EXTEND'&&combatObj&&
            (ticks-combatSince>=25||ticks-combatSince>=14&&Math.abs(combatObj.d)/64>=64)){
            combatPhase='TURN_FIRE';combatSince=ticks;
        }
        if(combatPhase==='TURN_FIRE'&&combatObj&&
          Math.abs(combatObj.d)/64<24&&ticks>=combatReengage){
            combatPhase='EXTEND';combatSince=ticks;
            combatUntil=ticks+72;
            combatEscapeDir=combatObj.d>0?-1:1;
            tacticalTriggers++;combatReengage=ticks+42;
        }
        let desiredY=shipY, objective='PATROL', desiredDir=heading;
        let goalX=0;
        if(delivering){
            // A landing is one uninterrupted downward manoeuvre. Don't
            // oscillate between enemies or newly discovered rescue jobs.
            // Ship y~225 places the attached human at y~235; AFALL2 and
            // GETALT, not the pilot, decide when actual landing succeeds.
            desiredY=229;goalX=0;objective='DELIVER CARRIED HUMAN';
            desiredDir=facing;
        }else if(duel){
            const {e,g}=duel;
            // Beam (ship y+4) on the Mutant's centre, led by laser flight time.
            const flight=clamp(g.gapX/3.5,0,12);
            const firingY=clamp(e.aimY+e.drift*flight*.5+e.h/2-4,40,231);
            if(duelPhase==='SEPARATE'){
                desiredDir=-g.side;goalX=desiredDir*12500;
                // Never climb or dive *towards* a Mutant we overlap or are about
                // to overlap: that is the collision. Open height on the roomier
                // side; otherwise prepare the next firing height.
                if(g.gapX<6){
                    const above=g.dy>0;                   // Mutant below: go up
                    const lane=above?e.y-SHIP_ROWS-26:e.y+MUT_ROWS+26;
                    desiredY=clamp(lane,50,226);
                }else desiredY=firingY;
            }else{
                desiredDir=g.side;goalX=e.d;
                desiredY=firingY;
            }
            objective='MUTANT '+duelPhase;
        }else if(combatPhase==='EXTEND'&&combatObj){
            desiredDir=combatEscapeDir;
            goalX=desiredDir*12500;
            desiredY=clamp(shipY+(combatObj.y<shipY?10:-10),52,224);
            objective='EXTEND FROM '+combatObj.label;
        }else if(combatPhase==='TURN_FIRE'&&combatObj){
            desiredDir=combatObj.d<0?-1:1;
            goalX=combatObj.d;
            // Retarget continuously but filter noise later in the same planner.
            const travel=clamp(Math.abs(combatObj.d)/230,0,20);
            desiredY=clamp(combatObj.aimY+combatObj.drift*travel+combatObj.h/2-4,45,230);
            objective='STANDOFF FIRE '+combatObj.label;
        }else if(!carrying&&human&&rescueId&&(!chosen?.carrier||chosen.y>72)){
            // Lead the falling human's altitude towards the intercept point;
            // don't sit underneath or chase individual 1-pixel bounces.
            const travel=clamp(Math.abs(human.d)/Math.max(95,Math.abs(game.vx)+70),0,36);
            desiredY=clamp(human.y+Math.max(0,human.vy)*travel-1,52,227);
            goalX=human.d;objective='RESCUE FALLING HUMAN';
        }else if(chosen){
            const toward=chosen.d<0?-1:1;
            const muzzle=laserOpportunity(chosen,toward);
            const travel=clamp(Math.abs(chosen.d)/Math.max(100,Math.abs(game.vx)*.85+70),0,32);
            // Aim at the predicted *time of firing*, then take into account
            // the *laser travel time*. Moving enemies don't stand still.
            const flight=muzzle?.flight??clamp(Math.abs(chosen.d)/300,0,18);
            desiredY=clamp(chosen.aimY+chosen.drift*clamp(travel*.75+flight*.5,0,35)+chosen.h*.5-4,45,231);
            goalX=chosen.d;objective=chosen.carrier?'INTERCEPT ABDUCTOR':'HUNT '+chosen.label;
            if(chosen.carrier)stats.carriersPursued++;
        }else if(lastHuman){
            // Stage 78: nothing to hunt, one human left: hold station over him,
            // mid-height, ready for a Lander arriving from either side.
            const hd=delta(lastHuman.worldX,shipX);
            desiredY=110;goalX=Math.abs(hd)>12*64?hd:0;
            desiredDir=Math.abs(hd)>12*64?(hd<0?-1:1):facing;
            objective='GUARD LAST HUMAN';
        }else{
            if(ticks>=patrolTick){
                patrolTick=ticks+175;
                patrolLane=patrolLane<120?173:88;
                if(ticks%2===0)patrolDir=-patrolDir;
            }
            desiredY=patrolLane;desiredDir=patrolDir;goalX=patrolDir*12000;
        }
        // Keeping a scarce human aboard: fight normally, but never fly low
        // enough for him to touch the highest terrain (AFALL2 -> ALAND).
        if(keepCarry){desiredY=Math.min(desiredY,keepFloor-2);objective='KEEP HUMAN · '+objective;}
        // Continuously track meaningful movement of the target, but smooth
        // small fluctuations. Old stage's 34-tick stale altitude lane produced
        // dramatic misses during otherwise perfectly good fly-bys.
        if(objective!==mode)modeSince=ticks;
        mode=objective;
        const deltaY=desiredY-targetY;
        // Mutants hop vertically every few frames. Following each hop makes
        // both aiming and the ship appear to vibrate. Hold a meaningful lane
        // for 22 ticks, and reacquire only for a substantial displacement.
        // (A Mutant inside duel range is steered by the duel, without lane holds.)
        const mutantAim=!delivering&&!duel&&!combatPhase&&chosen?.mutant;
        const currentMutant=mutantAim?chosen.id:0;
        if(delivering){targetY=229;mutantLaneId=0;}
        else if(duel){
            mutantLaneId=0;
            if(Math.abs(deltaY)>2||ticks-modeSince<=1)targetY=desiredY;
        }else if(combatPhase==='EXTEND'){
            targetY=combatEscapeY;mutantLaneId=0;
        }else if(mutantAim){
            if(mutantLaneId!==currentMutant){
                mutantLaneId=currentMutant;mutantLaneUntil=0;
                // Acquire a new target promptly; the wider 12px threshold
                // applies only to subsequent correction requests.
                if(Math.abs(deltaY)>5){
                    targetY=desiredY;mutantLaneUntil=ticks+18;
                }
            }
            if(ticks>=mutantLaneUntil&&Math.abs(desiredY-targetY)>=(mutPhase?4:12)){
                targetY=desiredY;
                mutantLaneUntil=ticks+(mutPhase?6:22);
            }
        }else{
            mutantLaneId=0;
            if(Math.abs(deltaY)>8 || ticks-modeSince<=2){targetY=desiredY;}
            else if(Math.abs(deltaY)>3&&ticks%9===0)targetY+=Math.sign(deltaY)*3;
        }
        // The duel may use the legal top row (a Mutant at YMIN is otherwise
        // out of reach of the beam).
        aimY=clamp(targetY,duel?40:45,231);
        // Future projected collision in source coordinates. One nearby enemy
        // is not a reason to abort a valid attack: evade only if a collision
        // will occur within the few ticks before an ordinary laser can help.
        // Mutants are excluded: the Stage 73 shield below models their homing.
        const hazards=[];
        for(const e of objs){
            if(e.mutant)continue;
            for(const t of [0,2,4,6,9,10,12]){
                const x=(e.d+(e.vx-game.vx)*t)/64;
                const y=e.y+e.vy*t-shipY;
                if(Math.abs(x)<9&&Math.abs(y)<8){hazards.push({id:e.id,x,y,t,type:'enemy',value:20-t,cy:e.y+e.vy*t,originY:e.y});break;}
            }
        }
        for(const b of shells){
            for(const t of [0,2,5,8,12]){
                const x=b.x+b.vx*t-game.x-game.vx*t/64;
                const y=b.y+b.vy*t-shipY;
                if(Math.abs(x)<8&&Math.abs(y)<9){hazards.push({id:b.id,x,y,t,type:'shell',value:37-t,cy:b.y+b.vy*t,originY:b.y});break;}
            }
        }
        hazards.sort((a,b)=>b.value-a.value);
        if(!delivering&&hazards.length&& (ticks>=evadeUntil || (hazards[0].t<=1&&hazards[0].id!==evadeSource&&ticks+5<evadeUntil))){
            const major=hazards[0];
            const lowest=keepCarry?keepFloor:231;
            const choices=[clamp(shipY-23,44,lowest),clamp(shipY+23,44,lowest)];
            const safety=y=>{
                let penalty=Math.abs(y-aimY)*.12;
                for(const e of objs){const futureX=Math.abs(e.d+(e.vx-game.vx)*7)/64;
                    if(futureX<18)penalty+=Math.max(0,17-Math.abs(e.y+e.vy*7-y))*7;}
                for(const b of shells){const futureX=Math.abs(b.x+b.vx*6-game.x-game.vx*6/64);
                    if(futureX<15)penalty+=Math.max(0,12-Math.abs(b.y+b.vy*6-y))*9;}
                // Near the top/bottom limit these weights can prefer crossing the
                // hazard's height; the Stage 73 shield below vetoes any choice
                // that actually leads into a collision.
                if(Math.abs(y-shipY)<14)penalty+=120;
                if((y-shipY)*(major.originY-shipY)>0)penalty+=80;
                return penalty;
            };
            choices.sort((a,b)=>safety(a)-safety(b));
            if(choices[0]!==shipY){evadeY=choices[0];evadeUntil=ticks+15;evadeSource=major.id;}
        }
        if(!delivering&&ticks<evadeUntil&&evadeY!=null){aimY=evadeY;mode='EVADE '+(hazards[0]?.type==='shell'?'PROJECTILE': 'ENEMY');}
        // The source ship moves vertically around 1-2px/tick. Control its
        // fixed-point position directly with a Schmitt trigger: ±5px starts,
        // ±2px stops. A short no-reversal interval removes one-pixel flutter.
        // A Mutant duel needs prompt response: ±3px starts, ±1px stops.
        let err=aimY-(Number.isInteger(game.play16)?game.play16/256:shipY);
        let cmdY=0;
        const startBand=duel?3:5, stopBand=duel?1:2;
        if(yDir===-1){if(err < -stopBand)cmdY=-1;}
        else if(yDir===1){if(err > stopBand)cmdY=1;}
        else if(err< -startBand)cmdY=-1;
        else if(err>startBand)cmdY=1;
        if(duel){
            if(cmdY===-yDir&&ticks-lastYChange<3)cmdY=0;
            if(cmdY!==yDir){lastYChange=ticks;yDir=cmdY;}
        }else if(cmdY!==yDir){
            // After finishing a correction, don't twitch in the opposite
            // direction for a few pixels of Mutant animation. Emergency
            // projectile evasion may still override the resting period.
            if(mutantAim&&yDir===0&&cmdY!==0&&ticks<verticalRestUntil&&
                Math.abs(err)<17&&ticks>=evadeUntil)cmdY=0;
            if(cmdY===-yDir&&ticks-lastYChange<(mutantAim?13:6))cmdY=0;
            if(cmdY!==yDir){
                if(mutantAim&&yDir!==0&&cmdY===0)verticalRestUntil=ticks+14;
                lastYChange=ticks;yDir=cmdY;
            }
        }
        if(shipY<=43&&cmdY<0||shipY>=233&&cmdY>0)cmdY=0;
        // While carrying an astronaut, ascending is never part of a landing.
        if(delivering){cmdY=shipY<228?1:0;yDir=cmdY;}
        const keepHeight=()=>{
            if(!keepCarry)return;
            if(shipY>keepFloor)cmdY=-1;
            else if(shipY>=keepFloor-1&&cmdY>0)cmdY=0;
            yDir=cmdY;
        };
        keepHeight();
        // The original REV changes facing immediately, independently of the
        // ship's horizontal momentum. Face the objective before it passes;
        // for a close astronaut, turn against excessive residual drift.
        const rescueActive=!!human&&rescueId&&(!chosen?.carrier||chosen.y>72);
        const currentSpeed=Math.abs(game.vx);
        if(!delivering&&!combatPhase&&!duel&&(chosen||human)){
            if(Math.abs(goalX)>320)desiredDir=goalX<0?-1:1;
            else if(rescueActive&&currentSpeed>30)desiredDir=game.vx>0?-1:1;
            else desiredDir=facing;
        }
        let reverse=false;
        if(ticks>=reverseCooldown&&desiredDir!==facing){
            reverse=true;reverseCooldown=ticks+11;heading=desiredDir;lastReverseTick=ticks;
        }else if(desiredDir===facing)heading=desiredDir;
        // Bias toward moving decisively in pursuit. With the target nearby,
        // refrain from thrust if it would force us straight through it.
        const close=chosen&&Math.abs(chosen.d)<850&&Math.abs(chosen.y-shipY)<13;
        let throttle=!reverse&&desiredDir===facing&&
            (!close || (goalX*facing>0 && Math.abs(game.vx)<70)) &&
            !(ticks<evadeUntil&&hazards[0]?.t<=2&&hazards[0].x*facing>0);
        if(delivering)throttle=false;
        // Stage 78: holding station over the last human: coast, don't fly off.
        if(mode.endsWith('GUARD LAST HUMAN')&&goalX===0)throttle=false;
        // Duel: SEPARATE thrusts away at full power; SHOOT coasts so the ship's
        // momentum keeps carrying it away while the gun faces the Mutant.
        if(duelPhase==='SEPARATE')throttle=!reverse&&desiredDir===facing;
        if(duelPhase==='SHOOT')throttle=false;
        if(combatPhase==='EXTEND')throttle=!reverse&&desiredDir===facing;
        if(combatPhase==='TURN_FIRE')throttle=false; // coast, aim, fire; don't ram the target
        // Pods: close in, then coast at stand-off range and shoot. No retreat.
        if(!duel&&chosen?.pod&&chosen.d*facing>0&&Math.abs(chosen.d)/64<TACTICS.podMinRange+12)throttle=false;
        // Fire at ALL real objects in the gun's corridor, not just a locked
        // target. A player should never glide past an aligned enemy silently.
        const shots=[];
        // Stage 75: humans on screen (not our own passenger). The laser stops at
        // the first object it meets, so never fire when one is in the beam's
        // path before the target.
        const humanBlocks=[];
        for(const h of (astronauts?.living||[])){
            if(!h.object||h.object===passenger?.object)continue;
            const v=r16(h.object,'OBJX');
            if(v)humanBlocks.push({x:v>>>8,y:v&255});
        }
        const muzzle=game.x+(facing>0?7:0), beamY=shipY+4;
        const humanBefore=range=>humanBlocks.some(h=>{
            const r=(h.x+(facing>0?0:2)-muzzle)*facing;
            return r>-1&&r<range+1&&beamY>=h.y-1&&beamY<=h.y+8;
        });
        for(const e of objs){
            let info=laserOpportunity(e,facing);
            if(!info)continue;
            if(humanBefore(info.range)){humanShotsHeld++;continue;}
            // Never burst a Pod at point-blank range: the real PRBKIL
            // spawns Swarmers directly at the explosion position. (Stage 74:
            // 16 columns rather than 54; the shield handles the Swarmers.)
            if(e.pod&&info.range<TACTICS.podMinRange){podShotsDeclined++;continue;}
            // The beam is one raster byte high. Allow limited uncertainty
            // from moving target sprites and the alternating OPROC scanline.
            if(Math.abs(info.miss)<=(e.mutant?2.2:1.7)){
                shots.push({id:e.id,priority:(e.carrier?100:0)+40-info.flight*1.2});
            }
        }
        shots.sort((a,b)=>b.priority-a.priority);
        // Debounced switch: an assert must be separated by a release tick.
        let fire=shots.length>0&&!lastFire&&!reverse;
        // A smart bomb is for a rare, exceptionally valuable mass kill only.
        // Even then, consume no more than one per wave and keep a reserve.
        const visible=objs.filter(e=>e.visible&&e.x>2&&e.x<144);
        const carriers=visible.filter(e=>e.carrier).length;
        const wave=game.wave?.wave??1;
        let smartBomb=false;
        if(!bombLock&&ticks>1100&&game.smartBombs>=2&&
            lastBombWave!==wave&&!game.smartBombActive&&
            (visible.length>=15||(visible.length>=12&&carriers>=3))){
            smartBomb=true;lastBombWave=wave;bombLock=5000;
        }
        if(bombLock)bombLock--;
        // Planet gone: every Lander is now a Mutant. Mutants always chase the
        // ship, so let them converge and smart bomb once enough are on screen
        // together (all of them, if fewer remain than gatherTarget). Always
        // keep gatherReserve bombs back: the shield's emergency bomb is what
        // saves the ship when a swarm leaves no escape.
        const allMutants=mutants.length, mutantsOnScreen=mutants.filter(e=>e.visible).length;
        if(planetGone&&!smartBomb&&!game.smartBombActive&&game.smartBombs>TACTICS.gatherReserve&&
            ticks-lastGatherBomb>TACTICS.gatherCooldown&&allMutants>=2&&
            mutantsOnScreen>=Math.min(TACTICS.gatherTarget,allMutants)){
            smartBomb=true;gatherBombs++;lastGatherBomb=ticks;
        }
        // Source hyperspace can kill the ship; leave it untouched except for
        // genuine unavoidable impending multi-projectile collisions.
        let hyperspace=false;
        if(hyperLock)hyperLock--;
        // ---- Stage 73: collision shield --------------------------------------
        // Simulate the inputs chosen above against the source Mutant rules,
        // plus shells and other enemies moving at their current velocity. If
        // they lead into anything within SHIELD_TRIGGER ticks, substitute the
        // input pair (thrust direction x vertical) that stays clear longest.
        // If nothing avoids an on-screen Mutant, spend a smart bomb.
        const nearMutants=mutants.filter(e=>Math.abs(e.d)/64<120);
        if(!game.smartBombActive){
            const obstacles=nearMutants.map(mutantObstacle);
            for(const e of objs){
                if(e.mutant||Math.abs(e.d)/64>=90)continue;
                const o={x:e.d,y:e.y,vx:e.vx,vy:e.vy,w:e.w,h:e.h,margin:1};
                if(e.swarmer){
                    // PD2 of the Swarmer's own process is its vertical acceleration.
                    const process=r16(e.id,'OBJID'), pd2=process?r8(process,'PD2'):0;
                    Object.assign(o,{kind:'swarmer',accel:(pd2||0x10)/256,swxv:Math.max(16,Math.abs(e.vx)),margin:2});
                }else if(e.label==='UFOP1'){
                    // Frames left before the UFOP3 -> UFOP1 wrap (6 ticks each).
                    const frame=clamp(Math.round((r16(e.id,'OPICT')-0xe100)/10),0,2);
                    Object.assign(o,{kind:'baiter',reaimAt:(2-frame)*6+1,margin:2});
                }
                obstacles.push(o);
            }
            for(const b of shells)obstacles.push({x:(b.x-game.x)*64,y:b.y,vx:b.vx*64,vy:b.vy,
                w:SHELL_COLS,h:SHELL_ROWS,margin:1});
            const intended={h:throttle?facing:(reverse&&duelPhase==='SEPARATE'?desiredDir:0),v:cmdY};
            const run=plan=>({plan,...simulatePlan(plan,shipModel,obstacles,speed,SHIELD_HORIZON)});
            const mine=run(intended);
            // Rank substitutes: latest collision first. Among collision-free
            // inputs, intervene minimally (closest to the intended input),
            // otherwise prefer the most clearance.
            const likeness=x=>(x.plan.h===intended.h)+(x.plan.v===intended.v);
            const better=(a,b)=>a.hit!==b.hit?(a.hit>b.hit?-1:1):
                a.hit===Infinity&&likeness(a)!==likeness(b)?likeness(b)-likeness(a):
                a.clear!==b.clear?(a.clear>b.clear?-1:1):likeness(b)-likeness(a);
            let override=null;
            if(ticks<shieldUntil&&shieldPlan){
                // Hold the previous substitution briefly so the ship commits.
                const held=run(shieldPlan);
                if(held.hit>=mine.hit&&held.hit>SHIELD_TRIGGER/2)override=held;
            }
            if(!override&&mine.hit<=SHIELD_TRIGGER){
                const best=SHIELD_PLANS.map(run).sort(better)[0];
                if(best.hit>mine.hit){override=best;shieldTriggers++;shieldUntil=ticks+6;shieldPlan=best.plan;}
                if(best.mutantHit<=6&&!smartBomb&&game.smartBombs>0&&ticks-lastEmergencyBomb>90&&
                    nearMutants.some(e=>e.visible)){
                    smartBomb=true;emergencyBombs++;lastEmergencyBomb=ticks;
                }
                // Stage 75: nothing avoids a collision within 3 ticks and no bomb
                // is going off. HYP2 kills the ship when LSEED>192 (~25%), which
                // beats a certain collision.
                // Only for a collision still to come: an object already inside
                // the ship's box is either a miss or already a source collision.
                const touching=obstacles.some(o=>{
                    const c=o.x/64,dy=o.y-shipY;
                    return (c>=0?c<SHIP_COLS:-c<o.w)&&(dy>=0?dy<SHIP_ROWS:-dy<o.h);
                });
                if(best.hit<=3&&!smartBomb&&!hyperLock&&!touching){
                    hyperspace=true;hyperspaces++;hyperLock=120;
                }
            }
            if(override){
                const p=override.plan;
                const cooldownBefore=ticks+shipModel.revWait;
                if(reverse){reverse=false;reverseCooldown=cooldownBefore;}
                throttle=false;
                if(p.h&&p.h!==facing){
                    if(shipModel.revWait===0){reverse=true;reverseCooldown=ticks+11;heading=p.h;lastReverseTick=ticks;}
                }else if(p.h){throttle=true;heading=facing;}
                if(p.v!==cmdY){cmdY=p.v;yDir=p.v;lastYChange=ticks;}
                if(reverse)fire=false;
                mode=mine.mutantHit<=SHIELD_TRIGGER?'MUTANT SHIELD':'SHIELD';
                keepHeight();
            }
        }
        lastFire=fire;
        if(fire){
            stats.shotsOffered++;lastEnemyShot=ticks;
            if(duelId&&shots.some(s=>s.id===duelId)){duelShots++;mutShots=duelShots;}
        }
        return {thrust:throttle,up:cmdY<0,down:cmdY>0,reverse,fire,smartBomb,hyperspace};
    }
    return Object.freeze({reset,sample,state:()=>({ticks,targetId,reason:mode,aim:aimY,heading,evadeUntil,
        rescueId,targetUntil,carrierPursuit:lastCarrierSelected,carrying,completedDeliveries,
        combatPhase,combatId,mutPhase,mutId,mutShots,duelPhase,duelId,duelShots,shieldTriggers,emergencyBombs,keepTicks,gatherBombs,keepFloor,humanShotsHeld,hyperspaces,
        tacticalTriggers,podShotsDeclined,observedClasses:{...observedClasses},stats:{...stats}})});
}


const attractPilot=createAttractPilot();
let aiGameOverTicks=0, aiGamesPlayed=0, aiRecoveries=0;
// "DEMO MODE ACTIVE" flashes for 5 seconds when a demo game starts,
// in the RORAOK boot-text style (MESS0 glyphs via CWRIT, colour $7A).
const DEMO_BANNER_MS=5000, DEMO_BANNER_ON_MS=400, DEMO_BANNER_OFF_MS=200;
const demoBanner=createSourceTextBanner('DEMO MODE ACTIVE');
let demoBannerStart=-Infinity;
const bannerClock=()=>globalThis.performance?.now?.()??Date.now();
function drawDemoBanner(now=bannerClock()){
    const elapsed=now-demoBannerStart;
    if(!(mode==='demo-ai'||mode==='demo-ai-over')||elapsed<0||elapsed>=DEMO_BANNER_MS)return false;
    if(elapsed%(DEMO_BANNER_ON_MS+DEMO_BANNER_OFF_MS)>=DEMO_BANNER_ON_MS)return false;
    const [r,g,b]=defenderDacRGB(demoBanner.colour);
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    for(const [x,y] of demoBanner.lit)ctx.fillRect(x-DEFENDER_VISIBLE.left,y-DEFENDER_VISIBLE.top,1,1);
    return true;
}
function startAttractPilot(sourceRandom=sourceRandomFromAttract()) {
    // Reset the *ordinary* game as though an ordinary player started it.
    // No cabinet coin/credit is consumed by an unattended exhibition.
    lab.CONFIGURE_OPERATOR({ships:cabinet.settings[9],bonus:cabinet.settings[8]});
    lab.RESET(null,sourceRandom);
    attractPilot.reset();
    aiGamesPlayed++;
    aiGameOverTicks=0;
    keys.clear();touchInput.clear();pendingTaps.clear();
    floatingJoystick.cancel();altitudeController.clear();hybridReverse.reset();
    fireRepeatTicks=0;
    mode='demo-ai';
    demoBannerStart=bannerClock();
    sourceBoundary=null;
    frameClock.reset();
    running=true;
}

const boot = createCabinetBoot();
const lab = createFlightHarness({ infiniteSmartBombs: false, playerCollisions: true, sourceCabinetInput: true,
    startingShips: cabinet.settings[9], replayLevel: cabinet.settings[8] });
lab.SET_SOUND_PIA_SINK((byte, ticks) => audio.writePIA(byte, ticks));
const attract = createAmode1Attract({ initialCredits: cabinet.credits });
const HALL_STORAGE_KEY = 'williams-defender-red-label-hall-v1';
function readHallStorage() {
    // CMOS chip persistence is browser-local storage only in this host adapter.
    try {
        const value = JSON.parse(localStorage.getItem(HALL_STORAGE_KEY));
        if (validHallRows(value?.allTime)) {
            // ROMC8.RHSTDS resets today's RAM table from ROM factory scores
            // on power-up; ONLY all-time CRHSTD was retained in cabinet CMOS.
            return { today: DEFAULT_HALL_OF_FAME, allTime: value.allTime };
        }
    } catch { /* Private browsing can disable storage; factory defaults remain. */ }
    return { today: DEFAULT_HALL_OF_FAME, allTime: DEFAULT_HALL_OF_FAME };
}
function writeHallStorage(tables) {
    try { localStorage.setItem(HALL_STORAGE_KEY, JSON.stringify({ allTime: tables.allTime })); }
    catch { /* Cabinet CMOS semantics remain in memory if browser storage is unavailable. */ }
}
const hall = createAmode1HallOfFame({
    writeText: attract.WTEXTB,
    video: attract.video,
    ram: attract.ram,
    paletteAddr: PHR6_LAYOUT.at('PCRAM'),
    tables: readHallStorage(),
    onQualify: command => audio.playHallOfFameTune(command),
    onFinish: tables => {
        writeHallStorage(tables);
        attract.SET_HALL_OF_FAME(tables);
    }
});
attract.SET_HALL_OF_FAME(hall.copyTables());
let gameOverWait = 0;
// HALDIS: the source counts 60 NAPP 10,HALLD3 sleeps before LEDRET.
// This is a process timer, not a browser timeout or a frozen table.
let hallDisplayTicks = 0;
const HALL_DISPLAY_TICKS = 60 * 10;
let mode = 'power-off';
let serviceTestIndex = 0;
// Browser adapter: Enter starts at the title and confirms HOF initials;
// when configured as FIRE, the same physical key fires during gameplay.
// The real cabinet has distinct START/FIRE switches. Never interpret a
// held/repeating FIRE key as a new START after HALL13 changes to HALDIS.
let startEnterReleased = true;
let enterHeld = false;
const processLab = createSourceProcessWorkbench();
const enemyLab = createSourceEnemyWorkbench();
const landerLab = createSourceLanderWorkbench();
const canvas = document.getElementById('flight'), ctx = canvas.getContext('2d', { alpha: false });
const display = document.getElementById('memory');
const processDisplay = document.getElementById('processState');
function drawProcesses() {
    const s = processLab.STATE();
    processDisplay.textContent = `DISP ticks   ${s.ticks}     GEXEC GTIME   ${s.gt}    STRCNT ${s.starCount}\n` +
        `COLR LCOLRX  ${s.colourIndex}     PCRAM+1 $${s.laserColour.toString(16).padStart(2, '0')}\n` +
        `THPROC THX    ${s.thrustIndex}     FBX ${s.fireballIndex}\n` +
        `WDELT LNDXV   ${s.landerXVelocity}     REVFLG ${s.revFlag}   NPLAD $${s.direction.toString(16).padStart(4, '0')}\n` +
        `ACTIVE linked processes (PADDR / PTIME):\n` + s.active.map(p => `  $${p.node.toString(16)}  ${p.entry.padEnd(8)}  ${p.$time}`).join('\n');
}
function drawEnemyLocator() {
    const canvas = document.getElementById('enemyLocator'), ctx = canvas.getContext('2d');
    if (!canvas)
        return;
    const e = enemyLab.STATE(), l = landerLab.STATE();
    ctx.fillStyle = '#080e16';
    ctx.fillRect(0, 0, 292, 240);
    // A diagnostic projection, not the original APVCT/OPROC raster path.
    // Defender source world X uses 64 fixed-point units per byte-column.
    const entries = [['U', e.ufo.worldX, e.ufo.height, '#f9c74f'],
        ['S', e.swarmer.worldX, e.swarmer.height, '#f984b5'],
        ['L', l.lander.x, l.lander.y, '#80efb2'],
        ['A', l.astronaut.x, l.astronaut.y, '#99d5ff']];
    const origin = e.playerX;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#26394c';
    ctx.beginPath();
    ctx.moveTo(146, 0);
    ctx.lineTo(146, 240);
    ctx.stroke();
    for (const [name, worldX, y, color] of entries) {
        const dx = ((worldX - origin + 0x8000) & 0xffff) - 0x8000;
        const x = 146 + dx / 64 * 2;
        if (x < 0 || x >= 292 || y < 0 || y >= 240)
            continue;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#080e16';
        ctx.fillText(name, x, y + 4);
    }
}
function drawEnemies() {
    const s = enemyLab.STATE();
    const row = (name, x) => `${name.padEnd(10)} object $${x.object.toString(16)}  world $${x.worldX.toString(16).padStart(4, '0')}  Y ${x.height}\n` +
        `    OXV ${String(x.vx).padStart(5)} OYV ${String(x.vy).padStart(5)}  PADDR $${x.next.toString(16)} PTIME ${x.time}`;
    document.getElementById('enemyState').textContent =
        `Original DISP ticks ${s.ticks}  PLABX $${s.playerX.toString(16)}  PLAYC ${s.playerY}\n` +
            `Source GETSHL active shells ${s.activeShells}   Sound priority ${s.soundPriority}\n` +
            row('UFOLP', s.ufo) + '\n' + row('MSWLP', s.swarmer) + '\n\n' +
            'Original movement routines update velocities; source VELO (IRQ) would update coordinates.\n' +
            'SHOOT/GETSHL run through source processes; bullet rendering, collisions and APVCT require further translation.';
}
function drawLanders() {
    const s = landerLab.STATE();
    const row = (name, x) => `${name.padEnd(10)} worldX $${x.x.toString(16).padStart(4, '0')} Y ${x.y} ` +
        `OXV ${x.xv} OYV ${x.yv}  PADDR $${x.next.toString(16)} PTIME ${x.sleep}`;
    document.getElementById('landerState').textContent =
        `Source process/VELO diagnostic ticks ${s.ticks}, terrain altitude ${s.altitudeAtLander}\n` +
            `Lander count ${s.landCount}  astronaut count ${s.astronautCount}  original shells ${s.shots}\n` +
            row('LANDS0', s.lander) + '\n' + row('ASTRO', s.astronaut) + '\n' +
            `Sound-command requests: ${s.soundCommands.map(x => '$' + x.toString(16)).join(' ') || '(none)'}\n` +
            'Test fixture: no APVCT, real sprite presentation, collision processing or cabinet timing.';
}
const fps = document.getElementById('frames');
const labStatus = document.getElementById('status');
const keys = new Set(), pendingTaps = new Set();
// Touch pointers are separate from keyboard state: releasing a finger must
// never release a physical key held simultaneously, or vice versa.
const touchInput = createTouchInputState();
const floatingJoystick = createFloatingJoystick();
const hybridReverse = createHybridReverseSequencer();
const altitudeController = createAltitudeController({ minY: PHR6_LAYOUT.at('YMIN') + 1, maxY: 238 });
const inputHeld = key => keys.has(key) || touchInput.held(key);
const inputEdge = key => {
    const touchEdge = touchInput.consume(key);
    return pendingTaps.has(key) || touchEdge;
};

// Browser-only input mapping. The native DEFA7 source routines still receive
// exactly the same logical SSCAN/SWP switch inputs as in earlier stages.
// Access to window.localStorage itself may throw on opaque Android/file origins.
let controlStorage = null;
try { controlStorage = window.localStorage; } catch { /* Keep defaults in memory. */ }
let controlBindings = loadControlBindings(controlStorage);
let controlsOpen = false;
let pendingBinding = null;
let runningBeforeControls = true;
const controlsPanel = document.getElementById('keySettings');
const controlGrid = document.getElementById('keyBindingRows');
const keyMessage = document.getElementById('keyBindingMessage');
function showControlMessage(message) { keyMessage.textContent = message; }
function renderControlRows() {
    // The native browser implements DOM node creation; headless source tests
    // use a deliberately tiny element stub and do not need settings widgets.
    if (typeof document.createElement !== 'function' || typeof controlGrid.replaceChildren !== 'function') {
        document.getElementById('keyBindingSummary').textContent =
            CONTROL_ACTIONS.map(([action, label]) => `${label}: ${displayKeyName(controlBindings[action])}`).join('  ·  ');
        return;
    }
    controlGrid.replaceChildren();
    for (const [action, label] of CONTROL_ACTIONS) {
        const row = document.createElement('div');
        row.className = 'key-binding-row';
        const name = document.createElement('span');
        name.textContent = label;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'key-binding-button';
        button.dataset.action = action;
        button.textContent = pendingBinding === action ? 'PRESS A KEY…' : displayKeyName(controlBindings[action]);
        button.setAttribute('aria-label', `Change ${label} control`);
        button.onclick = () => {
            pendingBinding = action;
            showControlMessage(`Press the new key for ${label}, or Escape to cancel.`);
            renderControlRows();
            controlGrid.querySelector(`[data-action="${action}"]`).focus();
        };
        row.append(name, button);
        controlGrid.append(row);
    }
    document.getElementById('keyBindingSummary').textContent =
        CONTROL_ACTIONS.map(([action, label]) => `${label}: ${displayKeyName(controlBindings[action])}`).join('  ·  ');
}
function openKeySettings() {
    if (controlsOpen) return;
    controlsOpen = true;
    pendingBinding = null;
    runningBeforeControls = running;
    running = false;
    activeClock().pause();
    audio.suspend();
    keys.clear();
    touchInput.clear();
    floatingJoystick.cancel();
    altitudeController.clear();
    hybridReverse.reset();
    pendingTaps.clear();
    fireRepeatTicks = 0;
    controlsPanel.hidden = false;
    renderControlRows();
    showControlMessage('Select a control, then press its new key. Assignments cannot be duplicated.');
    document.getElementById('closeKeySettings').focus();
}
function closeKeySettings() {
    if (!controlsOpen) return;
    controlsOpen = false;
    pendingBinding = null;
    controlsPanel.hidden = true;
    keys.clear();
    touchInput.clear();
    pendingTaps.clear();
    running = runningBeforeControls && !sourceBoundary;
    activeClock().reset(); // A long pause must not cause a burst of catch-up IRQs.
    if (running) audio.resume();
    document.getElementById('configureKeys').focus();
}
document.getElementById('configureKeys').onclick = openKeySettings;
document.getElementById('closeKeySettings').onclick = closeKeySettings;
document.getElementById('resetKeySettings').onclick = () => {
    controlBindings = { ...DEFAULT_CONTROL_BINDINGS };
    const saved = saveControlBindings(controlStorage, controlBindings);
    pendingBinding = null;
    renderControlRows();
    showControlMessage(saved ? 'Default controls restored and saved.' : 'Default controls restored. Browser storage unavailable; changes may not survive reload.');
};
renderControlRows();
// Physical 60.096 Hz video IRQ is independent of browser paint cadence.
// At 30Hz rAF, two nominal IRQ periods must pass between paints: slowing
// the source machine to one STEP per paint was incorrect. The browser may
// sample the last rendered image, but must preserve elapsed source time.
const frameClock = createSourceFrameClock();
const attractClock = createSourceFrameClock({ maxCatchUp: 6 });
const activeClock = () => (mode === 'attract' || mode === 'boot') ? attractClock : frameClock;
let running = false, frames = 0, sourceBoundary = null;
// Browser input adapter only: repeated FIRE requests while held still invoke
// the original LFIRE process and respect the source's four-shot limit.
// The original SSCAN detects new edges after two zero samples.
// Holding Fire is an optional seven-frame browser adapter: generate one
// source PIA2 pulse, allow six idle samples, and let SSCAN/SWP/LFIRE do the
// actual firing. It is not a claim that the source cabinet auto-repeats.
const FIRE_REPEAT_TICKS = 7;
let fireRepeatTicks = 0, suppressFireClick = false;
/** The cabinet's attract and play modes share the same three RAND seed
 * bytes and 16 star records. Our browser adapters use distinct RAM objects;
 * carry these bytes through instead of restarting from SINIT's $A55A. */
function sourceRandomFromAttract() {
    // On human takeover from a live exhibition, keep the active source RNG.
    if (mode === 'demo-ai' || mode === 'demo-ai-over') return lab.RANDOM_STATE();
    const at = name => PHR6_LAYOUT.at(name);
    return {
        seed: attract.ram.read8(at('SEED')),
        hseed: attract.ram.read8(at('HSEED')),
        lseed: attract.ram.read8(at('LSEED')),
        starMap: attract.ram.snapshot(at('SMAP'), at('SMEND'))
    };
}
function startGame() {
    // The original cabinet's START switch is not the coin switch. A paid
    // credit must be debited before any original START/PLSTRT path runs.
    if (!START_MODES.includes(mode)) {
        refreshCabinetUI();
        return false;
    }
    // Stage 77: with no credit, START drops the coin in for the player (the
    // same COIN path as INSERT COIN, so coinage and audits still apply).
    for (let coins = 0; !cabinet.CAN_START(1) && coins < 8; coins++)
        cabinet.COIN('left');
    if (!cabinet.START(1)) {
        refreshCabinetUI();
        return false;
    }
    attract.SET_CREDITS(cabinet.credits);
    refreshCabinetUI();
    // Browser START is DEFA7.ST1's untranslated cabinet input boundary.
    // Original ST1 loads ST1SND via SNDLD before START. This host fixture
    // resets RAM first, then loads ST1SND, before the first SNDSEQ tick.
    void audio.enable();
    audio.reset();
    lab.CONFIGURE_OPERATOR({ ships: cabinet.settings[9], bonus: cabinet.settings[8] });
    lab.RESET(null, sourceRandomFromAttract());
    lab.TRIGGER_SOUND('ST1SND');
    mode = 'playing';
    gameOverWait = 0;
    hallDisplayTicks = 0;
    enterHeld = false;
    startEnterReleased = true;
    frames = 0;
    keys.clear();
    touchInput.clear();
    floatingJoystick.cancel();
    altitudeController.clear();
    hybridReverse.reset();
    pendingTaps.clear();
    fireRepeatTicks = 0;
    suppressFireClick = false;
    sourceBoundary = null;
    activeClock().reset();
    running = true;
    refreshAudioUI();
    document.getElementById('pause').textContent = 'Pause';
    draw();
    return true;
}
function watchDemo() {
    audio.reset();
    attract.SET_CREDITS(cabinet.credits);
    // A service/menu return must not reset the shared source RNG to $A55A.
    const sourceRandom = (mode === 'playing' || mode === 'game-over' || mode === 'hall-wait' || mode === 'demo-ai' || mode === 'demo-ai-over')
        ? lab.RANDOM_STATE() : sourceRandomFromAttract();
    attract.RESET(sourceRandom);
    mode = 'attract';
    gameOverWait = 0;
    hallDisplayTicks = 0;
    enterHeld = false;
    startEnterReleased = true;
    attract.SET_HALL_OF_FAME(hall.copyTables());
    frames = 0;
    keys.clear();
    touchInput.clear();
    floatingJoystick.cancel();
    altitudeController.clear();
    hybridReverse.reset();
    pendingTaps.clear();
    fireRepeatTicks = 0;
    suppressFireClick = false;
    sourceBoundary = null;
    activeClock().reset();
    running = true;
    refreshAudioUI();
    document.getElementById('pause').textContent = 'Pause';
    draw();
}
function fireSample() {
    // A very brief touch may start and finish between video IRQs: preserve
    // its press edge for the next SSCAN sample. Sustained touch/keyboard uses
    // the same source LFIRE pulse cadence as the existing browser adapter.
    const tapped = pendingTaps.has('KeyF') || touchInput.consume('KeyF');
    if (!inputHeld('KeyF')) {
        fireRepeatTicks = 0;
        return tapped;
    }
    if (fireRepeatTicks <= 0) {
        fireRepeatTicks = FIRE_REPEAT_TICKS - 1;
        return true;
    }
    fireRepeatTicks--;
    return false;
}
function draw() {
    refreshCabinetUI();
    // Development annotations never cover the original attract artwork.
    if (mode === 'service') {
        document.getElementById('hallControls').hidden = true;
        drawCabinetService(ctx, serviceTestIndex, canvas.width, canvas.height);
        fps.textContent = SERVICE_TESTS[serviceTestIndex][0];
        return;
    }
    if (mode === 'power-off') {
        document.getElementById('hallControls').hidden = true;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        fps.textContent = 'POWER OFF';
        labStatus.textContent = 'Press POWER ON to start the original ROM-derived RAM rug test and startup sound.';
        return;
    }
    if (mode === 'boot') {
        document.getElementById('hallControls').hidden = true;
        presentFrame(ctx, boot.video, boot.ram);
        fps.textContent = boot.STATE().message;
        labStatus.textContent = 'ROMF8.RESET/RAM3/RAM7 → ROMC0.RORAOK → ROMF8.GAMEOV. Diagnostic hardware, ROM checks and exact timing are not emulated.';
        return;
    }
    document.getElementById('hallControls').hidden = mode !== 'hall-entry';
    if (mode === 'hall-entry' || mode === 'hall-table') {
        const h = hall.STATE();
        document.body?.classList?.add?.('attract-mode');
        document.getElementById('waveReadout').textContent =
            mode === 'hall-entry' ? `HALL OF FAME ENTRY · ${h.score} POINTS` : 'HALL OF FAME';
        presentFrame(ctx, attract.video, attract.ram);
        display.textContent = `AMODE1 HALLOF / HOFIN / HOFUL / HOFST / HOFUD / HOFAS\n` +
            `SCORE ${mode === 'hall-entry' ? h.score : h.lastQualifiedScore}   INITIALS ${h.initials}   ACTIVE ${h.active + 1}   STALT ${h.stall}\n` +
            `TODAY ${h.today.map(r => r.initials + ' ' + r.score).join(' · ')}\n` +
            `ALL TIME ${h.allTime.map(r => r.initials + ' ' + r.score).join(' · ')}`;
        fps.textContent = frames + ' source hall-entry ticks';
        labStatus.textContent = mode === 'hall-entry' ?
            'Use UP / DOWN to change the underlined initial, FIRE to accept. Source timeout: first initial 40 s, subsequent 20 s.' :
            'All-time highs retained by browser storage (CMOS adapter). Today’s scores reset on a fresh power-on.';
        return;
    }
    document.body?.classList?.toggle?.('attract-mode', mode === 'attract' || mode === 'demo-ai' || mode === 'demo-ai-over');
    if (mode === 'attract') {
        const a = attract.STATE();
        const names = { presentation: 'WILLIAMS ELECTRONICS PRESENTS', highscores: 'HALL OF FAME', instructions: 'DEFENDER INSTRUCTIONS / DEMONSTRATION' };
        document.getElementById('waveReadout').textContent = 'ATTRACT MODE · ' + names[a.page] + ' · ' + (cabinet.CAN_START(1) ? 'PRESS START' : 'INSERT COIN');
        document.getElementById('humanReadout').textContent = 'ORIGINAL AMODE1.SRC · ' + a.step + ' · ' + a.objects.length + ' DEMONSTRATION OBJECTS';
        presentFrame(ctx, attract.video, attract.ram);
        display.textContent = 'WILLIAMS DEFENDER — ORIGINAL SOURCE ATTRACT MODE\n' +
            'AMODES / LOGO / HALDIS / LEDRET / AMODE1–8 / AMOD12\n' +
            'PAGE: ' + a.page + '   STEP: ' + a.step + '   TICKS: ' + a.tick + '\n' +
            'DEMO OBJECTS: ' + a.objects.map(x => x.picture + ' @ ' + x.x16.toString(16)).join(', ') + '\n' +
            'Hall of Fame: original ROMC8.DEFALT factory records; coin ledger is a browser boundary, not native PIA switch wiring.\n' +
            (cabinet.CAN_START(1) ? 'Press START for wave one.' : 'Insert a coin to enable START.');
        fps.textContent = frames + ' video IRQ ticks · ' + a.cpuBudget.executivePasses + ' EXEC passes · TIMER ' + a.cpuBudget.timer + ' (last read ' + a.cpuBudget.lastTimerRead + ') · ' + a.cpuBudget.overrunFrames + ' busy frames · ' + VIDEO_CLOCK_HZ.toFixed(3) + ' Hz';
        labStatus.textContent = 'Stage 51: the video IRQ increments a byte-sized TIMER; EXEC reads and clears accumulated ticks once per process pass. 6809 graphics-cycle counts remain partial estimates, not a full ROM trace.';
        return;
    }
    const state = lab.STATE();
    if (mode === 'demo-ai' || mode === 'demo-ai-over') {
        document.getElementById('waveReadout').textContent = 'AI DEMONSTRATION · GAME ' + aiGamesPlayed;
    }
    if (floatingVisualReady) drawAltitudeVisual(state);
    const allObjects = lab.ENEMY_STATE();
    const { living: humans, count: livingCount } = lab.ASTRONAUT_STATE();
    const wave = lab.WAVE_STATE();
    const bonus = state.bonus;
    document.getElementById('waveReadout').textContent = bonus ?
        `ATTACK WAVE ${bonus.wave} COMPLETED · BONUS ×${bonus.multiplier} · ` +
            `ASTRONAUTS AWARDED ${bonus.awards}/${bonus.survivors} · ` +
            `${bonus.phase === 'hold' ? 'NEXT WAVE IN ' + bonus.waitTicks + ' TICKS' : 'AWARD EVERY 4 TICKS'} · ` +
            `SMART BOMBS ${state.infiniteSmartBombs ? '∞' : state.smartBombs}` :
        `WAVE ${wave.wave} · LANDERS ${wave.landerCount} active, ${wave.landerReserve} in reserve · ` +
            `BAITERS ${wave.ufoCount} · MUTANTS ${lab.ram.read8(lab.Layout.at('SCZCNT'))} · ` +
            `SCANNER ${state.scannerObjects} blips · SHIPS ${state.shipsInReserve} reserve · SMART BOMBS ${state.infiniteSmartBombs ? '∞' : state.smartBombs} ${state.smartBombActive ? '(FIRING)' : ''} · ` +
            `HYPERSPACE ${state.hyperspaceActive ? 'IN PROGRESS' : state.hyperspaces} · LASERS ${state.laserShots}`;
    const onScreen = humans.filter(o => {
        if (!o.video)
            return false;
        const x = (o.video >>> 8) * 2, y = o.video & 255;
        return x < 304 && x + 4 > 12 && y < 247 && y + 8 > 7;
    });
    document.getElementById('humanReadout').textContent =
        `ASTRONAUTS: ${livingCount} alive across planet · ${onScreen.length} visible in playfield · original 4×8-pixel sprites near terrain`;
    // Browser displays only actual source writes to the VIDEO framebuffer.
    // There is NO separate Canvas sprite-drawing algorithm.
    presentFrame(ctx, lab.video, lab.ram);
    drawDemoBanner();
    display.textContent = `NPLAXC (byte X) ${state.x.toString().padStart(4)}    PLAYC    ${state.y}\n` +
        `ship X (pixels)   ${(state.x * 2).toString().padStart(4)}    image    ${state.direction & 0x8000 ? 'PLBPIC' : 'PLAPIC'}\n` +
        `PLAX16     $${state.plax16.toString(16).padStart(4, '0')}    PLAY16  $${state.play16.toString(16).padStart(4, '0')}\n` +
        `PLAXV      ${state.vx.toString().padStart(5)}:${state.vxFraction.toString(16).padStart(2, '0')}  PLAYV    ${state.vy}\n` +
        `BGL        $${state.bgl.toString(16).padStart(4, '0')}    BGLX     $${state.bglx.toString(16).padStart(4, '0')}  BLK71 BGLX $${state.terrainBglx.toString(16).padStart(4, '0')}\n` +
        `PLABX      $${state.worldX.toString(16).padStart(4, '0')}    BGDELT   ${state.bgdelt}\n` +
        `PLADIR     $${state.direction.toString(16).padStart(4, '0')}    SEED     $${state.seed.toString(16).padStart(2, '0')}  REVFLG ${state.reverseActive}\n` +
        `SMART BOMBS ${state.infiniteSmartBombs ? "∞ (temporary)" : state.smartBombs + " remaining"}, active ${state.smartBombActive}  PLANET ${state.status & 2 ? 'DESTROYED' : 'intact'}\n` +
        `SHIPS IN RESERVE ${state.shipsInReserve}  PLAYER DEATHS ${state.playerDeaths}  ${state.gameOver ? "GAME OVER" : state.playerDeathActive ? "SHIP SHATTER / DEATH SEQUENCE" : "ACTIVE"}\n` +
        `SNDPRI     $${state.sndpri.toString(16).padStart(2, '0')}    SNDTMR   ${state.sndtmr}  SNDREP ${state.sndrep}\n` +
        `SOUND PIA bus bytes ${state.soundBus.map(n => n.toString(16).padStart(2, '0')).join(' ') || '(idle)'}\n` +
        `SCORE (P1SCR)     ${state.scoreBCD.map(n => n.toString(16).padStart(2, '0')).join(' ')} packed BCD\n` +
        `SCORE DISPLAY     ${state.scoreRequests.at(-1) || '(not requested)'}\n` +
        `RASTER IRQ TIMER   ${lab.ram.read8(lab.Layout.at('TIMER'))}   IFLG  ${lab.ram.read8(lab.Layout.at('IFLG'))}\n` +
        `SOURCE OBJECTS STARTED  ${allObjects.map(e => e.label + '@' + e.worldX.toString(16)).join('  ')} (some may now be dead)\n` +
        `ORIGINAL SCANNER BLIPS ${state.scannerObjects} (SCNR via OPTR/IPTR, in same video RAM)\n` +
        `STAGE 35 WAVE: GEXEC ${state.wave.ticks}  Baiter births ${state.wave.ufoSpawned} / UFOCNT ${state.wave.ufoCount}  Lander births ${state.wave.landerSpawned} / LNDCNT ${state.wave.landerCount}  ASTCNT ${state.wave.astronautCount}  COMPLETED WAVES ${state.wavesCompleted}  LASER HITS ${state.laserHits}`;
    fps.textContent = frames + ' source updates · nominal ' + VIDEO_CLOCK_HZ.toFixed(3) + ' Hz' + (bonus ? ' · SOURCE BONUS' : state.gameOver ? ' · GAME OVER' : state.playerDeathActive ? ' · SHIP DESTROYED' : '');
    if (state.gameOver) {
        labStatus.textContent = 'GAME OVER — all three ships lost. Press Reset to play again. Smart Bombs remain unlimited in this development build.';
    }
}
function step() {
    if (mode === 'service' || mode === 'power-off') return false;
    if (mode === 'boot') {
        if (boot.STEP().finished) {
            attract.SET_CREDITS(cabinet.credits);
            attract.RESET();
            mode = 'attract';
            activeClock().reset();
            refreshCabinetUI();
        }
        frames++;
        return true;
    }
    if (mode === 'hall-entry' || mode === 'hall-wait') {
        hall.STEP({
            up: inputHeld('ArrowUp'), down: inputHeld('ArrowDown'),
            fire: inputHeld('KeyF') || keys.has('Enter') || touchInput.consume('KeyF')
        });
        frames++;
        if (hall.STATE().phase === 'finished') {
            mode = 'hall-table';
            attract.SET_HALL_OF_FAME(hall.copyTables());
            attract.HALDIS(); // AMODE1.HALL13: jump to HALDIS exactly once
            hallDisplayTicks = HALL_DISPLAY_TICKS;
            keys.clear();
    touchInput.clear(); // GNCIDE/HALL13 no longer processes initials FIRE
            pendingTaps.clear();
            startEnterReleased = !enterHeld; // FIRE/Enter might still be held
            // The original does NOT stop on the scores table.
            running = true;
        }
        return true;
    }
    if (mode === 'hall-table') {
        // HALD3: DEC STALT, NAPP 10,HALLD3, repeating 60 times.
        // Coin, service reset and two-player PIA inputs are not yet wired.
        frames++;
        if (--hallDisplayTicks <= 0) {
            attract.LEDRET(); // HALD4: instructions follow the score table
            mode = 'attract';
            attractClock.reset();
        }
        return true;
    }
    if (mode === 'game-over') {
        frames++;
        if (--gameOverWait <= 0) {
            const score = decodePackedScore(lab.STATE().scoreBCD);
            // HALLOF reads the last player score after PLE2's 40-tick sleep.
            attract.SET_CREDITS(cabinet.credits);
            attract.RESET(lab.RANDOM_STATE());
            attract.SET_HALL_OF_FAME(hall.copyTables());
            // Single-player Stage 53: P2SCR is zero. Source HALL12
            // still checks it; it must not request a second entry.
            const qualified = hall.HALLOF(score, 0);
            mode = qualified ? 'hall-entry' : 'hall-wait';
            keys.clear();
    touchInput.clear();
            pendingTaps.clear();
        }
        return true;
    }
    if (mode === 'attract') {
        try {
            const before=attract.STATE();
            attract.DISPLAY_STEP();
            frames++;
            const after=attract.STATE();
            // AMOD13 is the last enemy-showcase continuation. Play normally
            // until that original sequence has finished, then hand over.
            if(before.page==='instructions' && before.step==='AMOD13' && after.page==='presentation')
                startAttractPilot();
            return true;
        }
        catch (error) {
            sourceBoundary = error instanceof Error ? error.message : String(error);
            running = false;
            labStatus.textContent = 'Attract source boundary: ' + sourceBoundary;
            return false;
        }
    }
    if (mode === 'demo-ai-over') {
        frames++;
        if (--aiGameOverTicks<=0) startAttractPilot(lab.RANDOM_STATE());
        return true;
    }
    if (sourceBoundary)
        return false;
    try {
        if(mode==='demo-ai') {
            const controls=attractPilot.sample(lab.STATE(),lab.ENEMY_STATE(),
                lab.ASTRONAUT_STATE(),lab.ram,lab.Layout,{altitude:lab.ALTITUDE});
            lab.INPUT(controls);
            lab.STEP();
            frames++;
            if(lab.STATE().gameOver){mode='demo-ai-over';aiGameOverTicks=180;lab.INPUT({});}
            return true;
        }
        const pulseFire = fireSample();
        const bombSwitch = inputHeld('KeyS') || inputEdge('KeyS');
        const hyperSwitch = inputHeld('KeyH') || inputEdge('KeyH');
        const originalDirection = lab.STATE();
        const positionalAltitude = touchEnabled && mode === 'playing' && floatingJoystick.state().active
            ? altitudeController.sample(originalDirection.play16, originalDirection.vy)
            : { up: false, down: false };
        // Physical keyboard direction takes precedence if held. Automatic Y
        // control never changes PLAYER coordinates or velocity directly.
        const manualUp = inputHeld('ArrowUp');
        const manualDown = inputHeld('ArrowDown');
        const automaticReverse = touchEnabled && mode === 'playing' && hybridReverse.sample(
            floatingJoystick.state().horizontal,
            originalDirection.direction,
            originalDirection.reverseActive,
            pulseFire || bombSwitch || hyperSwitch
        );
        lab.INPUT({ thrust: inputHeld('Space') || inputHeld('ArrowRight'),
            up: manualUp || (!manualDown && positionalAltitude.up),
            down: manualDown || (!manualUp && positionalAltitude.down),
            reverse: inputHeld('KeyR') || inputEdge('KeyR') || automaticReverse,
            smartBomb: bombSwitch,
            hyperspace: hyperSwitch,
            fire: pulseFire });
        pendingTaps.clear();
        lab.STEP();
        frames++;
        if (lab.STATE().gameOver) {
            mode = 'game-over';
            gameOverWait = 40; // DEFA7.PLE2: NAP 40,PLE3 / ATTR -> HALLOF
            document.getElementById('pause').textContent = 'Game over';
            return true;
        }
        return true;
    }
    catch (error) {
        // Stage 75: an unattended AI demonstration never stops at a source
        // boundary or original ERROR trap; it logs it and starts a fresh demo
        // game. Player games keep the original stop-and-report behaviour.
        if (mode === 'demo-ai') {
            aiRecoveries++;
            console.warn('AI demo restarted after source boundary:', error instanceof Error ? error.message : error);
            startAttractPilot(sourceRandomFromAttract());
            return true;
        }
        // Do not silently simulate a missing source routine or crash the animation loop.
        // The original game will resume only once the untranslated dependency exists.
        sourceBoundary = error instanceof Error ? error.message : String(error);
        running = false;
        activeClock().pause();
        audio.suspend();
        document.getElementById('pause').textContent = 'Source boundary';
        labStatus.textContent = `Stopped at unimplemented original source dependency: ${sourceBoundary}. Reset to restart wave one.`;
        return false;
    }
}
function loop(timestamp) {
    if (running) {
        const steps = activeClock().consume(timestamp);
        for (let i = 0; i < steps; i++)
            if (!step())
                break;
    }
    else
        activeClock().pause();
    draw();
    requestAnimationFrame(loop);
}
window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && fauxFullscreen && !controlsOpen) {
        fauxFullscreen = false;
        document.getElementById('arcadeShell').classList?.remove?.('is-faux-fullscreen');
        updateFullscreenButton();
        e.preventDefault();
        return;
    }
    if (controlsOpen) {
        if (pendingBinding) {
            e.preventDefault(); // In particular: capture Tab instead of changing focus.
            if (e.code === 'Escape') {
                pendingBinding = null;
                renderControlRows();
                showControlMessage('Assignment cancelled.');
                return;
            }
            try {
                controlBindings = assignControl(controlBindings, pendingBinding, e.code);
                const saved = saveControlBindings(controlStorage, controlBindings);
                pendingBinding = null;
                renderControlRows();
                showControlMessage(saved ? 'Key saved.' : 'Key assigned. Storage is unavailable, so it may reset when the page closes.');
            } catch (error) {
                showControlMessage(error.message + '. Choose another key or press Escape.');
            }
            return;
        }
        if (e.code === 'Escape') { e.preventDefault(); closeKeySettings(); }
        // Other keys are for the dialog (Tab navigation, Enter on a button),
        // never for the game while configuration is open.
        return;
    }
    if (e.code === 'Escape' && document.getElementById('cabinetMenu')?.open) {
        document.getElementById('cabinetMenu').open = false;
        e.preventDefault();
        return;
    }
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '');
    if (!typing && !e.repeat && !logicalKeyForCode(e.code, controlBindings)) {
        if (e.code === 'KeyP' && mode === 'playing') { e.preventDefault(); togglePause(); return; }
        if (e.code === 'KeyM') { e.preventDefault(); toggleSound(); return; }
    }
    const logicalKey = logicalKeyForCode(e.code, controlBindings);
    if (mode === 'hall-entry' && (logicalKey === 'KeyF' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            enterHeld = true;
            startEnterReleased = false;
        }
        keys.add('KeyF');
        e.preventDefault();
        return;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        // START is a browser/cabinet boundary, not one of the seven
        // configurable gameplay inputs. Keep it on Enter outside gameplay.
        // In PLAYING, however, allow Enter to pass through the configurable
        // FIRE binding below rather than swallowing it as a START key.
        e.preventDefault(); // Avoid activating focused buttons during play.
        enterHeld = true;
        if (mode === 'attract' || mode === 'hall-table' || mode === 'game-over' || mode === 'demo-ai' || mode === 'demo-ai-over') {
            if (!e.repeat && startEnterReleased) {
                startGame();
                enterHeld = true; // StartGame resets the input state.
                startEnterReleased = false; // The initial key must be released first.
            }
            return;
        }
        if (mode !== 'playing' || logicalKey !== 'KeyF') return;
    }
    if (mode === 'attract' || mode === 'boot' || mode === 'service') return;
    if (logicalKey) {
        // The original PIA switch scan sees one edge per physical keydown.
        // A browser key-repeat must not generate extra press edges.
        if (!keys.has(logicalKey)) pendingTaps.add(logicalKey);
        keys.add(logicalKey);
        e.preventDefault(); // Tab, Space, arrow keys and Backspace must not navigate/scroll.
        return;
    }
    // Development-only debug shortcuts are not source cabinet controls.
    // A rebind to one of these letters always takes priority above them.
    if (mode !== 'playing') return;
    const diagnostics = {
        KeyB: () => lab.TEST_SCANNER(),
        KeyT: () => lab.TEST_TERRAIN(),
        KeyG: () => lab.TEST_SCORE(),
        KeyO: () => lab.TEST_OPROC(),
        KeyE: () => lab.TEST_OFSHIT(),
        KeyV: () => lab.TEST_FBOUT()
    };
    if (!e.repeat && diagnostics[e.code]) {
        diagnostics[e.code]();
        draw();
        e.preventDefault();
    }
});
window.addEventListener('keyup', e => {
    if (controlsOpen) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        // Keyup is required to stop a held Enter/FIRE. In high-score entry,
        // Enter remains an explicit FIRE confirmation even if the gameplay
        // mapping is F or another key.
        if (mode === 'hall-entry' || mode === 'hall-wait') keys.delete('KeyF');
        const logicalKey = logicalKeyForCode(e.code, controlBindings);
        if (logicalKey) keys.delete(logicalKey);
        enterHeld = false;
        startEnterReleased = true;
        e.preventDefault();
        return;
    }
    const logicalKey = logicalKeyForCode(e.code, controlBindings);
    if (logicalKey) {
        keys.delete(logicalKey);
        e.preventDefault();
    }
});
window.addEventListener('blur', () => {
    keys.clear();
    touchInput.clear();
    floatingJoystick.cancel();
    altitudeController.clear();
    hybridReverse.reset();
    pendingTaps.clear();
    fireRepeatTicks = 0;
    audio.suspend();
});
window.addEventListener('focus', () => {
    if (running)
        audio.resume();
});
document.addEventListener?.('visibilitychange', () => {
    if (document.hidden)
        audio.suspend();
    else if (running)
        audio.resume();
});
const START_MODES = ['attract', 'hall-table', 'demo-ai', 'demo-ai-over'];
const DEMO_MODES = ['demo-ai', 'demo-ai-over'];
const uiCache = new Map();
/** Write a DOM property only when it changes (this runs every frame). */
function setUI(id, prop, value) {
    const key = id + '.' + prop;
    if (uiCache.get(key) === value) return;
    uiCache.set(key, value);
    const el = document.getElementById(id);
    if (!el) return;
    if (prop === 'html') el.innerHTML = value;
    else if (prop === 'class') el.className = value;
    else if (prop.startsWith('aria-')) el.setAttribute?.(prop, value);
    else el[prop] = value;
}
let demoSoundGated = false;
/** Stage 77: the AI demo is always silent. Leaving it power-cycles the sound
 * board so no demo background (BG1 after thrust) leaks into the next game. */
function gateDemoSound() {
    const gate = DEMO_MODES.includes(mode);
    if (gate === demoSoundGated) return;
    demoSoundGated = gate;
    audio.reset();
    audio.setGated(gate);
}
function cabinetStatusText(canStart) {
    const credits = cabinet.credits, free = cabinet.settings[17];
    switch (mode) {
    case 'power-off': return 'Press <strong>POWER ON</strong> to switch the cabinet on. This also enables sound.';
    case 'boot': return 'Cabinet self-test… the attract mode follows.';
    case 'service': return 'Service references. Use the menu to step through or exit.';
    case 'playing': return running ? 'Game in progress. <strong>P</strong> pauses, <strong>M</strong> mutes.' : '<strong>Paused.</strong> Press P or RESUME to continue.';
    case 'game-over': case 'hall-wait': return 'Game over.';
    case 'hall-entry': return 'New high score! Use UP / DOWN to choose each initial, FIRE to accept.';
    case 'demo-ai': case 'demo-ai-over':
        return 'AI demo running (sound off). Press <strong>START</strong> to play yourself, or <strong>STOP DEMO</strong>.';
    default:
        if (free) return 'Free play. Press <strong>START</strong> (or Enter) to play, or watch the AI.';
        if (canStart) return `${credits} credit${credits === 1 ? '' : 's'}. Press <strong>START</strong> (or Enter) to play.`;
        return 'Press <strong>START</strong> to insert a coin and play, or <strong>INSERT COIN</strong> first. Or watch the AI play.';
    }
}
function refreshCabinetUI() {
    gateDemoSound();
    const poweredOn = mode !== 'power-off';
    const inStartMode = START_MODES.includes(mode);
    const inDemo = DEMO_MODES.includes(mode);
    const canStart = inStartMode && cabinet.CAN_START(1);
    setUI('creditReadout', 'textContent', `CREDITS ${cabinet.credits}` + (cabinet.settings[17] ? ' · FREE PLAY' : ''));
    setUI('powerOnCabinet', 'hidden', poweredOn);
    setUI('playControls', 'hidden', !poweredOn);
    setUI('coinInsert', 'disabled', mode === 'boot');
    // START works from attract, Hall of Fame and the AI demo. With no credit it
    // inserts the coin itself (startGame), so it is only disabled while booting.
    setUI('startGameTop', 'hidden', mode === 'playing');
    setUI('startGameTop', 'disabled', !inStartMode);
    setUI('startGame', 'disabled', !inStartMode);
    setUI('watchAI', 'hidden', !(inStartMode || mode === 'game-over'));
    setUI('watchAI', 'textContent', inDemo ? '■ STOP DEMO' : 'WATCH AI PLAY');
    setUI('watchAI', 'title', inDemo ? 'Stop the AI demo and return to the attract mode' : 'Watch the AI play a normal game (sound off)');
    setUI('watchAI', 'class', inDemo ? 'demo-button is-stop' : 'demo-button');
    setUI('pauseTop', 'hidden', mode !== 'playing');
    setUI('pauseTop', 'textContent', running ? '❚❚ PAUSE' : '▶ RESUME');
    setUI('cabinetStatus', 'html', cabinetStatusText(canStart));
    if (document.body?.classList) document.body.classList.toggle('cab-idle', inStartMode);
    const s = audio.state();
    const soundOn = s.enabled && !s.muted;
    setUI('soundQuick', 'textContent', soundOn ? '🔊 SOUND' : '🔇 SOUND');
    setUI('soundQuick', 'aria-pressed', String(soundOn));
    setUI('soundQuick', 'title', soundOn ? 'Mute sound (M)' : 'Turn sound on (M)');
    const rows = cabinet.audit;
    setUI('cabinetAudits', 'textContent', Object.entries(AUDIT_LABELS)
        .map(([k,v])=>`FUNCTION ${k} · ${v}: ${rows[k]}`).join('\n'));
}
function renderOperatorSettings(){
    const grid=document.getElementById('operatorSettingsGrid');
    if (typeof document.createElement !== 'function' || !grid.replaceChildren) return;
    grid.replaceChildren();
    for (const [id,title] of Object.entries(OPERATOR_LABELS)){
        const label=document.createElement('label');
        label.textContent=`${id} · ${title}`;
        const input=document.createElement('input');
        input.type='number';input.value=String(cabinet.settings[id]);
        input.setAttribute('aria-label', title);
        input.onchange=()=>{
            try { cabinet.ADJUST(id,Number(input.value));
                input.value=String(cabinet.settings[id]);
                if (Number(id)===17)refreshCabinetUI();
            }catch{ input.value=String(cabinet.settings[id]); }
        };
        grid.append(label,input);
    }
}
document.getElementById('factoryOperator').onclick=()=>{cabinet.FACTORY();renderOperatorSettings();refreshCabinetUI();};
document.getElementById('clearAudits').onclick=()=>{cabinet.RESET_AUDITS();refreshCabinetUI();};
document.getElementById('clearCredits').onclick=()=>{cabinet.RESET_CREDITS();attract.SET_CREDITS(0);refreshCabinetUI();};
renderOperatorSettings();
refreshCabinetUI();
const audioButton = document.getElementById('audioToggle');
const audioVolume = document.getElementById('audioVolume');
const audioLabel = document.getElementById('audioLabel');
let startupCuePlayed = false;
/** Browser audio cannot autoplay. The initial POWER ON click is the cabinet
 * power switch and also unlocks the Stage 47 original QUASAR sound. */
async function powerOnCabinet() {
    audio.reset();
    try { await audio.enable(); } catch { /* Silent boot if browser denies sound. */ }
    // ROMF8.RESET drives the sound PIA immediately, ahead of RESET1's
    // palette and RAM2 video writes. Put QUASAR at the power-on boundary,
    // not after the browser constructs its boot screen.
    audio.powerOn();
    boot.RESET();
    mode = 'boot';
    sourceBoundary = null;
    frames = 0;
    keys.clear();
    touchInput.clear();
    pendingTaps.clear();
    attractClock.reset();
    running = true;
    startupCuePlayed = true;
    refreshAudioUI();
    refreshCabinetUI();
    draw();
}
document.getElementById('powerOnCabinet').onclick = () => powerOnCabinet();

function refreshAudioUI() {
    const s = audio.state();
    audioButton.textContent = s.muted ? 'UNMUTE SOUND' : (s.enabled ? 'MUTE SOUND' : 'ENABLE SOUND');
    audioLabel.textContent = s.enabled ? (s.muted ? 'SOUND MUTED' : 'SOUND ON') : 'SOUND OFF';
}
audioButton.onclick = () => {
    const s = audio.state();
    if (!s.enabled) {
        void audio.enable().then(() => {
            // The real cabinet plays QUASAR at power-up. Browser autoplay rules
            // postpone this initial cue until this explicit ENABLE SOUND gesture.
            if (mode === 'power-off') { void powerOnCabinet(); }
            refreshAudioUI();
        }).catch(err => {
            audioLabel.textContent = 'AUDIO ERROR: ' + err.message;
        });
    }
    else
        audio.setMuted(!s.muted);
    refreshAudioUI();
};
audioVolume.oninput = () => {
    audio.setVolume(Number(audioVolume.value) / 100);
    refreshAudioUI();
};
refreshAudioUI();
document.getElementById('startGame').onclick = startGame;
document.getElementById('startGameTop').onclick = startGame;
document.getElementById('watchAI').onclick = () => {
    if (DEMO_MODES.includes(mode)) watchDemo();
    else startAttractPilot();
    draw();
};
function togglePause() {
    if (mode !== 'playing') return;
    document.getElementById('pause').onclick();
    refreshCabinetUI();
}
document.getElementById('pauseTop').onclick = togglePause;
function toggleSound() {
    const s = audio.state();
    if (!s.enabled || s.muted) {
        audio.setMuted(false);
        void audio.enable().then(() => { if (mode === 'power-off') void powerOnCabinet(); refreshAudioUI(); }).catch(() => {});
    } else
        audio.setMuted(true);
    refreshAudioUI();
    refreshCabinetUI();
}
document.getElementById('soundQuick').onclick = toggleSound;
// The menu closes on Escape or a click elsewhere, like any drop-down.
document.addEventListener?.('pointerdown', e => {
    const menu = document.getElementById('cabinetMenu');
    if (menu?.open && !menu.contains?.(e.target)) menu.open = false;
});
document.getElementById('serviceTests').onclick = () => {
    serviceTestIndex=0;mode='service';running=false;
    document.getElementById('nextServiceTest').hidden=false;
    document.getElementById('exitServiceTests').hidden=false;
    document.getElementById('serviceTests').hidden=true;
    refreshCabinetUI();draw();
};
document.getElementById('nextServiceTest').onclick=()=>{
    serviceTestIndex=(serviceTestIndex+1)%SERVICE_TESTS.length;draw();
};
document.getElementById('exitServiceTests').onclick=()=>{
    document.getElementById('nextServiceTest').hidden=true;
    document.getElementById('exitServiceTests').hidden=true;
    document.getElementById('serviceTests').hidden=false;
    watchDemo();
};
document.getElementById('coinInsert').onclick = () => {
    cabinet.COIN('left');
    attract.SET_CREDITS(cabinet.credits);
    refreshCabinetUI();
    // Coin event: original CNSND = priority FF, one $18 tick command $19.
    // Use the real original SNDOUT two-byte PIA handshake.
    const coinSound = () => {
        audio.writePIA(0x3f);
        audio.writePIA((~0x19) & 0x3f, 0x18);
        refreshAudioUI();
    };
    if (!audio.state().enabled) void audio.enable().then(coinSound).catch(() => {});
    else coinSound();
    draw();
};
document.getElementById('rebootCabinet').onclick = () => {
    // Power cycling does not create a paid credit or erase CMOS.
    audio.reset();
    // Reboot changes the cabinet state immediately, independent of the
    // asynchronous Web Audio permission/resume operation.
    if (audio.state().enabled) audio.powerOn();
    else void audio.enable().then(() => audio.powerOn()).catch(() => {});
    boot.RESET();
    mode = 'boot';
    keys.clear();
    touchInput.clear();pendingTaps.clear();
    attractClock.reset();
    frames = 0;running = true;sourceBoundary = null;
    document.getElementById('cabinetMenu').open = false;
    refreshCabinetUI();draw();
};
document.getElementById('watchDemo').onclick = watchDemo;
document.getElementById('hallTest').onclick = () => {
    // Development-only fast path. Cannot affect score during normal play.
    void audio.enable();
    attract.RESET();
    attract.SET_HALL_OF_FAME(hall.copyTables());
    hall.HALLOF(Math.min(999999, hall.STATE().today[0].score + 100), 0);
    mode = 'hall-entry';
    keys.clear();
    touchInput.clear();
    pendingTaps.clear();
    frames = 0;
    running = true;
    activeClock().reset();
    draw();
};
document.getElementById('laserSound').onclick = () => {
    if (mode === 'attract' || mode === 'boot' || mode === 'service')
        return;
    // Keyboard/automated click paths still work, but a pointer-originated
    // click must not double-fire the immediate pointerdown shot.
    // Programmatic click is a diagnostic fallback; real pointer input goes via SSCAN.
    if (!suppressFireClick)
        lab.FIRE();
    suppressFireClick = false;
    draw();
};
document.getElementById('scannerTest').onclick = () => {
    lab.TEST_SCANNER();
    draw();
};
document.getElementById('terrainTest').onclick = () => {
    lab.TEST_TERRAIN();
    draw();
};
document.getElementById('scoreTest').onclick = () => {
    lab.TEST_SCORE();
    draw();
};
document.getElementById('eraseTest').onclick = () => {
    lab.TEST_OFSHIT();
    draw();
};
document.getElementById('objectTest').onclick = () => {
    lab.TEST_OPROC();
    draw();
};
document.getElementById('fireballTest').onclick = () => {
    lab.TEST_FBOUT();
    draw();
};
// On-screen high-score controls are the original joystick/fire signals.
for (const [id, key] of [['hallUp', 'ArrowUp'], ['hallDown', 'ArrowDown'], ['hallFire', 'KeyF']]) {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(key); try { el.setPointerCapture?.(e.pointerId); } catch { /* Synthetic pointer events lack active capture. */ } });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        el.addEventListener(type, e => { e.preventDefault(); keys.delete(key); });
    }
}
document.getElementById('pause').onclick = () => {
    if (sourceBoundary)
        return;
    running = !running;
    activeClock().pause();
    if (running)
        audio.resume();
    else
        audio.suspend();
    document.getElementById('pause').textContent = running ? 'Pause' : 'Resume';
};
document.getElementById('step').onclick = () => {
    running = false;
    activeClock().pause();
    document.getElementById('pause').textContent = 'Resume';
    step();
    draw();
};
document.getElementById('reset').onclick = () => {
    audio.reset();
    if (mode === 'attract' || mode === 'demo-ai' || mode === 'demo-ai-over') {
        watchDemo();
        return;
    }
    if (mode !== 'playing') { watchDemo(); return; }
    lab.RESET();
    frames = 0;
    keys.clear();
    touchInput.clear();
    floatingJoystick.cancel();
    altitudeController.clear();
    hybridReverse.reset();
    pendingTaps.clear();
    fireRepeatTicks = 0;
    suppressFireClick = false;
    activeClock().reset();
    sourceBoundary = null;
    running = true;
    document.getElementById('pause').textContent = 'Pause';
    labStatus.textContent = 'Stage 48: original source sound tables and PIA DAC output active. The audio board retains source sound priorities and repeat counts.';
    draw();
};
// A touch-and-hold must remain a game control, not a selectable text node.
// Apply this to *all* buttons, including one-shot diagnostic and reset buttons.
// Do not cancel their click/tap events; only suppress context menus/selection.
for (const el of document.querySelectorAll('button')) {
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('selectstart', e => e.preventDefault());
    el.addEventListener('dragstart', e => e.preventDefault());
}
// Continuous controls: pointer events work for touch, pen and mouse.
// A non-passive touchstart guard is needed on some Android WebViews that
// otherwise display the system copy/paste callout despite touch-action:none.
for (const el of document.querySelectorAll('[data-key]')) {
    const k = el.getAttribute('data-key');
    const activePointers = new Set();
    const down = e => {
        e.preventDefault();
        if (mode === 'attract' || mode === 'boot' || (mode === 'hall-entry' && !['KeyF','ArrowUp','ArrowDown'].includes(k)))
            return;
        if (!activePointers.size && k === 'KeyF') {
            fireRepeatTicks = 0;
            suppressFireClick = true;
        }
        if (!keys.has(k))
            pendingTaps.add(k);
        activePointers.add(e.pointerId);
        keys.add(k);
    };
    const up = e => {
        e.preventDefault();
        activePointers.delete(e.pointerId);
        if (!activePointers.size)
            keys.delete(k);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    window.addEventListener('blur', () => {
        activePointers.clear();
        keys.delete(k);
        fireRepeatTicks = 0;
    });
}
/** Stage 58 touch controls. The original game sees only SSCAN logical inputs.
 * This browser layer never alters source game routines or keyboard bindings. */
const touchOverlay = document.getElementById('touchOverlay');
const touchVisibilityButton = document.getElementById('toggleTouchControls');
const arcadeShell = document.getElementById('arcadeShell');
const fullscreenButton = document.getElementById('fullscreenToggle');
const TOUCH_STORAGE_KEY = 'defender-touch-controls-enabled-v1';
const defaultTouchEnabled =
    (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 &&
      !(typeof matchMedia === 'function' && matchMedia('(hover:hover) and (pointer:fine)').matches));
let touchEnabled = defaultTouchEnabled;
let floatingVisualReady = false;
try {
    const saved = cabinetStorage?.getItem(TOUCH_STORAGE_KEY);
    if (saved === 'true' || saved === 'false') touchEnabled = saved === 'true';
} catch { /* File origins may not allow persistence. */ }
function showTouchControls(enabled) {
    touchEnabled = !!enabled;
    document.body?.classList?.toggle?.('touch-enabled', touchEnabled);
    touchOverlay.hidden = !touchEnabled;
    touchVisibilityButton.textContent = touchEnabled ? 'HIDE TOUCH CONTROLS' : 'SHOW TOUCH CONTROLS';
    touchVisibilityButton.setAttribute?.('aria-pressed', String(touchEnabled));
    if (!touchEnabled) {
        touchInput.clear();
        floatingJoystick.cancel();
    altitudeController.clear();
        hybridReverse.reset();
        if (floatingVisualReady) resetFloatingVisual();
    }
    try { cabinetStorage?.setItem(TOUCH_STORAGE_KEY, String(touchEnabled)); } catch { }
}
touchVisibilityButton.onclick = () => showTouchControls(!touchEnabled);
showTouchControls(touchEnabled);

// Each finger owns one logical key. Capturing the pointer allows FIRE and
// THRUST to remain down simultaneously; a second finger can press SMART BOMB.
for (const element of document.querySelectorAll('[data-touch-action]')) {
    const logical = TOUCH_ACTIONS[element.getAttribute('data-touch-action')];
    if (!logical) continue;
    const heldPointers = new Set();
    const release = e => {
        e.preventDefault();
        heldPointers.delete(e.pointerId);
        touchInput.release(e.pointerId);
        element.classList?.toggle?.('is-held', heldPointers.size > 0);
    };
    element.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (!touchEnabled || (mode !== 'playing' &&
            !(mode === 'hall-entry' && ['KeyF','ArrowUp','ArrowDown'].includes(logical)))) return;
        heldPointers.add(e.pointerId);
        touchInput.set(e.pointerId, logical);
        element.classList?.add?.('is-held');
        try { element.setPointerCapture?.(e.pointerId); } catch { /* Synthetic event */ }
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        element.addEventListener(type, release);
    }
    element.addEventListener('touchstart', e => e.preventDefault(), { passive:false });
    element.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('blur', () => {
        heldPointers.clear();
        element.classList?.remove?.('is-held');
    });
}
// Stage 60: one LEFT thumb specifies an absolute destination altitude,
// plus RIGHT/LEFT (original REV switch on mismatch) and auto-THRUST.
// It floats to the point where the player first touches this large pad.
// It does not compete with independent right-hand FIRE/BOMB/HS pointers.
const joystick = document.getElementById('touchJoystick');
const joystickRing = document.getElementById('floatingRing');
const joystickKnob = document.getElementById('floatingKnob');
const targetMarker = document.getElementById('altitudeTarget');
const shipMarker = document.getElementById('altitudeShip');
floatingVisualReady = true;
function resetFloatingVisual() {
    joystick.classList?.remove?.('is-active');
    joystick.dataset.direction = 'neutral';
    if (joystickKnob) joystickKnob.style.transform = 'translate(-50%, -50%)';
    targetMarker.hidden = shipMarker.hidden = true;
}
function drawFloatingVisual() {
    const state = floatingJoystick.state();
    if (!state.active) return resetFloatingVisual();
    const bounds = joystick.getBoundingClientRect();
    // The visible ring follows touch-down. Its drawn centre is inset enough
    // to remain inside the pad; the ACTUAL axes use the real touch-down point.
    const radius = Math.min(55, Math.max(30, bounds.width * .28));
    const x = Math.max(radius, Math.min(bounds.width - radius, state.originX - bounds.left));
    // Reserve the caption areas at top/bottom of the pad.
    const safeY = radius + 22;
    const y = Math.max(safeY, Math.min(bounds.height - safeY, state.originY - bounds.top));
    joystickRing.style.left = x + 'px';
    joystickRing.style.top = y + 'px';
    const dx = Math.max(-radius * .66, Math.min(radius * .66, state.dx));
    // Vertical is an ABSOLUTE altitude, never displacement from touchdown.
    joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), -50%)`;
    joystick.classList?.add?.('is-active');
    joystick.dataset.direction = `${state.horizontal},altitude`;
    drawAltitudeVisual(lab.STATE());
}
function drawAltitudeVisual(shipState) {
    if (!floatingJoystick.state().active || mode !== 'playing') {
        targetMarker.hidden = shipMarker.hidden = true;
        return;
    }
    const { targetY, minY, maxY } = altitudeController.state();
    if (targetY === null) return;
    const clamp = y => Math.max(0, Math.min(100, 100 * (y - minY) / (maxY - minY)));
    targetMarker.hidden = shipMarker.hidden = false;
    targetMarker.style.top = `${clamp(targetY)}%`;
    shipMarker.style.top = `${clamp(shipState.play16 / 256)}%`;
}
function updateAltitudeFromPointer(clientY) {
    const rect = joystick.getBoundingClientRect();
    altitudeController.touch(clientY, rect.top, rect.height);
}
function syncFloatingInput() {
    const state = floatingJoystick.state();
    if (!state.active) return;
    touchInput.setMany(state.pointerId, hybridJoystickKeys(state, {
        hallEntry: mode === 'hall-entry', altitudeMode: mode === 'playing'
    }));
    drawFloatingVisual();
}
joystick.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (!touchEnabled || !['playing','hall-entry'].includes(mode)) return;
    if (!floatingJoystick.begin(event.pointerId, event.clientX, event.clientY)) return;
    if (mode === 'playing') updateAltitudeFromPointer(event.clientY);
    syncFloatingInput();
    try { joystick.setPointerCapture?.(event.pointerId); } catch { /* synthetic browser events */ }
});
joystick.addEventListener('pointermove', event => {
    if (floatingJoystick.move(event.pointerId, event.clientX, event.clientY)) {
        event.preventDefault();
        if (mode === 'playing') updateAltitudeFromPointer(event.clientY);
        syncFloatingInput();
    }
});
function releaseFloating(event) {
    const state = floatingJoystick.state();
    if (!state.active || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    touchInput.release(state.pointerId);
    floatingJoystick.end(event.pointerId);
    altitudeController.clear();
    resetFloatingVisual();
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    joystick.addEventListener(type, releaseFloating);
}
joystick.addEventListener('touchstart', event => event.preventDefault(), { passive: false });
joystick.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('blur', () => {
    const state = floatingJoystick.state();
    if (state.active) touchInput.release(state.pointerId);
    floatingJoystick.cancel();
    altitudeController.clear();
    hybridReverse.reset();
    resetFloatingVisual();
    touchInput.clear();
});
document.addEventListener?.('visibilitychange', () => {
    if (document.hidden) {
        floatingJoystick.cancel();
    altitudeController.clear();
        hybridReverse.reset();
        resetFloatingVisual();
        touchInput.clear();
    }
});

// Fullscreen targets the entire cabinet shell, so start/coin/menu and touch
// controls are retained. The canvas is object-fit:contain at original 292x240.
let fauxFullscreen = false;
function updateFullscreenButton() {
    const active = !!document.fullscreenElement || fauxFullscreen;
    fullscreenButton.textContent = active ? '⤢ EXIT FULLSCREEN' : '⛶ FULLSCREEN';
    fullscreenButton.setAttribute?.('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    document.body?.classList?.toggle?.('arcade-fullscreen', active);
}
fullscreenButton.onclick = async () => {
    // Do not allow the focused button to receive mapped Enter/FIRE presses.
    fullscreenButton.blur?.();
    if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch { }
    } else if (fauxFullscreen) {
        fauxFullscreen = false;
        arcadeShell.classList?.remove?.('is-faux-fullscreen');
    } else {
        try {
            if (typeof arcadeShell.requestFullscreen !== 'function') throw new Error('Unsupported');
            await arcadeShell.requestFullscreen({ navigationUI:'hide' });
        } catch {
            // iOS Safari and some file:// WebViews don't expose Fullscreen API.
            fauxFullscreen = true;
            arcadeShell.classList?.add?.('is-faux-fullscreen');
        }
    }
    updateFullscreenButton();
};
document.addEventListener?.('fullscreenchange', () => {
    if (document.fullscreenElement) fauxFullscreen = false;
    updateFullscreenButton();
});
updateFullscreenButton();

labStatus.textContent = 'Stage 35: Smart Bomb/bonus transition and Bomber ghost-pixel fixes. Original five-Lander opening wave, zero Baiters and Swarmers at startup; RGB DAC and star blink remain pixel-tested. ' +
    'Lander shots now use original SHOOT/GETSHL/SHSCAN, captures use ASTK1 and mutant conversion, and the scanner runs SCPROC/ISCAN/OSCAN. ' +
    'Original LFIRE/LASR/LASL/COLIDE fire lasers, REV reverses facing through PRDISP, and SBOMB has unlimited ammunition temporarily. Original PLEND colour-cycle, 128-piece BLK71 PLEX/PX1A ship shatter and three-life/game-over transition are connected. Stage 29 renders original HUD glyphs and hardware-latched colour RAM; Stage 31 routes cabinet inputs through original SSCAN/SWTAB/SWP, and runs SCNR on original SCPROC cadence; hold-fire pulses remain a documented browser convenience. Source THPROC, TIECOL and CBOMB animate thrust, Bomber colours and mine patterns. Source SBLNK star colours visibly change at the source video pixels; source normal-play invocation timing remains unverified. Browser RGB follows the original resistor weights, not linear 3:3:2 brightness. Sound DAC output is connected to the source SNDOUT PIA writes; cycle-exact 6808 interrupt state and analogue filtering remain unverified.';
for (const [button, fn] of Object.entries({
    processStep: () => processLab.STEP(),
    process120: () => processLab.RUN(120),
    process600: () => {
        processLab.RUN(240);
        processLab.RUN(240);
        processLab.RUN(120);
    },
    processReverse: () => processLab.REV(),
    processReset: () => processLab.RESET()
})) {
    document.getElementById(button).onclick = () => {
        try {
            fn();
            drawProcesses();
        }
        catch (e) {
            processDisplay.textContent = `SOURCE BOUNDARY: ${e.message}`;
        }
    };
}
for (const [id, fn] of Object.entries({ enemyStep: () => enemyLab.STEP(), enemy120: () => enemyLab.RUN(120), enemyReset: () => enemyLab.RESET() })) {
    document.getElementById(id).onclick = () => {
        try {
            fn();
            drawEnemies();
            drawEnemyLocator();
        }
        catch (e) {
            document.getElementById('enemyState').textContent = `SOURCE BOUNDARY: ${e.message}`;
        }
    };
}
for (const [id, fn] of Object.entries({ landerStep: () => landerLab.STEP(), lander60: () => landerLab.RUN(60), lander120: () => landerLab.RUN(120), landerReset: () => landerLab.RESET() })) {
    document.getElementById(id).onclick = () => {
        try {
            fn();
            drawLanders();
            drawEnemyLocator();
        }
        catch (e) {
            document.getElementById('landerState').textContent = `SOURCE BOUNDARY: ${e.message}`;
        }
    };
}
drawLanders();
drawEnemies();
drawEnemyLocator();
drawProcesses();
draw();
requestAnimationFrame(loop);


