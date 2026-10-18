import {useEffect,useState} from 'react';
import type {Scenario,World,Edit,Intervention} from './engine';
export function Field({item,value,onEdit,actionLabel='Apply'}:{item:Intervention;value:number;onEdit:(id:string,value:number)=>void;actionLabel?:string}){
 const [draft,setDraft]=useState(String(value)),[error,setError]=useState('');
 useEffect(()=>{setDraft(String(value));setError('');},[value,item.id]);
 function apply(){const parsed=Number(draft);if(!draft.trim()||!Number.isFinite(parsed)||parsed<item.min||parsed>item.max||(item.step&&Math.abs((parsed-item.min)/item.step-Math.round((parsed-item.min)/item.step))>1e-6)){setError(`範囲 ${item.min}〜${item.max}、刻み ${item.step??1} で入力してください。`);return;}setError('');onEdit(item.id,parsed);}
 return <div className="edit-field"><label htmlFor={item.id}>{item.parameter}<span> {value}</span></label><div><input id={item.id} aria-label={`${item.target} ${item.parameter}`} title={item.description} type="number" min={item.min} max={item.max} step={item.step??1} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')apply();}}/><button onClick={apply} disabled={draft===String(value)}>{actionLabel}</button></div><small>{item.min}–{item.max} · step {item.step??1}</small>{error&&<p role="alert">{error}</p>}</div>;
}
export function Editor({s,w,selected,purpose,setPurpose,onEdit}:{s:Scenario;w:World;selected:string;purpose:Edit['purpose'];setPurpose:(value:Edit['purpose'])=>void;onEdit:(id:string,value:number)=>void}){
 if(s.nodes.find(n=>n.id===selected)?.externalInput)return <section className="panel editor"><div className="panel-title"><h2>外乱INPUT / {selected}</h2><span>編集不可</span></div><p className="muted">シナリオが生成する外部入力です。値・発火間隔・シード・状態は変更できません。</p></section>;
 const items=s.interventions.filter(i=>i.target===selected);
 return <section className="panel editor"><div className="panel-title"><h2>Edit / {selected}</h2><span>EDIT</span></div><div className="edit-purpose"><label>Purpose<select value={purpose} onChange={e=>setPurpose(e.target.value as Edit['purpose'])}><option value="experiment">Experiment</option><option value="repair">Repair</option></select></label></div>{items.map(i=><Field key={i.id} item={{...i,parameter:s.signals?i.label:i.storage==='state'?`state.${i.parameter}`:i.parameter}} value={(i.storage==='state'?w.states:w.parameters)[i.target][i.parameter]} onEdit={onEdit}/>)}{!items.length&&<p className="muted">Read-only.</p>}{s.signals&&items.length>0&&<p className="muted">Purposeで「Repair」を選ぶと修理として記録されます。修理後の設定は公開検証ケースにも使われます。</p>}</section>;
}
