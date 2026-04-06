import { describe, expect, it, vi } from "vitest";

import { paginate } from "../../src/core/pagination";

describe("paginate", () => {
  it("iterates through all pages", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: 1 }, { id: 2 }],
        pagination: {
          page: 1,
          page_size: 2,
          total: 3,
          total_pages: 2,
          has_more: true,
        },
        meta: { request_id: "req_1", timestamp: "2026-03-14T00:00:00Z" },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ id: 3 }],
        pagination: {
          page: 2,
          page_size: 2,
          total: 3,
          total_pages: 2,
          has_more: false,
        },
        meta: { request_id: "req_2", timestamp: "2026-03-14T00:00:01Z" },
      });

    const items = [];
    for await (const item of paginate(fetchPage, { page_size: 2 })) {
      items.push(item);
    }

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, { page: 1, page_size: 2 });
    expect(fetchPage).toHaveBeenNthCalledWith(2, { page: 2, page_size: 2 });
  });
});
