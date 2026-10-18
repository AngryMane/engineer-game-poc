import {useLayoutEffect,useRef} from 'react';
import type {Scenario,World} from './engine';
import {formatValue,outputSignal} from './signals';
export function HierarchyOutputs({s,w}:{s:Scenario;w:World}){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const position=()=>{for(const popover of root.current!.querySelectorAll<HTMLElement>('[popover]')){
   const anchor=root.current!.querySelector(`[data-output="${popover.dataset.anchor}"]`);if(!anchor)continue;const r=anchor.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight){if(popover.matches(':popover-open'))popover.hidePopover();continue;}if(!popover.matches(':popover-open'))popover.showPopover();popover.style.left=`${Math.max(8,Math.min(r.left,innerWidth-popover.offsetWidth-8))}px`;popover.style.top=`${Math.max(8,Math.min(r.bottom+6,innerHeight-popover.offsetHeight-8))}px`;
  }};position();const observer=new ResizeObserver(position);if(root.current)observer.observe(root.current);window.addEventListener('resize',position);document.addEventListener('scroll',position,true);return()=>{observer.disconnect();window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true);};
 },[s,w.monitor.alerts]);
 return <div className="system-outputs" ref={root} aria-label="システム最終出力">{s.hierarchy!.outputs.map(p=>{const key=`${p.moduleId}-${p.portId}`,issues=w.monitor.alerts[p.nodeId];return <article key={key} data-output={key} className="system-output"><h3>{p.label}</h3><output>{s.signals?formatValue(s,outputSignal(s,p.nodeId),w.frames[p.nodeId].output):Number(w.frames[p.nodeId].output.toFixed(4))}</output><small>{w.frames[p.nodeId].time===null?(s.signals?'初期値':'initial'):`t=${w.frames[p.nodeId].time}`}</small>{issues&&<div popover="manual" className="output-alert hierarchy-output-alert" data-anchor={key} role="alert" aria-label={`${p.label}の出力異常`}><b>{p.label} · Fault</b>{issues.map(i=>{const sig=s.signals?outputSignal(s,p.nodeId):undefined,show=(v:number)=>sig?formatValue(s,sig,v):String(Number(v.toFixed(4)));return <p key={i.rule}>{sig?'期待':'Expected'} {sig&&/^-?[\d.]+$/.test(i.expected)?show(Number(i.expected)):i.expected} ／ {sig?'実際':'Actual'} {show(i.actual)}</p>;})}</div>}</article>;})}</div>;
}
