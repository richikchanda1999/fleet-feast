import { client } from "./api/client.gen";

// Configure the API client
client.setConfig({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
});

export { client };
