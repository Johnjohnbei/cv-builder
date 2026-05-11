import { Fragment, type ReactNode } from 'react';

// Inline-only markdown renderer: **bold**, *italic*, _italic_, `code`.
// AI providers occasionally emit markdown emphasis in CV text. The CV templates
// render plain strings, so the asterisks would otherwise leak into the output.
const TOKEN_RE = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\n]+?\*|_[^_\n]+?_|`[^`\n]+?`)/g;

export function renderInlineMarkdown(input: string | null | undefined): ReactNode {
  if (!input) return input ?? null;
  if (!/[*_`]/.test(input)) return input;

  const parts = input.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('__') && part.endsWith('__')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('_') && part.endsWith('_')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function stripInlineMarkdown(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/__([^_\n]+?)__/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/_([^_\n]+?)_/g, '$1')
    .replace(/`([^`\n]+?)`/g, '$1');
}
