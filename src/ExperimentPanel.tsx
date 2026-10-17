import {useEffect,useState} from 'react';
import type {Scenario} from './engine';
import {normalizeOperations,operationLabel,type Experiment,type Operation,type Recording} from './experiment';

type Text=(value:string)=>string;
const firstOnset=(ex:Experiment)=>ex.outcome.outputs.flatMap(o=>o.onsets.map(t=>({t,id:o.nodeId}))).sort((a,b)=>a.t-b.t)[0];

/** Editable copy of a sequence. Running it creates a new variant; the original is never changed. */
export function SequenceEditor({s,text,experiment,onRun}:{s:Scenario;text:Text;experiment:Experiment;onRun:(operations:Operation[],until:number,name:string)=>string|undefined}){
 const [ops,setOps]=useState(()=>structuredClone(experiment.operations)),[until,setUntil]=useState(experiment.until),[name,setName]=useState(''),[error,setError]=useState(''),[added,setAdded]=useState(s.inputs[0]?.id??'');
 useEffect(()=>{setOps(structuredClone(experiment.operations));setUntil(experiment.until);setError('');},[experiment]);
 const start=experiment.setup.initial.time;
 const change=(index:number,patch:Partial<Operation>)=>setOps(old=>old.map((op,i)=>i===index?{...op,...patch} as Operation:op));
 const move=(index:number,delta:number)=>setOps(old=>{const next=[...old],j=index+delta;if(j<0||j>=next.length)return old;[next[index],next[j]]=[next[j],next[index]];return next;});
 function add(){const input=s.inputs.find(i=>i.id===added);if(!input)return;setOps(old=>[...old,{atTick:old.at(-1)?.atTick??start,kind:'setInput',target:input.id,value:input.defaultValue}]);}
 function run(){const message=onRun(normalizeOperations(ops),until,name.trim());setError(message??'');if(!message)setName('');}
 return <details className="sequence-editor"><summary>操作シーケンスを編集して変種を作る</summary>
  <p className="muted">同じ初期状態（t={start}）から実行します。操作は表示中の時刻 t に適用され、そのあと t+1 へ進みます。同じ t の操作は上から順に適用します。</p>
  <table><thead><tr><th>#</th><th>t</th><th>操作</th><th>値</th><th></th></tr></thead><tbody>{ops.map((op,i)=><tr key={i}>
   <td>{i+1}</td>
   <td><input aria-label={`操作${i+1}の時刻`} type="number" min={start} step={1} value={op.atTick} onChange={e=>change(i,{atTick:Number(e.target.value)})}/></td>
   <td>{op.kind==='setInput'?'入力':op.kind==='intervene'?'編集':'問い合わせ'} / {text(op.target)}{op.kind==='intervene'&&<select aria-label={`操作${i+1}の目的`} value={op.purpose} onChange={e=>change(i,{purpose:e.target.value as 'experiment'|'repair'})}><option value="experiment">実験</option><option value="repair">修復</option></select>}</td>
   <td>{op.kind!=='request'&&<input aria-label={`操作${i+1}の値`} type="number" step={s.inputs.find(v=>v.id===op.target)?.step??s.interventions.find(v=>v.id===op.target)?.step??1} value={op.value} onChange={e=>change(i,{value:Number(e.target.value)})}/>}</td>
   <td className="row-actions"><button aria-label={`操作${i+1}を上へ`} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button aria-label={`操作${i+1}を下へ`} disabled={i===ops.length-1} onClick={()=>move(i,1)}>↓</button><button aria-label={`操作${i+1}を削除`} onClick={()=>setOps(old=>old.filter((_,j)=>j!==i))}>✕</button></td>
  </tr>)}</tbody></table>
  {!ops.length&&<p className="muted">操作なし（入力を変えずに進めます）。</p>}
  <div className="sequence-add"><label>入力を追加<select aria-label="追加する入力" value={added} onChange={e=>setAdded(e.target.value)}>{s.inputs.map(i=><option key={i.id} value={i.id}>{text(i.id)}</option>)}</select></label><button onClick={add}>追加</button></div>
  <div className="sequence-add"><label>終了 t<input aria-label="終了時刻" type="number" min={start} step={1} value={until} onChange={e=>setUntil(Number(e.target.value))}/></label><label>変種の名前<input aria-label="変種の名前" value={name} placeholder={`${experiment.name} / 変種`} onChange={e=>setName(e.target.value)}/></label><button className="primary" onClick={run}>変種として実行</button></div>
  {error&&<p role="alert" className="sequence-error">{error}</p>}
 </details>;
}

export function ExperimentPanel({s,text,recording,currentTime,experiments,comparison,playingId,onSave,onStartRecording,onPlay,onCompare,onUpdate,onVariant}:{s:Scenario;text:Text;recording:Recording;currentTime:number;experiments:Experiment[];comparison:string;playingId?:string;onSave:(name:string,prediction:string)=>void;onStartRecording:()=>void;onPlay:(ex:Experiment)=>void;onCompare:(id:string)=>void;onUpdate:(id:string,patch:Partial<Pick<Experiment,'name'|'prediction'|'memo'>>)=>void;onVariant:(parent:Experiment,operations:Operation[],until:number,name:string)=>string|undefined}){
 const [name,setName]=useState(''),[prediction,setPrediction]=useState('');
 const nameOf=(id?:string)=>experiments.find(e=>e.id===id)?.name;
 return <div className="tab-content experiments">
  <section className="recording-box" aria-label="現在の記録">
   <h3>現在の記録</h3>
   <p>t={recording.start.time} から t={currentTime} まで · 操作 {recording.operations.length} 件</p>
   {recording.operations.length>0&&<ol className="op-list">{recording.operations.map((op,i)=><li key={i}>{operationLabel(op,text)}</li>)}</ol>}
   <div className="sequence-add"><label>実験名<input aria-label="実験名" value={name} placeholder={`実験 ${experiments.length+1}`} onChange={e=>setName(e.target.value)}/></label><label>事前予測<input aria-label="事前予測" value={prediction} placeholder="何が・いつ起きると思うか" onChange={e=>setPrediction(e.target.value)}/></label></div>
   <div className="sequence-add"><button className="primary" onClick={()=>{onSave(name.trim(),prediction.trim());setName('');setPrediction('');}}>実験として保存</button><button onClick={onStartRecording}>ここから記録し直す</button></div>
   <p className="muted">Reset・Restart・記録し直しの時点が実験の初期状態になります。保存した実験は、その初期状態から同じ操作をtick単位で再実行します。</p>
  </section>
  {experiments.length>0&&<section aria-label="実験の比較"><h3>比較</h3><div className="requirements-scroll"><table className="comparison-table"><thead><tr><th>実験</th><th>範囲</th><th>操作</th><th>最初の異常</th><th>回復</th><th>終了時に未達の出力</th><th>結果</th></tr></thead><tbody>{experiments.map(ex=>{const first=firstOnset(ex),failing=ex.outcome.outputs.filter(o=>o.failingAtEnd),recoveries=ex.outcome.outputs.flatMap(o=>o.recoveries.map(t=>`${text(o.nodeId)} t=${t}`));return <tr key={ex.id} className={ex.id===comparison?'compared':''}>
   <th scope="row">{ex.name}</th><td>t={ex.setup.initial.time}–{ex.until}</td><td>{ex.operations.map(op=>operationLabel(op,text)).join(' ／ ')||'なし'}</td><td>{first?`t=${first.t} ${text(first.id)}`:'なし'}</td><td>{recoveries.join(' ／ ')||'—'}</td><td>{failing.map(o=>text(o.nodeId)).join('、')||'なし'}</td><td>{ex.outcome.status==='completed'?'完了':`失敗：${ex.outcome.error}`}</td>
  </tr>;})}</tbody></table></div></section>}
  {experiments.map(ex=><article className="experiment" key={ex.id} aria-label={`実験 ${ex.name}`}>
   <div className="experiment-head"><input aria-label="実験名を変更" value={ex.name} onChange={e=>onUpdate(ex.id,{name:e.target.value})}/><small>{ex.origin==='variant'?`「${nameOf(ex.parentId)??'削除済み'}」の変種`:ex.origin==='migrated'?'旧保存から移行':'記録から作成'} · シナリオ {ex.setup.scenarioId} · 外乱シード {Object.values(ex.setup.seeds).join(', ')||'なし'}</small></div>
   <p>t={ex.setup.initial.time}–{ex.until} · 操作 {ex.operations.length} 件 · 最初の異常：{(f=>f?`t=${f.t} ${text(f.id)}`:'なし')(firstOnset(ex))} · {ex.outcome.status==='completed'?'完了':`失敗：${ex.outcome.error}`}</p>
   <div className="experiment-notes"><label>事前予測<textarea value={ex.prediction} onChange={e=>onUpdate(ex.id,{prediction:e.target.value})}/></label><label>結果メモ<textarea value={ex.memo} placeholder="観測した結果と考えたこと" onChange={e=>onUpdate(ex.id,{memo:e.target.value})}/></label></div>
   <div className="sequence-add"><button onClick={()=>onPlay(ex)} disabled={playingId===ex.id}>{playingId===ex.id?'再生中':'再生'}</button><button onClick={()=>onCompare(ex.id===comparison?'':ex.id)}>{ex.id===comparison?'比較をやめる':'時系列で比較'}</button></div>
   <SequenceEditor s={s} text={text} experiment={ex} onRun={(ops,until,variantName)=>onVariant(ex,ops,until,variantName)}/>
  </article>)}
  {!experiments.length&&<p className="muted">保存した実験はまだありません。</p>}
 </div>;
}
