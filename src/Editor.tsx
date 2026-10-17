import {useEffect,useState} from 'react';
import type {Scenario,World,Edit,Intervention} from './engine';
export function Field({item,value,onEdit,actionLabel='変更を適用'}:{item:Intervention;value:number;onEdit:(id:string,value:number)=>void;actionLabel?:string}){
 const [draft,setDraft]=useState(String(value)),[error,setError]=useState('');
 useEffect(()=>{setDraft(String(value));setError('');},[value,item.id]);
 function apply(){const parsed=Number(draft);if(!draft.trim()||!Number.isFinite(parsed)||parsed<item.min||parsed>item.max||(item.step&&Math.abs((parsed-item.min)/item.step-Math.round((parsed-item.min)/item.step))>1e-6)){setError(`範囲 ${item.min}〜${item.max}、刻み ${item.step??1} で入力してください。`);return;}setError('');onEdit(item.id,parsed);}
 return <div className="edit-field"><label htmlFor={item.id}>{item.parameter}<span>現在 {value}</span></label><div><input id={item.id} aria-label={`${item.target} ${item.parameter}`} type="number" min={item.min} max={item.max} step={item.step??1} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')apply();}}/><button onClick={apply} disabled={draft===String(value)}>{actionLabel}</button></div><small>{item.description}（{item.min}〜{item.max}）</small>{error&&<p role="alert">{error}</p>}</div>;
}
export function Editor({s,w,selected,purpose,setPurpose,onEdit}:{s:Scenario;w:World;selected:string;purpose:Edit['purpose'];setPurpose:(value:Edit['purpose'])=>void;onEdit:(id:string,value:number)=>void}){
 if(s.nodes.find(n=>n.id===selected)?.externalInput)return <section className="panel editor"><div className="panel-title"><h2>外乱INPUT / {selected}</h2><span>編集不可</span></div><p className="muted">シナリオが生成する外部入力です。値・発火間隔・シード・状態は変更できません。</p></section>;
 const items=s.interventions.filter(i=>i.target===selected);
 return <section className="panel editor"><div className="panel-title"><h2>調査・修復用の直接編集 / {selected}</h2><span>EDIT</span></div><div className="edit-purpose"><label>履歴に残す目的<select value={purpose} onChange={e=>setPurpose(e.target.value as Edit['purpose'])}><option value="experiment">診断実験</option><option value="repair">設定の修正</option></select></label><p>この欄は内部設定の調査・修復用です。通常の入力操作はグラフ上のinputノードで行います。変更は適用時に反映されます。公開した期待動作を満たすすべての修正を受け入れます。時間を進めると出力条件と検証ケースで自動判定します。目的の選択は採点に影響しません。</p></div>{items.map(i=><Field key={i.id} item={{...i,parameter:i.storage==='state'?`state.${i.parameter}`:i.parameter}} value={(i.storage==='state'?w.states:w.parameters)[i.target][i.parameter]} onEdit={onEdit}/>)}{!items.length&&<p className="muted">この対象には編集できるパラメータがありません。</p>}</section>;
}
