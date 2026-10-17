import type {Scenario,Expr,ManualInput,Fault} from './engine';
import type {ContractExpr,ContractRule,BehaviorCase} from './contracts';
import {r,op,n,e,obs,signal,configure,editors} from './scenarioBuilders';

const c=(op:Exclude<ContractExpr,number|{source:string}>['op'],...args:ContractExpr[]):ContractExpr=>({op,args});
const input=(lag:number):ContractExpr=>({source:'input',id:'N01.level',lag});
const output=(id:string,lag:number):ContractExpr=>({source:'output',id,lag});
const eq=(expected:ContractExpr,startAt:number):ContractRule=>({kind:'equals',expected,startAt});
type Variant='shared'|'ceiling'|'sampling';

function build(variant:Variant):Scenario {
 const ceiling=variant==='ceiling',sampling=variant==='sampling';
 const initial=ceiling?10:6;
 const normal=(x:number)=>ceiling?Math.min(x,8):sampling?(x>=10?20:4):2*x;
 const u=normal(initial),half=u/2,offset=u-2;
 const primary:Expr=ceiling?op('clamp',r('input.signal'),0,r('param.ceiling')):sampling?op('switch',op('threshold',r('input.signal'),r('param.threshold')),20,4):op('multiply',r('input.signal'),r('input.factor'));
 const nodes=[
  n('N01',90,85,r('param.level'),{level:initial},initial,'levelを手動で変更して出力します。'),
  n('N02',265,85,primary,ceiling?{ceiling:8}:sampling?{threshold:10}:{},u,ceiling?'N01から受信した値を0以上、ceiling以下に収めます。':sampling?'N01から受信した値がthreshold以上なら20、それ以外なら4を計算します。':'N01から受信した値に、処理開始時にN05へ問い合わせた値を掛けます。'),
  n('N03',265,535,op('sum',r('input.signal'),1),{},initial+1,'N01から受信した値に1を加えます。'),
  n('N04',265,685,op('multiply',r('input.signal'),r('input.signal')),{},initial*initial,'N01から受信した値を2乗します。'),
  n('N05',90,235,r('param.level'),{level:2},2,'問い合わせを受けた時にlevelを出力します。複数の処理が同じ値を参照します。'),
  n('N06',440,85,op('multiply',r('input.signal'),.5),{},half,'N02から受信した値を0.5倍します。'),
  n('N07',440,235,op('sum',r('input.signal'),op('multiply',-1,r('input.offset'))),{},offset,'N02から受信した値から、処理開始時にN05へ問い合わせた値を引きます。'),
  n('N08',615,85,op('sum',r('input.half'),r('input.offset')),{},half+offset,'N06とN07から受信した値を加算します。'),
  n('N09',440,535,op('multiply',r('input.signal'),2),{},2*(initial+1),'N03から受信した値を2倍します。'),
  n('N10',440,685,op('multiply',r('input.signal'),.25),{},initial*initial*.25,'N04から受信した値を0.25倍します。'),
  n('N11',790,85,op('clamp',r('input.signal'),0,100),{},Math.max(0,Math.min(half+offset,100)),'N08から受信した値を0以上100以下に収めます。'),
  n('N12',615,235,op('sum',r('input.offset'),op('multiply',-1,r('input.half'))),{},offset-half,'N07から受信した値から、N06から受信した値を引きます。'),
  n('N13',615,535,op('sum',r('input.linear'),r('input.square')),{},2*(initial+1)+initial*initial*.25,'N09とN10から受信した値を加算します。'),
  n('N14',790,235,op('multiply',r('input.signal'),2),{},2*(offset-half),'N12から受信した値を2倍します。'),
  n('N15',790,685,op('sum',r('input.total'),op('multiply',-1,r('input.linear'))),{},initial*initial*.25,'N13から受信した合計値から、N09から受信した値を引きます。'),
  signal('N16',1000,85,Math.max(0,Math.min(half+offset,100)),'N11から受信した値を表示します。'),
  signal('N17',1000,235,2*(offset-half),'N14から受信した値を表示します。'),
  signal('N18',1000,385,offset,'N07から受信した値を表示します。'),
  signal('N19',1000,535,2*(initial+1)+initial*initial*.25,'N13から受信した値を表示します。'),
  signal('N20',1000,685,initial*initial*.25,'N15から受信した値を表示します。入力変更時にはN19との時間差も比較できます。'),
 ];
 nodes[0].kind='input';for(const node of nodes.filter(n=>Number(n.id.slice(1))>=16))node.kind='output';
 // Even the clipping/sampling variants share the reference between two consumers.
 const referenceConsumer=ceiling||sampling?'N06':'N02';
 if(ceiling||sampling){const halfNode=nodes.find(n=>n.id==='N06')!;halfNode.update.value=op('multiply',r('param.gain'),op('multiply',r('input.signal'),op('multiply',.25,r('input.factor'))));halfNode.description='N02から受信した値に、処理開始時にN05へ問い合わせた値の0.25倍を掛けます。';}
 const connections=[
  e('E01','N01','N02'),e('E02','N01','N03'),e('E03','N01','N04'),
  e('E04','N05',referenceConsumer,'factor','request'),e('E05','N05','N07','offset','request'),
  e('E06','N02','N06'),e('E07','N02','N07'),e('E08','N06','N08','half'),e('E09','N07','N08','offset'),
  e('E10','N03','N09'),e('E11','N04','N10'),e('E12','N08','N11'),
  e('E13','N06','N12','half'),e('E14','N07','N12','offset'),e('E15','N09','N13','linear'),e('E16','N10','N13','square'),
  e('E17','N12','N14'),e('E18','N13','N15','total'),e('E19','N09','N15','linear'),
  e('E20','N11','N16'),e('E21','N14','N17'),e('E22','N07','N18'),e('E23','N13','N19'),e('E24','N15','N20'),
 ];
 configure(nodes,connections,{N01:'level'},['N02'],['N05']);
 const inputs:ManualInput[]=[{id:'N01.level',nodeId:'N01',parameter:'level',label:'level',description:'N01.levelを変更して反映します。出力が変わるまでのステップ数も確認してください。',min:0,max:20,step:1,defaultValue:initial}];
 const expectedPrimary=(lag:number):ContractExpr=>ceiling?c('clamp',input(lag),0,8):sampling?c('switch',c('threshold',input(lag),10),20,4):c('multiply',2,input(lag));
 const cases:BehaviorCase[]=[0,2,4,8,10,12,20].map(value=>({name:`N01.level=${value}`,steps:32,inputs:[{time:0,id:'N01.level',value}]}));
 for(const time of [1,3,6])cases.push({name:`t=${time}からN01.levelを14→3→18`,steps:80,inputs:[{time,id:'N01.level',value:14},{time:time+24,id:'N01.level',value:3},{time:time+48,id:'N01.level',value:18}]});
 const mainFormula=ceiling?'min(N01.level, 8)':sampling?'(N01.level ≥ 10 ? 20 : 4)':'2 × N01.level';
 const condition='N01.levelは0〜20の整数。出力条件は入力変更後の途中経過にも適用します。';
 const requirements:Scenario['outputRequirements']=[
  {nodeId:'N16',role:'変換した値を分岐・加算した結果',condition:`${condition} t≥6。`,expected:`6ステップ前のN01.levelに対する ${mainFormula} の1.5倍から2を引き、0以上100以下に収めた値。`,rules:[eq(c('clamp',c('sum',c('multiply',1.5,expectedPrimary(6)),-2),0,100),6)]},
  {nodeId:'N17',role:'分岐した値の差を2倍した結果',condition:`${condition} t≥6。`,expected:`6ステップ前のN01.levelに対する ${mainFormula} から4を引いた値。`,rules:[eq(c('sum',expectedPrimary(6),-4),6)]},
  {nodeId:'N18',role:'変換した値から2を引いた結果',condition:`${condition} t≥4。`,expected:`4ステップ前のN01.levelに対する ${mainFormula} から2を引いた値。`,rules:[eq(c('sum',expectedPrimary(4),-2),4)]},
  {nodeId:'N19',role:'入力を別の計算で確認する出力',condition:`${condition} t≥5。`,expected:'5ステップ前のN01.levelをxとすると、2 × (x + 1) + 0.25 × x × x。',rules:[eq(c('sum',c('multiply',2,c('sum',input(5),1)),c('multiply',.25,input(5),input(5))),5)]},
  {nodeId:'N20',role:'N19から一部の値を差し引く出力',condition:`${condition} t≥6。`,expected:'1ステップ前のN19から、5ステップ前のN01.levelに1を加えた値の2倍を引く。入力変更の伝播中もこの関係を保つ。',rules:[eq(c('sum',output('N19',1),c('multiply',-2,c('sum',input(5),1))),6)]},
 ];
 const fault:Fault=ceiling?{id:'F04',targetId:'N02',key:'value',parameter:'ceiling',mode:'stuck',startStep:0,severity:4}:sampling?{id:'F05',targetId:'N02',key:'value',parameter:'interval',mode:'gain_change',startStep:0,severity:4}:{id:'F03',targetId:'N05',key:'value',parameter:'level',mode:'gain_change',startStep:0,severity:1.5};
 return {
  id:variant,title:ceiling?'04 / 大きな入力だけ合わない':sampling?'05 / 値は合うが反映が遅い':'03 / 複数の出力が同時にずれる',description:'調査シナリオ · 20ノード / 5出力',
  symptom:ceiling?'入力が小さいときは一致する出力が、大きな入力では期待する値になりません。':sampling?'入力変更後の出力は最終的に合いますが、期待する時刻に切り替わりません。':'N16・N17・N18が期待する値から外れます。共通する参照元と、正常な出力を比較してください。',
  briefing:{conditions:'操作する値：N01.level。確認する出力：N16・N17・N18・N19・N20。',expected:ceiling?'入力を上限のある変換と別の計算へ分岐します。上限を超えても、変換後の値とほかの出力との関係が保たれます。':sampling?'入力が決められた境界以上かどうかで値を選び、分岐して計算します。値が変わったときは、出力ごとに定めた時間で反映します。':'複数の処理が共通の値を問い合わせて計算します。同じ入力に対する各出力の関係と、反映までの時間が保たれます。',expectedFlow:['入力値を変更',ceiling?'上限のある変換と別の計算':sampling?'境界との比較と定周期の計算':'共有値の問い合わせと分岐した計算','出力ごとの値と反映時刻を確認'],difference:sampling?'最終値だけでなく、N16・N17・N18が切り替わる時刻を調べます。N19・N20の正常な値と応答時間も保ってください。':'N16・N17・N18が条件を満たさない理由を調べます。N19・N20の正常な動作も保ちながら修正してください。',firstAction:ceiling?'N01.levelを3に変更して反映し、+12で確認します。次に12に変更して反映し、+12で出力と異常ログを比較してください。':sampling?'N01.levelを14に変更して反映し、+1ずつ進めてN18が変わる時刻を確認してください。異常が消えても、画面下部のログで差を確認できます。':'+12でN16・N17・N18の異常を確認します。N01.levelを12に変更して反映し、もう一度+12で比較してください。'},
  inputs,nodes,connections,faults:[fault],observations:[...nodes.map(v=>obs(v.id)),...connections.map(v=>obs(v.id))],interventions:editors(nodes,connections),visibleNodeIds:nodes.map(n=>n.id),visibleConnectionIds:connections.map(e=>e.id),outputRequirements:requirements,behaviorCases:cases,
  hints:ceiling?['N01.levelが4以下の場合と、4を超える場合を比較しましょう。','N02の入力と出力を比較し、入力を大きくしても値が増えなくなる場所を探しましょう。','N02のceilingと、出力条件に示された上限を比較しましょう。']:sampling?['最終値が一致しても、入力変更からの各ステップを確認しましょう。','N02の発火時刻とN01の出力時刻を比較しましょう。','N02のintervalを確認し、変更した時点から次回の発火まで数えましょう。']:['N19・N20が正常なら、N01の値を変えるだけでは直らない可能性があります。','N02とN07の処理式に共通する問い合わせ先を探しましょう。','N05が返すlevelと、出力条件が要求する関係を比較しましょう。'],
  solution:{rootCauseIds:[fault.targetId],stableSteps:24,causalPath:ceiling||sampling?['N01','N02','N06 / N07','N16 / N17 / N18']:['N05','N02 / N07','N06 / N08 / N12','N16 / N17 / N18'],explanation:ceiling?'N02.ceilingが8から4へ変わっていました。4以下の入力では差が出ませんが、それ以上の入力が4に制限されます。':sampling?'N02.intervalが1から4へ変わっていました。保持した入力を4ステップごとに計算するため、最終値が正しくても応答時刻を満たしません。':'共有するN05.levelが2から3へ変わっていました。N02の乗算とN07の減算が同時に影響を受けます。',observations:'N19とN20は別の計算経路で入力値を確認できます。N16・N17・N18の値だけでなく、入力変更後の時間差も公開検証ケースで確認します。',misleading:'正常な出力も含めた全条件を満たす必要があります。ここに示した原因だけが正解ではなく、異なるプロパティや接続の修正でも、公開した全検証ケースを満たせば受け入れます。'},
 };
}
export const additionalScenarios:Scenario[]=[build('shared'),build('ceiling'),build('sampling')];
