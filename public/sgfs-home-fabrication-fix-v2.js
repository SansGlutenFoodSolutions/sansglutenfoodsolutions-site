(function () {
  function norm(s) {
    return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function hasText(el, needle) {
    return norm(el && el.textContent).includes(norm(needle));
  }

  function getCard(el) {
    if (!el) return null;
    let cur = el;
    while (cur && cur !== document.body) {
      const r = cur.getBoundingClientRect ? cur.getBoundingClientRect() : null;
      if (r && r.width >= 120 && r.width <= 360 && r.height >= 45 && r.height <= 180) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  function findByExactText(text) {
    return Array.from(document.querySelectorAll('div,span,p,strong,b,h2,h3,h4'))
      .filter(el => norm(el.textContent) === norm(text))
      .sort((a,b) => a.children.length - b.children.length)[0] || null;
  }

  function findRowCards() {
    const bioLeaf = findByExactText('BIO');
    const fiveLeaf = findByExactText('5 ingrédients');
    const maizeLeaf = findByExactText('Sans maïs');
    const weightLeaf = findByExactText('500 g');
    if (!bioLeaf || !fiveLeaf || !maizeLeaf || !weightLeaf) return null;

    const cards = [bioLeaf, fiveLeaf, maizeLeaf, weightLeaf].map(getCard).filter(Boolean);
    if (cards.length !== 4) return null;

    let parent = cards[0].parentElement;
    while (parent && !cards.every(c => parent.contains(c))) parent = parent.parentElement;
    if (!parent) return null;

    const children = Array.from(parent.children).filter(el => el.nodeType === 1);
    const cardLike = children.filter(el => {
      const r = el.getBoundingClientRect();
      return r.width >= 120 && r.width <= 360 && r.height >= 45 && r.height <= 190;
    });

    return { parent, cardLike, cards };
  }

  function isFlagOnlyCard(el) {
    if (!el) return false;
    const t = norm(el.textContent);
    const hasFlagVisual = !!el.querySelector('svg,img,picture') || /🇫🇷/.test(el.textContent || '');
    return hasFlagVisual && (t === '' || t === 'fr' || t === 'français' || t === 'francais');
  }

  function isFabricationCard(el) {
    const t = norm(el && el.textContent);
    return t.includes('fabrication française') || t.includes('fabrication francaise');
  }

  function floatingFlagHTML() {
    return `
      <span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:24px;flex:0 0 34px;">
        <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" width="34" height="24" style="display:block;overflow:visible;filter:drop-shadow(0 1px 1px rgba(0,0,0,.16));">
          <defs>
            <clipPath id="sgfsFabClipV2"><path d="M2 4 C10 1 18 7 30 4 C42 1 50 7 58 4 L58 36 C50 39 42 33 30 36 C18 39 10 33 2 36 Z"/></clipPath>
          </defs>
          <g clip-path="url(#sgfsFabClipV2)">
            <rect x="0" y="0" width="20" height="40" fill="#0055A4"/>
            <rect x="20" y="0" width="20" height="40" fill="#FFFFFF"/>
            <rect x="40" y="0" width="20" height="40" fill="#EF4135"/>
          </g>
          <path d="M2 4 C10 1 18 7 30 4 C42 1 50 7 58 4 L58 36 C50 39 42 33 30 36 C18 39 10 33 2 36 Z" fill="none" stroke="rgba(0,0,0,.10)" stroke-width=".8"/>
        </svg>
      </span>`;
  }

  function fabricationHTML() {
    return `
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:52px;">
        ${floatingFlagHTML()}
        <span style="display:inline-flex;flex-direction:column;align-items:flex-start;line-height:1.05;text-align:left;">
          <span style="font-weight:700;color:#0f6b4c;">Fabrication</span>
          <span style="font-weight:700;color:#0f6b4c;">française</span>
        </span>
      </div>`;
  }

  function run() {
    const row = findRowCards();
    if (!row) return;

    let fabrication = row.cardLike.find(isFabricationCard) || row.cardLike.find(isFlagOnlyCard) || null;

    if (!fabrication) {
      fabrication = row.cards[0].cloneNode(true);
      fabrication.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      row.parent.appendChild(fabrication);
    }

    fabrication.innerHTML = fabricationHTML();
    fabrication.setAttribute('data-sgfs-fabrication-card', 'true');

    // Place CE bloc à droite, sans déplacer les 4 autres.
    row.parent.appendChild(fabrication);

    // Supprime uniquement les doublons fabrication / drapeau-seul éventuels.
    Array.from(row.parent.children).forEach(el => {
      if (el === fabrication) return;
      if (isFabricationCard(el) || isFlagOnlyCard(el)) el.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  setTimeout(run, 250);
  setTimeout(run, 900);
})();
