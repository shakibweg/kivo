import { pageService } from '../page.service';
import { ApiPage } from '../../types/page';
import { sanitizeHtml } from '../../utils/htmlSanitizer';
import { AiAction } from './types';

const MAX_TITLE_LENGTH = 200;
const MAX_ICON_LENGTH = 20;
const MAX_READ_CHARS = 40_000;
const MAX_LISTED_PAGES = 300;
const MAX_DELETES_PER_REQUEST = 5;

export interface ToolContext {
  userId: string | null;
  actions: AiAction[];
  deleteCount: number;
  onAction?: (action: AiAction) => void;
}

function recordAction(ctx: ToolContext, action: AiAction) {
  ctx.actions.push(action);
  ctx.onAction?.(action);
}

type ToolArgs = Record<string, unknown>;
type ToolResult = Record<string, unknown>;

const stringProp = (description: string) => ({ type: 'string', description });

/**
 * Function declarations exposed to the model (Gemini Interactions API format).
 */
export const PAGE_TOOL_DECLARATIONS = [
  {
    type: 'function',
    name: 'list_pages',
    description:
      "Lists every page in the user's workspace (id, title, parent_id, icon, depth). Call this to find a page by name or to see how pages are organised.",
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function',
    name: 'read_page',
    description: 'Reads one page and returns its title and its content as HTML.',
    parameters: {
      type: 'object',
      properties: { page_id: stringProp('The id of the page to read.') },
      required: ['page_id'],
    },
  },
  {
    type: 'function',
    name: 'create_page',
    description: 'Creates a new page, optionally with initial content, icon emoji, cover image banner URL, nested under a parent page.',
    parameters: {
      type: 'object',
      properties: {
        title: stringProp('Title of the new page.'),
        content_html: stringProp('Initial page content as HTML. Omit for an empty page.'),
        parent_id: stringProp('Id of the parent page to nest this page under. Omit for a top-level page.'),
        icon: stringProp('A single emoji to use as the page icon, e.g. "📚" or "🚀". Optional.'),
        cover_image: stringProp('A URL for the page banner cover image (e.g. from Unsplash). Optional.'),
      },
      required: ['title'],
    },
  },
  {
    type: 'function',
    name: 'update_page',
    description:
      "Changes a page's title, icon, cover image and/or content. Use content_mode 'append' to add content at the end, 'prepend' to add at the start, or 'replace' to rewrite the whole page. For small edits to existing text prefer replace_in_page.",
    parameters: {
      type: 'object',
      properties: {
        page_id: stringProp('The id of the page to update.'),
        title: stringProp('New title. Omit to keep the current title.'),
        icon: stringProp('New emoji icon. Use an empty string to remove the icon. Omit to keep it.'),
        cover_image: stringProp('New cover image URL for the banner. Use an empty string to remove the cover image. Omit to keep it.'),
        content_html: stringProp('HTML content to apply according to content_mode.'),
        content_mode: {
          type: 'string',
          enum: ['append', 'prepend', 'replace'],
          description: "How to apply content_html. Defaults to 'append'.",
        },
      },
      required: ['page_id'],
    },
  },
  {
    type: 'function',
    name: 'replace_in_page',
    description:
      "Finds exact text/HTML in a page's content and replaces it. Use this for precise edits such as fixing a typo or changing a sentence. The find string must match the page HTML exactly (use read_page first if unsure).",
    parameters: {
      type: 'object',
      properties: {
        page_id: stringProp('The id of the page to edit.'),
        find: stringProp('The exact text to find.'),
        replace_with: stringProp('The text or HTML to put in its place. Use an empty string to delete the matched text.'),
        replace_all: { type: 'boolean', description: 'Replace every occurrence instead of only the first. Defaults to false.' },
      },
      required: ['page_id', 'find', 'replace_with'],
    },
  },
  {
    type: 'function',
    name: 'delete_page',
    description:
      'Permanently deletes a page AND all of its sub-pages. This cannot be undone. Only call it when the user explicitly asked to delete that page.',
    parameters: {
      type: 'object',
      properties: { page_id: stringProp('The id of the page to delete.') },
      required: ['page_id'],
    },
  },
  {
    type: 'function',
    name: 'search_pages',
    description:
      "Searches pages across the workspace by keyword in their titles and content. Returns matching pages, snippets, and presents clickable buttons to the user.",
    parameters: {
      type: 'object',
      properties: {
        query: stringProp('The search term or keyword to find.'),
      },
      required: ['query'],
    },
  },
];

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

function requirePageId(args: ToolArgs): string | null {
  const id = asString(args.page_id)?.trim();
  return id ? id : null;
}

interface FlatPage {
  id: string;
  title: string;
  parent_id: string | null;
  icon: string | null;
  depth: number;
  updated_at?: string;
}

function flatten(pages: ApiPage[], depth = 0, out: FlatPage[] = []): FlatPage[] {
  for (const page of pages) {
    out.push({
      id: page.id,
      title: page.title,
      parent_id: page.parentId ?? null,
      icon: page.icon ?? null,
      depth,
      updated_at: page.updatedAt,
    });
    if (page.children?.length) flatten(page.children, depth + 1, out);
  }
  return out;
}

function findInTree(pages: ApiPage[], id: string): ApiPage | null {
  for (const page of pages) {
    if (page.id === id) return page;
    const found = page.children?.length ? findInTree(page.children, id) : null;
    if (found) return found;
  }
  return null;
}

function countDescendants(page: ApiPage): number {
  return (page.children ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function cleanTitle(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const title = value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
  return title || undefined;
}

function cleanIcon(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const icon = value.trim();
  if (!icon) return null;
  // Icons are emoji only; reject URLs/ids so the model can't smuggle arbitrary strings in.
  if (icon.length > MAX_ICON_LENGTH || /[a-zA-Z0-9<>/:]/.test(icon)) return undefined;
  return icon;
}

function cleanCoverImage(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const url = value.trim();
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url.slice(0, 1000);
  }
  return undefined;
}

async function listPages(ctx: ToolContext): Promise<ToolResult> {
  const tree = await pageService.getPages(ctx.userId);
  const pages = flatten(tree);
  return {
    total: pages.length,
    truncated: pages.length > MAX_LISTED_PAGES,
    pages: pages.slice(0, MAX_LISTED_PAGES),
  };
}

async function readPage(args: ToolArgs, ctx: ToolContext): Promise<ToolResult> {
  const id = requirePageId(args);
  if (!id) return { error: 'page_id is required.' };

  const page = await pageService.getPageById(id, ctx.userId);
  if (!page) return { error: `No page found with id "${id}".` };

  const content = page.content ?? '';
  return {
    id: page.id,
    title: page.title,
    icon: page.icon ?? null,
    parent_id: page.parentId ?? null,
    content_html: content.slice(0, MAX_READ_CHARS),
    truncated: content.length > MAX_READ_CHARS,
  };
}

async function createPage(args: ToolArgs, ctx: ToolContext): Promise<ToolResult> {
  const title = cleanTitle(asString(args.title)) ?? 'Untitled';
  const parentId = asString(args.parent_id)?.trim() || null;

  if (parentId) {
    const parent = await pageService.getPageById(parentId, ctx.userId);
    if (!parent) return { error: `Parent page "${parentId}" was not found.` };
  }

  const page = await pageService.createPage({
    userId: ctx.userId,
    parentId,
    title,
    icon: cleanIcon(asString(args.icon)) ?? null,
    coverImage: cleanCoverImage(asString(args.cover_image)) ?? null,
    content: sanitizeHtml(asString(args.content_html) ?? ''),
  });

  recordAction(ctx, { type: 'created', pageId: page.id, title: page.title });
  return { ok: true, id: page.id, title: page.title, parent_id: page.parentId ?? null };
}

async function updatePage(args: ToolArgs, ctx: ToolContext): Promise<ToolResult> {
  const id = requirePageId(args);
  if (!id) return { error: 'page_id is required.' };

  const existing = await pageService.getPageById(id, ctx.userId);
  if (!existing) return { error: `No page found with id "${id}".` };

  const updates: Partial<ApiPage> = {};

  const title = cleanTitle(asString(args.title));
  if (title !== undefined) updates.title = title;

  if (args.icon !== undefined) {
    const icon = cleanIcon(asString(args.icon));
    if (icon === undefined) return { error: 'icon must be a single emoji, or an empty string to remove it.' };
    updates.icon = icon;
  }

  if (args.cover_image !== undefined) {
    const coverImage = cleanCoverImage(asString(args.cover_image));
    if (coverImage === undefined && asString(args.cover_image)?.trim()) {
      return { error: 'cover_image must be a valid http/https image URL, or empty string to remove it.' };
    }
    updates.coverImage = coverImage ?? null;
  }

  const contentHtml = asString(args.content_html);
  if (contentHtml !== undefined) {
    const mode = asString(args.content_mode) ?? 'append';
    const html = sanitizeHtml(contentHtml);
    const current = existing.content ?? '';

    if (mode === 'replace') updates.content = html;
    else if (mode === 'prepend') updates.content = html + current;
    else if (mode === 'append') updates.content = current + html;
    else return { error: "content_mode must be 'append', 'prepend' or 'replace'." };
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'Nothing to update: provide title, icon, cover_image or content_html.' };
  }

  const updated = await pageService.updatePage(id, updates, ctx.userId);
  if (!updated) return { error: `Could not update page "${id}".` };

  recordAction(ctx, { type: 'updated', pageId: updated.id, title: updated.title });
  return { ok: true, id: updated.id, title: updated.title, updated_fields: Object.keys(updates) };
}

async function replaceInPage(args: ToolArgs, ctx: ToolContext): Promise<ToolResult> {
  const id = requirePageId(args);
  if (!id) return { error: 'page_id is required.' };

  const find = asString(args.find);
  const replaceWith = asString(args.replace_with);
  if (!find) return { error: 'find must be a non-empty string.' };
  if (replaceWith === undefined) return { error: 'replace_with is required (use "" to delete the text).' };

  const existing = await pageService.getPageById(id, ctx.userId);
  if (!existing) return { error: `No page found with id "${id}".` };

  const current = existing.content ?? '';
  const occurrences = current.split(find).length - 1;
  if (occurrences === 0) {
    return { error: 'The text to find was not found in the page. Call read_page and copy the exact text/HTML.' };
  }

  const replacement = sanitizeHtml(replaceWith);
  const replaceAll = args.replace_all === true;
  const next = replaceAll
    ? current.split(find).join(replacement)
    : current.replace(find, () => replacement);

  const updated = await pageService.updatePage(id, { content: next }, ctx.userId);
  if (!updated) return { error: `Could not update page "${id}".` };

  recordAction(ctx, { type: 'updated', pageId: updated.id, title: updated.title });
  return { ok: true, id: updated.id, replaced: replaceAll ? occurrences : 1, occurrences_found: occurrences };
}

async function deletePage(args: ToolArgs, ctx: ToolContext): Promise<ToolResult> {
  const id = requirePageId(args);
  if (!id) return { error: 'page_id is required.' };

  if (ctx.deleteCount >= MAX_DELETES_PER_REQUEST) {
    return { error: `At most ${MAX_DELETES_PER_REQUEST} pages can be deleted per request. Ask the user to confirm and continue in a new message.` };
  }

  const tree = await pageService.getPages(ctx.userId);
  const target = findInTree(tree, id);
  if (!target) return { error: `No page found with id "${id}".` };

  const subPages = countDescendants(target);
  const ok = await pageService.deletePage(id, ctx.userId);
  if (!ok) return { error: `Could not delete page "${id}".` };

  ctx.deleteCount += 1;
  recordAction(ctx, { type: 'deleted', pageId: id, title: target.title });
  return { ok: true, id, title: target.title, deleted_sub_pages: subPages };
}

async function searchPages(args: ToolArgs, ctx: ToolContext): Promise<ToolResult> {
  const queryText = asString(args.query)?.trim();
  if (!queryText) return { error: 'query is required.' };

  const matches = await pageService.searchPages(queryText, ctx.userId);
  for (const page of matches) {
    recordAction(ctx, { type: 'found', pageId: page.id, title: page.title });
  }

  return {
    total: matches.length,
    query: queryText,
    pages: matches.map((p) => {
      const plain = (p.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const snippet = plain.length > 200 ? plain.slice(0, 200) + '...' : plain;
      return {
        id: p.id,
        title: p.title,
        icon: p.icon ?? null,
        snippet,
        updated_at: p.updatedAt,
      };
    }),
  };
}

/**
 * Runs one tool call. Failures are returned as { error } so the model can recover or explain.
 */
export async function executePageTool(name: string, args: unknown, ctx: ToolContext): Promise<ToolResult> {
  const safeArgs: ToolArgs = args && typeof args === 'object' ? (args as ToolArgs) : {};

  switch (name) {
    case 'list_pages':
      return listPages(ctx);
    case 'read_page':
      return readPage(safeArgs, ctx);
    case 'create_page':
      return createPage(safeArgs, ctx);
    case 'update_page':
      return updatePage(safeArgs, ctx);
    case 'replace_in_page':
      return replaceInPage(safeArgs, ctx);
    case 'delete_page':
      return deletePage(safeArgs, ctx);
    case 'search_pages':
      return searchPages(safeArgs, ctx);
    default:
      return { error: `Unknown tool "${name}".` };
  }
}
