const revealEls=[...document.querySelectorAll('[data-reveal], .reveal')];
revealEls.forEach((el)=>el.classList.add('reveal'));

// Reveal any element that has entered (or sits within) the viewport.
function showReveals(){
  const h=window.innerHeight||document.documentElement.clientHeight;
  for(const el of revealEls){
    if(el.classList.contains('visible'))continue;
    const r=el.getBoundingClientRect();
    if(r.top<h*0.92 && r.bottom>0) el.classList.add('visible');
  }
}
showReveals();
window.addEventListener('scroll',showReveals,{passive:true});
window.addEventListener('resize',showReveals,{passive:true});
window.addEventListener('load',showReveals);

// Enhancement: IntersectionObserver where available (smoother triggering).
if('IntersectionObserver' in window){
  const io=new IntersectionObserver((entries)=>entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target);}
  }),{threshold:0,rootMargin:'0px 0px -8% 0px'});
  revealEls.forEach((el)=>{if(!el.classList.contains('visible'))io.observe(el);});
}

// Failsafe: never leave content hidden if scroll/observer events don't fire.
setTimeout(showReveals,1200);
setTimeout(()=>revealEls.forEach((el)=>el.classList.add('visible')),2600);

function runBuilder(scope=document){
  const btn=scope.querySelector('[data-run-builder]');
  if(!btn)return;
  const nodes=[...scope.querySelectorAll('[data-builder-node]')];
  let busy=false;
  btn.addEventListener('click',()=>{
    if(busy)return;busy=true;btn.textContent='Running…';nodes.forEach(n=>n.classList.remove('run'));
    nodes.forEach((n,i)=>setTimeout(()=>{nodes.forEach(x=>x.classList.remove('run'));n.classList.add('run');if(i===nodes.length-1){setTimeout(()=>{n.classList.remove('run');btn.textContent='Run workflow';busy=false},800)}},i*650));
  });
}
runBuilder();
