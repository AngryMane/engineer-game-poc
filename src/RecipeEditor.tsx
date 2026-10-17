import {useEffect,useState} from 'react';
import type {Scenario} from './engine';
import type {Recipe,ReplayAction} from './experimentReplay';
import {publicText} from './hierarchy';
/** A copy always keeps the recorded start; edits affect only its ordered actions. */
export function RecipeEditor({s,recipe,onRun}:{s:Scenario;recipe:Recipe;onRun:(recipe:Recipe)=>void}){
 const [actions,setActions]=useState(()=>structuredClone(recipe.actions)),[until,setUntil]=useState(recipe.until);
 useEffect(()=>{setActions(structuredClone(recipe.actions));setUntil(recipe.until);},[recipe]);
 function change(index:number,patch:Partial<ReplayAction>){setActions(old=>old.map((a,i)=>i===index?{...a,...patch} as ReplayAction:a));}
 return <details><summary>Copy / edit recipe</summary><p>Same initial state. Change one time or value.</p><table><thead><tr><th>Time</th><th>Action</th><th>Value</th></tr></thead><tbody>{actions.map((a,i)=><tr key={i}><td><input aria-label={`Action ${i+1} time`} type="number" min={recipe.initial.time} step={1} value={a.time} onChange={e=>change(i,{time:Number(e.target.value)})}/></td><td>{a.kind} / {publicText(s,a.id)}</td><td>{a.kind!=='request'&&<input aria-label={`Action ${i+1} value`} type="number" step={s.inputs.find(v=>v.id===a.id)?.step??s.interventions.find(v=>v.id===a.id)?.step??1} value={a.value} onChange={e=>change(i,{value:Number(e.target.value)})}/>}</td></tr>)}</tbody></table><label>End tick<input aria-label="Recipe end tick" type="number" min={recipe.initial.time} step={1} value={until} onChange={e=>setUntil(Number(e.target.value))}/></label><button onClick={()=>onRun({initial:structuredClone(recipe.initial),actions:structuredClone(actions).sort((a,b)=>a.time-b.time),until})}>Run copy</button></details>;
}
