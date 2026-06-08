import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const isDesktop = window.matchMedia('(min-width: 900px)');

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
    navDrops.forEach((drop) => {
      drop.removeAttribute('tabindex');
    });
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
        <button type="submit" aria-label="Search"></button>
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
