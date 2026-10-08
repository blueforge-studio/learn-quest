import { chromium } from '@playwright/test';
const base='http://localhost:3010';
const seed={ 'lq-terms-accepted':'2026-08-27','onboarding-completed':'true',userId:'audit-player',
 nordic_target_language:JSON.stringify({state:{targetLanguage:'danish',hasExplicitlySelected:true},version:0}),
 nordic_last_visited:JSON.stringify({locale:'en',sectionId:'danish',bookId:'chapters',chapterId:'chapter-1'})};
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:430,height:900}});
await ctx.addInitScript((s)=>{for(const [k,v] of Object.entries(s)) if(localStorage.getItem(k)===null) localStorage.setItem(k,v)},seed);
const p=await ctx.newPage();
await p.goto(base+'/en/danish/chapters/chapter-1',{waitUntil:'domcontentloaded'});
await p.waitForSelector('[data-testid^="lesson-card-"]',{timeout:60000}).catch(()=>{});
const cards=await p.$$eval('[data-testid^="lesson-card-"]',e=>e.map(x=>x.dataset.testid.slice(12)));
console.log('cards',cards.length,cards.slice(0,40).join(' '));
const out={};
for(const id of cards.slice(0,14)){
  await p.goto(`${base}/en/danish/chapters/chapter-1/${id}`,{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2500);
  out[id]={nav:await p.locator('[data-testid="lesson-navigation"]').count(), anchors:await p.locator('[data-appdom-id^="lesson-"],[data-appdom-id^="answer-"]').count(), total:await p.locator('[data-appdom-id]').count()};
}
console.table(out); await b.close();
