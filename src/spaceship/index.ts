import type {Scenario} from '../engine';
import type {FaultReport} from '../faultReports';
import {shipSystem,PAYLOAD,O2,RECORD} from './system';

/** New scenario id and save schema: old abstract saves are never converted into a ship world. */
export const SHIP_SCENARIO_ID='ship-cooling-01';
const at=(time:number,id:string,value:number)=>({time,id,value});

/**
 * Designer-only operation sequences (see docs/SPACESHIP_SPOILERS.md). They are used by the reports
 * and tests; the play screen never shows them as steps.
 */
export const designerRuns={
 /** O₂ boost a few ticks after the experiment starts: the bus is taken before the pump ramps up. */
 reproduce:[at(8,PAYLOAD,2),at(10,O2,1)],
 /** Same start, only the boost is later: the pump already holds its power. */
 control:[at(8,PAYLOAD,2),at(30,O2,1)],
 /** Boost first, then the experiment. Fails in every gap. */
 boostFirst:[at(4,O2,1),at(20,PAYLOAD,2)],
};

// Each report is written by the crew member of one role, from the screens in that role's room only.
const dayA=[...designerRuns.reproduce,at(8,RECORD,1)],dayB=[...designerRuns.control,at(8,RECORD,1)];
const reports:FaultReport[]=[
 {id:'R1',title:'実験の途中でペイロードが制限運転に入り、記録が止まった',from:'クルー（科学担当）',
  summary:'実験運転とデータ記録を始めてしばらくすると、ペイロードが熱保護で制限運転に入り、記録済みデータ量が増えなくなりました。この日はO₂増産も行われたと聞いていますが、始めた時刻は知りません。',
  runs:[{label:'A',inputs:dayA}],
  entries:[
   {run:'A',time:9,ids:[PAYLOAD,RECORD,'rep_payload','rep_data'],note:'実験運転と記録を指令した直後。'},
   {run:'A',time:40,ids:['rep_payload','rep_data'],note:'実験運転中で、記録は増えている。'},
   {run:'A',time:60,ids:['rep_payload','rep_data'],note:'制限運転に入り、記録が止まった。'},
  ],missing:'ほかの部屋の表示と操作は、科学ラボからは見えません。'},
 {id:'R2',title:'同じ実験計画の別の日は最後まで実験できた',from:'クルー（科学担当）',
  summary:'別の日も同じ時刻に実験運転とデータ記録を始めました。この日は最後まで実験運転を続けられました。この日もO₂増産があったと聞いています。',
  runs:[{label:'B',inputs:dayB}],
  entries:[
   {run:'B',time:9,ids:[PAYLOAD,RECORD,'rep_payload','rep_data'],note:'実験運転と記録を指令した直後。'},
   {run:'B',time:60,ids:['rep_payload','rep_data'],note:'最後まで実験運転で、記録も増え続けた。'},
  ],missing:'この日も、ほかの部屋の記録は持っていません。'},
 {id:'R3',title:'機器ラックが高温の日も、冷却ポンプは運転中だった',from:'クルー（熱制御担当）',
  summary:'R1の日、機器ラック温度（独立監視）が40 °Cを超えましたが、冷却ポンプはずっと「運転中」でした。冷却液流量は、温度が正常だったR2の日と比べて小さく見えました。',
  runs:[{label:'A',inputs:dayA},{label:'B',inputs:dayB}],
  entries:[
   {run:'A',time:34,ids:['mon_temp','rep_pump','rep_flow'],note:'R1の日。機器ラック温度が40 °Cを超えた。'},
   {run:'B',time:40,ids:['mon_temp','rep_pump','rep_flow'],note:'R2の日。温度は正常。'},
  ]},
 {id:'R4',title:'主バスは両日とも定格付近',from:'クルー（電力担当）',
  summary:'どちらの日も、実験中の主バス負荷は定格5.5 kW付近でした。ピーク表示も5.5 kWを超えていません。過負荷の記録はありません。',
  runs:[{label:'A',inputs:dayA},{label:'B',inputs:dayB}],
  entries:[
   {run:'A',time:40,ids:['rep_bus','rep_peak'],note:'R1の日。'},
   {run:'B',time:60,ids:['rep_bus','rep_peak'],note:'R2の日。'},
  ]},
 {id:'R5',title:'O₂増産はどちらの日も仕様の範囲内',from:'クルー（生命維持担当）',
  summary:'どちらの日もO₂増産を指令しました。生成量は日によって違いましたが、どちらも増産として仕様の範囲内で、タンクも増えていました。増産を始めた時刻は記録していません。',
  runs:[{label:'A',inputs:dayA},{label:'B',inputs:dayB}],
  entries:[
   {run:'A',time:40,ids:[O2,'rep_o2','rep_tank'],note:'R1の日。'},
   {run:'B',time:40,ids:[O2,'rep_o2','rep_tank'],note:'R2の日。'},
  ],missing:'増産を始めた時刻は残っていません。'},
];


const hints=[
 'R1とR2の日で同じなのは何で、違うかもしれないのは何でしょうか。実験運転とO₂増産の順番と間隔を変えた実験を記録して比べましょう。O₂増産は生命維持室の操作卓で指令します。',
 '熱管理室の冷却液流量を、異常が出る実験と出ない実験で比べましょう。冷却ポンプの入力「冷却流量指令」と出力「冷却液流量」も比べましょう。ポンプの状態報告は何を根拠に「運転中」と言っているでしょうか。',
 '配電盤の出力「ポンプ給電許可」と、入力「ポンプ電力要求」を比べましょう。設備を選ぶと、その入力と出力が時系列にも出ます。給電許可が要求より小さくなったのは、どの操作の何tick後でしょうか。',
 '配電盤の説明では、冷却ポンプは重要負荷です。配電盤のプロパティが説明どおりか確かめましょう。O₂増産を先にした場合と後にした場合の給電許可も比べましょう。',
];

export function shipScenario(faulty=true):Scenario{
 const system=structuredClone(shipSystem);
 return {...system,id:faulty?SHIP_SCENARIO_ID:`${SHIP_SCENARIO_ID}-healthy`,
  title:faulty?'宇宙船 / 冷却が足りないのに、ポンプは正常を報告する':'宇宙船 / 故障なし（設計確認用）',description:'宇宙船 · 障害案件',
  symptom:'航行中の船で、科学実験の最中に機器ラックがまれに高温になります。冷却ポンプは「運転中」を報告しています。実験で症状を再現し、船の運用契約（System の仕様）をすべて満たすように運転を正常化してください。',
  briefing:{conditions:'',expected:'',expectedFlow:[],difference:'',firstAction:'まず指令を変えずにRunし、各部屋の表示で平常時の値を確かめてください。表示はその部屋でしか見られず、操作卓もその部屋でしか操作できないので、部屋をクリックして移動します。次にレポートの日を実験として再現し、変種を作って比べましょう。設備をクリックすると、その設備の説明と、入力・出力・プロパティの現在値が見られます。'},
  faults:faulty?[{id:'F-pump-class',targetId:'pdu',key:'value',mode:'stuck',startStep:0,parameter:'pumpEssential',severity:0}]:[],
  reports:faulty?structuredClone(reports):[],hints:faulty?hints:[],
  solution:{rootCauseIds:['pdu'],stableSteps:24,causalPath:['O₂増産指令','O₂生成装置の電力要求','配電（ポンプが一般負荷）','ポンプ給電許可の頭打ち','冷却液流量の不足','機器ラック温度の上昇','温度報告','ペイロードの熱保護'],
   explanation:'配電盤に、冷却ポンプが「一般負荷」として登録されていました（仕様では重要負荷）。一般負荷は先着順なので、ポンプが流量を上げる前にO₂増産が始まると、O₂生成装置が主バスの空きを先に確保します。ポンプは指令流量に必要な電力を要求し続けますが、給電許可は1.5 kW（12 L/min）で頭打ちになります。ポンプの状態報告は流量指令を受けているかどうかしか見ないため「運転中」のままです。機器ラックは数十tickかけて40 °Cを超え、温度報告が42 °Cに達するとペイロードが制限運転に入ります。',
   observations:'実験運転の数tick後にO₂増産を始めると再現します。同じ開始で増産だけを遅らせ、ポンプが流量を上げた後にすると再現しません。異常の日はO₂生成量が2 L/minと多く、正常の日は約1.3 L/minです。配電盤の入力（ポンプ電力要求）と出力（ポンプ給電許可）を見ると、要求3.75 kWに対して許可1.5 kWが続いていることを確認できます。温度センサーの報告周期を1にしても直らないため、古い報告は主原因ではありません。',
   misleading:'冷却ポンプの負荷区分を重要負荷（1）に戻すのが直接の修復です。O₂増産時の要求電力を3.5 kW以下にする、冷却の最低流量を20 L/min以上にしてポンプに電力を先に確保させる、といった代替修復も運用契約を満たします。割り当て容量を定格より上げる、熱保護の作動温度を上げる、温度センサーの校正をずらす、ペイロードを止めるといった帳尻合わせは不合格です。'}};
}
export const shipScenarios=[shipScenario(true)];
