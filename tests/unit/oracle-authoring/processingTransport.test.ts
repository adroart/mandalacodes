import {beforeEach,describe,it,expect,vi} from 'vitest';
const native=vi.hoisted(()=>vi.fn());const bridge=vi.hoisted(()=>vi.fn());
vi.mock('../../../mobile/node_modules/@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true}}));
vi.mock('../../../src/mobile/account/nativeAccountTransport',()=>({createNativeAccountFetch:()=>native}));
vi.mock('../../../src/mobile/authoring/bridgeConnection',()=>({loadMacBridge:()=>({endpoint:'paired'}),requestMacBridge:bridge}));
import {requestAuthoringProcessing} from '../../../src/mobile/authoring/processing';
describe('phone processing transport',()=>{
 beforeEach(()=>{vi.clearAllMocks();bridge.mockResolvedValue({status:200,value:{paired:true}});});
 it('uses ready hosted processing without calling the paired Mac',async()=>{native.mockResolvedValue(new Response('{"hosted":true}'));expect((await requestAuthoringProcessing({operation:'capabilities'})).value.hosted).toBe(true);expect(bridge).not.toHaveBeenCalled();});
 it('never bypasses rejected authentication using a Mac bridge',async()=>{native.mockResolvedValue(new Response('{}',{status:401}));await expect(requestAuthoringProcessing({operation:'transcribe'})).rejects.toThrow('Sign in');expect(bridge).not.toHaveBeenCalled();});
 it('retains explicit pairing fallback while hosted route is unpublished',async()=>{native.mockResolvedValue(new Response('{}',{status:404}));expect((await requestAuthoringProcessing({operation:'transcribe'})).value.paired).toBe(true);});
 it('recognizes a static SPA response as an unpublished endpoint',async()=>{native.mockResolvedValue(new Response('<html>app shell</html>',{headers:{'Content-Type':'text/html'}}));expect((await requestAuthoringProcessing({operation:'transcribe'})).value.paired).toBe(true);});
 it('keeps an existing Mac job status on the paired service',async()=>{expect((await requestAuthoringProcessing({operation:'writing-status',requestId:'job'})).value.paired).toBe(true);expect(native).not.toHaveBeenCalled();});
 it('does not resend a failed hosted provider call to another service',async()=>{native.mockResolvedValue(new Response('{}',{status:502}));await expect(requestAuthoringProcessing({operation:'transcribe'})).rejects.toThrow();expect(bridge).not.toHaveBeenCalled();});
});
