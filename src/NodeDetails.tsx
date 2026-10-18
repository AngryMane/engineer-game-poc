import type {Expr,Scenario,World} from './engine';
import {processingText} from './expressionFormat';
import {formatValue,signalOf,KIND_LABELS} from './signals';
export {expressionText,processingText} from './expressionFormat';
const triggerDescriptions={random:'Random interval.',manual:'Once per value change.',timer:'Every period ticks.',input:'On each input event.',request:'On fetch request.'};
export function NodeDetails({s,w,selected,onRequest,referenceNames={}}:{s:Scenario;w:World;selected:string;onRequest:(id:string)=>void;referenceNames?:Record<string,string>}){
 const n=s.nodes.find(n=>n.id===selected);if(!n)return null;
 const reference=(ref:string)=>{
  if(ref.startsWith('param.'))return `${n.id}.${ref.slice(6)}`;
  if(ref.startsWith('state.'))return `${n.id}.state.${ref.slice(6)}`;
  if(!ref.startsWith('input.'))return ref;
  if(s.signals){const e=s.connections.find(e=>e.to===n.id&&e.input===ref.slice(6));return e?`［${signalOf(s,e.signal)!.label}］`:'0';}
  const sources=s.connections.filter(e=>e.to===n.id&&e.input===ref.slice(6)&&w.parameters[e.id].enabled).sort((a,b)=>a.id.localeCompare(b.id));
  if(!sources.length)return '0';
  const names=sources.map(e=>e.kind==='request'?`fetch(${referenceNames[e.from]??e.from})`:(referenceNames[e.from]??e.from));
  return names.length===1?names[0]:`(${names.join(' + ')})`;
 };
 const records=w.trace.filter(t=>t.nodeId===selected).slice(-6).reverse();
 return <section className="panel node-details" aria-label="ノードの処理仕様"><div className="panel-title"><h2>Process / {n.id}</h2><span>{n.kind}</span></div><div className="details-body">
 <p><b>Trigger: </b>{n.kind==='output'?'receive':`${n.trigger.type} trigger`}</p><p>{n.kind==='output'?'Holds received value.':triggerDescriptions[n.trigger.type]}</p>
 {n.trigger.type==='timer'&&<p>Period: <code>{n.trigger.periodParameter}</code> = {w.parameters[n.id][n.trigger.periodParameter!]} · next t={w.nextDue[n.id]}</p>}
 {n.externalInput&&<p><b>External · Locked</b> · seed {n.externalInput.seed}</p>}
 {n.trigger.type==='random'&&<p>Interval: {n.trigger.minInterval}〜{n.trigger.maxInterval} ステップ · next t={w.nextDue[n.id]}</p>}
 <h3>Process</h3>{n.externalInput?<code>output ← {n.externalInput.value.type==='uniform'?`uniform(${n.externalInput.value.min}, ${n.externalInput.value.max})`:`${n.externalInput.value.value}`}</code>:n.kind==='input'?<code>output ← {n.id}.{n.inputParameter}</code>:n.kind==='output'?<code>output = received</code>:Object.entries(n.update).map(([key,e])=><pre className="processing-rule" key={key}><code>{processingText(e,`${n.id}.state.${key}`,reference)}</code></pre>)}
 {n.kind==='inner'&&<code className="processing-rule">{n.id}.output = {n.id}.state.value</code>}
 {n.kind==='inner'&&<small>Node ID = last received value · fetch(ID) = requested value · state = stored value before computation.</small>}
 {Object.values(referenceNames).some(name=>name.startsWith('boundary.'))&&<small>boundary.* = module input port.</small>}
 {s.signals&&<><h3>受け取った情報</h3><ul className="adoptions">{s.connections.filter(e=>e.to===n.id).map(e=>{const d=signalOf(s,e.signal)!,used=w.frames[n.id].adopted?.[e.id];return <li key={e.id}><b>{d.label}</b>（{KIND_LABELS[d.kind]}）：{formatValue(s,d,w.frames[n.id].inputs[e.id])}{used?` · 採用 t=${used.adoptedAt} · 送信 t=${used.emittedAt}${used.measuredAt!==undefined?` · 計測 t=${used.measuredAt}`:''}`:' · 未受信（初期値）'}</li>;})}</ul><small>入力名 input.X は、この表の情報を指します：{s.connections.filter(e=>e.to===n.id).map(e=>`input.${e.input} = ${signalOf(s,e.signal)!.label}`).join('、')}</small></>}
 <h3>Requests</h3>{s.connections.filter(e=>e.kind==='request'&&e.to===n.id&&w.parameters[e.id].enabled).map(e=><p key={e.id}>fetch({referenceNames[e.from]??e.from})</p>)}{!s.connections.some(e=>e.kind==='request'&&e.to===n.id&&w.parameters[e.id].enabled)&&<p>None</p>}
 {n.trigger.type==='request'&&<button onClick={()=>onRequest(n.id)}>Fetch</button>}
 <h3>Activity</h3><p>{w.activity[n.id].count} events · last: {w.activity[n.id].lastAt===null?'—':`t=${w.activity[n.id].lastAt} (${w.activity[n.id].lastTrigger})`}</p>
 <details><summary>Recent events</summary>{records.map((t,i)=><p key={i}>t={t.time} · {t.trigger} · value {t.value.toFixed(3)}{t.requester?` · ${t.trigger==='fetch'?'取得元':'要求元'} ${referenceNames[t.requester]??t.requester}`:''} · v{t.version}</p>)}</details>
 </div></section>;
}
