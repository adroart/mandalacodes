import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {requestPersistence,resetPersistenceRequest,storageUsage,storageLine,formatBytes} from '../../../src/mobile/authoring/storageHealth';
const fakeStorage=(over:Record<string,unknown>={})=>({persist:vi.fn(async()=>true),persisted:vi.fn(async()=>false),estimate:vi.fn(async()=>({usage:240e6,quota:3.34e9})),...over});
describe('storage health',()=>{
 beforeEach(()=>resetPersistenceRequest());
 afterEach(()=>vi.unstubAllGlobals());
 it('asks for persistent storage once and remembers the answer',async()=>{const storage=fakeStorage();vi.stubGlobal('navigator',{storage});expect(await requestPersistence()).toBe(true);expect(await requestPersistence()).toBe(true);expect(storage.persist).toHaveBeenCalledTimes(1);});
 it('does not ask again when storage is already persistent',async()=>{const storage=fakeStorage({persisted:vi.fn(async()=>true)});vi.stubGlobal('navigator',{storage});expect(await requestPersistence()).toBe(true);expect(storage.persist).not.toHaveBeenCalled();});
 it('reports usage with the persistence state',async()=>{vi.stubGlobal('navigator',{storage:fakeStorage({persisted:vi.fn(async()=>true)})});expect(await storageUsage()).toEqual({usedBytes:240e6,quotaBytes:3.34e9,persisted:true});});
 it('is safe where the API is missing',async()=>{vi.stubGlobal('navigator',{});expect(await requestPersistence()).toBe(false);expect(await storageUsage()).toBeNull();resetPersistenceRequest();vi.stubGlobal('navigator',undefined);expect(await requestPersistence()).toBe(false);expect(await storageUsage()).toBeNull();});
 it('is safe when the browser refuses',async()=>{vi.stubGlobal('navigator',{storage:fakeStorage({persist:vi.fn(async()=>{throw Error('no');}),estimate:vi.fn(async()=>{throw Error('no');})})});expect(await requestPersistence()).toBe(false);expect(await storageUsage()).toBeNull();});
 it('works without persisted()',async()=>{vi.stubGlobal('navigator',{storage:{estimate:async()=>({usage:1e6,quota:2e9})}});expect(await storageUsage()).toEqual({usedBytes:1e6,quotaBytes:2e9,persisted:false});});
 it('says space in megabytes and gigabytes',()=>{expect(formatBytes(240e6)).toBe('240 MB');expect(formatBytes(3.1e9)).toBe('3.1 GB');expect(storageLine({usedBytes:240e6,quotaBytes:3.34e9,persisted:true})).toBe('This phone is holding 240 MB of recordings and writing. 3.1 GB free.');expect(storageLine({usedBytes:240e6,quotaBytes:3.34e9,persisted:true})).not.toMatch(/MiB|GiB/);});
});
