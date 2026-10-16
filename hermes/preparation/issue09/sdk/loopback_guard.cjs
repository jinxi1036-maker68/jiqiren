// Inherited simulation-only page guard; not a production read-only policy.
exports.default=async({page})=>{const origin=process.env.PHASE_DEMO_ORIGIN;if(!origin||new URL(origin).hostname!=='127.0.0.1')throw Error('Missing loopback origin');await page.context().route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));};

