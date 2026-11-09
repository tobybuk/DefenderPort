from pathlib import Path
from playwright.sync_api import sync_playwright
html=Path('/mnt/data/defender43/play.html').read_text()
out=Path('/mnt/data/defender43/previews');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for label,w,h in [('desktop',1280,960),('mobile',390,844)]:
  page=b.new_page(viewport={'width':w,'height':h},device_scale_factor=2 if label=='mobile' else 1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(html,wait_until='domcontentloaded');page.wait_for_timeout(180)
  title=page.evaluate("""() => {running=false;frameClock.pause();attract.RESET();for(let i=0;i<1700;i++){const s=attract.STEP();if(s.step==='PRES' && s.defenderAge===20)break;}draw();return {step:attract.STATE().step,defenderAge:attract.STATE().defenderAge,phase:attract.STATE().defenderPhase};}""")
  page.locator('#flight').screenshot(path=str(out/f'Stage43_{label}_Williams.png'))
  demo=page.evaluate("""() => {attract.LEDRET();for(let i=0;i<1600;i++)attract.STEP();draw();return {step:attract.STATE().step,objectIndex:attract.STATE().objectIndex,paletteC:attract.ram.read8(PHR6_LAYOUT.at('PCRAM')+12),terrainNonzero:[...attract.video.data].filter(v=>v).length};}""")
  page.locator('#flight').screenshot(path=str(out/f'Stage43_{label}_Demo.png'))
  print(label,'title',title,'demo',demo,'errors',errors)
  page.close()
 b.close()
