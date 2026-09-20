(() => {
  const start = () => {
    const visualTargets = [
      document.querySelector('.hero-product-card'),
      ...document.querySelectorAll('.recipe-image')
    ].filter(Boolean);
    visualTargets.forEach(el => el.classList.add('slide-visual'));
    const sectionTargets = [
      ...document.querySelectorAll('.availability-shell, .mix-feature-grid, .composition-copy, .composition-benefits, .certification-note, .section-head, .how-shell, .market-grid, .faq-list, .brand-section, .contact-heading')
    ];
    sectionTargets.forEach(el => el.classList.add('scroll-section-reveal'));
    const targets=[...visualTargets,...sectionTargets];
    if(!('IntersectionObserver' in window)){targets.forEach(el=>el.classList.add('is-visible'));return;}
    const obs=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');obs.unobserve(entry.target)}}),{threshold:.1,rootMargin:'0px 0px -10% 0px'});
    targets.forEach(el=>obs.observe(el));
    setTimeout(()=>targets.forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight*.9&&r.bottom>0){el.classList.add('is-visible');obs.unobserve(el)}}),80);
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
