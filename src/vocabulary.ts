/**
 * Ship pages use the test-voyage vocabulary: an experiment is a test voyage on a stock ship of the class,
 * an operation sequence is the crew's instruction sheet, and a variant is a rewritten sheet.
 * "実験運転" (the payload mode) and "実験" as an edit purpose keep their meaning.
 */
export function shipWords(text:string){
 return text
  .replace('操作シーケンスを編集して変種を作る','指示書を書き換えて、もう一度試験航海に出す')
  .replace('変種として実行','書き換えた指示書で出航')
  .replace('変種の名前','試験航海の名前')
  .replace(/」の変種/g,'」の指示書を書き換えたもの')
  .replace(/ \/ 変種/g,' / 書き換え')
  .replace(/変種/g,'書き換えた指示書')
  .replace(/操作シーケンス/g,'指示書')
  .replace('現在の記録','いまの航海の指示書')
  .replace(/実験(?!運転|編集)/g,'試験航海');
}
export const wordsFor=(ship:boolean)=>ship?shipWords:(text:string)=>text;
