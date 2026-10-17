import type {Scenario} from './engine';
import {moduleById,scopeItems} from './hierarchy';
export type NodeOffset={x:number;y:number};
export type GraphLayout=Record<string,Record<string,NodeOffset>>;
export const layoutScope=(scope:string|null)=>scope??'@system';
export function readGraphLayout(s:Scenario,value:unknown):GraphLayout {
 if(value===undefined)return {};
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid layout');
 for(const [key,offsets] of Object.entries(value)){
  const scope=key==='@system'?null:key;
  if(scope&&!s.hierarchy?.modules.some(m=>m.id===scope))throw Error('Invalid layout scope');
  const items=scopeItems(s,scope),allowed=[...items.nodes,...items.modules,...(scope?moduleById(s,scope).ports.map(p=>`boundary-${p.direction}:${p.id}`):[])];
  if(!offsets||typeof offsets!=='object'||Array.isArray(offsets))throw Error('Invalid offsets');
  for(const [id,point]of Object.entries(offsets))if(!allowed.includes(id)||!point||typeof point!=='object'||!['x','y'].every(key=>typeof (point as Record<string,unknown>)[key]==='number'&&Number.isFinite((point as Record<string,number>)[key])&&Math.abs((point as Record<string,number>)[key])<=100000))throw Error('Invalid node position');
 }
 return value as GraphLayout;
}
