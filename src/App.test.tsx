import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {App} from './App';
import {scenarios} from './scenarios';
import {Graph} from './Graph';
import {Editor} from './Editor';
import {NodeDetails} from './NodeDetails';
import {createWorld,intervene} from './engine';

describe('initial investigation UI',()=>{
 it('offers connection existence only, without transformation or delay fields',()=>{
  const s=scenarios[2];const html=renderToStaticMarkup(<Editor s={s} w={createWorld(s)} selected="E04" purpose="experiment" setPurpose={()=>{}} onEdit={()=>{}}/>);
  expect(html).toContain('E04 enabled');
  expect(html).not.toContain('E04 gain');
  expect(html).not.toContain('delaySteps');
 });
 it('omits disabled source references from the current processing formula',()=>{
  const s=scenarios[1],w=intervene(s,createWorld(s),'E07.enabled',0);
  const html=renderToStaticMarkup(<NodeDetails s={s} w={w} selected="N02" onRequest={()=>{}}/>);
  expect(html).toContain('N01 − N12');
  expect(html).not.toContain('N06 + N12');
 });
 it.each(scenarios.map(s=>s.id))('%s renders briefing, direct editing and no answer form',id=>{
  const html=renderToStaticMarkup(<App initialScenario={id}/>);
  expect(html).toContain('期待する動作（正常時）');
  expect(html).toContain('出力ごとの動作条件');for(const row of scenarios.find(s=>s.id===id)!.outputRequirements){expect(html).toContain(row.role);expect(html).toContain(row.expected.replaceAll('>', '&gt;').replaceAll('<', '&lt;'));}
  expect(html).toContain('現在の出力');expect(html).not.toContain('再現時の状態');expect(html).toContain('<details class="output-requirements"');expect(html).not.toContain('<details class="output-requirements" open');expect(html).toContain('出力異常ログ');
  expect(html).toContain('直接編集');
  expect(html).toContain('編集履歴');
  expect(html).not.toContain('計測開始');expect(html).not.toContain('IN ?');expect(html).not.toContain('OUT ?');
  for(const forbidden of ['原因を提出','仮説を提出','原因の対象','メカニズム','故障モード','VERIFIED','REVEALED','根本原因 /'])expect(html).not.toContain(forbidden);
  expect(html).not.toContain(scenarios.find(s=>s.id===id)!.solution.explanation);
 });
 it('distinguishes retained state from properties and output in an accumulating node',()=>{
  const s=scenarios.find(s=>s.id==='delayed')!;
  const html=renderToStaticMarkup(<NodeDetails s={s} w={createWorld(s)} selected="N06" onRequest={()=>{}}/>);
  expect(html).toContain('sumValue = (N06.state.value + (N05 + N12))');
  expect(html).toContain('N06.state.value = (N06.gain × selectedValue)');
  expect(html).toContain('N06.output = N06.state.value');
  expect(html).not.toContain('N06.value');
 });
 it('renders remaining node selectors with automatic measurements and all causal connections',()=>{
  const html=renderToStaticMarkup(<App initialScenario="periodic"/>);
  expect((html.match(/aria-label="ノード N\d+"/g)??[])).toHaveLength(18);
  expect(html).toContain('グラフ拡大率');
  expect(html).toContain('aria-label="E07 N06 から N02"');expect(html).toContain('aria-label="E11 N12 から N02"');expect(html).not.toContain('N07 から N02');
  expect(html).not.toContain('IN ?');expect(html).not.toContain('OUT ?');expect(html).not.toContain('計測開始');expect(html).toContain('常時計測');
 });
});

describe('system input/output interface',()=>{
 it.each(scenarios.map(s=>s.id))('%s provides input properties on the graph and live output values',id=>{
  const html=renderToStaticMarkup(<App initialScenario={id}/>),s=scenarios.find(s=>s.id===id)!;
  expect(html).not.toContain('システムの入口と出口');expect(html).toContain('<foreignObject');expect(html).toContain('入力を反映');
  for(const input of s.inputs)expect(html).toContain(`aria-label="${input.nodeId} ${input.label}"`);
  for(const n of s.nodes){expect(html).toContain(`data-kind="${n.kind}"`);if(n.kind==='output')expect(html).toContain(`aria-label="${n.id} の出力"`);}
  expect(html).toContain('class="value-port input-port"');expect(html).toContain('class="value-port output-port"');
 });
 it('shows delayed input as idle and states concrete start-relative output behavior',()=>{const html=renderToStaticMarkup(<App initialScenario="delayed"/>);expect(html).toContain('N01.enabled');expect(html).toContain('enabled');expect(html).toContain('11ステップ後');expect(html).not.toContain('33ステップ後');});
});

describe('trigger and processing transparency',()=>{
 it('shows the selected node trigger and processing rule',()=>{const s=scenarios[0],html=renderToStaticMarkup(<App initialScenario="tutorial"/>);expect(html).toContain('処理仕様 /');expect(html).toContain('manual trigger');expect(html).toContain('N01.level');expect(s.nodes[1].trigger.type).toBe('input');});
 it('provides an independently editable timer period on timer input',()=>{const html=renderToStaticMarkup(<App initialScenario="periodic"/>);expect(html).toContain('timer trigger');expect(html).toContain('N01.interval');expect(html).toContain('interval');});
});

describe('live graph outputs',()=>{
 it('displays current output even when measurements are stale or absent',()=>{
  const s=scenarios[0],world=createWorld(s);world.frames.N03.output=12.5;
  for(const values of [{},{N03:4}] as Record<string,number>[]){
   const html=renderToStaticMarkup(<Graph scenario={s} world={world} selected="N01" onSelect={()=>{}} onInput={()=>{}} values={values}/>);
   expect(html).toMatch(/aria-label="N03 の出力"[^>]*>12.5/);
  }
 });
});

describe('connection endpoint values',()=>{
 it('distinguishes measured incoming signal from node output',()=>{
  const s=scenarios[0],world=createWorld(s);
  const html=renderToStaticMarkup(<Graph scenario={s} world={world} selected="N02" onSelect={()=>{}} onInput={()=>{}} values={{E01:8,N02:4}}/>);
  expect(html).toMatch(/aria-label="E01 N02 の入力 [^"]+"[^>]*>8/);
  expect(html).toMatch(/aria-label="N02 の出力"[^>]*>4/);
  expect(html).not.toContain('class="node-value"');
 });
});

describe('node references in formulas',()=>{
 it('resolves input slots to their senders and shows the summed shared input',()=>{
  const s=scenarios[1],html=renderToStaticMarkup(<NodeDetails s={s} w={createWorld(s)} selected="N02" onRequest={()=>{}}/>);
  expect(html).toContain('N01 − (N06 + N12)');
  expect(html).toContain('N02.gain');
  expect(html).not.toContain('input.supply');expect(html).not.toContain('input.load');
 });
});

describe('external input UI',()=>{
 it('shows a read-only disturbance card and no editable field',()=>{
  const s=scenarios[1],html=renderToStaticMarkup(<App initialScenario="periodic"/>);
  expect(html).toContain('外乱 · 編集不可');expect(html).toContain('3〜7 ステップ間隔');
  expect(html).not.toContain('id="N15.interval"');
  const detail=renderToStaticMarkup(<NodeDetails s={s} w={createWorld(s)} selected="N15" onRequest={()=>{}}/>);
  expect(detail).toContain('uniform(0, 0.4)');expect(detail).toContain('外乱INPUT · 編集不可');expect(detail).not.toContain('property.undefined');
 });
});

describe('automatic anomaly presentation',()=>{
 it('provides one independent output popover per active anomaly and removes recovered ones',()=>{
  const s=scenarios[2],w=createWorld(s);w.monitor.alerts.N04=[{nodeId:'N04',rule:0,expected:'4',actual:10}];
  const props={scenario:s,world:w,selected:'N01',onSelect:()=>{},onInput:()=>{},values:{}};
  const active=renderToStaticMarkup(<Graph {...props}/>);expect(active).toContain('popover="manual"');expect(active).toContain('N04 の出力異常');expect(active).toContain('期待：4');expect(active).toContain('実際：10');
  w.monitor.alerts={};const recovered=renderToStaticMarkup(<Graph {...props}/>);expect(recovered).not.toContain('N04 の出力異常');
 });
});
