/** Minutes and seconds, as the recording clock and the playback bar show them. */
export const time=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;

/** "1 section", "2 sections". */
export const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':'s'}`;
