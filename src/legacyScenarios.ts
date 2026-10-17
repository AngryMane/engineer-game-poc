import {reproductionScenario} from './reproductionScenario';
import {semanticScenario} from './semanticScenario';
import type {ContractExpr,ContractRule,BehaviorCase} from './contracts';
import type {Scenario,ManualInput} from './engine';
import {r,op,n,e,obs,signal,configure,editors} from './scenarioBuilders';
import {additionalScenarios} from './additionalScenarios';
import {hierarchyScenario} from './hierarchyScenario';
const tutorialNodes=[n('N01',80,130,r('param.level'),{level:8},8,'外部入力。level を変更して伝播を調べます。'),n('N02',300,130,op('multiply',r('input.signal'),0.5),{},4,'入力信号を一定の比率で変換します。'),signal('N03',520,130,4,'この経路の出力。入力変更が届く時刻を計測します。')];
const tutorialEdges=[e('E01','N01','N02'),e('E02','N02','N03')];
tutorialNodes[0].kind='input';tutorialNodes[2].kind='output';
const tutorialInputs:ManualInput[]=[{id:'N01.level',nodeId:'N01',parameter:'level',label:'level',description:'システムへ渡す信号の大きさを指定します。',min:0,max:20,step:0.05,defaultValue:8}];
configure(tutorialNodes,tutorialEdges,{N01:'level'});
const tutorialEdits=editors(tutorialNodes,tutorialEdges);
// Retain only processing paths that contribute to system outputs.
const nodes1=[
 n('N01',90,85,r('param.capacity'),{capacity:10},10,'capacityに設定した値を出力します。intervalで出力間隔を指定します。'),
 n('N02',265,85,op('clamp',op('sum',r('input.supply'),op('multiply',-1,r('input.load'))),0,30),{},10,'N01から受信した値から、N06・N12から受信した値の合計を引きます。'),
 signal('N03',440,85,10),signal('N04',615,85,10,'N03から受信した値を表示します。値が下がる時刻と戻る時刻を比較できます。'),
 n('N05',90,235,op('multiply',r('param.enabled'),op('pulse',r('param.period'),3,1,0)),{enabled:1,period:12},0,'1と0を繰り返し出力します。enabledで有効・無効、periodで繰り返す間隔を変更できます。'),
 n('N06',265,235,op('multiply',r('input.signal'),r('param.load')),{load:2},0,'N05から受信した値にloadを掛けます。'),
 signal('N07',440,235),signal('N08',615,235,0,'N07から受信した値を表示します。'),
 n('N09',90,385,op('multiply',r('param.enabled'),op('pulse',r('param.period'),4,1,0)),{enabled:1,period:18},0,'別の周期を持つ信号を生成する内部処理。'),
 n('N10',265,385,op('multiply',r('input.signal'),0.5)),signal('N11',440,385),signal('N12',615,385,0,'N11から受信した値を出力します。'),

];
const edges1=[e('E01','N01','N02','supply','resource'),e('E02','N02','N03'),e('E03','N03','N04'),e('E04','N05','N06'),e('E05','N06','N07'),e('E06','N07','N08'),e('E07','N06','N02','load','resource'),e('E08','N09','N10'),e('E09','N10','N11'),e('E10','N11','N12'),e('E11','N12','N02','load','resource')];
nodes1.push(signal('N13',790,385,0,'12ステップごとに、1を3ステップ、0を9ステップ表示します。'),signal('N14',790,535,0,'18ステップごとに、0.5を4ステップ、0を14ステップ表示します。'));
edges1.push(e('E12','N05','N13'),e('E13','N12','N14'));
for(const id of ['N13','N14'])nodes1.find(n=>n.id===id)!.kind='output';
nodes1[0].kind='input';nodes1.find(n=>n.id==='N04')!.kind='output';nodes1.find(n=>n.id==='N08')!.kind='output';
nodes1.filter(n=>n.kind==='output').forEach(n=>{n.x=790;});
configure(nodes1,edges1,{N01:'capacity'},['N01','N05','N09']);
const disturbance=n('N15',90,535,0,{},0,'外部から届く負荷。プレイヤーは値・発火間隔・乱数設定を編集できません。');
disturbance.kind='input';disturbance.parameters={};disturbance.update={};disturbance.trigger={type:'random',minInterval:3,maxInterval:7};disturbance.externalInput={seed:20261017,value:{type:'uniform',min:0,max:0.4}};
nodes1.push(disturbance,n('N16',440,685,op('clamp',op('sum',r('input.supply'),op('multiply',-1,r('input.disturbance'))),0,30),{},10,'N03から受信した値から、外乱N15から受信した値を引きます。'),signal('N17',790,685,10,'N16が計算した値を表示します。'),signal('N18',790,835,0,'外乱N15から受信した値をそのまま表示します。'));
for(const id of ['N17','N18']){const node=nodes1.find(n=>n.id===id)!;node.kind='output';delete node.parameters.gain;node.update={value:r('input.signal')};node.trigger={type:'input'};}
edges1.push(e('E14','N15','N16','disturbance','resource'),e('E15','N03','N16','supply'),e('E16','N16','N17'),e('E17','N15','N18'));

const inputs1:ManualInput[]=[{id:'N01.capacity',nodeId:'N01',parameter:'capacity',label:'capacity',description:'N01.capacityに設定した値をN01.intervalステップごとに出力します。値を変更した場合も、次に出力する時刻まで待ちます。',min:0,max:20,step:1,defaultValue:10}];
inputs1.push({id:'N01.interval',nodeId:'N01',parameter:'interval',label:'interval',description:'N01が値を出力する間隔をステップ数で指定します。変更した時点から数え直します。',min:1,max:24,step:1,defaultValue:1});
const edits1=editors(nodes1,edges1);
const nodes2=[
 n('N01',90,85,r('param.enabled'),{enabled:0},0,'enabledを0または1に設定して出力するinputノードです。'),
 n('N02',265,85,op('switch',r('input.signal'),op('clamp',op('sum',r('param.level'),op('multiply',-1,r('input.feedback'))),0,30),r('param.level')),{level:10},10,'N01とN07から受信した値を使って計算します。'),signal('N03',440,85,10),signal('N04',615,85,10,'N03から受信した値を表示します。値が変わる時刻と、変わった後の値を確認します。'),
 n('N05',90,235,op('multiply',r('input.start'),r('param.level'),op('switch',op('threshold',r('input.feedback'),8),1,0.8)),{level:1},0,'N01から受信した値にlevelを掛け、N02から受信した値に応じて係数を選びます。'),
 n('N06',265,235,op('switch',r('input.enabled'),op('clamp',op('integrator',r('state.value'),r('input.signal')),0,20),0),{},0,'N01から受信した値が0なら保持値を0に戻します。0以外ならN05とN12から受信した値を保持値に加算します。'),
 n('N07',440,235,op('switch',op('threshold',r('input.signal'),4),6,0),{},0,'到着する信号の範囲に応じて切り替わります。'),

 n('N09',90,385,r('param.level'),{level:0.05},0.05,'小さい一定信号を生成する内部経路。'),signal('N10',265,385,0.05),
 n('N11',440,385,op('filter',r('state.value'),r('input.signal'),0.5),{},0.05),
 n('N12',615,385,op('multiply',-1,r('input.signal')),{},-0.05,'信号の符号を反転します。'),

];
const edges2=[e('E01','N01','N02'),e('E02','N02','N03'),e('E03','N03','N04'),e('E04','N05','N06'),e('E05','N06','N07'),e('E06','N07','N02','feedback','control'),e('E07','N02','N05','feedback','control'),e('E08','N09','N10'),e('E09','N10','N11'),e('E10','N11','N12'),e('E11','N12','N06','signal','resource'),e('E24','N01','N05','start','control'),e('E25','N01','N06','enabled','control')];
nodes2.push(signal('N13',790,235,0,'N01から受信した値をそのまま表示します。'),signal('N14',790,385,-0.05,'N12から受信した値を表示します。N01.enabledの値によらず−0.05です。'));
edges2.push(e('E12','N01','N13'),e('E13','N12','N14'));
for(const id of ['N13','N14'])nodes2.find(n=>n.id===id)!.kind='output';
nodes2[0].kind='input';nodes2.find(n=>n.id==='N04')!.kind='output';
nodes2.filter(n=>n.kind==='output').forEach(n=>{n.x=790;});
configure(nodes2,edges2,{N01:'enabled'},['N06','N09']);
const inputs2:ManualInput[]=[{id:'N01.enabled',nodeId:'N01',parameter:'enabled',label:'enabled',description:'N01.enabledを0から1に変更して反映すると、N04の値が変わるまでの時間を確認できます。',min:0,max:1,step:1,defaultValue:0}];
const edits2=editors(nodes2,edges2);
const ci=(id:string,lag=0):ContractExpr=>({source:'input',id,lag});
const co=(id:string,lag=0):ContractExpr=>({source:'output',id,lag});
const cx=(op:'sum'|'multiply'|'clamp'|'pulse',...args:ContractExpr[]):ContractExpr=>({op,args});
const eq=(expected:ContractExpr,startAt=0,afterInput?:{id:string;steps:number}):ContractRule=>({kind:'equals',expected,startAt,afterInput});
const tr:Record<string,ContractRule[]>={N03:[eq(cx('multiply',0.5,ci('N01.level',3)))]};
const pr:Record<string,ContractRule[]>={
 N04:[eq(cx('clamp',cx('sum',ci('N01.capacity',4),cx('multiply',-2,co('N13',3)),cx('multiply',-1,co('N14',2))),0,30),6),{kind:'range',min:cx('clamp',cx('sum',ci('N01.capacity',4),-2.5),0,30),max:ci('N01.capacity',4),startAt:6}],
 N08:[eq(cx('multiply',2,co('N13',2)),4)],
 N13:[eq(cx('pulse',12,3,1,1),2)],N14:[eq(cx('pulse',18,4,0.5,4),5)],
 N17:[eq(cx('clamp',cx('sum',co('N04',1),cx('multiply',-1,co('N18',1))),0,30),8),{kind:'range',min:cx('clamp',cx('sum',ci('N01.capacity',5),-2.9),0,30),max:ci('N01.capacity',5),startAt:8}],
 N18:[eq({source:'external',id:'N15',lag:1},1),{kind:'range',min:0,max:0.4}]
};
const dr:Record<string,ContractRule[]>={
 N04:[{kind:'response',inputId:'N01.enabled',active:4,inactive:10,activateAfter:11,deactivateAfter:4}],
 N13:[eq(ci('N01.enabled',2))],N14:[eq(-0.05)]
};
const tutorialCases:BehaviorCase[]=[0,4,8,16,20].map(value=>({name:`N01.level=${value}`,steps:12,inputs:[{time:0,id:'N01.level',value}]}));
const periodicCases:BehaviorCase[]=[0,1,4,10,20].map(value=>({name:`N01.capacity=${value}、N01.interval=1`,steps:108,inputs:[{time:0,id:'N01.capacity',value},{time:0,id:'N01.interval',value:1}]}));
periodicCases.push(...[12345,54321].map(seed=>({name:`N01.capacity=10、N01.interval=1、N15のシード=${seed}`,steps:108,seed,inputs:[{time:0,id:'N01.capacity',value:10},{time:0,id:'N01.interval',value:1}]})),{name:'N01.capacityを10→4→16、N01.interval=1',steps:144,inputs:[{time:0,id:'N01.capacity',value:10},{time:0,id:'N01.interval',value:1},{time:48,id:'N01.capacity',value:4},{time:96,id:'N01.capacity',value:16}]});
const delayedCases:BehaviorCase[]=[0,17,50].map(time=>({name:`t=${time}でN01.enabledを1、t=${time+48}で0に変更`,steps:time+60,inputs:[{time,id:'N01.enabled',value:1},{time:time+48,id:'N01.enabled',value:0}]}));
delayedCases.push({name:'N01.enabledを0のまま96ステップ維持',steps:96,inputs:[]},{name:'N01.enabledを1→0→1→0と繰り返し変更',steps:100,inputs:[{time:0,id:'N01.enabled',value:1},{time:30,id:'N01.enabled',value:0},{time:40,id:'N01.enabled',value:1},{time:80,id:'N01.enabled',value:0}]});
export const scenarios:Scenario[]=[
 {behaviorCases:tutorialCases,outputRequirements:[{nodeId:'N03',role:'比例変換の結果',condition:'入力範囲0〜20。手動入力を変更して反映する。',expected:'入力の0.5倍に、変更から3ステップ後に切り替わる。次の入力変更まで保持する。',rules:tr.N03}],id:'tutorial',title:'00 / 変化を追う',description:'操作チュートリアル · 3ノード',symptom:'入力変更、計測、直接編集と自動判定を練習します。このシナリオには故障はありません。',
 briefing:{conditions:'操作する値：input N01のlevel。確認する出力：N03。N01.levelの初期値は8です。',expected:'入力を一定の比率で変換し、一定の遅れで出力へ伝えます。入力が変わらない間は、出力も変わりません。倍率・応答時間・保持の条件を下表に示します。',expectedFlow:['入力の変化','一定の比率で変換','遅れて出力に反映'],difference:'異常はありません。比例関係と応答時間が公開した検証ケースですべて満たされると練習完了です。入力を変更して変化を確かめられます。',firstAction:'グラフ上のN01のlevelを16に変更し、「入力を反映」を押し、+12で出力 N03 を確認してください。'},
 inputs:tutorialInputs,nodes:tutorialNodes,connections:tutorialEdges,faults:[],observations:[...tutorialNodes.map(v=>obs(v.id)),...tutorialEdges.map(v=>obs(v.id))],interventions:tutorialEdits,visibleNodeIds:tutorialNodes.map(v=>v.id),visibleConnectionIds:tutorialEdges.map(v=>v.id),hints:['グラフ上のinputノードは、利用者がシステムへ値を渡す入口です。内部の直接編集欄とは用途が違います。','N01.levelを16に変更して反映すると、N03が8になります。','入力値を変え、比例関係と応答時間が保たれるか比較しましょう。'],
 solution:{rootCauseIds:[],stableSteps:6,causalPath:['N01','N02','N03'],explanation:'この練習には故障がありません。N01の単発出力が、N02での0.5倍変換を経てN03に届く動作を確認します。',observations:'出力の比例関係と応答時間を公開検証ケースで確認します。現在の出力が6ステップ連続で正常になると、各入力値での動作を検証します。',misleading:'倍率と応答時間を満たすすべての修正を受け入れます。入力値を変える検証で確認します。'}},
 {behaviorCases:periodicCases,outputRequirements:[
 {nodeId:'N04',role:'N01の値からN13・N14に応じた値を引く出力',condition:'N01.capacityは0〜20、N01.intervalは1。N13・N14がそれぞれ下記の値と周期を保つこと。N01.capacityの変更後は6ステップ経過してから確認する。',expected:'N01.capacityから、N13の3ステップ前の値の2倍とN14の2ステップ前の値を引いた値になる。計算結果が0未満なら0になる。',rules:pr.N04},
 {nodeId:'N08',role:'N13の値の2倍を表示する出力',condition:'N13が0または1を出力している間。',expected:'N08は、2ステップ前のN13の値の2倍になる。したがって値は0または2。',rules:pr.N08},
 {nodeId:'N13',role:'1と0を繰り返す出力',condition:'時刻t≥2。内部設定の変更方法に関わらず。',expected:'(t−1) mod 12が0〜2なら1、それ以外は0。12ステップごとに1が3ステップ、0が9ステップ続く。',rules:pr.N13},
 {nodeId:'N14',role:'0.5と0を繰り返す出力',condition:'時刻t≥5。内部設定の変更方法に関わらず。',expected:'(t−4) mod 18が0〜3なら0.5、それ以外は0。18ステップごとに0.5が4ステップ、0が14ステップ続く。',rules:pr.N14}
 ,{nodeId:'N17',role:'N04からN18を引いた結果を表示する出力',condition:'N01.capacityは0〜20、N01.intervalは1。N13・N14がそれぞれ下記の値と周期を保つこと。N01.capacityの変更後は8ステップ経過してから確認する。',expected:'1ステップ前のN04から同時点のN18を引いた値になる。計算結果が0未満なら0になる。値の範囲はmax(0, N01.capacity−2.9)〜N01.capacity。',rules:pr.N17},
 {nodeId:'N18',role:'外乱N15の値を表示する出力',condition:'外乱INPUT N15。3〜7ステップのランダム間隔で発生。',expected:'N18は、N15が出力した値を1ステップ後に表示する。次の値が届くまで保持する。値は0〜0.4。',rules:pr.N18}
 ],id:'periodic',title:'01 / 周期的な出力低下',description:'調査シナリオ · 18ノード / 周期の異なる出力と外乱',symptom:'出力N04が周期的に大きく低下します。各ノードの値が変わる時刻を比較し、出力が期待動作を満たすよう修正してください。',
 briefing:{conditions:'操作する値：N01.capacityとN01.interval。確認する出力：N04・N08・N13・N14・N17・N18。外乱INPUTのN15は編集できません。',expected:'N01に指定した値から、周期的に変わる値を引いて出力します。N13とN14は決まった値と周期を保ちます。外乱N15の値が変わっても、各outputは「出力ごとの動作条件」を満たす必要があります。',expectedFlow:['入力値を指定','周期的な値の変化と計算','計算結果を出力'],difference:'N04・N08・N17が期待動作から外れる理由を調べます。N13・N14・N18の正常な動作も保ちながら修正してください。',firstAction:'グラフ上のN01でcapacityが10、intervalが1であることを確認し、+36を2回押します。グラフ上のoutput N04 と N08、その時系列を比較してください。'},
 inputs:inputs1,nodes:nodes1,connections:edges1,faults:[{id:'F01',targetId:'N06',key:'value',parameter:'load',mode:'gain_change',startStep:2,severity:4,condition:op('threshold',r('state.value'),1)}],observations:[...nodes1.map(v=>obs(v.id)),...edges1.map(v=>obs(v.id))],interventions:edits1,visibleNodeIds:nodes1.map(v=>v.id),visibleConnectionIds:edges1.map(v=>v.id),hints:['N04・N08・N13・N14を同じ時間軸で比較しましょう。','N13・N14の値が同時に0以外になる時刻と、N04の値が下がる時刻を比較しましょう。','N05.enabledまたはN09.enabledを0にした場合の変化を記録し、各接続の前後で値がどう変わるか比較しましょう。'],
 solution:{rootCauseIds:['N06'],stableSteps:36,causalPath:['N05','N06','E07','N02','N03','N04'],explanation:'N06 の load が2から8へ変わり、N06がN05から受信した値に掛ける係数が4倍になっていました。load を2へ戻すと、N04とN08がともに期待する値になります。',observations:'N06とN12の値はN02で加算され、N01からの値から引かれます。N12が0.5の間は、N04の値がさらに0.5小さくなります。',misleading:'N09 系統も本当に資源を使いますが正常です。N04の値だけを合わせても、ほかのoutputや入力変更後の動作が条件を満たさなければクリアしません。どの修正方法でも、公開した検証ケースですべての出力条件を満たせば正解です。'}},
 {behaviorCases:delayedCases,outputRequirements:[
 {nodeId:'N04',role:'N01.enabledに応じて値が切り替わる出力',condition:'N01.enabledを0から1に変更し、「入力を反映」を押す。その後は1を維持する。0に戻してから再び1に変更した場合も同じ応答時間とする。',expected:'N01.enabledを1に変更して反映してから10ステップ後まではN04は10、11ステップ後に4となり、その後は4を保持する。N01.enabledを0に変更して反映すると、4ステップ後にN04は10へ戻る。N01.enabledを0のまま変更しなければN04は10を保持する。',rules:dr.N04},
 {nodeId:'N13',role:'N01の値を表示する出力',condition:'N01.enabledを0または1に変更し、「入力を反映」を押す。',expected:'反映から2ステップ後に、N13は変更後のN01.enabledと同じ値となる。次の変更が届くまでその値を保持する。',rules:dr.N13},
 {nodeId:'N14',role:'−0.05を表示する出力',condition:'N01.enabledが0でも1でも。',expected:'N14は−0.05を保持する。N01.enabledを変更しても変化しない。',rules:dr.N14}
 ],id:'delayed',title:'02 / 遅れて現れる異常',description:'調査シナリオ · 13ノード',symptom:'出力N04の切替が期待より遅れます。各ノードの受信値と計算結果を調べ、N04が期待する時刻に変わるよう修正してください。',
 briefing:{conditions:'操作する値：input N01のenabled（0または1）。確認する出力：N04・N13・N14。N01.enabledを0から1に変更して反映した時点からのステップ数を数えます。',expected:'N01.enabledを変更すると、N13が先に変わり、N04はそれより遅れて変わります。N14は変わりません。それぞれの値と、変わるまでのステップ数を「出力ごとの動作条件」に示します。',expectedFlow:['入力値を変更','出力ごとに定めた時間を待つ','値が切り替わる','次の変更まで値を保持'],difference:'N01.enabledを変更してからN04が変わるまでに、なぜ余分な時間がかかるのかを調べます。N04の値と、変わるまでのステップ数を期待動作に合わせてください。',firstAction:'グラフ上のN01のenabledを0から1に変更し、「入力を反映」を押します。+12で出力 N04 が10のままか確認し、その後+12を2回押して比較してください。'},
 inputs:inputs2,nodes:nodes2,connections:edges2,faults:[{id:'F02',targetId:'N05',key:'value',parameter:'gain',mode:'gain_change',startStep:0,severity:0.2}],observations:[...nodes2.map(v=>obs(v.id)),...edges2.map(v=>obs(v.id))],interventions:edits2,visibleNodeIds:nodes2.map(v=>v.id),visibleConnectionIds:edges2.map(v=>v.id),hints:['切替時刻だけでなく、少しずつ変化する値の傾きも比較しましょう。','N06が各接続から受信した値と、N06が保持する値の変化を比較しましょう。','N12からN06への接続を一時的に無効にした場合と、N05からN06へ届く値を変えた場合を比較しましょう。'],
 solution:{rootCauseIds:['N05'],stableSteps:36,causalPath:['N05','E04','N06','N07','N02','N03','N04'],explanation:'N05 の gain が1から0.2へ減衰していました。gain を1へ戻すと、N06の値の増え方が変わり、N07が切り替わる値に期待する時刻に到達します。',observations:'N12は−0.05をN06へ送ります。N06はN01から0を受信した次の計算で保持値を0に戻します。N01.enabledを1にし、N05から値が届くと、N07が切り替わるまでは故障時に1ステップあたり0.15、正常時に0.95ずつ増えます。',misleading:'設定の編集だけでは保持値は変わりません。N01から0を受信した次の計算では、N06の保持値が0に戻ります。状態値を手動編集した場合、「設定を保持して再実行」ではその値を初期状態として再適用します。'}}
,...additionalScenarios,hierarchyScenario,semanticScenario,reproductionScenario
];
