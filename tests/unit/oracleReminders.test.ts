import {describe,expect,it,vi} from 'vitest';
import {createReminderBridge,parseReminderStatus,type ReminderHandler} from '../../src/mobile/reminders/reminderBridge';
const state={authorization:'authorized',scheduled:true,enabled:true,hour:9,minute:15};
describe('native reminder requests',()=>{
  it('status is read-only and does not request permission or schedule',async()=>{
    const postMessage=vi.fn<ReminderHandler['postMessage']>(async body=>({...state,requestId:String(body.requestId)}));
    const bridge=createReminderBridge({postMessage});
    expect(await bridge.status()).toMatchObject(state);
    expect(postMessage.mock.calls.map(([body])=>body.action)).toEqual(['status']);
  });
  it('schedules only after explicit enable and sends bounded chosen time',async()=>{
    const postMessage=vi.fn<ReminderHandler['postMessage']>(async body=>({...state,requestId:String(body.requestId),hour:body.hour,minute:body.minute}));
    const bridge=createReminderBridge({postMessage});
    expect(postMessage).not.toHaveBeenCalled();
    await expect(bridge.enable(24,0)).rejects.toThrow('valid');
    expect(postMessage).not.toHaveBeenCalled();
    expect(await bridge.enable(20,30)).toMatchObject({hour:20,minute:30,enabled:true});
    expect(postMessage.mock.calls[0][0]).toMatchObject({action:'enable',hour:20,minute:30});
  });
  it('reports actual pending state after disabling',async()=>{
    const postMessage=vi.fn<ReminderHandler['postMessage']>(async body=>({requestId:String(body.requestId),authorization:'denied',scheduled:false,enabled:false,hour:null,minute:null}));
    expect(await createReminderBridge({postMessage}).disable()).toEqual({authorization:'denied',scheduled:false,enabled:false,hour:null,minute:null});
    expect(postMessage.mock.calls[0][0].action).toBe('disable');
  });
  it('rejects mismatched replies',async()=>{
    await expect(createReminderBridge({postMessage:async()=>({...state,requestId:'stale'})}).status()).rejects.toThrow('unexpected');
  });
  it('times out without pretending a native mutation was cancelled',async()=>{
    vi.useFakeTimers();
    try{
      const promise=createReminderBridge({postMessage:()=>new Promise(()=>undefined)},500).enable(9,0);
      const expectation=expect(promise).rejects.toThrow('Check the reminder status');
      await vi.advanceTimersByTimeAsync(500);
      await expectation;
    }finally{vi.useRealTimers();}
  });
  it('web preview never fakes scheduling',async()=>{
    const bridge=createReminderBridge(null);
    expect(bridge.available).toBe(false);
    await expect(bridge.enable(9,0)).rejects.toThrow('installed iPhone');
  });
  it('validates native status before displaying it',()=>{
    expect(()=>parseReminderStatus({...state,requestId:'a',authorization:'denied'})).toThrow();
    expect(()=>parseReminderStatus({...state,requestId:'a',minute:60})).toThrow();
    expect(parseReminderStatus({...state,requestId:'a',authorization:'denied',enabled:false})).toMatchObject({scheduled:true,enabled:false});
  });
});
