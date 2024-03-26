
const SmeeClient = require('smee-client');

export const smee = (sourceUrl: string, port: number) => new SmeeClient({
  source: sourceUrl,
  target: `http://localhost:${port}`,
  logger: console
})
