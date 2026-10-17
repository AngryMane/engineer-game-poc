/** Partial observations provided to the player, independent of executable cases. */
export type ScenarioReport={summary:string;fragments:{run:string;time:number;values:Record<string,number>;note:string}[]};
export const scenarioReports:Record<string,ScenarioReport>={reproduction:{summary:'After earlier configuration work, a later use sometimes produced zero. Other runs produced the acknowledged setting.',fragments:[
 {run:'A',time:18,values:{N07:10,N08:0,'N03.enabled':1},note:'Output mismatch. An earlier record shows N02.enabled returned to 0; intervening input times were not recorded.'},
 {run:'B',time:21,values:{N07:10,N08:10,'N03.enabled':1},note:'No output mismatch.'},
 {run:'C',time:12,values:{N07:4,N08:0,'N03.enabled':0},note:'No output mismatch.'},
]}};
