// MCPサーバー（stdio版 = パソコンのClaude Desktop / Claude Code 用）。
// ツールの定義と実装は mcp/tools.js に共通化してある。
// スマホ等からのリモート接続は server.js の /mcp/:token（HTTP版）を使う。

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, callTool } from "./tools.js";

const server = new Server(
  { name: "my-day", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const result = await callTool(req.params.name, req.params.arguments || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `エラー: ${err.message}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("LifeOS MCP server (stdio) running");
