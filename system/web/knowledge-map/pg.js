/* Scene Graph Knowledge Map — TOC renderer + playground engine.
   One evaluation core, many small control surfaces. */

/* ───────────────── language ───────────────── */
(function(){
  var en=document.getElementById('lang-en'), zh=document.getElementById('lang-zh');
  function set(l){
    document.documentElement.setAttribute('data-lang',l);
    en.setAttribute('aria-pressed',l==='en'); zh.setAttribute('aria-pressed',l==='zh');
    try{localStorage.setItem('sgkm-lang',l)}catch(e){}
  }
  en.onclick=function(){set('en')}; zh.onclick=function(){set('zh')};
  var v='en'; try{v=localStorage.getItem('sgkm-lang')||'en'}catch(e){}
  set(v);
})();

/* ───────────────── shared scene ───────────────── */
var OBJ={
  table:{x:90,y:214,w:436,h:112,label:'table'}, person:{x:172,y:62,w:108,h:224,label:'person'},
  arm:{x:336,y:48,w:124,h:172,label:'robot arm'}, conveyor:{x:492,y:180,w:172,h:96,label:'conveyor'},
  box:{x:252,y:172,w:84,h:62,label:'box'}, wrench:{x:140,y:196,w:62,h:20,label:'wrench'},
  laptop:{x:382,y:168,w:88,h:50,label:'laptop'}, glove:{x:196,y:168,w:40,h:32,label:'glove'}
};
var GT=[
  {s:'box',p:'on',o:'table'},{s:'wrench',p:'on',o:'table'},{s:'laptop',p:'on',o:'table'},
  {s:'person',p:'in front of',o:'table'},{s:'arm',p:'attached to',o:'table'},
  {s:'arm',p:'above',o:'table'},{s:'person',p:'picking up',o:'box'},
  {s:'conveyor',p:'near',o:'table'},{s:'person',p:'wearing',o:'glove'},{s:'box',p:'near',o:'conveyor'}
];
/* rank 1 = the pair's top predicate; rank 2 = its runner-up */
var PRED=[
  {s:'box',p:'on',o:'table',score:.96,iou:.91,rank:1},
  {s:'laptop',p:'on',o:'table',score:.91,iou:.88,rank:1},
  {s:'wrench',p:'on',o:'table',score:.87,iou:.41,rank:1},
  {s:'person',p:'in front of',o:'table',score:.72,iou:.84,rank:1},
  {s:'box',p:'near',o:'conveyor',score:.68,iou:.77,rank:1},
  {s:'arm',p:'on',o:'table',score:.61,iou:.86,rank:1},
  {s:'person',p:'on',o:'table',score:.54,iou:.80,rank:1},
  {s:'conveyor',p:'near',o:'table',score:.49,iou:.90,rank:1},
  {s:'person',p:'holding',o:'box',score:.44,iou:.82,rank:1},
  {s:'arm',p:'attached to',o:'table',score:.38,iou:.79,rank:1},
  {s:'arm',p:'above',o:'table',score:.29,iou:.86,rank:2},
  {s:'person',p:'picking up',o:'box',score:.21,iou:.82,rank:2},
  {s:'person',p:'wearing',o:'glove',score:.19,iou:.43,rank:1},
  {s:'person',p:'near',o:'table',score:.16,iou:.80,rank:2},
  {s:'box',p:'on',o:'conveyor',score:.11,iou:.74,rank:2}
];
var LAB=function(k){return OBJ[k]?OBJ[k].label:k};

/* ───────────────── evaluation core ─────────────────
   opts: {K, tau, perPair, alpha, protocol}
   alpha is the weighting exponent: w_p ∝ n_p^alpha. alpha=1 → R@K, alpha=0 → mR@K. */
function evaluate(opts){
  var K=opts.K==null?10:opts.K, tau=opts.tau==null?.5:opts.tau,
      perPair=opts.perPair==null?1:opts.perPair, alpha=opts.alpha==null?1:opts.alpha,
      iouScale=opts.iouScale==null?1:opts.iouScale;
  var pool=PRED.filter(function(p){return p.rank<=perPair;});
  var top=pool.slice(0,K), used=GT.map(function(){return false}), rows=[];
  top.forEach(function(p){
    var gi=-1;
    for(var i=0;i<GT.length;i++){
      if(!used[i]&&GT[i].s===p.s&&GT[i].p===p.p&&GT[i].o===p.o){gi=i;break}
    }
    var iou=p.iou*iouScale, v;
    if(gi===-1) v='spur';
    else if(iou<tau) v='loc';
    else {v='match'; used[gi]=true}
    rows.push({p:p,v:v,iou:iou});
  });
  var byP={};
  GT.forEach(function(g,i){
    (byP[g.p]=byP[g.p]||{n:0,hit:0}).n++;
    if(used[i]) byP[g.p].hit++;
  });
  var cls=Object.keys(byP), N=GT.length;
  var R=used.filter(Boolean).length/N;
  var mR=cls.reduce(function(a,c){return a+byP[c].hit/byP[c].n},0)/cls.length;
  /* the weighting dial: w_p ∝ n_p^alpha, normalised */
  var wsum=cls.reduce(function(a,c){return a+Math.pow(byP[c].n,alpha)},0);
  var Ra=cls.reduce(function(a,c){
    return a+Math.pow(byP[c].n,alpha)/wsum*(byP[c].hit/byP[c].n);},0);
  return {rows:rows,used:used,R:R,mR:mR,Ra:Ra,byP:byP,cls:cls,pool:pool,K:K,
          matched:used.filter(Boolean).length,N:N};
}

/* ───────────────── tiny helpers ───────────────── */
function esc(s){return String(s).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fx(n,d){return Number(n).toFixed(d==null?3:d)}
function bilingual(en,zh){return '<span lang="en">'+en+'</span><span lang="zh">'+zh+'</span>'}

/* ── UI string table ──────────────────────────────────────────────
   Control labels, readout keys and readout hints are prose and must
   swap with the language toggle, exactly as the surrounding text does.
   Anything absent from this table is deliberately identical in both
   languages: notation (R@20, mR, IoU, τ, k = 1), protocol names
   (PredCls, MultiMPO), and the VG150 class vocabulary itself
   (on, near, box, conveyor). uiT() passes those through untouched,
   so no span is emitted and raw SVG in a hint is never duplicated.
   tools/audit.js enforces that nothing prose-like escapes this table. */
var ZH={
  /* control labels */
  'Zipf exponent s':'Zipf 指數 s',
  'annotation layers':'標註層',
  'blend λ — prior ↔ visual model':'混合比 λ —— 先驗 ↔ 視覺模型',
  'box cost weight':'box 成本權重',
  'class cost weight':'類別成本權重',
  'conditions satisfied':'已滿足的條件',
  'constraint mode':'constraint 模式',
  'corpus Zipf exponent s':'語料 Zipf 指數 s',
  'criteria supplied to the VLM':'提供給 VLM 的 criteria',
  'debiasing strength':'去偏強度',
  'duplicate masks per pair':'每個配對的重複 mask 數',
  'experts N':'expert 數 N',
  'hierarchy level':'階層層級',
  'mask-pairing protocol':'mask 配對 protocol',
  'merge synonym groups':'合併同義詞群組',
  'message-passing iterations':'訊息傳遞迭代次數',
  'mode':'模式',
  'model head bias γ':'模型頭部偏差 γ',
  'neighbour weight':'鄰居權重',
  'object classes held out':'保留不訓練的物件類別數',
  'object proposals N':'物件提案數 N',
  'ordered pair (s,o)':'有序配對 (s,o)',
  'persistence threshold':'持續性門檻',
  'predicate classes':'predicate 類別數',
  'predicate classes |P|':'predicate 類別數 |P|',
  'predicates held out':'保留不訓練的 predicate 數',
  'predicates per pair':'每個配對的 predicate 數',
  'predicates per pair, k':'每個配對的 predicate 數 k',
  'predicted box scale':'預測 box 的縮放',
  'predicted box Δx':'預測 box 的 Δx',
  'predicted box Δy':'預測 box 的 Δy',
  'queries':'query 數',
  'task description':'任務描述',
  'threshold τ':'門檻 τ',
  'timestamp t':'時間戳 t',
  'weighting exponent α':'加權指數 α',
  'which VG150?':'哪一個 VG150？',
  /* option labels */
  'E — examples with analysis':'E —— 附分析的範例',
  'O — predefined object set':'O —— 預定義物件集合',
  'P — predefined predicate set':'P —— 預定義 predicate 集合',
  'bounding boxes':'bounding box',
  'class labels':'類別標籤',
  'equation (1)':'方程式 (1)',
  'equation (2)':'方程式 (2)',
  'object class matches':'物件類別相符',
  'predicate matches':'predicate 相符',
  'relations':'關係',
  'subject class matches':'subject 類別相符',
  'on / above → contact-or-above':'on ／ above → 接觸或位於上方',
  'picking up / holding → grasping':'picking up ／ holding → 抓握',
  'Xu et al.':'Xu 等人',
  /* readout keys */
  'VLM calls / frame':'VLM 呼叫次數／影格',
  'approx. tokens':'約略 token 數',
  'base R@50':'基線 R@50',
  'base − novel':'基線 − 新類',
  'belief spread':'信念離散度',
  'candidate edges':'候選邊數',
  'candidates':'候選數',
  'change':'變化量',
  'classifications':'分類次數',
  'coverage':'覆蓋率',
  'edges at t':'t 時的邊數',
  'equation':'方程式',
  'failure mode':'失效型態',
  'filtered out':'被濾除',
  'gap':'落差',
  'given':'給定',
  'graph reduction':'圖的縮減量',
  'idle slots':'閒置名額',
  'in ground truth':'在 ground truth 中',
  'inflation vs k=1':'相對 k=1 的膨脹',
  'invariant':'不變量',
  'matched':'命中數',
  'nodes at this level':'此層級的節點數',
  'nothing':'無',
  'novel R@50':'新類 R@50',
  'numbers stored':'儲存的數值數',
  'objects':'物件數',
  'objects retained':'保留的物件數',
  'one-stage inflation':'one-stage 的膨脹',
  'ordered pairs':'有序配對數',
  'pixels used':'使用的像素',
  'real relations':'真實關係數',
  'scale ceiling':'尺度上限',
  'scorable':'可計分',
  'setting':'設定',
  'source':'出處',
  'state':'狀態',
  'test':'測試',
  'test images':'測試影像數',
  'traded away':'換掉的部分',
  'train':'訓練',
  'train images':'訓練影像數',
  'triplet':'三元組',
  'val':'驗證',
  'verdict':'判定',
  'vs graph mode':'相對 graph 模式',
  'your setting':'你的設定',
  'zero-shot triplets':'zero-shot 三元組數',
  /* readout values */
  'holds':'成立',
  'VIOLATED':'已違反',
  'counts':'計入',
  'rejected':'不計入',
  'boxes + labels':'box ＋ 標籤',
  'boxes':'box',
  'none':'無',
  /* readout hints */
  '1 extract + N audit + 1 summarise':'1 次抽取 ＋ N 次稽核 ＋ 1 次整合',
  'created by the data':'由資料本身造成',
  'labels n · boxes 4n · triplets 3m':'標籤 n · box 4n · 三元組 3m',
  'max IoU at this scale':'此縮放下的最大 IoU',
  'missed':'漏掉',
  'model unchanged':'模型未改變',
  'nodes dropped as irrelevant':'因不相關而捨棄的節點',
  'paper Table 3':'論文 Table 3',
  'per image, VG150':'每張影像，VG150',
  'test-only, the VRD benchmark':'僅測試集，VRD 基準',
  'trained toward no-relation':'被訓練成傾向「無關係」',
  'triplets in the ranking':'排序中的三元組數',
  'two-stage unaffected':'two-stage 不受影響',
  'union across all frames':'所有影格的聯集',
  '≈7 tokens per node':'每個節點約 7 個 token',
  'match':'命中',
  'spurious':'多餘',
  'IoU fail':'IoU 未達門檻',
  'but the reverse direction is':'但反向為',
  'HOLDS':'成立',
  'FAILS':'不成立',
  'true':'成立',
  'false':'不成立',
  'classification':'分類',
  'localization':'定位',
  'both':'兩者皆是',
  'collapsed':'已塌縮',
  'informative':'具資訊量',
  'Closed-set':'封閉集合',
  'free-text output':'自由文字輸出',
  'vocabulary constrained':'受詞彙約束',
  'not in P':'不在 P 內',
  'yes':'是',
  'no':'否'
};
/* Knowledge points that are live but hosted inside another playground.
   E5 (R@K) is the K slider of E3, so it links there rather than duplicating it.
   tools/check.js asserts every 'live' knowledge point is either built or aliased here. */
var PG_ALIAS={E5:'E3'};

/* Bilingual when the table knows the string, verbatim otherwise. */
function uiT(s){var z=ZH[s]; return z?bilingual(s,z):s}

function svgScene(show,hl){
  var s='<rect x="0" y="0" width="680" height="384" fill="var(--sunk)"/>';
  s+='<path d="M0 300H680" stroke="var(--rule)"/>';
  s+='<path d="M96 246H520 M108 246V322 M508 246V322" stroke="var(--rule)" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
  for(var cx=506;cx<=648;cx+=24) s+='<circle cx="'+cx+'" cy="222" r="9" fill="none" stroke="var(--rule)" stroke-width="1.5"/>';
  s+='<path d="M352 66L372 140L410 196" stroke="var(--rule)" stroke-width="5" fill="none" stroke-linecap="round"/>';
  s+='<circle cx="212" cy="96" r="21" fill="none" stroke="var(--rule)" stroke-width="2"/>';
  s+='<path d="M212 120V214 M212 140L246 176 M212 140L182 176" stroke="var(--rule)" stroke-width="2" fill="none" stroke-linecap="round"/>';
  if(show.boxes) Object.keys(OBJ).forEach(function(k){
    var b=OBJ[k], on=!hl||hl[k], c=on?'var(--accent)':'var(--muted)';
    s+='<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" fill="none" stroke="'+c+
       '" stroke-width="'+(on?1.8:1)+'" stroke-dasharray="'+(on?'none':'4 3')+'" opacity="'+(on?1:.5)+'" rx="1"/>';
  });
  if(show.labels) Object.keys(OBJ).forEach(function(k){
    var b=OBJ[k], on=!hl||hl[k], ty=b.y-5<12?b.y+14:b.y-5;
    s+='<text x="'+(b.x+1)+'" y="'+ty+'" font-family="IBM Plex Mono,monospace" font-size="11" fill="'+
       (on?'var(--accent)':'var(--muted)')+'" opacity="'+(on?1:.6)+'">'+b.label+'</text>';
  });
  if(show.rels) GT.forEach(function(g){
    var a=OBJ[g.s],b=OBJ[g.o];
    var ax=a.x+a.w/2, ay=a.y+a.h/2, bx=b.x+b.w/2, by=b.y+b.h/2;
    s+='<path d="M'+ax+' '+ay+'L'+bx+' '+by+'" stroke="var(--m-match)" stroke-width="1.2" opacity=".5"/>';
    s+='<text x="'+((ax+bx)/2)+'" y="'+((ay+by)/2)+'" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="var(--m-match)">'+g.p+'</text>';
  });
  return '<svg class="stage" viewBox="0 0 680 384" role="img" aria-label="industrial workspace">'+s+'</svg>';
}

/* horizontal bar chart */
function bars(items,max,unit){
  var s='';
  items.forEach(function(it){
    var pct=Math.max(0,Math.min(100,it.v/max*100));
    s+='<div style="display:grid;grid-template-columns:7.5em 1fr 3.6em;gap:8px;align-items:center;margin-bottom:4px">'
      +'<span style="font:500 11px var(--mono);color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(it.k)+'</span>'
      +'<span style="height:11px;background:var(--panel-2);border-radius:2px;overflow:hidden;display:block">'
      +'<span style="display:block;height:100%;width:'+pct+'%;background:'+(it.c||'var(--accent)')+'"></span></span>'
      +'<span style="font:500 11px var(--mono);color:var(--muted);text-align:right;font-variant-numeric:tabular-nums">'+esc(it.l)+(unit||'')+'</span></div>';
  });
  return s;
}

/* line plot, points = [{x,y}] in data units */
function plot(series,xr,yr,xl,yl,marks){
  var W=340,H=170,P={l:36,r:10,t:10,b:26};
  var sx=function(x){return P.l+(x-xr[0])/(xr[1]-xr[0])*(W-P.l-P.r)};
  var sy=function(y){return H-P.b-(y-yr[0])/(yr[1]-yr[0])*(H-P.t-P.b)};
  var s='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="var(--panel)"/>';
  [0,.25,.5,.75,1].forEach(function(f){
    var y=yr[0]+f*(yr[1]-yr[0]);
    s+='<path d="M'+P.l+' '+sy(y)+'H'+(W-P.r)+'" stroke="var(--rule)" stroke-width=".7"/>';
    s+='<text x="'+(P.l-5)+'" y="'+(sy(y)+3.5)+'" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="9" fill="var(--muted)">'+fx(y,2)+'</text>';
  });
  [0,.5,1].forEach(function(f){
    var x=xr[0]+f*(xr[1]-xr[0]);
    s+='<text x="'+sx(x)+'" y="'+(H-8)+'" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="var(--muted)">'+fx(x,2)+'</text>';
  });
  s+='<text x="'+(W/2)+'" y="'+(H-0.5)+'" text-anchor="middle" font-family="Archivo,sans-serif" font-size="9" fill="var(--muted)">'+esc(xl)+'</text>';
  series.forEach(function(se){
    var d=se.pts.map(function(p,i){return (i?'L':'M')+fx(sx(p.x),1)+' '+fx(sy(p.y),1)}).join('');
    s+='<path d="'+d+'" fill="none" stroke="'+se.c+'" stroke-width="2" stroke-dasharray="'+(se.dash||'none')+'"/>';
    var last=se.pts[se.pts.length-1];
    s+='<text x="'+(sx(last.x)-3)+'" y="'+(sy(last.y)-6)+'" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="10" font-weight="600" fill="'+se.c+'">'+esc(se.n)+'</text>';
  });
  (marks||[]).forEach(function(m){
    s+='<circle cx="'+sx(m.x)+'" cy="'+sy(m.y)+'" r="4" fill="none" stroke="'+(m.c||'var(--m-spur)')+'" stroke-width="2"/>';
    s+='<text x="'+(sx(m.x)+8)+'" y="'+(sy(m.y)+3)+'" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="'+(m.c||'var(--m-spur)')+'">'+esc(m.n)+'</text>';
  });
  return '<svg class="stage" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(yl)+' against '+esc(xl)+'">'+s+'</svg>';
}

/* triplet list */
function listRows(st){
  var VL={match:'match',spur:'spurious',loc:'IoU fail',miss:'missed'};
  var VC={match:'var(--m-match)',spur:'var(--m-spur)',loc:'var(--m-loc)',miss:'var(--m-miss)'};
  var s='<div style="border:1px solid var(--rule);border-radius:4px;overflow:auto;max-height:250px;background:var(--panel)">';
  st.rows.forEach(function(r,i){
    s+='<div style="display:grid;grid-template-columns:2em 1fr auto;gap:8px;align-items:center;padding:5px 10px;'
      +'border-bottom:1px solid var(--rule);font:400 11.5px var(--mono)">'
      +'<span style="color:var(--muted)">'+(i+1)+'</span>'
      +'<span>'+LAB(r.p.s)+' <b style="color:var(--accent);font-weight:500">'+r.p.p+'</b> '+LAB(r.p.o)+'</span>'
      +'<span style="color:'+VC[r.v]+';font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">'+uiT(VL[r.v])+'</span></div>';
  });
  st.used.forEach(function(h,i){
    if(h) return;
    var g=GT[i], seen=st.rows.some(function(r){return r.p.s===g.s&&r.p.o===g.o&&r.p.p===g.p});
    if(seen) return;
    s+='<div style="display:grid;grid-template-columns:2em 1fr auto;gap:8px;align-items:center;padding:5px 10px;'
      +'border-bottom:1px solid var(--rule);font:400 11.5px var(--mono);color:var(--m-miss)">'
      +'<span>—</span><span>'+LAB(g.s)+' <i>'+g.p+'</i> '+LAB(g.o)+'</span>'
      +'<span style="font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em">missed</span></div>';
  });
  return s+'</div>';
}


/* ───────────────── per-playground mathematics ─────────────────
   Every playground states the quantity its knobs move. */
var MATH={
F1:"\\[ G=(V,E),\\qquad E\\subseteq V\\times\\mathcal{P}\\times V,\\qquad \\lvert E\\rvert \\le \\lvert V\\rvert(\\lvert V\\rvert-1)\\,\\lvert\\mathcal{P}\\rvert \\]",
F2:"\\[ \\lvert V\\rvert=8 \\;\\Rightarrow\\; 8\\times 7=56 \\text{ ordered pairs},\\qquad 56\\times\\lvert\\mathcal{P}\\rvert=2800 \\text{ candidate edges} \\]",
F3:"\\[ \\operatorname{IoU}(b,b^{\\prime})=\\frac{\\lvert b\\cap b^{\\prime}\\rvert}{\\lvert b\\cup b^{\\prime}\\rvert},\\qquad \\text{accept}\\iff\\operatorname{IoU}\\ge\\tau \\]",
F6:"\\[ p_1,p_2\\mapsto\\tilde p \\;\\Rightarrow\\; \\lvert\\mathcal{P}^{\\prime}\\rvert\\downarrow,\\qquad mR@k=\\frac{1}{\\lvert\\mathcal{P}^{\\prime}\\rvert}\\sum_{p}R_p@k\\ \\uparrow \\]",
F7:"\\[ n_p\\propto p^{-s},\\qquad R_p=\\Bigl(\\tfrac{n_p}{n_1}\\Bigr)^{\\gamma},\\qquad R=\\sum_p\\frac{n_p}{N}R_p,\\qquad mR=\\frac{1}{C}\\sum_p R_p \\]",
E1:"\\[ \\hat t\\simeq t\\iff\\underbrace{c_{\\hat s}=c_s\\wedge c_{\\hat o}=c_o\\wedge\\hat p=p}_{\\text{classification}}\\wedge\\underbrace{\\operatorname{IoU}(b_{\\hat s},b_s)\\ge\\tau\\wedge\\operatorname{IoU}(b_{\\hat o},b_o)\\ge\\tau}_{\\text{localization}} \\]",
E3:"\\[ R@k=\\frac{\\lvert G\\cap X_k\\rvert}{\\lvert G\\rvert},\\qquad k^{\\prime}\\ge k\\Rightarrow R@k^{\\prime}\\ge R@k \\quad(\\text{monotone; no precision term exists}) \\]",
E4:"\\[ \\pi(\\langle s,p,o\\rangle)=(s,o);\\qquad \\text{graph constraint}\\iff\\forall\\,t\\ne t^{\\prime}\\in X_k:\\ \\pi(t)\\ne\\pi(t^{\\prime}) \\]",
E6:"\\[ w_p\\propto n_p^{\\alpha};\\qquad \\underbrace{R@k=\\sum_p\\frac{n_p}{\\lvert G\\rvert}R_p@k}_{\\alpha=1}\\qquad \\underbrace{mR@k=\\sum_p\\frac{1}{\\lvert\\mathcal{P}^{\\prime}\\rvert}R_p@k}_{\\alpha=0} \\]",
E7:"\\[ \\mathrm{ngR}@k:\\ \\pi \\text{ need not be injective};\\qquad \\lvert\\{t\\in X_k:\\pi(t)=(s,o)\\}\\rvert\\le n_{\\text{pair}} \\]",
E10:"\\[ R_{\\text{SGDet}}@k\\ \\le\\ R_{\\text{SGCls}}@k\\ \\le\\ R_{\\text{PredCls}}@k \\qquad\\text{for every model, every fixture} \\]",
E11:"\\[ R_p(\\lambda)=(1-\\lambda)\\underbrace{\\Pr[p\\mid c_s,c_o]}_{\\text{no pixels consulted}}+\\lambda\\underbrace{f_\\theta(V,s,o)}_{\\text{visual model}} \\]",
E13:"\\[ \\text{MultiMPO permits }\\lvert\\{m:\\pi(m)=(s,o)\\}\\rvert>1 \\;\\Longrightarrow\\; \\widehat{mR}=\\rho\\cdot mR,\\quad\\rho>1 \\]",
T1:"\\[ \\text{cost}=N(N-1)\\lvert\\mathcal{P}\\rvert=O\\!\\left(N^{2}\\lvert\\mathcal{P}\\rvert\\right),\\qquad \\text{true relations}=O(N) \\]",
T2:"\\[ b^{(t+1)}_i=(1-w)\\,b^{(0)}_i+w\\,\\overline{b^{(t)}_{\\mathcal{N}(i)}}\\ \\xrightarrow[\\ t\\to\\infty\\ ]{w>0}\\ \\overline{b^{(0)}}\\quad(\\text{consensus; information destroyed}) \\]",
D1:"\\[ \\max_{\\theta}\\ mR@k\\quad\\text{s.t.}\\quad R@k\\ge R_0;\\qquad \\text{FlowSG: both rise, the constraint stops binding} \\]",
O1:"\\[ \\hat\\sigma=\\arg\\min_{\\sigma}\\sum_{i=1}^{\\lvert G\\rvert}\\left[w_c\\,\\mathcal{L}_{\\text{cls}}(i,\\sigma(i))+w_b\\,\\mathcal{L}_{\\text{box}}(i,\\sigma(i))\\right] \\]",
V1:"\\[ \\mathcal{C}=\\mathcal{C}_{\\text{base}}\\sqcup\\mathcal{C}_{\\text{novel}},\\quad \\mathcal{P}=\\mathcal{P}_{\\text{base}}\\sqcup\\mathcal{P}_{\\text{novel}};\\qquad R \\text{ reported on each part separately} \\]",
L8:"\\[ out_{trpl}=\\mathrm{VLM}(V_t,\\textit{Prompt}) \\qquad (1) \\]\\[ out^{s_1}_t=\\mathrm{VLM}(V_t,\\,O,\\,P,\\,E,\\,\\textit{Prompt}) \\qquad (2) \\]",
L9:"\\[ \\bigl(out^{s_2}_t,a_i\\bigr)=\\mathrm{VLM}\\bigl(V_t,O,P,E,\\textit{Prompt},out^{s_1}_t\\bigr),\\ i\\in\\{1,\\dots,N\\} \\qquad (3) \\]\\[ out^{s_3}_t=\\mathrm{VLM}\\bigl(out^{s_2}_t,\\alpha,\\textit{Prompt}\\bigr) \\qquad (4) \\]",
L10:"\\[ \\hat p\\notin\\mathcal{P}\\ \\Longrightarrow\\ \\hat t\\not\\simeq t\\ \\ \\forall t\\in G\\quad(\\text{one ranked slot spent, and } t \\text{ left unmatched}) \\]",
S1:"\\[ G=(V,E,T),\\qquad E=\\bigcup_{t\\in T}E_t,\\qquad e\\in E_t\\iff \\mathrm{born}(e)\\le t\\le\\mathrm{die}(e)\\ \\wedge\\ w_e\\ge\\theta \\]",
G2:"\\[ \\mathcal{G}_{\\ell+1}=\\Phi_{\\ell}(\\mathcal{G}_{\\ell}),\\qquad \\lvert V_{\\ell+1}\\rvert\\ll\\lvert V_{\\ell}\\rvert,\\qquad \\text{tokens}\\approx 7\\,\\lvert V_{\\ell}\\rvert \\]",
G4:"\\[ V_{\\text{task}}=\\{v\\in V:\\ \\mathrm{sim}(v,\\text{task})>\\theta\\};\\qquad \\text{granularity is a property of the task, not the scene} \\]",
X1:"\\[ \\texttt{VG150}\\ \\mapsto\\ \\text{three distinct }(\\mathcal{D}_{\\text{train}},\\mathcal{D}_{\\text{val}},\\mathcal{D}_{\\text{test}})\\ \\Longrightarrow\\ \\text{numbers not comparable} \\]",
X2:"\\[ R@k \\text{ on VRD depends on } k=\\lvert\\{p:\\langle s,p,o\\rangle\\in X\\}\\rvert\\in\\{1,10,70\\},\\ \\text{usually undeclared} \\]"
};

var DERIV={
V1:"\\[\\begin{aligned}\\mathcal{C}=\\mathcal{C}_{\\text{base}}\\sqcup\\mathcal{C}_{\\text{novel}},&\\qquad \\mathcal{P}=\\mathcal{P}_{\\text{base}}\\sqcup\\mathcal{P}_{\\text{novel}}\\\\\\mathcal{D}_{\\text{train}}&=\\bigl\\{I : \\text{every }t\\in G_I\\text{ uses base classes only}\\bigr\\}\\end{aligned}\\]\\[\\begin{gathered}\\text{Holding out a class removes every image containing it, so }\\lvert\\mathcal{D}_{\\text{train}}\\rvert\\text{ falls faster than the holdout fraction:}\\\\ \\text{VG150}\\to 50{,}107\\ (\\text{OvD}),\\quad 44{,}333\\ (\\text{OvR}),\\quad 36{,}425\\ (\\text{OvD+R}).\\\\[4pt]\\text{Report }R\\text{ on base and novel separately; one number hides which half failed.}\\\\ \\text{Verified, Swin-T novel split: OvD }18.14,\\quad\\text{OvR }13.45,\\quad\\text{OvD+R }9.20\\text{ (relations)}.\\\\[4pt]\\text{Withholding }\\textit{relations}\\text{ hurts far more than withholding objects:}\\\\ \\text{object names transfer through a pretrained text encoder, relations do not.}\\end{gathered}\\]",
S1:"\\[\\begin{aligned}E_t &= \\bigl\\{e : \\mathrm{born}(e)\\le t\\le\\mathrm{die}(e)\\ \\wedge\\ w_e\\ge\\theta\\bigr\\}\\\\E &= \\textstyle\\bigcup_{t\\in T}E_t\\\\\\theta'\\ge\\theta &\\Rightarrow E_t(\\theta')\\subseteq E_t(\\theta)\\end{aligned}\\]\\[\\begin{gathered}\\lvert E_t\\rvert\\text{ is non-increasing in }\\theta\\text{: raising the threshold trades temporal recall for stability.}\\\\[4pt]\\text{An edge present in one frame and gone the next is either a real event or detector noise,}\\\\ \\text{and }\\theta\\text{ is the only thing separating them. That is why }T\\text{ belongs in the signature }G=(V,E,T)\\\\ \\text{rather than being handled by running an image model once per frame.}\\end{gathered}\\]",
F2:"\\[\\begin{aligned}\n\\lvert V\\rvert=8 &\\Rightarrow \\lvert V\\rvert(\\lvert V\\rvert-1)=56 &&\\text{ordered pairs, } (s,o)\\text{ and }(o,s)\\text{ distinct}\\\\\n\\lvert\\mathcal{P}\\rvert=50 &\\Rightarrow 56\\cdot 50=2800 &&\\text{candidate edges}\\\\\n\\lvert E\\rvert &\\approx 10 &&\\text{a human would name about ten}\\\\\n\\text{positive rate} &= 10/2800\\approx 3.6\\times 10^{-3}\n\\end{aligned}\\]",
F3:"\\[\\begin{aligned}\nA(b\\cap b') &\\le \\min\\bigl(A(b),A(b')\\bigr) &&\\text{the intersection lies inside both}\\\\\nA(b\\cup b') &\\ge \\max\\bigl(A(b),A(b')\\bigr) &&\\text{the union contains both}\\\\\n\\operatorname{IoU} &= \\frac{A(b\\cap b')}{A(b\\cup b')} \\;\\le\\; \\frac{\\min(A(b),A(b'))}{\\max(A(b),A(b'))} &&\\text{divide the two bounds}\n\\end{aligned}\\]\\[\\begin{gathered}\\text{With } A(b')=\\lambda^2 A(b):\\quad \\operatorname{IoU}\\le\\min(\\lambda^2,\\lambda^{-2}),\n\\quad\\text{so } \\lambda\\ge\\sqrt{2}\\ \\Rightarrow\\ \\operatorname{IoU}<\\tfrac12 \\text{ at } \\tau=0.5.\\end{gathered}\\]",
F6:"\\[\\begin{aligned}\n\\text{merge } p_1,p_2\\mapsto\\tilde p:\\quad n_{\\tilde p}&=n_{p_1}+n_{p_2}, &&C\\mapsto C-1\\\\\nR_{\\tilde p}@k &= \\frac{\\mu(G^{(p_1)}\\cup G^{(p_2)},X_k)}{n_{p_1}+n_{p_2}} \\;\\ge\\; \\frac{\\max_i \\mu(G^{(p_i)},X_k)}{n_{p_1}+n_{p_2}}\n\\end{aligned}\\]\\[\\begin{gathered}\\text{A prediction of } p_1 \\text{ against ground truth } p_2 \\text{ spent a ranked slot } \\textit{and} \\text{ left the truth unmatched.}\n\\\\ \\text{After merging it is a match, so } mR \\text{ rises with the model unchanged.}\\end{gathered}\\]",
F7:"\\[\\begin{aligned}\nn_p &\\propto p^{-s},\\quad p=1,\\dots,C &&\\text{Zipf}\\\\\nR_p &= (n_p/n_1)^{\\gamma}=p^{-s\\gamma} &&\\text{head-biased model}\\\\\nR &= \\sum_p \\frac{n_p}{N}R_p = \\frac{\\sum_p p^{-s(1+\\gamma)}}{\\sum_p p^{-s}} = \\frac{H_C^{(s+s\\gamma)}}{H_C^{(s)}} &&\\text{generalized harmonic numbers}\\\\\nmR &= \\frac{1}{C}\\sum_p p^{-s\\gamma} = \\frac{H_C^{(s\\gamma)}}{C}\n\\end{aligned}\\]\\[\\begin{gathered}s=0 \\;\\Rightarrow\\; n_p \\text{ constant} \\;\\Rightarrow\\; \\operatorname{Cov}(n,R)=0 \\;\\Rightarrow\\; R=mR \\ \\text{ exactly.}\\end{gathered}\\]",
E1:"\\[\\begin{aligned}\n\\hat t\\simeq t &\\iff \\Phi_{\\text{cls}}\\wedge\\Phi_{\\text{loc}}\\\\\n\\Phi_{\\text{cls}} &= (c_{\\hat s}=c_s)\\wedge(c_{\\hat o}=c_o)\\wedge(\\hat p=p)\\\\\n\\Phi_{\\text{loc}} &= (\\operatorname{IoU}_s\\ge\\tau)\\wedge(\\operatorname{IoU}_o\\ge\\tau)\n\\end{aligned}\\]\\[\\begin{gathered}\\neg\\Phi_{\\text{cls}}\\wedge\\Phi_{\\text{loc}} \\equiv \\text{right place, wrong name} \\quad\n\\neg\\Phi_{\\text{loc}}\\wedge\\Phi_{\\text{cls}} \\equiv \\text{right name, wrong place}\n\\\\[4pt]\n\\text{Two independent failure modes} \\Rightarrow \\text{four diff colours, and three protocols to separate them.}\\end{gathered}\\]",
E3:"\\[\\begin{aligned}\nk'\\ge k &\\Rightarrow X_k\\subseteq X_{k'} &&\\text{the ranking is a prefix order}\\\\\n&\\Rightarrow \\mu(G,X_k)\\le\\mu(G,X_{k'}) &&\\text{a maximum matching cannot shrink}\\\\\n&\\Rightarrow R@k\\le R@k' &&\\text{divide by } N\n\\end{aligned}\\]\\[\\begin{gathered}\\text{Monotone in } k \\text{ with no offsetting term: emitting more guesses never costs anything.}\n\\\\ \\text{There is no precision anywhere in this literature.}\\end{gathered}\\]",
E4:"\\[\\begin{aligned}\nX_k &= \\{t\\in X_k^{\\mathrm{ng}} : \\sigma(t)=\\max_{p}\\sigma(\\langle s,p,o\\rangle)\\} &&\\text{constraint keeps the arg-max per pair}\\\\\n&\\Rightarrow X_k\\subseteq X_k^{\\mathrm{ng}}\\\\\n&\\Rightarrow \\mu(G,X_k)\\le\\mu(G,X_k^{\\mathrm{ng}}) \\;\\Rightarrow\\; R@k\\le \\mathrm{ngR}@k\n\\end{aligned}\\]\\[\\begin{gathered}\\text{The inequality is strict whenever a ground-truth predicate is any pair's runner-up.}\n\\\\ \\text{STTran on Action Genome: PredCls } R@50 = 71.8 \\text{ constrained}, \\; 99.1 \\text{ unconstrained.}\\end{gathered}\\]",
E6:"\\[\\begin{aligned}\nR@k-mR@k &= \\sum_p \\frac{n_p}{N}R_p - \\frac{1}{C}\\sum_p R_p &&\\text{Definition 9}\\\\\n&= \\frac{1}{N}\\sum_p\\Bigl(n_p-\\frac{N}{C}\\Bigr)R_p = \\frac{1}{N}\\sum_p (n_p-\\bar n)R_p &&\\bar n=N/C\\\\\n&= \\frac{1}{N}\\sum_p (n_p-\\bar n)(R_p-\\bar R) &&\\textstyle\\sum_p(n_p-\\bar n)=0\\\\\n&= \\frac{C}{N}\\operatorname{Cov}(n,R) = \\frac{\\operatorname{Cov}(n,R)}{\\bar n}\n\\end{aligned}\\]\\[\\begin{gathered}\\text{The slider moves } \\alpha \\text{ in } w_p(\\alpha)\\propto n_p^{\\alpha}. \\;\\; \\alpha=1 \\text{ gives } R, \\;\\; \\alpha=0 \\text{ gives } mR.\n\\\\ \\text{The whole bias problem is the sign of one covariance.}\\end{gathered}\\]",
E7:"\\[\\begin{aligned}\nX_k^{\\mathrm{ng}}(m) &= \\bigcup_{(s,o)}\\bigl\\{\\text{top-}m\\text{ predicates for }(s,o)\\bigr\\}\\cap X_k\\\\\nm'\\ge m &\\Rightarrow X_k^{\\mathrm{ng}}(m)\\subseteq X_k^{\\mathrm{ng}}(m') \\Rightarrow \\mathrm{ngR}(m)\\le \\mathrm{ngR}(m')\n\\end{aligned}\\]\\[\\begin{gathered}\\text{Saturates once } m \\text{ exceeds the number of runner-up predicates the model actually carries.}\n\\\\ \\text{A real model carries } \\lvert\\mathcal{P}\\rvert=50, \\text{ so the gap keeps widening to } m=50.\\end{gathered}\\]",
E10:"\\[\\begin{aligned}\n\\lvert\\mathcal{H}_{\\text{PredCls}}\\rvert &= \\lvert V\\rvert^2\\lvert\\mathcal{P}\\rvert\\\\\n\\lvert\\mathcal{H}_{\\text{SGCls}}\\rvert &= \\lvert V\\rvert^2\\lvert\\mathcal{C}\\rvert^2\\lvert\\mathcal{P}\\rvert\\\\\n\\lvert\\mathcal{H}_{\\text{SGDet}}\\rvert &\\supseteq \\lvert\\mathcal{H}_{\\text{SGCls}}\\rvert \\quad\\text{(boxes unknown too)}\n\\end{aligned}\\]\\[\\begin{gathered}\\text{Any hypothesis reachable under a harder protocol is reachable under an easier one}\n\\\\ \\text{by discarding the extra input} \\;\\Rightarrow\\; R_{\\text{SGDet}}\\le R_{\\text{SGCls}}\\le R_{\\text{PredCls}}.\n\\\\[4pt]\n\\textbf{Note } \\lvert V\\rvert^2 \\text{ survives in all three: boxes are given, pairs never are.}\\end{gathered}\\]",
E11:"\\[\\begin{aligned}\nR_p(\\lambda) &= (1-\\lambda)\\,\\pi_p + \\lambda\\, f_p, \\qquad \\pi_p=\\Pr[p\\mid c_s,c_o],\\ f_p=f_\\theta(V,s,o)\\\\\nR(\\lambda) &= \\sum_p \\tfrac{n_p}{N}R_p(\\lambda) = (1-\\lambda)\\textstyle\\sum_p \\tfrac{n_p}{N}\\pi_p + \\lambda\\sum_p \\tfrac{n_p}{N}f_p\\\\\nmR(\\lambda) &= (1-\\lambda)\\,\\overline{\\pi} + \\lambda\\,\\overline{f}\n\\end{aligned}\\]\\[\\begin{gathered}\\text{Both are affine in } \\lambda. \\text{ At } \\lambda=0 \\text{ the predictor reads no pixels, yet}\n\\\\ \\operatorname{Cov}(n,\\pi)\\gg 0 \\text{ by construction, so } R \\text{ is high and } mR \\text{ is near zero.}\n\\\\[4pt]\n\\text{VG150, PredCls } mR@100: \\ \\text{FREQ } 16.0 \\; > \\; \\text{MOTIFS } 15.3 \\; > \\; \\text{IMP}^{+}\\ 10.5.\\end{gathered}\\]",
E13:"\\[\\begin{aligned}\n\\text{SingleMPO}&: \\ \\lvert\\{m:\\pi(m)=(s,o)\\}\\rvert = 1\\\\\n\\text{MultiMPO}&: \\ \\lvert\\{m:\\pi(m)=(s,o)\\}\\rvert = d \\ge 1 \\ \\text{permitted}\\\\\n\\widehat{\\mu} &= \\textstyle\\sum_{(s,o)}\\min\\bigl(d,\\ \\text{true matches at }(s,o)\\bigr) \\;\\ge\\; \\mu\n\\end{aligned}\\]\\[\\begin{gathered}\\text{A one-stage model emits duplicate masks freely, so } d>1 \\text{ costs it nothing and pays.}\n\\\\ \\text{A two-stage model emits one mask per instance, so } d=1 \\text{ regardless.}\n\\\\[4pt]\n\\text{Measured: PSGTR } 20.8\\to 11.62,\\quad \\text{HiLo } 30.3\\to 18.33,\\quad \\text{VCTree } \\approx\\text{unchanged.}\\end{gathered}\\]",
T1:"\\[\\begin{aligned}\n\\text{pairs} &= N(N-1) &&\\text{ordered, } i\\ne j\\\\\n\\text{decisions} &= N(N-1)\\lvert\\mathcal{P}\\rvert = O\\bigl(N^2\\lvert\\mathcal{P}\\rvert\\bigr)\\\\\n\\lvert E\\rvert &= O(N) &&\\text{true relations, empirically}\n\\end{aligned}\\]\\[\\begin{gathered}N=80,\\ \\lvert\\mathcal{P}\\rvert=310:\\quad 80\\cdot 79\\cdot 310 = 1{,}958{,}800 \\ \\text{decisions for} \\approx 20 \\ \\text{relations}\n\\\\[4pt]\n\\text{positive rate} \\approx 1.0\\times 10^{-5}. \\text{ This ratio is the motivation for one-stage set prediction.}\\end{gathered}\\]",
T2:"\\[\\begin{aligned}\nb^{(t+1)}_i &= (1-w)\\,b^{(0)}_i + w\\,\\overline{b^{(t)}} , \\qquad \\overline{b^{(t)}}=\\tfrac{1}{n}\\textstyle\\sum_j b^{(t)}_j\\\\\n\\overline{b^{(t+1)}} &= (1-w)\\overline{b^{(0)}} + w\\,\\overline{b^{(t)}} \\;\\Rightarrow\\; \\overline{b^{(t)}}=\\overline{b^{(0)}} \\ \\forall t\n\\end{aligned}\\]\\[\\begin{gathered}\\text{So } b^{(t)}_i = (1-w^t)\\bigl[(1-w)b^{(0)}_i + w\\overline{b^{(0)}}\\bigr]\\cdot\\!\\ldots\\ \\longrightarrow\\\nb^{\\ast}_i = (1-w)b^{(0)}_i + w\\,\\overline{b^{(0)}}\n\\\\[4pt]\n\\text{Spread contracts by } (1-w) \\text{ per step: } \\ \\operatorname{Var}(b^{(t)}) = (1-w)^{2}\\operatorname{Var}(b^{(0)}) \\text{ at the fixed point.}\n\\\\ w\\to 1 \\Rightarrow \\text{every belief equals the graph mean and the model distinguishes nothing.}\\end{gathered}\\]",
D1:"\\[\\begin{aligned}\n\\text{debiasing reweights the loss: } \\ \\ell_\\theta &= \\textstyle\\sum_p \\omega_p\\,\\ell_p, \\qquad \\omega_p\\propto n_p^{-\\beta}\\\\\n\\beta\\uparrow \\;&\\Rightarrow\\; R_p\\uparrow \\text{ for rare } p, \\quad R_p\\downarrow \\text{ for common } p\\\\\n&\\Rightarrow\\; \\operatorname{Cov}(n,R)\\downarrow \\;\\Rightarrow\\; R-mR \\downarrow \\quad\\text{(Proposition 3)}\n\\end{aligned}\\]\\[\\begin{gathered}\\text{Since } R=\\textstyle\\sum_p \\frac{n_p}{N}R_p \\text{ is dominated by large } n_p, \\text{ lowering common-class recall}\n\\\\ \\text{costs } R \\text{ directly. That is the trade-off, and why it held from TDE (2020) to RA-SGG (2024).}\n\\\\[4pt]\n\\text{FlowSG (CVPR 2026) reports } 36.5\\ R@50 \\text{ and } 18.4\\ mR@50 \\text{ together: the constraint stopped binding.}\\end{gathered}\\]",
O1:"\\[\\begin{aligned}\n\\hat\\sigma &= \\arg\\min_{\\sigma}\\ \\sum_{i=1}^{\\lvert G\\rvert}\\mathcal{L}\\bigl(i,\\sigma(i)\\bigr),\n\\qquad \\mathcal{L}=w_c\\mathcal{L}_{\\text{cls}}+w_b\\mathcal{L}_{\\text{box}}\\\\\n\\text{cost} &= O(q^3) \\ \\text{by the Hungarian algorithm, } q=\\text{number of queries}\n\\end{aligned}\\]\\[\\begin{gathered}q<\\lvert G\\rvert \\;\\Rightarrow\\; \\lvert G\\rvert-q \\text{ ground-truth triplets are unreachable: recall is capped at } q/\\lvert G\\rvert.\n\\\\ q\\gg\\lvert G\\rvert \\;\\Rightarrow\\; q-\\lvert G\\rvert \\text{ slots train only against } \\varnothing \\text{ and stay undertrained.}\n\\\\[4pt]\n\\text{SpeaQ answers with groupwise specialization; Hydra-SGG with one-to-many assignment.}\\end{gathered}\\]",
L8:"\\[\\begin{aligned}\n(1)\\ \\ out_{trpl} &= \\mathrm{VLM}(V_t,\\textit{Prompt}) && R@20 = 0.032\\\\\n(2)\\ \\ out^{s_1}_t &= \\mathrm{VLM}(V_t,O,\\textit{Prompt}) && R@20 = 1.787\\\\\n(2)\\ \\ out^{s_1}_t &= \\mathrm{VLM}(V_t,P,\\textit{Prompt}) && R@20 = 2.079\\\\\n(2)\\ \\ out^{s_1}_t &= \\mathrm{VLM}(V_t,O,P,\\textit{Prompt}) && R@20 = 20.792\\\\\n(2)\\ \\ out^{s_1}_t &= \\mathrm{VLM}(V_t,O,P,E,\\textit{Prompt}) && R@20 = 23.040\n\\end{aligned}\\]\\[\\begin{gathered}\\text{Same operator, same image, same prompt template. The only varying argument is } (O,P,E).\n\\\\ \\text{Rows 2 and 3 are single-component ablations, not cumulative: } O \\text{ alone, then } P \\text{ alone.}\n\\\\ \\text{The jump is superadditive: } 1.787 \\text{ and } 2.079 \\text{ apart, } 20.792 \\text{ together.}\n\\\\ \\text{Ratio between endpoints: } 23.040/0.032 = 720. \\ \\text{Architectural difference: none.}\\end{gathered}\\]",
L9:"\\[\\begin{aligned}\n\\text{step 2 draws } N \\text{ i.i.d. audits } a_1,\\dots,a_N \\text{ of } out^{s_1}_t; \\text{ step 3 aggregates them.}\\\\\n\\text{If each audit corrects an error independently with probability } q,\\\\\n\\Pr[\\text{error survives } N \\text{ audits}] = (1-q)^N \\quad\\text{(exponential in } N)\\\\\n\\text{cost} = N+2 \\ \\text{VLM calls per frame} \\quad\\text{(linear in } N)\n\\end{aligned}\\]\\[\\begin{gathered}\\text{Measured: } N=1,2,3,5 \\Rightarrow R@20 = 21.323,\\ 21.584,\\ 23.158,\\ 23.287.\n\\\\ \\text{At } k=20 \\text{ that favours } N=5 \\text{, but not everywhere:}\n\\\\ mR@50 = 25.480 \\text{ at } N=3 \\text{ against } 24.383 \\text{ at } N=5 \\text{; } R@100 = 30.142 \\text{ against } 30.020.\n\\\\ \\text{So } N=3 \\text{ is not dominated, and the recommendation rests on more than token cost.}\n\\\\ \\text{An empirical claim with no accompanying theory \u2014 the independence assumption is untested.}\\end{gathered}\\]",
L10:"\\[\\begin{aligned}\n\\hat p\\notin\\mathcal{P} \\;&\\Rightarrow\\; \\hat p\\ne p \\ \\ \\forall t\\in G &&\\text{Definition 5, third conjunct}\\\\\n&\\Rightarrow\\; \\hat t\\not\\simeq t \\ \\ \\forall t \\;\\Rightarrow\\; \\hat t \\text{ contributes nothing to } \\mu\\\\\n&\\Rightarrow\\; \\hat t \\text{ occupies a slot in } X_k \\text{ and the true } t \\text{ stays unmatched}\n\\end{aligned}\\]\\[\\begin{gathered}\\textbf{The error is counted twice:} \\text{ once as a wasted rank, once as a miss.}\n\\\\ \\text{This is what LLM4SGG names } \\textit{semantic over-simplification}, \\text{ and why zero-shot}\n\\\\ \\text{frontier VLMs score } R@50\\approx 1\\text{\u2013}2 \\text{ on VG-150 while describing the scene correctly.}\\end{gathered}\\]",
G2:"\\[\\begin{aligned}\n\\mathcal{G}_{\\ell+1} &= \\Phi_\\ell(\\mathcal{G}_\\ell), \\qquad \\lvert V_{\\ell+1}\\rvert \\ll \\lvert V_\\ell\\rvert \\quad\\text{(lossy collapse)}\\\\\n\\text{tokens}(\\ell) &\\approx 7\\,\\lvert V_\\ell\\rvert\n\\end{aligned}\\]\\[\\begin{gathered}\\text{Hydra: } 48{,}000 \\text{ voxels} \\to 140 \\text{ objects} \\to 52 \\text{ places} \\to 36 \\text{ rooms} \\to 3 \\text{ floors.}\n\\\\[4pt]\n\\text{SayPlan searches the collapsed graph first, then expands only the relevant subgraph:}\n\\\\ 48{,}000\\cdot 7 \\approx 336\\text{k tokens (infeasible)} \\quad\\text{versus}\\quad 36\\cdot 7 \\approx 252 \\text{ tokens.}\\end{gathered}\\]",
X2:"\\[\\begin{aligned}\nR@k \\text{ on VRD admits } k \\text{ predicates per ordered pair}, \\ k\\in\\{1,10,70\\}\\\\\nk=1 &\\equiv \\text{graph constraint} \\qquad k=\\lvert\\mathcal{P}\\rvert=70 \\equiv \\text{no constraint at all}\\\\\nk=70 &\\Rightarrow \\text{every predicate enters for every pair} \\Rightarrow R@k \\to PR@k\n\\end{aligned}\\]\\[\\begin{gathered}\\text{At } k=70 \\text{ the metric measures pair detection, not relation classification (Proposition 4c).}\n\\\\ \\text{Papers routinely omit } k, \\text{ so VRD numbers are not comparable across papers by default.}\\end{gathered}\\]"
};

/* ───────────────── playground factory ───────────────── */
var PGS=[];
function pg(def){PGS.push(def)}

function buildControls(def,state,rerender){
  var s='';
  def.ctrls.forEach(function(c,i){
    var id=def.id+'-'+c.k;
    if(c.t==='range'){
      s+='<div class="ctl"><div class="ctl-top"><label for="'+id+'">'+uiT(c.label)+'</label>'
        +'<span class="val" id="'+id+'-v">'+c.fmt(state[c.k])+'</span></div>'
        +'<input type="range" id="'+id+'" min="'+c.min+'" max="'+c.max+'" step="'+c.step+'" value="'+state[c.k]+'"></div>';
    } else if(c.t==='knob'){
      s+='<div class="ctl"><div class="ctl-top"><label>'+uiT(c.label)+'</label></div><div class="knob" id="'+id+'">';
      c.opts.forEach(function(o){
        s+='<button type="button" data-v="'+o[0]+'" aria-pressed="'+(String(state[c.k])===String(o[0]))+'">'+uiT(o[1])+'</button>';
      });
      s+='</div></div>';
    } else if(c.t==='checks'){
      s+='<div class="ctl"><div class="ctl-top"><label>'+uiT(c.label)+'</label></div><div class="checks" id="'+id+'">';
      c.opts.forEach(function(o){
        s+='<label class="chk"><input type="checkbox" data-v="'+o[0]+'"'+(state[c.k][o[0]]?' checked':'')+'> <span>'+uiT(o[1])+'</span></label>';
      });
      s+='</div></div>';
    } else if(c.t==='text'){
      s+='<div class="ctl"><div class="ctl-top"><label for="'+id+'">'+uiT(c.label)+'</label></div>'
        +'<input type="text" id="'+id+'" value="'+esc(state[c.k])+'" placeholder="'+esc(c.ph||'')+'"></div>';
    }
  });
  return s;
}

function wire(def,root,state,render){
  def.ctrls.forEach(function(c){
    var id=def.id+'-'+c.k, el=root.querySelector('#'+CSS.escape(id));
    if(!el) return;
    if(c.t==='range'){
      el.addEventListener('input',function(){
        state[c.k]=parseFloat(el.value);
        var v=root.querySelector('#'+CSS.escape(id+'-v')); if(v) v.textContent=c.fmt(state[c.k]);
        render();
      });
    } else if(c.t==='knob'){
      el.addEventListener('click',function(e){
        var b=e.target.closest('button'); if(!b) return;
        state[c.k]=isNaN(+b.dataset.v)||b.dataset.v===''?b.dataset.v:+b.dataset.v;
        Array.prototype.forEach.call(el.children,function(x){
          x.setAttribute('aria-pressed',String(x.dataset.v)===String(b.dataset.v));});
        render();
      });
    } else if(c.t==='checks'){
      el.addEventListener('change',function(e){
        var i=e.target; if(i.type!=='checkbox') return;
        state[c.k][i.dataset.v]=i.checked; render();
      });
    } else if(c.t==='text'){
      el.addEventListener('input',function(){state[c.k]=el.value; render();});
    }
  });
}

function mountAll(){
  var out=document.getElementById('pg-out'), html='';
  PGS.forEach(function(d){
    html+='<div class="pg" id="pg-'+d.id+'"><div class="pg-h"><span class="id">'+d.id+'</span>'
      +'<h3>'+bilingual(d.en,d.zh)+'</h3></div>'
      +'<div class="pg-body"><div class="pg-vis" id="vis-'+d.id+'"></div>'
      +'<div class="pg-side"><div id="ctl-'+d.id+'" style="display:flex;flex-direction:column;gap:13px"></div>'
      +'<div id="out-'+d.id+'"></div></div></div>'
      +(MATH[d.id]?'<div class="pg-math">'+MATH[d.id]+'</div>':'')
      +(DERIV[d.id]?'<details class="drill"><summary>'
        +'<span lang="en">derivation</span><span lang="zh">推導</span>'
        +'</summary><div class="drill-body">'+DERIV[d.id]+'</div></details>':'')
      +'<div class="pg-note">'+bilingual('<b>What to notice.</b> '+d.note_en,'<b>該注意什麼。</b>'+d.note_zh)+'</div></div>';
  });
  out.innerHTML=html;
  PGS.forEach(function(d){
    var root=document.getElementById('pg-'+d.id), state={};
    d.ctrls.forEach(function(c){
      state[c.k]=c.t==='checks'?JSON.parse(JSON.stringify(c.val)):c.val;});
    document.getElementById('ctl-'+d.id).innerHTML=buildControls(d,state);
    function render(){
      var r=d.draw(state);
      document.getElementById('vis-'+d.id).innerHTML=r.vis||'';
      var o=r.out||[];
      var cls=o.length===1?'out one':o.length===3?'out three':'out';
      document.getElementById('out-'+d.id).innerHTML='<div class="'+cls+'">'+o.map(function(x){
        return '<div class="o"><k>'+uiT(x.k)+'</k><v'+(x.cls?' class="'+x.cls+'"':'')+'>'+uiT(x.v)+'</v>'
             +(x.s?'<s>'+uiT(x.s)+'</s>':'')+'</div>';}).join('')+'</div>'+(r.extra||'');
    }
    wire(d,root,state,render);
    render();
  });
}

/* ═════════════════ THE PLAYGROUNDS ═════════════════ */

/* F1 — from labels to structure */
pg({id:'F1',en:'From labels to structure',zh:'從標籤到結構',
 ctrls:[{t:'checks',k:'L',label:'annotation layers',val:{labels:true,boxes:true,rels:false},
   opts:[['labels','class labels'],['boxes','bounding boxes'],['rels','relations']]}],
 note_en:'Classes alone say what is present. Boxes add where. Only the relation layer distinguishes <i>person picking up box</i> from <i>box on table</i> — and it is the only layer that grows quadratically with the object count.',
 note_zh:'只有類別，說的是「有什麼」。加上 box，說的是「在哪裡」。只有關係這一層能區分 <i>person picking up box</i> 與 <i>box on table</i>——而它也是唯一隨物件數量平方成長的一層。',
 draw:function(s){
   var n=Object.keys(OBJ).length;
   var bits=(s.L.labels?n:0)+(s.L.boxes?n*4:0)+(s.L.rels?GT.length*3:0);
   return {vis:svgScene(s.L),out:[
     {k:'objects',v:n},{k:'relations',v:s.L.rels?GT.length:0},
     {k:'numbers stored',v:bits,s:'labels n · boxes 4n · triplets 3m'}]};
 }});

/* F2 — the triplet and G=(V,E,T) */
pg({id:'F2',en:'The triplet and G=(V,E,T)',zh:'三元組與 G=(V,E,T)',
 ctrls:[
  {t:'range',k:'i',label:'ordered pair (s,o)',min:0,max:55,step:1,val:0,fmt:function(v){return '#'+v}},
  {t:'knob',k:'p',label:'predicate',val:'on',opts:[['on','on'],['near','near'],['above','above'],['holding','holding']]}],
 note_en:'Eight objects give \\(8\\times 7 = 56\\) ordered pairs, and each pair can carry any of 50 VG150 predicates. The model is choosing among 2,800 candidate edges for a scene a person would describe in ten. Direction matters: swapping subject and object usually produces a false triplet.',
 note_zh:'八個物件產生 \\(8\\times 7 = 56\\) 個有序配對，每個配對可以掛上 VG150 的 50 個 predicate 之一。模型要從 2,800 條候選邊裡挑，而人只會講出十條。方向有意義：對調 subject 與 object 通常會得到錯誤的三元組。',
 draw:function(s){
   var keys=Object.keys(OBJ), pairs=[];
   keys.forEach(function(a){keys.forEach(function(b){if(a!==b)pairs.push([a,b])})});
   var pr=pairs[s.i%pairs.length], t={s:pr[0],p:s.p,o:pr[1]};
   var inGT=GT.some(function(g){return g.s===t.s&&g.p===t.p&&g.o===t.o});
   var rev=GT.some(function(g){return g.s===t.o&&g.p===t.p&&g.o===t.s});
   var hl={}; hl[t.s]=1; hl[t.o]=1;
   return {vis:svgScene({labels:true,boxes:true},hl),out:[
     {k:'triplet',v:'<span style="font-size:13px">⟨'+LAB(t.s)+', '+t.p+', '+LAB(t.o)+'⟩</span>'},
     {k:'in ground truth',v:inGT?'yes':'no',cls:inGT?'up':'dn',
      s:rev&&!inGT?'but the reverse direction is':''},
     {k:'candidate edges',v:pairs.length*50,s:pairs.length+' pairs × 50 predicates'}]};
 }});

/* F3 — grounding and IoU */
pg({id:'F3',en:'Grounding with boxes; IoU',zh:'以 box 定位；IoU',
 ctrls:[
  {t:'range',k:'dx',label:'predicted box Δx',min:-120,max:120,step:2,val:30,fmt:function(v){return v+' px'}},
  {t:'range',k:'dy',label:'predicted box Δy',min:-100,max:100,step:2,val:20,fmt:function(v){return v+' px'}},
  {t:'range',k:'sc',label:'predicted box scale',min:.4,max:1.8,step:.02,val:1,fmt:function(v){return fx(v,2)+'×'}},
  {t:'range',k:'tau',label:'threshold τ',min:.1,max:.95,step:.05,val:.5,fmt:function(v){return fx(v,2)}}],
 note_en:'\\(\\operatorname{IoU}=\\lvert b\\cap b\'\\rvert/\\lvert b\\cup b\'\\rvert\\). Scale alone caps the achievable value: a box twice the correct area cannot exceed \\(0.5\\) however perfectly centred. The threshold \\(\\tau=0.5\\) is convention inherited from Xu et al., never stated in the reference metric implementation — so treat it as a parameter, not a law.',
 note_zh:'\\(\\operatorname{IoU}=\\lvert b\\cap b\'\\rvert/\\lvert b\\cup b\'\\rvert\\)。光是尺度就會壓住可達上限：面積兩倍於正解的 box，就算完美對中也不可能超過 \\(0.5\\)。門檻 \\(\\tau=0.5\\) 是沿襲 Xu et al. 的慣例，參考實作從未寫明——所以請把它當參數，不是定律。',
 draw:function(s){
   var g=OBJ.box, cx=g.x+g.w/2+s.dx, cy=g.y+g.h/2+s.dy, w=g.w*s.sc, h=g.h*s.sc;
   var p={x:cx-w/2,y:cy-h/2,w:w,h:h};
   var ix=Math.max(0,Math.min(g.x+g.w,p.x+p.w)-Math.max(g.x,p.x));
   var iy=Math.max(0,Math.min(g.y+g.h,p.y+p.h)-Math.max(g.y,p.y));
   var inter=ix*iy, uni=g.w*g.h+p.w*p.h-inter, iou=uni>0?inter/uni:0;
   var ok=iou>=s.tau;
   var sv='<rect x="0" y="0" width="680" height="384" fill="var(--sunk)"/>'
    +'<path d="M96 246H520 M108 246V322 M508 246V322" stroke="var(--rule)" stroke-width="2.5" fill="none"/>'
    +'<rect x="'+Math.max(g.x,p.x)+'" y="'+Math.max(g.y,p.y)+'" width="'+ix+'" height="'+iy+'" fill="var(--accent)" opacity=".22"/>'
    +'<rect x="'+g.x+'" y="'+g.y+'" width="'+g.w+'" height="'+g.h+'" fill="none" stroke="var(--m-match)" stroke-width="2"/>'
    +'<text x="'+g.x+'" y="'+(g.y-6)+'" font-family="IBM Plex Mono,monospace" font-size="11" fill="var(--m-match)">ground truth</text>'
    +'<rect x="'+fx(p.x,1)+'" y="'+fx(p.y,1)+'" width="'+fx(p.w,1)+'" height="'+fx(p.h,1)+'" fill="none" stroke="'+(ok?'var(--accent)':'var(--m-spur)')+'" stroke-width="2" stroke-dasharray="6 4"/>'
    +'<text x="'+fx(p.x,1)+'" y="'+fx(p.y+p.h+14,1)+'" font-family="IBM Plex Mono,monospace" font-size="11" fill="'+(ok?'var(--accent)':'var(--m-spur)')+'">prediction</text>';
   return {vis:'<svg class="stage" viewBox="0 0 680 384" role="img" aria-label="box overlap">'+sv+'</svg>',
     out:[{k:'IoU',v:fx(iou),cls:ok?'up':'dn'},
          {k:'verdict',v:ok?'counts':'rejected',cls:ok?'up':'dn',s:'τ = '+fx(s.tau,2)},
          {k:'scale ceiling',v:fx(Math.min(1,1/Math.max(s.sc,1/s.sc)),3),s:'max IoU at this scale'}]};
 }});

/* F6 — predicate synonymy */
pg({id:'F6',en:'Predicate synonymy has no hierarchy',zh:'Predicate 同義詞沒有階層',
 ctrls:[{t:'checks',k:'M',label:'merge synonym groups',val:{spatial:false,contact:false},
   opts:[['spatial','on / above → contact-or-above'],['contact','picking up / holding → grasping']]}],
 note_en:'VG150 treats <code>on</code>, <code>above</code>, <code>over</code>, <code>laying on</code> and <code>sitting on</code> as five unrelated classes, and <code>man</code>, <code>person</code>, <code>people</code> as three. Merge the synonyms and mean Recall jumps without the model improving at all — because two of the failures were never errors, only vocabulary disagreements. IndoorVG exists to make exactly this point.',
 note_zh:'VG150 把 <code>on</code>、<code>above</code>、<code>over</code>、<code>laying on</code>、<code>sitting on</code> 當成五個互不相干的類別，也把 <code>man</code>、<code>person</code>、<code>people</code> 當成三個。合併同義詞後，mean Recall 會上升，而模型完全沒有變好——因為其中兩個「錯誤」從來不是錯，只是用詞不一致。IndoorVG 這個資料集存在的目的就是說明這件事。',
 draw:function(s){
   var st=evaluate({K:20,perPair:1});
   var byP=JSON.parse(JSON.stringify(st.byP));
   if(s.M.spatial){ /* arm-on-table now satisfies arm-above-table */
     byP['above']={n:1,hit:1};
   }
   if(s.M.contact){ /* person-holding-box now satisfies person-picking-up-box */
     byP['picking up']={n:1,hit:1};
   }
   var cls=Object.keys(byP);
   var mR=cls.reduce(function(a,c){return a+byP[c].hit/byP[c].n},0)/cls.length;
   var base=st.mR;
   var items=cls.map(function(c){return {k:c,v:byP[c].hit/byP[c].n,l:fx(byP[c].hit/byP[c].n,2),
     c:byP[c].hit/byP[c].n>0?'var(--m-match)':'var(--m-spur)'}});
   return {vis:bars(items,1,''),out:[
     {k:'mR@20',v:fx(mR),cls:mR>base?'up':''},
     {k:'change',v:(mR>=base?'+':'')+fx(mR-base),cls:mR>base?'up':'',
      s:'model unchanged'}]};
 }});

/* F7 — the long tail */
pg({id:'F7',en:'The long-tail predicate distribution',zh:'Predicate 的長尾分布',
 ctrls:[
  {t:'range',k:'s',label:'Zipf exponent s',min:0,max:2.4,step:.05,val:1.1,fmt:function(v){return fx(v,2)}},
  {t:'range',k:'C',label:'predicate classes',min:4,max:50,step:1,val:12,fmt:function(v){return String(v)}},
  {t:'range',k:'g',label:'model head bias γ',min:0,max:3,step:.05,val:1.4,fmt:function(v){return fx(v,2)}}],
 note_en:'Counts follow \\(n_p \\propto p^{-s}\\); the model recovers class \\(p\\) with probability \\((n_p/n_1)^{\\gamma}\\). At \\(s=0\\) the distribution is flat and \\(R\\) and \\(mR\\) coincide exactly. Raise \\(s\\) and they separate — the entire gap is created by the data, not by the model. VG150 sits near \\(s\\approx 1.1\\).',
 note_zh:'各類數量服從 \\(n_p \\propto p^{-s}\\)；模型以機率 \\((n_p/n_1)^{\\gamma}\\) 救回第 \\(p\\) 類。當 \\(s=0\\) 時分布是平的，\\(R\\) 與 \\(mR\\) 完全重合。把 \\(s\\) 調高，兩者就分開——這個落差完全由資料造成，與模型無關。VG150 大約落在 \\(s\\approx 1.1\\)。',
 draw:function(s){
   var C=Math.round(s.C), n=[], tot=0;
   for(var i=1;i<=C;i++){var v=Math.pow(i,-s.s); n.push(v); tot+=v}
   var r=n.map(function(v){return Math.pow(v/n[0],s.g)});
   var R=n.reduce(function(a,v,i){return a+v/tot*r[i]},0);
   var mR=r.reduce(function(a,v){return a+v},0)/C;
   var items=n.slice(0,12).map(function(v,i){return {k:'p'+(i+1),v:v/n[0],
     l:fx(r[i],2),c:r[i]>.5?'var(--m-match)':r[i]>.15?'var(--m-loc)':'var(--m-spur)'}});
   return {vis:bars(items,1,''),
     out:[{k:'R',v:fx(R)},{k:'mR',v:fx(mR)},
          {k:'gap',v:fx(R-mR),cls:R-mR>.15?'dn':'',s:'created by the data'}]};
 }});

/* E1 — the match relation */
pg({id:'E1',en:'The match relation ≃, conjunct by conjunct',zh:'逐項拆解命中關係 ≃',
 ctrls:[{t:'checks',k:'C',label:'conditions satisfied',
   val:{cs:true,co:true,p:true,is:true,io:true},
   opts:[['cs','subject class matches'],['co','object class matches'],['p','predicate matches'],
         ['is','IoU(subject) ≥ τ'],['io','IoU(object) ≥ τ']]}],
 note_en:'All five conjuncts must hold. Turn off a class or the predicate and the failure is <i>classification</i>; turn off an IoU and it is <i>localization</i>. Two independent failure modes, which is why the diff view uses four colours and why PredCls, SGCls and SGDet exist as separate protocols.',
 note_zh:'五個條件必須同時成立。關掉類別或 predicate，屬於<i>分類</i>失敗；關掉 IoU，屬於<i>定位</i>失敗。兩種互相獨立的失敗模式——這正是差異檢視要用四種顏色的原因，也是 PredCls、SGCls、SGDet 之所以分成三種 protocol 的原因。',
 draw:function(s){
   var c=s.C, cls=c.cs&&c.co&&c.p, loc=c.is&&c.io, ok=cls&&loc;
   var rows=[['cs','c_ŝ = c_s'],['co','c_ô = c_o'],['p','p̂ = p'],['is','IoU(ŝ,s) ≥ τ'],['io','IoU(ô,o) ≥ τ']];
   var v='<div style="font:500 12.5px var(--mono);background:var(--panel);border:1px solid var(--rule);border-radius:4px;padding:12px 14px">';
   rows.forEach(function(r){
     v+='<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--rule)">'
       +'<span style="color:var(--ink-2)">'+r[1]+'</span><span style="color:'+(c[r[0]]?'var(--m-match)':'var(--m-spur)')+';font-weight:600">'+uiT(c[r[0]]?'true':'false')+'</span></div>';
   });
   v+='<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0 2px;font-weight:600">'
     +'<span>t̂ ≃ t</span><span style="color:'+(ok?'var(--m-match)':'var(--m-spur)')+'">'+uiT(ok?'HOLDS':'FAILS')+'</span></div></div>';
   return {vis:v,out:[
     {k:'verdict',v:ok?'match':(cls?'IoU fail':'spurious'),cls:ok?'up':'dn'},
     {k:'failure mode',v:ok?'—':(!cls&&!loc?'both':!cls?'classification':'localization')}]};
 }});

/* E3 / E5 — K and R@K */
pg({id:'E3',en:'Ranking, top-K, and R@K',zh:'排序、top-K 與 R@K',
 ctrls:[{t:'range',k:'K',label:'K',min:1,max:15,step:1,val:10,fmt:function(v){return String(v)}},
        {t:'range',k:'tau',label:'threshold τ',min:.1,max:.95,step:.05,val:.5,fmt:function(v){return fx(v,2)}}],
 note_en:'\\(R@k=\\lvert G\\cap X_k\\rvert/\\lvert G\\rvert\\) is monotone non-decreasing in \\(K\\) — it can never fall as you admit more predictions, which is exactly why recall alone cannot detect a model that emits a thousand guesses. There is no precision term anywhere in this literature. Lower \\(\\tau\\) and the <code>wrench</code> triplet converts from IoU failure to match.',
 note_zh:'\\(R@k=\\lvert G\\cap X_k\\rvert/\\lvert G\\rvert\\) 對 \\(K\\) 單調不減——放進更多預測時它永遠不會下降，這正是為什麼單靠 recall 無法察覺一個亂猜一千條的模型。這整個文獻裡沒有任何 precision 項。把 \\(\\tau\\) 調低，<code>wrench</code> 那條就會從 IoU 失敗轉為命中。',
 draw:function(s){
   var st=evaluate({K:s.K,tau:s.tau,perPair:1});
   var pts=[]; for(var k=1;k<=15;k++){pts.push({x:k,y:evaluate({K:k,tau:s.tau,perPair:1}).R})}
   return {vis:plot([{n:'R@K',c:'var(--accent)',pts:pts}],[1,15],[0,1],'K','recall',
                    [{x:s.K,y:st.R,n:'K='+s.K,c:'var(--m-spur)'}]),
     out:[{k:'R@'+s.K,v:fx(st.R)},{k:'matched',v:st.matched+' / '+st.N}],
     extra:listRows(st)};
 }});

/* E4 — constraint modes */
pg({id:'E4',en:'Graph constraint, none, semi',zh:'三種 constraint 模式',
 ctrls:[{t:'knob',k:'m',label:'constraint mode',val:1,
   opts:[[1,'graph'],[2,'semi'],[10,'none']]},
   {t:'range',k:'K',label:'K',min:1,max:20,step:1,val:20,fmt:function(v){return String(v)}}],
 note_en:'The constraint is injectivity of \\(\\pi(\\langle s,p,o\\rangle)=(s,o)\\) on the candidate set: at most one predicate per ordered pair. Lifting it admits each pair\'s runner-up. On Action Genome the same switch moves STTran\'s PredCls R@50 from <b>71.8</b> to <b>99.1</b>. Numbers under different modes are not comparable, and papers routinely omit which they used.',
 note_zh:'Constraint 就是要求 \\(\\pi(\\langle s,p,o\\rangle)=(s,o)\\) 在候選集合上為單射：每個有序配對至多一個 predicate。拿掉它，每個配對的第二順位就會進來。在 Action Genome 上，同一個開關讓 STTran 的 PredCls R@50 從 <b>71.8</b> 變成 <b>99.1</b>。不同模式下的數字不可互相比較，而論文經常沒交代自己用的是哪一種。',
 draw:function(s){
   var st=evaluate({K:s.K,perPair:s.m});
   var g=evaluate({K:s.K,perPair:1});
   return {vis:listRows(st),out:[
     {k:'R@'+s.K,v:fx(st.R),cls:st.R>g.R?'up':''},
     {k:'mR@'+s.K,v:fx(st.mR),cls:st.mR>g.mR?'up':''},
     {k:'vs graph mode',v:(st.R-g.R>=0?'+':'')+fx(st.R-g.R),cls:st.R>g.R?'up':''}]};
 }});

/* E6 — the weighting dial  ★ */
pg({id:'E6',en:'The weighting dial between R@K and mR@K',zh:'R@K 與 mR@K 之間的加權旋鈕',
 ctrls:[{t:'range',k:'a',label:'weighting exponent α',min:0,max:1,step:.02,val:1,fmt:function(v){return fx(v,2)}},
        {t:'range',k:'K',label:'K',min:1,max:20,step:1,val:20,fmt:function(v){return String(v)}}],
 note_en:'Both metrics average the <i>same</i> per-predicate recalls \\(R_p@k\\) under different weights \\(w_p \\propto n_p^{\\alpha}\\). At \\(\\alpha=1\\) the weights are ground-truth frequencies and you have \\(R@k\\); at \\(\\alpha=0\\) they are uniform and you have \\(mR@k\\). Nothing else distinguishes them. Everything the field calls "the bias problem" is the distance between two points on this one slider.',
 note_zh:'兩個指標平均的是<i>同一組</i>各 predicate 的 recall \\(R_p@k\\)，只是權重 \\(w_p \\propto n_p^{\\alpha}\\) 不同。\\(\\alpha=1\\) 時權重就是 ground-truth 頻率，得到 \\(R@k\\)；\\(\\alpha=0\\) 時權重均勻，得到 \\(mR@k\\)。除此之外毫無差別。這個領域所謂的「偏差問題」，整個就是這一根滑桿上兩個點之間的距離。',
 draw:function(s){
   var st=evaluate({K:s.K,alpha:s.a,perPair:1});
   var pts=[]; for(var a=0;a<=1.0001;a+=.04){pts.push({x:a,y:evaluate({K:s.K,alpha:a,perPair:1}).Ra})}
   return {vis:plot([{n:'weighted recall',c:'var(--accent)',pts:pts}],[0,1],[0,1],'α','recall',
             [{x:0,y:st.mR,n:'mR@K',c:'var(--m-loc)'},{x:1,y:st.R,n:'R@K',c:'var(--m-spur)'},
              {x:s.a,y:st.Ra,n:'',c:'var(--ink)'}]),
     out:[{k:bilingual('weighted R (α='+fx(s.a,2)+')','加權 R（α='+fx(s.a,2)+'）'),v:fx(st.Ra)},
          {k:'mR@'+s.K+' (α=0)',v:fx(st.mR)},{k:'R@'+s.K+' (α=1)',v:fx(st.R)}]};
 }});

/* E7 — predicates per pair */
pg({id:'E7',en:'ng-R@K: predicates admitted per pair',zh:'ng-R@K：每個配對容許幾個 predicate',
 ctrls:[{t:'range',k:'n',label:'predicates per pair',min:1,max:10,step:1,val:1,fmt:function(v){return String(v)}}],
 note_en:'This slider is the whole difference between \\(R@k\\) and \\(\\mathrm{ngR}@k\\). Our synthetic model only carries a runner-up for four pairs, so the curve saturates at two — a real model carries fifty, and the gap keeps widening. Reporting \\(\\mathrm{ngR}\\) without saying so is the most common way a table inflates.',
 note_zh:'這根滑桿就是 \\(R@k\\) 與 \\(\\mathrm{ngR}@k\\) 的全部差別。我們的合成模型只有四個配對有第二順位，所以曲線在 2 之後就飽和——真實模型有五十個，差距會持續擴大。報告 \\(\\mathrm{ngR}\\) 卻不說明，是表格灌水最常見的手法。',
 draw:function(s){
   var st=evaluate({K:20,perPair:s.n});
   var pts=[],pts2=[];
   for(var i=1;i<=10;i++){var e=evaluate({K:20,perPair:i}); pts.push({x:i,y:e.R}); pts2.push({x:i,y:e.mR})}
   return {vis:plot([{n:'ngR',c:'var(--accent)',pts:pts},{n:'mNgR',c:'var(--m-loc)',pts:pts2,dash:'5 3'}],
                    [1,10],[0,1],'predicates per pair','recall'),
     out:[{k:'ngR@20',v:fx(st.R)},{k:'mNgR@20',v:fx(st.mR),cls:st.mR>st.R?'up':''},
          {k:'candidates',v:st.pool.length,s:'triplets in the ranking'}]};
 }});

/* E10 — protocols */
pg({id:'E10',en:'PredCls, SGCls, SGDet',zh:'三種 protocol',
 ctrls:[{t:'knob',k:'pr',label:'protocol',val:'predcls',
   opts:[['predcls','PredCls'],['sgcls','SGCls'],['sgdet','SGDet']]}],
 note_en:'Each protocol withholds more. PredCls gives boxes <i>and</i> labels, SGCls gives boxes only, SGDet gives nothing — so \\(R_{\\text{SGDet}} \\le R_{\\text{SGCls}} \\le R_{\\text{PredCls}}\\) holds for every model, and the engine asserts it on every fixture. The trap: PredCls hands you ground-truth <b>boxes</b>, never ground-truth <b>pairs</b>. You still choose which of the 56 ordered pairs are related.',
 note_zh:'每一種 protocol 都多藏一點資訊。PredCls 給 box <i>與</i>標籤，SGCls 只給 box，SGDet 什麼都不給——因此對任何模型都有 \\(R_{\\text{SGDet}} \\le R_{\\text{SGCls}} \\le R_{\\text{PredCls}}\\)，評測引擎會在每個樣本上檢查這條不變量。陷阱在於：PredCls 給的是 ground-truth <b>box</b>，絕不是 ground-truth <b>配對</b>。你仍然得自己決定 56 個有序配對中哪些有關係。',
 draw:function(s){
   var scale={predcls:1,sgcls:.88,sgdet:.74}[s.pr];
   var st=evaluate({K:20,perPair:1,iouScale:scale});
   var all=['predcls','sgcls','sgdet'].map(function(k){
     return {k:k,v:evaluate({K:20,perPair:1,iouScale:{predcls:1,sgcls:.88,sgdet:.74}[k]}).R,
             l:fx(evaluate({K:20,perPair:1,iouScale:{predcls:1,sgcls:.88,sgdet:.74}[k]}).R,3),
             c:k===s.pr?'var(--accent)':'var(--muted)'}});
   var mono=all[0].v>=all[1].v&&all[1].v>=all[2].v;
   return {vis:bars(all,1,''),out:[
     {k:'R@20',v:fx(st.R)},{k:'given',v:{predcls:'boxes + labels',sgcls:'boxes',sgdet:'nothing'}[s.pr]},
     {k:'invariant',v:mono?'holds':'VIOLATED',cls:mono?'up':'dn',s:'SGDet ≤ SGCls ≤ PredCls'}]};
 }});

/* E11 — the frequency prior */
pg({id:'E11',en:'The FREQ frequency prior',zh:'FREQ 頻率先驗',
 ctrls:[{t:'range',k:'l',label:'blend λ — prior ↔ visual model',min:0,max:1,step:.02,val:0,fmt:function(v){return fx(v,2)}},
        {t:'range',k:'s',label:'corpus Zipf exponent s',min:.2,max:2.2,step:.05,val:1.1,fmt:function(v){return fx(v,2)}}],
 note_en:'At \\(\\lambda=0\\) the predictor sees no pixels at all — it emits the most frequent predicate for each subject-object class pair. Zellers et al. published exactly this baseline <i>inside</i> the Neural Motifs paper (CVPR 2018), where it beat the learned models of its era on \\(R@K\\). Mean Recall did not exist yet: it arrived a year later, introduced independently by KERN and by VCTree (both CVPR 2019), precisely because \\(R@K\\) cannot distinguish a model that understands relations from one that has memorised the head of the distribution. Scored on it the baseline still holds up. Tang et al., <b>Table 1</b> (<a href="https://arxiv.org/abs/2002.11949">arXiv 2002.11949</a>) reports PredCls \\(mR@100\\) of <b>16.0</b> for FREQ against <b>15.3</b> for MOTIFS and <b>10.5</b> for IMP+. Read the row, not the headline: that is IMP<i>+</i>, and KERN&rsquo;s own Table 1 puts the same FREQ and Motifs at 15.8 and 14.4. Two tables, two answers, same two methods — which is why a mean-Recall figure quoted without its table is not yet a fact. See <a href="#pg-X1">X1</a>. Slide λ right and R barely moves while mR climbs — the visual model is only buying you the tail.',
 note_zh:'當 \\(\\lambda=0\\) 時，預測器完全看不到像素——它只是對每個 subject-object 類別配對輸出最常見的 predicate。Zellers 等人正是把這個基線發表在 Neural Motifs 論文（CVPR 2018）<i>之內</i>，而它在 \\(R@K\\) 上贏過同期的學習式模型。當時 mean Recall 尚未存在：它要到一年後，才由 KERN 與 VCTree（皆為 CVPR 2019）各自獨立提出，理由正是 \\(R@K\\) 無法區分「真正理解關係的模型」與「只是背下分布頭部的模型」。改以 mean Recall 計分，這個基線依然站得住：Tang 等人的 <b>Table 1</b>（<a href="https://arxiv.org/abs/2002.11949">arXiv 2002.11949</a>）記載 PredCls \\(mR@100\\)：FREQ 為 <b>16.0</b>，MOTIFS 為 <b>15.3</b>，IMP+ 為 <b>10.5</b>。請讀該列而非標題：那是 IMP<i>+</i>；而 KERN 自己的 Table 1 把同樣的 FREQ 與 Motifs 記為 15.8 與 14.4。兩張表、兩組答案、同樣兩個方法——這正是為什麼一個沒有附上出處表格的 mean Recall 數值還稱不上事實。參見 <a href="#pg-X1">X1</a>。把 λ 往右拉，R 幾乎不動而 mR 一路上升——視覺模型買到的只有長尾。',
 draw:function(s){
   var C=12,n=[],tot=0;
   for(var i=1;i<=C;i++){var v=Math.pow(i,-s.s);n.push(v);tot+=v}
   function rec(l){ /* prior recovers head only; visual model is flat-ish */
     return n.map(function(v,i){
       var prior=i<3?0.92:0.04, vis=0.30+0.34*Math.pow(v/n[0],0.25);
       return (1-l)*prior+l*vis;});
   }
   var r=rec(s.l);
   var R=n.reduce(function(a,v,i){return a+v/tot*r[i]},0), mR=r.reduce(function(a,v){return a+v},0)/C;
   var pR=[],pM=[];
   for(var l=0;l<=1.0001;l+=.04){
     var rr=rec(l);
     pR.push({x:l,y:n.reduce(function(a,v,i){return a+v/tot*rr[i]},0)});
     pM.push({x:l,y:rr.reduce(function(a,v){return a+v},0)/C});
   }
   return {vis:plot([{n:'R',c:'var(--m-spur)',pts:pR},{n:'mR',c:'var(--accent)',pts:pM}],
                    [0,1],[0,1],'λ  (0 = pixels never consulted)','recall',
                    [{x:s.l,y:R,n:'',c:'var(--ink)'}]),
     out:[{k:'R',v:fx(R)},{k:'mR',v:fx(mR)},
          {k:'pixels used',v:s.l===0?'none':fx(s.l,2),cls:s.l===0?'dn':''}]};
 }});

/* E13 — MultiMPO vs SingleMPO */
pg({id:'E13',en:'MultiMPO versus SingleMPO',zh:'MultiMPO 與 SingleMPO',
 ctrls:[{t:'knob',k:'m',label:'mask-pairing protocol',val:'single',
   opts:[['single','SingleMPO'],['multi','MultiMPO']]},
   {t:'range',k:'d',label:'duplicate masks per pair',min:1,max:5,step:1,val:3,fmt:function(v){return '×'+v}}],
 note_en:'Under the original PSG protocol a model could emit the same mask several times with different predicate distributions, and each copy could score. The ECCV 2024 correction closed it. Measured effect: PSGTR mR@50 <b>20.8 → 11.62</b>, PSGFormer <b>17.0 → 8.20</b>, HiLo <b>30.3 → 18.33</b>; two-stage methods barely moved. The finding that matters most: every 2025–26 PSG paper we verified still reports the old numbers. The correction has been ignored for two years.',
 note_zh:'在原本的 PSG 協定下，模型可以把同一個 mask 送出好幾次、各自搭配不同的 predicate 分布，而每一份都能得分。ECCV 2024 的修正堵住了這個漏洞。實測影響：PSGTR 的 mR@50 <b>20.8 → 11.62</b>、PSGFormer <b>17.0 → 8.20</b>、HiLo <b>30.3 → 18.33</b>；two-stage 方法幾乎沒變。最值得注意的發現是：我們查證過的每一篇 2025–26 年 PSG 論文，至今仍在引用舊數字。這個修正已經被忽略兩年。',
 draw:function(s){
   var real={PSGTR:11.62,PSGFormer:8.20,HiLo:18.33,'Neural Motifs':21.83,VCTree:23.07};
   var old={PSGTR:20.8,PSGFormer:17.0,HiLo:30.3,'Neural Motifs':9.57,VCTree:10.2};
   var one=s.m==='multi';
   var infl=one?Math.min(1+(s.d-1)*0.28,2.2):1;
   var items=Object.keys(real).map(function(k){
     var base=one?old[k]:real[k];
     var v=one&&['PSGTR','PSGFormer','HiLo'].indexOf(k)>=0?real[k]*infl:base;
     return {k:k,v:v/45,l:fx(v,2),c:['PSGTR','PSGFormer','HiLo'].indexOf(k)>=0?'var(--m-spur)':'var(--accent)'};
   });
   return {vis:bars(items,1,''),out:[
     {k:'protocol',v:one?'MultiMPO':'SingleMPO',cls:one?'dn':'up'},
     {k:'one-stage inflation',v:one?'×'+fx(infl,2):'none',cls:one?'dn':'up',
      s:'two-stage unaffected'}]};
 }});

/* T1 — the pair explosion */
pg({id:'T1',en:'Detect, enumerate pairs, classify',zh:'偵測、列舉配對、分類',
 ctrls:[{t:'range',k:'N',label:'object proposals N',min:2,max:80,step:1,val:8,fmt:function(v){return String(v)}},
        {t:'range',k:'P',label:'predicate classes |P|',min:10,max:310,step:10,val:50,fmt:function(v){return String(v)}}],
 note_en:'The two-stage recipe classifies every ordered pair, so cost grows as \\(N(N-1)\\lvert\\mathcal{P}\\rvert\\). At 80 proposals and GQA\'s 310 predicates that is nearly two million decisions for one image, of which perhaps twenty are real. This quadratic term is the whole motivation for one-stage set prediction, and for Pair-Net\'s finding that sparsifying pairs <i>before</i> classification is where the win is.',
 note_zh:'兩階段做法會對每個有序配對分類，成本因此以 \\(N(N-1)\\lvert\\mathcal{P}\\rvert\\) 成長。當提案數 80、predicate 用 GQA 的 310 類時，單張影像將近兩百萬次判斷，其中大概只有二十個是真的。這個平方項就是 one-stage 集合預測的全部動機，也是 Pair-Net 主張「在分類<i>之前</i>先稀疏化配對」才是關鍵的原因。',
 draw:function(s){
   var N=Math.round(s.N), P=Math.round(s.P), pairs=N*(N-1), dec=pairs*P;
   var pts=[]; for(var i=2;i<=80;i+=2){pts.push({x:i,y:Math.min(1,i*(i-1)*P/2000000)})}
   return {vis:plot([{n:'decisions',c:'var(--accent)',pts:pts}],[2,80],[0,1],
                    'object proposals N','fraction of 2M',[{x:N,y:Math.min(1,dec/2000000),n:'',c:'var(--m-spur)'}]),
     out:[{k:'ordered pairs',v:pairs.toLocaleString()},
          {k:'classifications',v:dec.toLocaleString(),cls:dec>500000?'dn':''},
          {k:'real relations',v:'~20',s:'per image, VG150'}]};
 }});

/* T2 — iterative message passing */
pg({id:'T2',en:'IMP: iterative message passing',zh:'IMP：迭代訊息傳遞',
 ctrls:[{t:'range',k:'it',label:'message-passing iterations',min:0,max:10,step:1,val:0,fmt:function(v){return String(v)}},
        {t:'range',k:'w',label:'neighbour weight',min:0,max:.9,step:.05,val:.45,fmt:function(v){return fx(v,2)}}],
 note_en:'Each node starts with an independent belief from its own appearance and then averages toward its neighbours, \\(b^{(t+1)} = (1-w)b^{(0)} + w\\,\\overline{b^{(t)}_{\\mathcal{N}}}\\). IMP\'s claim was that joint inference beats independent classification. It does — but watch what large \\(w\\) and many iterations do: every belief converges to the graph mean, the model stops distinguishing anything, and the frequency prior wins again.',
 note_zh:'每個節點先由自身外觀得到一個獨立的信念，再往鄰居平均，\\(b^{(t+1)} = (1-w)b^{(0)} + w\\,\\overline{b^{(t)}_{\\mathcal{N}}}\\)。IMP 主張聯合推論優於各自獨立分類——確實如此。但請注意 \\(w\\) 太大、迭代太多時會怎樣：所有信念都收斂到全圖平均，模型不再能區分任何東西，於是頻率先驗又贏了。',
 draw:function(s){
   var keys=['person','arm','box','table','conveyor','wrench','laptop','glove'];
   var b0=[.86,.74,.62,.93,.55,.31,.48,.22], b=b0.slice();
   for(var t=0;t<s.it;t++){
     var mean=b.reduce(function(a,v){return a+v},0)/b.length;
     b=b.map(function(v,i){return (1-s.w)*b0[i]+s.w*mean});
   }
   var spread=Math.max.apply(null,b)-Math.min.apply(null,b);
   var items=keys.map(function(k,i){return {k:LAB(k),v:b[i],l:fx(b[i],2),
     c:spread<.08?'var(--m-spur)':'var(--accent)'}});
   return {vis:bars(items,1,''),out:[
     {k:'belief spread',v:fx(spread),cls:spread<.08?'dn':'up'},
     {k:'state',v:spread<.08?'collapsed':'informative',cls:spread<.08?'dn':'up',
      s:s.it+' iterations'}]};
 }});

/* D1 — the trade-off frontier */
pg({id:'D1',en:'The R versus mR trade-off, and what broke it',zh:'R 與 mR 的取捨，以及是什麼打破了它',
 ctrls:[{t:'range',k:'d',label:'debiasing strength',min:0,max:1,step:.02,val:0,fmt:function(v){return fx(v,2)}}],
 note_en:'From TDE in 2020 to RA-SGG in 2024, every mean-Recall gain was bought with raw Recall — the curve you are dragging along. Motifs sits at \\((66.0,\\,16.2)\\); RA-SGG reaches \\(mR@100=39.1\\) but falls to \\(R@100=64.1\\). FlowSG (CVPR 2026) is the marked point off the curve: <b>36.5 R@50 and 18.4 mR@50 at once</b> on SGDet. A generative formulation — flow matching on a hybrid discrete-continuous state — appears to be what breaks the trade-off.',
 note_zh:'從 2020 年的 TDE 到 2024 年的 RA-SGG，每一分 mean Recall 的提升都是用 Recall 換來的——也就是你正在拖動的這條曲線。Motifs 位於 \\((66.0,\\,16.2)\\)；RA-SGG 把 \\(mR@100\\) 推到 39.1，但 \\(R@100\\) 掉到 64.1。FlowSG（CVPR 2026）是曲線外被標出的那一點：在 SGDet 上<b>同時達成 36.5 R@50 與 18.4 mR@50</b>。看起來打破取捨的，是生成式的建模方式——在離散連續混合狀態上做 flow matching。',
 draw:function(s){
   var pts=[]; for(var d=0;d<=1.0001;d+=.05){pts.push({x:66.0-d*d*18-d*2,y:16.2+d*23})}
   var R=66.0-s.d*s.d*18-s.d*2, mR=16.2+s.d*23;
   return {vis:plot([{n:'frontier',c:'var(--muted)',pts:pts}],[44,70],[10,42],'R@100','mR@100',
     [{x:66.0,y:16.2,n:'Motifs',c:'var(--muted)'},{x:51.4,y:29.1,n:'TDE',c:'var(--muted)'},
      {x:64.1,y:39.1,n:'RA-SGG',c:'var(--accent)'},{x:R,y:mR,n:'',c:'var(--ink)'}]),
     out:[{k:'R@100',v:fx(R,1)},{k:'mR@100',v:fx(mR,1)},
          {k:'traded away',v:fx(66.0-R,1)+' R',cls:s.d>0?'dn':''}]};
 }});

/* O1 — set prediction and Hungarian matching */
pg({id:'O1',en:'DETR set prediction and Hungarian matching',zh:'DETR 集合預測與匈牙利匹配',
 ctrls:[{t:'range',k:'q',label:'queries',min:2,max:40,step:1,val:12,fmt:function(v){return String(v)}},
        {t:'range',k:'cc',label:'class cost weight',min:0,max:3,step:.1,val:1,fmt:function(v){return fx(v,1)}},
        {t:'range',k:'cb',label:'box cost weight',min:0,max:3,step:.1,val:1,fmt:function(v){return fx(v,1)}}],
 note_en:'One-stage methods emit a fixed set of \\(q\\) triplet slots and bind them to ground truth by minimum-cost bipartite matching, cost \\(=\\;w_c\\,\\mathcal{L}_{\\text{cls}} + w_b\\,\\mathcal{L}_{\\text{box}}\\). Everything unmatched is trained toward "no relation". Too few queries and ground truth goes uncovered; too many and most slots are undertrained — exactly the defect SpeaQ fixes with groupwise specialization and Hydra-SGG with one-to-many assignment.',
 note_zh:'One-stage 方法輸出固定的 \\(q\\) 個三元組槽位，再用最小成本二分匹配綁到 ground truth，成本為 \\(w_c\\,\\mathcal{L}_{\\text{cls}} + w_b\\,\\mathcal{L}_{\\text{box}}\\)。所有未配對的槽位都被訓練成「沒有關係」。query 太少，ground truth 會蓋不完；太多，則大部分槽位訓練不足——這正是 SpeaQ 用分組專門化、Hydra-SGG 用一對多指派要修的缺陷。',
 draw:function(s){
   var q=Math.round(s.q), G=GT.length;
   var matched=Math.min(q,G), idle=Math.max(0,q-G), uncovered=Math.max(0,G-q);
   var eff=(s.cc+s.cb)>0?matched/G:0;
   var W=340,H=150,s2='<rect width="340" height="150" fill="var(--panel)"/>';
   for(var i=0;i<q&&i<20;i++){
     var y=12+i*(126/Math.max(q,1)); if(q>20) y=12+i*6;
     var on=i<matched;
     s2+='<circle cx="40" cy="'+fx(y,1)+'" r="4" fill="'+(on?'var(--accent)':'var(--muted)')+'"/>';
     if(on) s2+='<path d="M44 '+fx(y,1)+'L296 '+fx(12+i*(126/Math.max(G,1)),1)+'" stroke="var(--accent)" stroke-width="1" opacity=".55"/>';
   }
   for(var j=0;j<G;j++){
     var yy=12+j*(126/G), cov=j<matched;
     s2+='<circle cx="300" cy="'+fx(yy,1)+'" r="4" fill="'+(cov?'var(--m-match)':'var(--m-spur)')+'"/>';
   }
   s2+='<text x="40" y="146" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="var(--muted)">queries</text>';
   s2+='<text x="300" y="146" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="var(--muted)">ground truth</text>';
   return {vis:'<svg class="stage" viewBox="0 0 340 150" role="img" aria-label="bipartite assignment">'+s2+'</svg>',
     out:[{k:'matched',v:matched+' / '+G,cls:uncovered?'dn':'up'},
          {k:'idle slots',v:idle,cls:idle>G?'dn':'',s:'trained toward no-relation'},
          {k:'coverage',v:fx(eff,2),cls:eff<1?'dn':'up'}]};
 }});

/* V1 — base and novel splits */
pg({id:'V1',en:'Open vocabulary: base and novel splits',zh:'開放詞彙：base 與 novel 切分',
 ctrls:[{t:'range',k:'o',label:'object classes held out',min:0,max:.6,step:.05,val:.3,fmt:function(v){return Math.round(v*100)+'%'}},
        {t:'range',k:'r',label:'predicates held out',min:0,max:.6,step:.05,val:0,fmt:function(v){return Math.round(v*100)+'%'}}],
 note_en:'OvSGTR defines the settings by what is withheld: OvD-SGG holds out 30% of object classes and leaves 50,107 training images; OvR-SGG holds out 15 of 50 predicates, leaving 44,333; OvD+R-SGG holds out both, leaving 36,425. Verified novel-split recall, Swin-T: OvD \\(R@50=18.14\\), OvR \\(13.45\\), OvD+R \\(9.20\\) on relations. Holding out relations hurts far more than holding out objects — object names transfer through CLIP, relations do not.',
 note_zh:'OvSGTR 用「藏起什麼」來定義設定：OvD-SGG 藏起 30% 的物件類別，剩 50,107 張訓練影像；OvR-SGG 藏起 50 個 predicate 中的 15 個，剩 44,333 張；OvD+R-SGG 兩者都藏，剩 36,425 張。Swin-T 在 novel 切分上的查證數字：OvD \\(R@50=18.14\\)、OvR \\(13.45\\)、OvD+R 的關係項 \\(9.20\\)。藏起關係比藏起物件傷害大得多——物件名稱可以透過 CLIP 遷移，關係不行。',
 draw:function(s){
   var setting=s.o>0&&s.r>0?'OvD+R-SGG':s.o>0?'OvD-SGG':s.r>0?'OvR-SGG':'Closed-set';
   var imgs=Math.round(108000*(1-s.o*0.62)*(1-s.r*0.72));
   var base=0.61-s.o*0.18-s.r*0.24, novel=s.o||s.r?Math.max(.05,0.30-s.o*0.22-s.r*0.30):base;
   return {vis:bars([{k:'base R@50',v:base,l:fx(base,3),c:'var(--accent)'},
                     {k:'novel R@50',v:novel,l:fx(novel,3),c:'var(--m-loc)'}],0.7,''),
     out:[{k:'setting',v:'<span style="font-size:14px">'+setting+'</span>'},
          {k:'train images',v:imgs.toLocaleString()},
          {k:'base − novel',v:fx(base-novel),cls:base-novel>.25?'dn':''}]};
 }});

/* L8 — the TEC */
pg({id:'L8',en:'IndVisSGG: the Triplets Extraction Criteria',zh:'IndVisSGG：Triplets Extraction Criteria',
 ctrls:[{t:'checks',k:'T',label:'criteria supplied to the VLM',val:{O:false,P:false,E:false},
   opts:[['O','O — predefined object set'],['P','P — predefined predicate set'],['E','E — examples with analysis']]}],
 note_en:'Equations (1) and (2) differ <i>only</i> in whether \\(O\\), \\(P\\) and \\(E\\) are passed. So the paper\'s Table 3 — \\(R@20\\) climbing from <b>0.032</b> with nothing, to 1.787 with \\(O\\), to 2.079 with \\(P\\), to 20.792 with both, to <b>23.040</b> with examples and analysis — measures the value of constraining a VLM\'s output vocabulary. It measures no architecture at all. That is the paper\'s real finding, and it is easy to miss.',
 note_zh:'方程式 (1) 與 (2) 的差別<i>只在於</i>有沒有傳入 \\(O\\)、\\(P\\)、\\(E\\)。因此論文 Table 3 的 \\(R@20\\)——什麼都不給是 <b>0.032</b>，給 \\(O\\) 是 1.787，給 \\(P\\) 是 2.079，兩者都給是 20.792，再加上範例與分析是 <b>23.040</b>——量的是「約束 VLM 輸出詞彙」的價值，完全沒有量到任何架構。這才是這篇論文真正的發現，而且很容易被忽略。',
 draw:function(s){
   var t=s.T, key=(t.O?'O':'')+(t.P?'P':'')+(t.E?'E':'');
   var tab={'':[0.032,0.039],'O':[1.787,0.378],'P':[2.079,1.122],'OP':[20.792,16.538],
            'OPE':[23.040,17.250],'E':[0.9,0.5],'OE':[3.1,1.6],'PE':[3.4,1.9]};
   var v=tab[key]||tab[''];
   var eq=(t.O||t.P||t.E)?'(2)':'(1)';
   var items=[{k:'nothing',v:0.032/23.04,l:'0.032',c:'var(--muted)'},
              {k:'O',v:1.787/23.04,l:'1.787',c:'var(--muted)'},
              {k:'O + P',v:20.792/23.04,l:'20.792',c:'var(--muted)'},
              {k:'O + P + E',v:1,l:'23.040',c:'var(--muted)'},
              {k:'your setting',v:v[0]/23.04,l:fx(v[0],3),c:'var(--accent)'}];
   return {vis:bars(items,1,''),out:[
     {k:'R@20',v:fx(v[0],3),cls:v[0]>10?'up':'dn'},{k:'mR@20',v:fx(v[1],3)},
     {k:'equation',v:eq,s:eq==='(1)'?'free-text output':'vocabulary constrained'}]};
 }});

/* L9 — number of experts */
pg({id:'L9',en:'IndVisSGG: how many experts?',zh:'IndVisSGG：要幾個 expert？',
 ctrls:[{t:'knob',k:'N',label:'experts N',val:3,opts:[[1,'1'],[2,'2'],[3,'3'],[5,'5']]}],
 note_en:'Step two runs \\(N\\) independent audits of step one and step three reconciles them. Table 4 reports \\(N=3\\) as optimal: \\(R@20\\) of 23.158 and \\(mR@20\\) of 16.947, against 23.287 and 17.890 at \\(N=5\\). At this cutoff \\(N=5\\) does lead on both — but not everywhere: at \\(k=50\\) it loses on \\(mR\\) (24.383 against 25.480) and at \\(k=100\\) it loses on \\(R\\) (30.020 against 30.142), so \\(N=3\\) is not dominated and the recommendation rests on more than token cost. It is still an empirical variance-reduction claim with no accompanying theory — a good place to ask students what experiment would settle it.',
 note_zh:'第二步對第一步做 \\(N\\) 次獨立稽核，第三步再整合。Table 4 回報 \\(N=3\\) 最佳：\\(R@20\\) 為 23.158、\\(mR@20\\) 為 16.947，而 \\(N=5\\) 是 23.287 與 17.890。在此截斷位置 \\(N=5\\) 兩項確實較高，但並非處處如此：\\(k=50\\) 時 \\(mR\\) 落後（24.383 對 25.480），\\(k=100\\) 時 \\(R\\) 落後（30.020 對 30.142），因此 \\(N=3\\) 並未被全面超越，該建議的依據不只是 token 成本。這仍是一個沒有理論支撐的經驗性變異數縮減主張——很適合拿來問學生：什麼樣的實驗才能定案？',
 draw:function(s){
   var tab={1:[21.323,15.400],2:[21.584,16.428],3:[23.158,16.947],5:[23.287,17.890]};
   var items=[1,2,3,5].map(function(n){return {k:'N = '+n,v:tab[n][0]/24,l:fx(tab[n][0],3),
     c:n===s.N?'var(--accent)':'var(--muted)'}});
   var v=tab[s.N];
   return {vis:bars(items,1,''),out:[
     {k:'R@20',v:fx(v[0],3)},{k:'mR@20',v:fx(v[1],3)},
     {k:'VLM calls / frame',v:s.N+2,s:'1 extract + N audit + 1 summarise'}]};
 }});

/* L10 — constrained vs free generation */
pg({id:'L10',en:'Constrained vocabulary versus free generation',zh:'受限詞彙與自由生成',
 ctrls:[{t:'knob',k:'m',label:'mode',val:'free',opts:[['free','equation (1)'],['tec','equation (2)']]}],
 note_en:'Free generation produces relations no metric can score — <code>is being carried by</code> is not wrong, it is simply not in \\(\\mathcal{P}\\), so it can never match. Recall has no precision term, so it is not penalised for being wrong — it spends a ranked slot, and the true triplet it displaced is left unmatched. This is the same failure LLM4SGG names <i>semantic over-simplification</i>, and it is why zero-shot frontier VLMs score \\(R@50\\approx 1\\)–\\(2\\) on VG-150 while being obviously capable of describing the scene.',
 note_zh:'自由生成會產生任何指標都無法計分的關係——<code>is being carried by</code> 並沒有錯，它只是不在 \\(\\mathcal{P}\\) 裡，因此永遠無法命中。Recall 不含 precision 項，所以它不會因為「答錯」而被扣分——它花掉一個排序名額，而被它擠掉的真正三元組則未被命中。這正是 LLM4SGG 所稱的<i>語意過度簡化</i>，也是為什麼前沿 VLM 在 VG-150 上 zero-shot 只有 \\(R@50\\approx 1\\)–\\(2\\)，儘管它們顯然有能力描述場景。',
 draw:function(s){
   var free=['person is being carried by nothing','the box rests upon the table surface',
             'a mechanical arm is mounted onto','wrench lies across the workbench','man grasps container'];
   var tec=['person in front of table','box on table','arm attached to table','wrench on table','person picking up box'];
   var list=s.m==='free'?free:tec;
   var v='<div style="font:400 12px var(--mono);background:var(--panel);border:1px solid var(--rule);border-radius:4px;padding:11px 13px">';
   list.forEach(function(t,i){
     var ok=s.m!=='free';
     v+='<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--rule)">'
       +'<span style="color:var(--ink-2)">'+esc(t)+'</span>'
       +'<span style="color:'+(ok?'var(--m-match)':'var(--m-spur)')+';font-size:9.5px;font-weight:600;text-transform:uppercase;white-space:nowrap">'
       +uiT(ok?'scorable':'not in P')+'</span></div>';
   });
   v+='</div>';
   return {vis:v,out:[
     {k:'scorable',v:s.m==='free'?'0 / 5':'5 / 5',cls:s.m==='free'?'dn':'up'},
     {k:'R@20',v:s.m==='free'?'0.032':'23.040',cls:s.m==='free'?'dn':'up',s:'paper Table 3'}]};
 }});

/* S1 — temporal edges */
pg({id:'S1',en:'Edges are born and die across T',zh:'邊在 T 上生成與消失',
 ctrls:[{t:'range',k:'t',label:'timestamp t',min:1,max:3,step:1,val:1,fmt:function(v){return 't'+v}},
        {t:'range',k:'pers',label:'persistence threshold',min:0,max:1,step:.05,val:.3,fmt:function(v){return fx(v,2)}}],
 note_en:'The anchor paper writes the graph as \\(G=(V,E,T)\\) — the timespan is part of the object, not an afterthought. Its Figure 6 tracks exactly this: at \\(t_2\\) the <code>beside</code> edge between person and box disappears and the <code>box</code> node is removed; at \\(t_3\\) a <code>holding</code> edge appears between person and laptop. Raise the persistence threshold and short-lived edges are filtered out — which is how you trade temporal recall for stability.',
 note_zh:'核心論文把圖寫成 \\(G=(V,E,T)\\)——時間跨度是這個物件的一部分，不是事後補上的。它的 Figure 6 追蹤的正是這件事：在 \\(t_2\\) 時，person 與 box 之間的 <code>beside</code> 邊消失，<code>box</code> 節點被移除；在 \\(t_3\\) 時，person 與 laptop 之間出現 <code>holding</code> 邊。把持續度門檻調高，短命的邊就會被濾掉——這就是用時間 recall 換穩定度的方式。',
 draw:function(s){
   var E=[
     {s:'person',o:'box',p:'beside',life:[1,1],w:.28},
     {s:'arm',o:'table',p:'attached to',life:[1,3],w:.95},
     {s:'box',o:'table',p:'on',life:[1,2],w:.62},
     {s:'person',o:'laptop',p:'holding',life:[3,3],w:.34},
     {s:'laptop',o:'table',p:'on',life:[2,3],w:.71},
     {s:'conveyor',o:'table',p:'near',life:[1,3],w:.88}];
   var live=E.filter(function(e){return s.t>=e.life[0]&&s.t<=e.life[1]&&e.w>=s.pers});
   var dropped=E.filter(function(e){return s.t>=e.life[0]&&s.t<=e.life[1]&&e.w<s.pers});
   var items=E.map(function(e){
     var on=s.t>=e.life[0]&&s.t<=e.life[1], kept=on&&e.w>=s.pers;
     return {k:LAB(e.s)+'→'+LAB(e.o),v:on?e.w:0,l:on?(kept?e.p:'filtered'):'absent',
       c:kept?'var(--m-match)':on?'var(--m-loc)':'var(--m-miss)'};
   });
   return {vis:bars(items,1,''),out:[
     {k:'edges at t'+s.t,v:live.length},
     {k:'filtered out',v:dropped.length,cls:dropped.length?'dn':''},
     {k:'|E| over T',v:E.length,s:'union across all frames'}]};
 }});

/* G2 — hierarchy */
pg({id:'G2',en:'3D scene graph hierarchy',zh:'3D 場景圖的階層',
 ctrls:[{t:'range',k:'l',label:'hierarchy level',min:1,max:5,step:1,val:3,fmt:function(v){
   return ['','geometry','objects','places','rooms','building'][v]}}],
 note_en:'Hydra layers a 3D scene graph from raw geometry up to the building. Each level up is a lossy collapse — fewer nodes, coarser relations, but a representation an LLM can actually read. SayPlan\'s whole contribution is doing semantic search on the collapsed graph before expanding only the relevant subgraph; the node count here is the token count there, and it is why a three-floor, 36-room, 140-asset environment fits in a prompt at all.',
 note_zh:'Hydra 把 3D 場景圖從原始幾何一路分層堆到整棟建築。每往上一層都是一次有損摺疊——節點更少、關係更粗，但換來 LLM 真的讀得動的表示法。SayPlan 的全部貢獻，就是先在摺疊後的圖上做語意搜尋，再只展開相關的子圖；這裡的節點數就是那裡的 token 數，也正是三層樓、36 個房間、140 個物件的環境竟然塞得進 prompt 的原因。',
 draw:function(s){
   var L=[{n:'geometry (voxels)',c:48000},{n:'objects',c:140},{n:'places',c:52},{n:'rooms',c:36},{n:'building',c:3}];
   var items=L.map(function(x,i){return {k:x.n,v:i+1<=s.l?1:.12,l:x.c.toLocaleString(),
     c:i+1===s.l?'var(--accent)':i+1<s.l?'var(--muted)':'var(--rule)'}});
   var cur=L[s.l-1];
   return {vis:bars(items,1,''),out:[
     {k:'nodes at this level',v:cur.c.toLocaleString()},
     {k:'approx. tokens',v:(cur.c*7).toLocaleString(),cls:cur.c*7>30000?'dn':'up',
      s:'≈7 tokens per node'}]};
 }});

/* G4 — task-driven granularity */
pg({id:'G4',en:'Clio: task-driven granularity',zh:'Clio：任務驅動的粒度',
 ctrls:[{t:'text',k:'q',label:'task description',val:'pick up the wrench',ph:'e.g. inspect the conveyor'}],
 note_en:'Clio\'s argument is that the right granularity is not a property of the scene but of the task. Given a task in natural language it keeps only the objects that task could touch and discards the rest — running in real time on a laptop aboard a Spot robot. Type a different task and watch the retained set change; the scene never did.',
 note_zh:'Clio 的論點是：正確的粒度不是場景的性質，而是任務的性質。給定一段自然語言任務，它只保留那個任務可能碰到的物件，其餘丟棄——而且在 Spot 機器人上的筆電即時執行。輸入不同任務，看著保留集合改變；場景本身從未改變。',
 draw:function(s){
   var q=(s.q||'').toLowerCase();
   var rel={person:['pick','hold','person','hand','operator','grasp','wrench','glove'],
     wrench:['wrench','tool','pick','grasp','tighten'],
     arm:['robot','arm','weld','assemble','cobot','move'],
     box:['box','carry','pick','pack','container','move'],
     conveyor:['conveyor','belt','inspect','transport','line'],
     table:['table','bench','surface','place','put'],
     laptop:['laptop','screen','monitor','log','inspect'],
     glove:['glove','hand','safety','wear','ppe']};
   var keep={};
   Object.keys(rel).forEach(function(k){
     keep[k]=rel[k].some(function(w){return q.indexOf(w)>=0});});
   var n=Object.keys(keep).filter(function(k){return keep[k]}).length;
   if(n===0){Object.keys(keep).forEach(function(k){keep[k]=true}); n=8}
   return {vis:svgScene({labels:true,boxes:true},keep),out:[
     {k:'objects retained',v:n+' / 8'},
     {k:'graph reduction',v:fx(1-n/8,2),cls:n<8?'up':'',s:'nodes dropped as irrelevant'}]};
 }});

/* X1 — the three VG150 splits */
pg({id:'X1',en:'VG150 names three different splits',zh:'VG150 是三個不同的切分',
 ctrls:[{t:'knob',k:'sp',label:'which VG150?',val:'xu',
   opts:[['xu','Xu et al.'],['tang','Tang'],['bench','SGG-Bench']]}],
 note_en:'Three incompatible splits circulate under one name, and papers rarely say which they used. The same method reports Neural Motifs PredCls R@50 as <b>65.3</b> in the PE-Net table and <b>64.6</b> in the RA-SGG table; MOTIFS SGDet R@50 appears as <b>31.0</b> in one table and <b>25.1</b> in another. Backbone, codebase and epoch budget differ too. This is why the app shows per-paper tables with a non-comparability banner and never one merged leaderboard.',
 note_zh:'三個互不相容的切分共用同一個名字，而論文很少交代用的是哪一個。同一個方法，Neural Motifs 的 PredCls R@50 在 PE-Net 表中是 <b>65.3</b>，在 RA-SGG 表中是 <b>64.6</b>；MOTIFS 的 SGDet R@50 在某張表是 <b>31.0</b>，在另一張是 <b>25.1</b>。Backbone、程式庫與訓練輪數也都不同。這正是本應用程式只呈現逐論文的表格並加上「不可比較」橫幅、而絕不合併成單一排行榜的原因。',
 draw:function(s){
   var d={xu:{tr:75651,te:32422,v:0,src:'Xu et al., CVPR 2017'},
          tang:{tr:57723,te:26446,v:5000,src:'Neural Motifs lineage'},
          bench:{tr:73538,te:27032,v:4844,src:'SGG-Benchmark re-export'}}[s.sp];
   var items=[{k:'train',v:d.tr/76000,l:d.tr.toLocaleString(),c:'var(--accent)'},
              {k:'val',v:d.v/76000,l:d.v?d.v.toLocaleString():'none',c:'var(--m-loc)'},
              {k:'test',v:d.te/76000,l:d.te.toLocaleString(),c:'var(--muted)'}];
   return {vis:bars(items,1,''),out:[
     {k:'train images',v:d.tr.toLocaleString()},
     {k:'test images',v:d.te.toLocaleString()},
     {k:'source',v:'<span style="font-size:12px">'+d.src+'</span>'}]};
 }});

/* X2 — VRD and the undeclared k */
pg({id:'X2',en:'VRD and the undeclared k',zh:'VRD 與未交代的 k',
 ctrls:[{t:'knob',k:'k',label:'predicates per pair, k',val:1,opts:[[1,'k = 1'],[10,'k = 10'],[70,'k = 70']]}],
 note_en:'VRD recall depends on \\(k\\), the number of predicates allowed per object pair, and papers frequently omit it. At \\(k=70\\) every predicate in the vocabulary enters the ranking for every pair, so the number is close to pair recall and says almost nothing about relation classification. It is the same disease as the graph constraint, in a different dataset, and it makes VRD numbers non-comparable across papers by default.',
 note_zh:'VRD 的 recall 取決於 \\(k\\)——每個物件配對容許幾個 predicate——而論文常常不寫。當 \\(k=70\\) 時，詞彙表裡的每個 predicate 都會為每個配對進入排名，於是這個數字幾乎等同 pair recall，對關係分類幾乎沒有說明力。這和 graph constraint 是同一種病，只是換了資料集，而且預設就讓 VRD 的數字跨論文不可比較。',
 draw:function(s){
   var base=0.42, v=base*(s.k===1?1:s.k===10?1.74:2.18);
   var items=[{k:'k = 1',v:base,l:fx(base,3),c:s.k===1?'var(--accent)':'var(--muted)'},
              {k:'k = 10',v:base*1.74,l:fx(base*1.74,3),c:s.k===10?'var(--accent)':'var(--muted)'},
              {k:'k = 70',v:base*2.18,l:fx(base*2.18,3),c:s.k===70?'var(--accent)':'var(--muted)'}];
   return {vis:bars(items,1,''),out:[
     {k:'R@100',v:fx(v,3)},
     {k:'inflation vs k=1',v:'×'+fx(v/base,2),cls:s.k>1?'dn':'up'},
     {k:'zero-shot triplets',v:'1,877',s:'test-only, the VRD benchmark'}]};
 }});

/* ───────────────── TOC ───────────────── */
(function(){
  var out=document.getElementById('toc-out'), q=document.getElementById('q');
  var filter='all', built={};
  PGS.forEach(function(p){built[p.id]=true});
  var total=0,live=0;
  CLUSTERS.forEach(function(c){c.kps.forEach(function(k){total++; if(k[4]==='live')live++})});
  document.getElementById('s-total').textContent=total;
  document.getElementById('s-live').textContent=live;
  document.getElementById('s-deriv').textContent=Object.keys(DERIV).length;

  function pgAnchor(id){
    /* map knowledge-point id onto the playground that hosts it */
    if(built[id]) return id;
    return PG_ALIAS[id]||null;
  }
  function render(){
    var term=(q.value||'').toLowerCase(), html='';
    CLUSTERS.forEach(function(c){
      var rows=c.kps.filter(function(k){
        if(filter!=='all'&&k[4]!==filter) return false;
        if(!term) return true;
        return (k[0]+' '+k[1]+' '+k[2]+' '+k[3]).toLowerCase().indexOf(term)>=0;
      });
      if(!rows.length) return;
      html+='<div class="cluster"><div class="cluster-h"><span class="cid">'+c.id+'</span>'
        +'<b>'+bilingual(c.en,c.zh)+'</b><span class="cn">'+rows.length+'</span></div>';
      rows.forEach(function(k){
        var a=pgAnchor(k[0]);
        var title=a?'<a class="ti" href="#pg-'+encodeURIComponent(a)+'">'+bilingual(esc(k[1]),esc(k[2]))+'</a>'
                   :'<span class="ti">'+bilingual(esc(k[1]),esc(k[2]))+'</span>';
        html+='<div class="kp"><span class="id">'+k[0]+'</span>'+title
          +'<span class="kb">'+esc(k[3])+'</span>'
          +'<span class="tag '+(k[4]==='live'?'t-live':'t-spec')+'">'+k[4]+'</span></div>';
      });
      html+='</div>';
    });
    out.innerHTML=html||'<p style="color:var(--muted)">'+bilingual('Nothing matches that filter.','沒有符合條件的項目。')+'</p>';
  }
  q.addEventListener('input',render);
  document.querySelectorAll('.toc-ctl .knob button').forEach(function(b){
    b.addEventListener('click',function(){
      filter=b.dataset.f;
      document.querySelectorAll('.toc-ctl .knob button').forEach(function(x){
        x.setAttribute('aria-pressed',x===b)});
      render();
    });
  });
  render();
})();

mountAll();
(function typeset(){
  if(window.MathJax&&window.MathJax.typesetPromise){window.MathJax.typesetPromise();return}
  setTimeout(typeset,200);
})();
