"""Actual Chromium checks for source BONUS timing and mobile input, Stage 32."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'play.html').read_text()
OUT=Path('/mnt/data/Defender_Source_Stage32_Bonus_Browser_Preview.png')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
        args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    desktop=browser.new_page(viewport={'width':1100,'height':1050})
    errors=[]
    desktop.on('pageerror',lambda e: errors.append(str(e)))
    desktop.on('console',lambda e: errors.append(e.text) if e.type=='error' else None)
    desktop.set_content(HTML,wait_until='domcontentloaded',timeout=15000)
    desktop.wait_for_timeout(230)
    initial=desktop.locator('#waveReadout').inner_text()
    assert 'LANDERS 5 active' in initial and 'BAITERS 0' in initial and 'SMART BOMBS ∞' in initial,initial
    snapshot=desktop.evaluate('''() => {
       running=false; frameClock.pause();
       for(const n of ['LNDCNT','LNDRES','TIECNT','PRBCNT','SWCNT','SCZCNT','SCZRES'])lab.ram.write8(lab.Layout.at(n),0);
       for(let n=0;n<100 && lab.STATE().bonus===null;n++)lab.STEP();
       draw();
       const s=lab.STATE();
       return {bonus:s.bonus,score:s.scoreBCD,firstBitmap:lab.video.read8(0x3850),firstHuman:lab.video.read8(0x3ca0),readout:document.getElementById('waveReadout').textContent};
    }''')
    assert snapshot['bonus']['wave']==1,snapshot
    assert snapshot['bonus']['survivors']==10,snapshot
    assert snapshot['bonus']['awards']==1,snapshot
    assert snapshot['firstBitmap']!=0 and snapshot['firstHuman']!=0,snapshot
    assert 'ATTACK WAVE 1 COMPLETED' in snapshot['readout'],snapshot
    desktop.locator('#flight').screenshot(path=str(OUT))
    # Three source ticks before BC1 must not credit the next astronaut.
    timing=desktop.evaluate('''() => {
        for(let i=0;i<3;i++)lab.STEP(); const before=lab.STATE().bonus.awards;
        lab.STEP(); const after=lab.STATE().bonus.awards;draw();
        return {before,after,secondHuman:lab.video.read8(0x40a0)};
    }''')
    assert timing=={'before':1,'after':2,'secondHuman':3},timing
    finished=desktop.evaluate('''() => {
       for(let i=0;i<300 && lab.STATE().bonus!==null;i++)lab.STEP();
       draw(); const s=lab.STATE();return {wave:s.wave.wave,bonus:s.bonus,score:s.scoreBCD,readout:document.getElementById('waveReadout').textContent};
    }''')
    assert finished['wave']==2 and finished['bonus'] is None,finished
    assert finished['score'][-2:]==[0x10,0x00],finished
    assert 'WAVE 2' in finished['readout'] and 'SMART BOMBS ∞' in finished['readout'],finished
    assert not errors,errors
    print('PASS desktop first wave, bonus messages/astronaut art, award cadence, transition, HUD score; no console errors')
    desktop.close()
    mobile=browser.new_context(viewport={'width':420,'height':900},is_mobile=True,has_touch=True,device_scale_factor=2)
    page=mobile.new_page()
    me=[];page.on('pageerror',lambda e:me.append(str(e)))
    page.set_content(HTML,wait_until='domcontentloaded',timeout=15000)
    page.wait_for_timeout(230)
    btn=page.locator('#smartBombButton')
    btn.dispatch_event('pointerdown',{'pointerId':33,'pointerType':'touch','isPrimary':True})
    btn.dispatch_event('pointerup',{'pointerId':33,'pointerType':'touch','isPrimary':True})
    page.wait_for_timeout(170)
    assert 'SMART BOMBS ∞' in page.locator('#waveReadout').inner_text()
    for kind in ['contextmenu','selectstart','dragstart']:
        assert page.evaluate('''kind=>{const e=new Event(kind,{bubbles:true,cancelable:true});document.getElementById('smartBombButton').dispatchEvent(e);return e.defaultPrevented}''',kind),kind
    assert not me,me
    page.close();mobile.close();browser.close()
    print('PASS mobile unlimited bomb tap and long-press selection prevention; no console errors')
print('PREVIEW',OUT)
