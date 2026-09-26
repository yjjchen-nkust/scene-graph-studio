/* Knowledge-point inventory for Scene Graph Studio.
   Fields: [id, en, zh, knobs, status]
   status: 'live' = interactive playground built in this artifact
           'spec' = controls specified, built in the app (Phases 3-7)
   Knob strings are the actual control surface, not a description of one. */

const CLUSTERS = [
  { id:'F', en:'Foundations', zh:'基礎', kps:[
    ['F1','From labels to structure','從標籤到結構','toggle: labels / boxes / relations overlay · slider: annotation density','live'],
    ['F2','The triplet and G=(V,E,T)','三元組與 G=(V,E,T)','click two nodes to add an edge · dropdown: predicate · toggle: directed arrows','live'],
    ['F3','Grounding with boxes; IoU','以 box 定位；IoU','sliders: x, y, w, h of the predicted box · slider: τ · live IoU readout','live'],
    ['F4','Panoptic masks vs boxes','Panoptic mask 與 box 的差別','toggle: box / mask · slider: mask-IoU τ · toggle: fill vs contour','spec'],
    ['F5','The VG layered annotation model','VG 的分層標註模型','toggles: objects / attributes / relations / region descriptions / QA','spec'],
    ['F6','Predicate synonymy has no hierarchy','Predicate 同義詞沒有階層','checkboxes: merge on/above/over/sitting-on · merge man/person/people','live'],
    ['F7','The long-tail predicate distribution','Predicate 的長尾分布','slider: Zipf exponent s · slider: number of classes · slider: head bias','live'],
    ['F8','Directed edges and asymmetry','有向邊與不對稱性','toggle: swap subject and object · watch validity flip','spec'],
  ]},

  { id:'E', en:'Evaluation', zh:'評測', kps:[
    ['E1','The match relation ≃','命中關係 ≃','five independent toggles, one per conjunct of the definition','live'],
    ['E2','Greedy vs maximum bipartite assignment','貪婪匹配與最大二分匹配','toggle: greedy / Hopcroft-Karp · button: generate an adversarial fixture','spec'],
    ['E3','Ranking and top-K','排序與 top-K','slider: K from 1 to 100 · toggle: log scale','live'],
    ['E4','Graph constraint, none, semi','三種 constraint 模式','3-way knob: graph / none / semi','live'],
    ['E5','R@K','R@K','slider: K · live numerator and denominator','live'],
    ['E6','mR@K and the weighting identity','mR@K 與加權恆等式','slider: weighting exponent α, w_p ∝ n_p^α; α=1 gives R, α=0 gives mR','live'],
    ['E7','ng-R@K and mNgR@K','ng-R@K 與 mNgR@K','slider: predicates admitted per pair, 1 to 10','live'],
    ['E8','zR@K, zero-shot recall','zR@K 零樣本 recall','slider: fraction of triplet types held out of training','spec'],
    ['E9','PR@K and the bound R ≤ PR','PR@K 與 R ≤ PR 的界','toggle: ignore predicate · both curves drawn together','spec'],
    ['E10','PredCls / SGCls / SGDet','三種 protocol','3-way knob · monotonicity invariant asserted live','live'],
    ['E11','The FREQ frequency prior','FREQ 頻率先驗','slider: blend λ between co-occurrence prior and visual model','live'],
    ['E12','Missing annotations count as errors','漏標會被算成錯誤','slider: annotation completeness · toggle: Haystack negatives','spec'],
    ['E13','MultiMPO vs SingleMPO','MultiMPO 與 SingleMPO','toggle: protocol · slider: duplicate masks per pair','live'],
    ['E14','Cross-paper non-comparability','跨論文不可比','dropdowns: backbone, codebase, epoch budget · same method, different number','spec'],
    ['E15','Open Images uses another metric family','Open Images 用另一套指標','toggle: R@K vs wmAP_rel / wmAP_phr / score_wtd','spec'],
    ['E16','Calibration and conformal coverage','校準與 conformal 覆蓋','slider: target coverage 1−α · watch set size grow','spec'],
  ]},

  { id:'T', en:'Two-stage methods', zh:'兩階段方法', kps:[
    ['T1','Detect, enumerate pairs, classify','偵測、列舉配對、分類','slider: number of proposals N · readout: N² pair explosion','live'],
    ['T2','IMP: iterative message passing','IMP：迭代訊息傳遞','slider: number of iterations · watch beliefs converge','live'],
    ['T3','Neural Motifs: context + frequency bias','Neural Motifs：脈絡加頻率偏差','slider: frequency-bias strength · toggle: LSTM context on/off','spec'],
    ['T4','VCTree: dynamic tree structure','VCTree：動態樹結構','toggle: chain / fully-connected / learned tree','spec'],
    ['T5','GPS-Net: direction and node priority','GPS-Net：方向與節點優先度','toggles: direction-aware, node-priority · the 22.8 vs 15.2 dispute','spec'],
    ['T6','KERN and BGNN: routing and resampling','KERN 與 BGNN：路由與重採樣','slider: bi-level resampling repeat factor','spec'],
  ]},

  { id:'D', en:'Debiasing', zh:'去偏', kps:[
    ['D1','The R versus mR trade-off curve','R 與 mR 的取捨曲線','slider: debias strength · the frontier plotted, FlowSG marked','live'],
    ['D2','TDE: counterfactual subtraction','TDE：反事實相減','slider: subtraction strength · side-by-side factual and counterfactual','spec'],
    ['D3','Loss-level: CogTree, DLFE, logit adjustment','損失層級：CogTree、DLFE、logit adjustment','slider: logit-adjustment temperature τ','spec'],
    ['D4','Label-level: NICE says the labels are wrong','標籤層級：NICE 說標籤本身有錯','button: relabel noisy positives · watch mR move','spec'],
    ['D5','Data-level: IETrans and ST-SGG','資料層級：IETrans 與 ST-SGG','sliders: internal transfer rate, external transfer rate','spec'],
    ['D6','PE-Net prototypes; RA-SGG partial labels','PE-Net 原型；RA-SGG 部分標註','slider: prototype regularization weight','spec'],
  ]},

  { id:'O', en:'One-stage and transformer', zh:'單階段與 transformer', kps:[
    ['O1','DETR set prediction and Hungarian matching','DETR 集合預測與匈牙利匹配','sliders: number of queries, class cost, box cost · watch assignment redraw','live'],
    ['O2','FCSGG: relation affinity fields','FCSGG：關係親和場','slider: field resolution · vector field drawn','spec'],
    ['O3','RelTR: coupled subject-object queries','RelTR：耦合的 subject-object query','slider: number of triplet slots · toggle: attention overlay','spec'],
    ['O4','SGTR: bipartite graph construction','SGTR：二分圖建構','toggle: entity-aware predicate proposals','spec'],
    ['O5','EGTR: relations from decoder attention','EGTR：從 decoder attention 取關係','slider: which decoder layer · attention matrix shown','spec'],
    ['O6','SpeaQ: query specialization','SpeaQ：query 專門化','sliders: number of groups, assignments per ground truth','spec'],
    ['O7','Hydra-SGG: hybrid assignment','Hydra-SGG：混合指派','slider: one-to-many IoU threshold · slider: epoch budget','spec'],
    ['O8','The speed-accuracy frontier','速度與精度的前緣','slider: parameter budget · FPS and mR plotted together','spec'],
  ]},

  { id:'P', en:'Panoptic SGG', zh:'Panoptic SGG', kps:[
    ['P1','Thing versus stuff','Thing 與 stuff','toggle: show stuff classes · watch relation count change','spec'],
    ['P2','PSGTR and PSGFormer','PSGTR 與 PSGFormer','toggle: triplet queries / separate decoders','spec'],
    ['P3','HiLo: high- and low-frequency branches','HiLo：高頻與低頻分支','slider: branch fusion weight','spec'],
    ['P4','Pair-Net: pair recall is the bottleneck','Pair-Net：瓶頸在配對 recall','slider: pair sparsification threshold · PR and R together','spec'],
  ]},

  { id:'V', en:'Open vocabulary', zh:'開放詞彙', kps:[
    ['V1','Base and novel splits','Base 與 novel 切分','sliders: fraction of object classes held out, fraction of predicates held out','live'],
    ['V2','VS3: inherited visual-semantic space','VS3：繼承的視覺語意空間','text box: type a novel class name · watch detection appear','spec'],
    ['V3','OvSGTR: aligning nodes and edges','OvSGTR：節點與邊同時對齊','toggle: relation-aware pretraining · toggle: knowledge distillation','spec'],
    ['V4','PGSG: generating novel predicate words','PGSG：生成新的 predicate 詞','slider: nucleus sampling p · watch vocabulary diversity','spec'],
    ['V5','Test-set leakage from grounding pretraining','Grounding 預訓練造成的測試集洩漏','toggle: remove the 14,700 clean images · watch scores drop','spec'],
  ]},

  { id:'L', en:'The LLM and VLM era', zh:'LLM 與 VLM 時代', kps:[
    ['L1','Zero-shot collapse on VG-150','VG-150 上的 zero-shot 崩潰','dropdown: model · bar chart against the supervised frontier','spec'],
    ['L2','LLM as annotator: LLM4SGG','LLM 當標註者：LLM4SGG','toggles: semantic over-simplification, low-density alignment','spec'],
    ['L3','GPT4SGG: holistic plus region captions','GPT4SGG：整體加區域描述','toggle: holistic only / regions only / both','spec'],
    ['L4','SVG and ROBIN: relation completion','SVG 與 ROBIN：關係補全','slider: completion aggressiveness · watch density rise','spec'],
    ['L5','VLM as generator; parsing failure','VLM 當生成器；解析失敗','slider: output temperature · failure rate readout','spec'],
    ['L6','RL with a graph-shaped reward','以圖為形式的 reward 做 RL','sliders: node reward, edge reward, format reward weights','spec'],
    ['L7','SaGe: the graph as reasoning substrate','SaGe：圖作為推理基底','toggle: graph in the chain of thought','spec'],
    ['L8','IndVisSGG: the TEC (O, P, E)','IndVisSGG：TEC（O、P、E）','three toggles: O, P, E-and-analysis · reproduces Table 3','live'],
    ['L9','IndVisSGG: N experts','IndVisSGG：N 個 expert','knob: N ∈ {1,2,3,5} · reproduces Table 4','live'],
    ['L10','Constrained vocabulary versus free generation','受限詞彙與自由生成','toggle: equation (1) versus equation (2)','live'],
    ['L11','Verification over generation: CAGE, ReLIC','驗證勝於生成：CAGE、ReLIC','toggle: counterfactual evidence check · CF-Acc readout','spec'],
  ]},

  { id:'S', en:'Video and spatio-temporal', zh:'影片與時空', kps:[
    ['S1','Edges are born and die over T','邊在 T 上生成與消失','slider: timestamp t · slider: edge persistence threshold','live'],
    ['S2','STTran: spatial encoder, temporal decoder','STTran：空間編碼、時間解碼','toggle: temporal decoder on/off','spec'],
    ['S3','Action Genome has three predicate groups','Action Genome 的三組 predicate','toggles: attention (3), spatial (6), contacting (17)','spec'],
    ['S4','Semi-constraint, the third mode','Semi-constraint：第三種模式','3-way knob shared with E4','spec'],
    ['S5','TEMPURA: memory and uncertainty','TEMPURA：記憶與不確定性','slider: memory length · slider: Gaussian mixture components','spec'],
    ['S6','OED: one-stage, tracker-free','OED：單階段、不需追蹤器','toggle: explicit tracker on/off','spec'],
  ]},

  { id:'G', en:'3D and embodied', zh:'3D 與具身', kps:[
    ['G1','3DSSG: point cloud to graph','3DSSG：點雲到圖','slider: point sample rate · toggle: GT segments vs geometric segments','spec'],
    ['G2','Hierarchy: geometry to building','階層：從幾何到建築','slider: hierarchy level, 5 layers','live'],
    ['G3','ConceptGraphs: open vocabulary from 2D','ConceptGraphs：由 2D 得到開放詞彙','text box: query an object by description','spec'],
    ['G4','Clio: task-driven granularity','Clio：任務驅動的粒度','text box: enter a task · watch the graph prune itself','live'],
    ['G5','SayPlan: search over a collapsed graph','SayPlan：在摺疊圖上搜尋','slider: collapse depth · readout: tokens sent to the LLM','spec'],
    ['G6','VLM-MSGraph: multi-hierarchical','VLM-MSGraph：多層級','toggle: high-level planning / low-level geometry','spec'],
  ]},

  { id:'X', en:'Datasets', zh:'資料集', kps:[
    ['X1','VG150 names several releases','VG150 指涉數個發布版本','choose a release · compare it with another · watch the images move between splits','live'],
    ['X2','VRD and the undeclared k','VRD 與未交代的 k','knob: k ∈ {1,10,70}','live'],
    ['X3','PSG: masks, 133 classes, 56 predicates','PSG：mask、133 類、56 predicate','toggle: thing / stuff / both','spec'],
    ['X4','IndoorVG: what merging classes does','IndoorVG：合併類別的效果','shared with F6','spec'],
    ['X5','Haystack: explicit negatives','Haystack：明確的負標註','toggle: enable precision metrics','spec'],
    ['X6','GQA, VrR-VG, SpatialSense, UnRel','GQA、VrR-VG、SpatialSense、UnRel','dropdown: dataset · the same model scored on each','spec'],
    ['X7','The industrial gap that produced ISG','造就 ISG 的工業資料空缺','checklist: which industrial datasets carry relation labels — none do','spec'],
    ['X8','Building a mini-ISG','建立 mini-ISG','annotation surface with VLM draft and hand correction','spec'],
  ]},

  { id:'R', en:'Scene graph as representation', zh:'場景圖作為表示法', kps:[
    ['R1','Conditioning image generation on a graph','以圖為條件生成影像','edit the graph · watch the layout change','spec'],
    ['R2','Measuring relation fidelity in generated images','衡量生成影像的關係保真度','toggle: graph matching / question generation','spec'],
    ['R3','Relation hallucination in VLMs','VLM 的關係幻覺','slider: language-prior strength · hallucination rate readout','spec'],
    ['R4','Compositional benchmarks: ARO, SugarCrepe, VSR','組合性基準：ARO、SugarCrepe、VSR','toggle: shuffle the relation · watch accuracy fall to chance','spec'],
    ['R5','Scene graph RAG and agent memory','場景圖 RAG 與 agent 記憶','slider: retrieval depth in hops','spec'],
    ['R6','Knowledge-graph fusion','與知識圖譜融合','slider: commonsense prior weight','spec'],
    ['R7','HOI detection versus SGG','HOI 偵測與 SGG 的差異','toggle: HICO-DET protocol / VG-150 protocol','spec'],
    ['R8','Driving scene graphs use task metrics','駕駛場景圖用任務指標','toggle: R@K / AUC / driving score','spec'],
    ['R9','Surgical scene graphs use per-relation F1','手術場景圖用逐關係 F1','toggle: R@K / macro-F1','spec'],
  ]},
];
