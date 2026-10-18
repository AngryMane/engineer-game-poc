import type {Scenario} from '../engine';
import type {FaultReport} from '../faultReports';
import {shipSystem,PAYLOAD,O2} from './system';

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

const reports:FaultReport[]=[
 {id:'R1',title:'実験中に機器ラックが高温になり、ペイロードが制限運転に入った',from:'運用担当',
  summary:'科学実験を始めてしばらくすると、独立監視の機器ラック温度が40 °Cを超え、その後ペイロードが熱保護で制限運転に入りました。冷却ポンプはその間ずっと「運転中」を報告していました。O₂増産もこの日に行いましたが、始めた時刻は記録していません。',
  runs:[{label:'A',inputs:designerRuns.reproduce}],
  entries:[
   {run:'A',time:9,ids:[PAYLOAD,'mon_temp','rep_pump'],note:'実験運転を指令した直後。'},
   {run:'A',time:34,ids:['mon_temp','rep_pump','rep_o2'],note:'機器ラック温度が40 °Cを超えた。'},
   {run:'A',time:50,ids:['mon_temp','rep_payload','rep_pump'],note:'ペイロードが制限運転に入っている。'},
  ],missing:'O₂増産を始めた時刻と、途中の画面の記録は残っていません。'},
 {id:'R2',title:'同じ実験計画の別の日は問題なかった',from:'運用担当',
  summary:'別の日も同じ時刻に実験運転を始め、同じようにO₂増産も行いました。この日は最後まで温度は正常で、ペイロードも実験運転を続けました。',
  runs:[{label:'B',inputs:designerRuns.control}],
  entries:[
   {run:'B',time:9,ids:[PAYLOAD,'mon_temp','rep_pump'],note:'実験運転を指令した直後。'},
   {run:'B',time:60,ids:['mon_temp','rep_payload','rep_o2'],note:'温度もペイロードも正常。'},
  ],missing:'この日も操作の時刻は一部しか残っていません。'},
 {id:'R3',title:'主バスは両日とも定格付近',from:'電力担当',
  summary:'電力計の記録では、どちらの日も実験中の主バス負荷は定格5.5 kW付近でした。過負荷の記録はありません。生命維持担当からは「O₂の生成量は日によって違ったが、どちらも増産として仕様の範囲内だった」と報告がありました。',
  runs:[{label:'A',inputs:designerRuns.reproduce},{label:'B',inputs:designerRuns.control}],
  entries:[
   {run:'A',time:40,ids:['rep_bus','rep_o2'],note:'R1の日。'},
   {run:'B',time:60,ids:['rep_bus','rep_o2'],note:'R2の日。'},
  ]},
];

const hints=[
 'R1とR2の日で同じなのは何で、違うかもしれないのは何でしょうか。実験運転とO₂増産の順番と間隔を変えた実験を記録して比べましょう。',
 '異常が出る実験で、熱制御を開いて「冷却流量指令」とポンプが実際に流している「冷却液流量」を比べましょう。ポンプの状態報告は何を根拠に「運転中」と言っているでしょうか。',
 '配電を開き、ポンプ電力要求とポンプ給電許可のメッセージ履歴を比べましょう。給電許可が要求より小さくなったのは、どの操作の何tick後でしょうか。',
 '配電の仕様では、冷却ポンプは重要負荷です。ポンプの給電許可がO₂生成装置の割り当ての残りになっていないか、O₂増産を先にした場合と後にした場合で確かめましょう。',
];

export function shipScenario(faulty=true):Scenario{
 const system=structuredClone(shipSystem);
 return {...system,id:faulty?SHIP_SCENARIO_ID:`${SHIP_SCENARIO_ID}-healthy`,
  title:faulty?'宇宙船 / 冷却が足りないのに、ポンプは正常を報告する':'宇宙船 / 故障なし（設計確認用）',description:'宇宙船 · 障害案件',
  symptom:'航行中の船で、科学実験の最中に機器ラックがまれに高温になります。冷却ポンプは「運転中」を報告しています。実験で症状を再現し、船の運用契約（System の仕様）をすべて満たすように運転を正常化してください。',
  briefing:{conditions:'',expected:'',expectedFlow:[],difference:'',firstAction:'まず指令を変えずにRunし、平常時の出力とメッセージを確かめてください。次にレポートの日を実験として再現し、変種を作って比べましょう。'},
  faults:faulty?[{id:'F-pump-class',targetId:'pdu',key:'value',mode:'stuck',startStep:0,parameter:'pumpEssential',severity:0}]:[],
  reports:faulty?structuredClone(reports):[],hints:faulty?hints:[],
  solution:{rootCauseIds:['pdu'],stableSteps:24,causalPath:['O₂増産指令','O₂生成装置の電力要求','配電（ポンプが一般負荷）','ポンプ給電許可の頭打ち','冷却液流量の不足','機器ラック温度の上昇','温度報告','ペイロードの熱保護'],
   explanation:'配電盤に、冷却ポンプが「一般負荷」として登録されていました（仕様では重要負荷）。一般負荷は先着順なので、ポンプが流量を上げる前にO₂増産が始まると、O₂生成装置が主バスの空きを先に確保します。ポンプは指令流量に必要な電力を要求し続けますが、給電許可は1.5 kW（12 L/min）で頭打ちになります。ポンプの状態報告は流量指令を受けているかどうかしか見ないため「運転中」のままです。機器ラックは数十tickかけて40 °Cを超え、温度報告が42 °Cに達するとペイロードが制限運転に入ります。',
   observations:'実験運転の数tick後にO₂増産を始めると再現します。同じ開始で増産だけを遅らせ、ポンプが流量を上げた後にすると再現しません。異常の日はO₂生成量が2 L/minと多く、正常の日は約1.3 L/minです。配電を開くと、ポンプ電力要求3.75 kWに対して給電許可1.5 kWが続いていることを確認できます。温度センサーの報告周期を1にしても直らないため、古い報告は主原因ではありません。',
   misleading:'冷却ポンプの負荷区分を重要負荷（1）に戻すのが直接の修復です。O₂増産時の要求電力を3.5 kW以下にする、冷却の最低流量を20 L/min以上にしてポンプに電力を先に確保させる、といった代替修復も運用契約を満たします。割り当て容量を定格より上げる、熱保護の作動温度を上げる、温度センサーの校正をずらす、ペイロードを止めるといった帳尻合わせは不合格です。'}};
}
export const shipScenarios=[shipScenario(true)];
