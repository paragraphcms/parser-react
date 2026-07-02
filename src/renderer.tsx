import { collapsibleComponent, faqComponent } from "@paragraphcms/components";
import {
  Fragment,
  createElement,
  type ElementType,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import parse, {
  Element,
  attributesToProps,
  domToReact,
  type DOMNode,
  type HTMLReactParserOptions,
} from "html-react-parser";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { twMerge } from "tailwind-merge";
import {
  defaultParagraphClassNames,
  defaultParagraphMarkedOptions,
  defaultParagraphSanitizeOptions,
} from "./defaults";
import type {
  ParagraphClassNames,
  ParagraphComponentSlot,
  ParagraphContentFormat,
  ParagraphContentProps,
  ParagraphPageContent,
  ParagraphRenderOptions,
  ParagraphTiptapMark,
  ParagraphTiptapNode,
} from "./types";

type ResolvedRenderOptions = {
  classNames: ParagraphClassNames;
  components: NonNullable<ParagraphRenderOptions["components"]>;
  markedOptions: NonNullable<ParagraphRenderOptions["markedOptions"]>;
  sanitizeOptions: sanitizeHtml.IOptions;
  unstyled: boolean;
};

function resolveRenderOptions(
  options: ParagraphRenderOptions = {},
): ResolvedRenderOptions {
  return {
    classNames: options.classNames ?? {},
    components: options.components ?? {},
    markedOptions: {
      ...defaultParagraphMarkedOptions,
      ...(options.markedOptions ?? {}),
      async: false,
    },
    sanitizeOptions: {
      ...defaultParagraphSanitizeOptions,
      ...(options.sanitizeOptions ?? {}),
      allowedAttributes: {
        ...defaultParagraphSanitizeOptions.allowedAttributes,
        ...(options.sanitizeOptions?.allowedAttributes ?? {}),
      },
    },
    unstyled: Boolean(options.unstyled),
  };
}

function getSlotClassName(
  slot: ParagraphComponentSlot,
  className: string | undefined,
  options: ResolvedRenderOptions,
) {
  return twMerge(
    options.unstyled ? undefined : defaultParagraphClassNames[slot],
    options.classNames[slot],
    className,
  );
}

function renderSlot(
  slot: ParagraphComponentSlot,
  fallbackTag: ElementType,
  props: Record<string, unknown>,
  options: ResolvedRenderOptions,
) {
  const { className, children, ...restProps } = props;
  const Component = options.components[slot] ?? fallbackTag;

  return createElement(
    Component,
    {
      ...restProps,
      className: getSlotClassName(
        slot,
        typeof className === "string" ? className : undefined,
        options,
      ),
    },
    children as ReactNode,
  );
}

function isElementNode(node: DOMNode): node is Element {
  return node instanceof Element;
}

function sanitizeMarkup(html: string, options: ResolvedRenderOptions) {
  return sanitizeHtml(html, options.sanitizeOptions);
}

function getHtmlNodeChildren(
  node: Element,
  parserOptions: HTMLReactParserOptions,
) {
  return domToReact(node.children as DOMNode[], parserOptions);
}

function isTaskListNode(node: Element) {
  return node.name === "ul" && node.attribs["data-type"] === "taskList";
}

function isTaskItemNode(node: Element) {
  return node.name === "li" && typeof node.attribs["data-checked"] === "string";
}

function isCheckboxNode(node: Element) {
  return (
    node.name === "input" &&
    typeof node.attribs.type === "string" &&
    node.attribs.type.toLowerCase() === "checkbox"
  );
}

function createHtmlRendererOptions(
  options: ResolvedRenderOptions,
): HTMLReactParserOptions {
  const parserOptions: HTMLReactParserOptions = {
    replace(domNode) {
      if (!isElementNode(domNode)) {
        return undefined;
      }

      const children = getHtmlNodeChildren(domNode, parserOptions);
      const props: Record<string, unknown> = {
        ...(attributesToProps(domNode.attribs) as Record<string, unknown>),
        children,
      };

      if (domNode.name === "a") {
        const target =
          typeof props.target === "string" ? props.target : undefined;
        const rel = typeof props.rel === "string" ? props.rel : "";

        if (target === "_blank" && !rel.includes("noopener")) {
          props.rel = rel ? `${rel} noopener noreferrer` : "noopener noreferrer";
        }
      }

      if (domNode.name === "table") {
        return renderSlot(
          "tableWrapper",
          "div",
          {
            children: renderSlot("table", "table", props, options),
          },
          options,
        );
      }

      if (
        domNode.name === faqComponent.html.container.tag &&
        domNode.attribs["data-type"] === faqComponent.html.container.dataType
      ) {
        return renderSlot("faq", "section", props, options);
      }

      if (
        domNode.name === collapsibleComponent.html.container.tag &&
        domNode.attribs["data-type"] === collapsibleComponent.html.container.dataType
      ) {
        return renderSlot("collapsible", "details", props, options);
      }

      if (domNode.name === "summary") {
        return renderSlot("summary", "summary", props, options);
      }

      if (domNode.name === "ul" && isTaskListNode(domNode)) {
        return renderSlot("taskList", "ul", props, options);
      }

      if (domNode.name === "li" && isTaskItemNode(domNode)) {
        return renderSlot("taskItem", "li", props, options);
      }

      if (domNode.name === "input" && isCheckboxNode(domNode)) {
        return renderSlot(
          "taskCheckbox",
          "input",
          {
            ...props,
            readOnly: true,
          },
          options,
        );
      }

      switch (domNode.name) {
        case "p":
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
        case "a":
        case "strong":
        case "em":
        case "u":
        case "s":
        case "blockquote":
        case "code":
        case "pre":
        case "ul":
        case "ol":
        case "li":
        case "img":
        case "figure":
        case "figcaption":
        case "thead":
        case "tbody":
        case "tr":
        case "th":
        case "td":
        case "br":
          return renderSlot(
            domNode.name as ParagraphComponentSlot,
            domNode.name,
            props,
            options,
          );
        case "hr":
          return renderSlot("hr", "hr", props, options);
        default:
          return undefined;
      }
    },
  };

  return parserOptions;
}

function renderHtml(html: string, options: ResolvedRenderOptions) {
  const sanitizedMarkup = sanitizeMarkup(html, options);
  return parse(sanitizedMarkup, createHtmlRendererOptions(options));
}

function renderMarkdown(markdown: string, options: ResolvedRenderOptions) {
  const html = marked.parse(markdown, options.markedOptions);
  return renderHtml(typeof html === "string" ? html : "", options);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function renderImageNode(
  attrs: Record<string, unknown> | undefined,
  key: string,
  options: ResolvedRenderOptions,
) {
  const src = toStringValue(attrs?.src);

  if (!src) {
    return null;
  }

  const alt = toStringValue(attrs?.alt) ?? "";
  const caption = toStringValue(attrs?.caption);
  const title = toStringValue(attrs?.title);
  const width = toNumber(attrs?.width);
  const height = toNumber(attrs?.height);

  const imageElement = renderSlot(
    "img",
    "img",
    {
      key: `${key}-img`,
      src,
      alt,
      title,
      width,
      height,
      loading: "lazy",
    },
    options,
  );

  if (!caption) {
    return imageElement;
  }

  return renderSlot(
    "figure",
    "figure",
    {
      key,
      children: [
        imageElement,
        renderSlot(
          "figcaption",
          "figcaption",
          { key: `${key}-caption`, children: caption },
          options,
        ),
      ],
    },
    options,
  );
}

function renderMark(
  mark: ParagraphTiptapMark,
  children: ReactNode,
  key: string,
  options: ResolvedRenderOptions,
) {
  const attrs = mark.attrs ?? {};

  switch (mark.type) {
    case "bold":
      return renderSlot("strong", "strong", { key, children }, options);
    case "italic":
      return renderSlot("em", "em", { key, children }, options);
    case "underline":
      return renderSlot("u", "u", { key, children }, options);
    case "strike":
      return renderSlot("s", "s", { key, children }, options);
    case "code":
      return renderSlot("code", "code", { key, children }, options);
    case "link": {
      const target = toStringValue(attrs.target);
      const rel = toStringValue(attrs.rel);

      return renderSlot(
        "a",
        "a",
        {
          key,
          href: toStringValue(attrs.href),
          target,
          rel:
            target === "_blank" && !rel
              ? "noopener noreferrer"
              : rel,
          children,
        },
        options,
      );
    }
    default:
      return createElement(Fragment, { key }, children);
  }
}

function renderTextNode(
  node: ParagraphTiptapNode,
  key: string,
  options: ResolvedRenderOptions,
) {
  const textValue = typeof node.text === "string" ? node.text : "";
  let output: ReactNode = textValue;

  for (const [index, mark] of (node.marks ?? []).entries()) {
    output = renderMark(mark, output, `${key}-mark-${index}`, options);
  }

  return createElement(Fragment, { key }, output);
}

function renderTiptapNodes(
  nodes: ParagraphTiptapNode[] | undefined,
  options: ResolvedRenderOptions,
  path: string,
) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }

  return nodes.map((node, index) =>
    renderTiptapNode(node, `${path}-${index}`, options),
  );
}

function renderTiptapNode(
  node: ParagraphTiptapNode,
  key: string,
  options: ResolvedRenderOptions,
): ReactNode {
  if (typeof node !== "object" || node === null) {
    return null;
  }

  if (typeof node.text === "string") {
    return renderTextNode(node, key, options);
  }

  const children = renderTiptapNodes(node.content, options, key);
  const attrs = node.attrs ?? {};
  const type = node.type ?? "unknown";

  switch (type) {
    case "doc":
      return createElement(Fragment, { key }, children);
    case "paragraph":
      return renderSlot("p", "p", { key, children }, options);
    case "heading": {
      const level = Math.max(1, Math.min(6, toNumber(attrs.level) ?? 2));
      const slot = `h${level}` as ParagraphComponentSlot;
      return renderSlot(slot, slot as ElementType, { key, children }, options);
    }
    case "blockquote":
      return renderSlot("blockquote", "blockquote", { key, children }, options);
    case "bulletList":
      return renderSlot("ul", "ul", { key, children }, options);
    case "orderedList":
      return renderSlot(
        "ol",
        "ol",
        {
          key,
          start: toNumber(attrs.start),
          children,
        },
        options,
      );
    case "listItem":
      return renderSlot("li", "li", { key, children }, options);
    case "hardBreak":
      return renderSlot("br", "br", { key }, options);
    case "horizontalRule":
      return renderSlot("hr", "hr", { key }, options);
    case "codeBlock":
      return renderSlot(
        "pre",
        "pre",
        {
          key,
          children: renderSlot(
            "code",
            "code",
            {
              "data-language": toStringValue(attrs.language),
              children,
            },
            options,
          ),
        },
        options,
      );
    case "image":
      return renderImageNode(attrs, key, options);
    case "table":
      return renderSlot(
        "tableWrapper",
        "div",
        {
          key,
          children: renderSlot("table", "table", { children }, options),
        },
        options,
      );
    case "tableRow":
      return renderSlot("tr", "tr", { key, children }, options);
    case "tableHeader":
      return renderSlot(
        "th",
        "th",
        {
          key,
          colSpan: toNumber(attrs.colspan),
          rowSpan: toNumber(attrs.rowspan),
          children,
        },
        options,
      );
    case "tableCell":
      return renderSlot(
        "td",
        "td",
        {
          key,
          colSpan: toNumber(attrs.colspan),
          rowSpan: toNumber(attrs.rowspan),
          children,
        },
        options,
      );
    case "taskList":
      return renderSlot(
        "taskList",
        "ul",
        {
          key,
          "data-type": "taskList",
          children,
        },
        options,
      );
    case "taskItem": {
      const checked = Boolean(attrs.checked);

      return renderSlot(
        "taskItem",
        "li",
        {
          key,
          "data-checked": checked ? "true" : "false",
          children: [
            renderSlot(
              "taskCheckbox",
              "input",
              {
                key: `${key}-checkbox`,
                type: "checkbox",
                checked,
                readOnly: true,
                disabled: true,
              } as Record<string, unknown>,
              options,
            ),
            createElement(
              "div",
              {
                key: `${key}-content`,
              },
              children,
            ),
          ],
        },
        options,
      );
    }
    case faqComponent.tiptap.node:
      return renderSlot("faq", "section", { key, children }, options);
    case collapsibleComponent.tiptap.node: {
      const summary =
        toStringValue(attrs.summary) ??
        (attrs.variant === faqComponent.tiptap.variant ? "Question" : "Toggle");

      return renderSlot(
        "collapsible",
        "details",
        {
          key,
          open: Boolean(attrs.open),
          "data-type": collapsibleComponent.html.container.dataType,
          "data-variant": toStringValue(attrs.variant),
          children: [
            renderSlot(
              "summary",
              "summary",
              {
                key: `${key}-summary`,
                children: summary,
              },
              options,
            ),
            renderSlot(
              "collapsibleContent",
              "div",
              {
                key: `${key}-content`,
                children,
              },
              options,
            ),
          ],
        },
        options,
      );
    }
    default:
      return createElement(Fragment, { key }, children);
  }
}

function resolveContentInput(props: ParagraphContentProps) {
  const content =
    props.page?.content !== undefined ? props.page.content : props.content;
  const contentFormat =
    props.page?.content_format ?? props.contentFormat ?? null;

  return {
    content,
    contentFormat,
  };
}

function inferContentFormat(
  content: ParagraphPageContent,
  explicitFormat: ParagraphContentFormat | null,
): ParagraphContentFormat {
  if (explicitFormat) {
    return explicitFormat;
  }

  if (Array.isArray(content)) {
    return "tiptap";
  }

  return /<([a-z][\w:-]*)(?:\s[^>]*)?>/i.test(content) ? "html" : "markdown";
}

export function renderParagraphContent(
  input: {
    content: ParagraphPageContent;
    contentFormat?: ParagraphContentFormat | null;
  } & ParagraphRenderOptions,
) {
  const options = resolveRenderOptions(input);
  const resolvedContentFormat = inferContentFormat(
    input.content,
    input.contentFormat ?? null,
  );

  switch (resolvedContentFormat) {
    case "markdown":
      return renderMarkdown(
        typeof input.content === "string" ? input.content : "",
        options,
      );
    case "html":
      return renderHtml(
        typeof input.content === "string" ? input.content : "",
        options,
      );
    case "tiptap":
      return renderTiptapNodes(
        Array.isArray(input.content) ? input.content : [],
        options,
        "node",
      );
    default:
      return null;
  }
}

export function ParagraphContent(props: ParagraphContentProps) {
  const resolvedInput = resolveContentInput(props);

  if (resolvedInput.content === undefined || resolvedInput.content === null) {
    return null;
  }

  const options = resolveRenderOptions(props);
  const renderedContent = renderParagraphContent({
    content: resolvedInput.content,
    contentFormat: resolvedInput.contentFormat,
    components: options.components,
    classNames: options.classNames,
    markedOptions: options.markedOptions,
    sanitizeOptions: options.sanitizeOptions,
    unstyled: options.unstyled,
  });

  return renderSlot(
    "root",
    props.as ?? "article",
    {
      className: props.className,
      children: renderedContent,
    } satisfies HTMLAttributes<HTMLElement>,
    options,
  );
}
