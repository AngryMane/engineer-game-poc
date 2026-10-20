import type {Connection,Node,Scenario,World} from './engine';

/**
 * Meaning-bearing messages. A connection carries one kind of information (a signal); the engine
 * still computes with numbers, but every delivery is logged with what it means, who produced it,
 * when the quantity was measured, when it was sent and when it arrived. Scenarios without a
 * signal dictionary keep the old untyped behaviour and are never shown with invented units.
 */
export type SignalKind='measurement'|'command'|'status'|'response'|'physical';
export type SignalDefinition={id:string;label:string;unit?:string;valueType:'number'|'boolean'|'enum';meaning:string;kind:SignalKind;values?:Record<number,string>;digits?:number};
/** Declared on a node: which signal each input expects and each state key emits. */
export type NodeSignals={in?:Record<string,string>;out?:Record<string,string>;measures?:string};
export type MessageStamp={seq:number;origin:string;emittedAt:number;measuredAt?:number};
export type MessageRecord=MessageStamp&{connectionId:string;signal:string;value:number;deliveredAt:number};
/** What a computation used from one input connection. */
export type Adoption={seq:number;emittedAt:number;deliveredAt:number;measuredAt?:number;adoptedAt:number};
export const MESSAGE_HISTORY=32;
export const KIND_LABELS:Record<SignalKind,string>={measurement:'測定値の報告',command:'指示',status:'状態の報告',response:'応答',physical:'実際の値'};

export const signalOf=(s:Scenario,id:string|undefined)=>id?s.signals?.find(d=>d.id===id):undefined;
export const connectionSignal=(s:Scenario,e:Connection)=>signalOf(s,e.signal);
/** The signal a node's output (its `value`, or another state key) carries. */
/** Output nodes report what they receive, so their signal is the one on their input. */
export function outputSignal(s:Scenario,nodeId:string,key='value'){const n=s.nodes.find(n=>n.id===nodeId);return signalOf(s,n?.signals?.out?.[key]??(n?.kind==='output'?n.signals?.in?.signal:undefined)??s.connections.find(e=>e.from===nodeId&&(e.sourceKey??'value')===key)?.signal);}

export function validateSignals(s:Scenario){
 const defs=s.signals;
 if(!defs){
  if(s.nodes.some(n=>n.signals)||s.connections.some(e=>e.signal))throw Error('信号辞書のないシナリオで信号を参照しています');
  return;
 }
 const ids=defs.map(d=>d.id);
 if(new Set(ids).size!==ids.length)throw Error('重複した信号ID');
 for(const d of defs)if(!d.id||!d.label||!d.meaning||!['number','boolean','enum'].includes(d.valueType)||!(d.kind in KIND_LABELS)||d.valueType==='enum'&&!d.values)throw Error(`不正な信号定義：${d.id}`);
 const known=(id:string,where:string)=>{if(!ids.includes(id))throw Error(`未定義の信号 ${id}（${where}）`);};
 for(const n of s.nodes){
  for(const [input,id] of Object.entries(n.signals?.in??{}))known(id,`${n.id}.${input}`);
  for(const [key,id] of Object.entries(n.signals?.out??{})){known(id,`${n.id}.${key}`);if(!(key in n.initialState))throw Error(`${n.id} に状態 ${key} がありません`);}
  if(n.signals?.measures&&!s.connections.some(e=>e.to===n.id&&e.input===n.signals!.measures))throw Error(`${n.id} の計測対象の入力がありません`);
 }
 for(const e of s.connections){
  if(!e.signal)throw Error(`接続 ${e.id} に信号がありません`);
  known(e.signal,e.id);const d=signalOf(s,e.signal)!;
  if((d.unit??'')!==(e.unit==='abstract'?'':e.unit))throw Error(`接続 ${e.id} の単位 ${e.unit} が信号 ${d.label} の単位 ${d.unit??'なし'} と一致しません`);
  const from=s.nodes.find(n=>n.id===e.from)!,to=s.nodes.find(n=>n.id===e.to)!;
  const sent=from.signals?.out?.[e.sourceKey??'value'],expected=to.signals?.in?.[e.input];
  // Mismatches are reported with units so that a temperature wired into a power input is obvious.
  for(const [side,id] of [['送信側',sent],['受信側',expected]] as const)if(id&&id!==e.signal){const other=signalOf(s,id)!;throw Error(`接続 ${e.id} の信号が${side}と一致しません：${d.label}（${d.unit??'単位なし'}）≠ ${other.label}（${other.unit??'単位なし'}）`);}
 }
}

/** Stamp for a message that a node sends now. A sensor's measurement time is when the value it read was produced. */
export function stampFor(s:Scenario,w:World,n:Node,e:Connection):MessageStamp{
 const d=signalOf(s,e.signal);let measuredAt:number|undefined;
 if(d?.kind==='measurement'&&n.signals?.measures){const source=s.connections.find(c=>c.to===n.id&&c.input===n.signals!.measures);const used=source&&w.frames[n.id].adopted?.[source.id];measuredAt=used?used.emittedAt:undefined;}
 return {seq:w.sequence,origin:n.id,emittedAt:w.time,...(measuredAt!==undefined?{measuredAt}:{})};
}
export function deliver(w:World,e:Connection,value:number,stamp:MessageStamp){
 const log=(w.messages??={})[e.id]??=[];
 log.push({...stamp,connectionId:e.id,signal:e.signal!,value,deliveredAt:w.time});
 if(log.length>MESSAGE_HISTORY)log.splice(0,log.length-MESSAGE_HISTORY);
}
export const lastMessage=(w:World,id:string)=>w.messages?.[id]?.at(-1);

const trim=(v:number,digits=2)=>Number(v.toFixed(digits)).toString();
/** "36.2 °C", "運転中", or a plain number for untyped scenarios. */
export function formatValue(s:Scenario,signal:string|SignalDefinition|undefined,value:number){
 const d=typeof signal==='string'?signalOf(s,signal):signal;
 if(!d)return trim(value,4);
 if(d.values&&d.values[value]!==undefined)return d.values[value];
 return d.unit?`${trim(value,d.digits)} ${d.unit}`:trim(value,d.digits);
}
const nameOf=(s:Scenario,id:string)=>s.nodes.find(n=>n.id===id)?.label??id;
/** Human-readable log line for one delivery. */
export function messageText(s:Scenario,m:MessageRecord){
 const e=s.connections.find(e=>e.id===m.connectionId)!,d=signalOf(s,m.signal)!;
 const measured=m.measuredAt!==undefined?`（計測 t=${m.measuredAt}）`:'';
 return `t=${m.deliveredAt} 受信 · ${nameOf(s,m.origin)} → ${nameOf(s,e.to)}：${d.label}の${KIND_LABELS[d.kind]} ${formatValue(s,d,m.value)}${measured} · 送信 t=${m.emittedAt}`;
}
