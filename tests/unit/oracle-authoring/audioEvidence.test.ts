import {expect,it} from 'vitest';
import {recordingAudioSession} from '../../../lib/oracle/authoring/audioEvidence';
it('resolves section and phrase receipts to their durable audio sessions while retaining legacy evidence',()=>{
 const draft={captureSessionId:'original-audio',takes:[{captureId:'phrase',captureSessionId:'phrase-audio'},{captureId:'original'}]};
 expect(recordingAudioSession(draft,'editorial-draft','phrase')).toBe('phrase-audio');
 expect(recordingAudioSession(draft,'editorial-draft','original')).toBe('original-audio');
 expect(recordingAudioSession(undefined,'legacy-audio','original')).toBe('legacy-audio');
});
