"""Chromium smoke/integration test for standalone Stage 30, including mobile pointer controls."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import re
html=(Path(__file__).resolve().parents[1]/'play.html').read_text()
checks=[]
def laser_count(text):
 m=re.search(r'LASERS\s+(\d+)',text)
 return int(m.group(1)) if m else -1
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
 page=browser.new_page(viewport={'width':1100,'height':1000})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('console',lambda e: errors.append(e.text) if e.type=='error' else None)
 page.set_content(html,wait_until='domcontentloaded',timeout=15000)
 page.wait_for_timeout(400)
 initial=page.locator('#waveReadout').inner_text()
 assert 'LANDERS 5 active' in initial and 'BAITERS 0' in initial and 'SMART BOMBS ∞' in initial, initial
 checks.append('desktop: correct source first wave and unlimited bombs')
 page.keyboard.down('h')
 page.wait_for_timeout(110)
 assert 'HYPERSPACE IN PROGRESS' in page.locator('#waveReadout').inner_text()
 page.keyboard.up('h')
 page.wait_for_timeout(1350)
 s=page.locator('#waveReadout').inner_text()
 assert 'HYPERSPACE 1' in s, s
 checks.append('desktop: hyperspace process and 15+40 tick continuations complete')
 before=laser_count(s)
 page.keyboard.down('f');page.wait_for_timeout(650);page.keyboard.up('f')
 page.wait_for_timeout(100)
 after=laser_count(page.locator('#waveReadout').inner_text())
 assert after>=before+2, (before,after)
 checks.append(f'desktop: holding F issued {after-before} original laser calls')
 page.locator('#flight').screenshot(path=str(Path(__file__).resolve().parents[1]/'Stage30_Browser_Preview.png'))
 assert not errors, errors
 page.close()
 mobile=browser.new_context(viewport={'width':420,'height':900},is_mobile=True,has_touch=True,device_scale_factor=2)
 p=mobile.new_page();me=[]
 p.on('pageerror',lambda e:me.append(str(e)))
 p.set_content(html,wait_until='domcontentloaded',timeout=15000)
 p.wait_for_timeout(250)
 initial_laser=laser_count(p.locator('#waveReadout').inner_text())
 p.locator('#laserSound').dispatch_event('pointerdown',{'pointerId':23,'pointerType':'touch','isPrimary':True})
 p.wait_for_timeout(600)
 p.locator('#laserSound').dispatch_event('pointerup',{'pointerId':23,'pointerType':'touch','isPrimary':True})
 later_laser=laser_count(p.locator('#waveReadout').inner_text())
 assert later_laser>=initial_laser+2,(initial_laser,later_laser)
 checks.append(f'mobile: hold FIRE caused {later_laser-initial_laser} source laser calls')
 p.locator('#hyperspaceButton').dispatch_event('pointerdown',{'pointerId':24,'pointerType':'touch','isPrimary':True})
 p.locator('#hyperspaceButton').dispatch_event('pointerup',{'pointerId':24,'pointerType':'touch','isPrimary':True})
 p.wait_for_timeout(120)
 assert 'HYPERSPACE IN PROGRESS' in p.locator('#waveReadout').inner_text(),p.locator('#waveReadout').inner_text()
 checks.append('mobile: one-shot hyperspace pointer control works')
 result=p.evaluate('''() => {
  const el=document.getElementById('hyperspaceButton');
  const events=['contextmenu','selectstart','dragstart'];
  return events.map(type=>{const e=new Event(type,{bubbles:true,cancelable:true});el.dispatchEvent(e);return e.defaultPrevented;});
 }''')
 assert result==[True,True,True], result
 checks.append('mobile: long press context menu/selection/drag browser events prevented')
 assert not me,me
 p.close();mobile.close();browser.close()
for c in checks:print('PASS',c)
print('BROWSER_CHECKS',len(checks))
