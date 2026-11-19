const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const cards = require('./cards.js');
const MAX = 11, MIN = 6;

const css = `
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:"Liberation Sans",Arial,sans-serif;color:#111}
.sheet{width:210mm;height:297mm;display:grid;grid-template-columns:105mm 105mm;grid-template-rows:148.5mm 148.5mm;page-break-after:always;break-after:page;overflow:hidden}
.cell{width:105mm;height:148.5mm;border:.25mm dashed #aaa;padding:5mm 6mm 5mm 6mm;position:relative;display:flex;flex-direction:column;overflow:hidden}
.head{background:#1f3a5f;color:#fff;border-radius:1.2mm;padding:1.4mm 2.2mm;font-weight:700;font-size:8.4pt;line-height:1.2;display:flex;gap:2mm;align-items:center;flex:none}
.head .no{background:#fff;color:#1f3a5f;border-radius:50%;min-width:4.6mm;height:4.6mm;display:flex;align-items:center;justify-content:center;font-size:7.5pt}
.head .side{margin-left:auto;font-weight:400;font-size:6.2pt;opacity:.85;white-space:nowrap}
.body{flex:1;min-height:0;overflow:hidden;margin-top:1.6mm;line-height:1.22}
.body p{margin:.7mm 0}
.body h3{font-size:1.06em;color:#1f3a5f;border-bottom:.2mm solid #c9d3e0;margin:1.6mm 0 .6mm;padding-bottom:.2mm}
.body h3:first-child{margin-top:0}
.body ul,.body ol{margin:.3mm 0 .6mm 3.6mm}
.body li{margin:.1mm 0}
.body ul.cols{columns:2;column-gap:3mm;margin-left:3.6mm}
.body ul.cols li{break-inside:avoid}
.body .box{background:#eef3f9;border:.2mm solid #c9d3e0;padding:.9mm 1.4mm;border-radius:1mm;font-weight:700}
.body .ex{background:#f6f6f2;border-left:.8mm solid #1f3a5f;padding:.9mm 1.6mm;margin:.8mm 0}
.body table{border-collapse:collapse;width:100%;margin:.8mm 0}
.body td,.body th{border:.2mm solid #b8c3d2;padding:.4mm 1.2mm;text-align:left}
.body th{background:#e5ecf5}
`;
function cell(c, side){
  const b = side==='front' ? c.front : c.back;
  return `<div class="cell"><div class="head"><span class="no">${c.n}</span><span>${c.title}</span><span class="side">${side==='front'?'1/2':'2/2'}</span></div><div class="body" data-card="${c.n}" style="font-size:${MAX}pt"><div class="inner">${b}</div></div></div>`;
}
let html = `<!doctype html><html><head><meta charset="utf-8"><title>Writing Cards</title><style>${css}</style></head><body>`;
for (let s=0;s<2;s++){
  const g = cards.slice(s*4, s*4+4);
  html += `<div class="sheet">${[0,1,2,3].map(i=>cell(g[i],'front')).join('')}</div>`;
  // back side: columns mirrored for long-edge duplex flip
  html += `<div class="sheet">${[1,0,3,2].map(i=>cell(g[i],'back')).join('')}</div>`;
}
html += `</body></html>`;
fs.writeFileSync('writing-cards.html', html);

(async()=>{
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.goto('file://'+path.resolve('writing-cards.html'));
  const res = await pg.evaluate(([MAX,MIN])=>{
    const bodies=[...document.querySelectorAll('.body')];
    const over=(b)=>b.querySelector('.inner').offsetHeight>b.clientHeight-1;
    const fit={};
    // one font size per card (front and back share it), largest that fits both faces
    for(const n of new Set(bodies.map(b=>b.dataset.card))){
      const g=bodies.filter(b=>b.dataset.card===n);
      let fs=MAX;
      const set=()=>g.forEach(b=>b.style.fontSize=fs+'pt');
      set();
      while(g.some(over)&&fs>MIN){fs=Math.round((fs-0.1)*10)/10;set();}
      fit[n]={fs,over:g.some(over),fill:g.map(b=>Math.round(100*b.querySelector('.inner').offsetHeight/b.clientHeight))};
    }
    return fit;
  },[MAX,MIN]);
  console.log(JSON.stringify(res));
  await pg.pdf({path:'writing-cards.pdf',format:'A4',printBackground:true,preferCSSPageSize:true});
  await br.close();
})();
