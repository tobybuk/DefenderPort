"""Stage 34: verify ACTUAL standalone Chromium canvas pixels, not just source RAM."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'play.html').read_text()
OUT=Path('/mnt/data/Defender_Source_Stage34_Browser_Preview.png')

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
        args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1100,'height':1000})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.on('console',lambda e: errors.append('console: '+e.text) if e.type=='error' else None)
    page.set_content(HTML,wait_until='domcontentloaded',timeout=25000)
    page.wait_for_timeout(275)
    first=page.locator('#waveReadout').inner_text()
    assert 'LANDERS 5 active' in first and 'BAITERS 0' in first and 'SMART BOMBS ∞' in first,first
    outcome=page.evaluate('''() => {
      running=false;frameClock.pause();
      const old=Array(16).fill(null),stars=new Set(),transitions=Array(16).fill(0);
      let brightnessToggles=0; let lastCanvasScore='';
      for(let frame=0;frame<240;frame++){
        lab.STEP();draw();
        const top=lab.Layout.at('SMAP'),stride=lab.Layout.at('SLGTH');
        const phase=(lab.ram.read8(lab.Layout.at('BGL')+1)&0x40)?0:1;
        for(let i=0;i<16;i++){
          const rec=top+i*stride;
          const xb=lab.ram.read8(rec+lab.Layout.at('SX'));
          const y=lab.ram.read8(rec+lab.Layout.at('SY'));
          const x=xb*2+phase-12, canvasY=y-7;
          if(x<0||x>=292||canvasY<0||canvasY>=240)continue;
          const rgba=[...ctx.getImageData(x,canvasY,1,1).data].slice(0,3);
          const bright=Math.max(...rgba)>=150;
          const key=rgba.join(',');
          if(old[i]){
            if(old[i].key!==key){transitions[i]++;stars.add(i)}
            if(old[i].bright!==bright)brightnessToggles++;
          }
          old[i]={key,bright};
        }
      }
      draw();
      return {
        brightnessToggles, changedStars:stars.size,
        changingAtLeastTwice:transitions.filter(n=>n>=2).length,
        updatedReadout:document.getElementById('waveReadout').textContent,
        canvasWidth:canvas.width,canvasHeight:canvas.height,
        hardwareColours:[13,14,15].map(i=>lab.ram.read8(0xc000+i)),
        realRgbPalette:[13,14,15].map(i=>defenderDacRGB(lab.ram.read8(0xc000+i)))
      };
    }''')
    assert outcome['canvasWidth']==292 and outcome['canvasHeight']==240,outcome
    assert outcome['brightnessToggles']>=15,outcome
    assert outcome['changedStars']>=10,outcome
    assert outcome['changingAtLeastTwice']>=9,outcome
    assert not errors,errors
    page.locator('#flight').screenshot(path=str(OUT))
    print('PASS real Chromium Canvas: stars visible brightness changes:',outcome['brightnessToggles'],
          'independent stars:',outcome['changedStars'])
    print('PASS real Chromium Canvas: hardware latched Bomber colours',outcome['hardwareColours'],
          'RGB:',outcome['realRgbPalette'])
    bomber=page.evaluate('''() => {
      lab.RESET();
      const at=n=>lab.Layout.at(n);
      const X=lab.tie.TIEST(1)[0].object;
      lab.ram.write16(X+at('OX16'),0x1800);
      lab.ram.write8(X+at('OY16'),0x70);
      lab.ram.write16(X+at('OXV'),0);
      lab.ram.write8(at('TIECNT'),1);
      const phases=new Set(),observations={};
      for(let tick=0;tick<110;tick++){
        lab.STEP();draw();
        const addr=lab.ram.read16(X+at('OBJX'));
        if(!addr)continue;
        const pens=new Map();
        for(let dx=0;dx<4;dx++)for(let dy=0;dy<8;dy++)for(let nib=0;nib<2;nib++){
          const gx=((addr>>>8)+dx)*2+nib, gy=(addr&255)+dy;
          if(gx<12||gx>=304||gy<7||gy>=247)continue;
          const colour=getPixel(lab.video,gx,gy,{left:0,top:0});
          if(colour>=13 && colour<=15 && !pens.has(colour))pens.set(colour,{gx,gy});
        }
        if(pens.size!==3)continue;
        const hardware=[13,14,15].map(idx=>lab.ram.read8(0xc000+idx));
        const phase=[0,1,2].find(i=>TCTAB.slice(3*i,3*i+3).every((v,j)=>v===hardware[j]));
        if(phase===undefined)continue;
        for(let index=13;index<=15;index++){
          const p=pens.get(index);
          const displayed=[...ctx.getImageData(p.gx-12,p.gy-7,1,1).data].slice(0,3);
          const expected=defenderDacRGB(hardware[index-13]);
          if(displayed.join()!==expected.join())throw new Error('Actual Bomber Canvas RGB mismatch '+JSON.stringify({index,phase,displayed,expected}));
        }
        phases.add(phase);observations[phase]=hardware;
      }
      return {phases:[...phases].sort(),observations};
    }''')
    assert bomber['phases']==[0,1,2],bomber
    print('PASS actual Chromium Bomber sprite pixels: all three original palette phases',bomber['observations'])
    # UI / interaction regression: switch scanner, endless bombs, no text selection.
    page.keyboard.down('s');page.wait_for_timeout(115);page.keyboard.up('s')
    page.wait_for_timeout(120)
    readout=page.locator('#waveReadout').inner_text()
    assert 'SMART BOMBS ∞' in readout,readout
    assert not errors,errors
    page.close()
    mobile=browser.new_context(viewport={'width':420,'height':900},is_mobile=True,has_touch=True,device_scale_factor=2)
    touch=mobile.new_page(); mobile_errors=[]
    touch.on('pageerror',lambda e:mobile_errors.append(str(e)))
    touch.set_content(HTML,wait_until='domcontentloaded',timeout=25000)
    touch.wait_for_timeout(230)
    button=touch.locator('#smartBombButton')
    button.dispatch_event('pointerdown',{'pointerId':52,'pointerType':'touch','isPrimary':True})
    button.dispatch_event('pointerup',{'pointerId':52,'pointerType':'touch','isPrimary':True})
    touch.wait_for_timeout(180)
    assert 'SMART BOMBS ∞' in touch.locator('#waveReadout').inner_text()
    for event in ['contextmenu','selectstart','dragstart']:
        prevented=touch.evaluate('''event=>{const e=new Event(event,{bubbles:true,cancelable:true});
        document.getElementById('smartBombButton').dispatchEvent(e);return e.defaultPrevented}''',event)
        assert prevented,event
    assert not mobile_errors,mobile_errors
    touch.close();mobile.close();browser.close()
    print('PASS desktop/mobile controls, no console errors')
    print('CHROMIUM_PREVIEW',OUT)
