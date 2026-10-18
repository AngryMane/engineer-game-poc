import {useState} from 'react';
import type {Scenario,World} from './engine';
import {KIND_LABELS,formatValue,messageText,signalOf,type MessageRecord,type SignalKind} from './signals';
import {descendants} from './hierarchy';

/** Connections whose messages can be read in the current scope: both ends inside, or crossing its boundary. */
export function scopeConnections(s:Scenario,scope:string|null){
 if(!scope)return s.connections.filter(e=>s.nodes.find(n=>n.id===e.from)!.kind!=='inner'||s.nodes.find(n=>n.id===e.to)!.kind!=='inner');
 const inside=new Set(descendants(s,scope));return s.connections.filter(e=>inside.has(e.from)||inside.has(e.to));
}

/** Details of one connection: what it carries, the last delivery with its times, and recent history. */
export function ConnectionMessages({s,w,connectionId}:{s:Scenario;w:World;connectionId:string}){
 const e=s.connections.find(e=>e.id===connectionId)!,d=signalOf(s,e.signal);
 if(!d)return null;
 const history=[...(w.messages?.[e.id]??[])].reverse(),last=history[0],used=w.frames[e.to].adopted?.[e.id];
 const name=(id:string)=>s.nodes.find(n=>n.id===id)?.label??id;
 return <div className="connection-messages">
  <p><b>{d.label}</b>（{KIND_LABELS[d.kind]}{d.unit?` · ${d.unit}`:''}）：{d.meaning}</p>
  <p>{name(e.from)} → {name(e.to)}</p>
  {last?<dl className="message-times"><dt>最新の値</dt><dd>{formatValue(s,d,last.value)}</dd>{last.measuredAt!==undefined&&<><dt>計測</dt><dd>t={last.measuredAt}</dd></>}<dt>送信</dt><dd>t={last.emittedAt}</dd><dt>受信</dt><dd>t={last.deliveredAt}</dd><dt>受信側の採用</dt><dd>{used?`t=${used.adoptedAt}（送信 t=${used.emittedAt}の値）`:'まだ使われていません'}</dd></dl>:<p className="muted">まだ受信していません（値0とは区別しています）。</p>}
  {history.length>0&&<details><summary>受信履歴（新しい順・{history.length}件）</summary><ol className="message-history">{history.map(m=><li key={m.seq}>t={m.deliveredAt}：{formatValue(s,d,m.value)}{m.measuredAt!==undefined?`（計測 t=${m.measuredAt}）`:''} · 送信 t={m.emittedAt}</li>)}</ol></details>}
 </div>;
}

/** Readable message log for the current scope, newest first. Physical quantities can be hidden. */
export function MessageLog({s,w,scope}:{s:Scenario;w:World;scope:string|null}){
 const [kinds,setKinds]=useState<Record<SignalKind,boolean>>({measurement:true,command:true,status:true,response:true,physical:false});
 const [onlyChanges,setOnlyChanges]=useState(true);
 const edges=scopeConnections(s,scope).filter(e=>kinds[signalOf(s,e.signal)!.kind]);
 const rows:MessageRecord[]=[];
 for(const e of edges){const log=w.messages?.[e.id]??[];log.forEach((m,i)=>{if(!onlyChanges||i===0||log[i-1].value!==m.value)rows.push(m);});}
 rows.sort((a,b)=>b.deliveredAt-a.deliveredAt||b.seq-a.seq);
 return <div className="tab-content message-log">
  <div className="message-filters">{(Object.keys(KIND_LABELS) as SignalKind[]).map(k=><label key={k}><input type="checkbox" checked={kinds[k]} onChange={e=>setKinds(old=>({...old,[k]:e.target.checked}))}/>{KIND_LABELS[k]}</label>)}<label><input type="checkbox" checked={onlyChanges} onChange={e=>setOnlyChanges(e.target.checked)}/>値が変わったときだけ</label></div>
  <p className="muted">いま表示している階層の中と、その境界を通るメッセージです。各接続の最近{32}件まで保持します。</p>
  {rows.length?<ol className="message-lines">{rows.slice(0,120).map(m=><li key={`${m.connectionId}-${m.seq}`}>{messageText(s,m)}</li>)}</ol>:<p className="muted">表示できるメッセージはまだありません。</p>}
 </div>;
}
