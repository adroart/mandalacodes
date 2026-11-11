import {test,expect,type Locator,type Page} from './fixtures';
test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']}});

function wave(){const bytes=Buffer.alloc(16044);bytes.write('RIFF');bytes.writeUInt32LE(16036,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(16000,40);return bytes;}
async function open(page:Page){await page.goto('/universal-language/2');await expect(page.locator('.card-reading')).toBeVisible();await page.getByRole('button',{name:'Record a voice rewrite',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Record',exact:true})).toBeEnabled();return dialog;}
async function pipeline(page:Page){const said='These are my own words for this reading.';await page.route('**/api/oracle/authoring/ar-create',route=>{const body=route.request().postDataJSON();if(body.operation==='transcribe')return route.fulfill({json:{provider:'fixture',segments:[{text:said,startMs:0,endMs:Math.min(body.durationMs,1000),timing:'provider',sectionId:'CODE'}]}});const section=body.assimilation.sections.find((s:any)=>s.id==='2/CODE/reading');return route.fulfill({json:{assimilation:{sections:[{sectionId:section.id,text:said,evidenceQuotes:[said],changes:[],warnings:[]}],unassigned:[]}}});});}
async function toRecordings(d:Locator){await d.getByRole('button',{name:'Recording settings',exact:true}).click();await d.getByRole('button',{name:/^Recordings and transcript/}).click();await expect(d.getByRole('region',{name:'Audio and transcript'})).toBeVisible();}
async function imported(d:Locator){await toRecordings(d);await d.getByLabel('Add audio file',{exact:true}).setInputFiles({name:'synthetic.wav',mimeType:'audio/wav',buffer:wave()});await d.getByRole('button',{name:'Use this audio',exact:true}).click();await expect(d.locator('.vs-compare')).toBeVisible();}

type Finding={what:string;width:number;height:number;size?:number};
/**
 * Measures the workspace as it is on screen. Controls are measured by their hit area (a checkbox or
 * radio by the label that holds it); anything inside the review comparison (`.vs-compare`) belongs to
 * its own builder and is left out of the touch and type floors, but not out of the input floor.
 */
async function measure(page:Page){
 return page.locator('.section-voice-studio').evaluate(root=>{
  const shown=(el:Element)=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>1&&r.height>1&&s.visibility!=='hidden'&&!el.closest('[hidden]');};
  const name=(el:Element)=>`${el.tagName.toLowerCase()}${el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/).join('.'):''} "${(el.getAttribute('aria-label')??el.textContent??'').trim().slice(0,40)}"`;
  const small:Finding[]=[],tiny:Finding[]=[],zoom:Finding[]=[];
  for(const el of root.querySelectorAll('button,a[href],input,select,textarea,summary,[role=button],[role=switch]')){
   const input=el.matches('input[type=checkbox],input[type=radio]');
   const target=input?el.closest('label')??el:el;
   if(el.closest('.vs-compare')||!shown(target))continue;
   const r=target.getBoundingClientRect();
   if(r.width<44-0.5||r.height<44-0.5)small.push({what:name(el),width:Math.round(r.width),height:Math.round(r.height)});
  }
  for(const el of root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea,select,[contenteditable=true]')){
   if(!shown(el))continue;const size=parseFloat(getComputedStyle(el).fontSize);
   if(size<16)zoom.push({what:name(el),width:0,height:0,size});
  }
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;
  while((node=walker.nextNode())){
   const parent=node.parentElement;if(!parent||!node.textContent?.trim()||parent.closest('.vs-compare,.vs-visually-hidden,.ov-text-editor__label-hidden,script,style'))continue;
   if(!shown(parent))continue;const size=parseFloat(getComputedStyle(parent).fontSize);
   if(size<12)tiny.push({what:name(parent),width:0,height:0,size});
  }
  const overflow=document.documentElement.scrollWidth>innerWidth||[...root.querySelectorAll('.vs-stage')].some(el=>shown(el)&&el.scrollWidth>el.clientWidth+1);
  return {small,tiny,zoom,overflow};
 });
}
async function expectFloors(page:Page,screen:string){
 const found=await measure(page);
 expect(found.small,`${screen}: controls under 44 px`).toEqual([]);
 expect(found.tiny,`${screen}: text under 12 px`).toEqual([]);
 expect(found.zoom,`${screen}: fields under 16 px`).toEqual([]);
 expect(found.overflow,`${screen}: horizontal scroll`).toBe(false);
}

test('every screen keeps 44 px controls, 12 px type, 16 px fields and no sideways scroll',async({page},info)=>{
 await pipeline(page);const d=await open(page);
 await expectFloors(page,'manuscript');
 await d.getByRole('button',{name:'Recording settings',exact:true}).click();await expectFloors(page,'settings');
 if(info.project.name==='Phone')await page.screenshot({path:info.outputPath('settings.png')});
 await d.getByRole('button',{name:'Back',exact:true}).click();
 await imported(d);await expectFloors(page,'review');
 await d.locator('[data-action=apply]').click();await expect(d.locator('.vs-next-recording')).toBeVisible();await expectFloors(page,'applied');
 await d.getByRole('button',{name:'Back',exact:true}).click();await expect(d.locator('.vs-manuscript')).toBeVisible();
 await expect(d.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-chip').first()).toBeVisible();await expectFloors(page,'manuscript after applying');
 if(info.project.name==='Phone')await page.screenshot({path:info.outputPath('manuscript.png')});
 await toRecordings(d);await expectFloors(page,'recordings');
 if(info.project.name==='Phone')await page.screenshot({path:info.outputPath('recordings.png')});
 await d.getByRole('button',{name:'Back',exact:true}).click();await d.getByRole('button',{name:/^Sessions/}).click();await expect(d.getByRole('region',{name:'Voice setup'})).toBeVisible();await expectFloors(page,'sessions');
 if(info.project.name==='Phone'){await d.getByRole('button',{name:'Back',exact:true}).click();await d.getByRole('button',{name:'Back',exact:true}).click();await d.getByRole('button',{name:'Sections',exact:true}).click();await expectFloors(page,'sections');}
});

test('the Sections list names each state in words, matching the manuscript',async({page})=>{
 await pipeline(page);const d=await open(page);await imported(d);await d.getByRole('button',{name:'Back',exact:true}).click();
 const chip=await d.locator('.vs-section[data-section-id="2/CODE/reading"] .vs-chip').first().innerText();
 const list=page.viewportSize()!.width<900?(await d.getByRole('button',{name:'Sections',exact:true}).click(),d.getByRole('navigation',{name:'Choose a card section'})):d.getByRole('navigation',{name:'Card sections'});
 const state=list.locator('button[data-section-id="2/CODE/reading"] .vs-index-state');
 await expect(state).toBeVisible();await expect(state).toHaveText(chip);
 expect(await state.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
});

/** Shrinks the visual viewport the way the iOS keyboard does: the layout stays, only what is visible changes. */
async function keyboard(page:Page,height:number|null,offsetTop=0){
 await page.evaluate(([height,offsetTop])=>{
  const vv=window.visualViewport!;
  if(height===null){delete (vv as any).height;delete (vv as any).offsetTop;}
  else{Object.defineProperty(vv,'height',{configurable:true,get:()=>height});Object.defineProperty(vv,'offsetTop',{configurable:true,get:()=>offsetTop});}
  vv.dispatchEvent(new Event('resize'));
 },[height,offsetTop] as const);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function bands(d:Locator){
 const bar=(await d.locator('.vs-bar').boundingBox())!,dock=(await d.locator('.section-voice-studio .vs-dock').boundingBox())!;
 return {top:bar.y,barBottom:bar.y+bar.height,dockTop:dock.y,bottom:dock.y+dock.height};
}

test('with the keyboard open the bar stays on top and the dock sits directly above the keyboard',async({page},info)=>{
 await pipeline(page);const d=await open(page);await imported(d);
 const viewport=page.viewportSize()!,before=await bands(d);
 const words=d.locator('.vs-pair').first().getByRole('textbox');await words.click();
 const visible=viewport.height-336;await keyboard(page,visible);
 let at=await bands(d);expect(Math.round(at.bottom)).toBe(visible);expect(Math.round(at.top)).toBe(0);
 await expect(d.locator('[data-action=apply]')).toBeInViewport();
 // The edited words stay between the bar and the dock once the browser has brought them into view.
 await words.evaluate(el=>el.scrollIntoView({block:'nearest'}));const box=(await words.boundingBox())!;expect(box.y).toBeGreaterThanOrEqual(at.barBottom-1);expect(box.y).toBeLessThan(at.dockTop);
 if(info.project.name==='Phone')await page.screenshot({path:info.outputPath('keyboard-review.png')});
 // iOS may also pan the visible area down the page; the workspace follows it.
 await keyboard(page,visible,120);at=await bands(d);expect(Math.round(at.top)).toBe(120);expect(Math.round(at.bottom)).toBe(120+visible);
 // Closing the keyboard returns the workspace exactly where it was.
 await keyboard(page,null);at=await bands(d);expect(at).toEqual(before);
 await expect(d.locator('.section-voice-studio')).not.toHaveAttribute('data-keyboard');
 // A pinch zoom also shrinks the visible area; it is not a keyboard.
 await page.evaluate(()=>{Object.defineProperty(window.visualViewport!,'scale',{configurable:true,get:()=>2});});await keyboard(page,viewport.height/2);
 await expect(d.locator('.section-voice-studio')).not.toHaveAttribute('data-keyboard');
});

test('on the stand-alone page the keyboard also leaves the Record bar in view',async({page},info)=>{
 test.skip(info.project.name!=='Phone','The page sits between the app bars on a phone.');
 await page.goto('/authoring/1');const dock=page.locator('.section-voice-studio .vs-dock');await expect(dock.getByRole('button',{name:'Record',exact:true})).toBeVisible();
 await keyboard(page,500);const box=(await dock.boundingBox())!;expect(Math.round(box.y+box.height)).toBe(500);
 expect(Math.round((await page.locator('.section-voice-studio .vs-bar').boundingBox())!.y)).toBe(0);
 await keyboard(page,null);const tabs=(await page.locator('.oracle-app-tabs').boundingBox())!;const after=(await dock.boundingBox())!;expect(after.y+after.height).toBeLessThanOrEqual(tabs.y+1);
});

test('a screen change puts focus on the new screen title, and the manuscript keeps its place',async({page})=>{
 const d=await open(page);const stage=d.locator('.vs-manuscript');
 await stage.evaluate(el=>{el.scrollTop=700;});await expect.poll(()=>stage.evaluate(el=>el.scrollTop)).toBe(700);
 await d.getByRole('button',{name:'Recording settings',exact:true}).click();
 await expect(page.locator(':focus')).toHaveAttribute('data-screen-title','true');await expect(page.locator(':focus')).toHaveText('Recording settings');
 await d.getByRole('button',{name:/^Sessions/}).click();await expect(page.locator(':focus')).toHaveText('Sessions');
 await d.getByRole('button',{name:'Back',exact:true}).click();await d.getByRole('button',{name:'Back',exact:true}).click();
 await expect(page.locator(':focus')).toHaveAttribute('data-screen-title','true');await expect(page.locator(':focus')).toContainText('Code 2');
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 expect(await stage.evaluate(el=>el.scrollTop)).toBe(700);
 // Focus moving never scrolls the page itself.
 expect(await page.evaluate(()=>[scrollX,scrollY])).toEqual([0,0]);
});

test('recording state is announced once per change, never the clock',async({page,context,baseURL},info)=>{
 await context.grantPermissions(['microphone'],{origin:baseURL!});await pipeline(page);const d=await open(page);
 const live=d.locator('[data-recording-announcement]');await expect(live).toHaveAttribute('aria-live','polite');await expect(live).toHaveText('');
 await live.evaluate(el=>{const said:string[]=(window as any).said=[];new MutationObserver(()=>said.push(el.textContent??'')).observe(el,{childList:true,characterData:true,subtree:true});});
 await d.getByRole('button',{name:'Record',exact:true}).click();await expect(live).toHaveText('Recording');await expect(d.locator('.vs-dock')).toContainText('0:02',{timeout:10000});
 if(info.project.name==='Phone')await page.screenshot({path:info.outputPath('recording.png')});
 await d.getByRole('button',{name:'Pause',exact:true}).click();await expect(live).toHaveText('Paused');
 await d.getByRole('button',{name:'Resume',exact:true}).click();await expect(live).toHaveText('Recording');
 await d.getByRole('button',{name:'Done',exact:true}).click();await expect(live).toHaveText('Saved');
 expect(await page.evaluate(()=>(window as any).said)).toEqual(['Recording','Paused','Recording','Saved']);
});
