export interface ReminderStatus {
  authorization:'notDetermined'|'denied'|'authorized'|'provisional'|'ephemeral'|'unknown';
  scheduled:boolean;
  enabled:boolean;
  hour:number|null;
  minute:number|null;
}
interface Reply { requestId:string; authorization?:unknown; scheduled?:unknown; enabled?:unknown; hour?:unknown; minute?:unknown; opened?:unknown }
export interface ReminderHandler {postMessage:(body:Record<string,unknown>)=>Promise<Reply>}
export function installedReminderHandler():ReminderHandler|null {
  if(typeof window==='undefined' || window.location.protocol!=='capacitor:' || window.location.hostname!=='localhost')return null;
  const handler=(window as any).webkit?.messageHandlers?.oracleReminders;
  return typeof handler?.postMessage==='function' ? handler : null;
}
function validTime(hour:unknown,minute:unknown):boolean {
  return Number.isInteger(hour) && Number.isInteger(minute) && Number(hour)>=0 && Number(hour)<=23 && Number(minute)>=0 && Number(minute)<=59;
}
export function parseReminderStatus(reply:Reply):ReminderStatus {
  if(!['notDetermined','denied','authorized','provisional','ephemeral','unknown'].includes(String(reply.authorization)) ||
    typeof reply.scheduled!=='boolean' || typeof reply.enabled!=='boolean' ||
    (reply.scheduled && !validTime(reply.hour,reply.minute)) ||
    (reply.enabled && (!reply.scheduled || !['authorized','provisional','ephemeral'].includes(String(reply.authorization))))) {
    throw new Error('Oracle could not read the reminder status. Please check again.');
  }
  return {authorization:reply.authorization as ReminderStatus['authorization'],scheduled:reply.scheduled,enabled:reply.enabled,hour:reply.scheduled?Number(reply.hour):null,minute:reply.scheduled?Number(reply.minute):null};
}
/** WebKit's reply handler returns a Promise to this exact caller. There is no
 * global response event for another frame or stale request to impersonate. */
export function createReminderBridge(handler:ReminderHandler|null=installedReminderHandler(),timeoutMs=90000) {
  async function send(action:string,extra:Record<string,unknown>={}):Promise<Reply> {
    if(!handler)throw new Error('Daily reminders are available in the installed iPhone app.');
    const requestId=crypto.randomUUID();
    let timer:ReturnType<typeof setTimeout>;
    try {
      const reply=await Promise.race([
        Promise.resolve().then(()=>handler.postMessage({requestId,action,...extra})),
        new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Oracle could not confirm the change. Check the reminder status before trying again.')),timeoutMs);}),
      ]);
      if(!reply || reply.requestId!==requestId)throw new Error('Oracle received an unexpected reminder reply.');
      return reply;
    } finally {clearTimeout(timer!);}
  }
  return {
    available:!!handler,
    status:async()=>parseReminderStatus(await send('status')),
    enable:async(hour:number,minute:number)=>{
      if(!validTime(hour,minute))throw new Error('Choose a valid reminder time.');
      return parseReminderStatus(await send('enable',{hour,minute}));
    },
    disable:async()=>parseReminderStatus(await send('disable')),
    openSettings:async()=>{const reply=await send('settings');if(reply.opened!==true)throw new Error('Settings could not be opened.');},
  };
}
