import {useLayoutEffect,useRef} from 'react';
import type {OutputIssue} from './contracts';
export function OutputAlerts({alerts}:{alerts:Record<string,OutputIssue[]>}){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const position=()=>{
   for(const el of root.current!.querySelectorAll<HTMLDivElement>('[popover]')){
    const node=document.querySelector(`[aria-label="ノード ${el.dataset.node}"]`),viewport=document.querySelector('.graph-viewport,.hierarchy-viewport');if(!node||!viewport)continue;
    const r=node.getBoundingClientRect(),v=viewport.getBoundingClientRect();
    const visible=r.bottom>Math.max(0,v.top)&&r.top<Math.min(innerHeight,v.bottom)&&r.right>v.left&&r.left<v.right;
    if(!visible){if(el.matches(':popover-open'))el.hidePopover();continue;}
    if(!el.matches(':popover-open'))el.showPopover();
    const x=r.right+8+el.offsetWidth<innerWidth?r.right+8:r.left-el.offsetWidth-8;
    el.style.left=`${Math.max(8,Math.min(x,innerWidth-el.offsetWidth-8))}px`;
    el.style.top=`${Math.max(8,Math.min(r.top,innerHeight-el.offsetHeight-8))}px`;
   }
  };
  position();const resize=new ResizeObserver(position);for(const node of document.querySelectorAll('.network,.graph-viewport,.hierarchy-plane,.hierarchy-viewport'))resize.observe(node);document.addEventListener('scroll',position,true);window.addEventListener('resize',position);
  return()=>{resize.disconnect();document.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);};
 },[alerts]);
 return <div ref={root}>{Object.entries(alerts).map(([id,issues])=><div key={id} popover="manual" className="output-alert" data-node={id} role="alert" aria-label={`${id} の出力異常`}><b>{id} · Fault</b>{issues.slice(0,1).map(i=><p key={i.rule}>Expected: {i.expected}<br/>Actual: {Number(i.actual.toFixed(4))}</p>)}{issues.length>1&&<small>ほか{issues.length-1}条件が未達</small>}</div>)}</div>;
}
