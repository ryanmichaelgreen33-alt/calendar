// Firebase initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCdzIu5PwO5KiZmdFCNCOvJY1R6JHgkKjM",
    authDomain: "birdfood-fda27.firebaseapp.com",
    projectId: "birdfood-fda27",
    storageBucket: "birdfood-fda27.firebasestorage.app",
    messagingSenderId: "340792097507",
    appId: "1:340792097507:web:f151f0076517cc2e0323d6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Holidays mapping
const holidays = {
    '2026-05-18': 'Victoria Day',
    '2026-07-01': 'Canada Day',
    '2026-08-03': 'B.C. Day',
    '2026-09-07': 'Labour Day',
    '2026-09-30': 'National Day for Truth and Reconciliation',
    '2026-10-12': 'Thanksgiving Day',
    '2026-11-11': 'Remembrance Day',
    '2026-12-25': 'Christmas Day'
};

// Calculate paydays (every other Thursday starting from May 14, 2026)
function calculatePaydays() {
    const paydays = new Set();
    let currentDate = new Date(2026, 4, 14); // May 14, 2026 (first payday)
    const endDate = new Date(2026, 11, 31); // December 31, 2026

    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        paydays.add(dateStr);
        currentDate.setDate(currentDate.getDate() + 14); // Add 14 days for every other Thursday
    }

    return paydays;
}

function calculateAlternateSundays() {
    const specialSundays = new Set();
    let currentDate = new Date(2026, 3, 26); // April 26, 2026
    const endDate = new Date(2026, 11, 31);

    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        specialSundays.add(dateStr);
        currentDate.setDate(currentDate.getDate() + 14);
    }

    return specialSundays;
}

const paydays = calculatePaydays();
const specialSundays = calculateAlternateSundays();

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const startMonth = 2; // March
const endMonth = 11; // December
let currentMonth = startMonth;
const currentYear = 2026;

// Format date to YYYY-MM-DD
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Parse user input
function parseInput(input) {
    const trimmed = input.trim().toLowerCase();
    
    if (trimmed === 's') {
        return 'Soccer';
    } else if (trimmed === 'y') {
        return 'Yoga';
    } else if (trimmed === '') {
        return '';
    } else if (!isNaN(trimmed.replace(':', ''))) {
        // Handle time formats like "11" or "11:30"
        return `6-${input.trim()}`;
    } else {
        // Capitalize first letter of other inputs
        return input.trim().charAt(0).toUpperCase() + input.trim().slice(1);
    }
}

// Determine content type for styling
function getContentType(content) {
    if (!content || content === '') return null;
    
    if (content.includes('-') && content.startsWith('6-')) {
        return 'shift';
    }
    return null;
}

function getMonthLabel(year, month) {
    return `${monthNames[month]} ${year}`;
}

function updateNavigationButtons() {
    document.getElementById('prevMonthBtn').disabled = currentMonth <= startMonth;
    document.getElementById('nextMonthBtn').disabled = currentMonth >= endMonth;
}

function changeMonth(delta) {
    const nextMonth = currentMonth + delta;
    if (nextMonth < startMonth || nextMonth > endMonth) return;
    currentMonth = nextMonth;
    generateCalendar();
    updateNavigationButtons();
    loadEntries();
}

// Generate calendar for the current month and its visible adjacent days
function generateCalendar() {
    const calendarDiv = document.getElementById('calendar');
    calendarDiv.innerHTML = '';

    const monthLabel = document.getElementById('monthLabel');
    monthLabel.textContent = getMonthLabel(currentYear, currentMonth);

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach((day) => {
        const header = document.createElement('div');
        header.className = 'weekday-header';
        header.textContent = day;
        calendarDiv.appendChild(header);
    });

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    const displayStart = new Date(monthStart);
    displayStart.setDate(displayStart.getDate() - displayStart.getDay());
    const displayEnd = new Date(monthEnd);
    displayEnd.setDate(displayEnd.getDate() + (6 - displayEnd.getDay()));

    const globalStart = new Date(currentYear, startMonth, 1);
    const globalEnd = new Date(currentYear, endMonth + 1, 0);
    const todayStr = formatDate(new Date());

    let currentDate = new Date(displayStart);
    while (currentDate <= displayEnd) {
        const dateStr = formatDate(currentDate);
        const dayBlock = document.createElement('div');
        dayBlock.className = 'day-block';

        const inGlobalRange = currentDate >= globalStart && currentDate <= globalEnd;
        const inCurrentMonth = currentDate.getMonth() === currentMonth;

        if (!inGlobalRange) {
            dayBlock.classList.add('outside-range');
        } else if (!inCurrentMonth) {
            dayBlock.classList.add('adjacent-month');
        }

        if (dateStr === todayStr) {
            dayBlock.classList.add('today');
        }

        if (paydays.has(dateStr)) {
            dayBlock.classList.add('payday');
        }

        const dayNumber = currentDate.getDate();
        const holiday = holidays[dateStr];

        let topContent = `<div class="day-number">${dayNumber}</div>`;
        if (holiday) {
            topContent += `<div class="day-holiday">${holiday}</div>`;
        }

        dayBlock.innerHTML = topContent + `<div class="day-content" id="content-${dateStr}"></div>`;
        dayBlock.dataset.date = dateStr;

        if (holiday) {
            dayBlock.classList.add('holiday');
        }

        if (specialSundays.has(dateStr)) {
            dayBlock.classList.add('alternate-sunday');
        }

        if (inGlobalRange) {
            dayBlock.addEventListener('click', () => openModal(dateStr));
        }

        calendarDiv.appendChild(dayBlock);
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

// Load day entries from Firebase for the visible displayed calendar range
async function loadEntries() {
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    const displayStart = new Date(monthStart);
    displayStart.setDate(displayStart.getDate() - displayStart.getDay());
    const displayEnd = new Date(monthEnd);
    displayEnd.setDate(displayEnd.getDate() + (6 - displayEnd.getDay()));

    const startDate = new Date(displayStart);
    const endDate = new Date(displayEnd);
    const loadPromises = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dateStr = formatDate(currentDate);
        const contentDiv = document.getElementById('content-' + dateStr);
        const dayBlock = document.querySelector(`[data-date="${dateStr}"]`);

        if (contentDiv && dayBlock) {
            loadPromises.push((async () => {
                try {
                    const docRef = doc(db, 'calendar_entries', dateStr);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const entries = data.entries || [];

                        contentDiv.textContent = entries.join('\n');
                        contentDiv.style.whiteSpace = 'pre-wrap';

                        dayBlock.classList.remove('shift', 'activity', 'other');

                        if (holidays[dateStr]) {
                            dayBlock.classList.add('holiday');
                        } else if (entries.length > 0) {
                            const contentType = getContentType(entries[0]);
                            if (contentType) {
                                dayBlock.classList.add(contentType);
                            }
                        }
                    } else {
                        contentDiv.textContent = '';
                    }
                } catch (error) {
                    console.error('Error loading entry for ' + dateStr + ':', error);
                }
            })());
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    await Promise.all(loadPromises);
}

// Modal handling
let selectedDate = null;
let currentEntries = [];

function openModal(dateStr) {
    selectedDate = dateStr;
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateDisplay = date.toLocaleDateString('en-US', options);
    
    document.getElementById('modalDate').textContent = dateDisplay;
    document.getElementById('dayInput').value = '';
    
    // Load current entries
    loadModalEntries(dateStr);

    document.getElementById('dayModal').classList.add('active');
    document.getElementById('dayInput').focus();
}

async function loadModalEntries(dateStr) {
    try {
        const docRef = doc(db, 'calendar_entries', dateStr);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentEntries = data.entries || [];
        } else {
            currentEntries = [];
        }
    } catch (error) {
        console.error('Error loading modal entries:', error);
        currentEntries = [];
    }
    
    renderEntriesList();
}

function renderEntriesList() {
    const entriesList = document.getElementById('entriesList');
    entriesList.innerHTML = '';
    
    currentEntries.forEach((entry, index) => {
        const entryDiv = document.createElement('div');
        const contentType = getContentType(entry);
        entryDiv.className = `entry-item ${contentType || ''}`;
        
        const textSpan = document.createElement('span');
        textSpan.className = 'entry-text';
        textSpan.textContent = entry;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'entry-delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteEntryAt(index));
        
        entryDiv.appendChild(textSpan);
        entryDiv.appendChild(deleteBtn);
        entriesList.appendChild(entryDiv);
    });
}

async function deleteEntryAt(index) {
    if (!selectedDate) return;

    currentEntries.splice(index, 1);

    try {
        const entryRef = doc(db, 'calendar_entries', selectedDate);

        if (currentEntries.length === 0) {
            await deleteDoc(entryRef);
        } else {
            await setDoc(entryRef, {
                entries: currentEntries,
                timestamp: new Date()
            });
        }

        renderEntriesList();

        const contentDiv = document.getElementById('content-' + selectedDate);
        const dayBlock = document.querySelector(`[data-date="${selectedDate}"]`);

        if (contentDiv && dayBlock) {
            contentDiv.textContent = currentEntries.join('\n');
            contentDiv.style.whiteSpace = 'pre-wrap';
            dayBlock.classList.remove('shift', 'activity', 'other');

            if (holidays[selectedDate]) {
                dayBlock.classList.add('holiday');
            } else if (currentEntries.length > 0) {
                const contentType = getContentType(currentEntries[0]);
                if (contentType) {
                    dayBlock.classList.add(contentType);
                }
            }
        }
    } catch (error) {
        console.error('Error deleting entry:', error);
        alert('Error deleting entry');
    }
}

function closeModal() {
    document.getElementById('dayModal').classList.remove('active');
    selectedDate = null;
    currentEntries = [];
}

async function addEntry() {
    if (!selectedDate) return;

    const input = document.getElementById('dayInput').value;
    const content = parseInput(input);

    if (content === '') {
        alert('Please enter something');
        return;
    }

    // Add entry to array
    currentEntries.push(content);
    document.getElementById('dayInput').value = '';
    
    // Save to Firebase
    try {
        await setDoc(doc(db, 'calendar_entries', selectedDate), {
            entries: currentEntries,
            timestamp: new Date()
        });

        // Update display
        const contentDiv = document.getElementById('content-' + selectedDate);
        const dayBlock = document.querySelector(`[data-date="${selectedDate}"]`);
        
        if (contentDiv && dayBlock) {
            contentDiv.textContent = currentEntries.join('\n');
            contentDiv.style.whiteSpace = 'pre-wrap';
            
            // Update content type class
            dayBlock.classList.remove('shift', 'activity', 'other');
            
            // Holidays take priority over other content types
            if (holidays[selectedDate]) {
                dayBlock.classList.add('holiday');
            } else {
                const contentType = getContentType(currentEntries[0]);
                if (contentType) {
                    dayBlock.classList.add(contentType);
                }
            }
        }

        renderEntriesList();
        closeModal();
    } catch (error) {
        console.error('Error adding entry:', error);
        alert('Error adding entry');
    }
}

async function deleteAllEntries() {
    if (!selectedDate) return;

    try {
        await deleteDoc(doc(db, 'calendar_entries', selectedDate));
        const contentDiv = document.getElementById('content-' + selectedDate);
        const dayBlock = document.querySelector(`[data-date="${selectedDate}"]`);
        
        if (contentDiv && dayBlock) {
            contentDiv.textContent = '';
            dayBlock.classList.remove('shift', 'activity', 'other');
            
            // Holidays should still show red even with no entries
            if (holidays[selectedDate]) {
                dayBlock.classList.add('holiday');
            }
        }
        
        currentEntries = [];
        renderEntriesList();
    } catch (error) {
        console.error('Error deleting entries:', error);
        alert('Error deleting entries');
    }
}

// Scroll position persistence
async function saveScrollPosition() {
    const scrollPos = window.scrollY;
    try {
        await setDoc(doc(db, 'user_state', 'scroll_position'), {
            position: scrollPos,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error saving scroll position:', error);
    }
}

async function loadScrollPosition() {
    try {
        const docRef = doc(db, 'user_state', 'scroll_position');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.scrollTo(0, data.position || 0);
        }
    } catch (error) {
        console.error('Error loading scroll position:', error);
    }
}

// Event listeners
document.getElementById('addBtn').addEventListener('click', addEntry);
document.getElementById('closeBtn').addEventListener('click', closeModal);

document.querySelector('.close').addEventListener('click', closeModal);

document.getElementById('dayModal').addEventListener('click', (e) => {
    if (e.target.id === 'dayModal') {
        closeModal();
    }
});

document.getElementById('dayInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addEntry();
    }
});

document.getElementById('prevMonthBtn').addEventListener('click', () => changeMonth(-1));
document.getElementById('nextMonthBtn').addEventListener('click', () => changeMonth(1));

// Save scroll position on scroll
window.addEventListener('scroll', () => {
    // Debounce to avoid too many saves
    clearTimeout(window.scrollTimeout);
    window.scrollTimeout = setTimeout(saveScrollPosition, 500);
});

// Initialize on page load
async function init() {
    generateCalendar();
    updateNavigationButtons();
    await loadEntries();
    await loadScrollPosition();
}

init();
