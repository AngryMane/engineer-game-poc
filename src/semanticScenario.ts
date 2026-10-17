import type {Scenario,ManualInput} from './engine';
import type {ContractExpr,BehaviorCase} from './contracts';
import type {Hierarchy,Module,ModulePort,ModuleSpec} from './hierarchy';
import type {ModuleMeaning,PortMeaning} from './semanticModel';
import {r,op,n,e,signal,configure,editors,obs} from './scenarioBuilders';
const positive=(...args:Parameters<typeof op>[1][])=>op('clamp',op('sum',...args),0,30);
const nodes=[
 n('N01',80,80,r('param.level'),{level:10},10),n('N02',80,220,r('param.level'),{level:2},2),n('N03',80,360,r('param.enabled'),{enabled:0},0),n('N04',80,500,0,{},0),
 n('N05',260,500,r('param.factor'),{factor:1},1),
 n('N06',260,80,op('multiply',r('input.request'),r('input.factor')),{},2),
 n('N07',440,80,positive(r('input.supply'),op('multiply',-1,r('input.usage'),r('param.correction')),op('multiply',-1,r('input.external'))),{correction:1},8),signal('N08',800,80,8),
 n('N09',260,240,op('multiply',r('input.request'),r('input.factor')),{},2),
 n('N10',440,240,op('switch',r('input.enabled'),op('clamp',op('sum',r('state.value'),positive(r('input.supply'),op('multiply',-1,r('input.usage'),r('param.correction')),op('multiply',-1,r('input.external')))),0,24),0),{correction:1},0),signal('N11',800,240),
 n('N12',620,360,op('threshold',r('input.signal'),24)),signal('N13',800,360),signal('N14',800,500,2),signal('N15',800,640),
];
for(const id of ['N01','N02','N03','N04'])nodes.find(n=>n.id===id)!.kind='input';
for(const id of ['N08','N11','N13','N14','N15'])nodes.find(n=>n.id===id)!.kind='output';
const edges=[e('E01','N02','N06','request'),e('E02','N05','N06','factor','request'),e('E03','N06','N07','usage'),e('E04','N01','N07','supply'),e('E05','N04','N07','external'),e('E06','N07','N08'),e('E07','N02','N09','request'),e('E08','N05','N09','factor','request'),e('E09','N09','N10','usage'),e('E10','N01','N10','supply'),e('E11','N04','N10','external'),e('E12','N03','N10','enabled'),e('E13','N10','N11'),e('E14','N10','N12'),e('E15','N12','N13'),e('E16','N02','N14'),e('E17','N04','N15')];
configure(nodes,edges,{N01:'level',N02:'level',N03:'enabled'},['N01','N06','N07','N09','N10'],['N05']);
const external=nodes.find(n=>n.id==='N04')!;external.parameters={};external.trigger={type:'random',minInterval:3,maxInterval:7};external.update={};external.externalInput={seed:20261017,value:{type:'uniform',min:0,max:1}};
const inputs:ManualInput[]=[['N01','level',10,0,16],['N02','level',2,0,8],['N03','enabled',0,0,1]].map(([id,key,value,min,max])=>({id:`${id}.${key}`,nodeId:String(id),parameter:String(key),label:`${id}.${key}`,description:'',defaultValue:Number(value),min:Number(min),max:Number(max),step:1}));
const input=(id:string,lag:number):ContractExpr=>({source:'input',id,lag});
const delta:ContractExpr={op:'clamp',args:[{op:'sum',args:[input('N01.level',3),{op:'multiply',args:[-1,input('N02.level',4)]},{op:'multiply',args:[-1,{source:'external',id:'N04',lag:2,initial:0}]}]},0,30]};
const charge:ContractExpr={op:'switch',args:[input('N03.enabled',3),{op:'clamp',args:[{op:'sum',args:[{source:'output',id:'N11',lag:1,initial:0},delta]},0,24]},0]};
const behaviorCases:BehaviorCase[]=[];
for(const supply of [4,8,12])for(const demand of [0,2,4])behaviorCases.push({name:`s=${supply}, d=${demand}`,steps:38,inputs:[{time:0,id:'N01.level',value:supply},{time:0,id:'N02.level',value:demand},{time:1,id:'N03.enabled',value:1},{time:22,id:'N03.enabled',value:0},{time:28,id:'N03.enabled',value:1}]});
for(const seed of [12345,54321])behaviorCases.push({name:`changes / ${seed}`,seed,steps:58,inputs:[{time:2,id:'N03.enabled',value:1},{time:9,id:'N02.level',value:5},{time:17,id:'N01.level',value:6},{time:25,id:'N03.enabled',value:0},{time:28,id:'N02.level',value:1},{time:32,id:'N03.enabled',value:1},{time:42,id:'N01.level',value:0}]});
behaviorCases.push({name:'idle',steps:24,inputs:[]});
const port=(id:string,direction:'in'|'out',binding:ModulePort['binding']):ModulePort=>({id,label:id,direction,binding,observable:true,description:''});
const incoming=(id:string,connectionId:string)=>port(id,'in',{kind:'input',connectionId});
const outgoing=(id:string,nodeId:string)=>port(id,'out',{kind:'output',nodeId});
const spec=(outputs:NonNullable<ModuleSpec['outputs']>,assumptions='All delays are ticks. INPUT values are the last values consumed by the owning computation.'):ModuleSpec=>({condition:'',expected:'',timing:'',assumptions,relations:[],outputs});
const row=(portId:string,expected:string,timing='',condition='All input values within the declared ranges.')=>({portId,expected,timing,condition});
const modules:Module[]=[
 {id:'System',label:'System',description:'',nodes:['N01','N02','N03','N04','N08','N11','N13','N14','N15'],children:['Core'],ports:[port('s','in',{kind:'control',inputId:'N01.level'}),port('d','in',{kind:'control',inputId:'N02.level'}),port('e','in',{kind:'control',inputId:'N03.enabled'}),port('x','in',{kind:'source',nodeId:'N04'}),outgoing('a','N08'),outgoing('b','N11'),outgoing('r','N13'),outgoing('q','N14'),outgoing('z','N15')],spec:spec([])},
 {id:'Core',label:'Core',description:'',nodes:[],children:['Balance','Storage','Accounting'],ports:[incoming('d1','E01'),incoming('d2','E07'),incoming('s1','E04'),incoming('s2','E10'),incoming('x1','E05'),incoming('x2','E11'),incoming('e','E12'),outgoing('a','N07'),outgoing('b','N10'),outgoing('r','N12')],spec:spec([
  row('a','{{a}}[t] = max(0, {{s1}}[t] − {{d1}}[t−1] − {{x1}}[t])','Every tick.'),
  row('b','{{b}}[t] = {{e}}[t] ? min(24, {{b}}[t−1] + max(0, {{s2}}[t] − {{d2}}[t−1] − {{x2}}[t])) : 0','Initial value 0; every tick.'),
  row('r','{{r}}[t] = ({{b}}[t−1] ≥ 24 ? 1 : 0)','Every input event.'),
 ])},
 {id:'Balance',label:'Balance',description:'',nodes:['N06','N07'],children:[],ports:[incoming('d','E01'),incoming('k','E02'),incoming('s','E04'),incoming('x','E05'),outgoing('a','N07')],spec:spec([row('a','{{a}}[t] = max(0, {{s}}[t] − {{d}}[t−1] × {{k}}[t−1] − {{x}}[t])','Every tick.')])},
 {id:'Storage',label:'Storage',description:'',nodes:['N09','N10','N12'],children:[],ports:[incoming('d','E07'),incoming('k','E08'),incoming('s','E10'),incoming('x','E11'),incoming('e','E12'),outgoing('b','N10'),outgoing('r','N12')],spec:spec([
  row('b','{{b}}[t] = {{e}}[t] ? min(24, {{b}}[t−1] + max(0, {{s}}[t] − {{d}}[t−1] × {{k}}[t−1] − {{x}}[t])) : 0','Initial value 0; every tick.'),row('r','{{r}}[t] = ({{b}}[t−1] ≥ 24 ? 1 : 0)','Every input event.')
 ])},
 {id:'Accounting',label:'Accounting',description:'',nodes:[],children:['Calibration'],ports:[outgoing('k','N05')],spec:spec([row('k','{{k}} > 0; identical configured value for every caller.','Synchronous fetch.')])},
 {id:'Calibration',label:'Calibration',description:'',nodes:['N05'],children:[],ports:[outgoing('k','N05')],spec:spec([row('k','{{k}} = configured factor.','Synchronous fetch; no caller-specific state.')])},
];
const pm=(name:string,role:string):PortMeaning=>({name,role});
const meaning=(name:string,purpose:string,ports:Record<string,PortMeaning>,assumptions:string[]=[],constraints:string[]=[]):ModuleMeaning=>({name,purpose,ports,assumptions,constraints});
const supply=pm('Supply','利用できる資源量。'),demand=pm('Request','使用する資源の要求量。'),noise=pm('ExternalUse','編集できない外部からの消費。'),enabled=pm('Enable','1の間は準備を進め、0なら準備量を破棄する。'),available=pm('Headroom','使用分と外部消費を差し引いた余剰量の見積もり。'),stored=pm('Charge','準備に使える量の累積。'),ready=pm('Ready','準備量が規定の上限に達したことを示す。'),factor=pm('UsageScale','要求を資源使用量へ換算する共通の基準。');
const hierarchy:Hierarchy={systemId:'System',roots:['System'],modules,inputs:inputs.map((input,i)=>({inputId:input.id,moduleId:'System',portId:['s','d','e'][i],label:input.label})),outputs:['N08','N11','N13','N14','N15'].map((nodeId,i)=>({nodeId,moduleId:'System',portId:['a','b','r','q','z'][i],label:nodeId})),semantics:{modules:{
 System:meaning('Resource system','資源の余力を見積もり、稼働中は余剰を準備量として蓄積する。余力と準備完了は、異なる見方で稼働の状態を示す。',{s:supply,d:demand,e:enabled,x:noise,a:available,b:stored,r:ready,q:pm('RequestEcho','要求が届いたことの確認。'),z:pm('ExternalEcho','外部消費の確認。')},['供給0〜16、要求0〜8、稼働0/1。'],['準備量0〜24、余力は負にしない。']),
 Core:meaning('Coordination','余剰の見積もりと、時間をかけて進む準備を組み合わせる。準備が遅いことは、準備処理の速度だけでなく、その間に使える資源量からも説明できる。',{d1:{...demand,name:'MonitorRequest'},d2:{...demand,name:'BufferRequest'},s1:{...supply,name:'MonitorSupply'},s2:{...supply,name:'BufferSupply'},x1:{...noise,name:'MonitorExternal'},x2:{...noise,name:'BufferExternal'},e:enabled,a:available,b:stored,r:ready},['各経路は同じ資源単位を使う。'],['余剰の見積もり自体は資源を消費しない。']),
 Balance:meaning('Headroom monitor','要求を使用量へ換算し、供給から使用量と外部消費を差し引く。出力は余剰の見積もりであり、ここで資源を実際に消費する処理ではない。',{d:demand,k:factor,s:supply,x:noise,a:available},['供給と使用量は同じ資源単位で比較する。'],['不足時は余力を0とする。']),
 Storage:meaning('Preparation buffer','稼働中に使える余剰を準備量として毎回加算する。余剰が小さければ完了まで長くかかり、余剰がなければ進まない。停止すると蓄積を破棄する。',{d:demand,k:factor,s:supply,x:noise,e:enabled,b:stored,r:ready},['稼働中のみ加算する。'],['準備量は上限で止まり、完了信号は蓄積の次のステップに反映する。']),
 Accounting:meaning('Usage convention','要求を使用量へ換算するときの基準を提供する。利用側ごとに別の基準を返さず、同じ単位で計上できるようにする。',{k:factor},['利用側で基準を受け取って換算する。'],['設定は問い合わせ相手に依存しない。']),
 Calibration:meaning('Usage reference','換算の基準を保持し、問い合わせに応じて返す。過去の問い合わせ回数で値は変わらない。',{k:factor},[],['基準の値は現在の設定に従う。']),
}}};
const interventions=editors(nodes,edges);for(const id of ['N07.correction','N10.correction'])interventions.find(i=>i.id===id)!.step=.05;
export const semanticScenario:Scenario={id:'semantics',title:'07 / Two deviations',description:'Semantic comparison',hierarchy,nodes,connections:edges,inputs,observations:[...nodes.map(n=>obs(n.id)),...edges.map(e=>obs(e.id))],interventions,visibleNodeIds:nodes.map(n=>n.id),visibleConnectionIds:edges.map(e=>e.id),faults:[{id:'F07',targetId:'N05',key:'value',parameter:'factor',mode:'gain_change',startStep:0,severity:2}],
 symptom:'余力の低下と準備完了の遅れを比較する。',briefing:{conditions:'',expected:'Outputs follow the published relations under input changes and external variation.',expectedFlow:[],difference:'',firstAction:''},
 outputRequirements:[
 {nodeId:'N08',role:'a',condition:'t ≥ 4',expected:'a[t] = max(0, s[t−3] − d[t−4] − x[t−2])',rules:[{kind:'equals',expected:delta,startAt:4}]},
 {nodeId:'N11',role:'b',condition:'All ticks',expected:'b[t] = e[t−3] ? min(24, b[t−1] + max(0, s[t−3] − d[t−4] − x[t−2])) : 0; b initial = 0',rules:[{kind:'equals',expected:charge}]},
 {nodeId:'N13',role:'r',condition:'All ticks',expected:'r[t] = (b[t−1] ≥ 24 ? 1 : 0)',rules:[{kind:'equals',expected:{op:'threshold',args:[{source:'output',id:'N11',lag:1,initial:0},24]}}]},
 {nodeId:'N14',role:'q',condition:'All ticks',expected:'q[t] = d[t−2]',rules:[{kind:'equals',expected:input('N02.level',2)}]},
 {nodeId:'N15',role:'z',condition:'All ticks',expected:'z[t] = x[t−1]; 0 ≤ z < 1',rules:[{kind:'equals',expected:{source:'external',id:'N04',lag:1,initial:0}},{kind:'range',min:0,max:1}]},
 ],behaviorCases,hints:['要求を0にした場合も二つの症状が残るか比較してください。','余力と、準備量が1ステップで増える量を比較してください。','二つの機能が要求をどの単位で扱うか、公開された境界と仕様で比較してください。'],
 solution:{rootCauseIds:['N05'],stableSteps:16,causalPath:['Usage convention','Headroom monitor / Preparation buffer','Headroom / Charge / Ready'],explanation:'共通の換算係数が1から2に変わり、要求が過大に計上されていました。余剰の見積もりが減り、同時に準備量の増加も小さくなります。',observations:'要求を0にすると影響が消え、要求を増やすと余力の不足と準備の遅れがともに大きくなります。外部消費の履歴だけでは、この要求依存性を説明できません。',misleading:'共通係数を修正するほか、余力側と準備側のcorrectionをそれぞれ0.5にする修復も全ケースを満たします。一方だけの修正や出力の固定は通りません。'},
};
const system=modules[0];system.spec.cases=behaviorCases;system.spec.outputs=semanticScenario.outputRequirements.map((v,i)=>({portId:['a','b','r','q','z'][i],condition:v.condition,expected:v.expected,timing:'',rules:v.rules}));

hierarchy.semantics!.hints={abstract:[
 'Set InputB to 0; compare OutputA and changes in OutputB.',
 'Compare OutputB[t] − OutputB[t−1] with OutputA while InputC = 1.',
 'Compare the conversion inputs used by Module C and Module D, then test one shared-input hypothesis.',
],functional:semanticScenario.hints};

hierarchy.semantics!.abstractDebrief={
 explanation:'N05.factor changed from1 to2. N06 and N09 multiply N02 by the value fetched from N05. This lowers the difference computed by N07 and the increments accumulated by N10.',
 observations:'With N02 = 0, both deviations disappear. With a larger N02, both grow. The N04 trace and N14 echo do not account for the change.',
 misleading:'N05.factor = 1 or N07.correction = N10.correction = 0.5 satisfies all cases. Changing only one branch or freezing outputs fails.',
 causalPath:['N05','N06 / N09','N07 / N10','N08 / N11 / N13'],
};
