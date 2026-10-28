import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OracleAudioPlayer from '../../src/mobile/listening/OracleAudioPlayer';
import { boundedSeek, createAudioSleepTimer, formatAudioTime, publishedRecordingSource, type PublishedOracleRecording } from '../../src/mobile/listening/playback';

const recording: PublishedOracleRecording = {id:'published-29-v1',cardNumber:29,title:'All In',sourceUrl:'https://mandalacodes.com/listening/29-v1.m4a',publishedAt:'2026-10-28T08:00:00Z',publication:'approved-public-listening'};
afterEach(() => vi.useRealTimers());
describe('published Oracle listening', () => {
  it('does not fetch or preload a recording before the listener presses Play', () => {
    const html = renderToStaticMarkup(React.createElement(OracleAudioPlayer,{cardNumber:29,recording}));
    expect(html).toContain('preload="none"');
    expect(html).not.toContain('src=');
    expect(html).not.toContain('autoPlay');
    expect(html).not.toContain(recording.sourceUrl);
  });
  it('shows an honest empty state when no recording exists', () => {
    const html = renderToStaticMarkup(React.createElement(OracleAudioPlayer,{cardNumber:29}));
    expect(html).toContain('No listening recording has been published');
    expect(html).not.toContain('<audio');
    expect(html).not.toContain('Play recording');
  });
  it('never falls back to private dictation media or a different card', () => {
    expect(publishedRecordingSource(recording,1)).toBeNull();
    expect(publishedRecordingSource({...recording,sourceUrl:'https://mandalacodes.com/api/oracle/reflections/segments/secret/audio'},29)).toBeNull();
    expect(publishedRecordingSource({...recording,sourceUrl:'blob:https://mandalacodes.com/source'},29)).toBeNull();
    expect(publishedRecordingSource({...recording,sourceUrl:'javascript:alert(1)'},29)).toBeNull();
    expect(publishedRecordingSource({...recording,publishedAt:''},29)).toBeNull();
    expect(publishedRecordingSource(recording,29)).toBe(recording.sourceUrl);
  });
  it('stops once at the selected deadline and cancels replaced timers', () => {
    vi.useFakeTimers(); const expire=vi.fn(); const timer=createAudioSleepTimer(expire);
    timer.arm(5); vi.advanceTimersByTime(60_000); timer.arm(15);
    vi.advanceTimersByTime(4*60_000); expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(11*60_000); expect(expire).toHaveBeenCalledTimes(1);
    timer.check(); expect(expire).toHaveBeenCalledTimes(1); expect(timer.deadline()).toBeNull();
  });
  it('catches a sleep deadline on resuming and cancels on cleanup', () => {
    vi.useFakeTimers(); const expire=vi.fn(); const timer=createAudioSleepTimer(expire);
    timer.arm(5); vi.setSystemTime(Date.now()+6*60_000); timer.check(); expect(expire).toHaveBeenCalledTimes(1);
    timer.arm(30); timer.cancel(); vi.advanceTimersByTime(31*60_000); expect(expire).toHaveBeenCalledTimes(1);
  });
  it('bounds seeks and formats unknown media times safely', () => {
    expect(boundedSeek(120,60)).toBe(60); expect(boundedSeek(-10,60)).toBe(0); expect(boundedSeek(30,Infinity)).toBe(0);
    expect(formatAudioTime(61.9)).toBe('1:01'); expect(formatAudioTime(NaN)).toBe('0:00');
  });
});
