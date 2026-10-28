import {WorkingCardStore,type WorkingSection,type HumanBlock} from '../../../lib/oracle/authoring/humanDrafts';
import type {AuthoringServices,SourceSnapshot} from '../../../lib/oracle/authoring/types';
import {replaceAnchoredText,type PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
const store=new WorkingCardStore(),CONTEXT='oracle.reader.anchors.v1',UNDO='oracle.passage.undo.v1',LINKS='oracle.passage.connections.v1';
export interface PassageEvidence{sessionId:string;captureId:string;transcriptId:string}
export function plainSection(source:SourceSnapshot,sectionId:string){const s=source.sections.find(s=>s.id===sectionId);if(!s)throw new Error('Choose a reading section.');return source.markdown.slice(s.start,s.end).replace(/^_Keywords:_.*\r?\n?/gm,'').replace(/^#{1,6}\s+.*\r?\n?/gm,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'$1').replace(/^\s*>\s?/gm,'').trim();}
export function readReaderAnchors():PassageAnchor[]{try{return JSON.parse(localStorage.getItem(CONTEXT)??'[]');}catch{return[];}}
export function writeReaderAnchors(anchors:PassageAnchor[]){localStorage.setItem(CONTEXT,JSON.stringify(anchors));window.dispatchEvent(new CustomEvent('oracle:reader-context',{detail:anchors}));}
function baseline(source:SourceSnapshot,sectionId:string,text:string):WorkingSection{return {key:`${source.cardNumber}/${sectionId}`,cardNumber:source.cardNumber,sectionId,text,revision:0,sourceHash:source.hash,source,savedAt:'',blocks:[{id:'published',text,origin:'ai',evidence:[]}],humanWords:0,totalWords:wordCount(text)};}
const wordCount=(s:string)=>(s.match(/\S+/g)??[]).length;
function exactBlocks(draft:WorkingSection):HumanBlock[]{let cursor=0;const result:HumanBlock[]=[];for(const block of draft.blocks){const at=draft.text.indexOf(block.text,cursor);if(at<0)throw new Error('The passage provenance changed. Reopen this reading.');if(at>cursor)result.push({id:`gap/${cursor}`,text:draft.text.slice(cursor,at),origin:block.origin,evidence:[]});result.push(structuredClone(block));cursor=at+block.text.length;}if(cursor<draft.text.length)result.push({id:'trailing',text:draft.text.slice(cursor),origin:'ai',evidence:[]});return result;}
function sliceBlocks(blocks:HumanBlock[],start:number,end:number){let pos=0;return blocks.flatMap(b=>{const from=Math.max(0,start-pos),to=Math.min(b.text.length,end-pos);pos+=b.text.length;return to>from?[{...structuredClone(b),id:`${b.id}/${start}-${end}`,text:b.text.slice(from,to)}]:[];});}
async function apply(anchors:PassageAnchor[],words:string,services:AuthoringServices,evidence:PassageEvidence|undefined,addition:boolean){
 if(!anchors.length||!words.trim())throw new Error('Choose a passage and check your words first.');
 const ordered=[...anchors].sort((a,b)=>a.start-b.start),first=ordered[0],last=ordered.at(-1)!;
 if(ordered.some(a=>a.cardNumber!==first.cardNumber||a.sectionId!==first.sectionId||a.sectionText!==first.sectionText))throw new Error('Choose one destination for your words. Other passages remain references.');
 for(let i=1;i<ordered.length;i++)if(first.sectionText.slice(ordered[i-1].end,ordered[i].start).trim())throw new Error('Choose adjacent passages to replace them together.');
 const source=await services.loadSource(first.cardNumber),existing=await store.get(first.cardNumber,first.sectionId);
 if(evidence&&existing?.blocks.some(b=>b.evidence.some(e=>e.sessionId===evidence.sessionId&&e.transcriptId===evidence.transcriptId)))return;
 if(first.sourceHash&&source.hash!==first.sourceHash)throw new Error('The source reading changed. Select the passage again.');
 if((existing?.revision??0)!==(first.revision??0))throw new Error('New words arrived in this reading. Select the passage again before replacing it.');
 const before=existing??baseline(source,first.sectionId,plainSection(source,first.sectionId));
 const combined={...first,end:last.end,text:first.sectionText.slice(first.start,last.end)};
 const proposed=replaceAnchoredText(before.text,combined,words);
 let start=addition?combined.end:combined.start,end=combined.end;const insert=addition?`\n\n${words}`:words;
 if(addition){let position=0;for(const block of exactBlocks(before)){const from=position;position+=block.text.length;if(block.attachedTo===combined.text&&from>=start&&!before.text.slice(start,from).trim())start=end=position;}}

 if(!addition&&proposed===before.text)return;
 const blocks=exactBlocks(before),nextBlocks=[...sliceBlocks(blocks,0,start),{id:crypto.randomUUID(),text:insert,sourceText:insert,...(!addition?{replacedText:combined.text}:{attachedTo:combined.text}),origin:'human' as const,evidence:evidence?[{...evidence,signature:words}]:[]},...sliceBlocks(blocks,end,before.text.length)];
 const next={...before,text:nextBlocks.map(b=>b.text).join(''),blocks:nextBlocks,humanWords:nextBlocks.reduce((n,b)=>n+(b.origin==='human'?wordCount(b.text):0),0),totalWords:wordCount(nextBlocks.map(b=>b.text).join(''))};
 const saved=await store.save(next,existing?.revision??0);
 localStorage.setItem(UNDO,JSON.stringify({before,afterRevision:saved.revision}));window.dispatchEvent(new Event('oracle:passage-applied'));
}
export const applyPassageReplacement=(anchors:PassageAnchor[],words:string,services:AuthoringServices,evidence?:PassageEvidence)=>apply(anchors,words,services,evidence,false);
export const applyPassageAddition=(anchor:PassageAnchor,words:string,services:AuthoringServices,evidence?:PassageEvidence)=>apply([anchor],words,services,evidence,true);
export function hasPassageUndo(){return !!localStorage.getItem(UNDO);}
export async function undoPassageReplacement(){const raw=localStorage.getItem(UNDO);if(!raw)return;const {before,afterRevision}=JSON.parse(raw) as {before:WorkingSection;afterRevision:number};const latest=await store.get(before.cardNumber,before.sectionId);if(latest?.revision!==afterRevision)throw new Error('This reading has newer edits. Restore an earlier version from its history.');await store.save(before,afterRevision);localStorage.removeItem(UNDO);window.dispatchEvent(new Event('oracle:passage-applied'));}
export function savePassageConnection(anchors:PassageAnchor[],note:string){if(anchors.length<2)throw new Error('Choose at least two passages to connect.');const links=JSON.parse(localStorage.getItem(LINKS)??'[]') as {id:string;anchors:PassageAnchor[];note:string}[];const id=[...anchors.map(a=>a.id)].sort().join('|')+'|'+note;if(!links.some(l=>l.id===id))localStorage.setItem(LINKS,JSON.stringify([...links,{id,anchors,note}]));window.dispatchEvent(new Event('oracle:passage-applied'));}
export function passageConnections():{id:string;anchors:PassageAnchor[];note:string}[]{try{return JSON.parse(localStorage.getItem(LINKS)??'[]');}catch{return[];}}
