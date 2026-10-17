import type {Scenario,Fault} from '../engine';
import type {FaultReport} from '../faultReports';
import {sharedSystem} from './system';

/** A fault case on the shared system. Each case starts from the healthy system plus its own fault. */
export type FaultCase={id:string;title:string;symptom:string;firstAction:string;fault?:Omit<Fault,'id'|'key'|'mode'|'startStep'>&{severity:number};reports:FaultReport[];hints:string[];solution:Scenario['solution']};

const sup='N01.level',req='N02.level',en='N03.enabled',cap='N04.enabled',use='N05.enabled';
const at=(time:number,id:string,value:number)=>({time,id,value});

export const faultCases:FaultCase[]=[
 {id:'case-00',title:'00 / 練習：変化が出力に届くまで',
  symptom:'故障はありません。供給量を変えたとき、どの出力がいつ変わるかを確かめる練習です。',
  firstAction:'N01.levelを12に変更して反映し、+1ずつ進めてN29とN21が変わる時刻を比べてください。',
  reports:[{id:'R00-1',title:'動作確認の依頼',from:'運用担当',summary:'供給量を8から12に上げた記録です。確認出力はすぐ変わりましたが、変換値はもう少し後で変わりました。異常ではないか確認してください。',
   runs:[{label:'A',inputs:[at(0,sup,12)]}],
   entries:[{run:'A',time:1,ids:[sup,'N29','N21'],note:'変更を反映した直後。'},{run:'A',time:2,ids:[sup,'N29','N21'],note:'N29だけが新しい値になった。'},{run:'A',time:4,ids:[sup,'N29','N21'],note:'N21も新しい値になった。'}]}],
  hints:['System の仕様表で、N29とN21が何ステップ前の入力を使うか確認しましょう。','N21は外部値N06の影響も受けます。N30の値と合わせて比べましょう。','モジュールを開くと、取り込み・換算の各段階で値が変わる時刻を確認できます。'],
  solution:{rootCauseIds:[],stableSteps:16,causalPath:['N01.level','Intake','Conversion','N21'],explanation:'故障はありません。N29は入力を直接受け取るため2ステップ後に、N21は取り込みと換算を経るため4ステップ後に変わります。',observations:'N21と仕様の差は、外部値N06を差し引いた分です。N30でその値を確認できます。',misleading:'出力が変わる時刻の違いは経路の段数によるもので、異常ではありません。'}},

 {id:'case-01',title:'01 / 周期的に下がる余力',fault:{targetId:'N09',parameter:'load',severity:8},
  symptom:'余力N22が一定の周期で大きく下がります。下がる時刻と、ほかの出力を比べてください。',
  firstAction:'入力は変えずに+36で進め、N22が下がる時刻を記録してください。',
  reports:[
   {id:'R01-1',title:'余力が周期的に0になる',from:'監視担当',summary:'何も操作していない間にも、余力がときどき0まで下がります。しばらくすると元に戻ります。',
    runs:[{label:'A',inputs:[]}],
    entries:[{run:'A',time:13,ids:['N22'],note:'通常の値。'},{run:'A',time:16,ids:['N22'],note:'余力が下がっている。'},{run:'A',time:25,ids:['N22'],note:'通常の値に戻った。'},{run:'A',time:28,ids:['N22'],note:'再び下がっている。'}]},
   {id:'R01-2',title:'準備は普段どおり',from:'準備担当',summary:'同じ時間帯に準備を動かしましたが、準備量の増え方は普段どおりでした。',
    runs:[{label:'B',inputs:[at(10,en,1)]}],
    entries:[{run:'B',time:14,ids:['N23','N22'],note:'準備量は通常どおり増えている。'},{run:'B',time:16,ids:['N23','N22'],note:'余力は0に下がったが、準備量は通常どおり増えて上限に達した。'}]},
  ],
  hints:['N22が下がる時刻の間隔と、ほかの出力が変化する間隔を比べましょう。','準備量N23に影響せず余力N22にだけ影響するものは何か、仕様で確認しましょう。','周期負荷N25の値を仕様の値と比べましょう。'],
  solution:{rootCauseIds:['N09'],stableSteps:16,causalPath:['Load','N25 / Balance','N22'],explanation:'周期負荷の大きさN09.loadが2から8に変わっていました。余力の見積もりは負荷を差し引くため、負荷が出る3ステップの間だけ余力が大きく下がります。',observations:'下がる時刻は12ステップごとで、周期負荷N25の変化と一致します。準備量は負荷を差し引かないため影響を受けません。',misleading:'N09.loadを2に戻すと全ケースを満たします。余力側だけを補正しても、周期負荷N25の出力条件は満たせません。'}},

 {id:'case-02',title:'02 / 準備完了が遅れる',fault:{targetId:'N14',parameter:'rate',severity:.25},
  symptom:'準備を始めてから準備完了N24が1になるまで、期待より長くかかります。',
  firstAction:'N03.enabledを1に変更して反映し、+12で進めてN23とN24を仕様と比べてください。',
  reports:[
   {id:'R02-1',title:'準備完了まで時間がかかる',from:'運用担当',summary:'準備を始めて10ステップほど待ちましたが、準備完了になりませんでした。もっと待つと完了しました。',
    runs:[{label:'A',inputs:[at(1,en,1)]}],
    entries:[{run:'A',time:9,ids:['N23','N24'],note:'通常なら完了している時刻。'},{run:'A',time:15,ids:['N23','N24'],note:'まだ完了していない。'},{run:'A',time:24,ids:['N23','N24'],note:'ようやく完了。'}]},
   {id:'R02-2',title:'余力の見積もりは正常',from:'監視担当',summary:'同じ時間帯の余力の見積もりは、仕様どおりの値でした。',
    runs:[{label:'A',inputs:[at(1,en,1)]}],
    entries:[{run:'A',time:9,ids:['N22','N25'],note:'余力は仕様どおり。'}]},
  ],
  hints:['準備量N23が1ステップでどれだけ増えるかを、仕様の増分と比べましょう。','余力N22が正常なら、供給と使用量の取り込みは正しい可能性があります。','準備量を蓄積するモジュールを開き、使った入力と増分を比べましょう。'],
  solution:{rootCauseIds:['N14'],stableSteps:16,causalPath:['Storage','N23','N24'],explanation:'準備量の蓄積率N14.rateが1から0.25に下がっていました。毎ステップの増分が4分の1になり、上限24に達するまで長くかかります。',observations:'準備量の増分が供給と使用量の差の0.25倍になっています。余力は同じ入力を使って正しく計算されているため、入力側ではなく蓄積側が原因と分かります。',misleading:'準備完了N24は実際の準備量に正しく従っています。完了の判定を変えても、準備量N23の出力条件は満たせません。'}},

 {id:'case-03',title:'03 / 二つの換算値がずれる',fault:{targetId:'N11',parameter:'scale',severity:3},
  symptom:'変換値N21と要求の換算値N26が、どちらも仕様より大きくなります。',
  firstAction:'N02.levelを4に変更して反映し、+12で進めてN21・N26・N29を仕様と比べてください。',
  reports:[
   {id:'R03-1',title:'変換値が大きすぎる',from:'出力担当',summary:'供給量に対して、変換値が仕様より大きく出ています。',
    runs:[{label:'A',inputs:[]}],
    entries:[{run:'A',time:10,ids:[sup,'N29','N21','N30'],note:'供給量の確認N29は正しい。'}]},
   {id:'R03-2',title:'要求の換算値が合わない',from:'需要担当',summary:'要求量を変えても、換算値が仕様の比率になりません。',
    runs:[{label:'B',inputs:[at(1,req,4)]}],
    entries:[{run:'B',time:3,ids:[req,'N26'],note:'変更前。'},{run:'B',time:8,ids:[req,'N26'],note:'変更後も比率が仕様と異なる。'}]},
  ],
  hints:['二つの報告は別の出力ですが、ずれ方に共通点がないか比べましょう。','供給量の確認N29が正しいなら、入力そのものは届いています。','N21とN26を計算するモジュールで、それぞれが問い合わせる値を確認しましょう。'],
  solution:{rootCauseIds:['N11'],stableSteps:16,causalPath:['Reference','Conversion','N21 / N26'],explanation:'共通の換算倍率N11.scaleが2から3に変わっていました。変換値と要求の換算値は同じ倍率を問い合わせるため、どちらも1.5倍になります。',observations:'N21は外部値を引く分だけ比率がずれて見えますが、N26は要求量のちょうど3倍です。余力や準備量は倍率を使わないため正常です。',misleading:'N11.scaleを2に戻すと全ケースを満たします。N16とN17のgainを下げて補う方法は、N21で外部値の差し引きまで縮めてしまうため全ケースを満たしません。'}},

 {id:'case-04',title:'04 / 大きい供給だけ合わない',fault:{targetId:'N16',parameter:'ceiling',severity:20},
  symptom:'供給量が小さいときは変換値N21が仕様どおりですが、大きくすると仕様より小さくなります。',
  firstAction:'N01.levelを4、続いて14に変更し、それぞれ+12で進めてN21を仕様と比べてください。',
  reports:[{id:'R04-1',title:'高負荷時だけ変換値が足りない',from:'出力担当',summary:'通常の供給量では問題ありませんが、供給量を上げた日だけ変換値が仕様に届きませんでした。',
   runs:[{label:'A',inputs:[at(0,sup,6)]},{label:'B',inputs:[at(0,sup,14)]}],
   entries:[{run:'A',time:10,ids:[sup,'N21','N30'],note:'仕様どおり。'},{run:'B',time:10,ids:[sup,'N21','N30'],note:'仕様より小さい。'},{run:'B',time:20,ids:[sup,'N21','N30'],note:'外部値が変わってもN21は同じ値のまま。'}]}],
  hints:['供給量をいくつか変えて、N21が仕様と合わなくなる境目を探しましょう。','N21が一定の値で止まっていないか確認しましょう。','変換を行うモジュールで、値を収める範囲を仕様と比べましょう。'],
  solution:{rootCauseIds:['N16'],stableSteps:16,causalPath:['Conversion','N21'],explanation:'変換値の上限N16.ceilingが30から20に変わっていました。供給量が10程度までは影響しませんが、それより大きいと20で頭打ちになります。',observations:'仕様の上限は30です。N21が外部値によらず20で一定なら、計算結果ではなく上限で止まっていると分かります。',misleading:'N16.ceilingを30に戻すと全ケースを満たします。上限で止まった分は倍率やgainでは補えず、小さい供給量の結果も変わってしまいます。'}},

 {id:'case-05',title:'05 / 値は合うが反映が遅い',fault:{targetId:'N07',parameter:'interval',severity:4},
  symptom:'供給量を変えると、変換値N21や余力N22が最終的には仕様の値になりますが、変わる時刻が遅れます。',
  firstAction:'N01.levelを12に変更して反映し、+1ずつ進めてN29・N21・N22が変わる時刻を記録してください。',
  reports:[
   {id:'R05-1',title:'変更の反映が遅い',from:'運用担当',summary:'供給量を変えたあと、変換値が変わるまで時間がかかりました。最後には正しい値になります。',
    runs:[{label:'A',inputs:[at(1,sup,12)]}],
    entries:[{run:'A',time:5,ids:[sup,'N29','N21'],note:'確認出力は変わったが、変換値はまだ古い。'},{run:'A',time:7,ids:[sup,'N29','N21'],note:'変換値も変わった。'}]},
   {id:'R05-2',title:'遅れ方が毎回違う',from:'監視担当',summary:'別の時刻に変更したときは、遅れがもっと長くなりました。',
    runs:[{label:'B',inputs:[at(3,sup,12)]}],
    entries:[{run:'B',time:7,ids:[sup,'N29','N22'],note:'余力はまだ古い値。'},{run:'B',time:9,ids:[sup,'N29','N22'],note:'まだ古い値。'},{run:'B',time:10,ids:[sup,'N29','N22'],note:'ようやく変わった。'}]},
  ],
  hints:['変更した時刻を変えて、遅れのステップ数がどう変わるか比べましょう。','N29は遅れず、N21とN22だけが遅れるなら、両者が共通に使う段階を探しましょう。','供給量を取り込むモジュールで、取り込みの周期を確認しましょう。'],
  solution:{rootCauseIds:['N07'],stableSteps:16,causalPath:['Intake','Conversion / Preparation','N21 / N22 / N23'],explanation:'供給量の取り込み周期N07.intervalが1から4に変わっていました。取り込みが4ステップに1回になるため、変更した時刻によって遅れが1〜3ステップ変わります。',observations:'確認出力N29は取り込みを通らないため遅れません。遅れが変更時刻によって変わることが、周期的な取り込みを示します。',misleading:'N07.intervalを1に戻すと全ケースを満たします。最終値が合うだけでは仕様を満たしません。'}},

 {id:'case-06',title:'06 / 余力と準備が同時に悪化する',fault:{targetId:'N10',parameter:'factor',severity:2},
  symptom:'余力N22が仕様より小さく、準備完了N24も遅れます。二つの症状に共通する理由を調べてください。',
  firstAction:'N02.levelを0にした場合と4にした場合で、N22とN23の増え方を比べてください。',
  reports:[
   {id:'R06-1',title:'余力が足りない',from:'監視担当',summary:'要求量が多い時間帯に、余力の見積もりが仕様より小さくなっています。',
    runs:[{label:'A',inputs:[at(1,req,4)]}],
    entries:[{run:'A',time:10,ids:[sup,req,'N22','N26'],note:'仕様より小さい。'}]},
   {id:'R06-2',title:'準備完了が遅い',from:'準備担当',summary:'準備を始めても、なかなか完了しません。要求量を下げた日は普段どおりでした。',
    runs:[{label:'B',inputs:[at(1,req,3),at(2,en,1)]},{label:'C',inputs:[at(1,req,0),at(2,en,1)]}],
    entries:[{run:'B',time:10,ids:[req,'N23','N24'],note:'通常なら完了している。'},{run:'C',time:10,ids:[req,'N23','N24'],note:'要求量0では通常どおり完了。'}]},
  ],
  hints:['要求量を0にすると二つの症状がどうなるか比べましょう。','余力の不足分と、準備量の増分の不足分を、要求量と比べましょう。','余力と準備量を計算するモジュールの中で、要求量をどの単位に換算しているか確認しましょう。'],
  solution:{rootCauseIds:['N10'],stableSteps:16,causalPath:['Reference','Accounting','Balance / Storage','N22 / N23 / N24'],explanation:'要求を使用量に換算する係数N10.factorが1から2に変わっていました。使用量が過大になり、余力が減ると同時に準備量の増分も小さくなります。',observations:'要求量0では影響が消え、要求量を増やすと余力の不足と準備の遅れがともに大きくなります。要求の換算値N26は別の倍率を使うため正常です。',misleading:'N10.factorを1に戻すと全ケースを満たします。余力側か準備側の一方だけを補正しても不合格です。'}},

 {id:'case-07',title:'07 / ときどき使用結果が0になる',fault:{targetId:'N19',parameter:'retention',severity:0},
  symptom:'設定値を受理したのに、使用結果N28が0になることがあります。正常に使えた記録もあります。',
  firstAction:'正常な記録と異常な記録で、取り込み・解除・使用の順番を比べる実験を考えてください。',
  reports:[
   {id:'R07-1',title:'受理したのに結果が0',from:'運用担当',summary:'設定値6を受理した後で使用しましたが、結果は0でした。途中で取り込みを止めたことは覚えていますが、操作の時刻は記録していません。',
    runs:[{label:'A',inputs:[at(0,req,6),at(0,cap,1),at(6,cap,0),at(10,use,1)]}],
    entries:[{run:'A',time:18,ids:['N27','N28',use],note:'受理した値は6だが、結果は0。'}],missing:'途中の操作の時刻と順番は記録されていません。'},
   {id:'R07-2',title:'別の日は正常',from:'運用担当',summary:'同じ設定値を使った別の日は、正しく6が出ました。',
    runs:[{label:'B',inputs:[at(0,req,6),at(0,cap,1),at(4,use,1),at(8,cap,0)]}],
    entries:[{run:'B',time:18,ids:['N27','N28',use],note:'正常。'}]},
  ],
  hints:['正常な記録と異常な記録で、取り込みを止めた時点で使用していたかを比べましょう。','要求量は固定し、取り込み・解除・使用の順番と間隔だけを変えて比べましょう。','使用を始める前に、受理した値と保持している値を比べましょう。','取り込み後、使用せずに解除し、少し待ってから使用してください。解除と使用を同時に変えた場合とも比べましょう。'],
  solution:{rootCauseIds:['N19'],stableSteps:16,causalPath:['Holding','Consumption','N28'],explanation:'取り込みも使用もしていない間、保持値にN19.retentionを掛けます。正常なら1ですが0に変わっていたため、待機中に保持値が消えていました。',observations:'取り込み後に使用しないまま解除すると、2ステップ後に保持値が0になります。使用中に解除した場合や、解除と同時に使用した場合は消えません。',misleading:'N19.retentionを1に戻すか、N20.useAckを1にして受理した値を使えば全ケースを満たします。出力の固定や保持値の事前入力では不合格です。'}},
];

/** Build a playable scenario: the shared system, unchanged, plus this case's fault and evidence. */
export function caseScenario(c:FaultCase):Scenario{
 const system=structuredClone(sharedSystem),hierarchy=system.hierarchy!;
 hierarchy.semantics={...hierarchy.semantics!,hints:{abstract:c.hints,functional:c.hints}};
 return {...system,hierarchy,id:c.id,title:c.title,description:'共通システム · 障害案件',symptom:c.symptom,
  briefing:{conditions:'',expected:'',expectedFlow:[],difference:'',firstAction:c.firstAction},
  faults:c.fault?[{id:`F-${c.id}`,key:'value',mode:'stuck',startStep:0,...c.fault}]:[],
  reports:structuredClone(c.reports),hints:c.hints,solution:c.solution};
}
export const caseScenarios:Scenario[]=faultCases.map(caseScenario);
