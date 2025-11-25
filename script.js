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
    if (!name || !date) return alert('Enter test name & date');
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

function addSubjectItem() {
    const sel = document.getElementById('selectedTest');
    const index = sel.value;
    const chapter = document.getElementById('chapterName').value.trim();
    const book = document.getElementById('bookName').value.trim();
    if (index === '' || !chapter || !book) return alert('Fill all fields');
    tests[index].subjects[currentTab].push({ chapter, book, completed: false });
    save(); renderTests();
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

// mark complete but update only the single row DOM to prevent re-render and collapse loss
function markComplete(testIndex, subject, itemIndex) {
    const item = tests[testIndex].subjects[subject][itemIndex];
    if (!item) return; // safety
    item.completed = !item.completed;
    save();
    updateSingleItem(testIndex, subject, itemIndex);
    renderTests()
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
    if (element.classList.contains('open')){
        element.classList.remove('open');
        element.style.maxHeight = '40px';
    } else {
        element.classList.add('open');
        // compute the full expanded height (ignoring collapsed subject panels)
        const full = computeExpandedHeight(element) || element.scrollHeight;
        console.log(full)
        element.style.maxHeight = full + 'px';
    }
}

// full render but preserve which subject panels were open
function renderTests() {
    const container = document.getElementById('testsContainer');
    const openSet = new Set();
    document.querySelectorAll('.subject-content.open').forEach(el => openSet.add(el.id));
    container.innerHTML = '';

    tests.forEach((t, ti) => {
        const card = document.createElement('div');
        card.className = `test-card test-${ti}`;

        // Header
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'flex-end';
        headerRow.style.alignItems = 'center';
        // headerRow.innerHTML = `<h3>${t.name} — ${t.date}</h3>`;

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
        const span = `<span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">TOTAL WORK:</span> ${totalTasks}</span>
                      <span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">COMPLETED:</span> ${completedTasks}</span>
                      <span><span style="font-weight: bold; font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif; text-decoration: underline;">LEFT:</span> ${incompletedTasks}</span>
                    `;
        details.style.display = 'flex';
        details.style.gap = '40px';
        details.style.marginBottom = '20px';
        details.innerHTML = span

        const collapseElement = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; cursor: pointer;" onclick="toggleTestCard('test-${ti}')">
                                    <h3>${t.name} — ${t.date}</h3>
                                    <span>▼</span>
                                </div>
                                <div style="border: 1px solid #787878; height: 0.1px; margin-bottom: 12px;"></div>`;

        card.innerHTML = collapseElement;

        headerRow.appendChild(delTestBtn);
        card.appendChild(headerRow);
        card.appendChild(details)

        Object.keys(t.subjects).forEach(sub => {
            const subId = `sub-${ti}-${sub}`;
            const header = document.createElement('div'); header.className = 'collapse-header';
            header.innerHTML = `${sub} <span>▼</span>`;
            header.onclick = () => toggleCollapse(subId);

            const content = document.createElement('div'); content.className = 'subject-content'; content.id = subId;

            t.subjects[sub].forEach((item, si) => {
                const row = document.createElement('div'); row.className = 'item';
                const left = document.createElement('span'); left.textContent = `${item.chapter} — ${item.book}`;
                if (item.completed) left.classList.add('completed');
                const btnWrap = document.createElement('div'); btnWrap.style.display = 'flex'; btnWrap.style.gap = '6px';

                const btnCheck = document.createElement('button'); btnCheck.className = 'check-btn'; btnCheck.textContent = item.completed ? '✔' : '○'; btnCheck.onclick = (e) => { e.stopPropagation(); markComplete(ti, sub, si); };
                const btnDelete = document.createElement('button'); btnDelete.textContent = '✖'; btnDelete.style.background = '#d9534f'; btnDelete.onclick = (e) => { e.stopPropagation(); deleteItem(ti, sub, si); }; btnDelete.style.height = '40px'; btnDelete.style.width = '35px';

                btnWrap.appendChild(btnCheck);
                btnWrap.appendChild(btnDelete);
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

        container.appendChild(card);
    });
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

// init
loadTestSelector();
renderTests();