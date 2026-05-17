# @paragraphcms/parser-react

React renderer for Paragraph CMS content.

`@paragraphcms/parser-react` renders Paragraph CMS `v1` content in React. It accepts full page objects or raw content, supports `tiptap`, `markdown`, and `html`, and ships with sensible defaults for styling, sanitization, and custom block rendering.

## Quick Start

Install the renderer and its React peer dependencies:

```bash
npm install @paragraphcms/parser-react react react-dom

# Optional if you also fetch content with the official SDK
npm install @paragraphcms/client
```

Render a Paragraph page:

```tsx
import { Client } from "@paragraphcms/client";
import { ParagraphContent } from "@paragraphcms/parser-react";

const client = new Client({
  apiKey: process.env.PARAGRAPH_API_KEY!,
});

const pages = await client.pages.list({
  slug: "home",
  language: "en",
  include_content: true,
  limit: 1,
});

const page = pages.data[0] ?? null;

export function PageContent() {
  if (!page?.content) {
    return null;
  }

  return <ParagraphContent page={page} />;
}
```

Render raw content directly:

```tsx
import { ParagraphContent } from "@paragraphcms/parser-react";

export function MarketingBlurb() {
  return (
    <ParagraphContent
      content="# Hello from Paragraph"
      contentFormat="markdown"
    />
  );
}
```

## Table of Contents

- [Requirements](#requirements)
- [Features](#features)
- [Installation](#installation)
- [Rendering a Page](#rendering-a-page)
- [Rendering Raw Content](#rendering-raw-content)
- [Rendering Options](#rendering-options)
- [Styling](#styling)
- [Overriding Components](#overriding-components)
- [Lower-level Rendering](#lower-level-rendering)
- [Exported Helpers and Types](#exported-helpers-and-types)
- [Notes](#notes)
- [License](#license)

## Requirements

- `react` `^18.2.0 || ^19.0.0`
- `react-dom` `^18.2.0 || ^19.0.0`

## Features

- Supports Paragraph CMS `tiptap`, plus direct `markdown` and `html` input.
- Accepts either a full page object or raw `content`.
- Tailwind-friendly default class names with an `unstyled` escape hatch.
- Slot-level component overrides for links, images, tables, custom blocks, and task lists.
- Built-in markdown parsing and HTML sanitization.
- Paragraph-specific Tiptap support for `faq`, `collapsible`, hydrated images, tables, and task lists.

## Installation

Install from npm:

```bash
npm install @paragraphcms/parser-react react react-dom

# Alternative package managers
pnpm add @paragraphcms/parser-react react react-dom
yarn add @paragraphcms/parser-react react react-dom
```

If you also fetch content from Paragraph CMS, install the official client separately:

```bash
npm install @paragraphcms/client
```

## Rendering a Page

`ParagraphContent` accepts a `page` object with `content` and optional `content_format`:

```tsx
import {
  ParagraphContent,
  type ParagraphRenderablePage,
} from "@paragraphcms/parser-react";

export function Article({
  page,
}: {
  page: ParagraphRenderablePage | null;
}) {
  return <ParagraphContent page={page} />;
}
```

If you fetch from the Paragraph API, make sure the payload actually includes `content`. For list endpoints, that means setting `include_content: true`. Detail endpoints already return the full page.

## Rendering Raw Content

You can render content without a page wrapper by passing `content` and, optionally, `contentFormat`:

```tsx
<ParagraphContent
  content="<h1>Hello</h1><p>Rendered as HTML</p>"
  contentFormat="html"
/>
```

Supported content formats:

- `tiptap`
- `markdown`
- `html`

If `contentFormat` is omitted, the renderer infers it automatically:

- Arrays are treated as `tiptap`.
- Strings are checked for HTML tags and otherwise treated as `markdown`.

## Rendering Options

The main component props look like this:

```ts
type ParagraphContentProps<TFields = Record<string, unknown>> =
  ParagraphRenderOptions & {
    as?: ElementType<HTMLAttributes<HTMLElement>>;
    className?: string;
    page?: ParagraphRenderablePage<TFields> | null;
    content?: ParagraphPageContent | null;
    contentFormat?: ParagraphContentFormat | null;
  };
```

Useful options:

- `as` changes the root element. The default is `article`.
- `className` applies to the root wrapper.
- `classNames` overrides slot-level classes.
- `components` replaces rendered elements with custom React components.
- `markedOptions` customizes markdown parsing.
- `sanitizeOptions` customizes HTML sanitization.
- `unstyled` disables the built-in default classes.

## Styling

The renderer ships with default class names designed to work well in Tailwind-based apps. You can extend or replace them slot by slot:

```tsx
<ParagraphContent
  page={page}
  classNames={{
    root: "prose prose-slate max-w-none",
    h1: "font-serif text-5xl tracking-tight",
    h2: "mt-12 text-3xl font-semibold",
    img: "rounded-[2rem] border-0 shadow-2xl",
    faq: "not-prose rounded-[2rem] border border-slate-200 bg-white p-4",
    collapsible: "rounded-2xl border border-slate-200 bg-slate-50 p-2",
  }}
/>
```

If you want a zero-base render and plan to style everything yourself:

```tsx
<ParagraphContent page={page} unstyled />
```

## Overriding Components

Use `components` to replace any rendered slot with your own React component:

```tsx
import Link from "next/link";

<ParagraphContent
  page={page}
  components={{
    a: ({ href, children, ...props }) => (
      <Link href={href ?? "#"} {...props}>
        {children}
      </Link>
    ),
    img: (props) => <img {...props} loading="eager" />,
    faq: ({ children, ...props }) => (
      <section {...props} data-ui="marketing-faq">
        {children}
      </section>
    ),
  }}
/>
```

Available slots:

- `root`
- `p`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- `a`, `strong`, `em`, `u`, `s`
- `blockquote`, `code`, `pre`
- `ul`, `ol`, `li`, `hr`, `br`
- `img`, `figure`, `figcaption`, `imageMeta`, `imageSlug`, `imageAlt`
- `tableWrapper`, `table`, `thead`, `tbody`, `tr`, `th`, `td`
- `faq`, `collapsible`, `summary`, `collapsibleContent`
- `taskList`, `taskItem`, `taskCheckbox`

## Lower-level Rendering

If you want rendered React nodes without the root wrapper, use `renderParagraphContent()` directly:

```tsx
import { renderParagraphContent } from "@paragraphcms/parser-react";

const nodes = renderParagraphContent({
  content: "# Hello",
  contentFormat: "markdown",
  unstyled: true,
});
```

This is useful when you want to place rendered content inside your own layout component tree.

## Exported Helpers and Types

The package exports:

- `ParagraphContent`
- `renderParagraphContent`
- `defaultParagraphClassNames`
- `defaultParagraphMarkedOptions`
- `defaultParagraphSanitizeOptions`

It also exports the core type surface, including:

- `ParagraphContentProps`
- `ParagraphRenderOptions`
- `ParagraphContentFormat`
- `ParagraphPageContent`
- `ParagraphRenderablePage`
- `ParagraphPage`
- `ParagraphPageSummary`
- `ParagraphComponents`
- `ParagraphClassNames`
- `ParagraphTiptapNode`

## Notes

- `ParagraphContent` returns `null` if content is missing.
- If you fetch page lists from the API, include `content` explicitly with `include_content: true`.
- Tiptap images returned by Paragraph CMS are already hydrated by the backend with public `src`, `alt`, `width`, and `height`.
- Markdown and HTML input are sanitized before rendering. You can customize that behavior with `sanitizeOptions`.

## License

MIT
