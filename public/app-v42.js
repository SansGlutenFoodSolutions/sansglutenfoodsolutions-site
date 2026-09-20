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

// V39 — calculateur de proportions pour la recette crêpes
const crepeCount=document.querySelector('#crepeCount');
const crepePortionSummary=document.querySelector('#crepePortionSummary');
const crepeIngredientTitle=document.querySelector('#crepeIngredientTitle');
const crepePortionReset=document.querySelector('#crepePortionReset');

if(crepeCount){
  const base={count:3,mix:50,milk:175,egg:1};

  const roundSmart=(value)=>{
    if(value<1) return value.toFixed(1).replace('.',',');
    if(value<10) return value.toFixed(1).replace(/,0$/,'').replace('.',',');
    return String(Math.round(value));
  };

  const fractionEgg=(value)=>{
    const rounded=Math.round(value*3)/3;
    const whole=Math.floor(rounded+1e-9);
    const frac=Math.round((rounded-whole)*3);
    const fracText=frac===1?'⅓':frac===2?'⅔':'';
    if(whole===0 && fracText) return `${fracText} œuf battu`;
    if(fracText) return `${whole}${fracText} œuf${whole>1?'s':''} battu${whole>1?'s':''}`;
    return `${whole} œuf${whole>1?'s':''}`;
  };

  const updateCrepeCalculator=()=>{
    let count=parseInt(crepeCount.value,10);
    if(!Number.isFinite(count)) count=base.count;
    count=Math.max(1,Math.min(24,count));
    if(String(count)!==crepeCount.value) crepeCount.value=count;
    const factor=count/base.count;

    const mixEl=document.querySelector('[data-crepe-ingredient="mix"]');
    const milkEl=document.querySelector('[data-crepe-ingredient="milk"]');
    const eggEl=document.querySelector('[data-crepe-ingredient="egg"]');
    if(mixEl) mixEl.textContent=`${roundSmart(base.mix*factor)} g`;
    if(milkEl) milkEl.textContent=`${roundSmart(base.milk*factor)} ml`;
    if(eggEl) eggEl.textContent=fractionEgg(base.egg*factor);

    if(crepeIngredientTitle) crepeIngredientTitle.textContent=`Pour ${count} crêpe${count>1?'s':''} de 28 cm`;
    if(crepePortionSummary) crepePortionSummary.textContent=`Quantités calculées pour ${count} crêpe${count>1?'s':''} d’environ 28 cm de diamètre.`;
  };

  crepeCount.addEventListener('input',updateCrepeCalculator);
  crepeCount.addEventListener('change',updateCrepeCalculator);
  crepePortionReset?.addEventListener('click',()=>{crepeCount.value=base.count;updateCrepeCalculator();});
  updateCrepeCalculator();
}


// V42 — calculateur indicatif de proportions pour la génoise selon le diamètre du moule, jusqu’à 45 cm
const genoiseDiameter=document.querySelector('#genoiseDiameter');
const genoiseSummary=document.querySelector('#genoisePortionSummary');
const genoiseIngredientTitle=document.querySelector('#genoiseIngredientTitle');
const genoiseReset=document.querySelector('#genoisePortionReset');

if(genoiseDiameter){
  const base={diameter:10,mix:31.25,sugar:31.25,egg:1,powderSachet:0.125,saltPinch:1};

  const fr=(value,digits=1)=>Number(value.toFixed(digits)).toString().replace('.',',');
  const grams=(value)=> value<10 ? `${fr(value,1)} g` : `${fr(value, value%1 ? 1 : 0)} g`;

  const eggText=(value)=>{
    if(Math.abs(value-Math.round(value))<0.06){
      const n=Math.round(value); return `${n} œuf${n>1?'s':''}`;
    }
    const gramsEgg=value*50;
    return `≈ ${fr(value,2)} œuf${value>1?'s':''} (≈ ${Math.round(gramsEgg)} g d’œuf battu)`;
  };

  const powderText=(value)=>{
    const common=[
      [0.125,'1/8 de sachet'],[0.25,'1/4 de sachet'],[0.375,'3/8 de sachet'],
      [0.5,'1/2 sachet'],[0.625,'5/8 de sachet'],[0.75,'3/4 de sachet'],[1,'1 sachet']
    ];
    let best=common[0];
    for(const x of common){if(Math.abs(x[0]-value)<Math.abs(best[0]-value))best=x;}
    if(Math.abs(best[0]-value)<=0.035) return best[1];
    return `≈ ${fr(value,2)} sachet${value>=1.5?'s':''}`;
  };

  const updateGenoiseCalculator=()=>{
    let diameter=parseFloat(genoiseDiameter.value);
    if(!Number.isFinite(diameter)) diameter=base.diameter;
    diameter=Math.max(10,Math.min(45,diameter));
    const factor=(diameter/base.diameter)**2;

    const mixEl=document.querySelector('[data-genoise-ingredient="mix"]');
    const sugarEl=document.querySelector('[data-genoise-ingredient="sugar"]');
    const eggEl=document.querySelector('[data-genoise-ingredient="egg"]');
    const powderEl=document.querySelector('[data-genoise-ingredient="powder"]');
    const saltEl=document.querySelector('[data-genoise-ingredient="salt"]');

    if(mixEl) mixEl.textContent=grams(base.mix*factor);
    if(sugarEl) sugarEl.textContent=grams(base.sugar*factor);
    if(eggEl) eggEl.textContent=eggText(base.egg*factor);
    if(powderEl) powderEl.textContent=powderText(base.powderSachet*factor);
    if(saltEl){
      const p=base.saltPinch*factor;
      saltEl.textContent=p<1.45?'1 petite pincée':`≈ ${Math.max(1,Math.round(p))} petites pincées`;
    }

    if(genoiseIngredientTitle) genoiseIngredientTitle.textContent=`Pour un moule rond d’environ ${fr(diameter,0)} cm`;
    if(genoiseSummary){
      const largeNote=diameter>=30?' Grand format : repère mathématique à valider en cuisson réelle.':'';
      genoiseSummary.textContent=`Quantités indicatives pour un moule de ${fr(diameter,0)} cm, afin de conserver une hauteur proche de la base 10 cm (environ 3,5 à 4 cm après cuisson).${largeNote}`;
    }
  };

  genoiseDiameter.addEventListener('change',updateGenoiseCalculator);
  genoiseDiameter.addEventListener('input',updateGenoiseCalculator);
  genoiseReset?.addEventListener('click',()=>{genoiseDiameter.value=String(base.diameter);updateGenoiseCalculator();});
  updateGenoiseCalculator();
}
