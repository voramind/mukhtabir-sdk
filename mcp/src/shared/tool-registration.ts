import type {
  McpServer,
  ToolCallback,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  AnySchema,
  SchemaOutput,
  ShapeOutput,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";

import type {
  MukhtabirMcpAccessLevel,
  MukhtabirMcpAuthorizationPolicy,
} from "../authorization";
import type { MukhtabirMcpAuditLogger } from "./audit";
import { wrapToolHandler } from "./handler-wrappers";
import { createToolResult } from "./mcp-content";

type HandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;
type ToolResult = ReturnType<typeof createToolResult>;
type ToolInput<Schema extends ZodRawShapeCompat | AnySchema> =
  Schema extends ZodRawShapeCompat
    ? ShapeOutput<Schema>
    : Schema extends AnySchema
      ? SchemaOutput<Schema>
      : never;

interface ToolDefinition<Shape extends ZodRawShapeCompat | AnySchema> {
  name: string;
  description: string;
  inputSchema: Shape;
  annotations?: ToolAnnotations;
  handler: (args: ToolInput<Shape>, extra: HandlerExtra) => Promise<ToolResult>;
}

export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  openWorldHint: false,
} as const satisfies ToolAnnotations;

export const DESTRUCTIVE_TOOL_ANNOTATIONS = {
  destructiveHint: true,
  openWorldHint: false,
} as const satisfies ToolAnnotations;

function createToolAccessOptions(
  authorization: MukhtabirMcpAuthorizationPolicy,
) {
  return {
    read: {
      authorization,
      requiredAccess: "read" as const,
    },
    write: {
      authorization,
      requiredAccess: "write" as const,
    },
    delete: {
      authorization,
      requiredAccess: "delete" as const,
    },
  };
}

export function createToolRegistrar(
  server: McpServer,
  authorization: MukhtabirMcpAuthorizationPolicy,
  auditLogger?: MukhtabirMcpAuditLogger,
) {
  const access = createToolAccessOptions(authorization);

  function registerToolForAccess<Shape extends ZodRawShapeCompat | AnySchema>(
    requiredAccess: MukhtabirMcpAccessLevel,
    name: string,
    config: {
      description: string;
      inputSchema: Shape;
      annotations?: ToolAnnotations;
    },
    handler: ToolDefinition<Shape>["handler"],
  ) {
    if (!authorization.allows(requiredAccess)) {
      return;
    }

    const wrappedHandler = wrapToolHandler(
      server,
      name,
      handler,
      access[requiredAccess],
      auditLogger,
    ) as ToolCallback<Shape>;

    server.registerTool(name, config, wrappedHandler);
  }

  return {
    registerReadTool: <Shape extends ZodRawShapeCompat | AnySchema>(
      definition: ToolDefinition<Shape>,
    ) =>
      registerToolForAccess(
        "read",
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.inputSchema,
          annotations: definition.annotations,
        },
        definition.handler,
      ),
    registerWriteTool: <Shape extends ZodRawShapeCompat | AnySchema>(
      definition: ToolDefinition<Shape>,
    ) =>
      registerToolForAccess(
        "write",
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.inputSchema,
          annotations: definition.annotations,
        },
        definition.handler,
      ),
    registerDeleteTool: <Shape extends ZodRawShapeCompat | AnySchema>(
      definition: ToolDefinition<Shape>,
    ) =>
      registerToolForAccess(
        "delete",
        definition.name,
        {
          description: definition.description,
          inputSchema: definition.inputSchema,
          annotations: definition.annotations,
        },
        definition.handler,
      ),
  };
}
