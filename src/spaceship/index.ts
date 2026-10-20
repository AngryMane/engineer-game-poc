import type {Scenario} from '../engine';
import type {FaultReport} from '../faultReports';
import {shipSystem,PAYLOAD,O2,RECORD,ROUTE} from './system';

/** New scenario id and save schema: old abstract saves are never converted into a ship world. */
const at=(time:number,id:string,value:number)=>({time,id,value});

/**
 * Designer-only operation sequences (see docs/SPACESHIP_SPOILERS.md). They are used by the reports
 * and tests; the play screen never shows them as steps.
 */
export const designerRuns={
 /** A: 酸素 boost a few ticks after the experiment starts: the bus is taken before the pump ramps up. */
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
const allReports:FaultReport[]=[
 {id:'R1',title:'［3号］実験の途中で実験装置が出力制限に入り、火災警報が鳴った',from:'クルー（実験担当）',
  summary:'カナリア3号で実験運転とデータ記録を始めました。しばらく順調でしたが、実験装置が過熱防止で出力制限に入った直後に火災警報が鳴り、船は爆発しました。この日は酸素の増産もあったと聞いていますが、時刻は知りません。',
  runs:[{label:'3号',inputs:dayA}],
  entries:[
   {run:'3号',time:9,ids:[PAYLOAD,RECORD,'rep_payload','rep_data'],note:'実験運転と記録を指示した直後。'},
   {run:'3号',time:40,ids:['rep_payload','rep_data'],note:'記録は順調に増えている。'},
   {run:'3号',time:47,ids:['rep_payload','rep_data','rep_fire'],note:'出力制限に入ってすぐ、火災警報。'},
  ],missing:'ほかの部屋の表示と操作は、実験室からは見えません。'},
 {id:'R2',title:'［3号］電子機器が高温でも、冷却水ポンプは運転中だった',from:'クルー（冷却担当）',
  summary:'カナリア3号では、電子機器の温度（安全監視用）が40 °Cを超えて上がり続けました。冷却水ポンプはずっと「運転中」で、冷却水の流量は12 L/minから増えませんでした。',
  runs:[{label:'3号',inputs:dayA}],
  entries:[
   {run:'3号',time:20,ids:['mon_temp','rep_pump','rep_flow'],note:'温度が上がり始めた。'},
   {run:'3号',time:35,ids:['mon_temp','rep_pump','rep_flow'],note:'40 °Cを超えた。'},
   {run:'3号',time:47,ids:['mon_temp','rep_fire'],note:'火災警報。'},
  ]},
 {id:'R3',title:'［3号］電気の使用量は上限付近だった',from:'クルー（電力担当）',
  summary:'カナリア3号の電気の使用量は、実験中ずっと上限5.5 kW付近でした。最大値の表示も5.5 kWを超えていません。過負荷の記録はありません。',
  runs:[{label:'3号',inputs:dayA}],
  entries:[{run:'3号',time:40,ids:['rep_bus','rep_peak'],note:'上限付近。'}]},
 {id:'R4',title:'［5号］酸素を増産し続けたら、タンクが満杯のままになった',from:'クルー（生命維持担当）',
  summary:'カナリア5号では、出航直後から酸素の増産を続けました。タンクは途中で満杯になり、その後もずっと100 %のままでした。製造量は仕様の範囲内です。',
  runs:[{label:'5号',inputs:dayB}],
  entries:[
   {run:'5号',time:20,ids:[O2,'rep_o2','rep_tank'],note:'増産中。タンクが増えている。'},
   {run:'5号',time:40,ids:[O2,'rep_o2','rep_tank'],note:'満杯のまま。'},
  ]},
 {id:'R5',title:'［5号］実験運転を始めた直後に火災警報',from:'クルー（実験担当）',
  summary:'カナリア5号では、出航からしばらく待ってから実験運転を始めました。始めた直後に火災警報が鳴り、数tick後に船は爆発しました。電子機器はまだ熱くなっていなかったはずです。',
  runs:[{label:'5号',inputs:dayB}],
  entries:[
   {run:'5号',time:55,ids:[PAYLOAD,'rep_payload'],note:'まだ停止中。'},
   {run:'5号',time:64,ids:[PAYLOAD,'rep_payload','rep_fire'],note:'実験運転を始めた直後に火災警報。'},
  ],missing:'実験運転を指示した正確な時刻は残っていません。'},
 {id:'R6',title:'［8号］暑い航路を選んだ',from:'クルー（操縦担当）',
  summary:'カナリア8号は、出航時に暑い航路を選びました。戻り冷却水の温度は22〜26 °C付近でした。',
  runs:[{label:'8号',inputs:dayC}],
  entries:[
   {run:'8号',time:5,ids:[ROUTE,'rep_loop'],note:'暑い航路を選んだ直後。'},
   {run:'8号',time:40,ids:[ROUTE,'rep_loop'],note:'航路は変えていない。'},
  ]},
 {id:'R7',title:'［8号］酸素の増産をしていないのに、電子機器が高温になった',from:'クルー（冷却担当）',
  summary:'カナリア8号では、酸素の増産はしていません。実験運転が始まると電子機器の温度が上がり、冷却水の流量は16 L/minより増えませんでした。冷却水ポンプはずっと「運転中」でした。',
  runs:[{label:'8号',inputs:dayC}],
  entries:[
   {run:'8号',time:20,ids:['mon_temp','rep_pump','rep_flow'],note:'温度が上がり始めた。'},
   {run:'8号',time:40,ids:['mon_temp','rep_pump','rep_flow'],note:'40 °Cを超えた。流量は変わらない。'},
   {run:'8号',time:50,ids:['mon_temp','rep_fire'],note:'火災警報。'},
  ]},
];

/** Reports of one case, numbered from R1 within the case. */
const pick=(...ids:string[])=>allReports.filter(r=>ids.includes(r.id)).map((r,i)=>({...r,id:`R${i+1}`}));
// The last case: one stock ship with two faults. Two sister ships ran into different days; both overheated.
const dayAC1=rec(designerRuns.reproduce),dayAC2=rec(designerRuns.hotRoute);
const finalReports:FaultReport[]=[
 {id:'R1',title:'［11号］電子機器が高温になり、冷却水の流量が増えなかった',from:'クルー（冷却担当）',
  summary:'カナリア11号では、実験運転が始まると電子機器の温度（安全監視用）が上がり続け、火災警報が鳴って爆発しました。冷却水ポンプはずっと「運転中」で、冷却水の流量は12 L/minから増えませんでした。',
  runs:[{label:'11号',inputs:dayAC1}],
  entries:[
   {run:'11号',time:20,ids:['mon_temp','rep_pump','rep_flow'],note:'温度が上がり始めた。'},
   {run:'11号',time:35,ids:['mon_temp','rep_pump','rep_flow'],note:'40 °Cを超えた。'},
   {run:'11号',time:47,ids:['mon_temp','rep_fire'],note:'火災警報。'},
  ]},
 {id:'R2',title:'［11号］酸素の増産をしていた',from:'クルー（生命維持担当）',
  summary:'カナリア11号では、実験が始まったころに酸素の増産を始めました。製造量は2 L/minで、仕様の範囲内でした。',
  runs:[{label:'11号',inputs:dayAC1}],
  entries:[{run:'11号',time:30,ids:[O2,'rep_o2'],note:'増産中。'}],missing:'増産を始めた正確な時刻は残っていません。'},
 {id:'R3',title:'［12号］電子機器が高温になり、冷却水の流量が増えなかった',from:'クルー（冷却担当）',
  summary:'カナリア12号でも、実験運転が始まると電子機器の温度が上がり、火災警報が鳴って爆発しました。冷却水ポンプはずっと「運転中」で、冷却水の流量は16 L/minから増えませんでした。',
  runs:[{label:'12号',inputs:dayAC2}],
  entries:[
   {run:'12号',time:20,ids:['mon_temp','rep_pump','rep_flow'],note:'温度が上がり始めた。'},
   {run:'12号',time:40,ids:['mon_temp','rep_pump','rep_flow'],note:'40 °Cを超えた。流量は変わらない。'},
   {run:'12号',time:50,ids:['mon_temp','rep_fire'],note:'火災警報。'},
  ]},
 {id:'R4',title:'［12号］暑い航路を選んだ',from:'クルー（操縦担当）',
  summary:'カナリア12号は、出航時に暑い航路を選びました。',
  runs:[{label:'12号',inputs:dayAC2}],
  entries:[{run:'12号',time:5,ids:[ROUTE,'rep_loop'],note:'暑い航路を選んだ直後。'}]},
];

const firstAction='まず指示を変えずにRunし、各部屋の表示で平常時の値を確かめてください。表示はその部屋でしか見られず、操作卓もその部屋でしか操作できないので、部屋をクリックして移動します。次に報告の日を試験航海として再現し、指示書を書き換えて比べましょう。設備をクリックすると、その設備の説明と、入力・出力・プロパティの現在値が見られます。';
const contract='合格基準をすべて満たし、どの指示書でも爆発しなくなれば改修完了です。';
const repairNote='配れる電力の合計を上限より上げる、過熱防止が働く温度を上げる、温度センサーの校正をずらすといった帳尻合わせは不合格です。';
const explain={
 A:'配電盤で、冷却水ポンプが最優先の機器ではなくふつうの機器として登録されていました。ふつうの機器は早い者順なので、実験運転を始めてポンプが流量を上げる前に酸素の増産が始まると、酸素製造装置が船の電気の空きを先に確保します。ポンプの使ってよい電力は1.5 kW（12 L/min）で頭打ちになり、電子機器が42 °Cを超えて過熱による発火しました。',
 B:'電子機器室の換気ファンの強さが1.5ではなく0.3になっていました。酸素の増産を続けてタンクが満杯になると、逃がし弁があふれた酸素を電子機器室へ出し、ファンが追いつかずに酸素がたまりました。そこで実験運転を始めると、起動時の火花で引火しました。',
 C:'冷却調整装置の最大流量が30ではなく16 L/minになっていました。標準航路ではぎりぎり足りますが、暑い航路では冷却が足りず、電子機器が過熱による発火しました。',
};
const observe={
 A:'実験運転の数tick後に酸素の増産を始めると再現し、増産を遅らせると起きません。冷却水の流量は12 L/minで止まり、ポンプの電力申請3.75 kWに対して使ってよい電力は1.5 kWです。',
 B:'酸素の増産を長く続けてから実験運転を始めると、始めた直後に火災になります。順番が逆なら起きません。電子機器室の酸素濃度が30 %を超えています。',
 C:'暑い航路でだけ起き、酸素の増産とは関係ありません。冷却水の流量が16 L/minで止まります。',
};
const repair={
 A:'直接の修理は、冷却水ポンプの優先度を最優先の機器（1）に戻すことです。酸素の増産時に申請する電力を3.5 kW以下にする、冷却の最低流量を20 L/min以上にしてポンプに先に電力を確保させる修理も認めます。',
 B:'直接の修理は、換気ファンの強さを1.5に戻すことです。',
 C:'直接の修理は、冷却調整装置の最大流量を30に戻すことです。24 L/min以上なら暑い航路でも足ります。最低流量を上げても、上限が16のままでは足りません。',
};

/** One fault per case, all on the same ship design. The final case puts two faults on one ship. */
export type ShipCase={id:string;title:string;faults:ShipFault[];symptom:string;reports:FaultReport[];hints:string[];rootCauseIds:string[]};
export const SHIP_CASES:ShipCase[]=[
 {id:'ship-canary-03',title:'宇宙船 / 1. カナリア3号の爆発',faults:['A'],rootCauseIds:['pdu'],reports:pick('R1','R2','R3'),
  symptom:`同型船カナリア級の3号が爆発しました（乗員は全員、脱出ポッドで無事でした）。在庫のカナリア級を試験航海に出して爆発を再現し、原因を突き止めて設定を直してください。${contract}`,
  hints:[
   '3号の報告を、試験航海で再現してみましょう。酸素の増産は生命維持室、実験運転は実験室の操作卓で指示します。',
   '実験運転と酸素の増産の順番と間隔だけを変えた指示書で比べましょう。',
   '火災の原因は、火災監視装置の設備パネルで見られます。冷却水の流量が増えない理由は、冷却水ポンプの入力（冷却水の流量の指示・ポンプが使ってよい電力）を見ると分かります。',
   '配電盤の説明では、冷却水ポンプは最優先の機器です。配電盤のプロパティが説明どおりか確かめましょう。',
  ]},
 {id:'ship-canary-05',title:'宇宙船 / 2. カナリア5号の爆発',faults:['B'],rootCauseIds:['bay_air'],reports:pick('R4','R5'),
  symptom:`カナリア5号が爆発しました（乗員は全員、脱出ポッドで無事でした）。3号とは様子が違います。在庫のカナリア級で再現し、原因を突き止めて設定を直してください。${contract}`,
  hints:[
   '5号の報告を、試験航海で再現してみましょう。酸素の増産を始めた時刻と、実験運転を始めた時刻が手掛かりです。',
   '火災の原因は、火災監視装置の設備パネルで見られます。今回は電子機器が熱くなる前に火災が起きています。',
   '電子機器室の酸素がどこから来て、どこへ出ていくのか、酸素タンクと換気ファンの設備パネルで確かめましょう。',
  ]},
 {id:'ship-canary-08',title:'宇宙船 / 3. カナリア8号の爆発',faults:['C'],rootCauseIds:['cool_ctrl'],reports:pick('R6','R7'),
  symptom:`カナリア8号が爆発しました（乗員は全員、脱出ポッドで無事でした）。この日は酸素の増産をしていません。在庫のカナリア級で再現し、原因を突き止めて設定を直してください。${contract}`,
  hints:[
   '8号の報告を、試験航海で再現してみましょう。航路は操縦室の操作卓で指示します。',
   '標準航路と暑い航路で、ほかの指示を同じにした指示書を比べましょう。',
   '冷却水の流量が増えない理由は、冷却水ポンプの入力（冷却水の流量の指示）と、冷却調整装置のプロパティを見ると分かります。',
  ]},
 {id:'ship-canary-final',title:'宇宙船 / 4. 同じ症状の2隻（不具合は2つ）',faults:['A','C'],rootCauseIds:['pdu','cool_ctrl'],reports:finalReports,
  symptom:`カナリア11号と12号が、どちらも電子機器の過熱で爆発しました。在庫のカナリア級には、不具合が2つ入っていることが分かっています。どちらの報告がどの不具合によるものかを見分け、両方を直してください。${contract}`,
  hints:[
   '11号と12号は、どちらも冷却水の流量が増えずに過熱しています。止まった流量の値と、その日の指示の違いに注目しましょう。',
   '1つ直したら、両方の日の指示書で試験航海をし直しましょう。片方だけ直っても、もう片方は爆発します。',
  ]},
];
const SOLUTION_PATH=['酸素の増産指示','配電盤','ポンプが使ってよい電力','冷却水の流量','電子機器の温度'];
export function caseScenario(c:ShipCase):Scenario{
 const s=shipScenario(c.faults);
 const parts=c.faults.map(f=>({f,label:c.faults.length>1?`${f==='A'?'11号':'12号'}：`:''}));
 return {...s,id:c.id,title:c.title,symptom:c.symptom,reports:structuredClone(c.reports),hints:c.hints,
  solution:{rootCauseIds:c.rootCauseIds,stableSteps:24,causalPath:c.faults.length===1&&c.faults[0]==='A'?SOLUTION_PATH:[],
   explanation:parts.map(p=>p.label+explain[p.f]).join('\n'),observations:parts.map(p=>p.label+observe[p.f]).join('\n'),misleading:parts.map(p=>p.label+repair[p.f]).join('\n')+'\n'+repairNote}};
}
/** Playable cases in order. The first one is where the game starts. */
export const shipScenarios=SHIP_CASES.map(caseScenario);
export const SHIP_SCENARIO_ID=SHIP_CASES[0].id;

/** A ship with any set of faults, for tests and design checks. No reports. */
export function shipScenario(faults:ShipFault[]|boolean=true):Scenario{
 const list:ShipFault[]=faults===true?['A','B','C']:faults===false?[]:faults,faulty=list.length>0;
 const system=structuredClone(shipSystem);
 return {...system,terminal:{nodeId:'hazard',key:'exploded',causeKey:'cause',causes:{1:'電子機器室の過熱による発火',2:'電子機器室の酸素への引火'}},id:faulty?`ship-canary-${list.join('')}`:'ship-canary-healthy',
  title:faulty?`宇宙船 / 不具合 ${list.join('・')}（設計確認用）`:'宇宙船 / 故障なし（設計確認用）',description:'宇宙船 · 障害案件',
  symptom:'',briefing:{conditions:'',expected:'',expectedFlow:[],difference:'',firstAction},
  faults:list.map(f=>({id:`F-${f}`,key:'value',mode:'stuck' as const,startStep:0,...SHIP_FAULTS[f]})),
  reports:[],hints:[],solution:{rootCauseIds:[],stableSteps:24,causalPath:[],explanation:'',observations:'',misleading:''}};
}
