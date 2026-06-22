import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const VISIBLE = 8;
const planner = document.getElementById('planner');

let currentDate = new Date();
let liveHour = currentDate.getHours();
let viewStart = null; // start hour of the visible window (0-23). null = auto

// Firebase config (same project used by the main calendar)
const firebaseConfig = {
  apiKey: "AIzaSyCdzIu5PwO5KiZmdFCNCOvJY1R6JHgkKjM",
  authDomain: "birdfood-fda27.firebaseapp.com",
  projectId: "birdfood-fda27",
  storageBucket: "birdfood-fda27.firebasestorage.app",
  messagingSenderId: "340792097507",
  appId: "1:340792097507:web:f151f0076517cc2e0323d6"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

console.log('day.js module loaded');

async function fetchWorkDaysFromFirestore(startDate, endDate){
  const out = [];
  const day = new Date(startDate);
  const promises = [];
  while(day <= endDate){
    const d = day.toISOString().slice(0,10);
    promises.push((async (dateStr)=>{
      try{
        const docRef = doc(db, 'calendar_entries', dateStr);
        const snap = await getDoc(docRef);
        if(snap.exists()){
          const data = snap.data();
          const entries = data.entries || [];
          // Mark as workday if any entry looks like a shift '6-'
          if(entries.some(e=>typeof e==='string' && e.startsWith('6-'))){
            out.push(dateStr);
          }
        }
      }catch(e){
        // ignore fetch errors and continue
      }
    })(d));
    day.setDate(day.getDate()+1);
  }
  await Promise.all(promises);
  // cache
  try{ localStorage.setItem('planner_workdays', JSON.stringify(out)); }catch(e){}
  return out;
}

function loadWorkDays(){
  try{
    const raw = localStorage.getItem('planner_workdays');
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){return []}
}

function isWorkDay(date){
  const y = date.toISOString().slice(0,10);
  const imported = loadWorkDays();
  return imported.indexOf(y) !== -1;
}

  function startOfDayFor(date){
    return isWorkDay(date) ? 5 : 6;
  }

  function endOfNightFor(date){
    return isWorkDay(date) ? 22 : 23; // 22 -> 10pm, 23 -> 11pm
  }

  const VIEW_HOUR_KEY_PREFIX = 'planner_view_hour_';

  function localDateString(date){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dateKey(date){
    return 'planner_' + localDateString(date);
  }

  function legacyDateKey(date){
    return 'planner_' + date.toISOString().slice(0,10);
  }

  function viewHourKey(date){
    return VIEW_HOUR_KEY_PREFIX + localDateString(date);
  }

  function loadSavedViewHour(date){
    try{
      const raw = localStorage.getItem(viewHourKey(date));
      const hour = raw === null ? null : parseInt(raw, 10);
      const valid = Number.isInteger(hour) ? hour : null;
      console.log('loadSavedViewHour', {key:viewHourKey(date), raw, valid});
      return valid;
    }catch(e){
      console.warn('loadSavedViewHour error', e);
      return null;
    }
  }

  function saveViewHour(date, hour){
    if(!Number.isInteger(hour)) return;
    try{
      localStorage.setItem(viewHourKey(date), String(hour));
      console.log('saveViewHour', {key:viewHourKey(date), hour});
    }catch(e){
      console.warn('saveViewHour error', e);
    }
  }

  function loadEntries(date){
    const localKey = dateKey(date);
    let raw = localStorage.getItem(localKey);
    if(raw === null){
      const legacyKey = legacyDateKey(date);
      raw = localStorage.getItem(legacyKey);
      if(raw !== null){
        try{ localStorage.setItem(localKey, raw); }catch(e){}
      }
    }
    try{
      return raw ? JSON.parse(raw) : {};
    }catch(e){
      return {};
    }
  }

  function saveEntries(date, entries){
    localStorage.setItem(dateKey(date), JSON.stringify(entries));
  }

  function clearPlanner(){ planner.innerHTML = ''; }

  function formatHour12(hour){
    let h = hour % 12;
    if(h === 0) h = 12;
    return String(h);
  }

  function makeBlock(hour, entries, isSleep){
    const block = document.createElement('div');
    block.className = 'hour-block';
    block.dataset.hour = hour;

    const label = document.createElement('div');
    label.className = 'hour-label';
    if(hour === liveHour) label.classList.add('current-hour');
    label.textContent = formatHour12(hour);
    block.appendChild(label);

    if(isSleep){
      const s = document.createElement('div');
      s.className = 'sleep-badge';
      s.textContent = 'sleep';
      block.appendChild(s);
    }

    const content = document.createElement('div');
    content.className = 'content';
    content.tabIndex = 0;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';

    // Normalize stored entries: support legacy single-entry objects and strings
    const rawEntry = entries[hour];
    let hourEntries = [];
    if(rawEntry){
      if(Array.isArray(rawEntry)) hourEntries = rawEntry.slice();
      else if(typeof rawEntry === 'object' && rawEntry.text) hourEntries = [rawEntry];
      else if(typeof rawEntry === 'string') hourEntries = [{text: rawEntry, relation: 'none'}];
    }

    // create three columns inside content
    const leftCol = document.createElement('div'); leftCol.className = 'col left';
    const centerCol = document.createElement('div'); centerCol.className = 'col center';
    const rightCol = document.createElement('div'); rightCol.className = 'col right';
    content.appendChild(leftCol);
    content.appendChild(centerCol);
    content.appendChild(rightCol);

    // Edge hover detection
    let hoverEdge = null; // 'left' | 'right' | null

    block.addEventListener('mousemove', (e)=>{
      const rect = block.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width;
      const threshold = Math.max(24, w * 0.15);
      const prev = hoverEdge;
      if(x < threshold) hoverEdge = 'left';
      else if(x > w - threshold) hoverEdge = 'right';
      else hoverEdge = null;
      if(hoverEdge !== prev){
        overlay.classList.toggle('left', hoverEdge === 'left');
        overlay.classList.toggle('right', hoverEdge === 'right');
      }
    });

    block.addEventListener('mouseleave', ()=>{
      hoverEdge = null; overlay.classList.remove('left','right');
    });

    function updateContentClass(){
      // keep container neutral; per-entry classes control alignment
      content.className = 'content';
    }

    function renderEntries(){
      leftCol.innerHTML = '';
      centerCol.innerHTML = '';
      rightCol.innerHTML = '';
      updateContentClass();
      hourEntries.forEach((it, idx)=>{
        const item = document.createElement('div');
        item.className = 'entry-item';
        item.textContent = it.text || '';
        item.tabIndex = 0;
        item.classList.remove('coming','going','center');
        if(it.relation === 'coming') item.classList.add('coming');
        else if(it.relation === 'going') item.classList.add('going');
        else item.classList.add('center');

        item.addEventListener('click', (e)=>{
          e.stopPropagation();
          item.contentEditable = true;
          item.focus();
        });

        item.addEventListener('blur', ()=>{
          item.contentEditable = false;
          const txt = item.textContent.trim();
          const entriesObj = loadEntries(currentDate);
          const stored = entriesObj[hour];
          let arr = [];
          if(Array.isArray(stored)) arr = stored.slice();
          else if(stored && stored.text) arr = [stored];
          else arr = hourEntries.slice();

          if(txt){
            arr[idx] = {text: txt, relation: (it.relation || 'none')};
          } else {
            const activeInside = content.contains(document.activeElement);
            if(!activeInside){
              arr.splice(idx, 1);
            } else {
              arr[idx] = {text: '', relation: (it.relation || 'none')};
            }
          }

          if(arr.length) entriesObj[hour] = arr;
          else delete entriesObj[hour];
          saveEntries(currentDate, entriesObj);
          hourEntries = arr;
          renderEntries();
        });

        if(it.relation === 'coming') leftCol.appendChild(item);
        else if(it.relation === 'going') rightCol.appendChild(item);
        else centerCol.appendChild(item);
      });
    }

    renderEntries();

    // Click on block edges creates side entries (left/right). Center entries are created by clicking the hour label.
    block.addEventListener('click', (e)=>{
      // ignore clicks on existing items
      if(e.target && e.target.closest && e.target.closest('.entry-item')) return;
      const rect = block.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width;
      const threshold = Math.max(24, w * 0.15);
      let relation = null;
      if(x < threshold) relation = 'coming';
      else if(x > w - threshold) relation = 'going';
      else return; // center clicks do nothing here

      // create placeholder in data model and re-render, then focus it
      const entriesObj = loadEntries(currentDate);
      const stored = entriesObj[hour];
      let arr = Array.isArray(stored) ? stored.slice() : (stored && stored.text ? [stored] : hourEntries.slice());
      arr.push({text: '', relation});
      entriesObj[hour] = arr;
      saveEntries(currentDate, entriesObj);
      hourEntries = arr;
      renderEntries();

      setTimeout(()=>{
        const col = relation === 'coming' ? leftCol : rightCol;
        const items = col.querySelectorAll('.entry-item');
        for(let i=items.length-1;i>=0;i--){
          const it = items[i];
          if((it.textContent||'').trim() === ''){ it.contentEditable = true; it.focus(); break; }
        }
      },0);
    });

    // Clicking the hour label creates center entries
    label.addEventListener('click', (e)=>{
      e.stopPropagation();
      const entriesObj = loadEntries(currentDate);
      const stored = entriesObj[hour];
      let arr = Array.isArray(stored) ? stored.slice() : (stored && stored.text ? [stored] : hourEntries.slice());
      arr.push({text: '', relation: 'none'});
      entriesObj[hour] = arr;
      saveEntries(currentDate, entriesObj);
      hourEntries = arr;
      renderEntries();
      setTimeout(()=>{
        const items = centerCol.querySelectorAll('.entry-item');
        for(let i=items.length-1;i>=0;i--){
          const it = items[i];
          if((it.textContent||'').trim() === ''){ it.contentEditable = true; it.focus(); break; }
        }
      },0);
    });

    block.appendChild(content);
    block.appendChild(overlay);

    return block;
  }

  async function render(){
    try{
      const dayStart = startOfDayFor(currentDate);
      const nightEnd = endOfNightFor(currentDate);
      const latestStart = Math.max(dayStart, nightEnd - (VISIBLE - 1));

      // initialize viewStart from saved state or live hour
      const saved = loadSavedViewHour(currentDate);
      // Only initialize viewStart from saved value on first render (when viewStart is null)
      if(viewStart === null && saved !== null && saved >= dayStart && saved <= nightEnd){
        viewStart = saved;
      }
      if(viewStart === null){
        // default to liveHour clamped into allowed start range
        const defaultStart = Math.min(Math.max(liveHour, dayStart), latestStart);
        viewStart = defaultStart;
      }
      // clamp viewStart into allowable window
      const beforeClamp = viewStart;
      viewStart = Math.max(dayStart, Math.min(viewStart, latestStart));
      console.log('render init', {date: currentDate.toISOString().slice(0,10), dayStart, nightEnd, latestStart, beforeClamp, viewStart, liveHour});

      console.log('render start for', currentDate.toISOString().slice(0,10));
      clearPlanner();
      const entries = loadEntries(currentDate);
      saveViewHour(currentDate, viewStart);
      // determine visible date range for fetching workdays
      const dayStartDate = new Date(currentDate);
      dayStartDate.setHours(0,0,0,0);
      const displayStart = new Date(dayStartDate);
      displayStart.setDate(displayStart.getDate() - 3);
      const displayEnd = new Date(dayStartDate);
      displayEnd.setDate(displayEnd.getDate() + 3);

      // Render immediately using cached localStorage workdays
      doRenderBlocks(entries);

      // fetch workdays in background and re-render if changed
      fetchWorkDaysFromFirestore(displayStart, displayEnd).then(()=>{
        console.log('workdays refreshed from Firestore');
        doRenderBlocks(loadEntries(currentDate));
      }).catch(()=>{});
    }catch(err){
      console.error('render error', err);
    }
  }

  function doRenderBlocks(entries){
    clearPlanner();
    const dayStart = startOfDayFor(currentDate);
    const nightEnd = endOfNightFor(currentDate);

    const latestStart = Math.max(dayStart, nightEnd - (VISIBLE - 1));
    let startHour = Math.max(dayStart, (viewStart !== null ? viewStart : liveHour));
    if(startHour > latestStart) startHour = latestStart;
    if(startHour < dayStart) startHour = dayStart;
    if(startHour > 23) startHour = 23;

    const entryHours = Object.keys(entries)
      .map(key => parseInt(key, 10))
      .filter(hour => Number.isInteger(hour));

    if(entryHours.length){
      const minEntryHour = Math.min(...entryHours);
      const maxEntryHour = Math.max(...entryHours);
      if(minEntryHour < startHour || maxEntryHour > startHour + VISIBLE - 1){
        let adjustedStart = startHour;
        if(minEntryHour < adjustedStart) adjustedStart = minEntryHour;
        if(maxEntryHour > adjustedStart + VISIBLE - 1) adjustedStart = maxEntryHour - (VISIBLE - 1);
        adjustedStart = Math.max(dayStart, Math.min(adjustedStart, latestStart));
        startHour = adjustedStart;
      }
    }

    const hoursRow = document.createElement('div');
    hoursRow.className = 'hours-row';

    for(let i=0;i<VISIBLE;i++){
      const h = startHour + i;
      if(h > nightEnd) break;
      const hourVal = h % 24;
      const isNightEnd = (hourVal === nightEnd);
      const block = makeBlock(hourVal, entries, isNightEnd);
      hoursRow.appendChild(block);
    }
    planner.appendChild(hoursRow);
  }

  function tick(){
    const now = new Date();
    const h = now.getHours();
    if(h !== liveHour){
      liveHour = h;
      render();
    }
  }

  const NOTE_KEY = 'planner_notes';

  function loadNote(){
    try{
      return localStorage.getItem(NOTE_KEY) || '';
    }catch(e){
      return '';
    }
  }

  function saveNote(value){
    try{
      localStorage.setItem(NOTE_KEY, value);
    }catch(e){ }
  }

  function resizeNoteField(field){
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
  }

  function attachNoteField(){
    const noteField = document.getElementById('noteField');
    if(!noteField) return;
    noteField.value = loadNote();
    resizeNoteField(noteField);
    noteField.addEventListener('input', ()=>{
      saveNote(noteField.value);
      resizeNoteField(noteField);
    });
  }

  render();
  setInterval(tick, 60*1000);
  attachNoteField();

  const backHourBtn = document.getElementById('backHourBtn');
  const forwardHourBtn = document.getElementById('forwardHourBtn');
  const firstHourBtn = document.getElementById('firstHourBtn');
  const lastHourBtn = document.getElementById('lastHourBtn');
  const resetBtn = document.getElementById('resetBtn');
  if(backHourBtn){
    backHourBtn.addEventListener('click', ()=>{
      const dayStart = startOfDayFor(currentDate);
      const nightEnd = endOfNightFor(currentDate);
      const latestStart = Math.max(dayStart, nightEnd - (VISIBLE - 1));
      const before = viewStart;
      if(viewStart === null) viewStart = Math.min(Math.max(liveHour, dayStart), latestStart);
      viewStart = Math.max(dayStart, viewStart - 1);
      saveViewHour(currentDate, viewStart);
      console.log('backHourBtn clicked', {before, after:viewStart, dayStart, nightEnd, latestStart, liveHour});
      render();
    });
  }
  if(forwardHourBtn){
    forwardHourBtn.addEventListener('click', ()=>{
      const dayStart = startOfDayFor(currentDate);
      const nightEnd = endOfNightFor(currentDate);
      const latestStart = Math.max(dayStart, nightEnd - (VISIBLE - 1));
      const before = viewStart;
      if(viewStart === null) viewStart = Math.min(Math.max(liveHour, dayStart), latestStart);
      viewStart = Math.min(latestStart, viewStart + 1);
      saveViewHour(currentDate, viewStart);
      console.log('forwardHourBtn clicked', {before, after:viewStart, dayStart, nightEnd, latestStart, liveHour});
      render();
    });
  }
  if(firstHourBtn){
    firstHourBtn.addEventListener('click', ()=>{
      const before = viewStart;
      viewStart = startOfDayFor(currentDate);
      saveViewHour(currentDate, viewStart);
      console.log('firstHourBtn clicked', {before, after:viewStart});
      render();
    });
  }
  if(lastHourBtn){
    lastHourBtn.addEventListener('click', ()=>{
      const dayStart = startOfDayFor(currentDate);
      const nightEnd = endOfNightFor(currentDate);
      const before = viewStart;
      viewStart = Math.max(dayStart, nightEnd - (VISIBLE - 1));
      saveViewHour(currentDate, viewStart);
      console.log('lastHourBtn clicked', {before, after:viewStart, dayStart, nightEnd});
      render();
    });
  }
  // detect cross-tab/localStorage updates that may overwrite viewStart
  window.addEventListener('storage', (ev)=>{
    if(!ev.key) return;
    if(ev.key.startsWith(VIEW_HOUR_KEY_PREFIX) || ev.key === 'planner_workdays'){
      console.log('storage event', {key: ev.key, oldValue: ev.oldValue, newValue: ev.newValue});
    }
  });
  if(resetBtn){
    resetBtn.addEventListener('click', ()=>{
      // clear planner entries, cached workday state, and notes, then refresh
      Object.keys(localStorage).forEach(key => {
        if(key.startsWith('planner_') || key === 'planner_workdays' || key === NOTE_KEY) {
          localStorage.removeItem(key);
        }
      });
      window.location.reload();
    });
  }

  window.planner = {render, loadEntries, saveEntries, loadWorkDays};
