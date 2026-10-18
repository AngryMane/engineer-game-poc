import type {Scenario,ManualInput,Node,Connection,Expr,Intervention,Observation} from '../engine';
import type {ContractExpr,ContractRule,BehaviorCase} from '../contracts';
import type {Hierarchy,Module,ModulePort,ModuleSpec} from '../hierarchy';
import type {SignalDefinition,NodeSignals} from '../signals';
import type {FloorPlan} from '../floorPlan';

/**
 * Vertical slice of a crewed ship: thermal control, life support and power distribution share
 * one 5.5 kW bus. The numbers are game rules, not engineering data; every rule the player needs is
 * published in a module spec. Design notes and the dictionary live in docs/SPACESHIP_DESIGN.md.
 *
 * 1 tick is one control cycle. A message sent at t arrives at t+1, so each hop adds one tick.
 */
const r=(ref:string):Expr=>({ref});
const op=(name:Exclude<Expr,number|{ref:string}>['op'],...args:Expr[]):Expr=>({op:name,args});
const min=(a:Expr,b:Expr)=>op('clamp',a,-1000,b);
const minus=(v:Expr)=>op('multiply',-1,v);

export const signals:SignalDefinition[]=[
 {id:'ops.payloadMode',label:'ペイロード運転指令',valueType:'enum',kind:'command',values:{0:'停止',1:'待機',2:'実験運転'},meaning:'運用担当がペイロードに出す運転モードの指令。'},
 {id:'ops.o2Mode',label:'O₂生成モード指令',valueType:'enum',kind:'command',values:{0:'通常',1:'増産'},meaning:'運用担当が酸素生成装置に出す生成モードの指令。'},
 {id:'thermal.loopTemperature',label:'放熱ループ温度',unit:'°C',valueType:'number',kind:'physical',digits:1,meaning:'放熱器から戻る冷却液の温度。船外環境で揺らぐ。'},
 {id:'thermal.rackTemperature',label:'機器ラック温度',unit:'°C',valueType:'number',kind:'physical',digits:2,meaning:'機器ラックの実際の温度（物理量）。'},
 {id:'thermal.rackTemperatureReport',label:'機器ラック温度',unit:'°C',valueType:'number',kind:'measurement',digits:2,meaning:'温度センサーが報告したラック温度。計測時刻を持つ。'},
 {id:'thermal.flowCommand',label:'冷却流量指令',unit:'L/min',valueType:'number',kind:'command',digits:2,meaning:'冷却制御がポンプに要求する流量。'},
 {id:'thermal.coolantFlow',label:'冷却液流量',unit:'L/min',valueType:'number',kind:'physical',digits:2,meaning:'ポンプが実際に流している冷却液の流量（物理量）。'},
 {id:'thermal.payloadHeat',label:'ペイロード発熱',unit:'kW',valueType:'number',kind:'physical',digits:2,meaning:'ペイロードがラックに加える熱。'},
 {id:'power.pumpRequest',label:'ポンプ電力要求',unit:'kW',valueType:'number',kind:'command',digits:2,meaning:'ポンプが指令流量を出すのに必要な電力の要求。'},
 {id:'power.o2Request',label:'O₂生成装置電力要求',unit:'kW',valueType:'number',kind:'command',digits:2,meaning:'酸素生成装置が生成モードに応じて求める電力。'},
 {id:'power.pumpGrant',label:'ポンプ給電許可',unit:'kW',valueType:'number',kind:'command',digits:2,meaning:'配電盤がポンプに割り当てた電力の上限。'},
 {id:'power.o2Grant',label:'O₂生成装置給電許可',unit:'kW',valueType:'number',kind:'command',digits:2,meaning:'配電盤が酸素生成装置に割り当てた電力の上限。'},
 {id:'power.busLoad',label:'主バス負荷',unit:'kW',valueType:'number',kind:'physical',digits:2,meaning:'配電盤が割り当てた電力の合計（物理量）。'},
 {id:'power.busLoadReport',label:'主バス負荷',unit:'kW',valueType:'number',kind:'measurement',digits:2,meaning:'電力計が報告した主バス負荷。'},
 {id:'life.o2Rate',label:'O₂生成量',unit:'L/min',valueType:'number',kind:'status',digits:2,meaning:'酸素生成装置が報告する現在の生成量。'},
 {id:'thermal.pumpStatus',label:'冷却ポンプ状態',valueType:'enum',kind:'status',values:{0:'停止',1:'運転中'},meaning:'ポンプが運用担当へ送る運転状態の報告。'},
 {id:'payload.status',label:'ペイロード状態',valueType:'enum',kind:'status',values:{0:'停止',1:'待機',2:'実験運転',3:'制限運転（熱保護）'},meaning:'ペイロードが報告する実際の運転状態。'},
];

const node=(id:string,label:string,kind:Node['kind'],trigger:Node['trigger'],initialState:Record<string,number>,parameters:Record<string,number>,update:Record<string,Expr>,sig:NodeSignals,description:string):Node=>
 ({id,label,kind,trigger,initialState,parameters,update,signals:sig,description,ports:[{id:'in',direction:'in'},{id:'value',direction:'out'}],x:0,y:0});
const timer=(period=1):Node['trigger']=>({type:'timer',periodParameter:'interval'});

// Healthy steady state with no payload and normal O₂ generation.
const T0=30,FLOW0=10,PUMP_KW=0.125;
// Essential loads are served first every tick. General loads are first come: each keeps what it
// already holds and only takes capacity that no other general load holds.
const pumpGrant=op('switch',r('param.pumpEssential'),
 min(r('input.pumpRequest'),r('param.capacity')),
 min(r('input.pumpRequest'),op('sum',r('param.capacity'),minus(r('state.o2Grant')))));
const o2Grant=min(r('input.o2Request'),op('sum',r('param.capacity'),minus(pumpGrant)));
const limited=op('switch',op('threshold',r('input.temperature'),r('param.trip')),1,op('switch',op('threshold',r('param.resume'),r('input.temperature')),0,r('state.limited')));
const running=op('threshold',r('input.mode'),2);

export const nodes:Node[]=[
 node('ops_payload','ペイロード運転','input',{type:'manual'},{value:0},{mode:0},{value:r('param.mode')},{out:{value:'ops.payloadMode'}},'運用担当のペイロード運転指令。'),
 node('ops_o2','O₂生成モード','input',{type:'manual'},{value:0},{mode:0},{value:r('param.mode')},{out:{value:'ops.o2Mode'}},'運用担当のO₂生成モード指令。'),
 {...node('loop_temp','放熱ループ温度','input',{type:'random',minInterval:3,maxInterval:7},{value:20},{},{},{out:{value:'thermal.loopTemperature'}},'放熱器から戻る冷却液の温度。船外環境で揺らぎ、操作できない。'),externalInput:{seed:20261018,value:{type:'uniform',min:18,max:22}}},
 node('rack','機器ラック','inner',timer(),{value:T0},{interval:1,baseHeat:1,heatCapacity:0.4,transfer:0.01},
  {value:op('sum',r('state.value'),op('multiply',r('param.heatCapacity'),op('sum',r('param.baseHeat'),r('input.heat'),minus(op('multiply',r('param.transfer'),r('input.flow'),op('sum',r('state.value'),minus(r('input.coolant'))))))))},
  {in:{heat:'thermal.payloadHeat',flow:'thermal.coolantFlow',coolant:'thermal.loopTemperature'},out:{value:'thermal.rackTemperature'}},
  '電子機器とペイロードの熱が加わり、冷却液が熱を運び出す。'),
 node('rack_sensor','ラック温度センサー','inner',timer(),{value:T0},{interval:4,offset:0},{value:op('sum',r('input.temperature'),r('param.offset'))},
  {in:{temperature:'thermal.rackTemperature'},out:{value:'thermal.rackTemperatureReport'},measures:'temperature'},'一定周期でラック温度を計測して報告する。'),
 node('cool_ctrl','冷却制御','inner',timer(),{value:FLOW0},{interval:1,minFlow:10,maxFlow:30,setpoint:30,gain:5},
  {value:op('clamp',op('sum',r('param.minFlow'),op('multiply',r('param.gain'),op('sum',r('input.temperature'),minus(r('param.setpoint'))))),r('param.minFlow'),r('param.maxFlow'))},
  {in:{temperature:'thermal.rackTemperatureReport'},out:{value:'thermal.flowCommand'}},'最後に受け取った温度報告から冷却流量指令を決める。'),
 node('pump','冷却ポンプ','inner',timer(),{value:FLOW0,request:FLOW0*PUMP_KW,status:1},{interval:1,kwPerFlow:PUMP_KW},
  {value:min(r('input.command'),op('multiply',r('input.grant'),1/PUMP_KW)),request:op('multiply',r('input.command'),r('param.kwPerFlow')),status:op('threshold',r('input.command'),1)},
  {in:{command:'thermal.flowCommand',grant:'power.pumpGrant'},out:{value:'thermal.coolantFlow',request:'power.pumpRequest',status:'thermal.pumpStatus'}},'指令流量に必要な電力を要求し、給電許可の範囲で冷却液を流す。'),
 node('pdu','配電盤','inner',timer(),{value:FLOW0*PUMP_KW+1,pumpGrant:FLOW0*PUMP_KW,o2Grant:1},{interval:1,capacity:5.5,pumpEssential:1},
  {value:op('sum',pumpGrant,o2Grant),pumpGrant,o2Grant},
  {in:{pumpRequest:'power.pumpRequest',o2Request:'power.o2Request'},out:{value:'power.busLoad',pumpGrant:'power.pumpGrant',o2Grant:'power.o2Grant'}},'電力要求を受け、主バスの容量の範囲で各機器に給電許可を出す。'),
 node('bus_meter','主バス電力計','inner',timer(),{value:FLOW0*PUMP_KW+1},{interval:2},{value:r('input.load')},
  {in:{load:'power.busLoad'},out:{value:'power.busLoadReport'},measures:'load'},'一定周期で主バス負荷を計測して報告する。'),
 node('o2gen','O₂生成装置','inner',timer(),{value:0.5,request:1},{interval:1,normalPower:1,boostPower:4,yield:0.5},
  {value:op('multiply',r('param.yield'),min(r('input.grant'),r('state.request'))),request:op('switch',r('input.mode'),r('param.boostPower'),r('param.normalPower'))},
  {in:{mode:'ops.o2Mode',grant:'power.o2Grant'},out:{value:'life.o2Rate',request:'power.o2Request'}},'生成モードに応じて電力を要求し、給電許可の電力で酸素を生成する。'),
 node('payload','科学ペイロード','inner',timer(),{value:0,heat:0,limited:0},{interval:1,trip:42,resume:36,fullHeat:2,standbyHeat:0.5},
  {limited,value:op('switch',running,op('switch',limited,3,2),r('input.mode')),heat:op('switch',running,op('switch',limited,r('param.standbyHeat'),r('param.fullHeat')),op('multiply',r('input.mode'),r('param.standbyHeat')))},
  {in:{mode:'ops.payloadMode',temperature:'thermal.rackTemperatureReport'},out:{value:'payload.status',heat:'thermal.payloadHeat'}},'実験運転中に温度報告が上限を超えると、熱保護で制限運転に入る。'),
 node('mon_temp','機器ラック温度（独立監視）','output',{type:'input'},{value:T0},{},{value:r('input.signal')},{in:{signal:'thermal.rackTemperature'}},'安全監視系が直接読むラック温度。'),
 node('rep_payload','ペイロード状態','output',{type:'input'},{value:0},{},{value:r('input.signal')},{in:{signal:'payload.status'}},'ペイロードの状態報告。'),
 node('rep_o2','O₂生成量','output',{type:'input'},{value:0.5},{},{value:r('input.signal')},{in:{signal:'life.o2Rate'}},'酸素生成装置の生成量報告。'),
 node('rep_pump','冷却ポンプ状態','output',{type:'input'},{value:1},{},{value:r('input.signal')},{in:{signal:'thermal.pumpStatus'}},'冷却ポンプの状態報告。'),
 node('rep_bus','主バス負荷','output',{type:'input'},{value:FLOW0*PUMP_KW+1},{},{value:r('input.signal')},{in:{signal:'power.busLoadReport'}},'電力計の主バス負荷報告。'),
];
const unitOf=(signal:string)=>signals.find(d=>d.id===signal)!.unit??'abstract';
const e=(id:string,from:string,to:string,input:string,signal:string,sourceKey?:string):Connection=>({id,from,to,input,enabled:true,kind:'signal',unit:unitOf(signal),signal,...(sourceKey?{sourceKey}:{})});
export const connections:Connection[]=[
 e('c_mode_payload','ops_payload','payload','mode','ops.payloadMode'),
 e('c_mode_o2','ops_o2','o2gen','mode','ops.o2Mode'),
 e('c_loop_rack','loop_temp','rack','coolant','thermal.loopTemperature'),
 e('c_heat','payload','rack','heat','thermal.payloadHeat','heat'),
 e('c_flow','pump','rack','flow','thermal.coolantFlow'),
 e('c_rack_sensor','rack','rack_sensor','temperature','thermal.rackTemperature'),
 e('c_rack_monitor','rack','mon_temp','signal','thermal.rackTemperature'),
 e('c_report_ctrl','rack_sensor','cool_ctrl','temperature','thermal.rackTemperatureReport'),
 e('c_report_payload','rack_sensor','payload','temperature','thermal.rackTemperatureReport'),
 e('c_flow_cmd','cool_ctrl','pump','command','thermal.flowCommand'),
 e('c_pump_req','pump','pdu','pumpRequest','power.pumpRequest','request'),
 e('c_pump_grant','pdu','pump','grant','power.pumpGrant','pumpGrant'),
 e('c_o2_req','o2gen','pdu','o2Request','power.o2Request','request'),
 e('c_o2_grant','pdu','o2gen','grant','power.o2Grant','o2Grant'),
 e('c_bus','pdu','bus_meter','load','power.busLoad'),
 e('c_bus_report','bus_meter','rep_bus','signal','power.busLoadReport'),
 e('c_o2_rate','o2gen','rep_o2','signal','life.o2Rate'),
 e('c_pump_status','pump','rep_pump','signal','thermal.pumpStatus','status'),
 e('c_payload_status','payload','rep_payload','signal','payload.status'),
];

export const PAYLOAD='ops_payload.mode',O2='ops_o2.mode';
export const inputs:ManualInput[]=[
 {id:PAYLOAD,nodeId:'ops_payload',parameter:'mode',label:'ペイロード運転指令',description:'0=停止、1=待機、2=実験運転。',min:0,max:2,step:1,defaultValue:0},
 {id:O2,nodeId:'ops_o2',parameter:'mode',label:'O₂生成モード指令',description:'0=通常、1=増産。',min:0,max:1,step:1,defaultValue:0},
];
for(const n of nodes)if(n.kind==='input'&&!n.externalInput)n.inputParameter='mode';

const edit=(target:string,parameter:string,label:string,min:number,max:number,step:number,description:string):Intervention=>({id:`${target}.${parameter}`,label,target,parameter,min,max,step,defaultValue:nodes.find(n=>n.id===target)!.parameters[parameter],description});
export const interventions:Intervention[]=[
 edit('rack_sensor','interval','報告周期（tick）',1,8,1,'温度を計測して報告する周期。'),
 edit('rack_sensor','offset','校正オフセット（°C）',-5,5,0.5,'報告値に加える補正。'),
 edit('cool_ctrl','minFlow','最低流量（L/min）',0,30,1,'温度が低くても流す流量。'),
 edit('cool_ctrl','maxFlow','最大流量（L/min）',10,40,1,'指令の上限。'),
 edit('cool_ctrl','setpoint','目標温度（°C）',20,40,0.5,'この温度を超えると流量を増やす。'),
 edit('cool_ctrl','gain','制御ゲイン（L/min per °C）',0,10,0.5,'温度差1 °Cあたりに増やす流量。'),
 edit('pdu','capacity','割り当て容量（kW）',3,8,0.5,'配電盤が割り当てに使う容量。主バス定格は5.5 kW。'),
 edit('pdu','pumpEssential','冷却ポンプの負荷区分（1=重要負荷、0=一般負荷）',0,1,1,'重要負荷は毎tick先に割り当てる。一般負荷は先着順で、確保済みの分を取り上げない。'),
 edit('o2gen','boostPower','増産時の要求電力（kW）',1,4,0.5,'増産モードで配電盤に求める電力。'),
 edit('payload','trip','熱保護の作動温度（°C）',35,50,0.5,'温度報告がこの値以上になると制限運転に入る。'),
 edit('payload','resume','熱保護の解除温度（°C）',25,45,0.5,'温度報告がこの値以下になると実験運転に戻る。'),
];

// Output contracts. Lags count ticks from the tick a command is set on screen.
const ci=(id:string,lag:number):ContractExpr=>({source:'input',id,lag});
const c=(name:Exclude<ContractExpr,number|{source:string}>['op'],...args:ContractExpr[]):ContractExpr=>({op:name,args});
const range=(lo:ContractExpr,hi:ContractExpr,startAt=0):ContractRule=>({kind:'range',min:lo,max:hi,startAt});
export const BUS_RATING=5.5,TEMP_LIMIT=40,O2_BOOST_MIN=0.8;
export const outputRequirements:Scenario['outputRequirements']=[
 {nodeId:'mon_temp',role:'機器ラックの安全温度',condition:'全時刻',expected:`15 °C 以上 ${TEMP_LIMIT} °C 以下`,rules:[range(15,TEMP_LIMIT)]},
 {nodeId:'rep_payload',role:'ペイロードの可用性',condition:'全時刻',expected:'指令から3 tick後の状態が指令どおり（制限運転は不可）',rules:[{kind:'equals',expected:ci(PAYLOAD,3)}]},
 {nodeId:'rep_o2',role:'酸素の生成',condition:'全時刻',expected:`通常 0.5 L/min 以上、増産指令から5 tick後は ${O2_BOOST_MIN} L/min 以上（通常に戻す指令から4 tick後に解除）、上限 2 L/min`,rules:[range(c('switch',c('multiply',ci(O2,5),ci(O2,4)),O2_BOOST_MIN,0.5),2)]},
 {nodeId:'rep_pump',role:'冷却ポンプの運転',condition:'全時刻',expected:'運転中',rules:[range(1,1)]},
 {nodeId:'rep_bus',role:'主バスの定格',condition:'全時刻',expected:`0 kW 以上 ${BUS_RATING} kW 以下`,rules:[range(0,BUS_RATING)]},
];

// Public acceptance cases: loads in both orders, short and long gaps, stop/restart, long runs and seeds.
const at=(time:number,id:string,value:number)=>({time,id,value});
export const behaviorCases:BehaviorCase[]=[
 {name:'指令を変えずに運転',steps:120,inputs:[]},
 {name:'実験運転のみ',steps:160,inputs:[at(2,PAYLOAD,2)]},
 {name:'O₂増産のみ',steps:120,inputs:[at(2,O2,1)]},
 ...[0,3,12,40].map(gap=>({name:`O₂増産の${gap} tick後に実験運転`,steps:200,inputs:[at(4,O2,1),at(4+gap,PAYLOAD,2)]})),
 ...[1,6,40].map(gap=>({name:`実験運転の${gap} tick後にO₂増産`,steps:200,inputs:[at(4,PAYLOAD,2),at(4+gap,O2,1)]})),
 {name:'待機から実験運転へ、途中でO₂増産を止めて再開',steps:240,inputs:[at(2,PAYLOAD,1),at(10,O2,1),at(30,PAYLOAD,2),at(90,O2,0),at(100,O2,1),at(160,PAYLOAD,0),at(170,PAYLOAD,2)]},
 ...[7,99].map(seed=>({name:`放熱ループの揺らぎ（シード${seed}）で両方を同時に開始`,seed,steps:300,inputs:[at(3,PAYLOAD,2),at(3,O2,1)]})),
];

/* ---------- presentation hierarchy ---------- */
const ownership:Record<string,string[]>={sensors:['rack_sensor','bus_meter'],thermal:['rack','cool_ctrl','pump'],life:['o2gen'],power:['pdu'],science:['payload']};
const labels:Record<string,string>={System:'宇宙船',sensors:'環境計測',thermal:'熱制御',life:'生命維持',power:'配電',science:'科学ペイロード'};
const systemNodes=nodes.filter(n=>n.kind!=='inner').map(n=>n.id);
const spec=(rows:[string,string,string][],assumptions:string):ModuleSpec=>({condition:'',expected:'',timing:'',assumptions,relations:[],outputs:rows.map(([portId,expected,timing])=>({portId,condition:'',expected,timing}))});
const specs:Record<string,ModuleSpec>={
 sensors:spec([
  ['out:thermal.rackTemperatureReport','受け取ったラック温度をそのまま報告する。計測時刻は、読んだ温度がラックで計算された時刻。','4 tickごと。'],
  ['out:power.busLoadReport','受け取った主バス負荷をそのまま報告する。','2 tickごと。'],
 ],'報告を受け取った機器は、次の報告が届くまで前の報告を使う。'),
 thermal:spec([
  ['out:thermal.rackTemperature','温度の変化 = 0.4 ×（1 kW + ペイロード発熱 − 0.01 × 流量 ×（ラック温度 − 放熱ループ温度））。流量は、冷却流量指令と、給電許可で出せる流量（許可 ÷ 0.125）の小さいほう。冷却流量指令 = 10 + 5 ×（受け取った温度報告 − 30 °C）を 10〜30 L/min に収めた値。','毎tick。'],
  ['out:power.pumpRequest','ポンプ電力要求 = 冷却流量指令 × 0.125 kW/(L/min)。','毎tick。'],
  ['out:thermal.pumpStatus','流量指令を受けている間は「運転中」を報告する。','毎tick。'],
 ],'目安：発熱3 kW、放熱ループ温度20 °Cでは、ラック温度約33 °C・流量約24 L/min（ポンプ電力約3 kW）で釣り合う。'),
 life:spec([
  ['out:power.o2Request','通常モードは1 kW、増産モードは4 kWを要求する。','モード指令を受けたtickに要求が変わる。'],
  ['out:life.o2Rate','O₂生成量 = 0.5 L/(min·kW) × 給電許可（要求を上限とする）。','毎tick。'],
 ],'増産は生命維持の余裕を作るための運転で、一般負荷として扱う。'),
 power:spec([
  ['out:power.pumpGrant','冷却ポンプは重要負荷。重要負荷には毎tick、容量5.5 kWの範囲で要求どおり割り当てる。','毎tick。'],
  ['out:power.o2Grant','一般負荷（O₂生成装置）には、重要負荷に割り当てた残りを、要求を上限として割り当てる。','毎tick。'],
  ['out:power.busLoad','主バス負荷 = 割り当てた電力の合計。','毎tick。'],
 ],'一般負荷は先着順：毎tick、ほかの一般負荷が前のtickまでに確保した分を除いた空き容量の範囲で割り当てる。確保済みの分は、その機器の要求が下がるまで取り上げない。重要負荷が必要とする分は、一般負荷の割り当てから毎tick差し引く。'),
 science:spec([
  ['out:thermal.payloadHeat','実験運転は2 kW、待機は0.5 kW、停止は0 kWの熱を出す。制限運転中は0.5 kW。','毎tick。'],
  ['out:payload.status','温度報告が42 °C以上になると制限運転に入り、36 °C以下に下がると実験運転に戻る。','毎tick。'],
 ],'熱保護は温度センサーの報告で判断する。'),
};
const label=(edge:Connection)=>{const d=signals.find(d=>d.id===edge.signal)!;return {...d,label:d.kind==='measurement'?`${d.label}（計測報告）`:d.kind==='physical'?`${d.label}（物理量）`:d.label};};
const members=(id:string)=>ownership[id]??[];
const port=(id:string,label:string,direction:'in'|'out',binding:ModulePort['binding'],description=''):ModulePort=>({id,label,direction,binding,observable:true,description});
/** One input port per crossing connection; one output port per signal a module sends out. */
function modulePorts(id:string):ModulePort[]{
 const owned=new Set(members(id)),ports:ModulePort[]=[];
 for(const edge of connections){
  const d=label(edge);
  if(owned.has(edge.to)&&!owned.has(edge.from))ports.push(port(`in:${edge.id}`,d.label,'in',{kind:'input',connectionId:edge.id},d.meaning));
  if(owned.has(edge.from)&&!owned.has(edge.to)&&!ports.some(p=>p.id===`out:${d.id}`))ports.push(port(`out:${d.id}`,d.label,'out',{kind:'output',nodeId:edge.from,...(edge.sourceKey?{key:edge.sourceKey}:{})},d.meaning));
 }
 return ports;
}
const systemOutputs:Record<string,string>={mon_temp:'機器ラック温度（独立監視）',rep_payload:'ペイロード状態',rep_o2:'O₂生成量',rep_pump:'冷却ポンプ状態',rep_bus:'主バス負荷'};
const systemModule:Module={id:'System',label:labels.System,description:'航行中の有人宇宙船。熱制御・生命維持・配電が1本の主バスを共有する。',nodes:systemNodes,children:Object.keys(ownership),
 spec:{condition:'',expected:'',timing:'',assumptions:'時刻は指令を画面で設定したtickから数える。',relations:[],outputs:outputRequirements.map(v=>({portId:v.nodeId,condition:v.condition,expected:v.expected,timing:'',rules:v.rules}))},
 ports:[...inputs.map(i=>port(i.id,i.label,'in',{kind:'control',inputId:i.id},i.description)),port('loop_temp','放熱ループ温度','in',{kind:'source',nodeId:'loop_temp'},'船外環境で揺らぐ。操作できない。'),
  ...Object.entries(systemOutputs).map(([nodeId,label])=>port(nodeId,label,'out',{kind:'output',nodeId}))]};
const modules:Module[]=[systemModule,...Object.keys(ownership).map(id=>({id,label:labels[id],description:'',nodes:ownership[id],children:[],ports:modulePorts(id),spec:specs[id]}))];
export const hierarchy:Hierarchy={systemId:'System',roots:['System'],modules,
 inputs:inputs.map(i=>({inputId:i.id,moduleId:'System',portId:i.id,label:i.label})),
 outputs:Object.entries(systemOutputs).map(([nodeId,label])=>({nodeId,moduleId:'System',portId:nodeId,label})),
};
const obs=(target:string):Observation=>({id:`o-${target}`,label:nodes.find(n=>n.id===target)?.label??signals.find(d=>d.id===connections.find(e=>e.id===target)?.signal)!.label,target,key:'value',period:1,noise:0,offset:0,available:true,permission:'public',unlockStep:0,cost:0});
export const observations:Observation[]=nodes.map(n=>obs(n.id));

/* ---------- floor plan ---------- */
// Where equipment sits. Information flow is not drawn; manuals name what each device receives and sends.
export const floor:FloorPlan={channels:3,diagnoses:3,
 compartments:[
  {id:'bridge',label:'運用室',x:3,y:8,w:16,h:84},
  {id:'bay',label:'機器ベイ',x:21,y:8,w:24,h:84},
  {id:'life',label:'生命維持区画',x:47,y:8,w:22,h:40},
  {id:'power',label:'電源室',x:47,y:52,w:22,h:40},
  {id:'thermal',label:'熱制御区画',x:71,y:8,w:20,h:84},
  {id:'outside',label:'船外',x:96,y:20,w:0,h:60,outside:true},
 ],
 devices:[
  {nodeId:'ops_payload',label:'ペイロード運転卓',compartment:'bridge',x:4,y:20,icon:'⌨',manual:['運用担当がペイロードの運転モード（停止・待機・実験運転）を指令する操作卓。指令は科学ペイロードに送られる。']},
  {nodeId:'ops_o2',label:'生命維持操作卓',compartment:'bridge',x:4,y:56,icon:'⌨',manual:['運用担当がO₂生成装置の生成モード（通常・増産）を指令する操作卓。指令はO₂生成装置に送られる。']},
  {nodeId:'rack',compartment:'bay',x:23,y:22,icon:'▤',manual:['電子機器を収めたラック。電子機器は常に1 kWの熱を出し、科学ペイロードの熱も加わる。','冷却液が熱を運び出す。温度の変化 = 0.4 ×（1 kW + ペイロード発熱 − 0.01 × 冷却液流量 ×（ラック温度 − 放熱ループ温度））。','独立した安全監視系が、ラックの温度を直接読んで乗組員に表示する。']},
  {nodeId:'rack_sensor',compartment:'bay',x:23,y:48,icon:'◔',manual:['ラック温度センサー。4 tickごとにラックの温度を計測し、計測報告を冷却制御と科学ペイロードに送る。','報告には計測した時刻が付く。受け取った機器は、次の報告が届くまで前の報告を使う。']},
  {nodeId:'payload',compartment:'bay',x:23,y:72,icon:'✦',manual:['科学ペイロード。運転指令に従い、実験運転で2 kW、待機で0.5 kWの熱をラックに出す。','熱保護：温度センサーの報告が42 °C以上で制限運転（0.5 kW）に入り、36 °C以下で実験運転に戻る。','実際の運転状態を乗組員に報告する。']},
  {nodeId:'o2gen',compartment:'life',x:50,y:22,icon:'◎',manual:['O₂生成装置。生成モード指令に従い、通常は1 kW、増産は4 kWの電力を配電盤に要求する。','給電許可を受けた電力1 kWあたり0.5 L/minの酸素を生成し、生成量を乗組員に報告する。','増産は生命維持の余裕を作るための運転で、配電上は一般負荷。']},
  {nodeId:'pdu',compartment:'power',x:49,y:60,icon:'⚡',manual:['配電盤。主バスの容量は5.5 kW。冷却ポンプとO₂生成装置から電力要求を受け、それぞれに給電許可を返す。','冷却ポンプは重要負荷。重要負荷には毎tick、容量の範囲で要求どおり割り当てる。','一般負荷（O₂生成装置）には重要負荷の残りを割り当てる。一般負荷どうしは先着順で、確保済みの分は取り上げない。','割り当ての合計（主バス負荷）を電力計に送る。']},
  {nodeId:'bus_meter',compartment:'power',x:56,y:76,icon:'◫',manual:['主バス電力計。2 tickごとに主バス負荷を計測し、乗組員に報告する。']},
  {nodeId:'cool_ctrl',compartment:'thermal',x:74,y:22,icon:'⌬',manual:['冷却制御。受け取った温度報告から冷却流量指令を決め、冷却ポンプに送る。','冷却流量指令 = 10 + 5 ×（温度報告 − 30 °C）を 10〜30 L/min に収めた値。']},
  {nodeId:'pump',compartment:'thermal',x:74,y:54,icon:'⟳',manual:['冷却ポンプ。冷却流量指令に必要な電力（1 L/minあたり0.125 kW）を配電盤に要求する。','指令流量と、給電許可で出せる流量（許可 ÷ 0.125）の小さいほうの冷却液をラックへ流す。','流量指令を受けている間は「運転中」を乗組員に報告する。','目安：発熱3 kW、放熱ループ温度20 °Cでは、約24 L/min（約3 kW）で釣り合う。']},
  {nodeId:'loop_temp',label:'放熱器',compartment:'outside',x:92,y:40,icon:'❄',manual:['放熱器。冷却液は船外の放熱器を通ってラックに戻る。戻りの温度（放熱ループ温度）は船外環境で18〜22 °Cの間を揺らぐ。操作も診断もできない。']},
 ]};

export type ShipSystem=Pick<Scenario,'floor'|'signals'|'nodes'|'connections'|'inputs'|'interventions'|'observations'|'visibleNodeIds'|'visibleConnectionIds'|'outputRequirements'|'behaviorCases'|'hierarchy'>;
export const shipSystem:ShipSystem={floor,signals,nodes,connections,inputs,interventions,observations,hierarchy,outputRequirements,behaviorCases,visibleNodeIds:nodes.map(n=>n.id),visibleConnectionIds:connections.map(e=>e.id)};
