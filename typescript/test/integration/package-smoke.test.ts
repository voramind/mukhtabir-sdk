import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, it } from "vitest";

import packageJson from "../../package.json";

const execFileAsync = promisify(execFile);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PACKAGE_SMOKE_TIMEOUT_MS = 20_000;

async function ensureBuilt(): Promise<void> {
  if (process.env.MUKHTABIR_SKIP_PACKAGE_BUILD === "1") {
    return;
  }

  await execFileAsync("npm", ["run", "build"], { cwd: packageRoot });
}

async function packPackage(): Promise<string> {
  const artifactsRoot = await mkdtemp(join(tmpdir(), "mukhtabir-sdk-pack-"));
  const { stdout } = await execFileAsync(
    "npm",
    ["pack", "--json", "--pack-destination", artifactsRoot],
    { cwd: packageRoot },
  );
  const [{ filename }] = JSON.parse(stdout.trim()) as Array<{
    filename: string;
  }>;
  return join(artifactsRoot, filename);
}

async function runProbe(root: string, filename: string): Promise<void> {
  await execFileAsync("node", [filename], { cwd: root });
}

describe("packed SDK artifact", () => {
  it(
    "loads the built package and subpath exports from a tarball",
    async () => {
      await ensureBuilt();

      const tarball = await packPackage();
      const consumerRoot = await mkdtemp(
        join(tmpdir(), "mukhtabir-sdk-consumer-"),
      );

      try {
        await writeFile(
          join(consumerRoot, "package.json"),
          JSON.stringify(
            {
              name: "mukhtabir-sdk-consumer",
              private: true,
              type: "module",
            },
            null,
            2,
          ),
        );

        await execFileAsync(
          "npm",
          ["install", "--ignore-scripts", "--no-save", tarball],
          {
            cwd: consumerRoot,
          },
        );

        const esmProbe = join(consumerRoot, "probe.mjs");
        await writeFile(
          esmProbe,
          `
import assert from "node:assert/strict";

import * as sdk from "@mukhtabir/sdk";
import * as core from "@mukhtabir/sdk/core";
import * as resources from "@mukhtabir/sdk/resources";
import * as types from "@mukhtabir/sdk/types";
import * as webhooks from "@mukhtabir/sdk/webhooks";

assert.equal(typeof sdk.Mukhtabir, "function");
assert.equal(sdk.SDK_VERSION, ${JSON.stringify(packageJson.version)});
assert.equal(typeof sdk.paginate, "function");
assert.equal(core.DEFAULT_BASE_URL, "https://mukhtabir.hbku.edu.qa/api/v1");
assert.equal(core.API_ERROR_CODES.INTERNAL_ERROR, "INTERNAL_ERROR");
assert.equal(typeof resources.InterviewsResource, "function");
assert.equal(typeof resources.WebhooksResource, "function");
assert.equal(typeof types, "object");
assert.equal(typeof webhooks.parseWebhookEvent, "function");
assert.equal(typeof webhooks.verifyWebhookSignature, "function");
assert.equal(typeof webhooks.WebhookVerificationError, "function");
`,
        );

        const cjsProbe = join(consumerRoot, "probe.cjs");
        await writeFile(
          cjsProbe,
          `
const assert = require("node:assert/strict");

const sdk = require("@mukhtabir/sdk");
const core = require("@mukhtabir/sdk/core");
const resources = require("@mukhtabir/sdk/resources");
const types = require("@mukhtabir/sdk/types");
const webhooks = require("@mukhtabir/sdk/webhooks");

assert.equal(typeof sdk.Mukhtabir, "function");
assert.equal(sdk.SDK_VERSION, ${JSON.stringify(packageJson.version)});
assert.equal(typeof core.paginate, "function");
assert.equal(typeof core.DEFAULT_BASE_URL, "string");
assert.equal(typeof resources.CandidatesResource, "function");
assert.equal(typeof resources.FeedbackResource, "function");
assert.equal(typeof types, "object");
assert.equal(typeof webhooks.computeWebhookSignature, "function");
assert.equal(typeof webhooks.parseWebhookEvent, "function");
`,
        );

        const typeProbe = join(consumerRoot, "probe-types.ts");
        await writeFile(
          typeProbe,
          `
import { Mukhtabir, type MukhtabirClient } from "@mukhtabir/sdk";
import { paginate, type ApiSuccessResponse } from "@mukhtabir/sdk/core";
import { CandidatesResource } from "@mukhtabir/sdk/resources";
import type { CandidateDetail, CandidateSummary, CreateCandidateRequest } from "@mukhtabir/sdk/types";
import type { ParsedWebhookEvent } from "@mukhtabir/sdk/webhooks";

const client: MukhtabirClient = new Mukhtabir({
  apiKey: "mk_test",
  retry: false,
  fetch: async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: [],
        pagination: {
          page: 1,
          page_size: 1,
          total: 0,
          total_pages: 0,
          has_more: false,
        },
        meta: { request_id: "req_1", timestamp: "2026-03-14T00:00:00Z" },
      }),
    ),
});

const createCandidate: CreateCandidateRequest = {
  email: "candidate@example.com",
  name: "Candidate Example",
};
void createCandidate;

const detailPromise: Promise<ApiSuccessResponse<CandidateDetail>> = client.candidates.get(
  "candidate@example.com",
);
void detailPromise;

const resource: CandidatesResource = client.candidates;
void resource;

const paginatedCandidates: AsyncIterable<CandidateSummary> = paginate(async () => ({
  success: true,
  data: [
    {
      email: "candidate@example.com",
      name: "Candidate Example",
      total_tokens: 0,
      completed_interviews: 0,
      first_invited_at: "2026-03-14T00:00:00Z",
      last_invited_at: "2026-03-14T00:00:00Z",
    },
  ],
  pagination: {
    page: 1,
    page_size: 1,
    total: 1,
    total_pages: 1,
    has_more: false,
  },
  meta: { request_id: "req_2", timestamp: "2026-03-14T00:00:01Z" },
}));
void paginatedCandidates;

const parsedEvent: Promise<ParsedWebhookEvent> = Promise.resolve({} as ParsedWebhookEvent);
void parsedEvent;
`,
        );

        const tsconfigPath = join(consumerRoot, "tsconfig.json");
        await writeFile(
          tsconfigPath,
          JSON.stringify(
            {
              compilerOptions: {
                module: "NodeNext",
                moduleResolution: "NodeNext",
                target: "ES2022",
                lib: ["ES2022", "DOM"],
                noEmit: true,
                strict: true,
                skipLibCheck: true,
              },
              include: ["./probe-types.ts"],
            },
            null,
            2,
          ),
        );

        await runProbe(consumerRoot, esmProbe);
        await runProbe(consumerRoot, cjsProbe);
        await execFileAsync(
          "node",
          [
            resolve(packageRoot, "node_modules/typescript/bin/tsc"),
            "--project",
            tsconfigPath,
          ],
          { cwd: consumerRoot },
        );
      } finally {
        await rm(consumerRoot, { recursive: true, force: true });
        await rm(dirname(tarball), { recursive: true, force: true });
      }
    },
    PACKAGE_SMOKE_TIMEOUT_MS,
  );
});
