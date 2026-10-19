import type {Scenario} from '../engine';
import type {FaultReport} from '../faultReports';
import {shipSystem,PAYLOAD,O2,RECORD,ROUTE} from './system';

/** New scenario id and save schema: old abstract saves are never converted into a ship world. */
export const SHIP_SCENARIO_ID='ship-cooling-01';
const at=(time:number,id:string,value:number)=>({time,id,value});

/**
 * Designer-only operation sequences (see docs/SPACESHIP_SPOILERS.md). They are used by the reports
 * and tests; the play screen never shows them as steps.
 */
export const designerRuns={
 /** A: O₂ boost a few ticks after the experiment starts: the bus is taken before the pump ramps up. */
 reproduce:[at(8,PAYLOAD,2),at(10,O2,1)],
 /** A's control: same start, only the boost is later: the pump already holds its power. */
 control:[at(8,PAYLOAD,2),at(30,O2,1)],
 /** A also fails when the boost comes first (and, with B, the spark comes first). */
 boostFirst:[at(4,O2,1),at(20,PAYLOAD,2)],
 /** B: a long boost fills the tank, oxygen collects in the bay, the payload start sparks. */
 ventSpark:[at(2,O2,1),at(60,PAYLOAD,2)],
 /** C: a hot route and a long experiment, without any boost. */
 hotRoute:[at(0,ROUTE,2),at(6,PAYLOAD,2)],
};
export type ShipFault='A'|'B'|'C';
/** The three faults of the same production lot. Tests build ships with any subset. */
export const SHIP_FAULTS:Record<ShipFault,{targetId:string;parameter:string;severity:number}>={
 A:{targetId:'pdu',parameter:'pumpEssential',severity:0},
 B:{targetId:'bay_air',parameter:'fan',severity:0.3},
 C:{targetId:'cool_ctrl',parameter:'maxFlow',severity:16},
};


// Three ships of the class exploded on different days. Each report is written by the crew member of one
// role, from the screens and consoles in that role's room only (plus the ship-wide fire alarm).
const rec=(runs:{time:number;id:string;value:number}[])=>[...runs,at(8,RECORD,1)];
const dayA=rec(designerRuns.reproduce),dayB=rec(designerRuns.ventSpark),dayC=rec(designerRuns.hotRoute);
const reports:FaultReport[]=[
 {id:'R1',title:'［3号］実験の途中でペイロードが制限運転に入り、火災警報が鳴った',from:'クルー（科学担当）',
  summary:'カナリア3号で実験運転とデータ記録を始めました。しばらく順調でしたが、ペイロードが熱保護で制限運転に入った直後に火災警報が鳴り、船は爆発しました。この日はO₂増産もあったと聞いていますが、時刻は知りません。',
  runs:[{label:'3号',inputs:dayA}],
  entries:[
   {run:'3号',time:9,ids:[PAYLOAD,RECORD,'rep_payload','rep_data'],note:'実験運転と記録を指令した直後。'},
   {run:'3号',time:40,ids:['rep_payload','rep_data'],note:'記録は順調に増えている。'},
   {run:'3号',time:47,ids:['rep_payload','rep_data','rep_fire'],note:'制限運転に入ってすぐ、火災警報。'},
  ],missing:'ほかの部屋の表示と操作は、科学ラボからは見えません。'},
 {id:'R2',title:'［3号］機器ラックが高温でも、冷却ポンプは運転中だった',from:'クルー（熱制御担当）',
  summary:'カナリア3号では、機器ラック温度（独立監視）が40 °Cを超えて上がり続けました。冷却ポンプはずっと「運転中」で、冷却液流量は12 L/minから増えませんでした。',
  runs:[{label:'3号',inputs:dayA}],
  entries:[
   {run:'3号',time:20,ids:['mon_temp','rep_pump','rep_flow'],note:'温度が上がり始めた。'},
   {run:'3号',time:35,ids:['mon_temp','rep_pump','rep_flow'],note:'40 °Cを超えた。'},
   {run:'3号',time:47,ids:['mon_temp','rep_fire'],note:'火災警報。'},
  ]},
 {id:'R3',title:'［3号］主バスは定格付近だった',from:'クルー（電力担当）',
  summary:'カナリア3号の主バス負荷は、実験中ずっと定格5.5 kW付近でした。ピーク表示も5.5 kWを超えていません。過負荷の記録はありません。',
  runs:[{label:'3号',inputs:dayA}],
  entries:[{run:'3号',time:40,ids:['rep_bus','rep_peak'],note:'定格付近。'}]},
 {id:'R4',title:'［5号］O₂を増産し続けたら、タンクが満杯のままになった',from:'クルー（生命維持担当）',
  summary:'カナリア5号では、出航直後からO₂増産を続けました。タンクは途中で満杯になり、その後もずっと100 %のままでした。生成量は仕様の範囲内です。',
  runs:[{label:'5号',inputs:dayB}],
  entries:[
   {run:'5号',time:20,ids:[O2,'rep_o2','rep_tank'],note:'増産中。タンクが増えている。'},
   {run:'5号',time:40,ids:[O2,'rep_o2','rep_tank'],note:'満杯のまま。'},
  ]},
 {id:'R5',title:'［5号］実験運転を始めた直後に火災警報',from:'クルー（科学担当）',
  summary:'カナリア5号では、出航からしばらく待ってから実験運転を始めました。始めた直後に火災警報が鳴り、数tick後に船は爆発しました。機器ラックはまだ熱くなっていなかったはずです。',
  runs:[{label:'5号',inputs:dayB}],
  entries:[
   {run:'5号',time:55,ids:[PAYLOAD,'rep_payload'],note:'まだ停止中。'},
   {run:'5号',time:64,ids:[PAYLOAD,'rep_payload','rep_fire'],note:'実験運転を始めた直後に火災警報。'},
  ],missing:'実験運転を指令した正確な時刻は残っていません。'},
 {id:'R6',title:'［8号］暑い航路を選んだ',from:'クルー（航法担当）',
  summary:'カナリア8号は、出航時に暑い航路を選びました。放熱ループ温度は22〜26 °C付近でした。',
  runs:[{label:'8号',inputs:dayC}],
  entries:[
   {run:'8号',time:5,ids:[ROUTE,'rep_loop'],note:'暑い航路を選んだ直後。'},
   {run:'8号',time:40,ids:[ROUTE,'rep_loop'],note:'航路は変えていない。'},
  ]},
 {id:'R7',title:'［8号］O₂増産をしていないのに、機器ラックが高温になった',from:'クルー（熱制御担当）',
  summary:'カナリア8号では、O₂増産はしていません。実験運転が始まると機器ラック温度が上がり、冷却液流量は16 L/minより増えませんでした。冷却ポンプはずっと「運転中」でした。',
  runs:[{label:'8号',inputs:dayC}],
  entries:[
   {run:'8号',time:20,ids:['mon_temp','rep_pump','rep_flow'],note:'温度が上がり始めた。'},
   {run:'8号',time:40,ids:['mon_temp','rep_pump','rep_flow'],note:'40 °Cを超えた。流量は変わらない。'},
   {run:'8号',time:50,ids:['mon_temp','rep_fire'],note:'火災警報。'},
  ]},
];

const hints=[
 '3号・5号・8号は、どれも爆発しましたが、火災警報が鳴るまでの経過が違います。1隻ずつ、報告の日の指示書を試験航海で再現してみましょう。',
 '3号と5号では、実験運転とO₂増産の順番が違うかもしれません。順番と間隔だけを変えた指示書で比べましょう。O₂増産は生命維持室、実験運転は科学ラボの操作卓で指令します。',
 '火災の原因は、防災監視の設備パネルで見られます。熱暴走（機器ラックが熱くなりすぎた）か、火花（酸素が多いところでペイロードが起動した）かで、調べる場所が変わります。',
 '冷却液流量が増えない理由は、冷却ポンプの入力（冷却流量指令・ポンプ給電許可）と、冷却制御のプロパティを見ると分かります。3号と8号では、増えない値も理由も違います。',
 '5号の機器ベイの酸素がどこから来て、どこへ出ていくのか、O₂タンクと換気ファンの設備パネルで確かめましょう。',
 '8号は航路だけが違います。航法室で航路を変えた指示書を作り、標準航路と暑い航路で比べましょう。',
];

export function shipScenario(faults:ShipFault[]|boolean=true):Scenario{
 const list:ShipFault[]=faults===true?['A','B','C']:faults===false?[]:faults,faulty=list.length>0;
 const system=structuredClone(shipSystem);
 return {...system,terminal:{nodeId:'hazard',key:'exploded',causeKey:'cause',causes:{1:'機器ベイの熱暴走',2:'機器ベイの酸素への引火'}},id:list.length===3?SHIP_SCENARIO_ID:faulty?`${SHIP_SCENARIO_ID}-${list.join('')}`:`${SHIP_SCENARIO_ID}-healthy`,
  title:faulty?'宇宙船 / カナリア級の連続爆発':'宇宙船 / 故障なし（設計確認用）',description:'宇宙船 · 障害案件',
  symptom:'同型船カナリア級の3号・5号・8号が、別々の日に爆発しました（乗員は全員、脱出ポッドで無事でした）。在庫のカナリア級を試験航海に出して爆発を再現し、原因を突き止めて設定を直してください。運用契約（System の仕様）をすべて満たし、どの指示書でも爆発しなくなれば改修完了です。',
  briefing:{conditions:'',expected:'',expectedFlow:[],difference:'',firstAction:'まず指令を変えずにRunし、各部屋の表示で平常時の値を確かめてください。表示はその部屋でしか見られず、操作卓もその部屋でしか操作できないので、部屋をクリックして移動します。次に報告の日を試験航海として再現し、指示書を書き換えて比べましょう。設備をクリックすると、その設備の説明と、入力・出力・プロパティの現在値が見られます。'},
  faults:list.map(f=>({id:`F-${f}`,key:'value',mode:'stuck' as const,startStep:0,...SHIP_FAULTS[f]})),
  reports:faulty?structuredClone(reports):[],hints:faulty?hints:[],
  solution:{rootCauseIds:['pdu','bay_air','cool_ctrl'],stableSteps:24,causalPath:[],
   explanation:'3つの不具合が同じ製造ロットに入っていました。\n3号：配電盤で、冷却ポンプが重要負荷ではなく一般負荷として登録されていました。一般負荷は先着順なので、実験運転を始めてポンプが流量を上げる前にO₂増産が始まると、O₂生成装置が主バスの空きを先に確保します。ポンプの給電許可は1.5 kW（12 L/min）で頭打ちになり、機器ラックが42 °Cを超えて熱暴走しました。\n5号：機器ベイの換気ファンの排出量が1.5ではなく0.3になっていました。O₂増産を続けてタンクが満杯になると、逃がし弁があふれた酸素を機器ベイへ出し、ファンが追いつかずに酸素がたまりました。そこで実験運転を始めると、起動時の火花で引火しました。\n8号：冷却制御の最大流量が30ではなく16 L/minになっていました。標準航路ではぎりぎり足りますが、暑い航路では冷却が足りず、機器ラックが熱暴走しました。',
   observations:'3号：実験運転の数tick後にO₂増産を始めると再現し、増産を遅らせると起きません。冷却液流量は12 L/minで止まり、ポンプの電力要求3.75 kWに対して給電許可は1.5 kWです。\n5号：O₂増産を長く続けてから実験運転を始めると、始めた直後に火災になります。順番が逆なら起きません。機器ベイの酸素濃度が30 %を超えています。\n8号：暑い航路でだけ起き、O₂増産とは関係ありません。冷却液流量が16 L/minで止まります。',
   misleading:'直接の修理は、冷却ポンプの負荷区分を重要負荷（1）に、換気ファンの排出量を1.5に、冷却制御の最大流量を30に戻すことです。3号は、O₂増産時の要求電力を3.5 kW以下にする、最低流量を20 L/min以上にする修理も認めます（最低流量20は8号の冷却不足も補います）。割り当て容量を定格より上げる、熱保護の作動温度を上げる、温度センサーの校正をずらすといった帳尻合わせは不合格です。'}};
}
export const shipScenarios=[shipScenario(true)];
