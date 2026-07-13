export type RecorderSegment = { id: string; transcript: string; sortOrder: number; createdAt: string };
export type InvocationBlock = { id: string; kind: 'segment' | 'prose'; segmentId: string | null; markdown: string; sortOrder: number };
export type InvocationDraft = { id: string; hexagramNumber: number; sessionId: string; title: string; blocks: InvocationBlock[]; updatedAt: string };
export type SafeInline = { type: 'text'; value: string } | { type: 'emphasis' | 'strong'; children: SafeInline[] } | { type: 'link'; href: string; children: SafeInline[] };
export type SafeBlock = { type: 'heading'; level: 2 | 3; children: SafeInline[] } | { type: 'paragraph'; children: SafeInline[] } | { type: 'break' };
export type InvocationVersion = { id: string; hexagramNumber: number; versionNumber: number; title: string; markdownBody: string; artifactKey: string; authorUserId: string; createdAt: string };
export type LiveInvocation = Pick<InvocationVersion, 'versionNumber' | 'title'> & { blocks: SafeBlock[]; id?: string; hexagramNumber?: number; createdAt?: string };
