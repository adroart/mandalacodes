import fs from 'fs';
const s=fs.readFileSync(process.argv[2]||'oracle/cards/03.md','utf8');
const body=s.slice(s.indexOf('## CODE'));
const secs=body.split(/\n## /);
for(const sec of secs){
  const name=sec.split('\n')[0].replace(/^## /,'');
  const paras=sec.split('\n').filter(l=>l&&!l.startsWith('#')&&!l.startsWith('_')&&!l.startsWith('- ')&&!l.startsWith('**Line'));
  const text=paras.join(' ');
  const sentences=text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const words=text.split(/\s+/).length;
  const commas=(text.match(/,/g)||[]).length;
  const listy=sentences.filter(x=>(x.match(/,/g)||[]).length>=3).length;
  const frag=sentences.filter(x=>x.split(/\s+/).length<=4).length;
  console.log(name.padEnd(10), 'words/sentence', (words/sentences.length).toFixed(1), ' commas/100w', (commas/words*100).toFixed(1), ' 3+comma sentences', listy, ' fragments<=4w', frag);
}
