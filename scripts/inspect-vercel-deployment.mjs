// Read-only preflight. Never log API response bodies or environment variable values.
// https://vercel.com/docs/rest-api/projects/find-a-project-by-id-or-name
// https://vercel.com/docs/rest-api/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name

const requiredCredentials = ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'];
const missingCredentials = requiredCredentials.filter((key) => !process.env[key]?.trim());
if (missingCredentials.length) {
  console.error(`Missing GitHub Actions secrets: ${missingCredentials.join(', ')}`);
  process.exit(1);
}

const projectId = process.env.VERCEL_PROJECT_ID.trim();
const orgId = process.env.VERCEL_ORG_ID.trim();
const expectedName = process.env.VERCEL_EXPECTED_PROJECT_NAME || 'wm985-production';
const inspectOnly = process.env.VERCEL_INSPECT_ONLY === 'true';
const expectedTeamSlug = '16088400qq-9609s-projects';

function reportIdentity(project, label) {
  const matches = {
    id: project?.id === projectId,
    owner: project?.accountId === orgId,
    name: project?.name === expectedName,
  };
  const safeName = typeof project?.name === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(project.name)
    ? project.name : '(invalid project name)';
  console.log(`${label}: ${safeName}`);
  console.log(`Configured identity matches: id=${matches.id}, owner=${matches.owner}, name=${matches.name}`);
  return matches;
}

async function getVercel(path, label, query = {}) {
  const url = new URL(path, 'https://api.vercel.com');
  // Personal account IDs are not team IDs; project ownership is verified below.
  if (!query.slug && orgId.startsWith('team_')) url.searchParams.set('teamId', orgId);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(`${label}: network request failed or timed out.`);
  }
  if (!response.ok) {
    // Error bodies may contain credentials or private metadata. Only print status.
    throw Object.assign(new Error(`${label}: Vercel returned HTTP ${response.status}.`), { status: response.status });
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}: Vercel returned an invalid JSON response.`);
  }
}

try {
  let targetScope = {};
  let project = await getVercel(`/v9/projects/${encodeURIComponent(projectId)}`, 'Project lookup');
  const matches = reportIdentity(project, 'Configured Vercel project');
  const configuredIdentityMatches = matches.id && matches.owner && matches.name;
  if (!configuredIdentityMatches && !inspectOnly) {
    throw new Error('Project identity does not match the expected project and configured owner.');
  }
  if (!matches.name) {
    try {
      project = await getVercel(`/v9/projects/${encodeURIComponent(expectedName)}`, 'Expected project lookup');
    } catch (error) {
      if (!inspectOnly || ![403, 404].includes(error.status)) throw error;
      // This exact team slug was observed in the repository's Vercel deployment status.
      // Do not enumerate unrelated teams or projects when existing secrets point elsewhere.
      targetScope = { slug: expectedTeamSlug };
      console.log('Expected project unavailable in configured scope; inspecting the known deployment team.');
      project = await getVercel(`/v9/projects/${encodeURIComponent(expectedName)}`, 'Known team project lookup', targetScope);
    }
    reportIdentity(project, 'Expected Vercel project');
  }
  const repositoryMatches = project?.link?.org === 'prince121212' && project?.link?.repo === 'wm985';
  console.log(`Expected GitHub repository matches: ${repositoryMatches}`);
  if (project?.name !== expectedName || !repositoryMatches || typeof project?.id !== 'string') {
    throw new Error('Expected project name or linked GitHub repository could not be verified.');
  }
  if (!configuredIdentityMatches) {
    console.log('Read-only inspection found the target project. Configured project/owner secrets still require correction before production deployment.');
    process.exitCode = 1;
  }
  console.log(`Verified Vercel project: ${project.name}`);

  const result = await getVercel(
    `/v10/projects/${encodeURIComponent(project.id)}/env`,
    'Environment variable lookup',
    { ...targetScope, decrypt: 'false' },
  );
  const envs = Array.isArray(result) ? result : result.envs;
  if (!Array.isArray(envs)) throw new Error('Unexpected environment variable list format.');
  const keys = [...new Set(envs.filter((entry) => {
    const targets = Array.isArray(entry.target) ? entry.target : [entry.target];
    return targets.includes('production') && !entry.gitBranch;
  }).map((entry) => entry.key))].sort();
  if (keys.some((key) => typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) {
    throw new Error('Environment variable list includes an invalid key name.');
  }

  console.log(`Production environment variable names (${keys.length}):`);
  for (const key of keys) console.log(`  ${key}`);

  const requiredKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WECHAT_MP_APPID', 'WECHAT_MP_SECRET'];
  const missing = requiredKeys.filter((key) => !keys.includes(key));
  const signingKeys = ['MP_TOKEN_SECRET', 'AUTH_SECRET', 'NEXTAUTH_SECRET'];
  if (!signingKeys.some((key) => keys.includes(key))) missing.push(`one of ${signingKeys.join(' / ')}`);
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}. Local or previously committed .env files do not count as Vercel configuration.`);
  }
  console.log('Required production variable names are present. Values and external connectivity have not been verified.');
  console.log('Read-only inspection complete. No project settings changed and no deployment created.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
