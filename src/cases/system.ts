import type {Scenario,ManualInput,Node,Connection} from '../engine';
import type {ContractExpr,ContractRule,BehaviorCase} from '../contracts';
import type {Hierarchy,Module,ModulePort,ModuleSpec} from '../hierarchy';
import type {ModuleMeaning,PortMeaning} from '../semanticModel';
import {r,op,n,e,signal,configure,editors,obs} from '../scenarioBuilders';

/**
 * One shared system that hosts every fault case. Every node contributes to at least one
 * system output; modules group nodes by function, not to add depth.
 *
 * Timing (healthy): a manual input set at t arrives at a timer computation at t+2. Each timer
 * stage adds one tick, and delivery to an OUTPUT adds one more.
 */
const clamp=(value:Parameters<typeof op>[1],lo:number,hi:Parameters<typeof op>[1])=>op('clamp',value,lo,hi);
const minus=(value:Parameters<typeof op>[1])=>op('multiply',-1,value);
const nodes:Node[]=[
 n('N01',0,0,r('param.level'),{level:8},8),
 n('N02',0,0,r('param.level'),{level:2},2),
 n('N03',0,0,r('param.enabled'),{enabled:0},0),
 n('N04',0,0,r('param.enabled'),{enabled:0},0),
 n('N05',0,0,r('param.enabled'),{enabled:0},0),
 n('N06',0,0,0,{},0),
 // Intake
 n('N07',0,0,r('input.supply'),{},8,'受信した値を一定の周期で取り込みます。'),
 // Load
 n('N08',0,0,op('pulse',r('param.period'),r('param.width'),1,0),{period:12,width:3},0,'periodごとにwidthステップだけ1を出力します。'),
 n('N09',0,0,op('multiply',r('input.signal'),r('param.load')),{load:2},0,'受信した値にloadを掛けます。'),
 // Reference
 n('N10',0,0,r('param.factor'),{factor:1},1,'問い合わせを受けたときにfactorを返します。'),
 n('N11',0,0,r('param.scale'),{scale:2},2,'問い合わせを受けたときにscaleを返します。'),
 // Preparation
 n('N12',0,0,op('multiply',r('input.request'),r('input.factor')),{},2,'受信した値に、問い合わせた係数を掛けます。'),
 n('N13',0,0,clamp(op('sum',r('input.supply'),minus(r('input.usage')),minus(r('input.load')),minus(r('input.external'))),0,30),{},6,'受信した値から、使用量・負荷・外部値を差し引きます。'),
 n('N14',0,0,op('switch',r('input.enabled'),clamp(op('sum',r('state.value'),op('multiply',r('param.rate'),clamp(op('sum',r('input.supply'),minus(r('input.usage'))),0,30))),0,24),0),{rate:1},0,'enabledが0以外の間、受信値の差をrate倍して保持値に加えます。0なら保持値を0に戻します。'),
 n('N15',0,0,op('threshold',r('input.charge'),24),{},0,'受信値が24以上なら1を出力します。'),
 // Conversion
 n('N16',0,0,clamp(op('sum',op('multiply',r('input.supply'),r('input.scale')),minus(r('input.external'))),0,r('param.ceiling')),{ceiling:30},16,'受信値に問い合わせた倍率を掛けて外部値を引き、0〜ceilingに収めます。'),
 n('N17',0,0,op('multiply',r('input.request'),r('input.scale')),{},4,'受信値に問い合わせた倍率を掛けます。'),
 // Setting
 n('N18',0,0,op('switch',r('input.capture'),r('input.level'),r('state.value')),{},0,'captureが0以外なら受信したlevelを、0なら保持値を出力します。'),
 n('N19',0,0,op('switch',r('input.capture'),r('input.level'),op('switch',r('input.use'),r('state.value'),op('multiply',r('state.value'),r('param.retention')))),{retention:1},0,'captureが0以外ならlevelを保持します。captureとuseがともに0の間は、保持値にretentionを掛けます。'),
 n('N20',0,0,op('switch',r('input.use'),op('switch',r('param.useAck'),r('input.ack'),r('input.held')),0),{useAck:0},0,'useが0以外なら保持値を出力し、0なら0を出力します。useAckが1なら別経路の値を使います。'),
 // System outputs
 signal('N21',0,0,16),signal('N22',0,0,6),signal('N23',0,0,0),signal('N24',0,0,0),signal('N25',0,0,0),
 signal('N26',0,0,4),signal('N27',0,0,0),signal('N28',0,0,0),signal('N29',0,0,8),signal('N30',0,0,0),
];
for(const node of nodes){const id=Number(node.id.slice(1));if(id<=6)node.kind='input';else if(id>=21)node.kind='output';}
const connections:Connection[]=[
 e('E01','N01','N07','supply'),e('E02','N01','N29'),
 e('E03','N08','N09'),e('E04','N09','N13','load'),e('E05','N09','N25'),
 e('E06','N02','N12','request'),e('E07','N10','N12','factor','request'),
 e('E08','N07','N13','supply'),e('E09','N12','N13','usage'),e('E10','N06','N13','external'),e('E11','N13','N22'),
 e('E12','N07','N14','supply'),e('E13','N12','N14','usage'),e('E14','N03','N14','enabled'),e('E15','N14','N15','charge'),e('E16','N14','N23'),e('E17','N15','N24'),
 e('E18','N07','N16','supply'),e('E19','N11','N16','scale','request'),e('E20','N06','N16','external'),e('E21','N16','N21'),
 e('E22','N02','N17','request'),e('E23','N11','N17','scale','request'),e('E24','N17','N26'),
 e('E25','N02','N18','level'),e('E26','N04','N18','capture'),
 e('E27','N02','N19','level'),e('E28','N04','N19','capture'),e('E29','N05','N19','use'),
 e('E30','N19','N20','held'),e('E31','N18','N20','ack'),e('E32','N05','N20','use'),
 e('E33','N18','N27'),e('E34','N20','N28'),e('E35','N06','N30'),
];
configure(nodes,connections,{N01:'level',N02:'level',N03:'enabled',N04:'enabled',N05:'enabled'},['N07','N08','N12','N13','N14','N15','N16','N17','N18','N19','N20'],['N10','N11']);
const external=nodes.find(node=>node.id==='N06')!;
external.parameters={};external.update={};external.trigger={type:'random',minInterval:3,maxInterval:7};external.externalInput={seed:20261017,value:{type:'uniform',min:0,max:1}};

const input=(id:string,label:string,description:string,max:number,defaultValue:number):ManualInput=>{const [nodeId,parameter]=id.split('.');return {id,nodeId,parameter,label,description,min:0,max,step:1,defaultValue};};
const inputs:ManualInput[]=[
 input('N01.level','N01.level','供給量。0〜16の整数。',16,8),
 input('N02.level','N02.level','要求量。0〜8の整数。',8,2),
 input('N03.enabled','N03.enabled','1で準備を進め、0で準備量を破棄します。',1,0),
 input('N04.enabled','N04.enabled','1の間、要求量を設定値として取り込みます。0なら直前の設定値を保ちます。',1,0),
 input('N05.enabled','N05.enabled','1の間、保持した設定値を出力します。0なら0を出力します。',1,0),
];

const interventions=editors(nodes,connections);
const tune=(id:string,patch:{min?:number;max?:number;step?:number})=>Object.assign(interventions.find(i=>i.id===id)!,patch);
tune('N10.factor',{max:4,step:.05});tune('N11.scale',{max:4,step:.05});tune('N14.rate',{max:3,step:.05});tune('N16.ceiling',{max:40});
tune('N19.retention',{max:1,step:.05});tune('N20.useAck',{max:1});tune('N08.width',{max:12});tune('N09.load',{step:.5});

// Executable output contracts. Lags count from the tick an input is applied.
const ci=(id:string,lag:number):ContractExpr=>({source:'input',id,lag});
const co=(id:string,lag:number):ContractExpr=>({source:'output',id,lag,initial:0});
const cx=(lag:number):ContractExpr=>({source:'external',id:'N06',lag,initial:0});
const c=(name:Exclude<ContractExpr,number|{source:string}>['op'],...args:ContractExpr[]):ContractExpr=>({op:name,args});
const sup='N01.level',req='N02.level',en='N03.enabled',cap='N04.enabled',use='N05.enabled';
const eq=(expected:ContractExpr,startAt=0):ContractRule=>({kind:'equals',expected,startAt});
const spare=(lag:number)=>c('clamp',c('sum',ci(sup,lag),c('multiply',-1,ci(req,lag))),0,30);
const value=c('clamp',c('sum',c('multiply',2,ci(sup,4)),c('multiply',-1,cx(2))),0,30);
const headroom=c('clamp',c('sum',ci(sup,4),c('multiply',-1,ci(req,4)),c('multiply',-1,c('pulse',12,3,2,3)),c('multiply',-1,cx(2))),0,30);
const charge=c('switch',ci(en,3),c('clamp',c('sum',co('N23',1),spare(4)),0,24),0);
const acknowledged=c('switch',ci(cap,3),ci(req,3),co('N27',1));
const outputRequirements:Scenario['outputRequirements']=[
 {nodeId:'N21',role:'変換値',condition:'t ≥ 6',expected:'N21[t] = min(30, max(0, 2 × N01.level[t−4] − N06[t−2]))',rules:[eq(value,6)]},
 {nodeId:'N22',role:'余力',condition:'t ≥ 6',expected:'N22[t] = min(30, max(0, N01.level[t−4] − N02.level[t−4] − ((t − 3) mod 12 < 3 ? 2 : 0) − N06[t−2]))',rules:[eq(headroom,6)]},
 {nodeId:'N23',role:'準備量',condition:'t ≥ 6。初期値0。',expected:'N23[t] = N03.enabled[t−3] ? min(24, N23[t−1] + max(0, N01.level[t−4] − N02.level[t−4])) : 0',rules:[eq(charge,6)]},
 {nodeId:'N24',role:'準備完了',condition:'t ≥ 6',expected:'N24[t] = (N23[t−1] ≥ 24 ? 1 : 0)',rules:[eq(c('threshold',co('N23',1),24),6)]},
 {nodeId:'N25',role:'周期負荷',condition:'t ≥ 6',expected:'N25[t] = ((t − 2) mod 12 < 3 ? 2 : 0)',rules:[eq(c('pulse',12,3,2,2),6)]},
 {nodeId:'N26',role:'要求の換算値',condition:'t ≥ 6',expected:'N26[t] = 2 × N02.level[t−3]',rules:[eq(c('multiply',2,ci(req,3)),6)]},
 {nodeId:'N27',role:'受理した設定値',condition:'全時刻。初期値0。',expected:'N27[t] = N04.enabled[t−3] ? N02.level[t−3] : N27[t−1]',rules:[eq(acknowledged)]},
 {nodeId:'N28',role:'設定値の使用結果',condition:'全時刻。初期値0。',expected:'N28[t] = N05.enabled[t−3] ? N27[t−1] : 0',rules:[eq(c('switch',ci(use,3),co('N27',1),0))]},
 {nodeId:'N29',role:'供給量の確認',condition:'全時刻',expected:'N29[t] = N01.level[t−2]',rules:[eq(ci(sup,2))]},
 {nodeId:'N30',role:'外部値の確認',condition:'全時刻',expected:'N30[t] = N06[t−1]、0 ≤ N30 < 1',rules:[eq(cx(1)),{kind:'range',min:0,max:1}]},
];

// Public acceptance cases. They are executable checks and are not shown in the initial UI,
// because some sequences would spoil the reproduction case.
const at=(time:number,id:string,value:number)=>({time,id,value});
const behaviorCases:BehaviorCase[]=[{name:'入力変更なし',steps:30,inputs:[]}];
for(const supply of [3,8,16])for(const request of [0,4])behaviorCases.push({name:`N01.level=${supply}・N02.level=${request}でN03.enabledを1→0→1`,steps:46,inputs:[at(0,sup,supply),at(0,req,request),at(1,en,1),at(28,en,0),at(34,en,1)]});
behaviorCases.push({name:'N01.levelを12→2→16→5と変更',steps:40,inputs:[at(1,sup,12),at(9,sup,2),at(18,sup,16),at(27,sup,5)]});
for(const seed of [12345,54321])behaviorCases.push({name:`N01.level・N02.level・N03.enabledを順に変更（N06のシード${seed}）`,seed,steps:56,inputs:[at(2,en,1),at(7,req,6),at(15,sup,14),at(22,req,1),at(30,en,0),at(33,en,1),at(41,sup,0)]});
behaviorCases.push({name:'N04.enabledは0のままN05.enabledを1',steps:24,inputs:[at(2,use,1)]},{name:'N05.enabledは0のままN04.enabledを1→0',steps:24,inputs:[at(1,cap,1),at(7,cap,0)]},{name:'N05.enabledを1にしてからN04.enabledを1→0',steps:30,inputs:[at(0,use,1),at(5,cap,1),at(11,cap,0)]},{name:'N04.enabledを1のままN05.enabledを1',steps:30,inputs:[at(0,cap,1),at(7,use,1),at(14,req,6)]},{name:'N04.enabledの0とN05.enabledの1を同時に変更',steps:30,inputs:[at(0,cap,1),at(7,cap,0),at(7,use,1)]});
for(const level of [1,4,8])for(const gap of [1,6])behaviorCases.push({name:`N02.level=${level}でN04.enabledを1→0、${gap}ステップ後にN05.enabledを1`,steps:44,inputs:[at(0,req,level),at(0,cap,1),at(6,cap,0),at(6+gap,use,1),at(22,use,0),at(26,cap,1),at(27,req,level-1),at(32,cap,0),at(35,use,1)]});

// Presentation-only hierarchy. Ports are derived from ownership; ids name each crossing.
const ownership:Record<string,string[]>={
 Intake:['N07'],Load:['N08','N09'],Reference:['N10','N11'],
 Accounting:['N12'],Balance:['N13'],Storage:['N14','N15'],
 Conversion:['N16','N17'],Control:['N18'],Holding:['N19'],Consumption:['N20'],
};
const tree:Record<string,string[]>={System:['Intake','Load','Reference','Preparation','Conversion','Setting'],Preparation:['Accounting','Balance','Storage'],Setting:['Control','Holding','Consumption']};
const systemNodes=nodes.filter(node=>node.kind!=='inner').map(node=>node.id);
const portNames:Record<string,Record<string,string>>={
 Intake:{E01:'sup',N07:'smp'},
 Load:{N09:'ld'},
 Reference:{N10:'fac',N11:'scl'},
 Preparation:{E04:'ld',E06:'req',E07:'fac',E08:'sup1',E10:'ext',E12:'sup2',E14:'en',N13:'hr',N14:'chg',N15:'rdy'},
 Accounting:{E06:'req',E07:'fac',N12:'usg'},
 Balance:{E04:'ld',E08:'sup',E09:'usg',E10:'ext',N13:'hr'},
 Storage:{E12:'sup',E13:'usg',E14:'en',N14:'chg',N15:'rdy'},
 Conversion:{E18:'sup',E19:'scl1',E20:'ext',E22:'req',E23:'scl2',N16:'val',N17:'dmd'},
 Setting:{E25:'lvl1',E26:'cap1',E27:'lvl2',E28:'cap2',E29:'act1',E32:'act2',N18:'ack',N20:'res'},
 Control:{E25:'lvl',E26:'cap',N18:'ack'},
 Holding:{E27:'lvl',E28:'cap',E29:'act',N19:'hld'},
 Consumption:{E30:'hld',E31:'ack',E32:'act',N20:'res'},
};
const row=(portId:string,expected:string,timing:string,condition='')=>({portId,expected,timing,condition});
const spec=(outputs:NonNullable<ModuleSpec['outputs']>,assumptions='INPUTは、そのモジュールの計算が最後に使った値。接続は値を加工しない。'):ModuleSpec=>({condition:'',expected:'',timing:'',assumptions,relations:[],outputs});
const specs:Record<string,ModuleSpec>={
 Intake:spec([row('smp','{{smp}}[t] = {{sup}}[t]','毎ステップ更新する。')]),
 Load:spec([row('ld','{{ld}}[t] = ((t − 1) mod 12 < 3 ? 2 : 0)','毎ステップ。周期12、幅3、大きさ2。')]),
 Reference:spec([row('fac','{{fac}} = 1','問い合わせに同期して応答する。問い合わせ元によらず同じ値。'),row('scl','{{scl}} = 2','問い合わせに同期して応答する。問い合わせ元によらず同じ値。')]),
 Preparation:spec([
  row('hr','{{hr}}[t] = min(30, max(0, {{sup1}}[t] − {{req}}[t−1] × {{fac}} − {{ld}}[t] − {{ext}}[t]))','毎ステップ。'),
  row('chg','{{chg}}[t] = {{en}}[t] ? min(24, {{chg}}[t−1] + max(0, {{sup2}}[t] − {{req}}[t−1] × {{fac}})) : 0','毎ステップ。初期値0。'),
  row('rdy','{{rdy}}[t] = ({{chg}}[t−1] ≥ 24 ? 1 : 0)','毎ステップ。'),
 ]),
 Accounting:spec([row('usg','{{usg}}[t] = {{req}}[t] × {{fac}}','毎ステップ。係数は計算開始時に問い合わせる。')]),
 Balance:spec([row('hr','{{hr}}[t] = min(30, max(0, {{sup}}[t] − {{usg}}[t] − {{ld}}[t] − {{ext}}[t]))','毎ステップ。')]),
 Storage:spec([row('chg','{{chg}}[t] = {{en}}[t] ? min(24, {{chg}}[t−1] + max(0, {{sup}}[t] − {{usg}}[t])) : 0','毎ステップ。初期値0。'),row('rdy','{{rdy}}[t] = ({{chg}}[t−1] ≥ 24 ? 1 : 0)','毎ステップ。')]),
 Conversion:spec([row('val','{{val}}[t] = min(30, max(0, {{sup}}[t] × {{scl1}} − {{ext}}[t]))','毎ステップ。倍率は計算開始時に問い合わせる。'),row('dmd','{{dmd}}[t] = {{req}}[t] × {{scl2}}','毎ステップ。倍率は計算開始時に問い合わせる。')]),
 Setting:spec([row('ack','{{ack}}[t] = {{cap1}}[t] ? {{lvl1}}[t] : {{ack}}[t−1]','毎ステップ。初期値0。'),row('res','{{res}}[t] = {{act2}}[t] ? {{ack}}[t−1] : 0','毎ステップ。初期値0。')]),
 Control:spec([row('ack','{{ack}}[t] = {{cap}}[t] ? {{lvl}}[t] : {{ack}}[t−1]','毎ステップ。初期値0。')]),
 Holding:spec([row('hld','{{hld}}[t] = {{cap}}[t] ? {{lvl}}[t] : {{hld}}[t−1]','毎ステップ。初期値0。使用の有無によらず保持する。')]),
 Consumption:spec([row('res','{{res}}[t] = {{act}}[t] ? {{hld}}[t] : 0','毎ステップ。')]),
};
const members=(id:string):string[]=>[...(ownership[id]??(id==='System'?systemNodes:[])),...(tree[id]??[]).flatMap(members)];
const port=(id:string,direction:'in'|'out',binding:ModulePort['binding']):ModulePort=>({id,label:id,direction,binding,observable:true,description:''});
function modulePorts(id:string):ModulePort[]{
 const owned=new Set(members(id)),names=portNames[id],ports:ModulePort[]=[];
 for(const edge of connections){
  if(owned.has(edge.to)&&!owned.has(edge.from))ports.push(port(names[edge.id],'in',{kind:'input',connectionId:edge.id}));
  if(owned.has(edge.from)&&!owned.has(edge.to)&&!ports.some(p=>p.binding.kind==='output'&&p.binding.nodeId===edge.from))ports.push(port(names[edge.from],'out',{kind:'output',nodeId:edge.from}));
 }
 if(ports.some(p=>!p.id))throw Error(`Unnamed port in ${id}`);
 return ports;
}
const systemInputIds=['sup','req','en','cap','act'];
const systemOutputIds:Record<string,string>={N21:'val',N22:'hr',N23:'chg',N24:'rdy',N25:'ld',N26:'dmd',N27:'ack',N28:'res',N29:'se',N30:'xe'};
const systemModule:Module={id:'System',label:'System',description:'',nodes:systemNodes,children:tree.System,spec:spec(outputRequirements.map(v=>({portId:systemOutputIds[v.nodeId],condition:v.condition,expected:v.expected,timing:'',rules:v.rules})),'時刻は入力を反映した時点から数える。'),ports:[
 ...inputs.map((v,i)=>port(systemInputIds[i],'in',{kind:'control',inputId:v.id})),port('ext','in',{kind:'source',nodeId:'N06'}),
 ...Object.entries(systemOutputIds).map(([nodeId,id])=>port(id,'out',{kind:'output',nodeId})),
]};
const modules:Module[]=[systemModule,...[...Object.keys(tree),...Object.keys(ownership)].filter(id=>id!=='System').map(id=>({id,label:id,description:'',nodes:ownership[id]??[],children:tree[id]??[],ports:modulePorts(id),spec:specs[id]}))];

const pm=(name:string,role:string):PortMeaning=>({name,role});
const meaning=(name:string,purpose:string,ports:Record<string,PortMeaning>,assumptions:string[]=[],constraints:string[]=[]):ModuleMeaning=>({name,purpose,ports,assumptions,constraints});
const P={
 sup:pm('Supply','利用できる資源の量。'),smp:pm('SampledSupply','一定周期で取り込んだ供給量。'),req:pm('Request','使用を求める量。'),en:pm('Prepare','1の間は準備を進め、0なら準備量を破棄する。'),
 cap:pm('Capture','1の間、要求量を設定値として取り込む。'),act:pm('Use','1の間、保持した設定値を使う。'),ext:pm('ExternalUse','編集できない外部からの消費。'),
 ld:pm('PeriodicLoad','一定周期で発生する負荷。'),fac:pm('UsageFactor','要求を資源の使用量へ換算する係数。'),scl:pm('UnitScale','供給と要求を出力単位へ換算する倍率。'),
 usg:pm('Usage','換算後の使用量。'),hr:pm('Headroom','使用量・負荷・外部消費を差し引いた余力の見積もり。'),chg:pm('Charge','準備に回した量の累積。'),rdy:pm('Ready','準備量が上限に達したことを示す。'),
 val:pm('Output','供給量を出力単位に換算した値。'),dmd:pm('Demand','要求量を出力単位に換算した値。'),ack:pm('Acknowledged','受理した設定値。'),hld:pm('Held','使用に備えて保持している設定値。'),res:pm('Result','設定値を使った結果。'),
 se:pm('SupplyEcho','供給量の受信確認。'),xe:pm('ExternalEcho','外部消費の受信確認。'),
};
const alias=(base:PortMeaning,name:string)=>({...base,name});
const semantics:Hierarchy['semantics']={modules:{
 System:meaning('Resource plant','供給を取り込み、余力の見積もり・準備・出力単位への換算・設定値の受理と使用を行う。',{...P,sup:P.sup,req:P.req,en:P.en,cap:P.cap,act:P.act,ext:P.ext},['供給0〜16、要求0〜8、各スイッチ0/1。'],['余力は0〜30、準備量は0〜24、換算値は0〜30に収める。']),
 Intake:meaning('Supply intake','供給量を一定周期で取り込み、後段の処理へ渡す。',{sup:P.sup,smp:P.smp},['取り込みは毎ステップ。'],['取り込んだ値は加工しない。']),
 Load:meaning('Periodic load','設備が一定周期で消費する負荷を発生させる。',{ld:P.ld},[],['負荷の周期と大きさは仕様で固定。']),
 Reference:meaning('Shared conventions','複数の処理が問い合わせる換算の基準を保持する。',{fac:P.fac,scl:P.scl},['問い合わせ元ごとに別の値を返さない。'],['設定が変わらない限り同じ値を返す。']),
 Preparation:meaning('Preparation','要求を使用量に換算し、余力を見積もる。稼働中は使える量を準備量として蓄積する。',{ld:P.ld,req:P.req,fac:P.fac,sup1:alias(P.smp,'MonitorSupply'),sup2:alias(P.smp,'BufferSupply'),ext:P.ext,en:P.en,hr:P.hr,chg:P.chg,rdy:P.rdy},['余力と準備量は同じ資源単位を使う。'],['余力の見積もりは資源を消費しない。']),
 Accounting:meaning('Usage accounting','要求を共通の係数で使用量に換算する。',{req:P.req,fac:P.fac,usg:P.usg},[],['係数は計算のたびに問い合わせる。']),
 Balance:meaning('Headroom monitor','供給から使用量・周期負荷・外部消費を差し引いて余力を見積もる。',{sup:P.smp,usg:P.usg,ld:P.ld,ext:P.ext,hr:P.hr},[],['不足時は0とする。']),
 Storage:meaning('Preparation buffer','稼働中、供給と使用量の差を毎ステップ準備量に加える。差が小さいほど完了まで長くかかる。',{sup:P.smp,usg:P.usg,en:P.en,chg:P.chg,rdy:P.rdy},['周期負荷と外部消費は準備には影響しない。'],['準備量は24で止まり、完了は次のステップに反映する。']),
 Conversion:meaning('Unit conversion','供給量と要求量を、共通の倍率で出力単位に換算する。',{sup:P.smp,scl1:alias(P.scl,'OutputScale'),scl2:alias(P.scl,'DemandScale'),ext:P.ext,req:P.req,val:P.val,dmd:P.dmd},[],['換算値は0〜30に収める。']),
 Setting:meaning('Setting store','要求量を設定値として受理・保持し、使用の指示で取り出す。',{lvl1:alias(P.req,'ControlLevel'),cap1:alias(P.cap,'ControlCapture'),lvl2:alias(P.req,'StoredLevel'),cap2:alias(P.cap,'StoredCapture'),act1:alias(P.act,'HoldUse'),act2:alias(P.act,'OutputUse'),ack:P.ack,res:P.res},[],['使用していない間も、受理した設定値を保つ。']),
 Control:meaning('Capture control','取り込み中の要求量を受理し、取り込みを止めても受理した値を保つ。',{lvl:P.req,cap:P.cap,ack:P.ack}),
 Holding:meaning('Setting retention','使用の有無と無関係に、取り込んだ設定値を保持する。',{lvl:P.req,cap:P.cap,act:P.act,hld:P.hld},[],['保持値は使用していない間も変えない。']),
 Consumption:meaning('Setting use','使用中は保持した設定値を出力し、使用していなければ0を出力する。',{hld:P.hld,ack:P.ack,act:P.act,res:P.res}),
}};
const hierarchy:Hierarchy={systemId:'System',roots:['System'],modules,semantics,
 inputs:inputs.map((v,i)=>({inputId:v.id,moduleId:'System',portId:systemInputIds[i],label:v.label})),
 outputs:Object.entries(systemOutputIds).map(([nodeId,portId])=>({nodeId,moduleId:'System',portId,label:nodeId})),
};

/** Everything a fault case shares. Cases add faults, reports, hints and the debrief. */
export type SharedSystem=Pick<Scenario,'nodes'|'connections'|'inputs'|'interventions'|'observations'|'visibleNodeIds'|'visibleConnectionIds'|'outputRequirements'|'behaviorCases'|'hierarchy'>;
export const sharedSystem:SharedSystem={nodes,connections,inputs,interventions,hierarchy,outputRequirements,behaviorCases,
 observations:[...nodes.map(v=>obs(v.id)),...connections.map(v=>obs(v.id))],visibleNodeIds:nodes.map(v=>v.id),visibleConnectionIds:connections.map(v=>v.id)};
