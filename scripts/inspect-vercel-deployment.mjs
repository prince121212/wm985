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

async function getVercel(path, label, query = {}) {
  const url = new URL(path, 'https://api.vercel.com');
  // Personal account IDs are not team IDs; project ownership is verified below.
  if (orgId.startsWith('team_')) url.searchParams.set('teamId', orgId);
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
    throw new Error(`${label}: Vercel returned HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${label}: Vercel returned an invalid JSON response.`);
  }
}

try {
  const project = await getVercel(`/v9/projects/${encodeURIComponent(projectId)}`, 'Project lookup');
  if (project.id !== projectId || project.accountId !== orgId || project.name !== expectedName) {
    throw new Error('Project identity does not match the expected project and configured owner.');
  }
  console.log(`Verified Vercel project: ${project.name}`);

  const result = await getVercel(
    `/v10/projects/${encodeURIComponent(projectId)}/env`,
    'Environment variable lookup',
    { decrypt: 'false' },
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
