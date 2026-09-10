import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:1200,height:1500}, deviceScaleFactor:1 });
await p.goto('file:///home/user/Nuvem-Lorena/artes/artes.html',{waitUntil:'load'});
await p.evaluate(()=>document.fonts.ready);
await p.waitForTimeout(900);
for (const [id,nome] of [['a1','1-publique-sua-vaga'],['a2','2-em-tres-passos'],['a3','3-30-dias-gratis']]) {
  const el = await p.$('#'+id);
  const box = await el.boundingBox();
  await el.screenshot({path:`/home/user/Nuvem-Lorena/artes/ei-empresas-${nome}.png`});
  console.log(nome, Math.round(box.width)+'x'+Math.round(box.height));
}
await b.close();
