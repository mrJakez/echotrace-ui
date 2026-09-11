import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const mcpUrl = process.env.MCP_INTERNAL_URL?.replace(/\/$/, "") || "http://127.0.0.1:8090";

    return {
      beforeFiles: [
        { source: "/mcp", destination: `${mcpUrl}/mcp` },
        { source: "/mcp/:path*", destination: `${mcpUrl}/mcp/:path*` },
        { source: "/oauth/:path*", destination: `${mcpUrl}/oauth/:path*` },
        { source: "/.well-known/oauth-protected-resource", destination: `${mcpUrl}/.well-known/oauth-protected-resource` },
        { source: "/.well-known/oauth-protected-resource/mcp", destination: `${mcpUrl}/.well-known/oauth-protected-resource/mcp` },
        { source: "/.well-known/oauth-authorization-server", destination: `${mcpUrl}/.well-known/oauth-authorization-server` },
        { source: "/.well-known/oauth-authorization-server/oauth", destination: `${mcpUrl}/.well-known/oauth-authorization-server/oauth` }
      ],
      afterFiles: [],
      fallback: []
    };
  }
};

export default nextConfig;
