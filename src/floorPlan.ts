import type {Scenario} from './engine';

/**
 * Ship floor plan: where equipment sits, not how information flows. Positions are percentages of
 * the plan. Wiring is not drawn; each device's panel lists what it receives and what it sends.
 */
/**
 * `access`: crew rooms are where crew members of `role` work; maintenance areas hold inner devices.
 * The mechanic (the player) may enter every room except outside.
 */
export type Compartment={id:string;label:string;access:'crew'|'maintenance'|'outside';role?:string;x:number;y:number;w:number;h:number;outside?:boolean};
/** `properties` names the device's settings and internal states for the panel. */
export type Device={nodeId:string;label?:string;compartment:string;x:number;y:number;icon:string;manual:string[];properties?:Record<string,string>};
/** `displays` puts every output node on a screen in one crew room; it can only be read there. */
/** `alarm`: one output heard in every room (the ship-wide fire alarm). */
/** What the crew in a room says while an output they can see is at or above a value. */
export type CrewVoice={room:string;nodeId:string;atLeast:number;text:string};
export type FloorPlan={start:string;compartments:Compartment[];devices:Device[];displays:Record<string,string>;alarm?:string;voices?:CrewVoice[]};

export function validateFloorPlan(s:Scenario){
 const f=s.floor;if(!f)return;
 const ids=f.compartments.map(c=>c.id);
 if(new Set(ids).size!==ids.length||!f.compartments.some(c=>c.id===f.start&&c.access!=='outside'))throw Error('不正な配置図');
 for(const c of f.compartments)if(c.access==='crew'!==!!c.role)throw Error(`不正な区画：${c.id}`);
 if(f.alarm&&(s.nodes.find(n=>n.id===f.alarm)?.kind!=='output'||f.alarm in f.displays))throw Error('不正な警報');
 for(const n of s.nodes.filter(n=>n.kind==='output'&&n.id!==f.alarm)){const room=f.compartments.find(c=>c.id===f.displays[n.id]);if(!room||room.access!=='crew')throw Error(`表示する部屋がない出力：${n.id}`);}
 if(Object.keys(f.displays).some(id=>s.nodes.find(n=>n.id===id)?.kind!=='output'))throw Error('不正な表示');
 for(const v of f.voices??[])if(!f.compartments.some(c=>c.id===v.room&&c.access==='crew')||!(v.nodeId===f.alarm||f.displays[v.nodeId]===v.room))throw Error(`不正なクルーの声：${v.text}`);
 const placed=new Set<string>();
 for(const d of f.devices){
  const n=s.nodes.find(n=>n.id===d.nodeId);
  const room=f.compartments.find(c=>c.id===d.compartment);
  if(!n||n.kind==='output'||placed.has(d.nodeId)||!room||!d.manual.length)throw Error(`不正な設備配置：${d.nodeId}`);
  // Crew operate consoles in their own rooms; inner devices sit in maintenance areas (or outside).
  if(n.kind==='inner'&&room.access==='crew'||n.kind==='input'&&!n.externalInput&&room.access!=='crew')throw Error(`設備の区画が不正：${d.nodeId}`);
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
/** Outputs whose screen is in this room. */
export const displaysIn=(s:Scenario,room:string)=>s.nodes.filter(n=>n.kind==='output'&&(s.floor!.displays[n.id]===room||n.id===s.floor!.alarm)).map(n=>n.id);
export const roomOf=(s:Scenario,nodeId:string)=>s.floor!.devices.find(d=>d.nodeId===nodeId)?.compartment??s.floor!.displays[nodeId];
/** The mechanic may enter every room except outside. */
export const canEnter=(s:Scenario,room:string)=>s.floor!.compartments.some(c=>c.id===room&&c.access!=='outside');
export const voicesIn=(s:Scenario,w:{states:Record<string,Record<string,number>>},room:string)=>(s.floor!.voices??[]).filter(v=>v.room===room&&w.states[v.nodeId].value>=v.atLeast).map(v=>v.text);
