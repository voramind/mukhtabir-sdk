import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "./pagination";

export function getRequiredVariable(
  value: string | string[] | undefined,
  name: string,
) {
  if (typeof value === "string" && value.length > 0) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  throw new Error(`Missing resource variable: ${name}`);
}

export function readPageQuery(url: URL) {
  const page = parsePositiveInteger(
    url.searchParams.get("page"),
    DEFAULT_PAGE,
    "page",
  );
  const pageSize = parsePositiveInteger(
    url.searchParams.get("page_size"),
    DEFAULT_PAGE_SIZE,
    "page_size",
  );

  return {
    page,
    page_size: pageSize,
  };
}

export function createPaginatedItemsPreview<T>(items: T[], maxItems = 5) {
  const itemsPreview = items.slice(0, maxItems);

  return {
    item_count: items.length,
    items_preview: itemsPreview,
    items_truncated: items.length > itemsPreview.length,
  };
}

function parsePositiveInteger(
  raw: string | null,
  fallback: number,
  field: string,
) {
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid ${field}: expected a positive integer.`);
  }

  return value;
}
