/** Free-form meaning, authored independently of executable node types and expressions. */
export type PortMeaning={name:string;role:string};
export type ModuleMeaning={name:string;purpose:string;ports:Record<string,PortMeaning>;assumptions:string[];constraints:string[]};
export type SemanticModel={abstractDebrief?:{explanation:string;observations:string;misleading:string;causalPath:string[]};hints?:PresentationHints;modules:Record<string,ModuleMeaning>};
export type DisplayMode='abstract'|'functional';

export type PresentationHints={abstract:string[];functional:string[]};
