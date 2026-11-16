const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export default async function globalSetup(): Promise<void> {
  const response = await fetch(`${API_URL}/api/health`);
  if (!response.ok) {
    throw new Error(
      `SportSpace API is not healthy at ${API_URL}/api/health. Start Postgres + API (docker compose up -d postgres api) before E2E.`,
    );
  }
}
