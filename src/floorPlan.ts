import type {Scenario} from './engine';

/**
 * Ship floor plan: where equipment sits, not how information flows. Positions are percentages of
 * the plan. Wiring is not drawn; each device's panel lists what it receives and what it sends.
 */
export type Compartment={id:string;label:string;x:number;y:number;w:number;h:number;outside?:boolean};
/** `properties` names the device's settings and internal states for the panel. */
export type Device={nodeId:string;label?:string;compartment:string;x:number;y:number;icon:string;manual:string[];properties?:Record<string,string>};
export type FloorPlan={compartments:Compartment[];devices:Device[]};

export function validateFloorPlan(s:Scenario){
 const f=s.floor;if(!f)return;
 const ids=f.compartments.map(c=>c.id);
 if(new Set(ids).size!==ids.length)throw Error('不正な配置図');
 const placed=new Set<string>();
 for(const d of f.devices){
  const n=s.nodes.find(n=>n.id===d.nodeId);
  if(!n||n.kind==='output'||placed.has(d.nodeId)||!ids.includes(d.compartment)||!d.manual.length)throw Error(`不正な設備配置：${d.nodeId}`);
  if(d.properties&&Object.keys(d.properties).some(k=>!(k in n.parameters)&&!(k in n.initialState)))throw Error(`不正なプロパティ名：${d.nodeId}`);
  placed.add(d.nodeId);
 }
 // Every piece of equipment that computes something must be somewhere on the ship.
 for(const n of s.nodes)if(n.kind==='inner'&&!placed.has(n.id))throw Error(`配置されていない設備：${n.id}`);
}
/** Connections attached to a device: what it receives and what it sends. */
export const deviceConnections=(s:Scenario,nodeId:string)=>({inputs:s.connections.filter(e=>e.to===nodeId),outputs:s.connections.filter(e=>e.from===nodeId)});
/** Key of a connection's latest delivered value in a timeline sample. */
export const channelKey=(connectionId:string)=>`c:${connectionId}`;
