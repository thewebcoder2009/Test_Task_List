// --- state ---
let currentTab = 'Botany';
let tests = JSON.parse(localStorage.getItem('tests')) || [];

function save() { localStorage.setItem('tests', JSON.stringify(tests)); }

// --- ui helpers ---
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('activeTab'));
    const el = document.getElementById('tab-' + tab);
    if (el) el.classList.add('activeTab');
}

function createTest() {
    const name = document.getElementById('testName').value.trim();
    const date = document.getElementById('testDate').value;
    if (!name || !date) return showErrorMessage('Enter test name & date');
    tests.push({ name, date, subjects: { Botany: [], Zoology: [], Physics: [], Chemistry: [] } });
    save(); loadTestSelector(); renderTests();
    document.getElementById('testName').value = '';
}

function loadTestSelector() {
    const sel = document.getElementById('selectedTest'); sel.innerHTML = '';
    tests.forEach((t, i) => {
        const opt = document.createElement('option'); opt.value = i; opt.textContent = `${t.name} (${t.date})`; sel.appendChild(opt);
    });
}

function loadTestEditSelector() {
    const sel = document.getElementById('selectedEditTest');
    if (!sel) return;
    sel.innerHTML = '';
    // Populate subject options once (subjects are fixed), do not repeat per test
    ["Botany", "Zoology", "Physics", "Chemistry"].forEach((sub) => {
        const opt = document.createElement('option');
        opt.className = `item-opt-${sub}`
        opt.value = sub;
        opt.textContent = sub;
        sel.appendChild(opt);
    });
}

// loadTestEditSelector()

function addSubjectItem() {
    const sel = document.getElementById('selectedTest');
    const index = sel.value;
    const chapter = document.getElementById('chapterName').value.trim();
    const book = document.getElementById('bookName').value.trim();
    if (index === '' || !chapter || !book) return showErrorMessage('Fill all fields');
    tests[index].subjects[currentTab].push({ chapter, book, completed: false });
    save();
    renderTests();
    // recompute the containing test-card height on the next frame so the DOM is updated
    requestAnimationFrame(() => updateTestCardHeight(Number(index)));
    document.getElementById('bookName').value = '';
}

document.getElementById('bookName').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        addSubjectItem()
    }
})

// toggle collapse with smooth animation
function toggleCollapse(id) {
    const content = document.getElementById(id);
    if (!content) return;
    if (content.classList.contains('open')) {
        content.classList.remove('open');
        content.style.maxHeight = '0px';
    } else {
        content.classList.add('open');
        content.style.maxHeight = content.scrollHeight + 'px';
    }
}

// compute full expanded height for an element without causing visual reflow
function computeExpandedHeight(el) {
    if (!el) return 0;
    // clone the node so we can remove max-height restrictions safely
    const clone = el.cloneNode(true);
    // ensure children that use max-height are expanded in the clone
    clone.style.maxHeight = 'none';
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.pointerEvents = 'none';
    clone.style.height = 'auto';
    clone.querySelectorAll && clone.querySelectorAll('.subject-content').forEach(sc => {
        sc.style.maxHeight = 'none';
        sc.style.padding = '10px 15px';
    });
    document.body.appendChild(clone);
    const h = clone.scrollHeight;
    document.body.removeChild(clone);
    return h;
}

// update the maxHeight for a specific test-card after its content changed
function updateTestCardHeight(ti) {
    const sel = document.querySelector(`.test-${ti}`);
    if (!sel) return;
    if (!sel.classList.contains('open')) return;
    const full = computeExpandedHeight(sel) || sel.scrollHeight;
    sel.style.maxHeight = full + 'px';
}

// recompute and update the totals displayed in a test-card header without re-rendering
function updateTestTotals(ti) {
    const test = tests[ti];
    if (!test) return;
    let totalTasks = 0;
    let completedTasks = 0;
    Object.keys(test.subjects).forEach(sub => {
        totalTasks += test.subjects[sub].length;
        test.subjects[sub].forEach(item => { if (item.completed) completedTasks++; });
    });
    const left = totalTasks - completedTasks;
    const elTotal = document.getElementById(`total-${ti}`);
    const elCompleted = document.getElementById(`completed-${ti}`);
    const elLeft = document.getElementById(`left-${ti}`);
    if (elTotal) elTotal.textContent = totalTasks;
    if (elCompleted) elCompleted.textContent = completedTasks;
    if (elLeft) elLeft.textContent = left;
    // update existing status bar (uses class `test-status-<ti>`) and status text
    const percent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const barEl = document.querySelector(`.test-status-${ti}`);
    if (barEl) barEl.style.width = percent + '%';
    // update the textual percent inside the statusContainer for this test-card
    const statusContainer = document.querySelector(`.test-card.test-${ti} .statusContainer`);
    if (statusContainer) {
        const span = statusContainer.querySelector('span');
        if (span) span.textContent = percent + '% Completed';
    }
}

// mark complete but update only the single row DOM to prevent re-render and collapse loss
function markComplete(testIndex, subject, itemIndex) {
    const item = tests[testIndex].subjects[subject][itemIndex];
    if (!item) return; // safety
    item.completed = !item.completed;
    save();
    updateSingleItem(testIndex, subject, itemIndex);
    // update header totals and adjust test-card height if needed, without full re-render
    updateTestTotals(testIndex);
    requestAnimationFrame(() => updateTestCardHeight(testIndex));
}

function updateSingleItem(ti, sub, si) {
    const subId = `sub-${ti}-${sub}`;
    const content = document.getElementById(subId);
    if (!content) return; // if content not in DOM, fallback to full render
    const row = content.children[si];
    if (!row) return renderTests();
    const item = tests[ti].subjects[sub][si];
    const span = row.querySelector('span');
    const btn = row.querySelector('button');
    if (span) span.className = item.completed ? 'completed' : '';
    if (btn) btn.textContent = item.completed ? '✔' : '○';
}

function toggleTestCard(id) {
    const element = document.getElementsByClassName(id)[0];
    if (!element) return;
    if (element.classList.contains('open')) {
        element.classList.remove('open');
        element.style.maxHeight = '40px';
    } else {
        element.classList.add('open');
        // compute the full expanded height (ignoring collapsed subject panels)
        const full = computeExpandedHeight(element) || element.scrollHeight;
        element.style.maxHeight = full + 'px';
    }
}

// compute days left per test based on t.date parsed to milliseconds (same format as Date.now())
function calculateDaysLeft() {
    const now = Date.now();
    return tests.map(t => {
        const timestamp = Date.parse(t.date); // ms since epoch (compatible with Date.now())
        // debug: log parsed timestamp
        // console.log('Parsed date:', t.date, '->', timestamp);
        if (!Number.isFinite(timestamp)) return null;
        const msLeft = timestamp - now;
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        console.log(daysLeft)
        if (daysLeft < 0) {
            return "Over"
        } else {
            return daysLeft + " days left";
        }
    });
}

// full render but preserve which subject panels were open
function renderTests() {
    const container = document.getElementById('testsContainer');
    const openSet = new Set();
    document.querySelectorAll('.subject-content.open').forEach(el => openSet.add(el.id));
    // preserve which test cards are open so re-render doesn't collapse them
    const testOpenSet = new Set();
    document.querySelectorAll('.test-card.open').forEach(el => {
        // find class of form `test-<index>` (avoid matching `test-card`)
        const cls = Array.from(el.classList).find(c => /^test-\d+$/.test(c));
        if (cls) testOpenSet.add(cls);
    });
    container.innerHTML = '';

    tests.forEach((t, ti) => {
        const card = document.createElement('div');
        card.className = `test-card test-${ti}`;

        // Header
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'flex-end';
        headerRow.style.alignItems = 'center';

        const titleWrap = document.createElement('div');
        titleWrap.style.display = 'flex';
        titleWrap.style.alignItems = 'center';
        titleWrap.style.gap = '10px';

        const editBtn = document.createElement('button');
        editBtn.textContent = "Edit";
        editBtn.style.background = "#f0ad4e";
        editBtn.onclick = () => editTest(ti);

        titleWrap.appendChild(editBtn);

        // Delete Button
        const delTestBtn = document.createElement('button');
        delTestBtn.textContent = 'Delete Test';
        delTestBtn.style.background = '#d9534f';
        delTestBtn.style.marginLeft = '10px';
        delTestBtn.onclick = () => deleteTest(ti);
        
        // Task Status
        let totalTasks = 0;
        let completedTasks = 0;

        let subjects = ["Botany", "Zoology", "Physics", "Chemistry"];

        subjects.forEach(sub => {
            totalTasks += t.subjects[sub].length;

            t.subjects[sub].forEach(item => {
                if (item.completed) completedTasks++;
            });
        });

        let incompletedTasks = totalTasks - completedTasks;

        // Task Details
        const details = document.createElement('div')
        // provide identifiable spans so we can update totals without re-rendering
                const span = `<span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">TOTAL WORK:</span> <span id="total-${ti}">${totalTasks}</span></span>
                                                    <span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">COMPLETED:</span> <span id="completed-${ti}">${completedTasks}</span></span>
                                                    <span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">LEFT:</span> <span id="left-${ti}">${incompletedTasks}</span></span>
                                                `;
        details.style.display = 'flex';
        details.style.gap = '40px';
        details.style.marginBottom = '20px';
        details.innerHTML = span

        const daysArr = calculateDaysLeft();
        const daysLeft = (daysArr && daysArr[ti] != null) ? daysArr[ti] : '—';
        const collapseElement = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; cursor: pointer;" onclick="toggleTestCard('test-${ti}')">
                                    <div class="" style="display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 20px;">
                                        <h3>${t.name} — ${t.date}</h3>
                                        <div class="daysLeft">
                                            (<span class="time">${daysLeft}</span>)
                                        </div>
                                    </div>
                                    <span>▼</span>
                                </div>
                                <div style="border: 1px solid #787878; height: 0.1px; margin-bottom: 12px;"></div>`;

        card.innerHTML = collapseElement;

        // Status Bar
        let completedPercentage = Math.floor((completedTasks / totalTasks) * 100) || '0'
        let progressSpan = `<span>${completedPercentage}% Completed</span>`

        const statusContainer = document.createElement('div')
        statusContainer.classList.add('statusContainer')

        const progressBar = document.createElement('div')
        progressBar.classList.add('progressBar')

        const statusBar = `<div style="width: ${completedPercentage}%;" class="statusBar test-status-${ti}"></div>`

        progressBar.innerHTML = statusBar
        statusContainer.innerHTML = progressSpan
        statusContainer.appendChild(progressBar)
        
        headerRow.appendChild(titleWrap);
        headerRow.appendChild(delTestBtn);
        card.appendChild(headerRow);
        card.appendChild(details)
        card.appendChild(statusContainer)

        Object.keys(t.subjects).forEach(sub => {
            const subId = `sub-${ti}-${sub}`;
            const header = document.createElement('div'); header.className = 'collapse-header';
            header.innerHTML = `${sub} <span>▼</span>`;
            header.onclick = () => toggleCollapse(subId);

            const content = document.createElement('div'); content.className = 'subject-content'; content.id = subId;

            t.subjects[sub].forEach((item, si) => {
                const row = document.createElement('div'); row.className = `item item-${si}-${sub}`;
                const left = document.createElement('span'); left.textContent = `${item.chapter} — ${item.book}`;
                if (item.completed) left.classList.add('completed');
                const btnWrap = document.createElement('div'); btnWrap.style.display = 'flex'; btnWrap.style.gap = '6px';

                const btnCheck = document.createElement('button'); btnCheck.className = 'check-btn'; btnCheck.textContent = item.completed ? '✔' : '○'; btnCheck.onclick = (e) => { e.stopPropagation(); markComplete(ti, sub, si); };
                const btnDelete = document.createElement('button'); btnDelete.textContent = '✖'; btnDelete.style.background = '#d9534f'; btnDelete.onclick = (e) => { e.stopPropagation(); deleteItem(ti, sub, si); }; btnDelete.style.height = '40px'; btnDelete.style.width = '35px';
                const editBtn = document.createElement('button'); editBtn.textContent = 'Edit'; editBtn.style.background = '#f0ad4e'; editBtn.onclick = (e) => { e.stopPropagation(); editChapter(ti, sub, si); }; editBtn.style.height = '40px';

                btnWrap.appendChild(btnCheck);
                btnWrap.appendChild(btnDelete);
                btnWrap.appendChild(editBtn)
                row.appendChild(left);
                row.appendChild(btnWrap);
                content.appendChild(row);
            });

            card.appendChild(header);
            card.appendChild(content);

            if (openSet.has(subId)) {
                requestAnimationFrame(() => {
                    const el = document.getElementById(subId);
                    if (el) { el.classList.add('open'); el.style.maxHeight = el.scrollHeight + 'px'; }
                });
            }
        });

        // if this test-card was previously open, restore the open state and height
        if (testOpenSet.has(`test-${ti}`)) {
            requestAnimationFrame(() => {
                // ensure children are in DOM before measuring
                card.classList.add('open');
                const full = computeExpandedHeight(card) || card.scrollHeight;
                card.style.maxHeight = full + 'px';
            });
        }

        container.appendChild(card);
    });
}

let editIndex = null;

/* Open Modal */
function editTest(i) {
    editIndex = i;
    document.getElementById("editName").value = tests[i].name;
    document.getElementById("editDate").value = tests[i].date;

    document.getElementById("editModal").style.display = "flex";
}

let testIndex = null;
let subjectName = '';
let chapterIndex = null;
let originalSubjectName = '';
let currentEditSubject = '';

function editChapter(i, sub, si) {
    // prepare edit modal state
    loadTestEditSelector();
    testIndex = i;
    subjectName = sub;
    originalSubjectName = sub;
    currentEditSubject = sub;
    chapterIndex = si;
    document.getElementById("editChapterName").value = tests[i].subjects[sub][si].chapter;
    document.getElementById("editBookName").value = tests[i].subjects[sub][si].book;

    const sel = document.getElementById('selectedEditTest');
    if (sel) {
        sel.value = sub;
        // replace any existing handler to avoid duplicates
        sel.onchange = function () {
            const newSub = sel.value;
            if (!newSub || newSub === currentEditSubject) return;
            const oldClass = `item-${chapterIndex}-${currentEditSubject}`;
            const newClass = `item-${chapterIndex}-${newSub}`;
            const el = document.querySelector(`.${oldClass}`) || document.querySelector(`.${newClass}`);
            if (el) {
                el.classList.remove(oldClass);
                el.classList.add(newClass);
            }
            currentEditSubject = newSub;
        };
    }

    document.getElementById("editChapterModal").style.display = "flex";
}

/* Close Modal */
function closeEditModal() {
    document.getElementById("editModal").style.display = "none";
    document.getElementById("editChapterModal").style.display = "none";
}

/* Save & Apply Changes */
function saveEditModal() {
    const newName = document.getElementById("editName").value.trim();
    const newDate = document.getElementById("editDate").value.trim();

    if (!newName || !newDate) {
        showErrorMessage("Fill all fields");
        return;
    }

    tests[editIndex].name = newName;
    tests[editIndex].date = newDate;

    save();
    renderTests();
    loadTestSelector();
    closeEditModal();
}

function saveChapterDetails() {
    const newChapterName = document.getElementById("editChapterName").value.trim();
    const newBookName = document.getElementById("editBookName").value.trim();

    if (!newChapterName || !newBookName) {
        showErrorMessage("Fill all fields");
        return;
    }

    // If subject has changed during edit, move the item between subject arrays
    const newSubject = currentEditSubject || subjectName;
    if (newSubject !== originalSubjectName) {
        // remove from original subject array
        const item = tests[testIndex].subjects[originalSubjectName][chapterIndex];
        if (!item) {
            showErrorMessage('Original item not found');
            return;
        }
        // update values then move
        item.chapter = newChapterName;
        item.book = newBookName;
        // remove original
        tests[testIndex].subjects[originalSubjectName].splice(chapterIndex, 1);
        // append to new subject
        tests[testIndex].subjects[newSubject].push(item);
    } else {
        tests[testIndex].subjects[subjectName][chapterIndex].chapter = newChapterName;
        tests[testIndex].subjects[subjectName][chapterIndex].book = newBookName;
    }

    // reset edit modal state
    originalSubjectName = '';
    currentEditSubject = '';
    save();
    renderTests();
    loadTestSelector();
    closeEditModal();
}


function deleteTest(i) {
    if (confirm("Are you sure you want to delete this test?")) {
        tests.splice(i, 1);
        save();
        renderTests();
        loadTestSelector()
    } else {
        return
    }
}

function deleteItem(ti, sub, si) {
    if (confirm("Are you sure you want to delete this task?")) {
        tests[ti].subjects[sub].splice(si, 1);
        save();
        renderTests();
    } else {
        return
    }
}

function showErrorMessage(errMessage) {
    // show overlay background first, then pop the message without shifting layout
    const errBox = document.querySelector('.err-box');
    const errText = document.querySelector('.err-text');
    if (!errBox || !errText) return;
    // set message text
    errText.textContent = errMessage;
    // ensure visible and animate in
    // clear any pending hide
    if (errBox._hideTimeout) {
        clearTimeout(errBox._hideTimeout);
        errBox._hideTimeout = null;
    }
    // make block visible (it is display:block by default), then add visible class to trigger animations
    requestAnimationFrame(() => {
        errBox.classList.add('visible');
    });

    // hide after delay, remove visible class, then fully hide after transition
    errBox._hideTimeout = setTimeout(() => {
        errBox.classList.remove('visible');
        // allow CSS transition to finish before clearing content
        setTimeout(() => { errText.textContent = ''; }, 220);
    }, 2000);
}

// init
loadTestSelector();
renderTests();