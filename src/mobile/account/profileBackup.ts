import type { ProfileInputs } from '../../../lib/profile/storage';

export interface ProfileBackup { format:'oracle-birthday'; version:1; exportedAt:string; inputs:ProfileInputs }
export function createProfileBackup(inputs:ProfileInputs, now = new Date()):string {
  return JSON.stringify({format:'oracle-birthday',version:1,exportedAt:now.toISOString(),inputs},null,2);
}
export function readProfileBackup(text:string):ProfileInputs {
  if (text.length > 100000) throw new Error('This backup is too large. Choose an Oracle Birthday backup.');
  let value:any;
  try { value=JSON.parse(text); } catch { throw new Error('This is not a readable Oracle Birthday backup.'); }
  const x=value?.inputs, p=x?.place;
  if (value?.format !== 'oracle-birthday' || value?.version !== 1 || !x || !p ||
    typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) ||
    typeof x.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) ||
    typeof p.label !== 'string' || !p.label.trim() || p.label.length > 500 ||
    typeof p.tzId !== 'string' || typeof p.lat !== 'number' || !Number.isFinite(p.lat) || Math.abs(p.lat)>90 ||
    typeof p.lng !== 'number' || !Number.isFinite(p.lng) || Math.abs(p.lng)>180) throw new Error('The backup is missing valid birth details.');
  const date=new Date(x.date+'T12:00:00Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==x.date) throw new Error('The backup contains an invalid birth date.');
  try { new Intl.DateTimeFormat('en',{timeZone:p.tzId}).format(date); } catch { throw new Error('The backup contains an unknown time zone.'); }
  // Reconstruct only the allowed inputs. Recompute all chart values on restore.
  return {date:x.date,time:x.time,place:{label:p.label,lat:p.lat,lng:p.lng,tzId:p.tzId}};
}
