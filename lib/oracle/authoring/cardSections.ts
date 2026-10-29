import type {SourceSnapshot} from './types';

/** One editorial unit. Offsets address the flattened lens reading, never raw Markdown. */
export interface CardSection {
 id:string;cardNumber:number;lensId:string;title:string;path:string[];text:string;
 start:number;end:number;sectionText:string;sourceHash:string;kind:'manuscript'|'intro';
}
const titles:Record<string,string>={CODE:'Universal Language',ICHING:'I Ching',KEYS:'Gene Keys',DESIGN:'Human Design',BODY:'Body',RELATIONS:'Relations'};
/** Deliberately mirrors the existing private working-reading normalization. */
function plain(text:string){return text.replace(/^_Keywords:_.*\r?\n?/gm,'').replace(/^#{1,6}\s+.*\r?\n?/gm,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'$1').replace(/^\s*>\s?/gm,'').trim();}
const slug=(heading:string)=>heading.split(/\s+[—–]\s+/)[0].normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section';
interface Unit{title:string;path:string[];key:string;raw:string}

/**
 * Keep all paragraphs under a named heading together. Broad lenses are containers;
 * CODE's unheaded body is its reading. The optional entrance is a distinct unit.
 * IDs depend on structural headings, not changing prose or character positions.
 */
export function cardSections(source:SourceSnapshot,introText?:string):CardSection[]{
 const result:CardSection[]=[];
 if(introText?.trim()){const text=introText.trim();result.push({id:`${source.cardNumber}/INTRO`,cardNumber:source.cardNumber,lensId:'INTRO',title:'Intro',path:['Intro'],text,start:0,end:text.length,sectionText:text,sourceHash:source.hash,kind:'intro'});}
 for(const lens of source.sections){
  const raw=source.markdown.slice(lens.start,lens.end),sectionText=plain(raw),lensTitle=titles[lens.id]??lens.title;
  if(!sectionText)continue;
  const headings=[...raw.matchAll(/^(#{3,6})\s+(.+?)\s*\r?$/gm)],units:Unit[]=[];
  const add=(body:string,title:string,path:string[],key:string)=>{if(plain(body))units.push({raw:body,title,path,key});};
  if(!headings.length)add(raw,lens.id==='CODE'?'Reading':lensTitle,[lensTitle,...(lens.id==='CODE'?['Reading']:[])],lens.id==='CODE'?'reading':'reading');
  else{
   add(raw.slice(0,headings[0].index),lens.id==='CODE'?'Reading':'Introduction',[lensTitle,lens.id==='CODE'?'Reading':'Introduction'],lens.id==='CODE'?'reading':'introduction');
   const parents:{level:number;title:string;key:string}[]=[];
   for(const [index,heading]of headings.entries()){
    const level=heading[1].length,title=heading[2].trim(),body=raw.slice(heading.index!+heading[0].length,headings[index+1]?.index??raw.length);
    while(parents.length&&parents.at(-1)!.level>=level)parents.pop();
    const path=[lensTitle,...parents.map(p=>p.title),title],key=[...parents.map(p=>p.key),slug(title)].join('/');
    if(lens.id==='ICHING'&&/^moving lines?$/i.test(title)){
     const lines=[...body.matchAll(/^\*\*Line\s+([1-6])\*\*[^\r\n]*/gm)];
     if(lines.length===6&&new Set(lines.map(line=>line[1])).size===6){
      add(body.slice(0,lines[0].index),title,path,`${key}/introduction`);
      for(const [lineIndex,line]of lines.entries()){const lineTitle=`Line ${line[1]}`;add(body.slice(line.index,lines[lineIndex+1]?.index??body.length),lineTitle,[...path,lineTitle],`${key}/line-${line[1]}`);}
     }else add(body,title,path,key);
    }else add(body,title,path,key);
    parents.push({level,title,key:slug(title)});
   }
  }
  let cursor=0;const occurrences=new Map<string,number>();
  for(const unit of units){
   const text=plain(unit.raw),start=sectionText.indexOf(text,cursor);
   if(start<cursor||sectionText.slice(cursor,start).trim())throw new Error(`The section map for ${source.cardNumber}/${lens.id} no longer matches its reading.`);
   const count=(occurrences.get(unit.key)??0)+1;occurrences.set(unit.key,count);
   result.push({id:`${source.cardNumber}/${lens.id}/${unit.key}${count>1?`-${count}`:''}`,cardNumber:source.cardNumber,lensId:lens.id,title:unit.title,path:unit.path,text,start,end:start+text.length,sectionText,sourceHash:source.hash,kind:'manuscript'});
   cursor=start+text.length;
  }
  if(sectionText.slice(cursor).trim())throw new Error(`The section map for ${source.cardNumber}/${lens.id} left reading text unassigned.`);
 }
 return result;
}
