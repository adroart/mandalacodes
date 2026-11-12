/** Browser storage health. Pure and safe to import anywhere: every call checks the API exists first. */
export interface StorageUsage {usedBytes:number;quotaBytes:number;persisted:boolean}
type StorageApi=Pick<StorageManager,'persist'|'persisted'|'estimate'>;
const api=():Partial<StorageApi>|undefined=>typeof navigator==='undefined'?undefined:(navigator as Navigator&{storage?:Partial<StorageApi>}).storage;
let asked:Promise<boolean>|undefined;
/** Ask once per app run to keep this origin's data under storage pressure. The answer is remembered. */
export function requestPersistence():Promise<boolean>{
 asked??=(async()=>{const storage=api();if(!storage?.persist)return false;try{if(await storage.persisted?.())return true;return await storage.persist();}catch{return false;}})();
 return asked;
}
/** Test seam: forget the remembered answer. */
export function resetPersistenceRequest(){asked=undefined;}
export async function storageUsage():Promise<StorageUsage|null>{
 const storage=api();if(!storage?.estimate)return null;
 try{const estimate=await storage.estimate(),persisted=await (storage.persisted?.()??Promise.resolve(false)).catch(()=>false);
  if(!Number.isFinite(estimate.usage)||!Number.isFinite(estimate.quota))return null;
  return {usedBytes:estimate.usage!,quotaBytes:estimate.quota!,persisted};}catch{return null;}
}
/** Decimal megabytes and gigabytes, as a phone's own settings show them. */
export function formatBytes(bytes:number):string{
 if(bytes>=1e9)return `${(bytes/1e9).toFixed(1)} GB`;
 return `${Math.max(0,Math.round(bytes/1e6))} MB`;
}
export function storageLine(usage:StorageUsage):string{
 return `This phone is holding ${formatBytes(usage.usedBytes)} of recordings and writing. ${formatBytes(Math.max(0,usage.quotaBytes-usage.usedBytes))} free.`;
}
