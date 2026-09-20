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
