import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('../../../functions/api/_lib/auth',()=>({requireUser:vi.fn(async()=>({userId:'owner'}))}));
import {requireUser} from '../../../functions/api/_lib/auth';
import {onRequestPost as sync} from '../../../functions/api/oracle/authoring/private';
import {onRequestPost as process} from '../../../functions/api/oracle/authoring/process';
import {boundedJson} from '../../../functions/api/oracle/authoring/_shared';
const request=(body:unknown,origin='capacitor://localhost')=>new Request('https://mandalacodes.com/api/oracle/authoring/private',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
describe('private hosted authoring',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireUser).mockResolvedValue({userId:'owner'} as any);});
 it('requires authentication before reading private storage',async()=>{vi.mocked(requireUser).mockResolvedValue(new Response('',{status:401}));const get=vi.fn();expect((await sync({request:request({operation:'read',id:'session'}),env:{ORACLE_PRIVATE:{get} as any}})).status).toBe(401);expect(get).not.toHaveBeenCalled();});
 it('rejects foreign origins before account access',async()=>{expect((await sync({request:request({},'https://evil.example'),env:{}})).status).toBe(403);expect(requireUser).not.toHaveBeenCalled();});
 it('uses conditional revision writes and reports races as conflicts',async()=>{const put=vi.fn().mockResolvedValue(null);const response=await sync({request:request({operation:'save',id:'session',expectedRevision:'previous',document:{session:{schema:1,id:'session'},audio:[]}}),env:{ORACLE_PRIVATE:{put} as any}});expect(response.status).toBe(409);expect(put).toHaveBeenCalledWith('authoring/owner/sessions/session',expect.any(String),expect.objectContaining({onlyIf:{etagMatches:'previous'}}));});
 it('creates with if-none-match, never an unconditional overwrite',async()=>{const put=vi.fn().mockResolvedValue({etag:'first'});expect((await sync({request:request({operation:'save',id:'session',expectedRevision:null,document:{session:{schema:1,id:'session'},audio:[]}}),env:{ORACLE_PRIVATE:{put} as any}})).status).toBe(200);expect(put.mock.calls[0][2].onlyIf).toEqual({etagDoesNotMatch:'*'});});
 it('rejects traversal and missing audio references',async()=>{expect((await sync({request:request({operation:'read',id:'../other'}),env:{ORACLE_PRIVATE:{} as any}})).status).toBe(400);const put=vi.fn();expect((await sync({request:request({operation:'save',id:'session',expectedRevision:null,document:{session:{schema:1,id:'session'},audio:[{captureId:'capture',hash:'a'.repeat(64)}]}}),env:{ORACLE_PRIVATE:{put,head:vi.fn().mockResolvedValue(null)} as any}})).status).toBe(400);expect(put).not.toHaveBeenCalled();});
 it('bounds chunked request bodies without content-length',async()=>{await expect(boundedJson(request({data:'x'.repeat(100)}),20)).rejects.toThrow('body_too_large');});
 it('requests direct JSON review and preserves the exact comparison baseline',async()=>{
  const words='I trust my direction.',original='The original reading.';
  const output={sections:[{sectionId:'2/DESIGN/the-drive',text:words,evidenceQuotes:[words],changes:[],warnings:[]}],unassigned:[]};
  const provider=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]}),{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',provider);
  const response=await process({request:request({operation:'assimilate-sections',assimilation:{words,sections:[{id:'2/DESIGN/the-drive',title:'The drive',path:['Human Design','The drive'],text:original}],startSectionId:'2/DESIGN/the-drive'}}),env:{OPENAI_API_KEY:'test-server-key',ORACLE_WRITING_MODEL:'configured-model'}});
  expect(response.status).toBe(200);expect((await response.json() as any).assimilation.sections[0].comparisonOriginal).toBe(original);
  const sent=JSON.parse(provider.mock.calls[0][1].body);expect(sent.response_format).toEqual({type:'json_object'});expect(sent.messages[0].content).not.toContain('Return ONLY an artifact');expect(sent.messages[0].content).toContain('Return ONLY a JSON object');expect(sent.model).toBe('configured-model');
 });
 it('fails honestly when hosted providers are not configured',async()=>{const result=await process({request:request({operation:'transcribe'}),env:{}});expect(result.status).toBe(503);expect(await result.json()).toMatchObject({error:expect.stringContaining('not configured')});});
});
