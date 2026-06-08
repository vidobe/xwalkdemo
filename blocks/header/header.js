import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const isDesktop = window.matchMedia('(min-width: 900px)');

const ICON_HOUSE = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`;
const ICON_WAFFLE = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"/></svg>`;
const ICON_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

function toggleAllNavSections(sections, expanded = false) {
  sections.querySelectorAll('.nav-sections .default-content-wrapper > ul > li').forEach((section) => {
    section.setAttribute('aria-expanded', expanded);
  });
}

function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  const navDrops = navSections.querySelectorAll('.nav-drop');
  if (isDesktop.matches) {
    navDrops.forEach((drop) => {
      if (!drop.hasAttribute('tabindex')) {
        drop.setAttribute('tabindex', 0);
        drop.addEventListener('focus', () => {
          drop.addEventListener('keydown', (e) => {
            if (e.code === 'Enter' || e.code === 'Space') {
              const dropExpanded = drop.getAttribute('aria-expanded') === 'true';
              toggleAllNavSections(navSections);
              drop.setAttribute('aria-expanded', dropExpanded ? 'false' : 'true');
            }
          });
        });
      }
    });
  } else {
    navDrops.forEach((drop) => drop.removeAttribute('tabindex'));
  }
  if (!expanded || isDesktop.matches) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
        if (navSectionExpanded && isDesktop.matches) {
          toggleAllNavSections(navSections);
          navSectionExpanded.focus();
        } else if (!isDesktop.matches) {
          toggleMenu(nav, navSections);
          nav.querySelector('button').focus();
        }
      }
    });
    nav.addEventListener('focusout', (e) => {
      if (!nav.contains(e.relatedTarget)) {
        const navSectionExpanded = navSections.querySelector('[aria-expanded="true"]');
        if (navSectionExpanded && isDesktop.matches) {
          toggleAllNavSections(navSections, false);
        } else if (!isDesktop.matches) {
          toggleMenu(nav, navSections, false);
        }
      }
    });
  }
}

export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand?.querySelector('.button');
  if (brandLink) {
    brandLink.className = '';
    brandLink.closest('.button-container').className = '';
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((navSection) => {
      if (navSection.querySelector('ul')) navSection.classList.add('nav-drop');

      // prepend icons based on link text
      const text = navSection.textContent.trim().toLowerCase();
      if (text.startsWith('home')) {
        navSection.insertAdjacentHTML('afterbegin', `<span class="nav-icon">${ICON_HOUSE}</span>`);
      } else if (text.startsWith('menu')) {
        navSection.insertAdjacentHTML('afterbegin', `<span class="nav-icon">${ICON_WAFFLE}</span>`);
      }

      navSection.addEventListener('click', () => {
        if (isDesktop.matches) {
          const expanded = navSection.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections(navSections);
          navSection.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        }
      });
    });
  }

  // inject search + login into tools
  const navTools = nav.querySelector('.nav-tools');
  if (navTools) {
    navTools.innerHTML = `
      <form class="nav-search-form" role="search" action="/zoeken">
        <input type="text" placeholder="What are you looking for?" aria-label="Search" />
        <button type="submit" aria-label="Search" class="nav-search-btn">${ICON_SEARCH}</button>
      </form>
      <a class="nav-login" href="/inloggen">Log in</a>
    `;
  }

  // wrap sections + tools in a shared nav row
  const navRow = document.createElement('div');
  navRow.className = 'nav-row';
  if (navSections) navRow.append(navSections);
  if (navTools) navRow.append(navTools);
  nav.append(navRow);

  // hamburger
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMenu(nav, navSections));
  nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches));

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
