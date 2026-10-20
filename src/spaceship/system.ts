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
 {id:'ops.payloadMode',label:'実験装置の運転指示',valueType:'enum',kind:'command',values:{0:'停止',1:'待機',2:'実験運転'},meaning:'クルーが実験装置に出す運転モードの指示。'},
 {id:'ops.o2Mode',label:'酸素製造モードの指示',valueType:'enum',kind:'command',values:{0:'通常',1:'増産'},meaning:'クルーが酸素製造装置に出す製造モードの指示。'},
 {id:'env.fluctuation',label:'船の外の温度変化',unit:'°C',valueType:'number',kind:'physical',digits:1,meaning:'航路の基準温度に加わる、船の外の温度変化（0〜4 °C）。'},
 {id:'nav.route',label:'航路指示',valueType:'enum',kind:'command',values:{0:'涼しい航路',1:'標準航路',2:'暑い航路'},meaning:'操縦担当のクルーが選ぶ航路。航路によって船外の温度が変わる。'},
 {id:'thermal.loopTemperature',label:'戻り冷却水の温度',unit:'°C',valueType:'number',kind:'physical',digits:1,meaning:'放熱器から戻る冷却水の温度。航路の基準温度に船の外の温度変化が加わる。'},
 {id:'life.o2Vent',label:'タンクからあふれた酸素',unit:'%',valueType:'number',kind:'physical',digits:2,meaning:'満杯の酸素タンクから逃がし弁が電子機器室へ放出した量（タンク容量に対する割合）。'},
 {id:'bay.o2Level',label:'電子機器室の酸素濃度',unit:'%',valueType:'number',kind:'physical',digits:1,meaning:'電子機器室の空気に含まれる酸素の割合。通常は21 %。'},
 {id:'safety.fireAlarm',label:'火災警報',valueType:'enum',kind:'status',values:{0:'異常なし',1:'火災',2:'爆発'},meaning:'火災監視装置が船内全体に出す警報。'},
 {id:'thermal.rackTemperature',label:'電子機器の温度',unit:'°C',valueType:'number',kind:'physical',digits:2,meaning:'電子機器の実際の温度。'},
 {id:'thermal.rackTemperatureReport',label:'電子機器の温度',unit:'°C',valueType:'number',kind:'measurement',digits:2,meaning:'温度センサーが報告した電子機器の温度。計測時刻を持つ。'},
 {id:'thermal.flowCommand',label:'冷却水の流量の指示',unit:'L/min',valueType:'number',kind:'command',digits:2,meaning:'冷却調整装置がポンプに指示する流量。'},
 {id:'thermal.coolantFlow',label:'冷却水の流量',unit:'L/min',valueType:'number',kind:'physical',digits:2,meaning:'ポンプが実際に流している冷却水の流量（実際の値）。'},
 {id:'thermal.payloadHeat',label:'実験装置の発熱',unit:'kW',valueType:'number',kind:'physical',digits:2,meaning:'実験装置が電子機器に加える熱。'},
 {id:'power.pumpRequest',label:'ポンプの電力申請',unit:'kW',valueType:'number',kind:'command',digits:2,meaning:'ポンプが指示流量を出すのに必要な電力の申請。'},
 {id:'power.o2Request',label:'酸素製造装置の電力申請',unit:'kW',valueType:'number',kind:'command',digits:2,meaning:'酸素製造装置が製造モードに応じて求める電力。'},
 {id:'power.pumpGrant',label:'ポンプが使ってよい電力',unit:'kW',valueType:'number',kind:'command',digits:2,meaning:'配電盤がポンプに割り当てた電力の上限。'},
 {id:'power.o2Grant',label:'酸素製造装置が使ってよい電力',unit:'kW',valueType:'number',kind:'command',digits:2,meaning:'配電盤が酸素製造装置に割り当てた電力の上限。'},
 {id:'power.busLoad',label:'電気の使用量',unit:'kW',valueType:'number',kind:'physical',digits:2,meaning:'配電盤が割り当てた電力の合計（実際の値）。'},
 {id:'power.busLoadReport',label:'電気の使用量',unit:'kW',valueType:'number',kind:'measurement',digits:2,meaning:'電力計が報告した電気の使用量。'},
 {id:'life.o2Rate',label:'酸素の製造量',unit:'L/min',valueType:'number',kind:'status',digits:2,meaning:'酸素製造装置が報告する現在の製造量。'},
 {id:'thermal.pumpStatus',label:'冷却水ポンプの状態',valueType:'enum',kind:'status',values:{0:'停止',1:'運転中'},meaning:'ポンプがクルーへ送る運転状態の報告。'},
 {id:'science.recordCommand',label:'データ記録指示',valueType:'enum',kind:'command',values:{0:'停止',1:'記録'},meaning:'実験担当のクルーがデータ記録装置に出す記録の指示。'},
 {id:'science.dataVolume',label:'記録済みデータ量',unit:'MB',valueType:'number',kind:'status',digits:0,meaning:'データ記録装置が報告する、記録済みの実験データの量。'},
 {id:'life.o2Tank',label:'酸素タンクの残量',unit:'%',valueType:'number',kind:'status',digits:1,meaning:'酸素タンクが報告する残量。'},
 {id:'power.peakMode',label:'最大値表示の切り替え',valueType:'enum',kind:'command',values:{0:'最大値を保持',1:'現在値に戻す'},meaning:'電力担当のクルーが最大値の表示器に出す指示。'},
 {id:'power.busPeak',label:'電気の使用量の最大値',unit:'kW',valueType:'number',kind:'status',digits:2,meaning:'最大値の表示器が保持している電気の使用量の最大値。'},
 {id:'thermal.coolantFlowReport',label:'冷却水の流量',unit:'L/min',valueType:'number',kind:'measurement',digits:2,meaning:'流量計が報告した冷却水の流量。計測時刻を持つ。'},
 {id:'payload.status',label:'実験装置の状態',valueType:'enum',kind:'status',values:{0:'停止',1:'待機',2:'実験運転',3:'出力制限（過熱防止）'},meaning:'実験装置が報告する実際の運転状態。'},
];

const node=(id:string,label:string,kind:Node['kind'],trigger:Node['trigger'],initialState:Record<string,number>,parameters:Record<string,number>,update:Record<string,Expr>,sig:NodeSignals,description:string):Node=>
 ({id,label,kind,trigger,initialState,parameters,update,signals:sig,description,ports:[{id:'in',direction:'in'},{id:'value',direction:'out'}],x:0,y:0});
const timer=(period=1):Node['trigger']=>({type:'timer',periodParameter:'interval'});

// Healthy steady state with no payload and normal 酸素 generation.
const T0=30,FLOW0=10,PUMP_KW=0.125;
// Essential loads are served first every tick. General loads are first come: each keeps what it
// already holds and only takes capacity that no other general load holds.
const pumpGrant=op('switch',r('param.pumpEssential'),
 min(r('input.pumpRequest'),r('param.capacity')),
 min(r('input.pumpRequest'),op('sum',r('param.capacity'),minus(r('state.o2Grant')))));
const o2Grant=min(r('input.o2Request'),op('sum',r('param.capacity'),minus(pumpGrant)));
const limited=op('switch',op('threshold',r('input.temperature'),r('param.trip')),1,op('switch',op('threshold',r('param.resume'),r('input.temperature')),0,r('state.limited')));
const running=op('threshold',r('input.mode'),2);
const tankRaw=op('sum',r('state.value'),op('multiply',r('param.gain'),op('sum',r('input.rate'),minus(r('param.use')))));
// Fire: a rack that stays above the ignition temperature, or a spark (payload starting up) in oxygen-rich air.
const payloadRunning=op('sum',op('threshold',r('input.status'),2),minus(op('threshold',r('input.status'),3)));
const overheated=op('threshold',r('state.hot'),r('param.hotTicks'));
const sparkFire=op('multiply',payloadRunning,op('sum',1,minus(r('state.running'))),op('threshold',r('input.o2'),r('param.o2Limit')));
const ignite=op('clamp',op('sum',overheated,sparkFire),0,1);

export const nodes:Node[]=[
 node('ops_payload','実験装置の運転','input',{type:'manual'},{value:0},{mode:0},{value:r('param.mode')},{out:{value:'ops.payloadMode'}},'クルーの実験装置の運転指示。'),
 node('ops_o2','酸素製造モード','input',{type:'manual'},{value:0},{mode:0},{value:r('param.mode')},{out:{value:'ops.o2Mode'}},'クルーの酸素製造モードの指示。'),
 {...node('space_env','船外環境','input',{type:'random',minInterval:3,maxInterval:7},{value:2},{},{},{out:{value:'env.fluctuation'}},'船の外の温度変化。操作できない。'),externalInput:{seed:20261018,value:{type:'uniform',min:0,max:4}}},
 node('ops_route','航路','input',{type:'manual'},{value:1},{mode:1},{value:r('param.mode')},{out:{value:'nav.route'}},'クルーの航路指示。'),
 node('radiator','放熱器','inner',timer(),{value:20},{interval:1,cool:16,standard:18,hot:22},
  {value:op('sum',op('switch',op('threshold',r('input.route'),2),r('param.hot'),op('switch',op('threshold',r('input.route'),1),r('param.standard'),r('param.cool'))),r('input.env'))},
  {in:{route:'nav.route',env:'env.fluctuation'},out:{value:'thermal.loopTemperature'}},'航路の基準温度に船の外の温度変化を加えた温度の冷却水を電子機器に戻す。'),
 node('rack','電子機器','inner',timer(),{value:T0},{interval:1,baseHeat:1,heatCapacity:0.4,transfer:0.01},
  {value:op('sum',r('state.value'),op('multiply',r('param.heatCapacity'),op('sum',r('param.baseHeat'),r('input.heat'),minus(op('multiply',r('param.transfer'),r('input.flow'),op('sum',r('state.value'),minus(r('input.coolant'))))))))},
  {in:{heat:'thermal.payloadHeat',flow:'thermal.coolantFlow',coolant:'thermal.loopTemperature'},out:{value:'thermal.rackTemperature'}},
  '電子機器と実験装置の熱が加わり、冷却水が熱を運び出す。'),
 node('rack_sensor','温度センサー','inner',timer(),{value:T0},{interval:4,offset:0},{value:op('sum',r('input.temperature'),r('param.offset'))},
  {in:{temperature:'thermal.rackTemperature'},out:{value:'thermal.rackTemperatureReport'},measures:'temperature'},'一定周期で電子機器の温度を計測して報告する。'),
 node('cool_ctrl','冷却調整装置','inner',timer(),{value:FLOW0},{interval:1,minFlow:10,maxFlow:30,setpoint:30,gain:5},
  {value:op('clamp',op('sum',r('param.minFlow'),op('multiply',r('param.gain'),op('sum',r('input.temperature'),minus(r('param.setpoint'))))),r('param.minFlow'),r('param.maxFlow'))},
  {in:{temperature:'thermal.rackTemperatureReport'},out:{value:'thermal.flowCommand'}},'最後に受け取った温度報告から冷却水の流量の指示を決める。'),
 node('pump','冷却水ポンプ','inner',timer(),{value:FLOW0,request:FLOW0*PUMP_KW,status:1},{interval:1,kwPerFlow:PUMP_KW},
  {value:min(r('input.command'),op('multiply',r('input.grant'),1/PUMP_KW)),request:op('multiply',r('input.command'),r('param.kwPerFlow')),status:op('threshold',r('input.command'),1)},
  {in:{command:'thermal.flowCommand',grant:'power.pumpGrant'},out:{value:'thermal.coolantFlow',request:'power.pumpRequest',status:'thermal.pumpStatus'}},'指示流量に必要な電力を申請し、使ってよい電力の範囲で冷却水を流す。'),
 node('pdu','配電盤','inner',timer(),{value:FLOW0*PUMP_KW+1,pumpGrant:FLOW0*PUMP_KW,o2Grant:1},{interval:1,capacity:5.5,pumpEssential:1},
  {value:op('sum',pumpGrant,o2Grant),pumpGrant,o2Grant},
  {in:{pumpRequest:'power.pumpRequest',o2Request:'power.o2Request'},out:{value:'power.busLoad',pumpGrant:'power.pumpGrant',o2Grant:'power.o2Grant'}},'電力申請を受け、船の電気の容量の範囲で各機器に使ってよい電力を出す。'),
 node('bus_meter','電力計','inner',timer(),{value:FLOW0*PUMP_KW+1},{interval:2},{value:r('input.load')},
  {in:{load:'power.busLoad'},out:{value:'power.busLoadReport'},measures:'load'},'一定周期で電気の使用量を計測して報告する。'),
 node('o2gen','酸素製造装置','inner',timer(),{value:0.5,request:1},{interval:1,normalPower:1,boostPower:4,yield:0.5},
  {value:op('multiply',r('param.yield'),min(r('input.grant'),r('state.request'))),request:op('switch',r('input.mode'),r('param.boostPower'),r('param.normalPower'))},
  {in:{mode:'ops.o2Mode',grant:'power.o2Grant'},out:{value:'life.o2Rate',request:'power.o2Request'}},'製造モードに応じて電力を申請し、使ってよい電力で酸素を製造する。'),
 node('payload','実験装置','inner',timer(),{value:0,heat:0,limited:0},{interval:1,trip:42,resume:36,fullHeat:2,standbyHeat:0.5},
  {limited,value:op('switch',running,op('switch',limited,3,2),r('input.mode')),heat:op('switch',running,op('switch',limited,r('param.standbyHeat'),r('param.fullHeat')),op('multiply',r('input.mode'),r('param.standbyHeat')))},
  {in:{mode:'ops.payloadMode',temperature:'thermal.rackTemperatureReport'},out:{value:'payload.status',heat:'thermal.payloadHeat'}},'実験運転中に温度報告が上限を超えると、過熱防止で出力制限に入る。'),
 node('ops_record','データ記録','input',{type:'manual'},{value:0},{mode:0},{value:r('param.mode')},{out:{value:'science.recordCommand'}},'クルーのデータ記録指示。'),
 node('ops_peak','最大値表示の切り替え','input',{type:'manual'},{value:0},{mode:0},{value:r('param.mode')},{out:{value:'power.peakMode'}},'クルーの最大値表示の切り替え指示。'),
 node('recorder','データ記録装置','inner',timer(),{value:0},{interval:1,rate:1},
  {value:op('sum',r('state.value'),op('multiply',r('param.rate'),r('input.record'),op('sum',op('threshold',r('input.status'),2),minus(op('threshold',r('input.status'),3)))))},
  {in:{record:'science.recordCommand',status:'payload.status'},out:{value:'science.dataVolume'}},'記録中、実験装置が実験運転していれば毎tickデータを記録する。'),
 node('o2tank','酸素タンク','inner',timer(),{value:60,vent:0},{interval:1,use:0.5,gain:1},
  {value:op('clamp',tankRaw,0,100),vent:op('clamp',op('sum',tankRaw,-100),0,1000)},
  {in:{rate:'life.o2Rate'},out:{value:'life.o2Tank',vent:'life.o2Vent'}},'作られた酸素をため、船内の消費分を差し引く。満杯のときは、あふれた分を逃がし弁から電子機器室へ放出する。'),
 node('bay_air','換気ファン','inner',timer(),{value:21},{interval:1,fan:1.5},
  {value:op('clamp',op('sum',r('state.value'),r('input.vent'),minus(r('param.fan'))),21,60)},
  {in:{vent:'life.o2Vent'},out:{value:'bay.o2Level'}},'電子機器室の空気を船外へ排出する。状態は電子機器室の酸素濃度。'),
 node('hazard','火災監視装置','inner',timer(),{value:0,hot:0,running:0,fire:0,cause:0,exploded:0},{interval:1,ignition:42,hotTicks:3,o2Limit:30,burnTicks:5},
  {hot:op('switch',op('threshold',r('input.temp'),r('param.ignition')),op('sum',r('state.hot'),1),0),
   running:payloadRunning,
   fire:op('switch',r('state.fire'),op('sum',r('state.fire'),1),ignite),
   cause:op('switch',r('state.cause'),r('state.cause'),op('switch',overheated,1,op('multiply',2,sparkFire))),
   exploded:op('threshold',r('state.fire'),r('param.burnTicks')),
   value:op('switch',op('threshold',r('state.fire'),r('param.burnTicks')),2,op('clamp',op('sum',r('state.fire'),ignite),0,1))},
  {in:{temp:'thermal.rackTemperature',o2:'bay.o2Level',status:'payload.status'},out:{value:'safety.fireAlarm'}},'電子機器室の過熱による発火と引火を監視する。火災が続くと船が爆発する。'),
 node('peak_meter','最大値の表示器','inner',timer(),{value:FLOW0*PUMP_KW+1},{interval:1},
  {value:op('switch',r('input.mode'),r('input.load'),op('clamp',r('state.value'),r('input.load'),1000))},
  {in:{load:'power.busLoadReport',mode:'power.peakMode'},out:{value:'power.busPeak'}},'受け取った電気の使用量の最大値を保持する。'),
 node('flow_meter','冷却水の流量計','inner',timer(),{value:FLOW0},{interval:2},{value:r('input.flow')},
  {in:{flow:'thermal.coolantFlow'},out:{value:'thermal.coolantFlowReport'},measures:'flow'},'一定周期で冷却水の流量を計測して報告する。'),
 node('rep_data','記録済みデータ量','output',{type:'input'},{value:0},{},{value:r('input.signal')},{in:{signal:'science.dataVolume'}},'データ記録装置の記録量報告。'),
 node('rep_tank','酸素タンクの残量','output',{type:'input'},{value:60},{},{value:r('input.signal')},{in:{signal:'life.o2Tank'}},'酸素タンクの残量報告。'),
 node('rep_peak','電気の使用量の最大値','output',{type:'input'},{value:FLOW0*PUMP_KW+1},{},{value:r('input.signal')},{in:{signal:'power.busPeak'}},'最大値の表示器の表示。'),
 node('rep_flow','冷却水の流量','output',{type:'input'},{value:FLOW0},{},{value:r('input.signal')},{in:{signal:'thermal.coolantFlowReport'}},'流量計の流量報告。'),
 node('rep_loop','戻り冷却水の温度','output',{type:'input'},{value:20},{},{value:r('input.signal')},{in:{signal:'thermal.loopTemperature'}},'戻り冷却水の温度の表示。'),
 node('rep_fire','火災警報','output',{type:'input'},{value:0},{},{value:r('input.signal')},{in:{signal:'safety.fireAlarm'}},'船内全体に出る火災警報。'),
 node('mon_temp','電子機器の温度（安全監視用）','output',{type:'input'},{value:T0},{},{value:r('input.signal')},{in:{signal:'thermal.rackTemperature'}},'安全監視系が直接読む電子機器の温度。'),
 node('rep_payload','実験装置の状態','output',{type:'input'},{value:0},{},{value:r('input.signal')},{in:{signal:'payload.status'}},'実験装置の状態報告。'),
 node('rep_o2','酸素の製造量','output',{type:'input'},{value:0.5},{},{value:r('input.signal')},{in:{signal:'life.o2Rate'}},'酸素製造装置の製造量報告。'),
 node('rep_pump','冷却水ポンプの状態','output',{type:'input'},{value:1},{},{value:r('input.signal')},{in:{signal:'thermal.pumpStatus'}},'冷却水ポンプの状態報告。'),
 node('rep_bus','電気の使用量','output',{type:'input'},{value:FLOW0*PUMP_KW+1},{},{value:r('input.signal')},{in:{signal:'power.busLoadReport'}},'電力計の電気の使用量報告。'),
];
const unitOf=(signal:string)=>signals.find(d=>d.id===signal)!.unit??'abstract';
const e=(id:string,from:string,to:string,input:string,signal:string,sourceKey?:string):Connection=>({id,from,to,input,enabled:true,kind:'signal',unit:unitOf(signal),signal,...(sourceKey?{sourceKey}:{})});
export const connections:Connection[]=[
 e('c_mode_payload','ops_payload','payload','mode','ops.payloadMode'),
 e('c_mode_o2','ops_o2','o2gen','mode','ops.o2Mode'),
 e('c_env','space_env','radiator','env','env.fluctuation'),
 e('c_route','ops_route','radiator','route','nav.route'),
 e('c_loop_rack','radiator','rack','coolant','thermal.loopTemperature'),
 e('c_loop_nav','radiator','rep_loop','signal','thermal.loopTemperature'),
 e('c_vent','o2tank','bay_air','vent','life.o2Vent','vent'),
 e('c_hazard_temp','rack','hazard','temp','thermal.rackTemperature'),
 e('c_hazard_o2','bay_air','hazard','o2','bay.o2Level'),
 e('c_hazard_status','payload','hazard','status','payload.status'),
 e('c_fire','hazard','rep_fire','signal','safety.fireAlarm'),
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
 e('c_record','ops_record','recorder','record','science.recordCommand'),
 e('c_status_rec','payload','recorder','status','payload.status'),
 e('c_data','recorder','rep_data','signal','science.dataVolume'),
 e('c_o2_tank','o2gen','o2tank','rate','life.o2Rate'),
 e('c_tank','o2tank','rep_tank','signal','life.o2Tank'),
 e('c_bus_peak','bus_meter','peak_meter','load','power.busLoadReport'),
 e('c_peak_mode','ops_peak','peak_meter','mode','power.peakMode'),
 e('c_peak','peak_meter','rep_peak','signal','power.busPeak'),
 e('c_flow_meter','pump','flow_meter','flow','thermal.coolantFlow'),
 e('c_flow_report','flow_meter','rep_flow','signal','thermal.coolantFlowReport'),
];

export const PAYLOAD='ops_payload.mode',O2='ops_o2.mode',RECORD='ops_record.mode',PEAK='ops_peak.mode',ROUTE='ops_route.mode';
export const inputs:ManualInput[]=[
 {id:PAYLOAD,nodeId:'ops_payload',parameter:'mode',label:'実験装置の運転指示',description:'0=停止、1=待機、2=実験運転。',min:0,max:2,step:1,defaultValue:0},
 {id:O2,nodeId:'ops_o2',parameter:'mode',label:'酸素製造モードの指示',description:'0=通常、1=増産。',min:0,max:1,step:1,defaultValue:0},
 {id:RECORD,nodeId:'ops_record',parameter:'mode',label:'データ記録指示',description:'0=停止、1=記録。',min:0,max:1,step:1,defaultValue:0},
 {id:PEAK,nodeId:'ops_peak',parameter:'mode',label:'最大値表示の切り替え指示',description:'0=最大値を保持、1=現在値に戻す。',min:0,max:1,step:1,defaultValue:0},
 {id:ROUTE,nodeId:'ops_route',parameter:'mode',label:'航路指示',description:'0=涼しい航路、1=標準航路、2=暑い航路。',min:0,max:2,step:1,defaultValue:1},
];
for(const n of nodes)if(n.kind==='input'&&!n.externalInput)n.inputParameter='mode';

const edit=(target:string,parameter:string,label:string,min:number,max:number,step:number,description:string):Intervention=>({id:`${target}.${parameter}`,label,target,parameter,min,max,step,defaultValue:nodes.find(n=>n.id===target)!.parameters[parameter],description});
export const interventions:Intervention[]=[
 edit('rack_sensor','interval','測る間隔（tick）',1,8,1,'温度を計測して報告する周期。'),
 edit('rack_sensor','offset','表示のずれの補正（°C）',-5,5,0.5,'報告値に加える補正。'),
 edit('cool_ctrl','minFlow','最低流量（L/min）',0,30,1,'温度が低くても流す流量。'),
 edit('cool_ctrl','maxFlow','最大流量（L/min）',10,40,1,'指示の上限。'),
 edit('cool_ctrl','setpoint','目標温度（°C）',20,40,0.5,'この温度を超えると流量を増やす。'),
 edit('cool_ctrl','gain','温度1 °Cあたりに増やす流量（L/min）',0,10,0.5,'温度差1 °Cあたりに増やす流量。'),
 edit('pdu','capacity','配れる電力の合計（kW）',3,8,0.5,'配電盤が割り当てに使う容量。船の電気上限は5.5 kW。'),
 edit('pdu','pumpEssential','冷却水ポンプの優先度（1=最優先、0=ふつう）',0,1,1,'最優先の機器は毎tick先に割り当てる。ふつうの機器は早い者順で、確保済みの分を取り上げない。'),
 edit('o2gen','boostPower','増産時に申請する電力（kW）',1,4,0.5,'増産モードで配電盤に求める電力。'),
 edit('payload','trip','過熱防止が働く温度（°C）',35,50,0.5,'温度報告がこの値以上になると出力制限に入る。'),
 edit('payload','resume','過熱防止を解く温度（°C）',25,45,0.5,'温度報告がこの値以下になると実験運転に戻る。'),
 edit('bay_air','fan','換気ファンの強さ（%/tick）',0,3,0.1,'電子機器室の酸素を船外へ排出する量。'),
];

// Output contracts. Lags count ticks from the tick a command is set on screen.
const ci=(id:string,lag:number):ContractExpr=>({source:'input',id,lag});
const c=(name:Exclude<ContractExpr,number|{source:string}>['op'],...args:ContractExpr[]):ContractExpr=>({op:name,args});
const range=(lo:ContractExpr,hi:ContractExpr,startAt=0):ContractRule=>({kind:'range',min:lo,max:hi,startAt});
export const BUS_RATING=5.5,TEMP_LIMIT=40,O2_BOOST_MIN=0.8;
export const outputRequirements:Scenario['outputRequirements']=[
 {nodeId:'mon_temp',role:'電子機器の安全温度',condition:'全時刻',expected:`15 °C 以上 ${TEMP_LIMIT} °C 以下`,rules:[range(15,TEMP_LIMIT)]},
 {nodeId:'rep_payload',role:'実験装置の可用性',condition:'全時刻',expected:'指示から3 tick後の状態が指示どおり（出力制限は不可）',rules:[{kind:'equals',expected:ci(PAYLOAD,3)}]},
 {nodeId:'rep_o2',role:'酸素の製造',condition:'全時刻',expected:`通常 0.5 L/min 以上、増産指示から5 tick後は ${O2_BOOST_MIN} L/min 以上（通常に戻す指示から4 tick後に解除）、上限 2 L/min`,rules:[range(c('switch',c('multiply',ci(O2,5),ci(O2,4)),O2_BOOST_MIN,0.5),2)]},
 {nodeId:'rep_pump',role:'冷却水ポンプの運転',condition:'全時刻',expected:'運転中',rules:[range(1,1)]},
 {nodeId:'rep_bus',role:'電気の使用量の上限',condition:'全時刻',expected:`0 kW 以上 ${BUS_RATING} kW 以下`,rules:[range(0,BUS_RATING)]},
 {nodeId:'rep_data',role:'実験データの記録',condition:'全時刻',expected:'0 MB 以上',rules:[range(0,1e6)]},
 {nodeId:'rep_tank',role:'酸素の備蓄',condition:'全時刻',expected:'20 % 以上 100 % 以下',rules:[range(20,100)]},
 {nodeId:'rep_peak',role:'船の電気の最大値',condition:'全時刻',expected:`0 kW 以上 ${BUS_RATING} kW 以下`,rules:[range(0,BUS_RATING)]},
 {nodeId:'rep_flow',role:'冷却水の流量表示',condition:'全時刻',expected:'0 L/min 以上 40 L/min 以下',rules:[range(0,40)]},
 {nodeId:'rep_loop',role:'戻り冷却水の温度の表示',condition:'全時刻',expected:'10 °C 以上 40 °C 以下',rules:[range(10,40)]},
 {nodeId:'rep_fire',role:'火災・爆発なし',condition:'全時刻',expected:'異常なし',rules:[range(0,0)]},
];

// Public acceptance cases: loads in both orders, short and long gaps, stop/restart, long runs and seeds.
const at=(time:number,id:string,value:number)=>({time,id,value});
export const behaviorCases:BehaviorCase[]=[
 {name:'指示を変えずに運転',steps:120,inputs:[]},
 {name:'実験運転のみ',steps:160,inputs:[at(2,PAYLOAD,2)]},
 {name:'酸素の増産のみ',steps:120,inputs:[at(2,O2,1)]},
 ...[0,3,12,40].map(gap=>({name:`酸素の増産の${gap} tick後に実験運転`,steps:200,inputs:[at(4,O2,1),at(4+gap,PAYLOAD,2)]})),
 ...[1,6,40].map(gap=>({name:`実験運転の${gap} tick後に酸素の増産`,steps:200,inputs:[at(4,PAYLOAD,2),at(4+gap,O2,1)]})),
 {name:'待機から実験運転へ、途中で酸素の増産を止めて再開',steps:240,inputs:[at(2,PAYLOAD,1),at(10,O2,1),at(30,PAYLOAD,2),at(90,O2,0),at(100,O2,1),at(160,PAYLOAD,0),at(170,PAYLOAD,2)]},
 {name:'暑い航路で実験運転を続ける',steps:200,inputs:[at(0,ROUTE,2),at(4,PAYLOAD,2)]},
 {name:'涼しい航路で実験運転と酸素の増産',steps:160,inputs:[at(0,ROUTE,0),at(4,PAYLOAD,2),at(20,O2,1)]},
 {name:'酸素の増産を長く続けてから実験運転',steps:160,inputs:[at(2,O2,1),at(70,PAYLOAD,2)]},
 {name:'データ記録と最大値の表示を操作しながら実験運転',steps:160,inputs:[at(2,PAYLOAD,2),at(4,RECORD,1),at(30,PEAK,1),at(32,PEAK,0),at(60,RECORD,0),at(70,O2,1)]},
 ...[7,99].map(seed=>({name:`放熱ループの揺らぎ（シード${seed}）で両方を同時に開始`,seed,steps:300,inputs:[at(3,PAYLOAD,2),at(3,O2,1)]})),
];

/* ---------- presentation hierarchy ---------- */
const ownership:Record<string,string[]>={sensors:['rack_sensor','bus_meter','flow_meter'],thermal:['radiator','rack','cool_ctrl','pump'],life:['o2gen','o2tank'],power:['pdu','peak_meter'],science:['payload','recorder'],safety:['bay_air','hazard']};
const labels:Record<string,string>={System:'宇宙船',safety:'防災',sensors:'環境計測',thermal:'冷却',life:'生命維持',power:'配電',science:'実験装置'};
const systemNodes=nodes.filter(n=>n.kind!=='inner').map(n=>n.id);
const spec=(rows:[string,string,string][],assumptions:string):ModuleSpec=>({condition:'',expected:'',timing:'',assumptions,relations:[],outputs:rows.map(([portId,expected,timing])=>({portId,condition:'',expected,timing}))});
const specs:Record<string,ModuleSpec>={
 sensors:spec([
  ['out:thermal.rackTemperatureReport','受け取った電子機器の温度をそのまま報告する。計測時刻は、読んだ温度が電子機器で計算された時刻。','4 tickごと。'],
  ['out:power.busLoadReport','受け取った電気の使用量をそのまま報告する。','2 tickごと。'],
  ['out:thermal.coolantFlowReport','受け取った冷却水の流量をそのまま報告する。','2 tickごと。'],
 ],'報告を受け取った機器は、次の報告が届くまで前の報告を使う。'),
 thermal:spec([
  ['out:thermal.rackTemperature','温度の変化 = 0.4 ×（1 kW + 実験装置の発熱 − 0.01 × 流量 ×（電子機器の温度 − 戻り冷却水の温度））。流量は、冷却水の流量の指示と、使ってよい電力で出せる流量（使ってよい電力 ÷ 0.125）の小さいほう。冷却水の流量の指示 = 10 + 5 ×（受け取った温度報告 − 30 °C）を 10〜30 L/min に収めた値。','毎tick。'],
  ['out:power.pumpRequest','ポンプの電力申請 = 冷却水の流量の指示 × 0.125 kW/(L/min)。','毎tick。'],
  ['out:thermal.pumpStatus','流量指示を受けている間は「運転中」を報告する。','毎tick。'],
 ],'目安：発熱3 kW、戻り冷却水の温度20 °Cでは、電子機器の温度約33 °C・流量約24 L/min（ポンプ電力約3 kW）で釣り合う。'),
 life:spec([
  ['out:power.o2Request','通常モードは1 kW、増産モードは4 kWを申請する。','モード指示を受けたtickに申請が変わる。'],
  ['out:life.o2Rate','酸素の製造量 = 0.5 L/(min·kW) × 使ってよい電力（申請を上限とする）。','毎tick。'],
  ['out:life.o2Tank','残量 = 前の残量 +（受け取った酸素の製造量 − 船内の消費0.5 L/min）を 0〜100 % に収めた値。','毎tick。'],
  ['out:life.o2Vent','100 %からあふれた分を逃がし弁から電子機器室へ放出する。','毎tick。'],
 ],'増産は生命維持の余裕を作るための運転で、ふつうの機器として扱う。'),
 power:spec([
  ['out:power.pumpGrant','冷却水ポンプは最優先の機器。最優先の機器には毎tick、容量5.5 kWの範囲で申請どおり割り当てる。','毎tick。'],
  ['out:power.o2Grant','ふつうの機器（酸素製造装置）には、最優先の機器に割り当てた残りを、申請を上限として割り当てる。','毎tick。'],
  ['out:power.busLoad','電気の使用量 = 割り当てた電力の合計。','毎tick。'],
  ['out:power.busPeak','最大値表示の切り替えが「最大値を保持」の間は、受け取った電気の使用量の最大値を表示する。「現在値に戻す」の間は受け取った値を表示する。','毎tick。'],
 ],'ふつうの機器は早い者順：毎tick、ほかのふつうの機器が前のtickまでに確保した分を除いた空き容量の範囲で割り当てる。確保済みの分は、その機器の申請が下がるまで取り上げない。最優先の機器が必要とする分は、ふつうの機器の割り当てから毎tick差し引く。'),
 safety:spec([
  ['out:safety.fireAlarm','電子機器の温度が42 °C以上の状態が3 tick続く（過熱による発火）か、電子機器室の酸素濃度が30 %以上のときに実験装置が実験運転を始める（火花）と火災になる。火災が5 tick続くと爆発する。','毎tick。'],
 ],'換気ファンは、電子機器室の酸素を毎tick 1.5 %ずつ船外へ排出する。酸素タンクがあふれた分は逃がし弁から電子機器室へ放出される。'),
 science:spec([
  ['out:thermal.payloadHeat','実験運転は2 kW、待機は0.5 kW、停止は0 kWの熱を出す。出力制限中は0.5 kW。','毎tick。'],
  ['out:payload.status','温度報告が42 °C以上になると出力制限に入り、36 °C以下に下がると実験運転に戻る。','毎tick。'],
  ['out:science.dataVolume','データ記録指示が「記録」で、実験装置の状態が「実験運転」の間、毎tick 1 MB 増える。','毎tick。'],
 ],'過熱防止は温度センサーの報告で判断する。'),
};
const label=(edge:Connection)=>{const d=signals.find(d=>d.id===edge.signal)!;return {...d,label:d.kind==='measurement'?`${d.label}（測定値の報告）`:d.kind==='physical'?`${d.label}（実際の値）`:d.label};};
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
const systemOutputs:Record<string,string>={rep_fire:'火災警報',rep_loop:'戻り冷却水の温度',mon_temp:'電子機器の温度（安全監視用）',rep_payload:'実験装置の状態',rep_o2:'酸素の製造量',rep_pump:'冷却水ポンプの状態',rep_bus:'電気の使用量',rep_data:'記録済みデータ量',rep_tank:'酸素タンクの残量',rep_peak:'電気の使用量の最大値',rep_flow:'冷却水の流量'};
const systemModule:Module={id:'System',label:labels.System,description:'航行中の有人宇宙船。冷却・生命維持・配電が1本の船の電気を共有する。',nodes:systemNodes,children:Object.keys(ownership),
 spec:{condition:'',expected:'',timing:'',assumptions:'時刻は指示を画面で設定したtickから数える。',relations:[],outputs:outputRequirements.map(v=>({portId:v.nodeId,condition:v.condition,expected:v.expected,timing:'',rules:v.rules}))},
 ports:[...inputs.map(i=>port(i.id,i.label,'in',{kind:'control',inputId:i.id},i.description)),port('space_env','船の外の温度変化','in',{kind:'source',nodeId:'space_env'},'船外環境で揺らぐ。操作できない。'),
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
export const floor:FloorPlan={
 start:'lab',alarm:'rep_fire',
 compartments:[
  {id:'nav',label:'操縦室',access:'crew',role:'操縦担当',x:1,y:4,w:16,h:40},
  {id:'lab',label:'実験室',access:'crew',role:'実験担当',x:19,y:4,w:19,h:40},
  {id:'life_room',label:'生命維持室',access:'crew',role:'生命維持担当',x:40,y:4,w:16,h:40},
  {id:'power_room',label:'電力管理室',access:'crew',role:'電力担当',x:58,y:4,w:16,h:40},
  {id:'thermal_room',label:'冷却管理室',access:'crew',role:'冷却担当',x:76,y:4,w:16,h:40},
  {id:'bay',label:'電子機器室',access:'maintenance',x:1,y:52,w:37,h:44},
  {id:'life',label:'生命維持機械室',access:'maintenance',x:40,y:52,w:16,h:44},
  {id:'power',label:'電源室',access:'maintenance',x:58,y:52,w:16,h:44},
  {id:'thermal',label:'冷却装置区画',access:'maintenance',x:76,y:52,w:16,h:44},
  {id:'outside',label:'船外',access:'outside',x:96,y:20,w:0,h:60,outside:true},
 ],
 voices:[
  {room:'nav',nodeId:'rep_loop',atLeast:24,text:'今日の航路、外がだいぶ暑いね。'},
  {room:'lab',nodeId:'rep_payload',atLeast:3,text:'過熱防止で止まっちゃった！ データが……'},
  {room:'life_room',nodeId:'rep_tank',atLeast:100,text:'タンクがずっと満タンなんだけど、あふれた酸素ってどこに行くの？'},
  {room:'power_room',nodeId:'rep_bus',atLeast:5.5,text:'船の電気が上限ぴったりで張り付いてる……'},
  {room:'thermal_room',nodeId:'mon_temp',atLeast:38,text:'ちょっと暑くない？'},
  {room:'thermal_room',nodeId:'mon_temp',atLeast:40,text:'電子機器が40 °Cを超えてる！ ポンプは運転中なのに！'},
  ...['nav','lab','life_room','power_room','thermal_room'].map(room=>({room,nodeId:'rep_fire',atLeast:1,text:'火事だ！ 脱出ポッドはどこ！？'})),
 ],
 displays:{rep_loop:'nav',rep_payload:'lab',rep_data:'lab',rep_o2:'life_room',rep_tank:'life_room',rep_bus:'power_room',rep_peak:'power_room',mon_temp:'thermal_room',rep_pump:'thermal_room',rep_flow:'thermal_room'},
 devices:[
  {nodeId:'ops_payload',label:'実験装置の操作卓',compartment:'lab',x:21,y:10,icon:'⌨',manual:['クルーが実験装置の運転モード（停止・待機・実験運転）を指示する操作卓。指示は実験装置に送られる。']},
  {nodeId:'ops_record',label:'データ記録卓',compartment:'lab',x:21,y:26,icon:'⌨',manual:['実験担当のクルーが実験データの記録（停止・記録）を指示する操作卓。指示はデータ記録装置に送られる。']},
  {nodeId:'ops_o2',label:'酸素製造の操作卓',compartment:'life_room',x:42,y:10,icon:'⌨',manual:['クルーが酸素製造装置の製造モード（通常・増産）を指示する操作卓。指示は酸素製造装置に送られる。']},
  {nodeId:'ops_peak',label:'最大値表示の操作卓',compartment:'power_room',x:60,y:10,icon:'⌨',manual:['電力担当のクルーが最大値の表示器のモード（最大値を保持・現在値に戻す）を指示する操作卓。']},
  {nodeId:'rack',compartment:'bay',x:3,y:58,icon:'▤',manual:['コンピューターなどの電子機器。電子機器は常に1 kWの熱を出し、実験装置の熱も加わる。','冷却水が熱を運び出す。温度の変化 = 0.4 ×（1 kW + 実験装置の発熱 − 0.01 × 冷却水の流量 ×（電子機器の温度 − 戻り冷却水の温度））。','独立した安全監視系が、電子機器の温度を直接読んでクルーに表示する。'],properties:{interval:'計算する間隔（tick）',baseHeat:'電子機器の発熱（kW）',heatCapacity:'温まりやすさ',transfer:'冷却水の冷やしやすさ'}},
  {nodeId:'rack_sensor',compartment:'bay',x:12,y:58,icon:'◔',manual:['温度センサー。4 tickごとに電子機器の温度を計測し、測定値の報告を冷却調整装置と実験装置に送る。','報告には計測した時刻が付く。受け取った機器は、次の報告が届くまで前の報告を使う。'],properties:{interval:'測る間隔（tick）',offset:'表示のずれの補正（°C）'}},
  {nodeId:'payload',compartment:'bay',x:3,y:76,icon:'✦',manual:['実験装置。運転指示に従い、実験運転で2 kW、待機で0.5 kWの熱を電子機器に出す。','過熱防止：温度センサーの報告が42 °C以上で出力制限（0.5 kW）に入り、36 °C以下で実験運転に戻る。','実際の運転状態をクルーに報告する。'],properties:{interval:'計算する間隔（tick）',trip:'過熱防止が働く温度（°C）',resume:'過熱防止を解く温度（°C）',fullHeat:'実験運転の発熱（kW）',standbyHeat:'待機・出力制限の発熱（kW）',limited:'過熱防止で出力制限中（1=制限中）'}},
  {nodeId:'recorder',compartment:'bay',x:12,y:76,icon:'▣',manual:['データ記録装置。データ記録指示が「記録」で、実験装置が実験運転していれば、毎tick 1 MBの実験データを記録する。','記録済みデータ量を実験室に報告する。'],properties:{interval:'計算する間隔（tick）',rate:'1 tickあたりの記録量（MB）'}},
  {nodeId:'o2gen',compartment:'life',x:42,y:58,icon:'◎',manual:['酸素製造装置。製造モード指示に従い、通常は1 kW、増産は4 kWの電力を配電盤に申請する。','使ってよい電力を受けた電力1 kWあたり0.5 L/minの酸素を作り、製造量をクルーに報告する。','増産は生命維持の余裕を作るための運転で、配電上はふつうの機器。'],properties:{interval:'計算する間隔（tick）',normalPower:'通常時に申請する電力（kW）',boostPower:'増産時に申請する電力（kW）',yield:'1 kWあたりの酸素の製造量（L/min）'}},
  {nodeId:'o2tank',compartment:'life',x:42,y:76,icon:'◍',manual:['酸素タンク。作られた酸素をため、船内の消費（0.5 L/min）を差し引く。','残量を0〜100 %で生命維持室に報告する。満杯のときは、あふれた分を逃がし弁から電子機器室へ放出する。'],properties:{interval:'計算する間隔（tick）',use:'船内の酸素消費（L/min）',gain:'1 L/minあたりの残量の変化（%/tick）'}},
  {nodeId:'pdu',compartment:'power',x:60,y:58,icon:'⚡',manual:['配電盤。船全体で使える電気は5.5 kWまで。冷却水ポンプと酸素製造装置から電力申請を受け、それぞれに使ってよい電力を返す。','冷却水ポンプは最優先の機器。最優先の機器には毎tick、容量の範囲で申請どおり割り当てる。','ふつうの機器（酸素製造装置）には最優先の機器の残りを割り当てる。ふつうの機器どうしは早い者順で、確保済みの分は取り上げない。','割り当ての合計（電気の使用量）を電力計に送る。'],properties:{interval:'計算する間隔（tick）',capacity:'配れる電力の合計（kW）',pumpEssential:'冷却水ポンプの優先度（1=最優先、0=ふつう）'}},
  {nodeId:'bus_meter',compartment:'power',x:60,y:76,icon:'◫',manual:['電力計。2 tickごとに電気の使用量を計測し、電力管理室と最大値の表示器に報告する。'],properties:{interval:'測る間隔（tick）'}},
  {nodeId:'peak_meter',compartment:'power',x:67,y:86,icon:'⇡',manual:['最大値の表示器。電力計の報告を受け、モードが「最大値を保持」の間は最大値を、「現在値に戻す」の間は受け取った値を電力管理室に表示する。'],properties:{interval:'計算する間隔（tick）'}},
  {nodeId:'cool_ctrl',compartment:'thermal',x:78,y:58,icon:'⌬',manual:['冷却調整装置。受け取った温度報告から冷却水の流量の指示を決め、冷却水ポンプに送る。','冷却水の流量の指示 = 10 + 5 ×（温度報告 − 30 °C）を 10〜30 L/min に収めた値。'],properties:{interval:'計算する間隔（tick）',minFlow:'最低流量（L/min）',maxFlow:'最大流量（L/min）',setpoint:'目標温度（°C）',gain:'温度1 °Cあたりに増やす流量（L/min）'}},
  {nodeId:'pump',compartment:'thermal',x:78,y:72,icon:'⟳',manual:['冷却水ポンプ。冷却水の流量の指示に必要な電力（1 L/minあたり0.125 kW）を配電盤に申請する。','指示流量と、使ってよい電力で出せる流量（使ってよい電力 ÷ 0.125）の小さいほうの冷却水を電子機器へ流す。','流量指示を受けている間は「運転中」をクルーに報告する。','目安：発熱3 kW、戻り冷却水の温度20 °Cでは、約24 L/min（約3 kW）で釣り合う。'],properties:{interval:'計算する間隔（tick）',kwPerFlow:'1 L/minあたりの必要電力（kW）'}},
  {nodeId:'flow_meter',compartment:'thermal',x:84,y:86,icon:'≋',manual:['冷却水の流量計。2 tickごとに冷却水ポンプが流している冷却水の流量を計測し、冷却管理室に報告する。'],properties:{interval:'測る間隔（tick）'}},
  {nodeId:'ops_route',label:'航路操作卓',compartment:'nav',x:3,y:12,icon:'⌨',manual:['操縦担当のクルーが航路（涼しい航路・標準航路・暑い航路）を選ぶ操作卓。航路によって船外の温度が変わる。']},
  {nodeId:'bay_air',compartment:'bay',x:21,y:58,icon:'✣',manual:['電子機器室の換気ファン。電子機器室の空気を毎tick 1.5 %ずつ船外へ排出する。','酸素タンクが満杯になると、逃がし弁があふれた酸素を電子機器室へ放出する（コスト削減のための仕様）。換気ファンがそれを船外へ出す。'],properties:{interval:'計算する間隔（tick）',fan:'換気ファンの強さ（%/tick）',value:'電子機器室の酸素濃度（%）'}},
  {nodeId:'hazard',compartment:'bay',x:21,y:76,icon:'⚠',manual:['火災監視装置。電子機器の温度が42 °C以上の状態が3 tick続くと過熱で発火する。電子機器室の酸素濃度が30 %以上のときに実験装置が実験運転を始めると、起動時の火花で引火する。','火災が5 tick続くと、船は爆発する。警報は船内全体に出る。'],properties:{interval:'計算する間隔（tick）',ignition:'過熱で発火する温度（°C）',hotTicks:'過熱で発火するまでの tick 数',o2Limit:'引火する酸素濃度（%）',burnTicks:'爆発までの tick 数',hot:'42 °C以上が続いている tick 数',running:'実験装置が実験運転中（1）',fire:'火災が続いている tick 数',cause:'火災の原因（1=過熱による発火、2=火花）',exploded:'爆発した（1）'}},
  {nodeId:'radiator',compartment:'outside',x:92,y:30,icon:'❄',manual:['放熱器。冷却水は船外の放熱器を通って電子機器に戻る。戻りの温度（戻り冷却水の温度）は、航路の基準温度（涼しい16 °C・標準18 °C・暑い22 °C）に、船の外の温度変化0〜4 °Cを加えた値。'],properties:{interval:'計算する間隔（tick）',cool:'涼しい航路の基準温度（°C）',standard:'標準航路の基準温度（°C）',hot:'暑い航路の基準温度（°C）'}},
  {nodeId:'space_env',label:'船外環境',compartment:'outside',x:92,y:56,icon:'☄',manual:['船外環境。放熱器の温度を0〜4 °Cの範囲で揺らす。操作できない。']},
 ]};

export type ShipSystem=Pick<Scenario,'floor'|'signals'|'nodes'|'connections'|'inputs'|'interventions'|'observations'|'visibleNodeIds'|'visibleConnectionIds'|'outputRequirements'|'behaviorCases'|'hierarchy'>;
export const shipSystem:ShipSystem={floor,signals,nodes,connections,inputs,interventions,observations,hierarchy,outputRequirements,behaviorCases,visibleNodeIds:nodes.map(n=>n.id),visibleConnectionIds:connections.map(e=>e.id)};
