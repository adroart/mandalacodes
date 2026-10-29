/** Editorial receipt IDs and durable audio IDs are distinct in the voice studio. */
export function recordingAudioSession(draft:{captureSessionId?:string;takes?:{captureId:string;captureSessionId?:string}[]}|undefined,receiptSessionId:string,captureId:string):string{
 return draft?.takes?.find(take=>take.captureId===captureId)?.captureSessionId??draft?.captureSessionId??receiptSessionId;
}
