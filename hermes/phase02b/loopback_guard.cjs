// Playwright MCP init-page hook. Model sees no evaluate/run-code/upload tools.
// This request guard supplements MCP's allowed-origins option.
exports.default = async ({page}) => {
  const origin = process.env.PHASE_DEMO_ORIGIN;
  if (!origin || new URL(origin).hostname !== '127.0.0.1') throw Error('Missing loopback origin');
  await page.context().route('**/*', route => {
    const target = new URL(route.request().url());
    return target.origin === origin ? route.continue() : route.abort('blockedbyclient');
  });
};
