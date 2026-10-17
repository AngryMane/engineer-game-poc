import {useLayoutEffect,useRef,type ReactNode} from 'react';
export function DetailsPopup({open,onClose,title,children,selected}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;selected:string}){
 const panel=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const element=panel.current!;
  if(!open){if(element.matches(':popover-open'))element.hidePopover();return;}
  if(!element.matches(':popover-open'))element.showPopover();
  function position(){
   const anchor=Array.from(document.querySelectorAll('.graph-node,.edge,.module-card,.node-card,.boundary-node,.hierarchy-lines [role=button]')).find(el=>el.getAttribute('data-boundary')===selected||el.getAttribute('data-module')===selected||el.getAttribute('data-node')===selected||el.getAttribute('data-target')===selected||el.getAttribute('aria-label')===`ノード ${selected}`||el.getAttribute('aria-label')?.startsWith(`${selected} `))??document.querySelector('.graph-navigation select');
   if(!anchor)return;
   const r=anchor.getBoundingClientRect(),gap=12,margin=12,w=element.offsetWidth,h=element.offsetHeight;
   const left=r.right+gap+w<=window.innerWidth-margin?r.right+gap:r.left-gap-w>=margin?r.left-gap-w:Math.max(margin,Math.min(r.left,window.innerWidth-w-margin));
   element.style.left=`${left}px`;
   element.style.top=`${Math.max(margin,Math.min(r.top,window.innerHeight-h-margin))}px`;
  }
  function outside(e:PointerEvent){const target=e.target as Element;if(element.contains(target)||target.closest('.graph-node,.edge,.module-card,.node-card,.boundary-node,.hierarchy-lines [role=button],.graph-navigation select'))return;onClose();}
  function escape(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();onClose();}}
  position();const resize=new ResizeObserver(position);resize.observe(element);
  window.addEventListener('resize',position);document.addEventListener('scroll',position,true);document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{resize.disconnect();window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open,selected,onClose]);
 return <div ref={panel} popover="manual" className="details-popup" role="dialog" aria-label={title}><div className="popup-heading"><h2>{title}</h2><button onClick={onClose} aria-label="詳細を閉じる">Close ×</button></div>{children}</div>;
}
