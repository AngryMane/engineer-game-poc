import type {Expr,Scenario,World} from './engine';
export function expressionText(e:Expr,reference:(ref:string)=>string=ref=>ref):string {
 if(typeof e==='number')return String(e);
 if('ref'in e)return reference(e.ref);
 const a=e.args.map(arg=>expressionText(arg,reference));
 switch(e.op){case 'sum':return `(${e.args.map((arg,i)=>{
  if(i>0&&typeof arg!=='number'&&'op'in arg&&arg.op==='multiply'&&arg.args.length===2&&arg.args[0]===-1)return `− ${expressionText(arg.args[1],reference)}`;
  return `${i>0?'+ ':''}${a[i]}`;
 }).join(' ')})`;case 'multiply':return `(${a.join(' × ')})`;case 'clamp':return `max(${a[1]}, min(${a[0]}, ${a[2]}))`;case 'threshold':return `(${a[0]} ≥ ${a[1]} ? 1 : 0)`;case 'integrator':return `(${a[0]} + ${a[1]})`;case 'filter':return `(${a[0]} + ${a[2]} × (${a[1]} − ${a[0]}))`;case 'switch':return `(${a[0]} ≠ 0 ? ${a[1]} : ${a[2]})`;case 'pulse':return `(time mod max(1, ${a[0]}) < ${a[1]} ? ${a[2]} : ${a[3]})`;case 'delay':return a[0];}
}
// Intermediate names describe arithmetic operations, not inferred domain roles.
export function processingText(e:Expr,target:string,reference:(ref:string)=>string=ref=>ref):string {
 const lines:string[]=[],counts:Record<string,number>={};
 const assign=(base:string,value:string)=>{
  const count=(counts[base]??0)+1;counts[base]=count;
  const name=count===1?base:`${base}${count}`;
  lines.push(`${name} = ${value}`);return name;
 };
 const names={sum:'sum',multiply:'product',threshold:'comparison',integrator:'sumValue',filter:'interpolatedValue',switch:'selectedValue',pulse:'pulseValue',delay:'inputValue'};
 const render=(expr:Expr,root=false):string=>{
  if(typeof expr==='number'||'ref'in expr)return expressionText(expr,reference);
  // Keep subtraction recognizable instead of introducing a separate negative product.
  const args=expr.args.map((arg,i):Expr=>{
   if(expr.op==='sum'&&i>0&&typeof arg!=='number'&&'op'in arg&&arg.op==='multiply'&&arg.args.length===2&&arg.args[0]===-1)
    return {op:'multiply',args:[-1,{ref:render(arg.args[1])}]};
   return {ref:render(arg)};
  });
  if(expr.op==='clamp'){
   const a=args.map(arg=>expressionText(arg));
   const upper=assign('upperClamped',`min(${a[0]}, ${a[2]})`);
   const value=`max(${a[1]}, ${upper})`;
   return root?value:assign('clamped',value);
  }
  const value=expressionText({op:expr.op,args});
  if(root||expr.op==='delay')return value;
  const isDifference=expr.op==='sum'&&expr.args.some(arg=>typeof arg!=='number'&&'op'in arg&&arg.op==='multiply'&&arg.args[0]===-1);
  return assign(isDifference?'difference':names[expr.op],value);
 };
 const result=render(e,true);
 lines.push(`${target} = ${result}`);
 return lines.join('\n');
}
const triggerDescriptions={random:'指定された範囲のランダムな間隔で発火します。同じシードなら値と時刻を再現します。',manual:'値のプロパティが変更されたとき、単発で出力します。同じ値の再適用では発火しません。',timer:'値とは別の周期プロパティに従って発火します。周期変更後はその時点から数え直します。',input:'入力イベントを受けるたびに処理します。同じ値でも発火し、他の入力の到着は待ちません。',request:'他ノードが問い合わせたときに処理し、結果を要求元へ返します。自発的には配信しません。'};
export function NodeDetails({s,w,selected,onRequest}:{s:Scenario;w:World;selected:string;onRequest:(id:string)=>void}){
 const n=s.nodes.find(n=>n.id===selected);if(!n)return null;
 const reference=(ref:string)=>{
  if(ref.startsWith('param.'))return `${n.id}.${ref.slice(6)}`;
  if(ref.startsWith('state.'))return `${n.id}.state.${ref.slice(6)}`;
  if(!ref.startsWith('input.'))return ref;
  const sources=s.connections.filter(e=>e.to===n.id&&e.input===ref.slice(6)&&w.parameters[e.id].enabled).sort((a,b)=>a.id.localeCompare(b.id));
  if(!sources.length)return '0';
  const names=sources.map(e=>e.kind==='request'?`fetch(${e.from})`:e.from);
  return names.length===1?names[0]:`(${names.join(' + ')})`;
 };
 const records=w.trace.filter(t=>t.nodeId===selected).slice(-6).reverse();
 return <section className="panel node-details" aria-label="ノードの処理仕様"><div className="panel-title"><h2>処理仕様 / {n.id}</h2><span>{n.kind}</span></div><div className="details-body">
 <p><b>トリガー：</b>{n.kind==='output'?'受信のみ（追加処理なし）':`${n.trigger.type} trigger`}</p><p>{n.kind==='output'?'届いた値をそのまま保持して表示します。そこから先へは出力しません。':triggerDescriptions[n.trigger.type]}</p>
 {n.trigger.type==='timer'&&<p>周期プロパティ：<code>{n.trigger.periodParameter}</code> = {w.parameters[n.id][n.trigger.periodParameter!]} ／ 次回 t={w.nextDue[n.id]}</p>}
 {n.externalInput&&<p><b>外乱INPUT · 編集不可</b> ／ シード {n.externalInput.seed}</p>}
 {n.trigger.type==='random'&&<p>発火間隔：{n.trigger.minInterval}〜{n.trigger.maxInterval} ステップ ／ 次回 t={w.nextDue[n.id]}</p>}
 <h3>処理方法</h3>{n.externalInput?<code>output ← {n.externalInput.value.type==='uniform'?`uniform(${n.externalInput.value.min}, ${n.externalInput.value.max})`:`${n.externalInput.value.value}`}</code>:n.kind==='input'?<code>output ← {n.id}.{n.inputParameter}</code>:n.kind==='output'?<code>表示値 ← 受信した値</code>:Object.entries(n.update).map(([key,e])=><pre className="processing-rule" key={key}><code>{processingText(e,`${n.id}.state.${key}`,reference)}</code></pre>)}
 {n.kind==='inner'&&<code className="processing-rule">{n.id}.output = {n.id}.state.value</code>}
 {n.kind==='inner'&&<small>式中の他ノードIDは、その有効な接続から最後に受信した値です。無効な接続は計算から除外します。同じ入力先への複数の接続は加算します。fetch は処理開始時の問い合わせ値です。{n.id}.gain は設定プロパティです。右辺の {n.id}.state.value は処理開始直前の保持値（初回は初期値、手動編集も反映）、左辺は今回の計算で更新する状態です。output は更新後の state.value を出力します。</small>}
 <h3>問い合わせ</h3>{s.connections.filter(e=>e.kind==='request'&&e.to===n.id&&w.parameters[e.id].enabled).map(e=><p key={e.id}>処理開始時に {e.from} を取得 → {e.from} の値を使用</p>)}{!s.connections.some(e=>e.kind==='request'&&e.to===n.id&&w.parameters[e.id].enabled)&&<p>このノードからの問い合わせはありません。</p>}
 {n.trigger.type==='request'&&<button onClick={()=>onRequest(n.id)}>問い合わせて計測</button>}
 <h3>発火状況</h3><p>{w.activity[n.id].count} 回 ／ 最後：{w.activity[n.id].lastAt===null?'未発火':`t=${w.activity[n.id].lastAt} (${w.activity[n.id].lastTrigger})`}</p>
 <details><summary>このノードの直近の履歴</summary>{records.map((t,i)=><p key={i}>t={t.time} · {t.trigger} · 値 {t.value.toFixed(3)}{t.requester?` · ${t.trigger==='fetch'?'取得元':'要求元'} ${t.requester}`:''} · 版 {t.version}</p>)}</details>
 </div></section>;
}
