/**
 * Randomises the product order of every collection in the store.
 *
 * Shopify only holds a custom order on collections whose sort is "Manual", so each
 * collection is switched to Manual first (its existing order is kept until the
 * shuffle is written), then every product is given a new random position.
 *
 * Environment:
 *   SHOPIFY_STORE_DOMAIN   e.g. your-store.myshopify.com
 *   SHOPIFY_CLIENT_ID      Client ID of the Dev Dashboard app installed on the store
 *   SHOPIFY_CLIENT_SECRET  Client secret of that app (scopes: read_products, write_products)
 *   SHOPIFY_ADMIN_TOKEN    optional: a ready-made Admin API token, used instead of the client ID/secret
 *   ONLY_HANDLES          optional, comma-separated collection handles to limit the run to
 *   EXCLUDE_HANDLES       optional, comma-separated collection handles to leave alone
 *   DRY_RUN               "true" to log what would happen without changing anything
 */

const API_VERSION = '2026-01';
const MOVES_PER_CALL = 250; // Shopify's limit for collectionReorderProducts

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
let token = process.env.SHOPIFY_ADMIN_TOKEN;
const dryRun = process.env.DRY_RUN === 'true';
const list = (value) => new Set((value || '').split(',').map((s) => s.trim()).filter(Boolean));
const onlyHandles = list(process.env.ONLY_HANDLES);
const excludeHandles = list(process.env.EXCLUDE_HANDLES);

if (!domain || !(token || (clientId && clientSecret))) {
  console.error('Missing SHOPIFY_STORE_DOMAIN, or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.');
  process.exit(1);
}

/**
 * Dev Dashboard apps don't show a token in the admin: the app's client ID and secret are
 * exchanged for a short-lived Admin API token (valid 24 hours) at the start of each run.
 */
async function requestToken() {
  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  if (!response.ok) {
    throw new Error(
      `Could not get an access token (HTTP ${response.status}). Check the client ID and secret, and that the app is installed on the store.`
    );
  }
  const body = await response.json();
  if (!body.access_token) throw new Error('Shopify did not return an access token.');
  return body.access_token;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function gql(query, variables = {}) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables }),
    });

    const retryable = response.status === 429 || response.status >= 500;
    const body = retryable ? null : await response.json();
    const throttled = body?.errors?.some((error) => error.extensions?.code === 'THROTTLED');

    if ((retryable || throttled) && attempt < 6) {
      await sleep(2000 * attempt);
      continue;
    }
    if (!response.ok) throw new Error(`Shopify responded ${response.status}`);
    if (body.errors) throw new Error(JSON.stringify(body.errors));
    return body.data;
  }
}

async function allCollections() {
  const collections = [];
  let after = null;
  do {
    const data = await gql(
      `query ($after: String) {
        collections(first: 100, after: $after) {
          nodes { id handle title sortOrder }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { after }
    );
    collections.push(...data.collections.nodes);
    after = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null;
  } while (after);
  return collections;
}

async function productIds(collectionId) {
  const ids = [];
  let after = null;
  do {
    const data = await gql(
      `query ($id: ID!, $after: String) {
        collection(id: $id) {
          products(first: 250, after: $after) {
            nodes { id }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`,
      { id: collectionId, after }
    );
    const products = data.collection.products;
    ids.push(...products.nodes.map((product) => product.id));
    after = products.pageInfo.hasNextPage ? products.pageInfo.endCursor : null;
  } while (after);
  return ids;
}

/** Fisher-Yates: every ordering is equally likely. */
function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function waitForJob(jobId) {
  for (let i = 0; i < 120; i++) {
    const data = await gql(`query ($id: ID!) { job(id: $id) { done } }`, { id: jobId });
    if (!data.job || data.job.done) return;
    await sleep(1000);
  }
  throw new Error(`Reorder job ${jobId} did not finish in time`);
}

async function setManualSort(collection) {
  const data = await gql(
    `mutation ($input: CollectionInput!) {
      collectionUpdate(input: $input) { userErrors { field message } }
    }`,
    { input: { id: collection.id, sortOrder: 'MANUAL' } }
  );
  const errors = data.collectionUpdate.userErrors;
  if (errors.length) throw new Error(errors.map((error) => error.message).join('; '));
}

async function reshuffle(collection) {
  const ids = await productIds(collection.id);
  if (ids.length < 2) return `skipped (${ids.length} products)`;
  if (dryRun) return `would shuffle ${ids.length} products${collection.sortOrder === 'MANUAL' ? '' : ', after switching sort to Manual'}`;

  if (collection.sortOrder !== 'MANUAL') await setManualSort(collection);

  // Moves are applied in order, so placing the shuffled products at positions 0, 1, 2...
  // one after another produces exactly the shuffled order. Each batch must finish before the next starts.
  const moves = shuffled(ids).map((id, index) => ({ id, newPosition: String(index) }));

  for (let start = 0; start < moves.length; start += MOVES_PER_CALL) {
    const data = await gql(
      `mutation ($id: ID!, $moves: [MoveInput!]!) {
        collectionReorderProducts(id: $id, moves: $moves) {
          job { id done }
          userErrors { field message }
        }
      }`,
      { id: collection.id, moves: moves.slice(start, start + MOVES_PER_CALL) }
    );
    const { job, userErrors } = data.collectionReorderProducts;
    if (userErrors.length) throw new Error(userErrors.map((error) => error.message).join('; '));
    if (job && !job.done) await waitForJob(job.id);
  }

  return `shuffled ${ids.length} products`;
}

if (!token) token = await requestToken();

const collections = (await allCollections()).filter(
  (collection) =>
    (onlyHandles.size === 0 || onlyHandles.has(collection.handle)) && !excludeHandles.has(collection.handle)
);

console.log(`${dryRun ? '[dry run] ' : ''}${collections.length} collections to reshuffle`);

let failed = 0;
for (const collection of collections) {
  try {
    console.log(`${collection.handle}: ${await reshuffle(collection)}`);
  } catch (error) {
    failed++;
    console.error(`${collection.handle}: FAILED - ${error.message}`);
  }
}

if (failed) {
  console.error(`${failed} of ${collections.length} collections failed`);
  process.exit(1);
}
