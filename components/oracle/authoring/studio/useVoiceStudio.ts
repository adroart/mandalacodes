import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthoringStore, type SavedSession } from '../../../../lib/oracle/authoring/storage';
import { createSession } from '../../../../lib/oracle/authoring/workflow';
import { importAudio } from '../../../../lib/oracle/authoring/recorder';
import { cardSections, displaySectionTitle, type CardSection } from '../../../../lib/oracle/authoring/cardSections';
import { SectionDraftStore, sectionTitleEdits, createSectionDraftSession, integrateSectionDraft, sectionComparisonOriginal, sectionReviewExceptions, type SectionDraftSession, type SectionDraftResult } from '../../../../lib/oracle/authoring/sectionDrafts';
import { changeSectionSession, processSectionSession, currentSectionTexts } from '../../../../src/mobile/authoring/sectionWorkflow';
import { currentNamedReaderSection } from '../../../../src/mobile/authoring/readerContext';
import { getSynthesis } from '../../../../data/synthesisData';
import { replaceComparisonPassage, buildPassageComparison, comparisonRows, readingParagraphs, type PassageChoice } from '../../../../lib/oracle/authoring/passageComparison';
import { queueSectionTake, discardSectionTake, recoverInterruptedRecordings, withRecordingDestination, type TakeSession, type RecordingDestination } from '../../../../src/mobile/authoring/sectionTakes';
import { buildWordReplay, activeReplayWord, type ReplayWord } from '../../../../lib/oracle/authoring/wordReplay';
import { focusedVoiceSections } from '../../../../src/mobile/authoring/focusSections';
import { startVoiceCapturePass, type VoiceCapturePass } from '../../../../src/mobile/authoring/voiceCapturePass';
import { startVoiceRouting, voiceRoutingDefault, type VoiceRouteEvidence, type VoiceRoutingStatus } from '../../../../src/mobile/authoring/voiceCaptureRouting';
import { useRecordingHealth } from './useRecordingHealth';
import { phraseReplayBounds, type VoiceReplayBounds } from '../../../../src/mobile/authoring/voiceTargets';
import { enqueueVoicePhraseRevision } from '../../../../src/mobile/authoring/voicePhraseRevision';
import { WorkingCardStore } from '../../../../lib/oracle/authoring/humanDrafts';
import { useSendToCard } from './useSendToCard';
import { cardSectionAuthorship, readingOriginSpans, namedSectionOriginSpans } from '../../../../lib/oracle/authoring/sectionAuthorship';
import { useAccount } from '../../../../lib/account/useAccount';
import { useNativeAccountActions } from '../../../../src/mobile/account/NativeAccountProvider';
import { isSignInBlocked, resumeSignInBlockedRecordings } from '../../../../src/mobile/authoring/accountRecovery';
import { plural } from './format';
import { useCheckAudio } from './useCheckAudio';
import { correctedQuote } from '../../../../src/mobile/authoring/knownWordFixes';
import type { StudioProps, Tone, View } from './types';
/** The processing summary of timed mishearings is not repeated beside the timed words themselves.
 * An issue is settled once its exact quote is gone from the human words or the speaker confirms it. */
const bare = (quote: string) => quote.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || quote;
const issueKeys = (result: SectionDraftResult) => [...(result.reviewIssues ?? []).map((issue, index) => ({ key: `i${index}/${issue.start}`, quote: bare(issue.quote), message: issue.message, issue })), ...result.warnings.filter(warning => !(result.reviewIssues?.length && /^Check possible mishearings/.test(warning))).map((warning, index) => ({ key: `w${index}`, quote: /[“"]([^”"]+)[”"]/.exec(warning)?.[1], message: warning, issue: undefined }))];
const quoted = (text: string, quote?: string) => !quote || new RegExp(`(^|[^\\p{L}])${quote.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu').test(text);
/**
 * Every piece of state, every ref, every effect and every action of the voice studio, in the order
 * the single component used to declare them. The screens under `studio/` only render what this returns.
 */
export function useVoiceStudio({ source, services, sectionId, onClose, onEarlier, namedSectionId, initialAnchors, onNavigateCard, initialSessionId }: StudioProps) {
    const account = useAccount();
    const accountActions = useNativeAccountActions();
    const [retrying, setRetrying] = useState(false);
    const store = useMemo(() => new SectionDraftStore(), []);
    const audio = useMemo(() => new AuthoringStore(), []);
    const workingStore = useMemo(() => new WorkingCardStore(), []);
    const [authorship, setAuthorship] = useState<ReturnType<typeof cardSectionAuthorship>>();
    const [authorshipFailed, setAuthorshipFailed] = useState(false);
    const [appliedOrigins, setAppliedOrigins] = useState<Record<string, ReturnType<typeof readingOriginSpans>>>({});
    const [draft, setDraft] = useState<SectionDraftSession>();
    const [savedAudio, setSavedAudio] = useState<SavedSession>();
    const [focusId, setFocusId] = useState('');
    const [targetId, setTargetId] = useState('');
    const [error, setError] = useState('');
    const [opening, setOpening] = useState(false);
    const [integrating, setIntegrating] = useState(false);
    const [active, setActive] = useState<VoiceCapturePass | null>(null);
    const [monitor, setMonitor] = useState({ elapsed: 0, paused: false, level: null as number | null });
    const [audioUrl, setAudioUrl] = useState('');
    const [history, setHistory] = useState<SectionDraftSession[]>([]);
    const [view, setView] = useState<View>('work');
    const seekAt = useRef(0);
    const clipBounds = useRef<VoiceReplayBounds | null>(null);
    const loopCleanup = useRef<(() => void) | null>(null);
    const [continuous, setContinuous] = useState(() => localStorage.getItem('oracle.voice.continuous') === 'true');
    const [voiceCommands, setVoiceCommands] = useState(() => voiceRoutingDefault());
    const [routingStatus, setRoutingStatus] = useState<VoiceRoutingStatus>('stopped');
    const [intent, setIntent] = useState<'auto' | 'replace' | 'add' | 'revise'>('auto');
    const [loop, setLoop] = useState(false);
    const [notice, setNotice] = useState('');
    const [linkedDrafts, setLinkedDrafts] = useState<SectionDraftSession[]>([]);
    const [phrase, setPhrase] = useState<{
        sectionId: string;
        from: number;
        to: number;
        text: string;
        baseText: string;
    } | null>(null);
    const [paragraphAim, setParagraphAim] = useState<{
        sectionId: string;
        start: number;
        end: number;
        text: string;
    } | null>(null);
    const focusByCapture = useRef(new Map<string, {
        start: number;
        end: number;
        text: string;
    } | undefined>());
    const captureFocus = useRef<{
        start: number;
        end: number;
        text: string;
    } | undefined>();
    const [resolved, setResolved] = useState<Record<string, true>>({});
    const [placing, setPlacing] = useState<number | null>(null);
    const [caret, setCaret] = useState<number | undefined>();
    const [playhead, setPlayhead] = useState(0);
    const phraseCapture = useRef<typeof phrase>(null);
    const pickerReturn = useRef<'work' | 'unplaced' | 'review'>('work');
    const explicitChoice = useRef(false);
    const reviewArrival = useRef(false);
    const continuation = useRef<string | undefined>();
    const nextContinuation = useRef<string | undefined>();
    const resumePlayback = useRef<{
        captureId: string;
        positionMs: number;
    } | null>(null);
    const routeConfig = useRef<Parameters<typeof startVoiceRouting>[0] | null>(null);
    const routeHandle = useRef<ReturnType<typeof startVoiceRouting> | null>(null);
    const captureTarget = useRef('');
    const segmentStart = useRef(0);
    const markers = useRef<{
        atMs: number;
        sectionId: string;
    }[]>([]);
    const pendingNext = useRef<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const manuscript = useRef<HTMLDivElement>(null);
    const player = useRef<HTMLAudioElement>(null);
    const recordingTarget = useRef('');
    const stopMode = useRef<'next' | 'review'>('review');
    const [stopping, setStopping] = useState(false);
    const [replay, setReplay] = useState<{
        text: string;
        words: ReplayWord[];
        captureId: string;
    } | null>(null);
    const [activeWord, setActiveWord] = useState(-1);
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [references, setReferences] = useState<Record<string, string>>({});
    /** Latest application of each section across every session; an undo clears its integration. */
    const [authored, setAuthored] = useState<Record<string, {
        human: boolean;
        add: boolean;
        sessionId: string;
    }>>({});
    const current = useRef(draft);
    const handle = useRef<VoiceCapturePass | null>(null);
    const mounted = useRef(true);
    const pending = useRef(Promise.resolve());
    const failed = useRef(false);
    current.current = draft;
    const accept = (value: SectionDraftSession) => {
        if (current.current?.id === value.id && current.current.version > value.version)
            return;
        current.current = value;
        if (mounted.current)
            setDraft(value);
    };
    const errorDetail = useRef<{
        message: string;
        detail: string;
    } | null>(null);
    const report = (e: unknown) => {
        if (!mounted.current)
            return;
        const message = e instanceof Error ? e.message : 'Your recording is saved. Try again.';
        const detail = e && typeof e === 'object' && 'detail' in e ? String((e as {
            detail?: unknown;
        }).detail ?? '') : '';
        errorDetail.current = detail ? { message, detail } : null;
        setError(message);
    };
    const loadAudio = async (value: SectionDraftSession) => {
        if (value.captureSessionId) {
            const loaded = await audio.load(value.captureSessionId);
            if (mounted.current && current.current?.id === value.id)
                setSavedAudio(loaded ?? undefined);
        }
        else if (mounted.current)
            setSavedAudio(undefined);
    };
    const recovering = useRef<Promise<unknown>>(Promise.resolve());
    const liveCapture = useRef('');
    /** Closes a recording cut off by a reload or a killed app and sends it on like a finished one. */
    const recoverInterrupted = async (id: string) => {
        const recovered = await recoverInterruptedRecordings(id, services);
        if (recovered.session)
            accept(recovered.session);
        if (recovered.queued || recovered.saved) {
            if (recovered.session)
                await loadAudio(recovered.session);
            if (mounted.current)
                setNotice(recovered.queued ? 'A recording that was interrupted has been saved and is being prepared.' : 'A recording that was interrupted has been saved. You can listen to it in Recording settings, under Recordings and transcript.');
        }
        return recovered;
    };
    const reveal = (id: string, smooth = false) => {
        const root = manuscript.current;
        const element = root?.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`);
        if (root && element)
            root.scrollTo({ top: Math.max(0, element.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 4), behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
    };
    const make = async () => {
        await pending.current;
        if (failed.current)
            throw Error('Save your current words before starting another session.');
        const synthesis = await getSynthesis(source.cardNumber);
        const allNodes = cardSections(source, synthesis?.summary);
        const nodes = initialAnchors?.length ? focusedVoiceSections(source, allNodes, initialAnchors) : allNodes;
        const visible = namedSectionId ?? currentNamedReaderSection(nodes);
        const start = nodes.find(s => s.id === visible) ?? (sectionId === 'CODE' ? nodes[0] : nodes.find(s => s.lensId === sectionId)) ?? nodes[0];
        const value = await store.save(createSectionDraftSession(source, nodes, start.id), 0);
        accept(value);
        setFocusId(start.id);
        setTargetId(start.id);
        setSavedAudio(undefined);
        setView('work');
        return value;
    };
    useEffect(() => {
        mounted.current = true;
        let alive = true;
        void (async () => {
            const previous = initialSessionId ? await store.get(initialSessionId) : (await store.list(source.cardNumber)).find(s => s.sourceHash === source.hash && s.state !== 'complete' && (!initialAnchors?.length || s.sections.length === initialAnchors.filter(anchor => anchor.cardNumber === source.cardNumber).length && s.sections.every(node => initialAnchors.some(anchor => anchor.cardNumber === source.cardNumber && anchor.text === node.text && anchor.sectionText === node.sectionText && anchor.start === node.start))));
            if (!alive)
                return;
            if (previous && previous.sourceHash === source.hash) {
                accept(previous);
                // Opening Record aims at what was being read; an older resume point never silently wins.
                const reading = namedSectionId && previous.sections.some(n => n.id === namedSectionId) ? namedSectionId : undefined;
                setTargetId(reading ?? previous.resume?.sectionId ?? previous.startSectionId);
                setFocusId(initialSessionId ? previous.results[0]?.sectionId ?? previous.startSectionId : reading ?? previous.resume?.sectionId ?? previous.results[0]?.sectionId ?? previous.startSectionId);
                if (initialSessionId)
                    setView('review');
                await loadAudio(previous);
                recovering.current = recoverInterrupted(previous.id).catch(report);
                await recovering.current;
                if (['transcribing', 'assimilating'].includes(previous.state))
                    void processSectionSession(previous.id, services).catch(report);
            }
            else
                await make();
        })().catch(report);
        const unsubscribe = store.subscribe(() => {
            const id = current.current?.id;
            if (id)
                void store.get(id).then(value => {
                    if (value && current.current?.id === id && value.version >= (current.current?.version ?? 0)) {
                        accept(value);
                        void loadAudio(value);
                    }
                }).catch(report);
        });
        return () => {
            alive = false;
            mounted.current = false;
            unsubscribe();
            routeHandle.current?.stop();
            loopCleanup.current?.();
            void handle.current?.stop();
        };
    }, [source.cardNumber]);
    useEffect(() => {
        if (!active)
            return;
        const tick = () => setMonitor({ elapsed: active.elapsed(), paused: active.state() === 'paused', level: active.level() });
        const timer = setInterval(tick, 150);
        const before = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', before);
        return () => {
            clearInterval(timer);
            window.removeEventListener('beforeunload', before);
        };
    }, [active]);
    useEffect(() => () => {
        if (audioUrl)
            URL.revokeObjectURL(audioUrl);
    }, [audioUrl]);
    const nodes = draft?.sections ?? [];
    const review = view === 'review';
    const processing = draft?.state === 'transcribing' || draft?.state === 'assimilating';
    const section = nodes.find(s => s.id === focusId) ?? nodes.find(s => s.id === draft?.startSectionId) ?? nodes[0];
    const result = draft?.results.find(r => r.sectionId === section?.id);
    const results = draft?.results ?? [];
    const target = nodes.find(n => n.id === targetId) ?? nodes.find(n => n.id === draft?.startSectionId) ?? nodes[0];
    const prepare = async (id: string) => {
        try {
            await processSectionSession(id, services);
            const value = await store.get(id);
            if (value && mounted.current) {
                accept(value);
                setFocusId(value.results[0]?.sectionId ?? value.startSectionId);
                setView('review');
                await loadAudio(value);
            }
        }
        catch (e) {
            report(e);
        }
    };
    const patch = async (change: (s: SectionDraftSession) => SectionDraftSession) => {
        if (!current.current)
            throw Error('Wait for your card to open.');
        const value = await changeSectionSession(current.current.id, change);
        accept(value);
        return value;
    };
    const stopListening = () => {
        const at = replay?.words[activeWord]?.from;
        player.current?.pause();
        loopCleanup.current?.();
        loopCleanup.current = null;
        clipBounds.current = null;
        setReplay(null);
        setActiveWord(-1);
        setAudioUrl('');
        setPlaying(false);
        setCaret(at);
    };
    const choose = async (id: string) => {
        explicitChoice.current = true;
        await flush();
        setFocusId(id);
        setPhrase(null);
        if (audioUrl)
            stopListening();
    };
    /** Aiming never starts the microphone and never moves while a recording is running. */
    const aim = (id: string, scroll = false) => {
        if (handle.current || opening)
            return;
        setTargetId(id);
        setFocusId(id);
        setParagraphAim(null);
        setError('');
        if (scroll)
            requestAnimationFrame(() => reveal(id, true));
    };
    /** A section applied in an earlier session reopens that session, where its undo lives. */
    const openApplied = async (id: string) => {
        const sessionId = results.some(r => r.sectionId === id) ? undefined : authored[id]?.sessionId;
        if (sessionId && sessionId !== draft?.id) {
            await flush();
            const value = await store.get(sessionId);
            if (!value)
                return;
            accept(value);
            await loadAudio(value);
        }
        reviewAt(id);
    };
    /** Only this paragraph can change; its neighbours stay whatever is said. */
    const aimParagraph = (id: string, paragraph: {
        start: number;
        end: number;
        text: string;
    }) => {
        if (handle.current || opening)
            return;
        setTargetId(id);
        setFocusId(id);
        setParagraphAim({ sectionId: id, ...paragraph });
        setError('');
    };
    const reviewAt = (id: string) => {
        explicitChoice.current = true;
        setFocusId(id);
        setPhrase(null);
        if (audioUrl)
            stopListening();
        setView('review');
    };
    const record = async (phraseTarget: typeof phrase = null, targetSection = targetId) => {
        if (!current.current || opening || handle.current || stopping)
            return;
        setOpening(true);
        explicitChoice.current = false;
        setError('');
        setNotice('');
        setView('work');
        setReplay(null);
        player.current?.pause();
        setAudioUrl('');
        try {
            await flush();
            if (phraseTarget && current.current?.results.find(r => r.sectionId === phraseTarget.sectionId)?.text !== phraseTarget.baseText)
                throw Error('Those words changed. Select the phrase again.');
            if (intent === 'revise' && !phraseTarget && !initialAnchors?.length)
                throw Error('Select the exact words to revise first.');
            // Anything left mid-recording by a reload or a killed app is closed and sent on before the microphone opens.
            await recovering.current;
            await recoverInterrupted(current.current!.id);
            let value = current.current!;
            phraseCapture.current = phraseTarget;
            let saved = value.captureSessionId ? await audio.load(value.captureSessionId) : null;
            if (!saved) {
                const session = createSession(source);
                saved = { session, version: await audio.save(session, 0) };
            }
            // Interrupted recordings were closed just above; this only guards a recording still running in another window.
            if (saved.session.captures.some(c => c.status === 'recording'))
                throw Error('A recording is still being saved in another window. Close it there, then try again.');
            const target = value.sections.find(s => s.id === targetSection) ?? value.sections.find(s => s.id === value.startSectionId)!;
            captureFocus.current = !phraseTarget && paragraphAim?.sectionId === target.id ? { start: paragraphAim.start, end: paragraphAim.end, text: paragraphAim.text } : undefined;
            continuation.current = undefined;
            nextContinuation.current = undefined;
            recordingTarget.current = target.id;
            captureTarget.current = target.id;
            markers.current = [{ atMs: 0, sectionId: target.id }];
            pendingNext.current = null;
            stopMode.current = 'review';
            value = await changeSectionSession(value.id, s => ({ ...s, captureSessionId: saved!.session.id }));
            accept(value);
            const id = value.id;
            const recorder = await startVoiceCapturePass(audio, saved, target.lensId === 'INTRO' ? 'CODE' : target.lensId, report, source.cardNumber, {
                continuous: phraseTarget ? false : continuous, rollOnBoundary: !phraseTarget,
                onActive: captureId => {
                    focusByCapture.current.set(captureId, captureFocus.current);
                    continuation.current = nextContinuation.current;
                    nextContinuation.current = undefined;
                    captureTarget.current = recordingTarget.current;
                    segmentStart.current = handle.current?.elapsed() ?? 0;
                    markers.current = [{ atMs: 0, sectionId: captureTarget.current }];
                    liveCapture.current = captureId;
                    // Saved as it starts, so a recording cut off by a reload or a killed app still reaches this section.
                    const destination: RecordingDestination | undefined = phraseCapture.current ? undefined : { captureId, sectionId: captureTarget.current, markers: [...markers.current], intent: intent === 'auto' ? undefined : intent, focus: captureFocus.current, continuationOf: continuation.current };
                    void changeSectionSession(id, s => withRecordingDestination({ ...s, state: 'recording', captureId, error: undefined } as TakeSession, destination)).then(accept).catch(report);
                },
                onSegmentReady: async (savedTake, captureId, metadata) => {
                    const finished = savedTake.session.captures.find(c => c.id === captureId);
                    if (!finished || finished.status === 'empty' || finished.durationMs <= 0)
                        return;
                    await changeSectionSession(id, s => ({ ...s, state: 'ready' }));
                    if (phraseCapture.current) {
                        const selected = phraseCapture.current;
                        const queued = await enqueueVoicePhraseRevision({ draftId: id, sectionId: selected.sectionId, from: selected.from, to: selected.to, baseText: selected.baseText, captureSessionId: savedTake.session.id, captureId }, services);
                        accept(queued);
                        setPhrase(null);
                        phraseCapture.current = null;
                        return;
                    }
                    const queued = await queueSectionTake(id, captureId, captureTarget.current, services, markers.current, { intent: intent === 'auto' ? undefined : intent, continuationOf: continuation.current, focus: focusByCapture.current.get(captureId) });
                    nextContinuation.current = metadata.reason === 'boundary' ? captureId : undefined;
                    if (current.current?.id === id) {
                        accept(queued);
                        await loadAudio(queued);
                    }
                    if (pendingNext.current) {
                        recordingTarget.current = pendingNext.current;
                        setFocusId(pendingNext.current);
                        setTargetId(pendingNext.current);
                        reveal(pendingNext.current);
                        pendingNext.current = null;
                    }
                },
                onProcessingFailure: report,
                onInterruption: state => health.onInterruption(state),
            });
            // The workspace closed while the microphone was opening: nothing here could stop this pass later.
            if (!mounted.current) {
                void recorder.stop().catch(() => undefined);
                return;
            }
            handle.current = recorder;
            setActive(recorder);
            setMonitor({ elapsed: 0, paused: false, level: null });
            setFocusId(target.id);
            setTargetId(target.id);
            routeConfig.current = { sections: value.sections.map(node => ({ id: node.id, title: node.title, aliases: [titleFor(node), node.title.split(/\s+[\u2014\u2013]\s+/)[0], ...(node.id === value.sections[0].id ? ['intro'] : [])] })), currentSectionId: () => recordingTarget.current, elapsed: () => recorder.takeElapsed(), onStatus: setRoutingStatus, onRoute: (event: VoiceRouteEvidence) => {
                    const node = value.sections.find(n => n.id === event.sectionId);
                    if (!node)
                        return;
                    markers.current.push({ atMs: event.atMs, sectionId: node.id });
                    const live = liveCapture.current;
                    const spoken = [...markers.current];
                    void changeSectionSession(id, s => {
                        const r = (s as TakeSession).recording;
                        return r?.captureId === live ? { ...s, recording: { ...r, markers: spoken } } as TakeSession : s;
                    }).catch(() => undefined);
                    recordingTarget.current = node.id;
                    captureFocus.current = undefined;
                    setParagraphAim(null);
                    recorder.mark(node.lensId === 'INTRO' ? 'CODE' : node.lensId);
                    setFocusId(node.id);
                    setTargetId(node.id);
                    reveal(node.id, true);
                    setNotice(`Heard “${shownTitle(node)}”. Recording into it now.`);
                } };
            if (voiceCommands && !phraseTarget)
                routeHandle.current = startVoiceRouting(routeConfig.current);
            void recorder.completion.then(async () => {
                routeHandle.current?.stop();
                routeHandle.current = null;
                handle.current = null;
                const latest = await changeSectionSession(id, s => ({ ...s, state: s.results.length ? 'review' : 'ready' }));
                accept(latest);
                if (mounted.current) {
                    setActive(null);
                    setStopping(false);
                    if (stopMode.current === 'next')
                        setView('work');
                    else {
                        explicitChoice.current = true;
                        setFocusId(recordingTarget.current);
                        setView('review');
                    }
                }
            }).catch(e => {
                handle.current = null;
                routeHandle.current?.stop();
                if (mounted.current) {
                    setActive(null);
                    setStopping(false);
                }
                report(e);
            });
        }
        catch (e) {
            report(e);
        }
        finally {
            setOpening(false);
        }
    };
    const stop = (mode: 'next' | 'review') => {
        const capture = handle.current;
        if (!capture || stopping)
            return;
        stopMode.current = mode;
        if (mode === 'review')
            reviewArrival.current = true;
        setStopping(true);
        if (mode === 'next' && !phraseCapture.current) {
            const index = nodes.findIndex(node => node.id === recordingTarget.current);
            const next = nodes[index + 1];
            pendingNext.current = next?.id ?? null;
            captureFocus.current = undefined;
            setParagraphAim(null);
            if (next) {
                setTargetId(next.id);
                reveal(next.id, true);
            }
            void capture.flush({ continue: continuous && !!next, nextSectionId: next ? (next.lensId === 'INTRO' ? 'CODE' : next.lensId) : undefined }).then(() => {
                if (mounted.current)
                    setStopping(false);
            }).catch(e => {
                setStopping(false);
                report(e);
            });
        }
        else
            void capture.stop().catch(e => {
                setStopping(false);
                report(e);
            });
    };
    const togglePause = () => {
        if (!active)
            return;
        if (active.state() === 'paused') {
            active.resume();
            if (voiceCommands && routeConfig.current && !phraseCapture.current)
                routeHandle.current = startVoiceRouting(routeConfig.current);
        }
        else {
            active.pause();
            routeHandle.current?.stop();
            routeHandle.current = null;
        }
    };
    const edit = (id: string, original: string, index: number, replacement: string) => {
        failed.current = false;
        const task = pending.current.then(() => patch(s => ({ ...s, results: s.results.map(r => {
                if (r.sectionId !== id)
                    return r;
                const next = replaceComparisonPassage(original, r.text, r.editIntent === 'add' ? undefined : r.comparison, index, replacement);
                return { ...r, ...next, comparison: next.comparison, checked: false, applied: false };
            }) }))).then(() => undefined);
        pending.current = task.catch(e => {
            failed.current = true;
            report(e);
        });
        return task;
    };
    const choosePassage = (id: string, key: string, choice: PassageChoice) => {
        failed.current = false;
        const task = pending.current.then(() => patch(s => ({ ...s, results: s.results.map(r => r.sectionId === id ? { ...r, rowChoices: { ...r.rowChoices, [key]: choice } } : r) }))).then(() => undefined);
        pending.current = task.catch(e => {
            failed.current = true;
            report(e);
        });
    };
    const checkWords = (id: string, checked: boolean) => {
        if (!current.current)
            return;
        const update = (s: SectionDraftSession) => ({ ...s, results: s.results.map(r => r.sectionId === id ? { ...r, checked } : r) });
        accept(update(current.current));
        failed.current = false;
        const task = pending.current.then(() => patch(update)).then(() => undefined);
        pending.current = task.catch(e => {
            failed.current = true;
            report(e);
        });
    };
    const flush = async () => {
        (document.activeElement as HTMLElement)?.blur();
        await pending.current;
        if (failed.current)
            throw Error('Your edit could not be saved. Retry saving it before integrating.');
    };
    const integrate = async (all = false) => {
        if (!draft || !section)
            return;
        setIntegrating(true);
        setError('');
        setNotice('');
        try {
            await flush();
            let value = (await store.get(draft.id))!;
            const targets = all ? value.results.filter(r => !r.applied && (!sectionReviewExceptions(r).needsReview || r.checked)) : value.results.filter(r => r.sectionId === section.id && !r.applied);
            if (!targets.length)
                throw Error('Choose a section with words to integrate.');
            for (const target of targets) {
                if (sectionReviewExceptions(target).needsReview && !target.checked)
                    throw Error('Check the flagged words against your recording first.');
                await changeSectionSession(value.id, s => ({ ...s, results: s.results.map(r => r.sectionId === target.sectionId ? { ...r, checked: true } : r) }));
                value = await integrateSectionDraft(value.id, target.sectionId, services);
                accept(value);
                if (initialAnchors?.length && value.results.every(r => r.applied)) {
                    onClose();
                    const node = value.sections.find(n => n.id === target.sectionId);
                    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('oracle:focus-passage', { detail: { cardNumber: value.cardNumber, sectionId: node?.lensId, text: target.text.split(/\n\s*\n/)[0] } })));
                }
            }
            if (all)
                setNotice(`${plural(targets.length, 'section')} saved to your reading.`);
        }
        catch (e) {
            report(e);
        }
        finally {
            setIntegrating(false);
        }
    };
    const playCapture = async (captureId: string, startMs = 0) => {
        if (clipBounds.current?.captureId !== captureId)
            clipBounds.current = null;
        const value = current.current;
        if (!value?.captureSessionId)
            return;
        const url = URL.createObjectURL(await audio.audio(value.captureSessionId, captureId));
        seekAt.current = startMs / 1000;
        setAudioUrl(url);
        setReplay(r => r ? { ...r, captureId } : r);
    };
    const listen = async (from = 0, to?: number) => {
        if (!draft?.captureSessionId)
            return;
        try {
            await flush();
            const latest = await store.get(draft.id);
            const candidate = latest?.results.find(r => r.sectionId === section?.id);
            if (!candidate)
                return;
            const saved = await audio.load(draft.captureSessionId);
            const words = buildWordReplay(candidate.text, saved?.session.transcript ?? [], candidate.evidenceQuotes);
            const bounds = phraseReplayBounds(words, from, to ?? candidate.text.length);
            const captureId = bounds?.captureId ?? words.find(w => w.captureId)?.captureId ?? candidate.takeIds?.[0] ?? draft.captureId ?? saved?.session.captures[0]?.id;
            if (!captureId)
                return;
            clipBounds.current = bounds;
            if (!bounds)
                setNotice('Exact word timing is unavailable here, so the whole take plays.');
            setReplay({ text: candidate.text, words, captureId });
            setActiveWord(-1);
            const resume = resumePlayback.current?.captureId === captureId ? resumePlayback.current.positionMs : undefined;
            resumePlayback.current = null;
            await playCapture(captureId, resume !== undefined && (!bounds || resume < bounds.endMs) ? Math.max(bounds?.startMs ?? 0, resume) : bounds?.startMs ?? words.find(w => w.captureId === captureId)?.startMs ?? 0);
        }
        catch (e) {
            report(e);
        }
    };
    const hear = (issue: NonNullable<SectionDraftResult['reviewIssues']>[number]) => {
        if (!issue.captureId || issue.startMs === undefined)
            return;
        setReplay(null);
        clipBounds.current = { captureId: issue.captureId, startMs: Math.max(0, issue.startMs - 300), endMs: (issue.endMs ?? issue.startMs) + 600, from: issue.start, to: issue.end };
        void playCapture(issue.captureId, clipBounds.current.startMs).catch(report);
    };
    const addAudio = async (file: File, duration: number) => {
        if (!current.current)
            return;
        explicitChoice.current = false;
        reviewArrival.current = true;
        setNotice('');
        setError('');
        let value = current.current;
        let saved = value.captureSessionId ? await audio.load(value.captureSessionId) : null;
        if (!saved) {
            const session = createSession(source);
            saved = { session, version: await audio.save(session, 0) };
        }
        const target = value.sections.find(s => s.id === targetId) ?? value.sections[0];
        saved = await importAudio(audio, saved, file, duration, target.lensId === 'INTRO' ? 'CODE' : target.lensId, source.cardNumber);
        const captureId = saved.session.captures.at(-1)!.id;
        value = await changeSectionSession(value.id, s => ({ ...s, captureSessionId: saved!.session.id, captureId }));
        accept(value);
        setSavedAudio(saved);
        accept(await queueSectionTake(value.id, captureId, target.id, services));
        setView('review');
    };
    const discard = async (captureId: string) => {
        if (!current.current)
            return;
        await flush();
        const value = await discardSectionTake(current.current.id, captureId);
        accept(value);
        player.current?.pause();
        setAudioUrl('');
        setReplay(null);
        await loadAudio(value);
    };
    const showAudio = async () => {
        if (!current.current)
            return;
        let value = current.current;
        if (!value.captureSessionId) {
            const session = createSession(source);
            const saved = { session, version: await audio.save(session, 0) };
            value = await patch(s => ({ ...s, captureSessionId: session.id }));
            setSavedAudio(saved);
        }
        await loadAudio(value);
    };
    const close = async () => {
        try {
            await flush();
            if (!handle.current)
                onClose();
        }
        catch (e) {
            report(e);
        }
    };
    const openView = (next: View) => {
        player.current?.pause();
        setReplay(null);
        setAudioUrl('');
        setView(next);
        setError('');
        if (next === 'review' && !(explicitChoice.current && results.some(r => r.sectionId === focusId))) {
            const first = results.find(r => !r.applied && sectionReviewExceptions(r).needsReview && !r.checked) ?? results.find(r => !r.applied) ?? results[0];
            if (first)
                setFocusId(first.sectionId);
        }
        if (next === 'audio')
            void showAudio().catch(report);
        if (next === 'sessions')
            void store.list(source.cardNumber).then(setHistory).catch(report);
    };
    useEffect(() => {
        let alive = true;
        if (draft)
            void currentSectionTexts(draft).then(value => {
                if (alive)
                    setReferences(value);
            }).catch(report);
        return () => {
            alive = false;
        };
    }, [draft?.id, draft?.results.map(r => r.appliedText).join('|')]);
    const takes = (draft as TakeSession | undefined)?.takes ?? [];
    const queued = takes.filter(t => ['queued', 'transcribing', 'assimilating'].includes(t.state));
    const discarded = new Set(takes.filter(t => t.state === 'discarded').map(t => t.captureId));
    const failedTakes = takes.filter(take => take.state === 'failed');
    const signInBlocked = failedTakes.some(take => isSignInBlocked(take.error)) || isSignInBlocked(draft?.error);
    const processingMessage = (failedTakes[0]?.error ?? draft?.error ?? '').replace(/\s*Your (?:local )?(?:recording|words|recording and words) (?:is|are) saved\.?\s*$/i, '');
    const savedCaptures = savedAudio?.session.captures.filter(capture => !discarded.has(capture.id) && ['ready', 'interrupted'].includes(capture.status) && capture.durationMs > 0) ?? [];
    const health = useRecordingHealth({ active, paused: monitor.paused, namesApply: !phraseCapture.current, routingStatus, signedIn: account.isSignedIn, preparedKey: draft?.id, prepared: draft?.results.length ?? 0 });
    const readinessSignedOut = health.readiness === 'signed_out';
    const needsSignIn = accountActions.enabled && account.isLoaded && (!account.isSignedIn || signInBlocked || readinessSignedOut);
    /** Without the account screen in this build, asking to sign in would be a loop: say so plainly instead. */
    const cannotSignIn = (signInBlocked || readinessSignedOut) && !accountActions.enabled;
    const draftDetail = (draft as {
        errorDetail?: {
            message: string;
            detail: string;
        };
    } | undefined)?.errorDetail;
    const processingDetail = failedTakes[0]?.error ? failedTakes[0].errorDetail : draft?.error && draftDetail?.message === draft.error ? draftDetail.detail : undefined;
    /** A failure shows once: in the status band when it is about saved recordings, otherwise in the toast. */
    const statusShown = !active && !opening && (needsSignIn || readinessSignedOut || !!health.readinessLine || savedCaptures.length > 0 && (failedTakes.length > 0 || !!draft?.error));
    const statusErrors = statusShown ? [failedTakes[0]?.error, draft?.error].filter(Boolean) : [];
    const toastError = error && !statusErrors.includes(error) ? error : !statusShown && draft?.error ? draft.error : '';
    const toastDetail = toastError && toastError === error && errorDetail.current?.message === error ? errorDetail.current.detail : toastError && toastError === draft?.error && draftDetail?.message === toastError ? draftDetail.detail : '';
    const dismissToast = () => {
        const shown = toastError;
        setError('');
        setNotice('');
        errorDetail.current = null;
        if (shown && shown === current.current?.error)
            void patch(s => s.error === shown ? { ...s, error: undefined } : s).catch(report);
    };
    const retrySaved = async () => {
        if (!draft || retrying)
            return;
        setRetrying(true);
        setError('');
        try {
            await flush();
            for (const take of failedTakes)
                accept(await queueSectionTake(draft.id, take.captureId, take.startSectionId, services, take.markers));
            if (!takes.length)
                await prepare(draft.id);
        }
        catch (e) {
            report(e);
        }
        finally {
            if (mounted.current)
                setRetrying(false);
        }
    };
    const signInAndResume = async () => {
        setError('');
        try {
            await flush();
            await accountActions.signInWithGoogle();
            health.signedIn();
            await resumeSignInBlockedRecordings(services);
        }
        catch (e) {
            report(e);
        }
    };
    useEffect(() => {
        if (view === 'review' && results.length && ((!explicitChoice.current && reviewArrival.current && !queued.length) || !results.some(r => r.sectionId === focusId))) {
            const first = results.find(r => !r.applied && sectionReviewExceptions(r).needsReview && !r.checked) ?? results.find(r => !r.applied) ?? results[0];
            setFocusId(first.sectionId);
            reviewArrival.current = false;
        }
    }, [view, draft?.version]);
    useEffect(() => {
        if (view === 'work' && nodes.length)
            reveal(handle.current ? recordingTarget.current : targetId);
    }, [draft?.id, view]);
    useEffect(() => {
        if (!playing)
            return;
        let frame = 0;
        const tick = () => {
            if (player.current) {
                setPlayhead(player.current.currentTime * 1000);
                if (replay)
                    setActiveWord(activeReplayWord(replay.words, replay.captureId, player.current.currentTime * 1000));
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing, replay]);
    const titleFor = (node: CardSection) => draft?.titleEdits?.[node.id]?.text ?? titles[node.id] ?? node.title;
    /** What the speaker reads. Matching and saved titles keep `titleFor`. */
    const shownTitle = (node: CardSection) => displaySectionTitle(titleFor(node));
    const saveTitle = (id: string, text: string) => {
        failed.current = false;
        const task = pending.current.then(() => patch(s => ({ ...s, titleEdits: { ...s.titleEdits, [id]: { text: text.trim(), updatedAt: new Date().toISOString() } } }))).then(() => undefined);
        pending.current = task.catch(e => {
            failed.current = true;
            report(e);
        });
        return task;
    };
    useEffect(() => {
        let alive = true;
        void store.list(source.cardNumber).then(values => {
            if (alive)
                setTitles(sectionTitleEdits(values, source.hash));
        }).catch(report);
        return () => {
            alive = false;
        };
    }, [draft?.id, source.hash]);
    useEffect(() => {
        let alive = true;
        let request = 0;
        const refresh = async () => {
            const version = ++request;
            try {
                const [values, working, synthesis] = await Promise.all([store.list(source.cardNumber), workingStore.list(source.cardNumber), getSynthesis(source.cardNumber)]);
                if (!alive || version !== request)
                    return;
                const latest: typeof authored = {};
                values.filter(s => s.sourceHash === source.hash).flatMap(s => s.results.filter(r => r.appliedAt).map(r => ({ id: r.sectionId, at: r.appliedAt!, human: !!r.integrationId, add: r.editIntent === 'add', sessionId: s.id }))).sort((a, b) => a.at.localeCompare(b.at)).forEach(({ id, at, ...value }) => {
                    latest[id] = value;
                });
                setAuthored(latest);
                const all = cardSections(source, synthesis?.summary);
                const coverage = cardSectionAuthorship(source, all, working, values);
                const origins: typeof appliedOrigins = {};
                for (const node of all) {
                    const spans = namedSectionOriginSpans(source, node, working, values);
                    if (spans)
                        origins[node.id] = spans;
                }
                setAppliedOrigins(origins);
                setAuthorship(coverage);
                setAuthorshipFailed(false);
            }
            catch {
                if (alive && version === request) {
                    setAuthorshipFailed(true);
                }
            }
        };
        void refresh();
        const unsubscribe = workingStore.subscribe(() => void refresh());
        return () => {
            alive = false;
            unsubscribe();
        };
    }, [draft?.id, draft?.version, source.hash]);
    useEffect(() => {
        let alive = true;
        void Promise.all(((draft as TakeSession | undefined)?.linkedSessionIds ?? []).map(id => store.get(id))).then(values => {
            if (alive) {
                const latest = new Map<number, SectionDraftSession>();
                values.filter((v): v is SectionDraftSession => !!v).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).forEach(value => latest.set(value.cardNumber, value));
                setLinkedDrafts([...latest.values()]);
            }
        }).catch(report);
        return () => {
            alive = false;
        };
    }, [draft?.id, (draft as TakeSession | undefined)?.linkedSessionIds?.join('|')]);
    const readUpdated = () => {
        const node = section;
        const r = result;
        if (!node || !r?.appliedText)
            return;
        onClose();
        requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('oracle:focus-passage', { detail: { cardNumber: source.cardNumber, sectionId: node.lensId, text: r.appliedText.split(/\n\s*\n/)[0] } })));
    };
    useEffect(() => {
        if (!draft || active || !focusId)
            return;
        const id = draft.id;
        const timer = setTimeout(() => void changeSectionSession(id, s => ({ ...s, resume: { sectionId: focusId, mode: view, positionMs: (player.current?.currentTime ?? 0) * 1000 } })).then(value => {
            if (current.current?.id === id)
                accept(value);
        }).catch(report), 500);
        return () => clearTimeout(timer);
    }, [draft?.id, focusId, view, !!active]);
    /** "It's right" is kept per section (keys start with the section id) for the life of the draft, so looking at another
     * section and coming back keeps it. A section's confirmations go when a new recording replaces its words or it is applied. */
    const resolvedStamps = useRef<Record<string, string>>({});
    useEffect(() => {
        setResolved({});
        resolvedStamps.current = {};
    }, [draft?.id]);
    useEffect(() => {
        const stamps = Object.fromEntries((draft?.results ?? []).map(r => [r.sectionId, JSON.stringify([!!r.applied, r.takeIds ?? [], r.reviewTranscript ?? ''])]));
        const stale = Object.keys(resolvedStamps.current).filter(id => resolvedStamps.current[id] !== stamps[id]);
        resolvedStamps.current = stamps;
        if (stale.length)
            setResolved(r => Object.fromEntries(Object.entries(r).filter(([key]) => !stale.some(id => key.startsWith(`${id}/`)))) as Record<string, true>);
    }, [draft?.results]);
    useEffect(() => {
        setCaret(undefined);
    }, [draft?.id, focusId]);
    const chip = (node: CardSection): {
        label: string;
        tone: Tone;
    } | null => {
        if (active && recordingTarget.current === node.id)
            return health.microphone === 'interrupted' && !monitor.paused ? { label: 'Interrupted', tone: 'busy' } : { label: monitor.paused ? 'Paused' : 'Recording', tone: monitor.paused ? 'busy' : 'rec' };
        const r = results.find(x => x.sectionId === node.id);
        if (r?.applied)
            return { label: authorship?.sections[node.id] === 'human' ? 'Your words' : r.editIntent === 'add' ? 'Your addition' : 'Partly your words', tone: 'human' };
        if (r)
            return sectionReviewExceptions(r).needsReview && !r.checked ? { label: 'Check words', tone: 'check' } : { label: 'Ready to review', tone: 'ready' };
        if (authored[node.id]?.human)
            return { label: authorship?.sections[node.id] === 'human' ? 'Your words' : authored[node.id].add ? 'Your addition' : 'Partly your words', tone: 'human' };
        if (takes.some(t => t.startSectionId === node.id && queued.includes(t)))
            return { label: 'Processing', tone: 'busy' };
        if (takes.some(t => t.startSectionId === node.id && t.state === 'failed'))
            return { label: 'Needs attention', tone: 'alert' };
        return null;
    };
    const reviewList = nodes.filter(n => results.some(r => r.sectionId === n.id));
    const position = reviewList.findIndex(n => n.id === section?.id);
    const step = (direction: number) => {
        const next = reviewList[position + direction];
        if (next)
            void choose(next.id).catch(report);
    };
    const waiting = results.filter(r => !r.applied).length + (draft?.unassigned.length ?? 0);
    // A doubt on a word the shared word library fixed is placed on the fixed wording; `heard` keeps the raw words.
    // Only an edit by the speaker settles a check by its words being gone.
    const checks = result && !result.applied && !result.checked && sectionReviewExceptions(result).needsReview ? issueKeys(result).map(item => {
        const key = `${result.sectionId}/${item.key}`;
        const fixed = item.quote && !quoted(result.text, item.quote) ? correctedQuote(result.changes, item.quote) : undefined;
        const quote = fixed && quoted(result.text, fixed) ? fixed : item.quote;
        return { ...item, key, quote, heard: item.quote, done: !!resolved[key] || !!quote && !quoted(result.text, quote) };
    }) : [];
    const open = checks.filter(c => !c.done).length;
    const generalCheck = checks.some(c => !c.quote);
    /** Each word check's own clip: playing, stopped, unavailable or failed. See `useCheckAudio`. */
    const checkAudio = useCheckAudio({ load: id => audio.load(id), captureSessionId: draft?.captureSessionId, version: draft?.version, discarded, fallbackCaptureIds: [...(result?.takeIds ?? []), draft?.captureId], playCapture, clipBounds, clearReplay: () => setReplay(null), audioUrl, playing, stopListening });
    const progressText = authorshipFailed ? 'Authorship unavailable' : !authorship ? 'Checking authorship…' : authorship.total ? `${authorship.human} of ${authorship.total} ${authorship.total === 1 ? 'section' : 'sections'} in your words` : 'No recordable sections';
    const pathFor = (node: CardSection) => displaySectionTitle([...node.path.slice(0, -1), titleFor(node)].filter((part, i, all) => i === 0 || part !== all[i - 1]).join(' · '));
    /** The card's own sections, read only when the workspace opened on passages chosen in the reader. */
    const readerUnits = useMemo(() => {
        if (!initialAnchors?.length)
            return [];
        try {
            return cardSections(source);
        }
        catch {
            return [];
        }
    }, [source, initialAnchors]);
    /**
     * A passage chosen in the reader ("Re-record this passage") that is exactly one paragraph of its
     * section: its number there and the section's paragraph count, so it reads as if aimed here.
     */
    const selectionParagraph = (node: CardSection) => {
        if (!initialAnchors?.length)
            return undefined;
        const parent = readerUnits.find(unit => unit.lensId === node.lensId && unit.sectionText === node.sectionText && unit.start <= node.start && node.end <= unit.end);
        if (!parent)
            return undefined;
        const ps = readingParagraphs(parent.text);
        const index = ps.findIndex(p => parent.start + p.start === node.start && p.text === node.text);
        return index >= 0 ? { index, count: ps.length } : undefined;
    };
    const scopeFor = (node: CardSection, focus?: {
        start: number;
        text: string;
    }) => {
        const ps = readingParagraphs(references[node.id] ?? node.text);
        const i = focus ? ps.findIndex(p => p.start === focus.start && p.text === focus.text) : -1;
        const chosen = !focus ? selectionParagraph(node) : undefined;
        if (chosen)
            return `Paragraph ${chosen.index + 1} of ${chosen.count}`;
        return i >= 0 ? `Paragraph ${i + 1} of ${ps.length}` : ps.length > 1 ? `All ${ps.length} paragraphs` : 'Whole section';
    };
    const spanLabel = (node: CardSection, focus?: {
        start: number;
        text: string;
    }) => {
        const chosen = !focus ? selectionParagraph(node) : undefined;
        if (chosen)
            return ` · paragraph ${chosen.index + 1}`;
        const paragraphs = readingParagraphs(references[node.id] ?? node.text);
        if (focus) {
            const i = paragraphs.findIndex(p => p.start === focus.start && p.text === focus.text);
            return i >= 0 ? ` · paragraph ${i + 1}` : '';
        }
        return paragraphs.length > 1 ? ` · all ${paragraphs.length} paragraphs` : '';
    };
    const nextAfter = (id?: string) => nodes[nodes.findIndex(n => n.id === id) + 1];
    const nextReview = reviewList.find((n, index) => index > position && !results.find(r => r.sectionId === n.id)?.applied) ?? reviewList.find(n => !results.find(r => r.sectionId === n.id)?.applied && n.id !== section?.id);
    const readyClean = results.filter(r => !r.applied && (!sectionReviewExceptions(r).needsReview || r.checked));
    const applyLabel = (() => {
        if (!result || !section)
            return { text: '', empty: false };
        if (result.editIntent === 'add')
            return { text: 'Add my words', empty: false };
        const base = sectionComparisonOriginal(result, references[section.id] ?? section.text);
        const view = buildPassageComparison(base, result.text, result.comparison);
        if (view.kind !== 'matched' || view.pairs.length < 2) {
            const n = readingParagraphs(base).length;
            return { text: n > 1 ? `Replace all ${n} paragraphs` : 'Replace with my words', empty: false };
        }
        const rows = comparisonRows(view, result.rowChoices);
        const replace = rows.filter(r => r.kind === 'replaced' && r.changes).length;
        const added = rows.filter(r => r.kind === 'new' && r.changes).length;
        const removed = rows.filter(r => r.kind === 'unspoken' && r.choice === 'mine').length;
        const parts = [replace && `replace ${plural(replace, 'passage')}`, added && `add ${plural(added, 'passage')}`, removed && `remove ${removed}`].filter(Boolean) as string[];
        return parts.length ? { text: parts.join(' · ').replace(/^./, c => c.toUpperCase()), empty: false } : { text: 'Nothing to change', empty: true };
    })();
    const applySection = async () => {
        if (!result || !section)
            return;
        if (checks.length && !open)
            checkWords(section.id, true);
        await integrate();
    };
    const recordingNode = active ? nodes.find(n => n.id === recordingTarget.current) ?? target : target;
    const upcoming = active && !phraseCapture.current ? nextAfter(recordingTarget.current) : undefined;
    const nextRecording = result?.applied && !initialAnchors?.length ? nextAfter(section?.id) : undefined;
    const appliedText = result?.appliedText ?? result?.text ?? '';
    const originSpans = section ? appliedOrigins[section.id] : undefined;
    const displayOrigins = originSpans?.map(part => part.text).join('') === appliedText ? originSpans : [{ text: appliedText, origin: section && authorship?.sections[section.id] === 'human' ? 'human' : 'unknown' }];
    const locked = !!active || opening || integrating;
    const screenTitle: Record<View, string> = { work: '', review: '', settings: 'Recording settings', audio: 'Recordings', sessions: 'Sessions', sections: placing !== null ? 'Place these words' : 'Sections', cleanup: 'Speech cleanup', unplaced: 'Unplaced words' };
    const pickFromRail = (node: CardSection) => {
        if (view === 'review' && results.some(r => r.sectionId === node.id))
            void choose(node.id).catch(report);
        else {
            if (view !== 'work')
                openView('work');
            aim(node.id, true);
        }
    };
    async function place(i: number, sectionId: string) {
        try {
            await patch(s => {
                const u = s.unassigned[i];
                if (!u)
                    return s;
                const existing = s.results.find(r => r.sectionId === sectionId);
                const takeId = (u as {
                    takeId?: string;
                }).takeId;
                const node = s.sections.find(n => n.id === sectionId);
                // Words placed by hand are added after the section's reading unless the owner chose "Replace them" in Recording settings.
                const adding = intent !== 'replace';
                const placed = (r: SectionDraftResult): SectionDraftResult => {
                    const text = `${r.text}\n\n${u.text}`;
                    const base = { ...r, evidenceQuotes: [...r.evidenceQuotes, u.text], takeIds: [...new Set([...(r.takeIds ?? []), ...(takeId ? [takeId] : [])])], text, checked: false, applied: false, warnings: [...r.warnings, 'Check these words you placed by hand.'] };
                    if (r.editIntent === 'add')
                        return { ...base, comparison: undefined };
                    // A passage-by-passage comparison keeps its rows; the placed words become one new passage at the end.
                    const original = sectionComparisonOriginal(r, references[sectionId] ?? node?.text ?? '');
                    if (r.comparison && buildPassageComparison(original, r.text, r.comparison).kind === 'matched')
                        return { ...base, comparison: { originalText: original, spokenText: text, pairs: [...r.comparison.pairs, { originalStart: original.length, originalEnd: original.length, textStart: r.text.length + 2, textEnd: text.length }] } };
                    return { ...base, comparison: undefined };
                };
                return { ...s, results: existing ? s.results.map(r => r.sectionId === sectionId ? placed(r) : r) : [...s.results, { sectionId, takeIds: takeId ? [takeId] : undefined, text: u.text, evidenceQuotes: [u.text], changes: [], warnings: ['Check these words you placed by hand.'], checked: false, ...(adding ? { editIntent: 'add' as const, comparisonOriginal: references[sectionId] ?? node?.text } : {}) }], unassigned: s.unassigned.filter((_, index) => index !== i) };
            });
            setPlacing(null);
            reviewAt(sectionId);
        }
        catch (e) {
            report(e);
        }
    }
    const sendToCard = useSendToCard({ source, services, visible: view === 'settings', recording: !!active, preparing: processing || queued.length > 0 });
    return {
        // Props the screens need.
        source, services, onClose, onEarlier, onNavigateCard, initialAnchors,
        // Account and stores.
        account, accountActions, retrying, store, audio,
        // Session and screen state.
        draft, savedAudio, setSavedAudio, history, view, setView, focusId, setFocusId, targetId, setTargetId,
        error, notice, setNotice, opening, integrating, stopping,
        authorship, authorshipFailed, references, linkedDrafts,
        // Recording.
        active, monitor, continuous, setContinuous, voiceCommands, setVoiceCommands, routingStatus, intent, setIntent,
        phrase, setPhrase, paragraphAim, setParagraphAim, captureFocus, phraseCapture, recordingTarget, handle, manuscript,
        // Review and playback.
        resolved, setResolved, placing, setPlacing, caret, playhead, setPlayhead, playing, setPlaying,
        replay, setReplay, activeWord, setActiveWord, audioUrl, loop, setLoop,
        seekAt, clipBounds, loopCleanup, player, resumePlayback, pickerReturn, explicitChoice, reviewArrival, checkAudio,
        // Derived values.
        nodes, review, processing, section, result, results, target, takes, queued, discarded, savedCaptures,
        needsSignIn, cannotSignIn, processingMessage, processingDetail, statusShown, toastError, toastDetail, health,
        reviewList, position, waiting, checks, open, generalCheck, progressText, nextReview, readyClean, applyLabel,
        recordingNode, upcoming, nextRecording, appliedText, displayOrigins, locked, screenTitle,
        // Actions.
        accept, report, loadAudio, make, prepare, patch, flush, stopListening, choose, aim, openApplied, aimParagraph, reviewAt,
        record, stop, togglePause, edit, choosePassage, checkWords, integrate, playCapture, listen, hear, addAudio, discard,
        showAudio, close, openView, dismissToast, retrySaved, signInAndResume, titleFor, shownTitle, saveTitle, readUpdated,
        chip, step, pathFor, scopeFor, spanLabel, selectionParagraph, nextAfter, applySection, pickFromRail, place,
        // Send finished sections to the card.
        sendToCard,
    };
}
/** Everything the voice studio's screens can read from `useVoiceStudio`. */
export type VoiceStudio = ReturnType<typeof useVoiceStudio>;
