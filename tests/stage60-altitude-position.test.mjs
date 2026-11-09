import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    targetAltitudeFromTouch, altitudeSourceSwitches, createAltitudeController,
    createFloatingJoystick, hybridJoystickKeys, createTouchInputState
} from '../browser/touch-controls.js';

const source = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

/** Identical integer 8.8-velocity steps to DEFA7.PLAYER (not a substitute runtime). */
function originalPlayerVerticalTick(play16, vy, {up,down}) {
    if (up) vy = vy < 0 ? Math.max(-512,vy - 8) : -256;
    else if (down) vy = vy > 0 ? Math.min(512,vy + 8) : 256;
    else vy = 0; // DEFA7.PYV1 clears velocity on switch release
    return { play16: (play16 + vy) & 65535, vy };
}
function settle(controller, start, ticks = 200) {
    let state = {play16: Math.round(start * 256), vy: 0};
    const trace=[];
    for (let i=0;i<ticks;i++) {
        const switches = controller.sample(state.play16,state.vy);
        state = originalPlayerVerticalTick(state.play16,state.vy,switches);
        trace.push({ y: state.play16/256, vy:state.vy, ...switches });
    }
    return { state, trace };
}

test('full-pad thumb height is absolute source altitude YMIN+1..238, including bounds', () => {
    assert.equal(targetAltitudeFromTouch(100,100,200),43);
    assert.equal(targetAltitudeFromTouch(300,100,200),238);
    assert.equal(targetAltitudeFromTouch(200,100,200),140.5);
    assert.equal(targetAltitudeFromTouch(-100,100,200),43);
    assert.equal(targetAltitudeFromTouch(900,100,200),238);
    assert.equal(targetAltitudeFromTouch(100,100,0),null);
    assert.equal(targetAltitudeFromTouch(Infinity,100,200),null);
});

test('touch-down immediately specifies desired altitude; horizontal thumb motion does not change Y target', () => {
    const pad=createAltitudeController();
    const stick=createFloatingJoystick();
    stick.begin(12,80,250);
    pad.touch(stick.state().clientY,100,300);
    const first=pad.state().targetY;
    assert.ok(first>43&&first<238);
    stick.move(12,150,250);
    pad.touch(stick.state().clientY,100,300);
    assert.equal(pad.state().targetY,first);
    assert.equal(stick.state().horizontal,1);
    stick.move(12,150,120);
    pad.touch(stick.state().clientY,100,300);
    assert.ok(pad.state().targetY<first);
    stick.end(12);pad.clear();
    assert.equal(pad.sample(0x8500,0).up,false);
});

test('after reaching altitude ship remains stationary while thumb stays held', () => {
    const pad=createAltitudeController();
    pad.touch((180-43)/195*100,0,100);
    const {state,trace}=settle(pad,133,150);
    assert.ok(Math.abs(state.play16/256-180)<=0.51, `stopped at ${state.play16/256}`);
    assert.equal(state.vy,0,'source PLAYER released Up/Down and cleared PLAYV');
    for (const t of trace.slice(-25)) {
        assert.equal(t.vy,0);
        assert.equal(t.up,false);
        assert.equal(t.down,false);
        assert.ok(Math.abs(t.y-180)<=0.51);
    }
});

test('source-speed approach toward near target brakes instead of overshooting at 2px/tick', () => {
    // +2px/tick would worsen a one-pixel target error; original release first
    // resets PLAYV, then a new press moves exactly 1 pixel.
    assert.deepEqual(altitudeSourceSwitches(101,100*256,512),{up:false,down:false});
    assert.deepEqual(altitudeSourceSwitches(101,100*256,0),{up:false,down:true});
    assert.deepEqual(altitudeSourceSwitches(99,100*256,-512),{up:false,down:false});
    assert.deepEqual(altitudeSourceSwitches(99,100*256,0),{up:true,down:false});
    assert.deepEqual(altitudeSourceSwitches(100,100*256,0),{up:false,down:false});
});

test('thumb can change target while held; ship reverses altitude and settles at new position', () => {
    const pad=createAltitudeController();
    pad.touch((215-43)/195*100,0,100);
    const first=settle(pad,100,100);
    assert.ok(Math.abs(first.state.play16/256-215)<=.51);
    pad.touch((55-43)/195*100,0,100);
    let state=first.state;
    const samples=[];
    for(let i=0;i<180;i++) {
        const k=pad.sample(state.play16,state.vy);
        state=originalPlayerVerticalTick(state.play16,state.vy,k);
        samples.push({y:state.play16/256,...k,vy:state.vy});
    }
    assert.equal(samples[0].up,true);
    assert.ok(Math.abs(state.play16/256-55)<=.51, `new target missed: ${state.play16/256}`);
    assert.equal(state.vy,0);
    assert.ok(samples.slice(-15).every(t=>!t.up&&!t.down));
});

test('altitude input is independent of left-thumb auto-thrust and right-hand fingers', () => {
    const pad=createAltitudeController();
    const joystick=createFloatingJoystick();
    const touch=createTouchInputState();
    joystick.begin(1,50,180);
    pad.touch(180,100,200);
    joystick.move(1,95,180); // RIGHT, same altitude
    touch.setMany(1,hybridJoystickKeys(joystick.state(),{altitudeMode:true}));
    touch.set(2,'KeyF');touch.set(3,'KeyS');
    assert.equal(touch.held('Space'),true);
    assert.equal(touch.held('KeyF'),true);
    assert.equal(touch.held('ArrowUp'),false,'auto-altitude uses source state, not immediate thumb key');
    assert.equal(pad.sample(100*256,0).down,true);
    touch.release(3);
    assert.equal(touch.consume('KeyS'),true);
    touch.release(2);
    assert.equal(touch.held('Space'),true);
    joystick.end(1);pad.clear();touch.release(1);
    assert.equal(touch.activeCount(),0);
});

test('Hall of Fame retains its relative thumb up/down logic', () => {
    assert.deepEqual(hybridJoystickKeys({vertical:-1,horizontal:1},{hallEntry:true}),['ArrowUp']);
    assert.deepEqual(hybridJoystickKeys({vertical:1,horizontal:-1},{hallEntry:true}),['ArrowDown']);
    assert.deepEqual(hybridJoystickKeys({vertical:-1,horizontal:1},{altitudeMode:true}),['Space']);
});

test('browser input adapter uses PLAY16/PLAYV and does not alter source PLAYER code',()=>{
    const flight=source('browser/flight.js');
    assert.match(flight,/altitudeController\.sample\(originalDirection\.play16, originalDirection\.vy\)/);
    assert.match(flight,/updateAltitudeFromPointer\(event\.clientY\)/);
    assert.match(flight,/lab\.INPUT\(/);
    assert.match(flight,/drawAltitudeVisual\(state\)/);
    assert.ok(source('original/defa7-player.js').includes("W16('PLAYV', vy)"));
});
