const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const cards = require('./cards.js');
const COMPACT = process.env.VARIANT === 'compact';
const MAX = COMPACT ? 9 : 11, MIN = 5;
const SW = COMPACT ? 297 : 210, SH = COMPACT ? 210 : 297;      // sheet mm
const COLS = COMPACT ? 4 : 2, ROWS = 2;
const CW = SW / COLS, CH = SH / ROWS;                            // card mm
const PAD = COMPACT ? '4.2mm 4mm' : '5mm 6mm';
const HEADF = COMPACT ? 6.4 : 8.4, SIDEF = COMPACT ? 5 : 6.2, NOF = COMPACT ? 5.6 : 7.5, NOS = COMPACT ? 3.6 : 4.6;
const OUT = COMPACT ? 'writing-cards-A7' : 'writing-cards';

const css = `
@page{size:${SW}mm ${SH}mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:"Liberation Sans",Arial,sans-serif;color:#111}
.sheet{width:${SW}mm;height:${SH}mm;display:grid;grid-template-columns:repeat(${COLS},${CW}mm);grid-template-rows:repeat(${ROWS},${CH}mm);page-break-after:always;break-after:page;overflow:hidden}
.cell{width:${CW}mm;height:${CH}mm;border:.25mm dashed #aaa;padding:${PAD};position:relative;display:flex;flex-direction:column;overflow:hidden}
.head{background:#1f3a5f;color:#fff;border-radius:1.2mm;padding:${COMPACT?1:1.4}mm 1.8mm;font-weight:700;font-size:${HEADF}pt;line-height:1.2;display:flex;gap:2mm;align-items:center;flex:none}
.head .no{background:#fff;color:#1f3a5f;border-radius:50%;min-width:${NOS}mm;height:${NOS}mm;display:flex;align-items:center;justify-content:center;font-size:${NOF}pt}
.head .side{margin-left:auto;font-weight:400;font-size:${SIDEF}pt;opacity:.85;white-space:nowrap}
.body{flex:1;min-height:0;overflow:hidden;margin-top:1.6mm;line-height:${COMPACT?1.17:1.22}}
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
const per = COLS*ROWS, nSheets = Math.ceil(cards.length/per);
const mirror = (g)=>{ const o=[]; for(let r=0;r<ROWS;r++){ o.push(...g.slice(r*COLS,(r+1)*COLS).reverse()); } return o; };
for (let k=0;k<nSheets;k++){
  const g = cards.slice(k*per, k*per+per);
  const idx = [...Array(per).keys()];
  html += `<div class="sheet">${idx.map(i=>g[i]?cell(g[i],'front'):'<div class="cell"></div>').join('')}</div>`;
  // orqa tomon: har qatorda ustunlar oyna kabi almashadi (aylantirilganda old tomonning orqasiga tushadi)
  html += `<div class="sheet">${mirror(idx).map(i=>g[i]?cell(g[i],'back'):'<div class="cell"></div>').join('')}</div>`;
}
html += `</body></html>`;
fs.writeFileSync(OUT+'.html', html);

(async()=>{
  const br = await chromium.launch(); const pg = await br.newPage();
  await pg.goto('file://'+path.resolve(OUT+'.html'));
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
  await pg.pdf({path:OUT+'.pdf',width:SW+'mm',height:SH+'mm',printBackground:true,preferCSSPageSize:true});
  await br.close();
})();
