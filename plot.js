(()=>{
  'use strict';
  const $=s=>document.querySelector(s),tabs=['standard','task1','task2'];
  const state={tab:'standard',domain:'All',threshold:10,polarity:'All',query:'',selected:null};
  const domains=['Dining','Products','Movies'],polarities=['Positive','Negative','Context-dependent'];
  const colors={Positive:'#398d7a',Negative:'#cf806a','Context-dependent':'#a3ada4',Dining:'#9da9a0',Products:'#aab5ad',Movies:'#bbc4b8'};
  const data=RELATIONS.records;let currentRows=[],currentLinks=[];
  const wordId=r=>`word|${r.polarity}|${r.word}`,aspectId=r=>`aspect|${r.domain}|${r.aspect}`;
  const unique=rows=>new Map(rows.map(r=>[r.id,r])).size;
  function getView(){
    const scoped=data.filter(r=>state.domain==='All'||r.domain===state.domain);
    const counts=new Map();for(const r of scoped){const id=wordId(r);if(!counts.has(id))counts.set(id,new Set());counts.get(id).add(r.id);}
    const rows=scoped.filter(r=>counts.get(wordId(r)).size>=state.threshold&&(state.polarity==='All'||r.polarity===state.polarity)&&(!state.query||r.word.includes(state.query.toLowerCase())));
    const map=new Map();for(const r of rows){const source=aspectId(r),target=wordId(r),key=JSON.stringify([source,target,r.sentiment]);if(!map.has(key))map.set(key,{key,sourceId:source,targetId:target,sentiment:r.sentiment,word:r.word,aspect:r.aspect,domain:r.domain,records:[],ids:new Set()});const item=map.get(key);item.records.push(r);item.ids.add(r.id);}
    const links=[...map.values()].map(d=>({...d,count:d.ids.size}));
    const groups=[];
    for(const domain of domains){const items=[...new Map(rows.filter(r=>r.domain===domain).map(r=>[aspectId(r),{name:r.aspect,id:aspectId(r),kind:'aspect',group:domain}])).values()].sort((a,b)=>a.name.localeCompare(b.name));if(items.length)groups.push({name:domain,children:items});}
    for(const polarity of polarities){const items=[...new Map(rows.filter(r=>r.polarity===polarity).map(r=>[wordId(r),{name:r.word,id:wordId(r),kind:'word',group:polarity}])).values()].sort((a,b)=>a.name.localeCompare(b.name));if(items.length)groups.push({name:polarity+' words',children:items});}
    return{rows,links,groups};
  }
  // Exercise 01: within-group spacing stays 1; only the between-group weight changes.
  function makeHierarchy(groups,betweenGroupWeight){
    return d3.cluster().size([2*Math.PI,310])
      .separation((a,b)=>a.parent===b.parent?1:betweenGroupWeight)
      (d3.hierarchy({name:'root',children:groups}));
  }
  // Exercise 02: beta alone changes; both diagrams receive the exact same hierarchy.
  function radialLine(beta){
    return d3.lineRadial().curve(d3.curveBundle.beta(beta))
      .radius(d=>d.y).angle(d=>d.x);
  }
  function showDetail(records,title){
    const pos=unique(records.filter(r=>r.sentiment===1)),neg=unique(records.filter(r=>r.sentiment===0));
    $('#detail-title').textContent=title;$('#detail-count').textContent=`${unique(records)} distinct reviews · ${pos} positive / ${neg} negative`;
    const reviews=[...new Map(records.map(r=>[r.id,r])).values()].slice(0,8);
    $('#evidence').replaceChildren(...reviews.map(r=>{const box=document.createElement('article');box.className='review';const id=document.createElement('b');id.textContent=`${r.id} · ${r.sentiment?'Positive':'Negative'}`;const p=document.createElement('p');p.textContent=r.evidence;box.append(id,p);return box;}));
  }
  function highlight(id,pinned=false){
    document.querySelectorAll('.relation').forEach(p=>{const match=!id||p.dataset.source===id||p.dataset.target===id||p.dataset.key===id;p.style.opacity=id?(match?.85:.035):.3;p.style.strokeWidth=id&&match?'2.1':p.dataset.width;});
    document.querySelectorAll('.node-label').forEach(n=>{n.style.opacity=!id||n.dataset.id===id||currentLinks.some(l=>(l.sourceId===id&&l.targetId===n.dataset.id)||(l.targetId===id&&l.sourceId===n.dataset.id))?'1':'.25';});
    if(id){const matches=currentRows.filter(r=>wordId(r)===id||aspectId(r)===id);const edge=currentLinks.find(l=>l.key===id);if(edge)showDetail(edge.records,`${edge.aspect} ↔ ${edge.word}`);else showDetail(matches,id.split('|').at(-1));}
    if(pinned)state.selected=id;
  }
  function drawChart(container,root,links,beta,title){
    const card=document.createElement('article');card.className='bundle-card';
    const heading=document.createElement('div');heading.className='bundle-heading';const h=document.createElement('h3');h.textContent=title;const small=document.createElement('span');small.textContent=`β = ${beta} · gap weight ${state.tab==='task1'?8:4}`;heading.append(h,small);card.append(heading);
    const svg=d3.select(card).append('svg').attr('viewBox','-470 -470 940 940').attr('role','group').attr('aria-label',title);
    const leaves=root.leaves(),map=new Map(leaves.map(n=>[n.data.id,n]));
    const paths=links.map(link=>({...link,path:map.get(link.sourceId).path(map.get(link.targetId))}));
    const line=radialLine(beta);
    svg.append('g').selectAll('path').data(paths).join('path')
      .attr('d',d=>line(d.path)).attr('class','relation').attr('fill','none')
      .attr('stroke',d=>d.sentiment?'#398d7a':'#cf806a').attr('stroke-width',d=>Math.min(4,.7+Math.sqrt(d.count)*.4)).attr('opacity',.3)
      .attr('data-source',d=>d.sourceId).attr('data-target',d=>d.targetId).attr('data-key',d=>d.key).attr('data-width',d=>Math.min(4,.7+Math.sqrt(d.count)*.4))
      .on('pointerenter',(e,d)=>highlight(d.key)).on('pointerleave',()=>highlight(state.selected)).on('click',(e,d)=>highlight(d.key,true));
    const arc=d3.arc().innerRadius(320).outerRadius(325);
    for(const group of root.children||[]){const child=group.leaves(),start=child[0].x-.015,end=child.at(-1).x+.015,angle=(start+end)/2;
      svg.append('path').attr('d',arc({startAngle:start,endAngle:end})).attr('fill',colors[group.data.name.replace(' words','')]);
      svg.append('text').attr('transform',`translate(${Math.sin(angle)*440},${-Math.cos(angle)*440}) rotate(${angle*180/Math.PI+(angle>Math.PI/2&&angle<Math.PI*1.5?180:0)})`).attr('text-anchor','middle').attr('class','group-label').text(group.data.name);
    }
    svg.append('g').selectAll('text').data(leaves).join('text').attr('class','node-label')
      .attr('data-id',d=>d.data.id).attr('tabindex',0).attr('role','button').attr('aria-label',d=>`Inspect ${d.data.name}`)
      .attr('transform',d=>`rotate(${d.x*180/Math.PI-90}) translate(${d.y+23},0)${d.x>=Math.PI?' rotate(180)':''}`)
      .attr('text-anchor',d=>d.x<Math.PI?'start':'end').attr('dy','.32em').attr('fill',d=>colors[d.data.group]||'#6d7f73').text(d=>d.data.name)
      .on('pointerenter',(e,d)=>highlight(d.data.id)).on('pointerleave',()=>highlight(state.selected))
      .on('click',(e,d)=>highlight(state.selected===d.data.id?null:d.data.id,true))
      .on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();highlight(state.selected===d.data.id?null:d.data.id,true);}});
    container.append(card);
  }
  function render(){
    const view=getView();currentRows=view.rows;currentLinks=view.links;state.selected=null;
    $('#stat-words').textContent=new Set(view.rows.map(wordId)).size;$('#stat-aspects').textContent=new Set(view.rows.map(aspectId)).size;$('#stat-reviews').textContent=unique(view.rows);$('#stat-links').textContent=view.links.length;
    $('#rule-title').textContent=state.tab==='task1'?'More breathing room between groups':state.tab==='task2'?'Straight links and fully bundled curves':'The sentiment behind words';
    $('#rule-detail').textContent=state.tab==='task1'?'Within-group weight 1 · Between-group weight 8':state.tab==='task2'?'The same nodes, hierarchy, review evidence and filters. Only β changes.':'Within-group weight 1 · Between-group weight 4 · Bundle β = 0.85';
    const chart=$('#charts');chart.replaceChildren();chart.classList.toggle('comparison',state.tab==='task2');
    $('#detail-title').textContent='Start with a word';$('#detail-count').textContent='Hover or select a word, aspect, or link to read original review evidence.';$('#evidence').replaceChildren();
    if(!view.links.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching relations. Lower the minimum frequency or reset filters.';chart.append(empty);return;}
    const root=makeHierarchy(view.groups,state.tab==='task1'?8:4);
    if(state.tab==='task2'){drawChart(chart,root,view.links,0,'Straight links');drawChart(chart,root,view.links,1,'Fully bundled curves');}
    else drawChart(chart,root,view.links,.85,'Review aspects × Opinion words');
    $('#status').textContent=`${root.leaves().length} nodes · ${view.links.length} aggregated links · Frequencies count distinct reviews`;
  }
  function navigate(tab,focus=false){state.tab=tab;for(const name of tabs){$('#tab-'+name).setAttribute('aria-selected',name===tab);$('#tab-'+name).tabIndex=name===tab?0:-1;$('#panel-'+name).hidden=name!==tab;}$('#'+tab+'-slot').append($('#workspace'));history.replaceState(null,'','#'+tab);render();if(focus)$('#tab-'+tab).focus();}
  tabs.forEach((tab,i)=>{$('#tab-'+tab).onclick=()=>navigate(tab);$('#tab-'+tab).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();navigate(tabs[e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3],true);}};});
  for(const key of ['domain','polarity','threshold'])$('#'+key).onchange=e=>{state[key]=key==='threshold'?Math.max(1,Math.min(3000,Number(e.target.value)||1)):e.target.value;$('#'+key).value=state[key];render();};
  $('#search').oninput=e=>{state.query=e.target.value.trim();render();};
  $('#reset').onclick=()=>{Object.assign(state,{domain:'All',polarity:'All',threshold:10,query:''});$('#domain').value='All';$('#polarity').value='All';$('#threshold').value=10;$('#search').value='';render();};
  $('#clear-selection').onclick=()=>{state.selected=null;highlight(null);$('#detail-title').textContent='Start with a word';$('#detail-count').textContent='Hover or select to inspect review evidence.';$('#evidence').replaceChildren();};
  navigate(tabs.includes(location.hash.slice(1))?location.hash.slice(1):'standard');
})();
