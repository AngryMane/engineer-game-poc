import type {Scenario} from './engine';
import {playableScenarios} from './cases';
import {shipScenarios} from './spaceship';

/** The ship case is the main play. The abstract pages stay selectable as legacy for comparison and regression. */
export const legacyPlayable:Scenario[]=playableScenarios.map(s=>({...s,title:`旧PoC（抽象） / ${s.title}`}));
export const playScenarios:Scenario[]=[...shipScenarios,...legacyPlayable];
