import type {Scenario,World,Edit} from './engine';
import {Field,Editor} from './Editor';
import {HierarchyOutputs} from './HierarchyOutputs';
import {ModuleSpecification} from './ModuleDetails';
import {ConnectionMessages} from './MessageLog';
import {KIND_LABELS,formatValue,lastMessage,signalOf} from './signals';
import {deviceConnections,diagnosesLeft,probeOf,type Investigation} from './floorPlan';

const nameOf=(s:Scenario,id:string)=>s.nodes.find(n=>n.id===id)?.label??id;
/** Since when a probe's values may be shown: replays are measured over the whole run. */
export const probeSince=(v:Investigation,id:string,replay:boolean,start:number)=>{const p=probeOf(v,id);return p?(replay?start:p.since):undefined;};

/**
 * Crew console and ship floor plan. Only what the crew sees is live: reports, commands and alarms.
 * Equipment is drawn where it sits; wiring is never drawn.
 */
export function ShipFloor({s,w,v,replay,start,selected,onSelect,onInput,onRemoveProbe}:{s:Scenario;w:World;v:Investigation;replay:boolean;start:number;selected:string|null;onSelect:(id:string)=>void;onInput:(id:string,value:number)=>void;onRemoveProbe:(connectionId:string)=>void}){
 const f=s.floor!,system=s.hierarchy!.modules.find(m=>m.id===s.hierarchy!.systemId)!;
 return <section className="ship" aria-label="宇宙船">
  <section className="panel crew-console" aria-label="乗組員コンソール"><div className="panel-title"><h2>乗組員コンソール</h2><span>報告と指令</span></div>
   <HierarchyOutputs s={s} w={w}/>
   <div className="console-commands">{s.inputs.map(input=><Field key={input.id} item={{...input,target:nameOf(s,input.nodeId),parameter:input.label}} value={w.parameters[input.nodeId][input.parameter]} onEdit={onInput}/>)}</div>
   <details className="console-contract"><summary>運用契約（クリア条件）</summary><ModuleSpecification s={s} spec={system.spec} moduleId={system.id}/></details>
  </section>
  <section className="panel ship-plan" aria-label="船内配置図"><div className="panel-title"><h2>船内配置図</h2><span>設備をクリックすると、マニュアル・計測点・診断</span></div>
   <div className="plan">
    {f.compartments.map(c=><div key={c.id} className={`compartment${c.outside?' outside':''}`} style={{left:`${c.x}%`,top:`${c.y}%`,width:c.outside?undefined:`${c.w}%`,height:`${c.h}%`}}><span>{c.label}</span></div>)}
    {f.devices.map(d=>{const {inputs,outputs}=deviceConnections(s,d.nodeId),probes=[...inputs,...outputs].filter(e=>probeOf(v,e.id)).length;
     return <button key={d.nodeId} className={`device${selected===d.nodeId?' chosen':''}`} style={{left:`${d.x}%`,top:`${d.y}%`}} onClick={()=>onSelect(d.nodeId)} aria-label={`設備 ${d.label??nameOf(s,d.nodeId)}`}><span className="device-icon" aria-hidden="true">{d.icon}</span><span>{d.label??nameOf(s,d.nodeId)}</span>{(probes>0||v.diagnosed.includes(d.nodeId))&&<small>{probes>0?`計測 ${probes}`:''}{probes>0&&v.diagnosed.includes(d.nodeId)?' · ':''}{v.diagnosed.includes(d.nodeId)?'診断済み':''}</small>}</button>;})}
   </div>
   <div className="channels" aria-label="計測チャンネル"><b>計測チャンネル {v.probes.length}/{f.channels}</b>{v.probes.map(p=>{const e=s.connections.find(e=>e.id===p.connectionId)!,m=lastMessage(w,e.id),since=probeSince(v,e.id,replay,start)!,shown=m&&m.deliveredAt>=since;
     return <span className="channel" key={p.connectionId}>{signalOf(s,e.signal)!.label}（{nameOf(s,e.from)} → {nameOf(s,e.to)}）：<b>{shown?formatValue(s,e.signal,m.value):'記録待ち'}</b>{shown?` · 受信 t=${m.deliveredAt}`:''}<button onClick={()=>onRemoveProbe(p.connectionId)} aria-label="計測点を外す">外す</button></span>;})}{!v.probes.length&&<span className="muted">計測点はまだありません。</span>}</div>
  </section>
 </section>;
}

/** What a device's panel shows before and after diagnosis. Settings and internal state are hidden until diagnosed. */
export function ShipDevicePanel({s,w,v,id,replay,start,purpose,setPurpose,onEdit,onProbe,onRemoveProbe,onDiagnose}:{s:Scenario;w:World;v:Investigation;id:string;replay:boolean;start:number;purpose:Edit['purpose'];setPurpose:(p:Edit['purpose'])=>void;onEdit:(id:string,value:number)=>void;onProbe:(connectionId:string)=>void;onRemoveProbe:(connectionId:string)=>void;onDiagnose:(id:string,extra:boolean)=>void}){
 const d=s.floor!.devices.find(d=>d.nodeId===id)!,n=s.nodes.find(n=>n.id===id)!,{inputs,outputs}=deviceConnections(s,id);
 const room=s.floor!.compartments.find(c=>c.id===d.compartment)!.label,left=diagnosesLeft(s,v),diagnosed=v.diagnosed.includes(id);
 const row=(e:typeof inputs[number],direction:'in'|'out')=>{const sig=signalOf(s,e.signal)!,since=probeSince(v,e.id,replay,start),other=direction==='in'?e.from:e.to;
  return <li key={e.id} className="device-signal"><div><b>{direction==='in'?'受け取る':'送る'}：{sig.label}</b>（{KIND_LABELS[sig.kind]}{sig.unit?` · ${sig.unit}`:''}）{direction==='in'?' ← ':' → '}{nameOf(s,other)}</div>
   {since===undefined?<button onClick={()=>onProbe(e.id)} disabled={v.probes.length>=s.floor!.channels}>計測点を置く</button>:<><ConnectionMessages s={s} w={w} connectionId={e.id} since={since}/><button onClick={()=>onRemoveProbe(e.id)}>計測点を外す</button></>}</li>;};
 return <section className="panel ship-device"><div className="details-body">
  <h2>{n.label}</h2><p className="muted">{room}</p>
  <h3>保守マニュアル</h3>{d.manual.map((line,i)=><p key={i}>{line}</p>)}
  <h3>信号と計測点</h3><p className="muted">計測チャンネル {v.probes.length}/{s.floor!.channels} 本使用中。値は計測点を置いた時刻から記録されます（実験の再生では最初から）。</p>
  <ul className="device-signals">{inputs.map(e=>row(e,'in'))}{outputs.map(e=>row(e,'out'))}</ul>
  <h3>診断</h3>
  {n.externalInput?<p className="muted">船外の設備は診断できません。</p>:diagnosed?<>
   <p className="muted">診断済み。内部の状態と設定を表示しています。</p>
   <ul className="device-state">{Object.entries(w.states[id]).map(([key,value])=><li key={key}><code>{key}</code> = {Number(value.toFixed(4))}</li>)}</ul>
   <Editor s={s} w={w} selected={id} purpose={purpose} setPurpose={setPurpose} onEdit={onEdit}/>
  </>:<><p>診断すると、この設備の内部状態と設定が見え、設定を変更（修理）できるようになります。</p>
   {left>0?<button onClick={()=>onDiagnose(id,false)}>診断する（残り {left} 回）</button>:<><p className="muted">診断の残り回数がありません。追加の診断はできますが、回数として記録されます。</p><button onClick={()=>onDiagnose(id,true)}>追加で診断する</button></>}</>}
 </div></section>;
}
