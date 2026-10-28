import { manuscriptSource } from '../../../lib/oracle/authoring/source';
import { sha256 } from '../../../lib/oracle/authoring/workflow';
const manuscripts = import.meta.glob('../../../oracle/cards/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
export async function bundledSource(number: number) {
 const loader=manuscripts[`../../../oracle/cards/${String(number).padStart(2,'0')}.md`];
 if(!loader||!Number.isInteger(number)||number<1||number>64)throw new Error('Choose a card from the Oracle index.');
 const markdown=await loader();return manuscriptSource(number,`app-manuscript:${await sha256(markdown)}`,markdown);
}
