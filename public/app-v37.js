const navToggle=document.querySelector('#navToggle');
const navLinks=document.querySelector('#navLinks');
navToggle?.addEventListener('click',()=>{
  const open=navLinks.classList.toggle('open');
  navToggle.setAttribute('aria-expanded',String(open));
});
navLinks?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
  navLinks.classList.remove('open');
  navToggle?.setAttribute('aria-expanded','false');
}));
document.querySelector('#year').textContent=new Date().getFullYear();

document.querySelectorAll('.request-button[data-request]').forEach(btn=>btn.addEventListener('click',()=>{
  const select=document.querySelector('#activity');
  if(select){ select.value=btn.dataset.request || ''; }
}));

const recipeModal=document.querySelector('#recipeModal');
const recipeDialog=recipeModal?.querySelector('.recipe-modal-dialog');
let lastRecipeTrigger=null;
const openRecipeModal=(trigger)=>{
  if(!recipeModal)return;
  lastRecipeTrigger=trigger||document.activeElement;
  recipeModal.hidden=false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(()=>recipeModal.classList.add('is-open'));
  recipeDialog?.querySelector('[data-close-recipe-modal]')?.focus();
};
const closeRecipeModal=()=>{
  if(!recipeModal)return;
  recipeModal.classList.remove('is-open');
  document.body.classList.remove('modal-open');
  setTimeout(()=>{recipeModal.hidden=true;lastRecipeTrigger?.focus?.();},180);
};
document.querySelectorAll('.recipe-status-trigger').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();
  openRecipeModal(btn);
}));
recipeModal?.querySelectorAll('[data-close-recipe-modal]').forEach(btn=>btn.addEventListener('click',closeRecipeModal));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&recipeModal&&!recipeModal.hidden)closeRecipeModal();});

// V37 — calculateur de proportions pour la recette cookies
const cookieCount=document.querySelector('#cookieCount');
const cookieSize=document.querySelector('#cookieSize');
const portionSummary=document.querySelector('#portionSummary');
const ingredientTitle=document.querySelector('#ingredientTitle');
const portionReset=document.querySelector('#portionReset');

if(cookieCount&&cookieSize){
  const base={
    count:11,
    size:37.5,
    mix:150,
    butter:75,
    brownSugar:65,
    whiteSugar:30,
    eggGrams:50,
    bakingPowder:3,
    salt:2,
    vanilla:5,
    chips:80
  };

  const roundSmart=(value,unit)=>{
    if(unit==='g' || unit==='ml'){
      if(value<1) return value.toFixed(1).replace('.',',');
      if(value<10) return value.toFixed(1).replace(/,0$/,'').replace('.',',');
      return String(Math.round(value));
    }
    return String(Math.round(value));
  };

  const setIngredient=(key,value,unit='g')=>{
    const el=document.querySelector(`[data-ingredient="${key}"]`);
    if(el) el.textContent=`${roundSmart(value,unit)} ${unit}`;
  };

  const updateCookieCalculator=()=>{
    let count=parseInt(cookieCount.value,10);
    if(!Number.isFinite(count)) count=base.count;
    count=Math.max(1,Math.min(40,count));
    if(String(count)!==cookieCount.value) cookieCount.value=count;

    const size=parseFloat(cookieSize.value)||base.size;
    const factor=(count*size)/(base.count*base.size);

    setIngredient('mix',base.mix*factor);
    setIngredient('butter',base.butter*factor);
    setIngredient('brownSugar',base.brownSugar*factor);
    setIngredient('whiteSugar',base.whiteSugar*factor);
    setIngredient('bakingPowder',base.bakingPowder*factor);
    setIngredient('salt',base.salt*factor);
    setIngredient('vanilla',base.vanilla*factor,'ml');
    setIngredient('chips',base.chips*factor);

    const eggEl=document.querySelector('[data-ingredient="egg"]');
    const eggGrams=base.eggGrams*factor;
    const eggCount=eggGrams/base.eggGrams;
    if(eggEl){
      if(eggCount>=0.9 && eggCount<=1.1){
        eggEl.textContent='1 œuf (≈ 50 g)';
      }else if(eggCount>=1){
        const eggs=(Math.round(eggCount*10)/10).toString().replace('.',',');
        eggEl.textContent=`≈ ${eggs} œufs (${Math.round(eggGrams)} g)`;
      }else{
        eggEl.textContent=`≈ ${roundSmart(eggGrams,'g')} g d’œuf battu`;
      }
    }

    const sizeLabel=size===25?'petit':size===50?'grand':'standard';
    if(ingredientTitle) ingredientTitle.textContent=`Pour ${count} cookie${count>1?'s':''} ${sizeLabel}${count>1?'s':''}`;
    if(portionSummary) portionSummary.textContent=`Quantités calculées pour ${count} cookie${count>1?'s':''} ${sizeLabel}${count>1?'s':''} d’environ ${String(size).replace('.5',',5')} g chacun.`;
  };

  cookieCount.addEventListener('input',updateCookieCalculator);
  cookieCount.addEventListener('change',updateCookieCalculator);
  cookieSize.addEventListener('change',updateCookieCalculator);
  portionReset?.addEventListener('click',()=>{
    cookieCount.value=base.count;
    cookieSize.value=String(base.size);
    updateCookieCalculator();
  });
  updateCookieCalculator();
}
