#!/usr/bin/env python3
"""Optional real Chromium smoke check for Stage 37.

Run after `npm run build`. Requires `pip install playwright` and a Chromium
installation (or PLAYWRIGHT_CHROMIUM_EXECUTABLE pointing at one).
No emulator, no invented sprites; evaluates the already-built single HTML.
"""
from pathlib import Path
from os import environ
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent.parent
html=(root/'play.html').read_text(encoding='utf-8')
exe=environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE') or '/usr/bin/chromium'
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox','--disable-dev-shm-usage'])
    for width,mobile in [(1100,False),(390,True)]:
        page=browser.new_page(viewport={'width':width,'height':900 if not mobile else 844},is_mobile=mobile,has_touch=mobile)
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(html,wait_until='domcontentloaded',timeout=35000)
        page.evaluate('running=false')
        assert page.evaluate('mode')=='attract'
        assert page.evaluate("document.body.classList.contains('attract-mode')")
        assert page.locator('#humanReadout').is_hidden()
        page.evaluate('for(let i=0;i<200;i++)attract.STEP();draw()')
        assert page.evaluate('attract.STATE().logoRate')==3
        page.evaluate('''attract.RESET();for(let i=0;i<1900;i++){
          const s=attract.STEP();if(s.step==='AMODE2'&&s.laser?.frames===1)break;
        }for(let i=0;i<7;i++)attract.STEP();draw()''')
        tip=page.evaluate('''() => {
          const address=attract.STATE().laser.head;
          const x=(address>>>8)*2-12,y=(address&255)-7;
          const index=attract.video.read8(address)&15;
          const rgb=Array.from(document.getElementById('flight').getContext('2d').getImageData(x,y,1,1).data).slice(0,3);
          return {index,rgb,expected:defenderHardwarePalette(attract.ram)[index]};
        }''')
        assert tip['index']==9 and tip['rgb']==tip['expected'],tip
        page.evaluate('''for(let i=0;i<1800;i++){
          const s=attract.STEP();if(s.step==='AMOD13')break;
        }draw()''')
        assert page.evaluate('attract.STATE().objectIndex')==6
        page.locator('#startGameTop').click()
        assert page.evaluate('mode')=='playing'
        assert page.evaluate('lab.WAVE_STATE().landerCount')==5
        assert page.evaluate('lab.WAVE_STATE().ufoCount')==0
        page.evaluate('for(let i=0;i<80;i++)step();draw()')
        assert not errors,errors
        page.close()
    browser.close()
print('PASS: Stage 37 Chromium desktop/mobile, original laser RGB and game transition')
