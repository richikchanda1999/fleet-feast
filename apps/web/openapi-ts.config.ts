import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:8000/openapi.json",
  output: {
    format: "prettier",
    lint: "eslint",
    path: "lib/api",
  },
  logs: {
    level: "debug",
  },
  plugins: [
    "@hey-api/schemas",
    {
      dates: true,
      name: "@hey-api/transformers",
    },
    {
      enums: "typescript",
      name: "@hey-api/typescript",
    },
    {
      name: "@tanstack/react-query",
      queryOptions: true,
      mutationOptions: true,
      infiniteQueryOptions: false,
    },
    {
      name: "@hey-api/client-next",
    },
  ],
});
