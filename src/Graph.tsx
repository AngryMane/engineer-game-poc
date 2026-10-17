import {useState,useRef,useEffect} from 'react';
import type {Scenario,World} from './engine';
import {OutputAlerts} from './OutputAlerts';
import {Field} from './Editor';
export function Graph({scenario:s,selected,onSelect,values,world,onInput}:{scenario:Scenario;selected:string;onSelect:(id:string)=>void;values:Record<string,number>;world:World;onInput:(id:string,value:number)=>void}){
 const [zoom,setZoom]=useState(1);
 const viewport=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:number;x:number;y:number;left:number;top:number}|null>(null);
 const [dragging,setDragging]=useState(false);
 const nodes=s.nodes.map(n=>({...n,x:n.kind==='input'?140:n.x*1.45+240,y:n.y+85}));
 const connections=s.connections.filter(e=>s.visibleConnectionIds.includes(e.id));
 const ports=new Map<string,{x:number;y:number;side:'left'|'top'|'bottom'}>();
 for(const node of nodes){
  const incoming=connections.filter(e=>e.to===node.id);
  for(const side of ['left','top','bottom'] as const){
   const group=incoming.filter(e=>{const source=nodes.find(n=>n.id===e.from)!;return (Math.abs(source.y-node.y)<50&&source.x<node.x?'left':source.y<node.y?'top':'bottom')===side;});
   group.forEach((e,i)=>{const offset=(i-(group.length-1)/2)*42;ports.set(e.id,{x:side==='left'?-60:offset,y:side==='left'?offset:side==='top'?-40:40,side});});
  }
 }
 const number=(value:number|undefined)=>value===undefined?'?':Number(value.toFixed(2)).toString();
 function outputPort(node:typeof nodes[number]){const x=node.kind==='input'?120:60;return <g className="value-port output-port" transform={`translate(${x},0)`}><circle r="16"/><text aria-label={`${node.id} の出力`} textAnchor="middle" dominantBaseline="central">{number(world.frames[node.id].output)}</text></g>;}
 const width=Math.max(820,...nodes.map(n=>n.x+100)),height=Math.max(380,...nodes.map(n=>n.y+85));
 function fit(){if(viewport.current)setZoom(Math.max(0.5,Math.min(1,Math.floor(viewport.current.clientWidth/width*10)/10)));}
 useEffect(fit,[width]);
 return <section className="panel graph-panel"><div className="panel-title"><h2>Graph / {s.nodes.length} nodes</h2><span>Connections</span></div>
 <div className="graph-navigation"><label>Select…<select aria-label="グラフの対象" value={selected} onChange={e=>onSelect(e.target.value)}>{(['input','output','inner'] as const).map(kind=><optgroup key={kind} label={kind}>{s.nodes.filter(n=>n.kind===kind&&s.visibleNodeIds.includes(n.id)).map(n=><option key={n.id} value={n.id}>{n.id} / {kind}</option>)}</optgroup>)}<optgroup label="接続">{s.visibleConnectionIds.map(id=><option key={id}>{id}</option>)}</optgroup><optgroup label="追加の計測対象">{s.observations.filter(o=>!s.visibleNodeIds.includes(o.target)&&!s.visibleConnectionIds.includes(o.target)).map(o=><option key={o.id} value={o.target}>{o.target}</option>)}</optgroup></select></label><label>Zoom<input aria-label="グラフ拡大率" type="range" min="0.5" max="1.5" step="0.1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><output>{Math.round(zoom*100)}%</output></label><button onClick={fit}>Fit</button><button onClick={()=>setZoom(1)}>100%</button></div>
 <div ref={viewport} className={`graph-viewport ${dragging?'dragging':''}`} tabIndex={0}
 onPointerDown={e=>{if(e.button!==0||(e.target as Element).closest('.graph-node,.edge,input,button,select'))return;const el=e.currentTarget;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop};el.setPointerCapture(e.pointerId);setDragging(true);e.preventDefault();}}
 onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;e.currentTarget.scrollLeft=d.left+d.x-e.clientX;e.currentTarget.scrollTop=d.top+d.y-e.clientY;}}
 onPointerUp={e=>{if(drag.current?.id===e.pointerId){drag.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}}
 onPointerCancel={()=>{drag.current=null;setDragging(false);}} onLostPointerCapture={()=>{drag.current=null;setDragging(false);}} aria-label="グラフ表示領域。横と縦にスクロールできます"><svg className="network" style={{width:width*zoom,height:height*zoom}} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="既知のノードと接続"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#728b98"/></marker></defs>
 {connections.map(e=>{
 const enabled=Boolean(world.parameters[e.id].enabled);
 const a=nodes.find(n=>n.id===e.from)!,b=nodes.find(n=>n.id===e.to)!,port=ports.get(e.id)!;
 const ax=a.x+(a.kind==='input'?136:76),ay=a.y,bx=b.x+port.x-(port.side==='left'?16:0),by=b.y+port.y+(port.side==='top'?-16:port.side==='bottom'?16:0);
 const horizontal=port.side==='left'&&Math.abs(ay-by)<50;
 const corridor=a.x+(a.kind==='input'?175:110),lane=b.y+(port.side==='top'?-75:75);
 const curve=horizontal?`M${ax},${ay} L${bx},${by}`:`M${ax},${ay} L${corridor},${ay} L${corridor},${lane} L${bx},${lane} L${bx},${by}`;
 return <g key={e.id} className={`edge ${enabled?'':'disabled'}`} role="button" tabIndex={0} aria-label={`${e.id} ${e.from} から ${e.to}`} onClick={()=>onSelect(e.id)} onKeyDown={v=>{if(v.key==='Enter'||v.key===' '){v.preventDefault();onSelect(e.id);}}}><title>{`${e.id}: ${e.from} → ${e.to}${enabled?'':' / 無効'}`}</title><path d={curve} stroke="transparent" strokeWidth="16" fill="none"/><path d={curve} stroke={selected===e.id?'#50ddc1':e.kind==='signal'?'#728b98':e.kind==='request'?'#8dc6ff':'#ac9bff'} strokeDasharray={e.kind==='signal'?undefined:e.kind==='request'?'2 5':'5 4'} strokeWidth={selected===e.id?3:1.5} fill="none" markerEnd="url(#arrow)"/><text x={horizontal?(ax+bx)/2:corridor+5} y={horizontal?ay-9:(ay+lane)/2}>{e.id}{!enabled?' (無効)':''}</text></g>;})}
 {nodes.filter(n=>s.visibleNodeIds.includes(n.id)).map(n=>{
 const inputs=s.inputs.filter(i=>i.nodeId===n.id),cardHeight=n.externalInput?180:100+inputs.length*90;
 return n.kind==='input'?<g key={n.id} role="group" aria-label={`ノード ${n.id}`} data-kind={n.kind} className={`graph-node input ${selected===n.id?'selected':''}`} transform={`translate(${n.x},${n.y})`}>
 <foreignObject x={-120} y={-cardHeight/2} width={240} height={cardHeight}><div className={`graph-input-card ${n.externalInput?'external-input':''}`}><button className="input-heading" onClick={()=>onSelect(n.id)}>INPUT / {n.label} · {n.trigger.type} trigger</button>{n.externalInput&&<div className="external-summary"><b>External · Locked</b><p>{n.externalInput.value.type==='uniform'?`uniform(${n.externalInput.value.min}, ${n.externalInput.value.max})`:`constant ${n.externalInput.value.value}`}</p><p>{n.trigger.type==='random'?`${n.trigger.minInterval}–${n.trigger.maxInterval} ticks`:`period ${world.parameters[n.id][n.trigger.periodParameter!]}`}</p></div>}{inputs.map(i=><Field key={i.id} item={{...i,target:i.nodeId,parameter:i.label}} value={world.parameters[i.nodeId][i.parameter]} actionLabel="Apply" onEdit={onInput}/>)}<p>{n.externalInput?'Read-only':'Edit → Apply'}</p></div></foreignObject>{outputPort(n)}</g>:
 <g key={n.id} role="button" tabIndex={0} aria-label={`ノード ${n.id}`} data-kind={n.kind} className={`graph-node ${n.kind} ${selected===n.id?'selected':''} ${world.monitor.alerts[n.id]?'abnormal':''}`} transform={`translate(${n.x},${n.y})`} onClick={()=>onSelect(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n.id);}}}><rect x="-60" y="-40" width="120" height="80" rx="15"/><text className="node-kind" textAnchor="middle" y="-8">{n.kind.toUpperCase()}</text><text textAnchor="middle" y="13">{n.label}</text>{connections.filter(e=>e.to===n.id).map(e=>{const port=ports.get(e.id)!;return <g key={e.id} className="value-port input-port" transform={`translate(${port.x},${port.y})`}><title>{`${e.id}: ${e.from} → ${n.id} / 入力`}</title><circle r="16"/><text aria-label={`${e.id} ${n.id} の入力 ${e.input}`} textAnchor="middle" dominantBaseline="central">{number(world.frames[n.id].inputs[e.id])}</text></g>;})}{outputPort(n)}</g>;})}
 </svg></div><OutputAlerts alerts={world.monitor.alerts}/><div className="graph-footer"><span>INPUT · OUTPUT · INNER · dotted: fetch</span><span>IN / OUT: same computation · ?: pending · Drag to pan</span></div></section>;
}
