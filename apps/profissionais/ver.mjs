import { chromium } from 'playwright';
const DEMO = 'file:///home/user/Nuvem-Lorena/apps/profissionais/dist-demo/index.demo.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(DEMO);
await p.evaluate(()=>{ localStorage.setItem('busca-itabirito-inicio-visto','1');
  localStorage.setItem('falso-usuario','sms'); localStorage.setItem('falso-lado','trabalhador'); });
await p.goto(DEMO+'#/meu-perfil'); await p.reload(); await p.waitForTimeout(1600);
console.log(await p.evaluate(() => {
  const sw = document.querySelector('.ei-switch');
  const pai = sw.parentElement;
  const cs = getComputedStyle(pai);
  return { paiCls: pai.className, paiTag: pai.tagName, padding: cs.padding,
           regras: [...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch{return []}})
             .filter(r=>r.selectorText && /ei-switch/.test(r.selectorText) && /padding|margin/.test(r.cssText))
             .map(r=>r.cssText).slice(0,6) };
}));
await b.close();
