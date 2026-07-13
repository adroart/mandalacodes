import React from 'react';
import type { LiveInvocation, SafeBlock, SafeInline } from '../../../lib/oracle/invocationTypes';

function safeHref(value: string) {
  try {
    const url = new URL(value, 'https://mandalacodes.com');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? value : null;
  } catch { return null; }
}

function Inline({ node, index }: { node: SafeInline; index: number }): React.ReactNode {
  if (node.type === 'text') return node.value;
  const children = node.children.map((child, childIndex) => <Inline key={childIndex} node={child} index={childIndex} />);
  if (node.type === 'emphasis') return <em>{children}</em>;
  if (node.type === 'strong') return <strong>{children}</strong>;
  if (node.type === 'link') {
    const href = safeHref(node.href);
    return href ? <a href={href} rel="noreferrer noopener">{children}</a> : <>{children}</>;
  }
  return null;
}

function Block({ block }: { block: SafeBlock }) {
  if (block.type === 'break') return <br />;
  const content = block.children.map((node, index) => <Inline key={index} node={node} index={index} />);
  if (block.type === 'heading') return block.level === 2 ? <h2>{content}</h2> : <h3>{content}</h3>;
  return <p>{content}</p>;
}

export function PublicInvocation({ invocation }: { invocation: LiveInvocation | null }) {
  if (!invocation) return null;
  return (
    <article className="public-invocation" aria-label={invocation.title} data-invocation-version={invocation.versionNumber} data-oracle-reveal="">
      {invocation.blocks.map((block, index) => <Block key={index} block={block} />)}
    </article>
  );
}

export default PublicInvocation;
