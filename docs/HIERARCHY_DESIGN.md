# 階層型PoCの設計と調査経路（設計者向け・解答を含む）

## 実行と表示の分離

実行は既存のフラットなNode/Connectionで行う。Scenario.hierarchyは任意の表示・仕様データであり、所属や表示範囲はノードの発火順序、イベント配送、問い合わせ、外部入力の乱数列、採点に影響しない。旧シナリオは従来の画面でプレイできる。

各ノードの直接の所属先は一つ。モジュールは直接ノードと子モジュールを混在して持てる。親子関係は木で、依存関係は木を横断する。越境接続は、関係するすべてのモジュール境界に宣言されたポートが必要。値を加工する機能や追加遅延を境界・接続へ追加しない。

表示は一階層ずつのドリルダウン。システムでルート群、モジュール内で子と直接ノードを表示する。「親階層へ戻る」「システム」で折りたたむ。複数の枝を同時に展開するUIは実装しない。

## 境界で観測するもの

- control：ユーザーが設定したプロパティ値と、その最後の変更時刻。出力イベントの値とは区別する。
- input：接続の受信先ノードが最後に完了した計算で実際に使った入力値と、その計算時刻。
- output：結びつけたノードの最後の計算出力と、その計算時刻。
- 初期フレームは初期値と表示。requestの観測も最後の取得結果で、閲覧時に再問い合わせしない。
- モジュール全体の入出力を一組として同時更新したようには扱わない。ポートごとの時刻を示し、仕様に記載した時間関係で照合する。ノード内部では既存の入出力フレームのアトミック更新を維持する。
- observable=falseのポートは、接続方向・意味と「境界での計測なし」のみ表示。内部を展開したとき、直接ノードや宣言された子ポートで調査できる。

仕様はcondition/expected/timing/assumptionsと、Exprと共通の演算子を持つ宣言式で記述する。式のrefはそのモジュールの公開ポートだけを参照する。自動採点はしない。システム最終出力だけが既存outputRequirements/behaviorCasesで自動判定される。

## 閲覧範囲と記録

グラフ、対象選択、仕様、時系列と比較実験、編集履歴、ヒント、公開ケースと検証結果の全体で内部IDの露出を制限する。子を展開していない画面では子ノードの数式・パラメータ・IDを表示しない。見えているノードの式が外側のノードを参照する場合、その階層の公開境界名に置き換える。

すべての計測は継続する。展開後は以前の時刻の履歴も閲覧できるが、現在の階層に属する系列のみ描画する。折りたたむと見えなくなる。ノートはユーザーの文章なので自動伏字にしない。原因説明は明示的な解説開示またはクリア時のみ表示する。

これは通常UIでの情報提示の規則であり、開発者ツールや配信ソースからデータを秘匿するセキュリティ機構ではない。

## 新規06：数値と時間に現れるずれ

12ノード。開始時はINPUT・Core・OUTPUTを表示し、Coreの展開で4つの子モジュールが現れる。参照系にはさらにShared factorがある。システムの出力は数値出力、時間出力、入力確認、外部値確認の4つ。

### 症状

入力値を8にして反映し12ステップ進めると、数値出力は期待値より16大きく、時間出力は期待1に対して0。入力確認と外部値確認は正常。

### 調査可能な事実と競合仮説

1. 数値変換の仕様は共通係数2を前提とし、外部値を引く。数値出力だけを見ると、局所的な倍率、入力の整形、外部値の取り扱い、共通係数のいずれも候補になる。
2. 入力確認と外部値確認が入力・外部値の経路を照合する手掛かりになる。外部値確認の適切な時刻の値を使えば、数値出力の差を外部値の偶然の変動と分けられる。
3. 0を維持した後で入力値4と8の実験を比較する。数値出力の誤差は2×入力値となる一方、時間出力が1になる時刻はどちらも20ステップ後で、正常12ステップより遅い。
4. 時間判定の仕様は、共通係数2を前提に8回の計数を要求する。ここでも局所的な計数周期、比較係数、共通係数という候補が残る。

### 洞察

数値変換と時間判定が同じ参照サービスを利用していること、係数が数値側では乗算、時間側では必要計数の比較に使われることを結びつける。同じ係数が大きくなれば「値が大きい」と「到達が遅い」という異なる症状を同時に説明できる。

上位の問い合わせ境界は数値を計測しない。参照値と外部値を展開し、共通係数の保持の仕様（2）と、最後の問い合わせ出力（4）を照合する。さらに展開するとN03の処理と設定を調査できる。故障の印や異常モジュールの強調はない。

### 検証実験と修理

- N03.levelを2へ戻すと両症状が解消する。
- 数値変換のN04.scaleを0.5にするだけでは数値出力しか直らず、時間条件で不合格。
- 時間判定のN07.thresholdScaleを2にするだけでは時間出力しか直らず、数値条件で不合格。
- 上記二つを併用する補償も全公開ケースが通れば正解。N03の出力が4のままで、その子モジュール仕様に合わなくても、システム全体の出力契約だけで採点する。
- 入力値1/4/8/12、開始時刻0/7、停止と再開、0維持、入力中の振幅変更、外部値の異なるシードを公開検証ケースに含める。

### 自己評価と限界

二つの症状の照合は、局所修理で片方だけが直ることと、共通修理で両方が直ることを区別するのに役立つ。単に階層を開く操作の追加だけにはしない設計である。

ただし、上位の依存グラフから共通サービスを疑い、先にそこを開いて仕様と値を比較する解き方も可能であり、必ず突然の洞察が起こるとは保証しない。初見プレイテストは未実施。実装者のブラウザ操作は機能確認で、ゲームとしての面白さの実証ではない。探索操作の増加に見合う体験かは初見プレイテストで評価する必要がある。

## 保存と互換性

全問題の現行UIはcausal-hierarchy-session-v14を使用し、world・階層・境界を含む調査対象・詳細開閉・計測・実験・ノート・ヒントを保存する。旧v12/v13スロットは保持するが、現行UIでは読み込まない。ズームとスクロールは保存しない。


## 2026-10-17: System/Core presentation revision

The former M1/M2/M3/M4 overview and separate Output spec section are superseded in the running App. moduleViewScenario adapts all seven original execution graphs: System directly owns every original INPUT/OUTPUT; Core contains exactly the INNER set.06 divides Core into Sampler (N02/N09), Transform (N04), Timing (N06/N07), and Reference → Shared factor (N03). User input N01 and locked external input N12 remain outside Core; terminal outputs N05/N08/N10/N11 remain in System.

System and children use ModuleSpec.outputs and the same spec renderer. Specs become available with the module card/current scope; hidden descendants are absent from graph, selectors and rendered specs. System output rules/cases remain the only acceptance criterion. Boundary INPUT/OUTPUT cards are view objects with no World state or queued execution, retaining consumed/computed-frame timestamps. source bindings expose locked external input values in System's input interface.

Persistence uses v14 with boundary selection IDs; v12/v13 data is retained but not imported. Legacy FlatApp and original authored hierarchy remain source/test fixtures; the active App always uses the adapter. Existing flat problem Core specs reuse their abstract expected behavior;06 additionally has per-port equations and local timing. Numerical rules remain fully specified in the enclosing System for every problem. No claim of first-time playtesting.
