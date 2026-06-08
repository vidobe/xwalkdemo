// AEM endpoints – author is tried first (works in UE where user is authenticated),
// publish is the fallback for EDS delivery.
const AEM_AUTHOR = 'https://author-p60206-e1481934.adobeaemcloud.com';
const AEM_PUBLISH = 'https://publish-p60206-e1481934.adobeaemcloud.com';
const GQL_PATH = '/content/_cq_graphql/aem-demo-assets/endpoint.json';
const DESC_MAX = 120;

function buildQuery(folder) {
  return `{
    articleList(filter: {
      _path: { _expressions: [{ value: ${JSON.stringify(folder)}, _operator: STARTS_WITH }] }
    }) {
      items {
        title
        featuredImage { _publishUrl }
        main { plaintext }
      }
    }
  }`;
}

async function gqlFetch(host, folder, opts = {}) {
  const res = await fetch(`${host}${GQL_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: buildQuery(folder) }),
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = await res.json();
  // AEM GraphQL metadata fields use underscore-prefix (_publishUrl etc.)
  /* eslint-disable no-underscore-dangle */
  return (data?.articleList?.items ?? []).map((item) => ({
    title: item.title ?? '',
    imageUrl: item.featuredImage?._publishUrl ?? '',
    description: item.main?.plaintext?.trim() ?? '',
  }));
  /* eslint-enable no-underscore-dangle */
}

async function fetchArticles(folder) {
  // Try author first (succeeds in Universal Editor where the user is authenticated),
  // then fall back to the publish endpoint for EDS delivery.
  try {
    return await gqlFetch(AEM_AUTHOR, folder, { credentials: 'include' });
  } catch {
    return gqlFetch(AEM_PUBLISH, folder);
  }
}

function truncate(str) {
  return str.length > DESC_MAX ? `${str.slice(0, DESC_MAX).trimEnd()}…` : str;
}

function buildCard(item) {
  const li = document.createElement('li');
  li.className = 'cf-cards-item';

  if (item.imageUrl) {
    const fig = document.createElement('figure');
    fig.className = 'cf-cards-item-figure';
    const img = document.createElement('img');
    img.src = item.imageUrl.startsWith('http') ? item.imageUrl : `${AEM_PUBLISH}${item.imageUrl}`;
    img.alt = item.title;
    img.loading = 'lazy';
    fig.append(img);
    li.append(fig);
  }

  const body = document.createElement('div');
  body.className = 'cf-cards-item-body';

  if (item.title) {
    const h3 = document.createElement('h3');
    h3.textContent = item.title;
    body.append(h3);
  }

  if (item.description) {
    const p = document.createElement('p');
    p.textContent = truncate(item.description);
    body.append(p);
  }

  li.append(body);
  return li;
}

export default async function decorate(block) {
  // aem-content fields render as <a href="/content/dam/...">; text fields are plain text
  const link = block.querySelector('a');
  const folder = link ? link.getAttribute('href') : block.querySelector('div > div')?.textContent.trim();
  block.textContent = '';

  if (!folder) return;

  const ul = document.createElement('ul');
  ul.className = 'cf-cards-list';

  try {
    const items = await fetchArticles(folder);
    items.forEach((item) => ul.append(buildCard(item)));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('cf-cards:', err.message);
    const li = document.createElement('li');
    li.className = 'cf-cards-item-error';
    li.textContent = 'Content could not be loaded.';
    ul.append(li);
  }

  block.append(ul);
}
