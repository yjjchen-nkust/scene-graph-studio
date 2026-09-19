# mini-ISG

**This is not the ISG dataset.** Read that sentence before anything else in this directory.

## English

`mini-ISG` is **this project's own teaching set**, built with the method described in Wang et al.,
*IndVisSGG* (Advanced Engineering Informatics 65 (2025) 103107), over frames from a publicly
available egocentric video corpus. It is **40 frames at 1280×720**, cut from 20 videos by 20
different participants in IndustReal — about 0.4% of the scale of the authors' set — and it exists
so that a student can see what scene graph annotation costs, not so that anyone can reproduce a
published number.

Four statements, each of which someone will otherwise get wrong:

1. **It is not the authors' ISG.** The ISG dataset described in the paper holds roughly 10,000
   images across 688 object classes and 144 predicate classes. It is **request-only**: it is not
   published for download, and this project does not have it. Nothing here is a copy of it, a
   subset of it, or a substitute for it.

2. **It is built with the paper's method, not with the paper's data.** The object set, the
   predicate dictionary and the three-step drafting pipeline follow §3.1–3.3. The frames and the
   annotations are ours.

3. **`ISG-Bench` on Hugging Face is a different thing entirely.** The name collides and the
   subject matter does not. It is not this set, it is not the authors' set, and a search that
   lands there has landed somewhere else.

4. **The scenes are "industrial-like", which is IndustReal's own word, not "industrial".** The
   frames show a construction-toy assembly bench: two hands, a STEMFIE part set of beams, braces,
   pins, nuts, washers and wheels, and a printed instruction sheet. There is no robot arm, no
   conveyor and no terminal block. The spatial and interaction relations a student annotates here
   are real ones, and the domain is a workbench rather than a production line. A vocabulary
   written for a factory floor does not fit these images, and the lab's `O` and `P` are written
   for what is actually in them.

**Any figure computed on this set is a figure about this set.** Forty frames cannot reproduce a
result measured on ten thousand, and a number from here placed beside one from the paper would be
a comparison of two different experiments. The application keeps published figures in their own
panel for exactly this reason.

Frame provenance and redistribution are settled in `LICENCE.md`, which is a gate rather than a
record: no frame is copied until the finding for its source is written. The annotations are this
project's own work.

## What is in this directory, and what is not

`README.md` and `LICENCE.md` are here. Everything the application reads lives beside the frames:

| File | Holds |
|---|---|
| `data/slices/mini-isg/MANIFEST.json` | per frame: identifier, source video, timestamp, SHA-256, dimensions |
| `data/slices/mini-isg/annotations.json` | the corrected reference set, `provenance.kind = 'user'` |
| `data/slices/mini-isg/images/` | the forty JPEGs, gitignored, carried in the class bundle |
| `data/vlm/transcripts/mini-isg-step1.json` | the drafts L8 shows as the "before" |
| `authoring.json` | the one source both generated files are built from |

`system/backend/scripts/build_mini_isg.py` rebuilds the transcript and the annotations from
`authoring.json`, and a test asserts the files on disk are what it produces. Two hand-maintained
copies of the same forty frames would drift, and the lab's whole subject is the difference between
them.

## How the drafts and the annotations were made

The object set `O_ISG` and the predicate dictionary `P_ISG` in `app/vlm/prompts.py` are written for
what is in these frames. `tightening` and `screwing` are deliberately **absent**: turning a nut
invites both words and neither is in `P`, so a draft that reaches for either scores zero however
well it describes the frame. That is knowledge point L10 put in the data rather than on a slide,
and it is the same device the paper uses when it leaves `taping` out of its own dictionary.

Each frame and the exact step-1 prompt were given to **Claude Opus 5**, and its triplet lines are
recorded verbatim. The call did not travel through the application's provider path, so a graph
replayed from the transcript is marked `reconstructed` and `provider_used` reads `transcript`.

**The same model produced the corrected reference set.** The difference between a draft and the
reference is therefore what one model found on a second, slower look — not a measurement of what a
human annotator finds that a model misses. Across the forty frames that difference is 156 drafted
triplets against 343 after correction, which is a lower bound on the work rather than an estimate
of it. The boxes were placed by eye to roughly 3% of the frame width: enough to teach how IoU
behaves under a bad box, not enough to report a detection figure.

The reference set is **one annotator's reading**, and L8 says so on the page. Where a student
disagrees with it, the frame is the authority and the list is not.

## Two properties of this set that will look like bugs

**The reference set does not score 1.0 against itself under graph constraint.** Thirteen of the
forty frames give R = 0.875 to 0.9 when scored against a perfect copy of themselves; under
`constraint: none` all forty give 1.0. This is the engine behaving correctly and the data saying
something true. In a frame where one hand steadies the assembly while the other works on it, both
`<hand, holding, assembly>` and `<hand, assembling, assembly>` are the case, and graph constraint
keeps one predicate per subject–object pair. Thirteen relations of three hundred and fifty, 3.7%,
are therefore unreachable under that constraint.

They were not annotated away. Deleting a true relation so that a number reads 1.0 is the thing this
project exists to refuse, and the collision is the clearest demonstration available of what the
constraint costs — the two-hands frame is a better example than any figure in the literature,
because the student is looking at the photograph. A test pins the count in both directions.

**The predicate distribution is severely head-heavy**, and deliberately so:

| predicate | count |
|---|---|
| `on` | 178 |
| `attached to` | 55 |
| `holding` | 52 |
| `near` | 27 |
| `assembling` | 21 |
| `reaching for` | 10 |
| `inserted into` | 7 |

`on` is half the set and `inserted into` is 2%. That ratio is not a flaw in the annotation: it is
what a real relation distribution looks like, it is why R and mR disagree, and it is the same shape
L3 is about at Visual Genome scale. A set balanced by hand would have hidden the one property the
course spends a whole lab on.

## 繁體中文

`mini-ISG` 為**本專案自建之教學用資料集**，依 Wang et al. 之 *IndVisSGG*（Advanced Engineering
Informatics 65 (2025) 103107）所述方法，就公開之第一人稱視角影片語料擷取影格建置而成。其規模為
**40 張 1280×720 影格**，取自 IndustReal 中 20 位不同參與者之 20 部影片，約為原作者資料集之
0.4%。其設置目的在於使學員得以體認場景圖標註所需之成本，而非供任何人重現已發表之數值。

以下四點，若不載明必遭誤解：

1. **本資料集並非原作者之 ISG。** 論文所述之 ISG 資料集收錄約 10,000 張影像，含 688 個物件類別
   與 144 個 predicate 類別，且**須經申請方可取得**，並未公開下載，本專案亦未持有。此處所載內容
   既非其副本，亦非其子集，更不足以取代之。

2. **本資料集係依該論文之方法建置，而非使用該論文之資料。** 物件集合、predicate 詞典與三階段
   草擬流程均依循 §3.1–3.3，影格與標註則為本專案所自行製作。

3. **Hugging Face 上之 `ISG-Bench` 與本資料集全然無涉。** 兩者僅名稱偶合，主題並不相同。該資料集
   既非本資料集，亦非原作者之資料集；若檢索至該處，即屬誤入。

4. **場景屬「類工業」（industrial-like），此為 IndustReal 自身之用語，而非「工業」。** 各影格所
   呈現者為組裝玩具之工作檯：雙手、一組 STEMFIE 零件（樑、托板、插銷、螺帽、墊片與輪組），
   以及一份印製之說明書；畫面中並無機械手臂、輸送帶或端子排。學員於此標註之空間與互動關係均屬
   真實，惟其場域為工作檯而非產線。以產線為對象所撰之詞彙表並不適用於此類影像，故本實驗之
   `O` 與 `P` 係依影像實際內容撰寫。

**凡於本資料集上計算所得之數值，均僅為關於本資料集之數值。** 四十張影格無從重現以一萬張影像所
量測之結果；將此處之數值與該論文之數值並列，即為兩項不同實驗之比較。本應用將已發表之數值置於
獨立面板，其理由正在於此。

影格之來源與再散布事宜均載於 `LICENCE.md`。該文件係**閘門而非紀錄**：來源之授權查核結果未經
書面載明者，不得複製任何影格。標註內容為本專案自行製作。

## 本目錄之內容與其所不包含者

本目錄僅置 `README.md` 與 `LICENCE.md`。凡應用程式所讀取者，均與影格併置：

| 檔案 | 內容 |
|---|---|
| `data/slices/mini-isg/MANIFEST.json` | 各影格之識別碼、來源影片、時間戳、SHA-256 與尺寸 |
| `data/slices/mini-isg/annotations.json` | 修正後之參考標註集，`provenance.kind = 'user'` |
| `data/slices/mini-isg/images/` | 四十張 JPEG，已列入 gitignore，隨課堂封包散布 |
| `data/vlm/transcripts/mini-isg-step1.json` | L8 所呈現之「修正前」草稿 |
| `authoring.json` | 上述二份產生檔之唯一來源 |

`system/backend/scripts/build_mini_isg.py` 依 `authoring.json` 重建逐字稿與標註，並有測項驗證
磁碟上之檔案與其產出完全一致。同一組四十張影格若由二份人工維護之檔案分別記載，勢必彼此偏離，
而二者之差異正是本實驗之主題所在。

## 草稿與標註之產生方式

`app/vlm/prompts.py` 中之物件集合 `O_ISG` 與 predicate 詞典 `P_ISG` 係依本資料集影格之實際內容
撰寫。`tightening` 與 `screwing` **刻意未予收錄**：旋緊螺帽一事極易引用此二詞，惟二者均不在 `P`
之內，故凡使用該等詞彙之三元組，無論其對影格之描述如何貼切，得分均為零。此即知識點 L10 之內容，
置於資料之中而非投影片之上；原論文將 `taping` 排除於其詞典之外，用意相同。

各影格連同 step-1 提示詞原文交付 **Claude Opus 5**，其所輸出之三元組逐字記錄於本專案。該次呼叫
並未經由應用程式之 provider 路徑，故據以重播所建之場景圖標記為 `reconstructed`，`provider_used`
亦記為 `transcript`。

**修正後之參考標註集亦由同一模型產生。** 故草稿與參考標註之差異，係同一模型二次審視之結果，
而非人工標註者較模型多發現若干關係之量測值。就四十張影格而言，草稿計 156 條三元組，修正後為
343 條；此數值為工作量之下界，而非其估計值。各框位係以目視方式繪製，誤差約為影格寬度之 3%：
足供講解 IoU 於框位不佳時之行為，惟不足以據此報告任何偵測數值。

參考標註集為**單一標註者之判讀**，L8 頁面亦載明此點。學員判讀若與之有異，應以影格為準，
而非以該清單為準。

## 本資料集之二項特性，易被誤認為程式缺陷

**於 graph constraint 之下，參考標註集與其自身比對所得之 R 並非 1.0。** 四十張影格中有十三張，
以其自身之完整副本比對時，R 介於 0.875 至 0.9 之間；改採 `constraint: none` 則四十張均為 1.0。
此係評估引擎正確運作之結果，亦係資料本身所陳述之事實：於單手扶持組件、另一手進行組裝之影格中，
`<hand, holding, assembly>` 與 `<hand, assembling, assembly>` 二者皆為真，而 graph constraint
就每一 subject–object 配對僅保留一個 predicate。故三百五十條關係中有十三條（3.7%）於該約束
之下無從表達。

上述關係並未予以刪除。為使數值達於 1.0 而刪去為真之關係，正是本專案所拒斥者；且該項衝突正是
說明 graph constraint 代價之最佳實例——雙手影格較文獻中任何示意圖更為明確，蓋學員所面對者為
實際照片。相關測項就此計數之上下二方向均予以固定。

**predicate 之分布明顯偏向頭部類別**，且係刻意如此：

| predicate | 次數 |
|---|---|
| `on` | 178 |
| `attached to` | 55 |
| `holding` | 52 |
| `near` | 27 |
| `assembling` | 21 |
| `reaching for` | 10 |
| `inserted into` | 7 |

`on` 佔全體之半，`inserted into` 僅佔 2%。此一比例並非標註之缺失：真實關係分布本即如此，此亦為
R 與 mR 產生歧異之原因，其形態與 L3 於 Visual Genome 規模下所探討者相同。若以人工方式使各類別
趨於均衡，反而掩蓋了本課程以整整一個實驗所探討之特性。
