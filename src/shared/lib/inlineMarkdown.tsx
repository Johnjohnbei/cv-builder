import { Fragment, type ReactNode } from 'react';

// Inline-only markdown renderer: **bold**, *italic*, `code`.
// AI providers occasionally emit markdown emphasis in CV text. The CV templates
// render plain strings, so the asterisks would otherwise leak into the output.
//
// Underscore-based emphasis (_italic_, __bold__) is intentionally NOT supported
// to avoid mangling identifiers and emails (snake_case, john_doe@example.com,
// node_modules, etc.). The asterisk form is enough for AI output.
const TOKEN_RE = /(\*\*[^*\n]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`)/g;

export function renderInlineMarkdown(input: string | null | undefined): ReactNode {
  if (!input) return input ?? null;
  if (!/[*`]/.test(input)) return input;

  const parts = input.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
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
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/`([^`\n]+?)`/g, '$1');
}
