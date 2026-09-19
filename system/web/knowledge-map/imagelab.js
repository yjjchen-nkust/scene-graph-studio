/* Image Lab — upload a frame, ground objects, compute a scene graph.
   The predicate predictor here is purely geometric: it reads box coordinates
   and never looks at a pixel. That is the point. Roughly a third of the
   VG150 predicate vocabulary is positional and recoverable this way, which is
   why a model can score respectably on R@K while understanding nothing. */

(function(){
  var root=document.getElementById('imagelab');
  if(!root) return;

  /* predefined object set O, in the anchor paper's industrial vocabulary */
  var VOCAB=['person','robot arm','table','conveyor','box','wrench','laptop','glove',
             'panel','terminal','beam','bolt','cabinet','floor','wall'];
  /* predefined predicate set P (the TEC restriction of equation (2)) */
  var TEC=['on','above','in','near','in front of','attached to'];

  var S={
    img:null, W:680, H:384,
    boxes:[
      {id:1,l:'table',x:90,y:214,w:436,h:112},{id:2,l:'person',x:172,y:62,w:108,h:224},
      {id:3,l:'robot arm',x:336,y:48,w:124,h:172},{id:4,l:'conveyor',x:492,y:180,w:172,h:96},
      {id:5,l:'box',x:252,y:172,w:84,h:62},{id:6,l:'wrench',x:140,y:196,w:62,h:20},
      {id:7,l:'laptop',x:382,y:168,w:88,h:50},{id:8,l:'glove',x:196,y:168,w:40,h:32}
    ],
    next:9, sel:null,
    th:{ox:0.35, sup:0.22, near:0.85, cont:0.62},
    tec:true, drag:null
  };

  /* ── geometry ── */
  function cx(b){return b.x+b.w/2} function cy(b){return b.y+b.h/2}
  function area(b){return b.w*b.h}
  function inter(a,b){
    var ix=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
    var iy=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    return ix*iy;
  }
  function overlapX(a,b){
    var o=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
    return o/Math.max(1,Math.min(a.w,b.w));
  }
  function overlapY(a,b){
    var o=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    return o/Math.max(1,Math.min(a.h,b.h));
  }
  function dist(a,b){
    return Math.hypot(cx(a)-cx(b),cy(a)-cy(b))/Math.sqrt(area(a)+area(b));
  }

  /* ── the predicate rules, in priority order ──
     Exactly one predicate per ordered pair, so the output satisfies the
     graph constraint by construction. */
  function predicate(a,b,t){
    var cont=inter(a,b)/Math.max(1,area(a));
    if(cont>=t.cont) return {p:'in',why:'cont = '+cont.toFixed(2)+' ≥ '+t.cont};
    var ox=overlapX(a,b), gap=Math.abs((a.y+a.h)-b.y)/Math.max(1,a.h);
    if(ox>=t.ox && a.y+a.h<=b.y+t.sup*a.h && gap<=t.sup)
      return {p:'on',why:'ox = '+ox.toFixed(2)+', g = '+gap.toFixed(2)};
    if(ox>=t.ox && a.y+a.h<b.y)
      return {p:'above',why:'ox = '+ox.toFixed(2)+', disjoint in y'};
    var oy=overlapY(a,b);
    if(oy>=t.ox && Math.abs(cx(a)-cx(b))>Math.max(a.w,b.w)*0.4)
      return {p:cx(a)<cx(b)?'left of':'right of',why:'oy = '+oy.toFixed(2)};
    var d=dist(a,b);
    if(d<=t.near) return {p:'near',why:'d = '+d.toFixed(2)+' ≤ '+t.near};
    return null;
  }

  function compute(){
    var out=[], B=S.boxes;
    for(var i=0;i<B.length;i++) for(var j=0;j<B.length;j++){
      if(i===j) continue;
      var r=predicate(B[i],B[j],S.th);
      if(!r) continue;
      if(S.tec && TEC.indexOf(r.p)<0) continue;
      out.push({s:B[i],o:B[j],p:r.p,why:r.why});
    }
    return out;
  }

  /* ── rendering ── */
  function svgInner(trip){
    var s='';
    if(S.img) s+='<image href="'+S.img+'" x="0" y="0" width="'+S.W+'" height="'+S.H+
                 '" preserveAspectRatio="xMidYMid slice"/>';
    else {
      s+='<rect width="'+S.W+'" height="'+S.H+'" fill="var(--sunk)"/>'
       +'<path d="M96 246H520 M108 246V322 M508 246V322" stroke="var(--rule)" stroke-width="2.5" fill="none"/>'
       +'<path d="M352 66L372 140L410 196" stroke="var(--rule)" stroke-width="5" fill="none" stroke-linecap="round"/>'
       +'<circle cx="212" cy="96" r="21" fill="none" stroke="var(--rule)" stroke-width="2"/>'
       +'<path d="M212 120V214 M212 140L246 176 M212 140L182 176" stroke="var(--rule)" stroke-width="2" fill="none"/>';
      for(var q=506;q<=648;q+=24) s+='<circle cx="'+q+'" cy="222" r="9" fill="none" stroke="var(--rule)" stroke-width="1.5"/>';
    }
    /* edges between box centres */
    trip.forEach(function(t){
      s+='<path d="M'+cx(t.s)+' '+cy(t.s)+'L'+cx(t.o)+' '+cy(t.o)+
         '" stroke="var(--accent)" stroke-width="1.1" opacity=".38"/>';
    });
    S.boxes.forEach(function(b){
      var on=S.sel===b.id;
      s+='<rect data-id="'+b.id+'" x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+
         '" fill="'+(on?'var(--accent)':'transparent')+'" fill-opacity="'+(on?.13:0)+
         '" stroke="'+(on?'var(--accent)':'var(--m-match)')+'" stroke-width="'+(on?2.4:1.6)+
         '" rx="1" style="cursor:pointer"/>';
      var ty=b.y-5<12?b.y+14:b.y-5;
      s+='<text x="'+(b.x+1)+'" y="'+ty+'" font-family="IBM Plex Mono,monospace" font-size="11" '
       +'fill="'+(on?'var(--accent)':'var(--m-match)')+'" style="pointer-events:none">'+b.l+'</text>';
    });
    if(S.drag){
      var d=S.drag;
      s+='<rect x="'+Math.min(d.x0,d.x1)+'" y="'+Math.min(d.y0,d.y1)+'" width="'+Math.abs(d.x1-d.x0)+
         '" height="'+Math.abs(d.y1-d.y0)+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="5 4"/>';
    }
    return s;
  }

  function tripletList(trip){
    if(!trip.length) return '<p style="color:var(--muted);font-size:12.5px;margin:0">'
      +(S.boxes.length<2
        ? 'Drag on the image to draw a box, then label it. Two boxes are enough to get a relation.'
        : 'No relation passes the thresholds. Loosen them, or draw boxes that touch.')+'</p>';
    var byPred={};
    trip.forEach(function(t){byPred[t.p]=(byPred[t.p]||0)+1});
    var s='<div style="border:1px solid var(--rule);border-radius:4px;overflow:auto;max-height:290px;background:var(--panel)">';
    trip.slice(0,60).forEach(function(t){
      s+='<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:5px 10px;'
       +'border-bottom:1px solid var(--rule);font:400 11.5px var(--mono)">'
       +'<span>'+t.s.l+' <b style="color:var(--accent);font-weight:500">'+t.p+'</b> '+t.o.l+'</span>'
       +'<span style="color:var(--muted);font-size:10px">'+t.why+'</span></div>';
    });
    return s+'</div>';
  }

  function render(){
    var trip=compute();
    var pairs=S.boxes.length*(S.boxes.length-1);
    var kinds={}; trip.forEach(function(t){kinds[t.p]=(kinds[t.p]||0)+1});
    var kindList=Object.keys(kinds).sort(function(a,b){return kinds[b]-kinds[a]});

    var el=ensureSvg();
    el.setAttribute('viewBox','0 0 '+S.W+' '+S.H);
    el.innerHTML=svgInner(trip);
    root.querySelector('#il-out').innerHTML=
      '<div class="out three">'
      +'<div class="o"><k>objects</k><v>'+S.boxes.length+'</v><s>'+pairs+' ordered pairs</s></div>'
      +'<div class="o"><k>triplets</k><v>'+trip.length+'</v><s>'+(pairs?Math.round(trip.length/pairs*100):0)+'% of pairs</s></div>'
      +'<div class="o"><k>predicates used</k><v>'+kindList.length+'</v><s>'+(kindList.join(', ')||'none')+'</s></div>'
      +'</div>'+tripletList(trip);
  }

  var svgEl=null;
  function ensureSvg(){
    if(svgEl&&svgEl.isConnected) return svgEl;
    var host=root.querySelector('#il-vis');
    host.innerHTML='<svg id="il-svg" viewBox="0 0 '+S.W+' '+S.H+'" style="display:block;'
      +'width:100%;height:auto;background:var(--sunk);border-radius:3px;touch-action:none" '
      +'role="img" aria-label="scene with grounded objects"></svg>';
    svgEl=host.querySelector('#il-svg');
    bindSvg(svgEl);
    return svgEl;
  }

  function bindSvg(el){
    if(!el) return;
    function pt(e){
      var r=el.getBoundingClientRect();
      var t=e.touches&&e.touches[0]?e.touches[0]:e;
      return {x:(t.clientX-r.left)/r.width*S.W, y:(t.clientY-r.top)/r.height*S.H};
    }
    el.addEventListener('pointerdown',function(e){
      var id=e.target.getAttribute&&e.target.getAttribute('data-id');
      if(id){S.sel=+id; syncLabel(); render(); return}
      var p=pt(e); S.drag={x0:p.x,y0:p.y,x1:p.x,y1:p.y};
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove',function(e){
      if(!S.drag) return;
      var p=pt(e); S.drag.x1=p.x; S.drag.y1=p.y; render();
    });
    el.addEventListener('pointerup',function(e){
      if(!S.drag) return;
      var d=S.drag; S.drag=null;
      var w=Math.abs(d.x1-d.x0), h=Math.abs(d.y1-d.y0);
      if(w>12&&h>12){
        S.boxes.push({id:S.next,l:VOCAB[(S.next-1)%VOCAB.length],
          x:Math.min(d.x0,d.x1),y:Math.min(d.y0,d.y1),w:w,h:h});
        S.sel=S.next; S.next++; syncLabel();
      }
      render();
    });
  }

  function syncLabel(){
    var sel=root.querySelector('#il-label');
    var b=S.boxes.filter(function(x){return x.id===S.sel})[0];
    if(sel) sel.value=b?b.l:'';
    var del=root.querySelector('#il-del');
    if(del) del.disabled=!b;
  }

  /* ── controls ── */
  root.innerHTML=
   '<div class="pg" style="margin-bottom:0">'
   +'<div class="pg-h"><span class="id">LAB</span><h3>'
   +'<span lang="en">Image Lab — upload a frame and compute its scene graph</span>'
   +'<span lang="zh">影像實驗室 — 上傳影格並計算它的場景圖</span></h3></div>'
   +'<div class="pg-body"><div class="pg-vis" id="il-vis"></div>'
   +'<div class="pg-side">'
     +'<div class="ctl"><div class="ctl-top"><label for="il-file">'
       +'<span lang="en">your image</span><span lang="zh">你的影像</span></label></div>'
       +'<input type="file" id="il-file" accept="image/*" style="font:400 11.5px var(--mono);color:var(--ink-2)"></div>'
     +'<div class="ctl"><div class="ctl-top"><label for="il-label">'
       +'<span lang="en">label of selected box</span><span lang="zh">所選 box 的標籤</span></label></div>'
       +'<select id="il-label" style="width:100%;font:500 12.5px var(--mono);padding:7px 9px;'
       +'border:1px solid var(--rule);border-radius:4px;background:var(--panel-2);color:var(--ink)">'
       +VOCAB.map(function(v){return '<option>'+v+'</option>'}).join('')+'</select></div>'
     +'<button id="il-del" type="button" style="font:600 11.5px var(--sans);padding:7px 10px;'
       +'border:1px solid var(--rule);border-radius:4px;background:var(--panel-2);color:var(--m-spur);cursor:pointer">'
       +'<span lang="en">delete selected box</span><span lang="zh">刪除所選 box</span></button>'
     +'<div class="ctl"><div class="ctl-top"><label for="il-ox">θ<sub>ox</sub> overlap</label>'
       +'<span class="val" id="il-ox-v">0.35</span></div>'
       +'<input type="range" id="il-ox" min="0" max="1" step="0.01" value="0.35"></div>'
     +'<div class="ctl"><div class="ctl-top"><label for="il-sup">θ<sub>sup</sub> support gap</label>'
       +'<span class="val" id="il-sup-v">0.22</span></div>'
       +'<input type="range" id="il-sup" min="0" max="1" step="0.01" value="0.22"></div>'
     +'<div class="ctl"><div class="ctl-top"><label for="il-near">θ<sub>near</sub> distance</label>'
       +'<span class="val" id="il-near-v">0.85</span></div>'
       +'<input type="range" id="il-near" min="0.05" max="3" step="0.05" value="0.85"></div>'
     +'<div class="ctl"><div class="ctl-top"><label for="il-cont">θ<sub>in</sub> containment</label>'
       +'<span class="val" id="il-cont-v">0.62</span></div>'
       +'<input type="range" id="il-cont" min="0.1" max="1" step="0.01" value="0.62"></div>'
     +'<label class="chk"><input type="checkbox" id="il-tec" checked> '
       +'<span><span lang="en">restrict output to the predicate set <i>P</i> — equation (2)</span>'
       +'<span lang="zh">將輸出限制在 predicate 集合 <i>P</i> 內 — 方程式 (2)</span></span></label>'
     +'<div id="il-out"></div>'
   +'</div></div>'
   +'<div class="pg-math">'
   +'\\[ \\mathrm{ox}_{ij}=\\frac{\\lvert[x_i,x_i+w_i]\\cap[x_j,x_j+w_j]\\rvert}{\\min(w_i,w_j)},'
   +'\\qquad \\mathrm{cont}_{ij}=\\frac{\\lvert b_i\\cap b_j\\rvert}{\\lvert b_i\\rvert},'
   +'\\qquad d_{ij}=\\frac{\\lVert c_i-c_j\\rVert_2}{\\sqrt{A_i+A_j}},'
   +'\\qquad g_{ij}=\\frac{\\lvert (y_i+h_i)-y_j\\rvert}{h_i} \\]'
   +'\\[ \\textsf{in}\\!:\\ \\mathrm{cont}_{ij}\\ge\\theta_{\\text{in}} \\;\\succ\\; '
   +'\\textsf{on}\\!:\\ \\mathrm{ox}_{ij}\\ge\\theta_{\\text{ox}}\\wedge g_{ij}\\le\\theta_{\\text{sup}} \\;\\succ\\; '
   +'\\textsf{above}\\!:\\ \\mathrm{ox}_{ij}\\ge\\theta_{\\text{ox}}\\wedge y_i+h_i<y_j \\;\\succ\\; '
   +'\\textsf{left/right} \\;\\succ\\; \\textsf{near}\\!:\\ d_{ij}\\le\\theta_{\\text{near}} \\]'
   +'</div>'
   +'<div class="pg-note">'
   +'<span lang="en"><b>What to notice.</b> This predictor never reads a pixel. It sees four numbers per box and '
   +'emits a scene graph anyway — because <code>on</code>, <code>above</code>, <code>near</code>, <code>left of</code> '
   +'and <code>in</code> are <i>positional</i>, and roughly a third of the VG150 vocabulary is positional. That is the '
   +'structural reason a model can post a respectable \\(R@K\\) while understanding nothing, and the reason VrR-VG was '
   +'built by deliberately deleting these predicates. Exactly one predicate survives per ordered pair, so the output '
   +'satisfies the graph constraint by construction — compare with E4. Turn the \\(P\\) restriction off and '
   +'<code>left of</code> and <code>right of</code> enter the output &mdash; predicates the criteria deliberately exclude. '
   +'That is equation (1) against equation (2), on your own image. '
   +'Two members of \(P\) never appear: <code>in front of</code> needs depth and <code>attached to</code> needs contact, and four numbers per box carry neither. A criteria set can name a predicate that the evidence cannot decide, which is exactly why step 2 of the paper exists.</span>'
   +'<span lang="zh"><b>該注意什麼。</b>這個預測器從不讀取任何像素。它每個 box 只看到四個數字，卻仍然產生了一張場景圖——'
   +'因為 <code>on</code>、<code>above</code>、<code>near</code>、<code>left of</code>、<code>in</code> 都是<i>位置性</i>的，'
   +'而 VG150 詞彙表大約有三分之一屬於位置性 predicate。這就是為什麼一個什麼都不理解的模型仍能拿到像樣的 \\(R@K\\)，'
   +'也是 VrR-VG 刻意刪掉這些 predicate 才被建立出來的原因。每個有序配對只會留下一個 predicate，因此輸出天生滿足 '
   +'graph constraint——請與 E4 對照。關掉 \\(P\\) 限制，<code>left of</code> 與 <code>right of</code> 就會進入輸出——這是 criteria 刻意排除的 predicate。'
   +'這就是方程式 (1) 與 (2) 之別，發生在你自己的影像上。'
   +'\(P\) 中有兩個成員永遠不會出現：<code>in front of</code> 需要深度資訊，<code>attached to</code> 需要接觸資訊，而每個 box 的四個數字兩者皆不具備。criteria 可以列出證據無法判定的 predicate——這正是論文第二步存在的理由。</span>'
   +'</div></div>';

  /* wire */
  root.querySelector('#il-file').addEventListener('change',function(e){
    var f=e.target.files&&e.target.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(){
      var im=new Image();
      im.onload=function(){
        S.W=680; S.H=Math.round(680*im.height/im.width);
        S.img=r.result;
        S.boxes=[]; S.sel=null; S.next=1;   /* the sample boxes mean nothing on a new frame */
        svgEl=null;                          /* viewBox changed; rebuild the element */
        syncLabel(); render();
      };
      im.src=r.result;
    };
    r.readAsDataURL(f);
  });
  root.querySelector('#il-label').addEventListener('change',function(e){
    var b=S.boxes.filter(function(x){return x.id===S.sel})[0];
    if(b){b.l=e.target.value; render()}
  });
  root.querySelector('#il-del').addEventListener('click',function(){
    S.boxes=S.boxes.filter(function(x){return x.id!==S.sel});
    S.sel=null; syncLabel(); render();
  });
  [['ox','ox'],['sup','sup'],['near','near'],['cont','cont']].forEach(function(k){
    var el=root.querySelector('#il-'+k[0]);
    el.addEventListener('input',function(){
      S.th[k[1]]=parseFloat(el.value);
      root.querySelector('#il-'+k[0]+'-v').textContent=parseFloat(el.value).toFixed(2);
      render();
    });
  });
  root.querySelector('#il-tec').addEventListener('change',function(e){
    S.tec=e.target.checked; render();
  });

  syncLabel();
  render();
})();
