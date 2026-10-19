import type {Scenario,World,Edit} from './engine';
import {HierarchyOutputs} from './HierarchyOutputs';
import {ModuleSpecification} from './ModuleDetails';
import {Field} from './Editor';
import {ConnectionMessages} from './MessageLog';
import {KIND_LABELS,formatValue,lastMessage,signalOf} from './signals';
import {deviceConnections,displaysIn,voicesIn} from './floorPlan';

const nameOf=(s:Scenario,id:string)=>s.nodes.find(n=>n.id===id)?.label??id;
/** The values a command console offers, with their names from the signal dictionary. */
const choices=(s:Scenario,input:Scenario['inputs'][number]):[number,string][]=>{const d=signalOf(s,s.nodes.find(n=>n.id===input.nodeId)?.signals?.out?.value);const out:[number,string][]=[];for(let v=input.min;v<=input.max+1e-9;v+=input.step)out.push([v,d?.values?.[v]??String(v)]);return out;};
/**
 * The current room's screens and the ship floor plan. Outputs are read on screens in crew rooms, and
 * consoles are operated there, so the mechanic has to go to a room to use it. Wiring is never drawn.
 */
export function ShipFloor({s,w,room,selected,onMove,onSelect,onInput}:{s:Scenario;w:World;room:string;selected:string|null;onMove:(room:string)=>void;onSelect:(id:string)=>void;onInput:(id:string,value:number)=>void}){
 const f=s.floor!,system=s.hierarchy!.modules.find(m=>m.id===s.hierarchy!.systemId)!,here=f.compartments.find(c=>c.id===room)!,shown=displaysIn(s,room);
 const elsewhere=Object.keys(w.monitor.alerts).filter(id=>id!==f.alarm&&f.displays[id]&&f.displays[id]!==room).map(id=>f.compartments.find(c=>c.id===f.displays[id])!.label);
 return <section className="ship" aria-label="宇宙船">
  <section className="panel crew-console" aria-label="この部屋の表示"><div className="panel-title"><h2>{here.label}の表示</h2><span>{here.access==='crew'?`${here.role}のクルーの部屋。表示はこの部屋でだけ見られます`:'整備区画（メカニックだけが入れる）。クルー向けの表示はありません'}</span></div>
   {shown.length>0&&<HierarchyOutputs s={s} w={w} only={shown}/>}{!shown.some(id=>id!==f.alarm)&&<p className="muted">この部屋に表示はありません。表示を見るには、クルーの部屋（{f.compartments.filter(c=>c.access==='crew').map(c=>c.label).join('・')}）へ移動してください。</p>}
   {(v=>v.length>0&&<ul className="crew-voices" aria-label="クルーの声">{v.map((line,i)=><li key={i}>「{line}」</li>)}</ul>)(voicesIn(s,w,room))}
   {elsewhere.length>0&&<p className="alarm-elsewhere" role="status">警報：{[...new Set(elsewhere)].join('・')}の表示に異常があります。</p>}
   <details className="console-contract"><summary>運用契約（クリア条件）</summary><ModuleSpecification s={s} spec={system.spec} moduleId={system.id}/></details>
  </section>
  <section className="panel ship-plan" aria-label="船内配置図"><div className="panel-title"><h2>船内配置図</h2><span>部屋をクリックすると移動します。設備をクリックすると、メカニックとしてその設備の入力・出力・プロパティを点検できます</span></div>
   <div className="plan">
    {f.compartments.map(c=><div key={c.id} className={`compartment ${c.access}${c.id===room?' here':''}${c.outside?' outside':''}`} style={{left:`${c.x}%`,top:`${c.y}%`,width:c.outside?undefined:`${c.w}%`,height:`${c.h}%`}}>{c.access==='outside'?<span>{c.label}</span>:<button className="room-name" onClick={()=>onMove(c.id)} aria-label={`${c.label}へ移動`} aria-current={c.id===room?'location':undefined}>{c.label}<small>{c.access==='crew'?c.role:'整備区画'}{c.id===room?' · 現在地':''}</small></button>}</div>)}
    {f.devices.map(d=>{const label=d.label??nameOf(s,d.nodeId),commands=s.inputs.filter(i=>i.nodeId===d.nodeId),inRoom=d.compartment===room;
     // Consoles are operated only by someone standing in their room; the name opens the device panel.
     if(commands.length)return <div key={d.nodeId} className={`device console-device${selected===d.nodeId?' chosen':''}`} style={{left:`${d.x}%`,top:`${d.y}%`}}><button className="device-open" onClick={()=>onSelect(d.nodeId)} aria-label={`設備 ${label}`}><span className="device-icon" aria-hidden="true">{d.icon}</span><span>{label}</span></button>{commands.map(input=><div key={input.id} className="command-switch" role="group" aria-label={input.label} title={inRoom?undefined:'この部屋にいるときだけ操作できます'}>{choices(s,input).map(([value,text])=><button key={value} disabled={!inRoom} className={w.parameters[input.nodeId][input.parameter]===value?'on':''} aria-pressed={w.parameters[input.nodeId][input.parameter]===value} onClick={()=>onInput(input.id,value)}>{text}</button>)}</div>)}</div>;
     return <button key={d.nodeId} className={`device${selected===d.nodeId?' chosen':''}`} style={{left:`${d.x}%`,top:`${d.y}%`}} onClick={()=>onSelect(d.nodeId)} aria-label={`設備 ${label}`}><span className="device-icon" aria-hidden="true">{d.icon}</span><span>{label}</span></button>;})}
   </div>
  </section>
 </section>;
}

/**
 * One device, in three parts that never mix: the values it receives (inputs), the values it sends
 * (outputs), and its own properties (settings, which can be edited, and internal state).
 */
export function ShipDevicePanel({s,w,id,purpose,setPurpose,onEdit}:{s:Scenario;w:World;id:string;purpose:Edit['purpose'];setPurpose:(p:Edit['purpose'])=>void;onEdit:(id:string,value:number)=>void}){
 const d=s.floor!.devices.find(d=>d.nodeId===id)!,n=s.nodes.find(n=>n.id===id)!,{inputs,outputs}=deviceConnections(s,id);
 const room=s.floor!.compartments.find(c=>c.id===d.compartment)!.label,label=(key:string)=>d.properties?.[key]??key;
 const outKeys=Object.keys(n.signals?.out??{}),command=s.inputs.find(i=>i.nodeId===id);
 const settings=Object.keys(n.parameters).filter(key=>key!==command?.parameter),states=Object.keys(n.initialState).filter(key=>!outKeys.includes(key));
 const kind=(sig:NonNullable<ReturnType<typeof signalOf>>)=>`${KIND_LABELS[sig.kind]}${sig.unit?` · ${sig.unit}`:''}`;
 return <section className="panel ship-device"><div className="details-body">
  <h2>{d.label??n.label}</h2><p className="muted">{room} · {n.kind==='inner'?'クルーからは見えない設備です。メカニックだけが点検し、設定を変えられます。':n.externalInput?'船外の設備です。誰も操作できません。':'クルーが操作する設備です。'}</p>
  <h3>説明</h3>{d.manual.map((line,i)=><p key={i}>{line}</p>)}
  <h3>入力（この設備が受け取る値）</h3>
  <table className="device-io"><thead><tr><th>値</th><th>送り元</th><th>最新の値</th><th>受け取った時刻</th></tr></thead><tbody>
   {command&&<tr><th scope="row">{command.label}</th><td>クルーの操作（配置図の操作卓）</td><td>{formatValue(s,n.signals?.out?.value,w.parameters[id][command.parameter])}</td><td>—</td></tr>}
   {n.externalInput&&<tr><th scope="row">{n.label}</th><td>船外環境（操作できない）</td><td>{formatValue(s,n.signals?.out?.value,w.states[id].value)}</td><td>—</td></tr>}
   {inputs.map(e=>{const sig=signalOf(s,e.signal)!,m=lastMessage(w,e.id);return <tr key={e.id}><th scope="row">{sig.label}<small>{kind(sig)}</small></th><td>{nameOf(s,e.from)}</td><td>{m?formatValue(s,sig,m.value):'まだ受け取っていない'}</td><td>{m?`t=${m.deliveredAt}`:'—'}</td></tr>;})}
  </tbody></table>
  {!inputs.length&&!command&&!n.externalInput&&<p className="muted">受け取る値はありません。</p>}
  <h3>出力（この設備が送る値）</h3>
  <table className="device-io"><thead><tr><th>値</th><th>現在の値</th><th>送り先</th><th>相手に届いた最新の値の送信時刻</th></tr></thead><tbody>
   {outKeys.map(key=>{const sig=signalOf(s,n.signals!.out![key])!,edges=outputs.filter(e=>(e.sourceKey??'value')===key),m=edges.map(e=>lastMessage(w,e.id)).filter(Boolean).sort((a,b)=>b!.emittedAt-a!.emittedAt)[0];
    return <tr key={key}><th scope="row">{sig.label}<small>{kind(sig)}</small></th><td>{formatValue(s,sig,w.states[id][key])}</td><td>{edges.map(e=>nameOf(s,e.to)).join('、')||'—'}</td><td>{m?`t=${m.emittedAt}`:'まだ送っていない'}</td></tr>;})}
  </tbody></table>
  <p className="muted">現在の値は、この設備がいま計算した値です。送った値は次の tick に相手に届きます。</p>
  <h3>プロパティ（この設備の設定と内部状態）</h3>
  {settings.length>0&&<><h4>設定</h4><div className="edit-purpose"><label>変更の目的<select value={purpose} onChange={e=>setPurpose(e.target.value as Edit['purpose'])}><option value="experiment">実験</option><option value="repair">修理</option></select></label><small className="muted">設定を変えられるのはメカニックだけです。</small></div>
   <ul className="device-properties">{settings.map(key=>{const item=s.interventions.find(i=>i.target===id&&i.parameter===key&&i.storage!=='state');
    return <li key={key}>{item?<Field item={{...item,parameter:label(key)}} value={w.parameters[id][key]} onEdit={onEdit} actionLabel="変更"/>:<><span>{label(key)}</span> <b>{Number(w.parameters[id][key].toFixed(4))}</b> <small className="muted">変更できません</small></>}</li>;})}</ul></>}
  {states.length>0&&<><h4>内部状態</h4><ul className="device-properties">{states.map(key=><li key={key}><span>{label(key)}</span> <b>{Number(w.states[id][key].toFixed(4))}</b></li>)}</ul></>}
  {!settings.length&&!states.length&&<p className="muted">プロパティはありません。</p>}
  {(inputs.length>0||outputs.length>0)&&<details><summary>受け渡しの履歴</summary>{[...inputs,...outputs].map(e=><ConnectionMessages key={e.id} s={s} w={w} connectionId={e.id}/>)}</details>}
 </div></section>;
}
