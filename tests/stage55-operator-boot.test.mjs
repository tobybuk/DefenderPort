/** Stage 55. Williams 16P-3000-103 operator functions and boot display adapter.
 * Native 6809 source gameplay routines remain separate. This test verifies
 * the real browser credit boundary and does not claim CPU-board ROM execution.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createCabinetOperator, CABINET_DEFAULTS, AUDIT_LABELS, OPERATOR_LABELS } from '../browser/cabinet-operator.js';
import { createCabinetBoot, BOOT_STAGES, BOOT_SOURCE, ram3NextWord, resetPaletteBytes } from '../browser/cabinet-boot.js';
import { DEFAULT_CONTROL_BINDINGS, logicalKeyForCode } from '../browser/control-bindings.js';
const html=readFileSync(new URL('../play.html',import.meta.url),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
function createBrowser(){
    const nodes=new Map(),events=new Map(),saved=new Map();
    const context2d={fillRect(){},fillText(){},fill(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},putImageData(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};}};
    const node=id=>{
        if(!nodes.has(id))nodes.set(id,{id,textContent:'',disabled:false,hidden:false,open:false,onclick:null,onchange:null,style:{},children:[],listeners:[],dataset:{},
            addEventListener(type,cb){this.listeners.push({type,cb});},getContext(){return context2d;},getAttribute(){return null;},setAttribute(){},focus(){},
            append(...kids){this.children.push(...kids);},replaceChildren(){this.children=[];},
            classList:{toggle(){},add(){},remove(){}},value:''});
        return nodes.get(id);
    };
    const document={body:{classList:{toggle(){},add(){},remove(){}}},getElementById:node,querySelectorAll(){return [];},
        createElement:tag=>({...node('created-'+Math.random()),tagName:tag,children:[],append(...kids){this.children.push(...kids);},setAttribute(){}}),addEventListener(){}};
    const window={localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},addEventListener:(type,cb)=>events.set(type,cb)};
    const sandbox=createContext({window,document,requestAnimationFrame(){}});
    new Script(code).runInContext(sandbox,{timeout:5000});
    const evalJS=(source)=>new Script(source).runInContext(sandbox,{timeout:12000});
    return {node,evalJS,events,sandbox};
}
test('manual Function 8–21 factory defaults, Function 1–7 audits, one coin per credit',()=>{
    assert.equal(CABINET_DEFAULTS[8],10000);
    assert.equal(CABINET_DEFAULTS[9],3);
    assert.equal(CABINET_DEFAULTS[10],3);
    assert.equal(CABINET_DEFAULTS[17],0);
    assert.equal(CABINET_DEFAULTS[20],1);
    assert.equal(Object.keys(AUDIT_LABELS).length,7);
    assert.equal(Object.keys(OPERATOR_LABELS).length,14);
    const c=createCabinetOperator();
    assert.equal(c.credits,0);
    assert.equal(c.CAN_START(),false);
    assert.equal(c.START(),false);
    assert.equal(c.COIN('left'),1);
    assert.equal(c.CAN_START(),true);
    assert.equal(c.START(),true);
    assert.equal(c.START(),false);
    assert.equal(c.credits,0);
    assert.equal(c.audit[1],1);
    assert.equal(c.audit[4],1);
});
test('operator CMOS saves credits and settings, restoring factory does not mint credits',()=>{
    const map=new Map();
    const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
    const c=createCabinetOperator(storage);
    c.ADJUST(9,5);
    c.COIN('left');
    const restored=createCabinetOperator(storage);
    assert.equal(restored.settings[9],5);
    assert.equal(restored.credits,1);
    restored.FACTORY();
    assert.equal(restored.settings[9],3);
    assert.equal(restored.credits,1);
    assert.throws(()=>restored.ADJUST(22,1),/Unsupported/);
});
test('Enter is default FIRE and start is an independent cabinet switch',()=>{
    assert.equal(DEFAULT_CONTROL_BINDINGS.fire,'Enter');
    assert.equal(logicalKeyForCode('Enter',DEFAULT_CONTROL_BINDINGS),'KeyF');
});
test('boot display has finite independent phases, not implicit free play',()=>{
    const boot=createCabinetBoot();
    assert.equal(boot.STATE().message,'RAM TEST 1 / 7');
    assert.equal(boot.STATE().visual,'rug');
    let sawResult=false,sawGameOver=false;
    for(let i=0;i<1500 && !boot.STATE().finished;i++) {
        boot.STEP();
        sawResult ||= boot.STATE().phase==='result';
        sawGameOver ||= boot.STATE().phase==='gameover';
    }
    assert.equal(boot.STATE().finished,true);
    assert.equal(sawResult,true);
    assert.equal(sawGameOver,true);
    assert.equal(boot.STATE().message,'GAME OVER');
    assert.equal(boot.STATE().ramAccessible,true);
    boot.RESET(); assert.equal(boot.STATE().finished,false);
});
test('standalone boots before attract; START needs a credit, then debits exactly once',async()=>{
    const b=createBrowser();
    assert.equal(b.evalJS('mode'),'power-off');
    assert.equal(b.node('startGameTop').disabled,true);
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('mode'),'power-off');
    await b.node('powerOnCabinet').onclick();
    assert.equal(b.evalJS('mode'),'boot');
    b.evalJS('for(let i=0;i<1500 && mode==="boot";i++)step();draw();');
    assert.equal(b.evalJS('mode'),'attract');
    assert.equal(b.node('creditReadout').textContent,'CREDITS 0');
    // Stage 80: as on the cabinet, START does nothing without a credit.
    assert.equal(b.node('startGameTop').disabled,true);
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('mode'),'attract');
    assert.equal(b.evalJS('cabinet.audit[4]'),0,'no game started');
    b.node('coinInsert').onclick();
    assert.equal(b.node('creditReadout').textContent,'CREDITS 1');
    assert.equal(b.node('startGameTop').disabled,false);
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('mode'),'playing');
    assert.equal(b.node('creditReadout').textContent,'CREDITS 0');
    assert.equal(b.evalJS('lab.STATE().smartBombs'),3);
    assert.equal(b.evalJS('lab.STATE().infiniteSmartBombs'),false);
    assert.equal(b.evalJS('cabinet.audit[4]'),1);
    assert.equal(b.evalJS('cabinet.START(1)'),false);
});
test('power cycling retains credits but requires a fresh self-test before next start',async()=>{
    const b=createBrowser();
    await b.node('powerOnCabinet').onclick();
    b.evalJS('for(let i=0;i<1500 && mode==="boot";i++)step();');
    b.node('coinInsert').onclick();
    b.node('rebootCabinet').onclick();
    assert.equal(b.evalJS('mode'),'boot');
    assert.equal(b.evalJS('cabinet.credits'),1);
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('mode'),'boot');
    b.evalJS('for(let i=0;i<1500 && mode==="boot";i++)step();');
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('mode'),'playing');
    assert.equal(b.evalJS('cabinet.credits'),0);
});
test('menu service diagnostics advances through documented tests without declaring physical ROM pass',()=>{
    const b=createBrowser();
    b.node('serviceTests').onclick();
    assert.equal(b.evalJS('mode'),'service');
    assert.equal(b.node('startGameTop').disabled,true);
    assert.equal(b.evalJS('SERVICE_TESTS[serviceTestIndex][0]'),'ROM DIAGNOSTICS - TEST 1');
    b.node('nextServiceTest').onclick();
    assert.equal(b.evalJS('SERVICE_TESTS[serviceTestIndex][0]'),'RAM DIAGNOSTICS - TEST 2');
    b.node('exitServiceTests').onclick();
    assert.equal(b.evalJS('mode'),'attract');
    assert.equal(b.node('nextServiceTest').hidden,true);
});
test('operator ships and bonus level apply at subsequent real one-player START',async()=>{
    const b=createBrowser();
    await b.node('powerOnCabinet').onclick();
    b.evalJS(`for(let n=0;n<1500 && mode==="boot";n++)step(); cabinet.ADJUST(9,5);cabinet.ADJUST(8,20000);`);
    b.node('coinInsert').onclick();
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('mode'),'playing');
    assert.equal(b.evalJS('lab.STATE().shipsInReserve'),4);
    assert.equal(b.evalJS('lab.ram.read16(lab.Layout.at("REPLA"))'),0x0200);
    // Paid credit may be inserted during gameplay, but START is disabled
    // and must not reset an active paid game.
    b.node('coinInsert').onclick();
    assert.equal(b.node('startGameTop').disabled,true);
    b.node('startGameTop').onclick();
    assert.equal(b.evalJS('cabinet.credits'),1);
    assert.equal(b.evalJS('mode'),'playing');
});

test('ROMF8.RESET1 palette uses original high-byte multiplication, not a guessed colour table', () => {
    const values = resetPaletteBytes();
    assert.equal(values.length,16);
    assert.equal(values[0],0xc0);
    assert.equal(values[1],(0xc0*0xb5)>>>8);
    for(let n=1;n<16;n++) assert.equal(values[n],(values[n-1]*0xb5)>>>8);
});
test('ROMF8.RAM3 6809 COMB/RORA/RORB transitions have deterministic original starting sequence', () => {
    let d=0;
    const values=[];
    for(let i=0;i<8;i++){d=ram3NextWord(d);values.push(d);}
    assert.deepEqual(values, [0x8000,0xc000,0xe000,0xf000,0xf800,0xfc00,0xfe00,0xff00]);
});
test('ROMC0.RORAOK writes its source positions and green palette, then GAMEOV does source reset', () => {
    const boot=createCabinetBoot();
    boot.RORAOK();
    assert.equal(boot.STATE().phase,'result');
    assert.equal(boot.ram.read8(0xc001),0x7a);
    assert.ok(boot.video.read8(0x2870) !== 0 || boot.video.read8(0x2871)!==0);
    boot.GAMEOV();
    assert.equal(boot.STATE().phase,'gameover');
    assert.equal(boot.ram.read8(0xc001),0xa5);
    assert.equal(BOOT_SOURCE.resultAddress,0x4090);
});
