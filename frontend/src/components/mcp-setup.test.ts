import { expect, it } from "vitest";

import { mcpSnippets } from "./mcp-setup";

it("keeps the key out of the URL in every snippet", () => {
  const url = "https://mcp.gtaclipper.com/mcp";
  const snippets = mcpSnippets(url, "sk_test");
  expect(snippets.claudeCode).toBe(
    'claude mcp add --transport http gtaclipper https://mcp.gtaclipper.com/mcp --header "Authorization: Bearer sk_test"',
  );
  expect(JSON.parse(snippets.json).mcpServers.gtaclipper).toEqual({
    url,
    headers: { Authorization: "Bearer sk_test" },
  });
  const desktop = JSON.parse(snippets.claudeDesktop).mcpServers.gtaclipper;
  expect(desktop.args).toContain(url);
  expect(desktop.env.GTACLIPPER_AUTH).toBe("Bearer sk_test");
  expect(snippets.stdio).toContain("GTACLIPPER_API_KEY=sk_test");
});
