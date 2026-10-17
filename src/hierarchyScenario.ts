import type {Scenario,ManualInput} from './engine';
import type {ContractExpr,BehaviorCase} from './contracts';
import type {Hierarchy,Module,ModulePort,ModuleSpec,BoundaryBinding} from './hierarchy';
import {r,op,n,e,signal,configure,editors,obs} from './scenarioBuilders';
const port=(id:string,label:string,direction:'in'|'out',binding:BoundaryBinding,description:string,observable=true):ModulePort=>({id,label,direction,binding,description,observable});
const out=(id:string,label:string,nodeId:string,description:string,observable=true)=>port(id,label,'out',{kind:'output',nodeId},description,observable);
const inp=(id:string,label:string,connectionId:string,description:string,observable=true)=>port(id,label,'in',{kind:'input',connectionId},description,observable);
const control=()=>port('level','level','in',{kind:'control',inputId:'N01.level'},'利用者が手動設定する値。反映操作後に単発出力する。');
const spec=(condition:string,expected:string,timing:string,assumptions:string,relations:ModuleSpec['relations']=[]):ModuleSpec=>({condition,expected,timing,assumptions,relations});
const modules:Module[]=[
 {id:'M1',label:'Input',description:'利用者の設定値を一定の周期で内部へ渡し、入力確認の値も返します。',nodes:[],children:['M11','M12'],ports:[control(),out('signal','signal','N02','整形後に内部へ渡す値。'),out('echo','Echo','N10','利用者へ返す入力確認の値。')],spec:spec('入力値は0〜12の整数。','信号と入力確認は、入力値を加工せず保持する。','信号は反映から2ステップ後、入力確認は4ステップ後に更新する。','周期は1ステップ。入力が変わらない間も信号を出力する。',[{output:'signal',expression:r('level')},{output:'echo',expression:r('level')}])},
 {id:'M11',label:'Manual',description:'入力値の変更を単発の出力にします。',nodes:['N01'],children:[],ports:[control(),out('command','command','N01','反映された入力値。')],spec:spec('利用者が入力値を変更して反映する。','変更した値を単発で出力する。同じ値の再適用では出力しない。','反映から1ステップ後。','値が変わらない間は前の出力を保持する。',[{output:'command',expression:r('level')}])},
 {id:'M12',label:'Sampler',description:'受信値を定周期で渡し、別経路で入力確認を返します。',nodes:['N02','N09','N10'],children:[],ports:[inp('command','command','E01','直近の計算に使った変更値。'),out('signal','signal','N02','計算後の信号。'),out('echo','Echo','N10','別経路で保持した値。')],spec:spec('変更値が入力される。','信号は変更値と同じ値を保持する。入力確認は同じ値を返す。','計算は毎ステップ。信号の出力から2ステップ後に入力確認へ届く。','接続は値を加工しない。',[{output:'signal',expression:r('command')},{output:'echo',expression:r('command')}])},
 {id:'M2',label:'Transform',description:'信号、共通係数、外部値から数値出力を計算します。',nodes:['N04','N05'],children:[],ports:[inp('signal','signal','E02','変換処理で使った信号。'),inp('factor','factor','E03','処理開始時に問い合わせる値。上位境界では数値を計測しない。',false),inp('external','external','E04','変換処理で使った外部値。'),out('value','Value','N05','利用者向けの変換結果。')],spec:spec('信号は0〜12。外部値は0以上0.4未満。','信号を規定の共通係数で変換し、外部値を引く。','毎ステップ計算し、その計算で使った入力に対する結果が1ステップ後に数値出力へ届く。','共通係数の規定値は2。境界値の時刻を揃えて比較する。',[{output:'value',expression:op('sum',op('multiply',2,r('signal')),op('multiply',-1,r('external')))}])},
 {id:'M3',label:'Timing',description:'信号が0以外で続く時間を数えて、時間出力を切り替えます。',nodes:['N06','N07','N08'],children:[],ports:[inp('signal','signal','E06','時間を数える処理で使った信号。'),inp('factor','factor','E08','比較処理の開始時に問い合わせる値。上位境界では数値を計測しない。',false),out('ready','Ready','N08','規定時間に達したら1、信号が0なら0に戻る。')],spec:spec('信号が0から0以外へ変わり、以後0以外を維持する。','0以外を8回連続で計算したら1にする。0を受信したら計数を0に戻す。','最初の0以外を計算に使った時点から9ステップ後に時間出力が1になる。0を計算に使ってから2ステップ後に0へ戻る。','計数周期は1。比較は共通係数の規定値2を前提にする。')},
 {id:'M4',label:'Reference',description:'複数の処理からの問い合わせに応答し、外部から変化する値も渡します。',nodes:[],children:['M41','M42'],ports:[out('factor','factor','N03','共通の問い合わせ結果。上位境界では計測せず、子の仕様と観測を参照する。',false),out('external','external','N12','外部から発生した直近の出力。'),out('echo','Noise','N11','利用者へ返す外部値の確認。')],spec:spec('問い合わせが来た時、および外部値が発生した時。','同じ設定なら各問い合わせに同じ共通係数を返す。外部値は0以上0.4未満を保持する。','問い合わせは処理開始時に同期して取得する。外部値確認は外部値の出力から1ステップ後に更新する。','共通係数の規定値は子の仕様で確認できる。外部値は利用者が編集できない。',[{output:'echo',expression:r('external')}])},
 {id:'M41',label:'Shared factor',description:'複数の利用側が同じ仕様の値を問い合わせます。',nodes:['N03'],children:[],ports:[out('factor','factor','N03','最後の問い合わせに応答した値。')],spec:spec('問い合わせを受けた時。','共通係数2を返す。','同期応答。問い合わせのない間は前の計算出力を表示する。','設定が変わらなければ同じ値を返す。',[{output:'factor',expression:2}])},
 {id:'M42',label:'External',description:'編集できない外部入力と、その出力確認を含みます。',nodes:['N12','N11'],children:[],ports:[out('external','external','N12','発生済みの直近値。'),out('echo','Noise','N11','受信した値を表示する。')],spec:spec('0以上0.4未満のランダム値が3〜7ステップ間隔で発生する。','値を加工せず渡し、次の値が発生するまで保持する。','外部値確認は発生から1ステップ後に更新する。','値・発生間隔・シードは編集できない。',[{output:'echo',expression:r('external')}])},
];
const hierarchy:Hierarchy={roots:['M1','M2','M3','M4'],modules,inputs:[{inputId:'N01.level',moduleId:'M1',portId:'level',label:'level'}],outputs:[{nodeId:'N05',moduleId:'M2',portId:'value',label:'Value'},{nodeId:'N08',moduleId:'M3',portId:'ready',label:'Ready'},{nodeId:'N10',moduleId:'M1',portId:'echo',label:'Echo'},{nodeId:'N11',moduleId:'M4',portId:'echo',label:'Noise'}]};
const nodes=[
 n('N01',80,85,r('param.level'),{level:0},0,'手動入力。levelの変更を反映すると単発で出力します。'),
 signal('N02',260,85),
 n('N03',80,235,r('param.level'),{level:2},2,'問い合わせ時にgain × levelを返します。'),
 n('N04',440,85,op('sum',op('multiply',r('input.signal'),r('input.factor'),r('param.scale')),op('multiply',-1,r('input.external'))),{scale:1},0,'信号と問い合わせ値を掛け、外部値を引きます。'),
 signal('N05',800,85),
 n('N06',260,235,op('switch',r('input.signal'),op('clamp',op('integrator',r('state.value'),1),0,64),0),{},0,'受信信号が0以外なら毎ステップ1を加算し、0なら保持値を0に戻します。'),
 n('N07',440,235,op('threshold',r('input.signal'),op('multiply',r('input.factor'),r('param.thresholdScale'))),{thresholdScale:4},0,'計数値が、問い合わせ値 × thresholdScale以上なら1を出力します。'),
 signal('N08',800,235),signal('N09',440,385),signal('N10',800,385),signal('N11',800,535),
 n('N12',80,535,0,{},0,'編集できない外部値。'),
];
nodes[0].kind='input';for(const id of ['N05','N08','N10','N11'])nodes.find(n=>n.id===id)!.kind='output';
const connections=[e('E01','N01','N02'),e('E02','N02','N04'),e('E03','N03','N04','factor','request'),e('E04','N12','N04','external'),e('E05','N04','N05'),e('E06','N02','N06'),e('E07','N06','N07'),e('E08','N03','N07','factor','request'),e('E09','N07','N08'),e('E10','N02','N09'),e('E11','N09','N10'),e('E12','N12','N11')];
configure(nodes,connections,{N01:'level'},['N02','N04','N06'],['N03']);
const external=nodes.find(n=>n.id==='N12')!;external.kind='input';external.parameters={};external.update={};external.trigger={type:'random',minInterval:3,maxInterval:7};external.externalInput={seed:20261017,value:{type:'uniform',min:0,max:.4}};
const inputs:ManualInput[]=[{id:'N01.level',nodeId:'N01',parameter:'level',label:'level',description:'値を変更して反映します。0以外を維持する長さも変えて比較できます。',min:0,max:12,step:1,defaultValue:0}];
const ci=(lag:number):ContractExpr=>({source:'input',id:'N01.level',lag});
const cases:BehaviorCase[]=[1,4,8,12].flatMap(value=>[0,7].map(time=>({name:`t=${time}で入力値${value}、t=${time+32}で0、t=${time+48}で${value}`,steps:time+80,inputs:[{time,id:'N01.level',value},{time:time+32,id:'N01.level',value:0},{time:time+48,id:'N01.level',value}]})));
cases.push({name:'入力値0を維持',steps:48,inputs:[]});for(const seed of [12345,54321])cases.push({name:`入力値を8→4→0、外部値シード${seed}`,seed,steps:80,inputs:[{time:3,id:'N01.level',value:8},{time:27,id:'N01.level',value:4},{time:51,id:'N01.level',value:0}]});
const interventions=editors(nodes,connections);interventions.find(i=>i.id==='N04.scale')!.step=.05;
export const hierarchyScenario:Scenario={
 id:'hierarchy',title:'06 / 数値と時間に現れるずれ',description:'階層型調査 · 上位4モジュール',hierarchy,nodes,connections,inputs,
 faults:[{id:'F06',targetId:'N03',key:'value',parameter:'level',mode:'gain_change',startStep:0,severity:2}],observations:[...nodes.map(n=>obs(n.id)),...connections.map(e=>obs(e.id))],interventions,visibleNodeIds:nodes.map(n=>n.id),visibleConnectionIds:connections.map(e=>e.id),
 symptom:'数値出力と時間出力に異なる症状が現れます。各モジュールの仕様と観測を照合し、共通する理由を調べてください。',
 briefing:{conditions:'操作する値：入力値（0〜12の整数）。確認する出力：数値出力・時間出力・入力確認・外部値確認。',expected:'入力を数値の変換と時間の判定へ分け、それぞれ決まった関係と応答時間で出力します。外部値が変わっても、その影響を含めた出力条件を保ちます。',expectedFlow:['入力値を指定','数値変換と時間判定','異なる出力を照合'],difference:'二つの症状が別々の原因によるものか、共通する条件によるものかを調べます。モジュールの仕様と、時刻を伴う境界の観測値を比較してください。',firstAction:'上位の入力値を8に変更して反映し、+12で数値出力と時間出力を確認してください。入力値を変える実験と、0を維持してから再開する実験を比較できます。'},
 outputRequirements:[
 {nodeId:'N05',role:'Value',condition:'時刻t≥4。入力値は0〜12。',expected:'4ステップ前の入力値の2倍から、1ステップ前の外部値確認を引いた値。',rules:[{kind:'equals',startAt:4,expected:{op:'sum',args:[{op:'multiply',args:[2,ci(4)]},{op:'multiply',args:[-1,{source:'output',id:'N11',lag:1}]}]}}]},
 {nodeId:'N08',role:'Ready',condition:'入力値が0から0以外になり、その後0以外を維持する。',expected:'反映から11ステップ後までは0、12ステップ後に1。0へ変更すると5ステップ後に0へ戻る。0を維持してからの再開も同じ時間とする。',rules:[{kind:'response',activation:'nonzero',inputId:'N01.level',active:1,inactive:0,activateAfter:12,deactivateAfter:5}]},
 {nodeId:'N10',role:'Echo',condition:'入力値を変更して反映する。',expected:'反映から4ステップ後に入力値と同じ値を表示し、次の変更が届くまで保持する。',rules:[{kind:'equals',expected:ci(4)}]},
 {nodeId:'N11',role:'Noise',condition:'編集できない外部値が3〜7ステップ間隔で発生する。',expected:'発生した値を1ステップ後に表示し、次の値が届くまで保持する。0以上0.4未満。',rules:[{kind:'equals',startAt:1,expected:{source:'external',id:'N12',lag:1}},{kind:'range',min:0,max:.4}]},
 ],behaviorCases:cases,
 hints:['数値出力のずれは入力値の大きさでどう変わりますか。外部値確認の変化だけで説明できるか比較しましょう。','時間出力の切替は、入力値の大きさに依存しますか。数値変換と時間判定の前提条件も照合しましょう。','二つの処理が問い合わせる参照値に注目しましょう。参照値と外部値を展開し、子の仕様・観測と比較できます。'],
 solution:{rootCauseIds:['N03'],stableSteps:24,causalPath:['Shared factor','数値変換 / 時間判定','数値出力 / 時間出力'],explanation:'共通係数の保持でlevelが2から4に変わっていました。乗算結果が大きくなる一方、比較に必要な計数値も大きくなり、時間出力は遅れます。',observations:'入力値を変えると数値出力のずれは比例して変わります。0を維持してから再開すると、時間出力の遅れは入力値の大きさによらず再現します。二つのモジュールが同じ係数を異なる用途で使うことが共通の説明になります。',misleading:'数値変換だけの補正では時間出力は直りません。共通係数を直す方法に加え、数値変換のscaleと時間判定のthresholdScaleをそれぞれ補正しても、全公開検証ケースが通れば正解です。モジュールの仕様自体を採点することはありません。'},
};
