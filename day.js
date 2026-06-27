import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const VISIBLE = 8;
const planner = document.getElementById('planner');

const SELECTED_HOUR_KEY = 'planner_selected_hour';
const NOTE_KEY = 'planner_notes';
const SECOND_NOTE_KEY = 'planner_notes_secondary';
const LAST_DAILY_RESET_KEY = 'planner_last_daily_reset';

function loadSelectedHour(date){
  try{
    const raw = localStorage.getItem(SELECTED_HOUR_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);
    if(data && data.date === date.toISOString().slice(0,10)){
      const hour = Number(data.hour);
      return Number.isInteger(hour) ? hour : null;
    }
  }catch(e){ }
  return null;
}

function saveSelectedHour(date, hour){
  try{
    localStorage.setItem(SELECTED_HOUR_KEY, JSON.stringify({
      date: date.toISOString().slice(0,10),
      hour
    }));
  }catch(e){ }
}

function loadNote(key){
  try{ return localStorage.getItem(key) || ''; }catch(e){ return ''; }
}

function saveNote(key, value){
  try{ localStorage.setItem(key, value); }catch(e){ }
}

function clearPlannerEntriesForDate(date){
  try{ localStorage.removeItem(dateKey(date)); }catch(e){ }
}

function clearLeftNote(){
  try{ localStorage.removeItem(NOTE_KEY); }catch(e){ }
}

function maybeResetAtOneAM(now = new Date()){
  try{
    const nowKey = now.toISOString().slice(0,10);
    const lastResetKey = localStorage.getItem(LAST_DAILY_RESET_KEY);

    if(!(now.getHours() === 1 && now.getMinutes() === 0)) return;
    if(lastResetKey === nowKey) return;

    currentDate = new Date(now);
    currentDate.setHours(0,0,0,0);
    currentHour = now.getHours();
    saveSelectedHour(currentDate, currentHour);
    clearPlannerEntriesForDate(currentDate);
    clearLeftNote();
    localStorage.setItem(LAST_DAILY_RESET_KEY, nowKey);
    render();
  }catch(e){ }
}

function setCurrentHour(hour){
  currentHour = hour;
  saveSelectedHour(currentDate, currentHour);
  render();
}

let currentDate = new Date();
let currentHour = currentDate.getHours();
const savedHour = loadSelectedHour(currentDate);
if(savedHour !== null) currentHour = savedHour;

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

  function dateKey(date){
    return 'planner_' + date.toISOString().slice(0,10);
  }

  function loadEntries(date){
    const raw = localStorage.getItem(dateKey(date));
    return raw ? JSON.parse(raw) : {};
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
    if(hour === currentHour) label.classList.add('current-hour');
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
      console.log('render start for', currentDate.toISOString().slice(0,10));
      clearPlanner();
      const entries = loadEntries(currentDate);
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
    let startHour = Math.max(dayStart, currentHour);

    const entryHours = Object.keys(entries)
      .map(Number)
      .filter(h => Number.isInteger(h));
    if(entryHours.length){
      const earliestEntryHour = Math.min(...entryHours);
      if(earliestEntryHour < startHour){
        startHour = Math.max(dayStart, earliestEntryHour);
      }
    }

    if(startHour > latestStart) startHour = latestStart;
    if(startHour < dayStart) startHour = dayStart;
    if(startHour > 23) startHour = 23;

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
    if(now.getHours() === 1 && now.getMinutes() === 0){
      maybeResetAtOneAM(now);
      return;
    }

    const dateChanged = now.toISOString().slice(0,10) !== currentDate.toISOString().slice(0,10);
    if(dateChanged){
      currentDate = new Date(now);
      currentDate.setHours(0,0,0,0);
      currentHour = now.getHours();
      saveSelectedHour(currentDate, currentHour);
      render();
      return;
    }

    const h = now.getHours();
    if(h !== currentHour && currentHour === currentDate.getHours()){
      currentHour = h;
      saveSelectedHour(currentDate, currentHour);
      render();
    }
  }

  function resizeNoteField(field){
    field.style.height = 'auto';
    field.style.height = field.scrollHeight + 'px';
  }

  function attachNoteFields(){
    const noteField = document.getElementById('noteField');
    const noteFieldRight = document.getElementById('noteFieldRight');

    if(noteField){
      noteField.value = loadNote(NOTE_KEY);
      resizeNoteField(noteField);
      noteField.addEventListener('input', ()=>{
        saveNote(NOTE_KEY, noteField.value);
        resizeNoteField(noteField);
      });
    }

    if(noteFieldRight){
      noteFieldRight.value = loadNote(SECOND_NOTE_KEY);
      resizeNoteField(noteFieldRight);
      noteFieldRight.addEventListener('input', ()=>{
        saveNote(SECOND_NOTE_KEY, noteFieldRight.value);
        resizeNoteField(noteFieldRight);
      });
    }
  }

  maybeResetAtOneAM(new Date());
  render();
  setInterval(tick, 60*1000);
  attachNoteFields();

  const backHourBtn = document.getElementById('backHourBtn');
  const forwardHourBtn = document.getElementById('forwardHourBtn');
  const firstHourBtn = document.getElementById('firstHourBtn');
  const lastHourBtn = document.getElementById('lastHourBtn');
  const resetBtn = document.getElementById('resetBtn');
  if(backHourBtn){
    backHourBtn.addEventListener('click', ()=>{ setCurrentHour(Math.max(0, currentHour - 1)); });
  }
  if(forwardHourBtn){
    forwardHourBtn.addEventListener('click', ()=>{ setCurrentHour(Math.min(23, currentHour + 1)); });
  }
  if(firstHourBtn){
    firstHourBtn.addEventListener('click', ()=>{ setCurrentHour(startOfDayFor(currentDate)); });
  }
  if(lastHourBtn){
    lastHourBtn.addEventListener('click', ()=>{ setCurrentHour(endOfNightFor(currentDate)); });
  }
  if(resetBtn){
    resetBtn.addEventListener('click', ()=>{
      clearPlannerEntriesForDate(currentDate);
      clearLeftNote();
      const leftField = document.getElementById('noteField');
      if(leftField) leftField.value = '';
      window.location.reload();
    });
  }

  window.planner = {render, loadEntries, saveEntries, loadWorkDays};
