import db from "./firebaseConfig.js";

// --- state ---
let currentTab = 'Botany';
let userId = JSON.parse(localStorage.getItem("user") || '{}').id || null


function save() { localStorage.setItem('tests', JSON.stringify(tests)); }

// check firebase
let tests = JSON.parse(localStorage.getItem('tests')) || [];

// Logout
let logoutBtn = document.querySelector('.logoutBtn')
logoutBtn.onclick = () => {
    localStorage.clear("user")
    location.reload()
}

// --- ui helpers ---
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('activeTab'));
    const el = document.getElementById('tab-' + tab);
    if (el) el.classList.add('activeTab');
}

function createTest() {
    if (userId === null) return

    const name = document.getElementById('testName').value.trim();
    const date = document.getElementById('testDate').value;
    if (!name || !date) return showErrorMessage('Enter test name & date');
    let testId = new Date().getTime()
    db.collection("users").doc(userId).collection("tests").add({ name, date, subjects: { Botany: [], Chemistry: [], Physics: [], Zoology: [] }, index: testId });
    loadTestSelector(); renderTests();
    document.getElementById('testName').value = '';
}

function loadTestSelector() {
    if (userId === null) return

    const sel = document.getElementById('selectedTest'); sel.innerHTML = '';
    db.collection("users").doc(userId).collection("tests").orderBy("date", "desc").get().then((snap) => {
        snap.forEach((t) => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = `${t.data().name} (${t.data().date})`;
            sel.appendChild(opt);
        })
    })
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

async function addSubjectItem() {
    if (userId === null) return

    const sel = document.getElementById('selectedTest');
    const index = sel.value;
    const chapter = document.getElementById('chapterName').value.trim();
    const book = document.getElementById('bookName').value.trim();
    if (index === '' || !chapter || !book) return showErrorMessage('Fill all fields');
    
    const newItem = { chapter, book, completed: false };
    db.collection("users").doc(userId).collection("tests").doc(sel.value).update({ [`subjects.${currentTab}`]: firebase.firestore.FieldValue.arrayUnion(newItem) });
        
    // Don't call renderTests() - instead, add the item to the DOM in real-time
    const testRef = db.collection("users").doc(userId).collection("tests").doc(index);
    const snap = await testRef.get();
    if (snap.exists) {
        const items = snap.data().subjects[currentTab];
        const si = items.length - 1; // new item is last
        const subId = `sub-${index}-${currentTab}`;
        const content = document.getElementById(subId);
        const subjectAtCreation = currentTab;
        
        if (content) {
            // Insert new item into existing subject content
            const row = document.createElement('div');
            row.className = `item item-${si}-${currentTab}`;

            const left = document.createElement('span');
            left.textContent = `${chapter} — ${book}`;

            const btnWrap = document.createElement('div');
            btnWrap.style.display = 'flex';
            btnWrap.style.gap = '6px';

            const btnCheck = document.createElement('button');
            btnCheck.className = 'check-btn';
            btnCheck.textContent = '○';
            btnCheck.onclick = e => {
                e.stopPropagation();
                markComplete(index, subjectAtCreation, si);
            };

            const btnDelete = document.createElement('button');
            btnDelete.textContent = '✖';
            btnDelete.style.background = '#d9534f';
            btnDelete.style.height = '40px';
            btnDelete.style.width = '35px';
            btnDelete.onclick = e => {
                e.stopPropagation();
                deleteItem(index, subjectAtCreation, si);
            };

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.style.background = '#f0ad4e';
            editBtn.style.height = '40px';
            editBtn.onclick = e => {
                e.stopPropagation();
                editChapter(index, subjectAtCreation, si);
            };

            btnWrap.append(btnCheck, btnDelete, editBtn);
            row.append(left, btnWrap);
            content.appendChild(row);
            
            // Expand the subject if it's collapsed and adjust test card height
            if (!content.classList.contains('open')) {
                content.classList.add('open');
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
            }
            
            // Update test card height
            requestAnimationFrame(() => updateTestCardHeight(index));
        }
    }
    
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
async function updateTestTotals(ti) {
    if (userId === null) return

    const testRef = db.collection("users").doc(userId).collection("tests").doc(ti)

    const snap = await testRef.get()
    if (!snap.exists) return;

    const subjects = snap.data().subjects || {}

    let totalTasks = 0;
    let completedTasks = 0;


    Object.keys(subjects).forEach(sub => {
        totalTasks += subjects[sub].length;
        subjects[sub].forEach(item => { if (item.completed) completedTasks++; });
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
async function markComplete(testId, subject, itemIndex) {
    if (userId === null) return

    const testRef = db.collection("users").doc(userId).collection("tests").doc(testId)

    const snap = await testRef.get()
    if (!snap.exists) return;

    const subjects = snap.data().subjects || {}
    const arr = Array.isArray(subjects[subject]) ? [...subjects[subject]] : [];

    if (!arr[itemIndex]) return;

    arr[itemIndex].completed = !arr[itemIndex].completed;
    
    await testRef.update({
        [`subjects.${subject}`]: arr
    });

        updateSingleItem(testId, subject, itemIndex);
    // update header totals and adjust test-card height if needed, without full re-render
    updateTestTotals(testId);
    requestAnimationFrame(() => updateTestCardHeight(testId));
}

async function updateSingleItem(ti, sub, si) {
    if (userId === null) return

    const testRef = db.collection("users").doc(userId).collection("tests").doc(ti)

    const snap = await testRef.get()
    if (!snap.exists) return;

    const subjects = snap.data().subjects || {}
    const subId = `sub-${ti}-${sub}`;
    const content = document.getElementById(subId);
    if (!content) return; // if content not in DOM, fallback to full render
    const row = content.children[si];
    if (!row) return renderTests();
    const item = subjects[sub][si];
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
    if (userId === null) return
    const now = Date.now();
    return db.collection("users").doc(userId).collection("tests").get().then((snap) => {
        const daysLeftMap = {};
        snap.forEach((t) => {
            const test = t.data();
            const timestamp = Date.parse(test.date); // ms since epoch (compatible with Date.now())
            // debug: log parsed timestamp
            if (!Number.isFinite(timestamp)) {
                daysLeftMap[t.id] = '—';
                return;
            }
            const msLeft = timestamp - now;
            const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
            if (daysLeft < 0) {
                daysLeftMap[t.id] = "Over";
            } else {
                daysLeftMap[t.id] = daysLeft + " days left";
            }
        });
        return daysLeftMap;
    });
}

// full render but preserve which subject panels were open
async function renderTests() {
    if (userId === null) return
    const container = document.getElementById('testsContainer');
    container.innerHTML = ''
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

    const daysLeftMap = await calculateDaysLeft();

    db.collection("users").doc(userId).collection("tests").orderBy("date", "desc").get().then((snap) => {
        snap.forEach((t) => {
            const card = document.createElement('div');
            card.className = `test-card test-${t.id}`;

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
            editBtn.onclick = () => openEditTestModel(t.id);

            titleWrap.appendChild(editBtn);

            // Delete Button
            const delTestBtn = document.createElement('button');
            delTestBtn.textContent = 'Delete Test';
            delTestBtn.style.background = '#d9534f';
            delTestBtn.style.marginLeft = '10px';
            delTestBtn.onclick = () => deleteTest(t.id);

            // Task Status
            let totalTasks = 0;
            let completedTasks = 0;

            let subjects = ["Botany", "Chemistry", "Physics", "Zoology"];

            subjects.forEach(sub => {
                totalTasks += t.data().subjects[sub].length;

                t.data().subjects[sub].forEach(item => {
                    if (item.completed) completedTasks++;
                });
            });

            let incompletedTasks = totalTasks - completedTasks;

            // Task Details
            const details = document.createElement('div')
            // provide identifiable spans so we can update totals without re-rendering
            const span = `<span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">TOTAL WORK:</span> <span id="total-${t.id}">${totalTasks}</span></span>
                                                    <span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">COMPLETED:</span> <span id="completed-${t.id}">${completedTasks}</span></span>
                                                    <span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">LEFT:</span> <span id="left-${t.id}">${incompletedTasks}</span></span>
                                                `;
            details.style.display = 'flex';
            details.style.gap = '40px';
            details.style.marginBottom = '20px';
            details.innerHTML = span

            const daysLeft = (daysLeftMap && daysLeftMap[t.id] != null) ? daysLeftMap[t.id] : '—';
            const collapseElement = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; cursor: pointer;" onclick="toggleTestCard('test-${t.id}')">
                                    <div class="" style="display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 20px;">
                                        <h3>${t.data().name} — ${t.data().date}</h3>
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

            const statusBar = `<div style="width: ${completedPercentage}%;" class="statusBar test-status-${t.id}"></div>`

            progressBar.innerHTML = statusBar
            statusContainer.innerHTML = progressSpan
            statusContainer.appendChild(progressBar)

            headerRow.appendChild(titleWrap);
            headerRow.appendChild(delTestBtn);
            card.appendChild(headerRow);
            card.appendChild(details)
            card.appendChild(statusContainer)

            const SUBJECT_ORDER = ["Botany", "Chemistry", "Physics", "Zoology"];

            const renderSubjects = t.data().subjects || {};

            SUBJECT_ORDER.forEach(sub => {
                const items = Array.isArray(renderSubjects[sub]) ? renderSubjects[sub] : [];

                const subId = `sub-${t.id}-${sub}`;

                const header = document.createElement('div');
                header.className = 'collapse-header';
                header.innerHTML = `${sub} <span>▼</span>`;
                header.onclick = () => toggleCollapse(subId);

                const content = document.createElement('div');
                content.className = 'subject-content';
                content.id = subId;

                items.forEach((item, si) => {
                    const row = document.createElement('div');
                    row.className = `item item-${si}-${sub}`;

                    const left = document.createElement('span');
                    left.textContent = `${item.chapter} — ${item.book}`;
                    if (item.completed) left.classList.add('completed');

                    const btnWrap = document.createElement('div');
                    btnWrap.style.display = 'flex';
                    btnWrap.style.gap = '6px';

                    const btnCheck = document.createElement('button');
                    btnCheck.className = 'check-btn';
                    btnCheck.textContent = item.completed ? '✔' : '○';
                    btnCheck.onclick = e => {
                        e.stopPropagation();
                        markComplete(t.id, sub, si);
                    };

                    const btnDelete = document.createElement('button');
                    btnDelete.textContent = '✖';
                    btnDelete.style.background = '#d9534f';
                    btnDelete.style.height = '40px';
                    btnDelete.style.width = '35px';
                    btnDelete.onclick = e => {
                        e.stopPropagation();
                        deleteItem(t.id, sub, si);
                    };

                    const editBtn = document.createElement('button');
                    editBtn.textContent = 'Edit';
                    editBtn.style.background = '#f0ad4e';
                    editBtn.style.height = '40px';
                    editBtn.onclick = e => {
                        e.stopPropagation();
                        editChapter(t.id, sub, si);
                    };

                    btnWrap.append(btnCheck, btnDelete, editBtn);
                    row.append(left, btnWrap);
                    content.appendChild(row);
                });

                card.append(header, content);

                if (openSet.has(subId)) {
                    requestAnimationFrame(() => {
                        const el = document.getElementById(subId);
                        if (el) {
                            el.classList.add('open');
                            el.style.maxHeight = el.scrollHeight + 'px';
                        }
                    });
                }
            });


            // if this test-card was previously open, restore the open state and height
            if (testOpenSet.has(`test-${t.id}`)) {
                requestAnimationFrame(() => {
                    // ensure children are in DOM before measuring
                    card.classList.add('open');
                    const full = computeExpandedHeight(card) || card.scrollHeight;
                    card.style.maxHeight = full + 'px';
                });
            }

            container.appendChild(card);
        })
    })

}

/* Open Modal */
async function openEditTestModel(i) {
    const saveBtn = document.querySelector("#saveEditedDataBtn")

    saveBtn.onclick = () => saveEditModal(i)
    
    const testRef = db.collection("users").doc(userId).collection("tests").doc(i);
    let snap = await testRef.get()

    if (!snap.exists) return

    document.getElementById("editName").value = snap.data().name;
    document.getElementById("editDate").value = snap.data().date;

    document.getElementById("editModal").style.display = "flex";
}

let testIndex = null;
let subjectName = '';
let chapterIndex = null;
let originalSubjectName = '';
let currentEditSubject = '';

async function editChapter(i, sub, si) {
    // prepare edit modal state
    const saveBtn = document.querySelector("#saveEditedChapterBtn")

    saveBtn.onclick = () => saveChapterDetails(i, sub, si)
    
    loadTestEditSelector();
    testIndex = i;
    subjectName = sub;
    originalSubjectName = sub;
    currentEditSubject = sub;
    chapterIndex = si;
    
    const testRef = db.collection("users").doc(userId).collection("tests").doc(i);
    let snap = await testRef.get()

    document.getElementById("editChapterName").value = snap.data().subjects[sub][si].chapter;
    document.getElementById("editBookName").value = snap.data().subjects[sub][si].book;

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
async function saveEditModal(i) {
    const testRef = db.collection("users").doc(userId).collection("tests").doc(i);
    let snap = await testRef.get()

    if (!snap.exists) return
    
    const newName = document.getElementById("editName").value.trim();
    const newDate = document.getElementById("editDate").value.trim();

    if (!newName || !newDate) {
        showErrorMessage("Fill all fields");
        return;
    }

    await testRef.update({ name: newName, date: newDate })
        
    // Update only the name/date in the DOM without full re-render
    const card = document.querySelector(`.test-${i}`);
    if (card) {
        const titleDiv = card.querySelector('[onclick*="toggleTestCard"]');
        if (titleDiv) {
            const h3 = titleDiv.querySelector('h3');
            if (h3) h3.textContent = `${newName} — ${newDate}`;
        }
    }
    
    loadTestSelector();
    renderTests();
    closeEditModal();
}

async function saveChapterDetails(i, sub, si) {
    const newChapterName = document.getElementById("editChapterName").value.trim();
    const newBookName = document.getElementById("editBookName").value.trim();

    if (!newChapterName || !newBookName) {
        showErrorMessage("Fill all fields");
        return;
    }

    // If subject has changed during edit, move the item between subject arrays
    const newSubject = currentEditSubject || subjectName;

    const testRef = db.collection("users").doc(userId).collection("tests").doc(i);
    let snap = await testRef.get()

    const subjects = snap.data().subjects || {}
    const arr = Array.isArray(subjects[sub]) ? [...subjects[sub]] : [];

    if (!arr[si]) return;
    
    if (newSubject !== originalSubjectName) {
        // remove from original subject array
        const item = snap.data().subjects[originalSubjectName][chapterIndex]
        if (!item) {
            showErrorMessage('Original item not found');
            return;
        }
        // update values
        item.chapter = newChapterName;
        item.book = newBookName;
        
        // remove from original subject and add to new subject
        const originalArr = Array.isArray(subjects[originalSubjectName]) ? [...subjects[originalSubjectName]] : [];
        originalArr.splice(chapterIndex, 1);
        
        const newArr = Array.isArray(subjects[newSubject]) ? [...subjects[newSubject]] : [];
        newArr.push(item);
        
        await testRef.update({
            [`subjects.${originalSubjectName}`]: originalArr,
            [`subjects.${newSubject}`]: newArr
        });
        
        // Remove item from old subject and add to new subject in DOM
        const oldSubId = `sub-${i}-${originalSubjectName}`;
        const oldContent = document.getElementById(oldSubId);
        if (oldContent && oldContent.children[chapterIndex]) {
            oldContent.children[chapterIndex].remove();
        }
        
        const newSubId = `sub-${i}-${newSubject}`;
        const newContent = document.getElementById(newSubId);
        if (newContent) {
            const row = document.createElement('div');
            row.className = `item item-${newArr.length - 1}-${newSubject}`;
            const left = document.createElement('span');
            left.textContent = `${newChapterName} — ${newBookName}`;
            
            const btnWrap = document.createElement('div');
            btnWrap.style.display = 'flex';
            btnWrap.style.gap = '6px';

            const btnCheck = document.createElement('button');
            btnCheck.className = 'check-btn';
            btnCheck.textContent = item.completed ? '✔' : '○';
            btnCheck.onclick = e => {
                e.stopPropagation();
                markComplete(i, newSubject, newArr.length - 1);
            };

            const btnDelete = document.createElement('button');
            btnDelete.textContent = '✖';
            btnDelete.style.background = '#d9534f';
            btnDelete.style.height = '40px';
            btnDelete.style.width = '35px';
            btnDelete.onclick = e => {
                e.stopPropagation();
                deleteItem(i, newSubject, newArr.length - 1);
            };

            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.style.background = '#f0ad4e';
            editBtn.style.height = '40px';
            editBtn.onclick = e => {
                e.stopPropagation();
                editChapter(i, newSubject, newArr.length - 1);
            };

            btnWrap.append(btnCheck, btnDelete, editBtn);
            row.append(left, btnWrap);
            newContent.appendChild(row);
        }
    } else {
        // update in the same subject in both Firestore and DOM
        arr[si].chapter = newChapterName;
        arr[si].book = newBookName;
        
        await testRef.update({
            [`subjects.${sub}`]: arr
        });
        
        // Update the item text in the DOM
        const subId = `sub-${i}-${sub}`;
        const content = document.getElementById(subId);
        if (content && content.children[si]) {
            const row = content.children[si];
            const span = row.querySelector('span');
            if (span) span.textContent = `${newChapterName} — ${newBookName}`;
        }
    }

    // reset edit modal state
    originalSubjectName = '';
    currentEditSubject = '';
    loadTestSelector();
    closeEditModal();
}


async function deleteTest(id) {
    if (confirm("Are you sure you want to delete this test?")) {
        await db.collection("users").doc(userId).collection("tests").doc(id).delete()
                
        // Remove the test card from DOM without full re-render
        const card = document.querySelector(`.test-${id}`);
        if (card) {
            card.style.transition = 'opacity 0.2s ease-out';
            card.style.opacity = '0';
            setTimeout(() => card.remove(), 200);
        }
        
        loadTestSelector()
    } else {
        return
    }
}

async function deleteItem(testId, subject, itemIndex) {
    const testRef = db.collection("users").doc(userId).collection("tests").doc(testId)

    const snap = await testRef.get()
    if (!snap.exists) return;

    const subjects = snap.data().subjects || {}
    const arr = Array.isArray(subjects[subject]) ? [...subjects[subject]] : [];

    if (!arr[itemIndex]) return;

    if (confirm("Are you sure you want to delete this task?")) {
        arr.splice(itemIndex, 1)
    
        await testRef.update({
            [`subjects.${subject}`]: arr
        });
                
        // Re-render just this subject's items to keep indices in sync
        const subId = `sub-${testId}-${subject}`;
        const content = document.getElementById(subId);
        if (content) {
            // Fade out then rebuild
            content.style.transition = 'opacity 0.15s ease-out';
            content.style.opacity = '0';
            setTimeout(() => {
                // Clear and rebuild items for this subject
                content.innerHTML = '';
                arr.forEach((item, si) => {
                    const row = document.createElement('div');
                    row.className = `item item-${si}-${subject}`;

                    const left = document.createElement('span');
                    left.textContent = `${item.chapter} — ${item.book}`;
                    if (item.completed) left.classList.add('completed');

                    const btnWrap = document.createElement('div');
                    btnWrap.style.display = 'flex';
                    btnWrap.style.gap = '6px';

                    const btnCheck = document.createElement('button');
                    btnCheck.className = 'check-btn';
                    btnCheck.textContent = item.completed ? '✔' : '○';
                    btnCheck.onclick = (e) => {
                        e.stopPropagation();
                        markComplete(testId, subject, si);
                    };

                    const btnDelete = document.createElement('button');
                    btnDelete.textContent = '✖';
                    btnDelete.style.background = '#d9534f';
                    btnDelete.style.height = '40px';
                    btnDelete.style.width = '35px';
                    btnDelete.onclick = (e) => {
                        e.stopPropagation();
                        deleteItem(testId, subject, si);
                    };

                    const editBtn = document.createElement('button');
                    editBtn.textContent = 'Edit';
                    editBtn.style.background = '#f0ad4e';
                    editBtn.style.height = '40px';
                    editBtn.onclick = (e) => {
                        e.stopPropagation();
                        editChapter(testId, subject, si);
                    };

                    btnWrap.append(btnCheck, btnDelete, editBtn);
                    row.append(left, btnWrap);
                    content.appendChild(row);
                });
                
                // Fade back in
                content.style.opacity = '1';
            }, 150);
        }
        
        // Update totals
        updateTestTotals(testId);
        requestAnimationFrame(() => updateTestCardHeight(testId));
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

// Make functions global for HTML onclick
window.switchTab = switchTab;
window.createTest = createTest;
window.addSubjectItem = addSubjectItem;
window.closeEditModal = closeEditModal;
window.toggleTestCard = toggleTestCard;

export default showErrorMessage
