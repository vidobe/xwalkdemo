const AEM_AUTHOR = 'https://author-p60206-e1481934.adobeaemcloud.com';
const AEM_PUBLISH = 'https://publish-p60206-e1481934.adobeaemcloud.com';
const GQL = '/graphql/execute.json/securbank';
const CF_API = '/adobe/sites/cf/fragments';
const DESC_MAX = 120;

function getField(fragment, name) {
  return fragment.fields?.find((f) => f.name === name)?.values?.[0] ?? '';
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function truncate(str) {
  return str.length > DESC_MAX ? `${str.slice(0, DESC_MAX).trimEnd()}…` : str;
}

// Extract the last path segment (folder name) to derive the persisted query name.
// e.g. /content/dam/securbank/pages/articles → articles
function queryName(path) {
  return path.replace(/\.html$/, '').split('/').filter(Boolean).pop() ?? '';
}

// Parse a paginated GQL response — handles both standard {node,cursor} edges
// and AEM's own edge shapes.
function edgesToItems(data) {
  const paginated = Object.values(data ?? {}).find((v) => v?.edges);
  return (paginated?.edges ?? []).map((edge) => {
    const item = edge.node
      ?? Object.values(edge).find((v) => v && typeof v === 'object')
      ?? {};
    return {
      title: item.title ?? '',
      description: item.description?.plaintext
        ?? (typeof item.description === 'string' ? item.description : '')
        ?? item.body?.plaintext ?? '',
      imageUrl: item.image ?? '',
      slug: item.slug ?? '',
    };
  });
}

async function fetchViaGql(name) {
  const res = await fetch(`${AEM_PUBLISH}${GQL}/${name};first=24`);
  if (!res.ok) throw new Error(`GQL ${res.status}`);
  const { data } = await res.json();
  return edgesToItems(data);
}

async function fetchViaAuthorApi(path) {
  const url = `${AEM_AUTHOR}${CF_API}?path=${encodeURIComponent(path)}&limit=24`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`REST ${res.status}`);
  const { items } = await res.json();
  return (items ?? []).map((fragment) => ({
    title: getField(fragment, 'title'),
    description: stripHtml(getField(fragment, 'content') || getField(fragment, 'description')),
    imageUrl: getField(fragment, 'image'),
    slug: getField(fragment, 'slug'),
  }));
}

async function fetchItems(rawPath) {
  // crosswalk adds .html — strip it to get the bare JCR path
  const path = rawPath.replace(/\.html$/, '');
  const name = queryName(path);

  // Publish GQL persisted query: CORS-safe GET, no auth — works in EDS preview & live
  if (name) {
    try {
      return await fetchViaGql(name);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('cf-cards: GQL failed, trying author REST:', e.message);
    }
  }

  // Author CF REST API with session cookies: works inside Universal Editor
  return fetchViaAuthorApi(path);
}

function buildCard(item) {
  const li = document.createElement('li');
  li.className = 'cf-cards-item';

  if (item.imageUrl) {
    const fig = document.createElement('figure');
    fig.className = 'cf-cards-item-figure';
    const img = document.createElement('img');
    img.src = item.imageUrl.startsWith('http') ? item.imageUrl : `${AEM_AUTHOR}${item.imageUrl}`;
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

  if (item.slug) {
    const a = document.createElement('a');
    a.href = `/articles/${item.slug}`;
    a.className = 'cf-cards-item-link';
    a.textContent = 'Read more';
    body.append(a);
  }

  li.append(body);
  return li;
}

export default async function decorate(block) {
  // aem-content fields render as <a href="..."> (may be absolute URL or relative path)
  const link = block.querySelector('a');
  const raw = link
    ? link.getAttribute('href')
    : block.querySelector('div > div')?.textContent.trim();
  block.textContent = '';

  if (!raw) return;

  // If an absolute URL, extract just the pathname
  let path = raw;
  try { path = new URL(raw).pathname; } catch { /* already a path */ }

  const ul = document.createElement('ul');
  ul.className = 'cf-cards-list';

  try {
    const items = await fetchItems(path);
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'cf-cards-item-error';
      li.textContent = 'No content found.';
      ul.append(li);
    } else {
      items.forEach((item) => ul.append(buildCard(item)));
    }
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
