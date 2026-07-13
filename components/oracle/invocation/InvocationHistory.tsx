import React from 'react';
import type { InvocationVersion } from '../../../lib/oracle/invocationTypes';

export function InvocationHistory({ versions, onClose, onDownload, onRollback }: {
  versions: InvocationVersion[]; onClose: () => void; onDownload: (id: string) => void; onRollback: (id: string) => void;
}) {
  return (
    <aside className="invocation-history" aria-labelledby="invocation-history-title">
      <div className="invocation-history__heading"><h2 id="invocation-history-title">Version history</h2><button type="button" onClick={onClose}>Close history</button></div>
      {versions.length === 0 ? <p>No saved versions yet.</p> : (
        <ol>{[...versions].sort((a, b) => b.versionNumber - a.versionNumber).map(version => <li key={version.id}>
          <div><strong>Version {version.versionNumber}</strong><time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time></div>
          <p>{version.title}</p>
          <details><summary>Preview</summary><pre className="invocation-history__preview">{version.markdownBody}</pre></details>
          <div className="invocation-history__actions">
            <button type="button" onClick={() => onDownload(version.id)}>Download Markdown</button>
            <button type="button" onClick={() => onRollback(version.id)}>Restore as new version</button>
          </div>
        </li>)}</ol>
      )}
    </aside>
  );
}
