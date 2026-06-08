const AEM_AUTHOR = 'https://author-p60206-e1481934.adobeaemcloud.com';
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

async function fetchArticles(folder) {
  // aem-content href may be an absolute URL — extract just the pathname
  let path = folder;
  try { path = new URL(folder).pathname; } catch { /* already a path */ }
  const url = `${AEM_AUTHOR}${CF_API}?path=${encodeURIComponent(path)}&limit=24`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { items } = await res.json();
  return (items ?? []).map((fragment) => ({
    title: getField(fragment, 'title'),
    imageUrl: getField(fragment, 'image'),
    description: stripHtml(getField(fragment, 'content')),
  }));
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
