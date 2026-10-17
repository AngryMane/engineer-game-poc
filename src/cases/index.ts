import type {Scenario,Fault} from '../engine';
import type {FaultReport} from '../faultReports';
import {sharedSystem} from './system';

/** A fault case on the shared system. Each case starts from the healthy system plus its own fault. */
export type FaultCase={id:string;title:string;symptom:string;firstAction:string;fault?:Omit<Fault,'id'|'key'|'mode'|'startStep'>&{severity:number};reports:FaultReport[];hints:string[];solution:Scenario['solution']};

const sup='N01.level',req='N02.level',en='N03.enabled',cap='N04.enabled',use='N05.enabled';
const at=(time:number,id:string,value:number)=>({time,id,value});

export const faultCases:FaultCase[]=[
 {id:'case-00',title:'00 / 練習：変化が出力に届くまで',
  symptom:'故障はありません。N01.levelを変えたとき、どの出力がいつ変わるかを確かめる練習です。',
  firstAction:'N01.levelを12に変更してからRunし、Pauseして、N29とN21が変わった時刻をTimelineで比べてください。',
  reports:[{id:'R00-1',title:'動作確認の依頼',from:'運用担当',summary:'N01.levelを8から12に変えた記録です。N29はすぐ変わりましたが、N21はもう少し後で変わりました。異常ではないか確認してください。',
   runs:[{label:'A',inputs:[at(0,sup,12)]}],
   entries:[{run:'A',time:1,ids:[sup,'N29','N21'],note:'N01.levelを変えた直後。'},{run:'A',time:2,ids:[sup,'N29','N21'],note:'N29だけが新しい値になった。'},{run:'A',time:4,ids:[sup,'N29','N21'],note:'N21も新しい値になった。'}]}],
  hints:['System の仕様表で、N29とN21が何ステップ前の入力を使うか確認しましょう。', 'N21はN06の影響も受けます。N30の値と合わせて比べましょう。', 'モジュールを開くと、各段階で値が変わる時刻を確認できます。'],
  solution:{rootCauseIds:[],stableSteps:16,causalPath:['N01.level','Intake','Conversion','N21'],explanation:'故障はありません。N29はN01.levelを直接受け取るため2ステップ後に、N21は途中のモジュールを経るため4ステップ後に変わります。',observations:'N21と仕様の差は、N06を差し引いた分です。N30でその値を確認できます。',misleading:'出力が変わる時刻の違いは経路の段数によるもので、異常ではありません。'}},

 {id:'case-01',title:'01 / 周期的に下がる余力',fault:{targetId:'N09',parameter:'load',severity:8},
  symptom:'余力N22が一定の周期で大きく下がります。下がる時刻と、ほかの出力を比べてください。',
  firstAction:'入力は変えずにRunで36ステップほど進め、Output logでN22が下がる時刻を確かめてください。',
  reports:[
   {id:'R01-1',title:'余力が周期的に0になる',from:'監視担当',summary:'何も操作していない間にも、余力がときどき0まで下がります。しばらくすると元に戻ります。',
    runs:[{label:'A',inputs:[]}],
    entries:[{run:'A',time:13,ids:['N22'],note:'通常の値。'},{run:'A',time:16,ids:['N22'],note:'余力が下がっている。'},{run:'A',time:25,ids:['N22'],note:'通常の値に戻った。'},{run:'A',time:28,ids:['N22'],note:'再び下がっている。'}]},
   {id:'R01-2',title:'準備は普段どおり',from:'準備担当',summary:'同じ時間帯に準備を動かしましたが、準備量の増え方は普段どおりでした。',
    runs:[{label:'B',inputs:[at(10,en,1)]}],
    entries:[{run:'B',time:14,ids:['N23','N22'],note:'準備量は通常どおり増えている。'},{run:'B',time:16,ids:['N23','N22'],note:'余力は0に下がったが、準備量は通常どおり増えて上限に達した。'}]},
  ],
  hints:['N22が0になる時刻の間隔と、ほかの出力が変化する間隔を比べましょう。', 'N23には影響せずN22にだけ影響するものは何か、仕様で確認しましょう。', 'N25の値を仕様の値と比べましょう。'],
  solution:{rootCauseIds:['N09'],stableSteps:16,causalPath:['Load','N25 / Balance','N22'],explanation:'N09.loadが2から8に変わっていました。N09はN08の周期信号にloadを掛けるため、周期的にN22から差し引く値が大きくなります。',observations:'N22が0になる時刻は12ステップごとで、N25の変化と一致します。N23の計算はN09の値を使わないため影響を受けません。',misleading:'N09.loadを2に戻すと全ケースを満たします。N13だけを補正しても、N25の出力条件は満たせません。'}},

 {id:'case-02',title:'02 / 準備完了が遅れる',fault:{targetId:'N14',parameter:'rate',severity:.25},
  symptom:'準備を始めてから準備完了N24が1になるまで、期待より長くかかります。',
  firstAction:'N03.enabledを1に変更してからRunで12ステップほど進め、N23とN24を仕様と比べてください。',
  reports:[
   {id:'R02-1',title:'準備完了まで時間がかかる',from:'運用担当',summary:'準備を始めて10ステップほど待ちましたが、準備完了になりませんでした。もっと待つと完了しました。',
    runs:[{label:'A',inputs:[at(1,en,1)]}],
    entries:[{run:'A',time:9,ids:['N23','N24'],note:'通常なら完了している時刻。'},{run:'A',time:15,ids:['N23','N24'],note:'まだ完了していない。'},{run:'A',time:24,ids:['N23','N24'],note:'ようやく完了。'}]},
   {id:'R02-2',title:'余力の見積もりは正常',from:'監視担当',summary:'同じ時間帯の余力の見積もりは、仕様どおりの値でした。',
    runs:[{label:'A',inputs:[at(1,en,1)]}],
    entries:[{run:'A',time:9,ids:['N22','N25'],note:'余力は仕様どおり。'}]},
  ],
  hints:['N03.enabledを1にしてから、N23が1ステップでどれだけ増えるかを仕様と比べましょう。', 'N23の増え方はN01.levelとN02.levelの差で決まります。両方を変えて比べましょう。', 'N23を計算するモジュールを開き、使った入力と増え方を比べましょう。'],
  solution:{rootCauseIds:['N14'],stableSteps:16,causalPath:['Storage','N23','N24'],explanation:'N14.rateが1から0.25に変わっていました。N14は毎ステップの差分にrateを掛けて加えるため、N23の増え方が4分の1になり、上限24に達するまで長くかかります。',observations:'N23の増え方がN01.levelとN02.levelの差の0.25倍になっています。N22は同じ入力を使って正しく計算されるため、入力側ではなくN14が原因と分かります。',misleading:'N24はN23に正しく従っています。N15の判定を変えても、N23の出力条件は満たせません。'}},

 {id:'case-03',title:'03 / 二つの換算値がずれる',fault:{targetId:'N11',parameter:'scale',severity:3},
  symptom:'変換値N21と要求の換算値N26が、どちらも仕様より大きくなります。',
  firstAction:'N02.levelを4に変更してからRunで12ステップほど進め、N21・N26・N29を仕様と比べてください。',
  reports:[
   {id:'R03-1',title:'変換値が大きすぎる',from:'出力担当',summary:'供給量に対して、変換値が仕様より大きく出ています。',
    runs:[{label:'A',inputs:[]}],
    entries:[{run:'A',time:10,ids:[sup,'N29','N21','N30'],note:'供給量の確認N29は正しい。'}]},
   {id:'R03-2',title:'要求の換算値が合わない',from:'需要担当',summary:'要求量を変えても、換算値が仕様の比率になりません。',
    runs:[{label:'B',inputs:[at(1,req,4)]}],
    entries:[{run:'B',time:3,ids:[req,'N26'],note:'変更前。'},{run:'B',time:8,ids:[req,'N26'],note:'変更後も比率が仕様と異なる。'}]},
  ],
  hints:['N21とN26は別の出力ですが、仕様からのずれ方に共通点がないか比べましょう。', 'N29が仕様どおりなら、N01.levelは途中まで届いています。', 'N21とN26を計算するモジュールで、それぞれが問い合わせる値を確認しましょう。'],
  solution:{rootCauseIds:['N11'],stableSteps:16,causalPath:['Reference','Conversion','N21 / N26'],explanation:'N11.scaleが2から3に変わっていました。N16とN17はどちらもN11に問い合わせて同じ倍率を掛けるため、N21とN26がどちらも1.5倍になります。',observations:'N21はN06を引く分だけ比率がずれて見えますが、N26はN02.levelのちょうど3倍です。N22やN23はN11を使わないため影響を受けません。',misleading:'N11.scaleを2に戻すと全ケースを満たします。N16とN17のgainを下げて補うと、N21でN06の差し引きまで縮むため全ケースは満たせません。'}},

 {id:'case-04',title:'04 / 大きい供給だけ合わない',fault:{targetId:'N16',parameter:'ceiling',severity:20},
  symptom:'供給量が小さいときは変換値N21が仕様どおりですが、大きくすると仕様より小さくなります。',
  firstAction:'N01.levelを4にした実験と14にした実験を記録し、Experimentsで比べてください。',
  reports:[{id:'R04-1',title:'高負荷時だけ変換値が足りない',from:'出力担当',summary:'通常の供給量では問題ありませんが、供給量を上げた日だけ変換値が仕様に届きませんでした。',
   runs:[{label:'A',inputs:[at(0,sup,6)]},{label:'B',inputs:[at(0,sup,14)]}],
   entries:[{run:'A',time:10,ids:[sup,'N21','N30'],note:'仕様どおり。'},{run:'B',time:10,ids:[sup,'N21','N30'],note:'仕様より小さい。'},{run:'B',time:20,ids:[sup,'N21','N30'],note:'外部値が変わってもN21は同じ値のまま。'}]}],
  hints:['N01.levelをいくつか変えて、N21が仕様と合わなくなる境目を探しましょう。', 'N21が一定の値で止まっていないか確認しましょう。', 'N21を計算するモジュールで、値を収める範囲を仕様と比べましょう。'],
  solution:{rootCauseIds:['N16'],stableSteps:16,causalPath:['Conversion','N21'],explanation:'N16.ceilingが30から20に変わっていました。N01.levelが10程度まではN21に影響しませんが、それより大きいとN21が20で頭打ちになります。',observations:'仕様の上限は30です。N21がN06によらず20で一定なら、計算結果ではなく上限で止まっていると分かります。',misleading:'N16.ceilingを30に戻すと全ケースを満たします。上限で止まった分は倍率やgainでは補えず、N01.levelが小さいときの結果も変わってしまいます。'}},

 {id:'case-05',title:'05 / 値は合うが反映が遅い',fault:{targetId:'N07',parameter:'interval',severity:4},
  symptom:'供給量を変えると、変換値N21や余力N22が最終的には仕様の値になりますが、変わる時刻が遅れます。',
  firstAction:'N01.levelを12に変更した実験を記録し、変更時刻だけを変えた変種と比べてください。',
  reports:[
   {id:'R05-1',title:'変更の反映が遅い',from:'運用担当',summary:'供給量を変えたあと、変換値が変わるまで時間がかかりました。最後には正しい値になります。',
    runs:[{label:'A',inputs:[at(1,sup,12)]}],
    entries:[{run:'A',time:5,ids:[sup,'N29','N21'],note:'確認出力は変わったが、変換値はまだ古い。'},{run:'A',time:7,ids:[sup,'N29','N21'],note:'変換値も変わった。'}]},
   {id:'R05-2',title:'遅れ方が毎回違う',from:'監視担当',summary:'別の時刻に変更したときは、遅れがもっと長くなりました。',
    runs:[{label:'B',inputs:[at(3,sup,12)]}],
    entries:[{run:'B',time:7,ids:[sup,'N29','N22'],note:'余力はまだ古い値。'},{run:'B',time:9,ids:[sup,'N29','N22'],note:'まだ古い値。'},{run:'B',time:10,ids:[sup,'N29','N22'],note:'ようやく変わった。'}]},
  ],
  hints:['N01.levelを変える時刻だけを変えて、出力が変わるまでのステップ数を比べましょう。', 'N29は遅れず、N21やN22だけが遅れるなら、両者が共通に通るモジュールを探しましょう。', 'N01.levelを最初に受け取るモジュールで、処理の周期を確認しましょう。'],
  solution:{rootCauseIds:['N07'],stableSteps:16,causalPath:['Intake','Conversion / Preparation','N21 / N22 / N23'],explanation:'N07.intervalが1から4に変わっていました。N07がN01.levelを4ステップに1回しか後段へ渡さないため、変更した時刻によって出力の遅れが1〜3ステップ変わります。',observations:'N29はN07を通らないため遅れません。遅れが変更時刻によって変わることが、周期的な受け渡しを示します。',misleading:'N07.intervalを1に戻すと全ケースを満たします。最終値が合うだけでは仕様を満たしません。'}},

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
  hints:['N02.levelを0にした実験と4にした実験で、N22とN23を比べましょう。', 'N22の不足分とN23の増え方の不足分を、N02.levelの値と比べましょう。', 'N22とN23を計算するモジュールの中で、N02.levelにどの値を掛けているか確認しましょう。'],
  solution:{rootCauseIds:['N10'],stableSteps:16,causalPath:['Reference','Accounting','Balance / Storage','N22 / N23 / N24'],explanation:'N10.factorが1から2に変わっていました。N12はN02.levelにN10の値を掛けるため、N13とN14で差し引く値が過大になり、N22が小さく、N23の増え方も小さくなります。',observations:'N02.levelが0なら影響が消え、N02.levelを増やすとN22の不足とN23の遅れがともに大きくなります。N26はN11の値を使うため影響を受けません。',misleading:'N10.factorを1に戻すと全ケースを満たします。N13側かN14側の一方だけを補正しても不合格です。'}},

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
  hints:['二つの記録で、N04.enabledを0にした時点でN05.enabledが1だったかを比べましょう。', 'N02.levelは固定し、N04.enabledとN05.enabledを変える順番と間隔だけを変えて比べましょう。', 'N05.enabledを1にする前に、N27とN28の値を比べましょう。', 'N04.enabledを1→0にしてから、しばらく待ってN05.enabledを1にしてください。N04.enabledの0とN05.enabledの1を同時に変えた場合とも比べましょう。'],
  solution:{rootCauseIds:['N19'],stableSteps:16,causalPath:['Holding','Consumption','N28'],explanation:'N19.retentionが1から0に変わっていました。N04.enabledもN05.enabledも0の間、N19は保持している値にretentionを掛けるため、待っている間に値が0になります。',observations:'N04.enabledを1→0にしたあとN05.enabledを1にしないまま待つと、2ステップ後にN19の値が0になります。N05.enabledを1にしたままN04.enabledを0にした場合や、同時に変えた場合は0になりません。',misleading:'N19.retentionを1に戻すか、N20.useAckを1にしてN18の値を使えば全ケースを満たします。出力の固定やN19の状態の事前入力では不合格です。'}},
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

/**
 * All fault cases on one page: the shared system with every case's fault at once. The reports
 * reuse the cases' hidden input histories, but their notes are written for the combined system,
 * because observations that were healthy in a single-fault case are not healthy here.
 * Each report carries the hints of the case it came from.
 */
const hintsOf=(id:string)=>faultCases.find(c=>c.id===id)!.hints;
export const incidentReports:FaultReport[]=[
 {id:'R01',title:'N22がときどき0になる',from:'運用担当',summary:'何も操作していない間にも、N22がときどき0まで下がります。しばらくすると戻ります。',hints:hintsOf('case-01'),
  runs:[{label:'A',inputs:[]}],
  entries:[{run:'A',time:13,ids:['N22'],note:'記録開始から13ステップ後。'},{run:'A',time:16,ids:['N22'],note:'0まで下がった。'},{run:'A',time:25,ids:['N22'],note:'値が戻った。'},{run:'A',time:28,ids:['N22'],note:'再び0まで下がった。'}]},
 {id:'R02',title:'N24がなかなか1にならない',from:'運用担当',summary:'N03.enabledを1にして20ステップ以上待ちましたが、N24が1になりませんでした。N22が0の間もN23は増え続けていました。',hints:hintsOf('case-02'),
  runs:[{label:'A',inputs:[at(1,en,1)]},{label:'B',inputs:[at(10,en,1)]}],
  entries:[{run:'A',time:9,ids:['N23','N24'],note:'N03.enabledを1にしてから8ステップ後。'},{run:'A',time:15,ids:['N23','N24'],note:'N24はまだ0。'},{run:'A',time:24,ids:['N23','N24'],note:'23ステップ後もN24は0のまま。'},{run:'B',time:14,ids:['N23','N22'],note:'別の日。N03.enabledを1にしてから4ステップ後。'},{run:'B',time:16,ids:['N23','N22'],note:'N22は0だが、N23は増えている。'}]},
 {id:'R03',title:'N21とN26が仕様より大きい',from:'運用担当',summary:'N21がN01.levelに対して仕様より大きく、N26もN02.levelに対して仕様の比率になりません。',hints:hintsOf('case-03'),
  runs:[{label:'A',inputs:[]},{label:'B',inputs:[at(1,req,4)]}],
  entries:[{run:'A',time:10,ids:[sup,'N29','N21','N30'],note:'N29はN01.levelどおり。'},{run:'B',time:3,ids:[req,'N26'],note:'N02.levelを4に変えた直後。'},{run:'B',time:8,ids:[req,'N26'],note:'比率が仕様と異なる。'}]},
 {id:'R04',title:'N21が同じ値で止まる',from:'運用担当',summary:'N01.levelが6と14のときのN21を記録しました。14のときは、N30が変わってもN21が同じ値のままでした。',hints:hintsOf('case-04'),
  runs:[{label:'A',inputs:[at(0,sup,6)]},{label:'B',inputs:[at(0,sup,14)]}],
  entries:[{run:'A',time:10,ids:[sup,'N21','N30'],note:'N01.levelが6。'},{run:'B',time:10,ids:[sup,'N21','N30'],note:'N01.levelが14。'},{run:'B',time:20,ids:[sup,'N21','N30'],note:'N30が変わってもN21は同じ値のまま。'}]},
 {id:'R05',title:'N22の変化が遅れ、遅れ方が毎回違う',from:'運用担当',summary:'N01.levelを変えたあと、N22が変わるまで時間がかかりました。変えた時刻によって遅れの長さが違いました。',hints:hintsOf('case-05'),
  runs:[{label:'A',inputs:[at(1,sup,12)]},{label:'B',inputs:[at(3,sup,12)]}],
  entries:[{run:'A',time:5,ids:[sup,'N29','N22'],note:'N29は変わったが、N22はまだ変わっていない。'},{run:'A',time:6,ids:[sup,'N29','N22'],note:'N22が変わった。'},{run:'B',time:7,ids:[sup,'N29','N22'],note:'別の時刻に変更。N22はまだ変わっていない。'},{run:'B',time:9,ids:[sup,'N29','N22'],note:'まだ変わっていない。'},{run:'B',time:10,ids:[sup,'N29','N22'],note:'ようやく変わった。'}]},
 {id:'R06',title:'N02.levelが大きいとN22とN23が悪化する',from:'運用担当',summary:'N02.levelが大きい間はN22が小さく、N23の増え方も小さくなります。N02.levelを0にした日はN23の増え方が大きくなりました。',hints:hintsOf('case-06'),
  runs:[{label:'A',inputs:[at(1,req,4)]},{label:'B',inputs:[at(1,req,3),at(2,en,1)]},{label:'C',inputs:[at(1,req,0),at(2,en,1)]}],
  entries:[{run:'A',time:10,ids:[sup,req,'N22','N26'],note:'N22が仕様より小さい。'},{run:'B',time:10,ids:[req,'N23','N24'],note:'N02.levelが3。'},{run:'C',time:10,ids:[req,'N23','N24'],note:'N02.levelが0。N23の増え方が大きい。'}]},
 {id:'R07',title:'N27は6なのにN28が0',from:'運用担当',summary:'N02.levelを6にしてN04.enabledを1にし、あとでN05.enabledを1にしましたが、N28は0でした。同じ値で正しくN28が6になった日もあります。',hints:hintsOf('case-07'),
  runs:[{label:'A',inputs:[at(0,req,6),at(0,cap,1),at(6,cap,0),at(10,use,1)]},{label:'B',inputs:[at(0,req,6),at(0,cap,1),at(4,use,1),at(8,cap,0)]}],
  entries:[{run:'A',time:18,ids:['N27','N28',use],note:'N27は6だが、N28は0。'},{run:'B',time:18,ids:['N27','N28',use],note:'N28は6。'}],missing:'途中でN04.enabledを0にしたことは覚えていますが、操作の時刻と順番は記録されていません。'},
];
const incidentCases=faultCases.filter(c=>c.fault);
const incidentBase=caseScenario({...faultCases[0],hints:[]});
export const incidentScenario:Scenario={
 ...incidentBase,id:'incident',title:'障害対応：共通システムに届いた7件のレポート',
 symptom:'共通システムに7件の障害レポートが届いています。複数の故障が同時に起きている可能性があります。実験で症状を再現し、出力条件をすべて満たすように修復してください。',
 briefing:{conditions:'',expected:'',expectedFlow:[],difference:'',firstAction:'まず入力を変えずにRunで進め、Output logに出る異常の時刻を確かめてから、レポートの操作を実験として再現してください。'},
 faults:incidentCases.map(c=>({id:`F-${c.id}`,key:'value',mode:'stuck' as const,startStep:0,...c.fault!})),
 reports:incidentReports,hints:[],
 solution:{rootCauseIds:incidentCases.flatMap(c=>c.solution.rootCauseIds),stableSteps:16,
  causalPath:[],
  explanation:incidentCases.map((c,i)=>`${incidentReports[i].id}：${c.solution.explanation}`).join('\n'),
  observations:incidentCases.map((c,i)=>`${incidentReports[i].id}：${c.solution.observations}`).join('\n'),
  misleading:incidentCases.map((c,i)=>`${incidentReports[i].id}：${c.solution.misleading}`).join('\n')},
};
/** Pages shown in the investigation selector: the practice case and the combined incident. */
export const playableScenarios:Scenario[]=[caseScenarios[0],incidentScenario];
