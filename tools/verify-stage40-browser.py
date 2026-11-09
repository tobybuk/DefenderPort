#!/usr/bin/env python3
"""Chromium smoke checks plus screenshot of original-source Stage40 title and blasts."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageOps,ImageDraw,ImageFont
root=Path(__file__).resolve().parent.parent
html=(root/'play.html').read_text()
with sync_playwright() as playwright:
 browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=35000)
 page.evaluate('running=false')
 page.evaluate("for(let n=0;n<500;n++){if(attract.STATE().page==='presentation' && attract.STATE().presTicks===200)break; attract.STEP();}draw()")
 s=page.evaluate('attract.STATE()')
 assert s['page']=='presentation' and s['presTicks']==200,s
 p1=Path('/mnt/data/defender40/stage40_browser_title.png');page.locator('#flight').screenshot(path=str(p1))
 page.evaluate("for(let n=0;n<1700;n++){const s=attract.STEP();if(s.page==='instructions'&&s.step==='AMODE4'&&s.remaining===0x5a){for(let j=0;j<8;j++)attract.STEP();break}}draw()")
 s=page.evaluate('attract.STATE()');assert s['step']=='AMODE4',s
 p2=Path('/mnt/data/defender40/stage40_browser_lander_explosion_8.png');page.locator('#flight').screenshot(path=str(p2))
 page.locator('#startGameTop').click()
 assert page.evaluate('mode')=='playing'
 page.evaluate('for(let n=0;n<20;n++)step();draw()')
 assert not errors,errors
 page.close();browser.close()
# Produce readable 2x pixel nearest-neighbour preview; source pixels unchanged.
a=Image.open(p1).convert('RGB');b=Image.open(p2).convert('RGB')
scale=2;a=a.resize((a.width*scale,a.height*scale),Image.Resampling.NEAREST);b=b.resize((b.width*scale,b.height*scale),Image.Resampling.NEAREST)
result=Image.new('RGB',(max(a.width,b.width),a.height+b.height+80),'#101621')
d=ImageDraw.Draw(result)
d.text((14,9),'SOURCE TITLE — restored lettering',fill='white')
result.paste(a,(0,36));d.text((14,a.height+48),'LANDER DEMO — source EXST/EXPU explosion',fill='white')
result.paste(b,(0,a.height+80))
result.save('/mnt/data/Defender_Source_Stage40_Preview.png')
print('PASS: mobile Chromium title at pres tick 200 and rendered Lander explosion; no JS errors')
