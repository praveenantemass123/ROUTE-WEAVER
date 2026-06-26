// ===== GEOGRAPHIC CORRIDOR FILTERING =====
// Strict ellipse + direction constraint: hubs must lie BETWEEN src and dst.

function deg2rad(d) { return d * Math.PI / 180; }
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1), dLng = deg2rad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(deg2rad(lat1))*Math.cos(deg2rad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Project hub onto the src->dst vector and check it falls between 0.05 and 0.95 of the way.
// Also check ellipse constraint: sum of distances <= k * direct distance (k=1.15 is very tight).
function getCorridorHubs(srcCode, dstCode, k=1.15) {
  const src = STATIONS.find(s => s.code === srcCode);
  const dst = STATIONS.find(s => s.code === dstCode);
  if (!src || !dst) return [];
  const direct = haversine(src.lat, src.lng, dst.lat, dst.lng);
  // direction vector src->dst in lat/lng space
  const vecLat = dst.lat - src.lat;
  const vecLng = dst.lng - src.lng;
  const vecLen2 = vecLat*vecLat + vecLng*vecLng;

  return STATIONS.filter(s => {
    if (s.code === srcCode || s.code === dstCode) return false;
    // Ellipse check
    const d1 = haversine(src.lat, src.lng, s.lat, s.lng);
    const d2 = haversine(s.lat, s.lng, dst.lat, dst.lng);
    if ((d1 + d2) > k * direct) return false;
    // Projection check: station must be between 5% and 95% along src->dst
    const tLat = s.lat - src.lat, tLng = s.lng - src.lng;
    const t = (tLat*vecLat + tLng*vecLng) / vecLen2;
    return t >= 0.05 && t <= 0.95;
  }).sort((a, b) => {
    const midLat = (src.lat + dst.lat) / 2, midLng = (src.lng + dst.lng) / 2;
    return haversine(a.lat, a.lng, midLat, midLng) - haversine(b.lat, b.lng, midLat, midLng);
  });
}

// Pick n hubs spread along the route at 1/3 and 2/3 positions
function pickSpreadHubs(srcCode, dstCode, n) {
  const src = STATIONS.find(s => s.code === srcCode);
  const dst = STATIONS.find(s => s.code === dstCode);
  const pool = getCorridorHubs(srcCode, dstCode, 1.15);
  if (pool.length === 0) return [];
  if (n === 1) {
    // Pick station closest to midpoint
    const midLat=(src.lat+dst.lat)/2, midLng=(src.lng+dst.lng)/2;
    const best = pool.slice().sort((a,b)=>
      haversine(a.lat,a.lng,midLat,midLng)-haversine(b.lat,b.lng,midLat,midLng))[0];
    return [best.code];
  }
  // Pick one near 1/3 and one near 2/3 of the journey
  const pt1Lat=src.lat+(dst.lat-src.lat)*0.33, pt1Lng=src.lng+(dst.lng-src.lng)*0.33;
  const pt2Lat=src.lat+(dst.lat-src.lat)*0.67, pt2Lng=src.lng+(dst.lng-src.lng)*0.67;
  const hub1 = pool.slice().sort((a,b)=>
    haversine(a.lat,a.lng,pt1Lat,pt1Lng)-haversine(b.lat,b.lng,pt1Lat,pt1Lng))[0];
  const remaining = pool.filter(s=>s.code!==hub1.code);
  const hub2 = remaining.length ? remaining.slice().sort((a,b)=>
    haversine(a.lat,a.lng,pt2Lat,pt2Lng)-haversine(b.lat,b.lng,pt2Lat,pt2Lng))[0] : null;
  return hub2 ? [hub1.code, hub2.code] : [hub1.code];
}

// ===== AUTOCOMPLETE =====
function setupAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (q.length < 1) { dropdown.classList.remove('open'); return; }
    const matches = STATIONS.filter(s =>
      s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    ).slice(0, 8);
    if (!matches.length) { dropdown.classList.remove('open'); return; }
    dropdown.innerHTML = matches.map(s => `
      <div class="dropdown-item" onclick="selectStation('${inputId}','${dropdownId}','${s.name}','${s.code}')">
        <span>${s.name}</span><span class="dropdown-code">${s.code}</span>
      </div>`).join('');
    dropdown.classList.add('open');
  });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target))
      dropdown.classList.remove('open');
  });
}
function selectStation(inputId, dropdownId, name, code) {
  document.getElementById(inputId).value = `${name} (${code})`;
  document.getElementById(dropdownId).classList.remove('open');
}
function getCode(inputId) {
  const val = document.getElementById(inputId).value;
  const m = val.match(/\(([A-Z0-9]+)\)/);
  return m ? m[1] : null;
}
setupAutocomplete('source-input', 'source-dropdown');
setupAutocomplete('dest-input', 'dest-dropdown');

// ===== SWAP =====
document.getElementById('swap-btn').addEventListener('click', () => {
  const s = document.getElementById('source-input');
  const d = document.getElementById('dest-input');
  [s.value, d.value] = [d.value, s.value];
});

// ===== DATE with day name =====
const di = document.getElementById('date-input');
const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
di.value = tomorrow.toISOString().split('T')[0];
di.min = tomorrow.toISOString().split('T')[0];
function getDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ===== TYPEWRITER PLACEHOLDER =====
const PLACEHOLDER_ROUTES = [
  ['New Delhi','Mumbai Central'],['Patna','New Delhi'],
  ['Kolkata Howrah','Chennai Central'],['Lucknow NR','Mumbai Central'],
  ['Bangalore City','Hyderabad Deccan'],['Varanasi','New Delhi']
];
(function typewriter() {
  const src = document.getElementById('source-input');
  const dst = document.getElementById('dest-input');
  if (!src || !dst) return;
  let ri = 0;
  function cycle() {
    const [s, d] = PLACEHOLDER_ROUTES[ri % PLACEHOLDER_ROUTES.length];
    src.placeholder = `e.g. ${s}…`;
    dst.placeholder = `e.g. ${d}…`;
    ri++;
    setTimeout(cycle, 3000);
  }
  cycle();
})();

// ===== ROUTE GENERATION =====
const TRAIN_NAMES = [
  "Rajdhani Express","Shatabdi Express","Duronto Express","Superfast Express",
  "Garib Rath","Jan Shatabdi","Sampark Kranti","Humsafar Express",
  "Tejas Express","Vande Bharat","Intercity Express","Mail Express",
  "Janshatabdi Express","Poorva Express","Gitanjali Express","Konark Express",
  "Coromandel Express","Golden Temple Mail","Deccan Queen","Punjab Mail"
];
function randTrain() { return TRAIN_NAMES[Math.floor(Math.random()*TRAIN_NAMES.length)]; }
function randNum(min,max) { return Math.floor(Math.random()*(max-min+1))+min; }
function fmtTime(h,m) { return `${String(h%24).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
function addMins(h,m,mins) { const t=h*60+m+mins; return [Math.floor(t/60),t%60]; }
function fmtDuration(mins) {
  const h=Math.floor(mins/60),m=mins%60;
  return h>0?`${h}h ${m}m`:`${m}m`;
}
function getStationName(code) {
  const s=STATIONS.find(x=>x.code===code); return s?s.name:code;
}

// Estimate realistic travel time based on haversine distance
function estimateTravelMins(srcCode, dstCode) {
  const a = STATIONS.find(s=>s.code===srcCode);
  const b = STATIONS.find(s=>s.code===dstCode);
  if (!a||!b) return randNum(120,360);
  const dist = haversine(a.lat,a.lng,b.lat,b.lng);
  // avg Indian express train speed ~65 km/h, +20% for curves/stops
  const mins = Math.round((dist / 65) * 60 * 1.2);
  return Math.max(45, mins + randNum(-15, 30));
}

// ===== REALISTIC INDIAN RAILWAYS FARE CALCULATION =====
// Based on IR distance-slab system + reservation + superfast surcharge + GST
function calculateFare(distKm, travelClass) {
  const km = Math.max(10, distKm);

  // Step 1: Sleeper-class base fare using IR distance slabs (₹)
  let slFare = 0;
  if (km <= 100)       slFare = km * 0.58;
  else if (km <= 500)  slFare = 58  + (km - 100) * 0.44;
  else if (km <= 1000) slFare = 234 + (km - 500) * 0.36;
  else                 slFare = 414 + (km - 1000) * 0.32;
  slFare = Math.max(slFare, 30);

  // Step 2: Class multiplier over SL base
  const multiplier = {
    '2S': 0.52, 'SL': 1.00, 'CC': 1.42,
    '3A': 2.58, '2A': 3.75, '1A': 6.15
  }[travelClass] || 1.00;

  // Step 3: Reservation charge (fixed per class)
  const reservation = {
    '2S': 15, 'SL': 30, 'CC': 40,
    '3A': 40, '2A': 50, '1A': 60
  }[travelClass] || 30;

  // Step 4: Superfast surcharge (most listed trains qualify)
  const surcharge = {
    '2S': 15, 'SL': 30, 'CC': 30,
    '3A': 45, '2A': 75, '1A': 125
  }[travelClass] || 30;

  // Step 5: GST @ 5% on base fare for AC classes
  const baseFare = slFare * multiplier;
  const gst = ['1A','2A','3A','CC'].includes(travelClass) ? baseFare * 0.05 : 0;

  const total = baseFare + reservation + surcharge + gst;
  // Round to nearest ₹10 for cleanliness
  return Math.round(total / 10) * 10;
}

function generateRoutes(srcCode, dstCode, travelClass, maxLegs) {
  const routes = [];
  const numRoutes = 4;

  for (let r=0; r<numRoutes; r++) {
    const numHubs = r < 2 ? 1 : (maxLegs==='2' ? 2 : 1);
    const hubCodes = pickSpreadHubs(srcCode, dstCode, numHubs);
    const stops = [srcCode, ...hubCodes, dstCode];
    const legs = [];
    let curH = randNum(5,10), curM = randNum(0,59);

    for (let i=0; i<stops.length-1; i++) {
      const depH=curH, depM=curM;
      const travelMins = estimateTravelMins(stops[i], stops[i+1]);
      let [arrH,arrM] = addMins(depH,depM,travelMins);
      const a=STATIONS.find(s=>s.code===stops[i]);
      const b=STATIONS.find(s=>s.code===stops[i+1]);
      const distKm = a&&b ? Math.round(haversine(a.lat,a.lng,b.lat,b.lng)) : 300;
      // Use real IR fare formula
      const price = calculateFare(distKm, travelClass);
      legs.push({
        from:stops[i],to:stops[i+1],
        trainName:randTrain(),trainNo:`${randNum(10000,22999)}`,
        dep:fmtTime(depH,depM),arr:fmtTime(arrH,arrM),
        distKm, travelMins, price, travelClass, confirmed:true
      });
      if (i<stops.length-2) {
        const bufMins = randNum(120,180);
        let [bH,bM]=addMins(arrH,arrM,bufMins);
        curH=bH; curM=bM;
      }
    }
    const totalMins = legs.reduce((a,l)=>a+l.travelMins,0);
    const totalBufferMins = (stops.length-2)*150;
    const grandTotal = totalMins+totalBufferMins;
    const totalCost = legs.reduce((a,l)=>a+l.price,0);
    const totalDistKm = legs.reduce((a,l)=>a+l.distKm,0);
    routes.push({legs,stops,totalMins,totalBufferMins,grandTotal,totalCost,totalDistKm});
  }
  routes.sort((a,b)=>a.grandTotal-b.grandTotal);
  return routes;
}

// ===== STATE =====
let currentRoutes=[], selectedRouteIdx=null, currentSort='time';
let srcName='', dstName='';

// ===== FLIGHT SAVINGS (distance-aware) =====
function flightSavings(trainCost, totalDistKm) {
  // Rough domestic flight cost by total journey distance
  let flightCost;
  if (totalDistKm < 400)       flightCost = 2800;
  else if (totalDistKm < 800)  flightCost = 4200;
  else if (totalDistKm < 1400) flightCost = 6000;
  else if (totalDistKm < 2000) flightCost = 7500;
  else                         flightCost = 9500;
  const saved = flightCost - trainCost;
  return saved > 400 ? `✈ Save ~₹${Math.round(saved/100)*100} vs flight` : null;
}

// ===== RENDER =====
function getBadge(idx) {
  const badges=[
    `<div class="route-badge badge-best"><div class="badge-dot"></div>Best Overall</div>`,
    `<div class="route-badge badge-fast"><div class="badge-dot"></div>Fastest</div>`,
    `<div class="route-badge badge-cheap"><div class="badge-dot"></div>Cheapest</div>`,
    `<div class="route-badge badge-alt"><div class="badge-dot"></div>Alternative</div>`
  ];
  return badges[Math.min(idx,3)];
}

function renderTimeline(route) {
  const {legs,stops}=route;
  let html=`<div class="vtl">`;
  for (let i=0; i<stops.length; i++) {
    const isOrigin=i===0, isDest=i===stops.length-1;
    const dotCls=isOrigin?'origin':isDest?'dest':'hub';
    const time=isOrigin?legs[0].dep:isDest?legs[legs.length-1].arr:legs[i-1].arr;
    const timeLabel=isOrigin?'Departs':isDest?'Arrives':'Change here';
    // Stop row
    html+=`<div class="vtl-row">
      <div class="vtl-left"><div class="vtl-time">${time}</div><div class="vtl-time-label">${timeLabel}</div></div>
      <div class="vtl-mid"><div class="vtl-dot ${dotCls}"></div>${i<stops.length-1?'<div class="vtl-vline solid"></div>':''}</div>
      <div class="vtl-right" style="padding-bottom:${i<stops.length-1?'4px':'0'}">
        <div class="vtl-station">${getStationName(stops[i])}</div>
        <div class="vtl-code-badge">${stops[i]}</div>
      </div>
    </div>`;
    if (i<stops.length-1) {
      const l=legs[i];
      // Train leg row
      html+=`<div class="vtl-leg-row">
        <div class="vtl-leg-left"></div>
        <div class="vtl-leg-mid"><div class="vtl-vline solid"></div></div>
        <div class="vtl-leg-right">
          <div class="vtl-train-name">🚂 ${l.trainName}</div>
          <div class="vtl-train-num">#${l.trainNo} · ${l.travelClass}</div>
          <div class="vtl-leg-dur">${fmtDuration(l.travelMins)}</div>
        </div>
      </div>`;
      // Buffer between legs
      if (i<stops.length-2) {
        html+=`<div class="vtl-leg-row">
          <div class="vtl-leg-left"></div>
          <div class="vtl-leg-mid"><div class="vtl-vline dashed"></div></div>
          <div class="vtl-leg-right" style="padding:0"></div>
        </div>
        <div class="vtl-buffer-row">⏳ ≥ 2 hr layover — enough time for delays</div>`;
      }
    }
  }
  return html+`</div>`;
}

function renderRouteCard(route,idx) {
  const isSelected=idx===selectedRouteIdx;
  const savings=flightSavings(route.totalCost, route.totalDistKm);
  return `
    <div class="route-card badge-rank-${Math.min(idx,3)} ${isSelected?'selected':''}" id="route-card-${idx}" onclick="selectRoute(${idx})">
      <div class="route-card-header">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          ${getBadge(idx)}
          <div class="confirmed-badge"><div class="confirmed-dot"></div>Confirmed</div>
          ${savings?`<div class="flight-badge">${savings}</div>`:''}
        </div>
        <div class="route-summary-right">
          <span class="route-total-time">${fmtDuration(route.grandTotal)}</span>
          <span class="route-total-cost">₹${route.totalCost.toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div class="route-timeline" style="padding:16px 24px;">${renderTimeline(route)}</div>
      <div class="route-card-footer">
        <div class="route-legs-info">
          <span class="leg-stat"><strong>${route.legs.length}</strong> Legs</span>
          <span class="leg-stat"><strong>${route.stops.length-2}</strong> Connections</span>
          <span class="leg-stat">Travel: <strong>${fmtDuration(route.totalMins)}</strong></span>
          <span class="leg-stat">Wait: <strong>${fmtDuration(route.totalBufferMins)}</strong></span>
        </div>
        <button class="select-route-btn" onclick="selectRoute(${idx});event.stopPropagation();">
          ${isSelected?'✓ Selected':'Select Route'}
        </button>
      </div>
    </div>`;
}

function renderSkeleton() {
  return [1,2,3].map(()=>`
    <div class="skeleton-card">
      <div class="skeleton-line w40"></div>
      <div class="skeleton-line w80"></div>
      <div class="skeleton-line w60"></div>
      <div class="skeleton-line w40"></div>
    </div>`).join('');
}

function renderResults() {
  document.getElementById('route-cards').innerHTML=currentRoutes.map((r,i)=>renderRouteCard(r,i)).join('');
  document.getElementById('results-count-label').textContent=`${currentRoutes.length} Smart Routes found`;
  const dateStr=getDayLabel(document.getElementById('date-input').value);
  document.getElementById('results-journey-label').textContent=`${srcName} → ${dstName} · ${dateStr}`;
  updateCopyBar();
}

// ===== SORT =====
function sortResults(by) {
  currentSort=by;
  document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(`sort-${by}`).classList.add('active');
  if (by==='time') currentRoutes.sort((a,b)=>a.grandTotal-b.grandTotal);
  else if (by==='cost') currentRoutes.sort((a,b)=>a.totalCost-b.totalCost);
  else currentRoutes.sort((a,b)=>a.legs.length-b.legs.length);
  selectedRouteIdx=null;
  renderResults();
}

// ===== SELECT =====
function selectRoute(idx) { selectedRouteIdx=idx; renderResults(); updateStickyBar(); }
function updateStickyBar() {
  const bar=document.getElementById('sticky-bar');
  if (!bar) return;
  if (selectedRouteIdx!==null) {
    const r=currentRoutes[selectedRouteIdx];
    bar.classList.add('visible');
    document.getElementById('sticky-bar-route').textContent=`${srcName} → ${dstName}`;
    document.getElementById('sticky-bar-meta').textContent=`${r.legs.length} legs · ${fmtDuration(r.grandTotal)} · ₹${r.totalCost.toLocaleString('en-IN')}`;
  } else {
    bar.classList.remove('visible');
  }
}
function updateCopyBar() {
  const btn=document.getElementById('copy-itinerary-btn');
  const label=document.getElementById('selected-route-label');
  if (selectedRouteIdx!==null) {
    const r=currentRoutes[selectedRouteIdx];
    label.textContent=`Route selected: ${r.legs.length} legs · ${fmtDuration(r.grandTotal)} · ₹${r.totalCost.toLocaleString('en-IN')}`;
    btn.disabled=false;
  } else {
    label.textContent='No route selected — click a card to select';
    btn.disabled=true;
  }
}

// ===== COPY =====
function copyItinerary() {
  if (selectedRouteIdx===null) return;
  const r=currentRoutes[selectedRouteIdx];
  const date=document.getElementById('date-input').value;
  let text=`🚆 RouteWeaver Itinerary\nDate: ${date}\n\n`;
  r.legs.forEach((leg,i) => {
    text+=`LEG ${i+1}: ${getStationName(leg.from)} (${leg.from}) → ${getStationName(leg.to)} (${leg.to})\n`;
    text+=`  Train: ${leg.trainName} #${leg.trainNo}\n`;
    text+=`  Dep: ${leg.dep}  |  Arr: ${leg.arr}  |  Duration: ${fmtDuration(leg.travelMins)}\n`;
    text+=`  Class: ${leg.travelClass}  |  Est. Fare: ₹${leg.price.toLocaleString('en-IN')}\n`;
    if (i<r.legs.length-1) text+=`  ⏳ Layover at ${getStationName(r.stops[i+1])}: ≥2 hours\n`;
    text+='\n';
  });
  text+=`Total: ${fmtDuration(r.grandTotal)} | ₹${r.totalCost.toLocaleString('en-IN')}\n`;
  text+=`\nBook each leg separately at: https://www.irctc.co.in`;
  navigator.clipboard.writeText(text).then(() => {
    const btn=document.getElementById('copy-itinerary-btn');
    btn.textContent='✓ Copied!';
    setTimeout(()=>{ btn.textContent='Copy Itinerary for IRCTC'; },2500);
  });
}

// ===== POPULAR CHIPS =====
const POPULAR = [
  {src:'NDLS',dst:'BCT',label:'Delhi → Mumbai'},
  {src:'PNBE',dst:'NDLS',label:'Patna → Delhi'},
  {src:'HWH',dst:'MAS',label:'Kolkata → Chennai'},
  {src:'LKO',dst:'BCT',label:'Lucknow → Mumbai'},
  {src:'SBC',dst:'SC',label:'Bangalore → Hyderabad'},
  {src:'BSB',dst:'NDLS',label:'Varanasi → Delhi'},
];
(function setupChips() {
  const row=document.getElementById('chips-row');
  if (!row) return;
  POPULAR.forEach(p=>{
    const btn=document.createElement('button');
    btn.className='route-chip';
    btn.innerHTML=`<span>${p.label}</span><span class="chip-arrow">→</span>`;
    btn.onclick=()=>{
      const s=STATIONS.find(x=>x.code===p.src), d=STATIONS.find(x=>x.code===p.dst);
      if (s) document.getElementById('source-input').value=`${s.name} (${s.code})`;
      if (d) document.getElementById('dest-input').value=`${d.name} (${d.code})`;
    };
    row.appendChild(btn);
  });
})();

// ===== SEARCH =====
document.getElementById('search-btn').addEventListener('click', doSearch);
function doSearch() {
  const srcCode=getCode('source-input'), dstCode=getCode('dest-input');
  if (!srcCode||!dstCode) { alert('Please select both stations from the dropdown.'); return; }
  if (srcCode===dstCode) { alert('Source and destination cannot be the same.'); return; }

  srcName=getStationName(srcCode); dstName=getStationName(dstCode);
  const travelClass=document.getElementById('class-select').value;
  const maxLegs=document.getElementById('max-legs').value;
  const btn=document.getElementById('search-btn');
  btn.innerHTML=`<div class="spinner"></div> Searching...`;
  btn.disabled=true;
  const area=document.getElementById('results-section');
  area.style.display='block';
  document.getElementById('route-cards').innerHTML=renderSkeleton();
  document.getElementById('results-count-label').textContent='Finding Smart Routes…';
  document.getElementById('results-journey-label').textContent=`${srcName} → ${dstName}`;
  area.scrollIntoView({behavior:'smooth',block:'start'});

  setTimeout(() => {
    const hubs=getCorridorHubs(srcCode,dstCode,1.15);
    if (hubs.length===0) {
      document.getElementById('route-cards').innerHTML=`
        <div class="no-routes-card">
          <div class="no-routes-icon">🗺️</div>
          <h3>No Smart Routes Needed</h3>
          <p>This is a short or direct journey — no intermediate hubs fall between these stations. Direct trains are your best option.</p>
          <a href="https://www.irctc.co.in" target="_blank" class="btn btn-primary btn-sm">Check IRCTC Directly ↗</a>
        </div>`;
      document.getElementById('results-count-label').textContent='No Smart Routes found';
      btn.innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Search Routes`;
      btn.disabled=false;
      return;
    }
    currentRoutes=generateRoutes(srcCode,dstCode,travelClass,maxLegs);
    selectedRouteIdx=null;
    document.getElementById('direct-notice-text').textContent=
      `Showing ${currentRoutes.length} Smart Route alternatives with confirmed seats below.`;
    renderResults();
    btn.innerHTML=`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Search Routes`;
    btn.disabled=false;
  }, 1400);
}

// ===== NAVBAR =====
window.addEventListener('scroll',()=>{
  document.getElementById('navbar').style.background=
    window.scrollY>40?'rgba(8,11,20,0.95)':'rgba(8,11,20,0.75)';
});

// ===== CANVAS ANIMATION =====
(function drawNetwork() {
  const canvas=document.getElementById('rail-canvas');
  if (!canvas) return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  const nodes=[
    {x:210,y:50,label:'NDLS',color:'#6C63FF'},{x:60,y:130,label:'ADI',color:'#FFB347'},
    {x:360,y:110,label:'LKO',color:'#FFB347'},{x:100,y:250,label:'BCT',color:'#6C63FF'},
    {x:280,y:210,label:'NGP',color:'#FFB347'},{x:210,y:290,label:'HYB',color:'#FFB347'},
    {x:360,y:290,label:'HWH',color:'#6C63FF'},{x:100,y:310,label:'PUNE',color:'#FFB347'},
    {x:60,y:200,label:'SBC',color:'#43D9AD'},{x:380,y:200,label:'BSB',color:'#FFB347'},
    {x:210,y:170,label:'BPL',color:'#43D9AD'}
  ];
  const edges=[[0,1],[0,2],[0,10],[1,8],[1,7],[2,9],[2,10],[3,7],[3,8],[4,5],[4,6],[4,10],[5,7],[5,8],[6,9],[9,10],[10,5]];
  const animEdges=[[0,10],[10,5],[5,8]];
  let t=0;
  function animate() {
    ctx.clearRect(0,0,W,H);
    edges.forEach(([a,b])=>{
      ctx.beginPath();ctx.moveTo(nodes[a].x,nodes[a].y);ctx.lineTo(nodes[b].x,nodes[b].y);
      ctx.strokeStyle='rgba(108,99,255,0.18)';ctx.lineWidth=1.5;ctx.stroke();
    });
    animEdges.forEach(([a,b])=>{
      ctx.beginPath();ctx.moveTo(nodes[a].x,nodes[a].y);ctx.lineTo(nodes[b].x,nodes[b].y);
      ctx.strokeStyle='rgba(108,99,255,0.65)';ctx.lineWidth=2.5;ctx.stroke();
    });
    const progress=(t%180)/180;
    const ei=Math.min(Math.floor(progress*animEdges.length),animEdges.length-1);
    const ep=(progress*animEdges.length)-ei;
    const [ea,eb]=animEdges[ei];
    const px=nodes[ea].x+(nodes[eb].x-nodes[ea].x)*ep;
    const py=nodes[ea].y+(nodes[eb].y-nodes[ea].y)*ep;
    ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fillStyle='#43D9AD';ctx.fill();
    ctx.beginPath();ctx.arc(px,py,9,0,Math.PI*2);ctx.fillStyle='rgba(67,217,173,0.2)';ctx.fill();
    nodes.forEach(n=>{
      ctx.beginPath();ctx.arc(n.x,n.y,7,0,Math.PI*2);ctx.fillStyle=n.color;ctx.fill();
      ctx.beginPath();ctx.arc(n.x,n.y,11,0,Math.PI*2);ctx.fillStyle=n.color+'30';ctx.fill();
      ctx.fillStyle='#e2e8f0';ctx.font='bold 9px Inter';
      ctx.textAlign='center';ctx.fillText(n.label,n.x,n.y+20);
    });
    t++;requestAnimationFrame(animate);
  }
  animate();
})();
