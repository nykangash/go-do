// --- DOM Selection ---
        // Get references to key HTML elements for easier access.
        const body = document.body;
        const boardContainer = document.getElementById('boardContainer');
        const addColumnBtnGlobal = document.getElementById('addColumnBtnGlobal');
        const taskColorContextMenu = document.getElementById('taskColorContextMenu');
        const columnContextMenu = document.getElementById('columnContextMenu');
        const addBoardBtnGlobal = document.getElementById('addBoardBtnGlobal');
        const openSidebarBtn = document.getElementById('openSidebarBtn');
        const closeSidebarBtn = document.getElementById('closeSidebarBtn');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        const sidebarBoardList = document.getElementById('sidebarBoardList');
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const themeToggleIndicator = document.getElementById('themeToggleIndicator');
        const completedTasksBtn = document.getElementById('completedTasksBtn');
        const currentBoardNameHeader = document.getElementById('currentBoardNameHeader');

        // --- Board State ---
        // The main object holding all application data: boards, columns, tasks, etc.
        let appState = {
            boards: [],
            currentBoardId: null,
            nextBoardId: 1,
            nextColumnId: 1,
            nextTaskId: 1,
            nextSubTaskId: 1,
            theme: 'dark'
        };
        // Variables to manage drag-and-drop operations.
        let draggedTask = null,
            sourceColumnId = null,
            draggedColumn = null;
        // Variables to track the currently targeted item for context menus.
        let currentContextMenuTask = {
            columnId: null,
            taskId: null
        };
        let currentContextMenuColumn = {
            columnId: null
        };
        let currentOpenColumnElement = null; // <-- ADDED: Track the column with the open menu

        // --- Preset Colors ---
        // Define standard colors for tasks and columns.
        const PRESET_COLORS = [
            {
                name: 'Gray',
                value: '#6B7280'
            },
            {
                name: 'Red',
                value: '#c24226'
            },
            {
                name: 'Amber',
                value: '#F59E0B'
            },
            {
                name: 'Green',
                value: '#10B981'
            },
            {
                name: 'Blue',
                value: '#3B82F6'
            },
            {
                name: 'Violet',
                value: '#8B5CF6'
            }
        ];

        const DEFAULT_TASK_COLOR = PRESET_COLORS[0].value;
        const COLUMN_COLORS = [
            {
                name: 'Default',
                value: '#2d3748',
                light: '#e5e7eb'
            },
            {
                name: 'Deep Blue',
                value: '#1e40af',
                light: '#dbeafe'
            },
            {
                name: 'Forest Green',
                value: '#166534',
                light: '#d1fae5'
            },
            {
                name: 'Rich Purple',
                value: '#581c87',
                light: '#f3e8ff'
            },
            {
                name: 'Warm Red',
                value: '#991b1b',
                light: '#fee2e2'
            },
            {
                name: 'Slate Gray',
                value: '#334155',
                light: '#e2e8f0'
            }
        ];

        const DEFAULT_COLUMN_COLOR = COLUMN_COLORS[0];

        // --- IndexedDB Setup ---
        // Define database name, version, and store name for local data persistence.
        const DB_NAME = 'GoDoDB_v4';
        const DB_VERSION = 1;
        const STORE_NAME = 'appState';
        let db; // Database instance variable.

        // --- IndexedDB Functions ---
        // Opens (or creates/upgrades) the IndexedDB database.
        function openDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = e => {
                    e.target.result.objectStoreNames.contains(STORE_NAME) || e.target.result.createObjectStore(STORE_NAME, {
                        keyPath: 'id'
                    });
                };
                request.onsuccess = e => {
                    db = e.target.result;
                    resolve(db);
                };
                request.onerror = e => {
                    console.error('IndexedDB error:', e.target.errorCode);
                    reject('IndexedDB error: ' + e.target.errorCode);
                };
            });
        }
        // Saves the current `appState` to IndexedDB and theme to localStorage.
        async function saveAppState() {
            try {
                if (!db) await openDB();
                const tx = db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME);
                tx.put({
                    id: 'GoDoAppState',
                    data: appState
                });
                localStorage.setItem('GoDoTheme', appState.theme);
            } catch (error) {
                console.error('Error saving to IndexedDB:', error);
            }
        }
        // Loads the application state from IndexedDB or sets up a default state.
        async function loadAppState() {
            try {
                if (!db) db = await openDB();
                const request = db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get('GoDoAppState');
                request.onsuccess = (event) => {
                    const result = event.target.result;
                    let needsDefault = true;
                    if (result && result.data && result.data.boards) {
                        appState = result.data;
                        needsDefault = appState.boards.length === 0;
                        let maxB = 0,
                            maxC = 0,
                            maxT = 0,
                            maxS = 0; /* Data migration & ID calculation */
                        appState.boards.forEach(b => {
                            maxB = Math.max(maxB, parseInt((b.id || 'b-0').split('-')[1]));
                            b.columns = b.columns || [];
                            b.columns.forEach(c => {
                                maxC = Math.max(maxC, parseInt((c.id || 'c-0').split('-')[1]));
                                c.width = c.width || 300;
                                c.color = c.color || DEFAULT_COLUMN_COLOR.value;
                                c.tasks = c.tasks || [];
                                c.tasks.forEach(t => {
                                    maxT = Math.max(maxT, parseInt((t.id || 't-0').split('-')[1]));
                                    t.color = t.color || DEFAULT_TASK_COLOR;
                                    t.subTasks = t.subTasks || [];
                                    t.isStarred = t.isStarred || false;
                                    t.createdAt = t.createdAt || Date.now();
                                    t.subTasks.forEach(s => maxS = Math.max(maxS, parseInt((s.id || 's-0').split('-')[1])));
                                });
                            });
                        });
                        appState.nextBoardId = Math.max(appState.nextBoardId || 1, maxB + 1);
                        appState.nextColumnId = Math.max(appState.nextColumnId || 1, maxC + 1);
                        appState.nextTaskId = Math.max(appState.nextTaskId || 1, maxT + 1);
                        appState.nextSubTaskId = Math.max(appState.nextSubTaskId || 1, maxS + 1);
                        if (!appState.currentBoardId || !appState.boards.find(b => b.id === appState.currentBoardId)) {
                            appState.currentBoardId = appState.boards.length > 0 ? appState.boards[0].id : null;
                        }
                    }
                    if (needsDefault) {
                        /* Default board setup */
                        appState = {
                            boards: [{
                                id: 'board-1',
                                title: 'My First Board',
                                columns: [{
                                    id: 'col-1',
                                    title: 'To Do',
                                    tasks: [{
                                        id: 'task-1',
                                        text: 'Explore Go-do!',
                                        color: PRESET_COLORS[4].value,
                                        subTasks: [{
                                            id: 'subtask-1',
                                            text: 'Add a list',
                                            completed: false
                                        }, {
                                            id: 'subtask-2',
                                            text: 'Star a card',
                                            completed: false
                                        }],
                                        isStarred: false,
                                        createdAt: Date.now()
                                    }, {
                                        id: 'task-2',
                                        text: 'Try Dark Mode!',
                                        color: PRESET_COLORS[2].value,
                                        subTasks: [],
                                        isStarred: true,
                                        createdAt: Date.now() - 1000
                                    }],
                                    width: 320,
                                    color: DEFAULT_COLUMN_COLOR.value
                                }, {
                                    id: 'col-2',
                                    title: 'Done',
                                    tasks: [],
                                    width: 300,
                                    color: DEFAULT_COLUMN_COLOR.value
                                }, ],
                            }],
                            currentBoardId: 'board-1',
                            nextBoardId: 2,
                            nextColumnId: 3,
                            nextTaskId: 3,
                            nextSubTaskId: 3,
                            theme: localStorage.getItem('GoDoTheme') || 'dark'
                        };
                    }
                    appState.theme = localStorage.getItem('GoDoTheme') || appState.theme || 'dark';
                    applyTheme(appState.theme);
                    renderBoard();
                };
                request.onerror = () => {
                    /* Fallback if DB load fails */
                    console.error("Failed to load state, starting fresh.");
                    renderBoard(); // Consider if renderBoard() should be called here or a more robust error handling
                };
            } catch (error) {
                /* Fallback */
                console.error("Error during DB load:", error);
                renderBoard(); // Consider if renderBoard() should be called here or a more robust error handling
            }
        }
// --- Utilities ---
// Returns the currently active board object.
function getCurrentBoard() {
    return appState.boards.find(b => b.id === appState.currentBoardId) || null;
}
// Finds a specific task by its ID within a specific column.
function getTaskById(columnId, taskId) {
    const b = getCurrentBoard();
    const c = b ? b.columns.find(col => col.id === columnId) : null;
    return c ? c.tasks.find(t => t.id === taskId) : null;
}
// Determines whether text should be light or dark based on background color for contrast.
function getContrastingTextColor(backgroundColor) {
    const isLight = body.classList.contains('light-mode');
    const c = COLUMN_COLORS.find(c => c.value === backgroundColor || c.light === backgroundColor);
    if (isLight && c && backgroundColor === c.light) return '#1f2937';
    const h = backgroundColor.replace('#', '');
    const [r, g, b] = [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
    return Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)) > 135 ? '#1f2937' : '#f3f4f6';
}

// --- Theme & Sidebar ---
// Applies the selected theme (light/dark) to the body and updates the toggle switch.
function applyTheme(theme) {
    body.classList.toggle('light-mode', theme === 'light');
    themeToggleBtn.classList.toggle('dark', theme !== 'light');
    themeToggleIndicator.style.transform = theme === 'light' ? 'translateX(0.15rem)' : 'translateX(1.6rem)'; // Adjusted for better visual centering
    appState.theme = theme;
}
// Toggles between light and dark themes.
function toggleTheme() {
    applyTheme(appState.theme === 'dark' ? 'light' : 'dark');
    saveAppState();
}
// Opens the sidebar menu.
function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    sidebarOverlay.classList.remove('hidden');
}
// Closes the sidebar menu.
function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    sidebarOverlay.classList.add('hidden');
}
// Event listeners for theme toggle and sidebar controls.
themeToggleBtn.addEventListener('click', toggleTheme);
openSidebarBtn.addEventListener('click', openSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
completedTasksBtn.addEventListener('click', () => alert('Completed tasks archive coming soon!'));


        // --- Board Rendering (Optimized with DocumentFragment) ---
        // Renders the list of boards in the sidebar.
        function renderBoardList() {
            sidebarBoardList.innerHTML = '';
            const fragment = document.createDocumentFragment(); // Use fragment for better performance.
            if (appState.boards.length === 0) {
                sidebarBoardList.innerHTML = '<p class="px-4 py-2 text-gray-400">No boards yet...</p>';
                return;
            }
            appState.boards.forEach(board => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'sidebar-board-item';
                if (board.id === appState.currentBoardId) itemDiv.classList.add('active'); // Highlight active board.
                const boardBtn = document.createElement('button'); // Button to switch to this board.
                boardBtn.innerHTML = `<i class="fas fa-clipboard-list text-gray-400"></i><span>${board.title}</span>`;
                boardBtn.className = 'flex items-center gap-3 flex-grow'; // Tailwind classes for layout
                boardBtn.addEventListener('click', () => {
                    switchBoard(board.id);
                    closeSidebar();
                });
                const deleteBtn = document.createElement('button'); // Button to delete this board.
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteBtn.className = 'sidebar-board-delete-btn';
                deleteBtn.title = `Delete board: ${board.title}`;
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    confirmDeleteBoard(board.id, board.title);
                });
                itemDiv.appendChild(boardBtn);
                itemDiv.appendChild(deleteBtn);
                fragment.appendChild(itemDiv); // Append to fragment.
            });
            sidebarBoardList.appendChild(fragment); // Append fragment once to the DOM.
        }

        // Renders the entire board (columns and tasks) for the current board.
        function renderBoard() {
            hideAllMenus(); // Hide menus before re-rendering

            // --- 1. Store scroll positions of task lists ---
            const scrollPositions = {};
            const existingTaskLists = boardContainer.querySelectorAll('.column .task-list'); // More specific selector
            existingTaskLists.forEach(taskList => {
                const columnEl = taskList.closest('.column');
                if (columnEl && columnEl.dataset.columnId) {
                    scrollPositions[columnEl.dataset.columnId] = taskList.scrollTop;
                }
            });

            boardContainer.innerHTML = ''; // Clear existing board.
            const currentBoard = getCurrentBoard();
            const isLight = body.classList.contains('light-mode');
            const fragment = document.createDocumentFragment(); // Use fragment for performance.

            if (!currentBoard) { // Handle case with no board selected or no boards exist.
                boardContainer.innerHTML = '<p class="text-center text-xl p-10">No board selected. Create one!</p>';
                currentBoardNameHeader.textContent = 'Go-do';
                addColumnBtnGlobal.style.display = 'none'; // Hide add column button.
                renderBoardList(); // Update sidebar list.
                saveAppState(); // Save state (e.g., if a board was deleted).
                return;
            }
            currentBoardNameHeader.textContent = currentBoard.title; // Update header title.
            addColumnBtnGlobal.style.display = 'block'; // Show add column button.

            // Iterate through columns and create their elements.
            currentBoard.columns.forEach(colData => {
                const colEl = createColumnElement(colData);
                if (colData.width) colEl.style.width = `${colData.width}px`; // Apply stored width.
                const cInfo = COLUMN_COLORS.find(c => c.value === colData.color) || DEFAULT_COLUMN_COLOR;
                const bgColor = isLight ? (cInfo.light || cInfo.value) : cInfo.value; // Get correct color based on theme
                colEl.style.backgroundColor = bgColor;
                // Adjust text/icon color for contrast.
                const headerColor = getContrastingTextColor(bgColor);
                colEl.querySelector('.column-title').style.color = headerColor;
                colEl.querySelector('.column-menu-btn').style.color = headerColor;
                colEl.querySelector('.column-header').style.borderBottomColor = headerColor === '#f3f4f6' ? '#4b5563' : '#d1d5db'; // Ensure contrast for border
                fragment.appendChild(colEl); // Append to fragment.
            });

            // console.log("YOU MADE HERE !!!!") // Original log line from your provided script
            boardContainer.appendChild(fragment); // Append fragment once.

            // --- 2. Restore scroll positions of task lists ---
            const newTaskLists = boardContainer.querySelectorAll('.column .task-list'); // More specific selector
            newTaskLists.forEach(taskList => {
                const columnEl = taskList.closest('.column');
                if (columnEl && columnEl.dataset.columnId && scrollPositions[columnEl.dataset.columnId] !== undefined) {
                    taskList.scrollTop = scrollPositions[columnEl.dataset.columnId];
                }
            });

            // The line below was in the original script.js.
            // It scrolls the main boardContainer vertically, not individual columns' task lists.
            // Commenting out as the request is about individual column scroll preservation and adjustment.
            // If horizontal scroll of the entire board is needed when adding a NEW COLUMN,
            // that logic would typically be handled in the addNewColumn function, possibly using scrollLeft.
            // boardContainer.setAttribute("scrollTop",boardContainer.scrollHeight - 1);

            renderBoardList(); // Update sidebar.
            saveAppState(); // Save any changes.
        }

        // --- Board Management ---
        // Adds a new, empty board.
        function addNewBoard() {
            const t = prompt("New board name:", "My Board");
            if (t && t.trim()) {
                const b = {
                    id: `board-${appState.nextBoardId++}`,
                    title: t.trim(),
                    columns: [{
                        id: `col-${appState.nextColumnId++}`,
                        title: 'To Do',
                        tasks: [],
                        width: 300,
                        color: DEFAULT_COLUMN_COLOR.value
                    }]
                };
                appState.boards.push(b);
                switchBoard(b.id);
            }
        }
        // Switches the currently active board.
        function switchBoard(id) {
            appState.currentBoardId = id;
            renderBoard();
        }
        addBoardBtnGlobal.addEventListener('click', addNewBoard);
        // Confirms and then deletes a board.
        function confirmDeleteBoard(boardId, boardTitle) {
            if (confirm(`Are you sure you want to delete the board "${boardTitle}"? This cannot be undone.`)) {
                appState.boards = appState.boards.filter(b => b.id !== boardId);
                if (appState.currentBoardId === boardId) {
                    appState.currentBoardId = appState.boards.length > 0 ? appState.boards[0].id : null;
                }
                renderBoard();
            }
        }


        // --- Column Management ---
        // Creates a column DOM element from column data.
        function createColumnElement(cData) {
            const div = document.createElement('div');
            div.className = 'column';
            div.dataset.columnId = cData.id;
            div.draggable = false; // Set initial draggable to false

            const h = document.createElement('div');
            h.className = 'column-header';
            const t = document.createElement('span');
            t.className = 'column-title';
            t.textContent = cData.title;
            const m = document.createElement('button');
            m.className = 'column-menu-btn';
            m.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
            m.title = "Options";
            m.addEventListener('click', e => {
                e.stopPropagation(); // Prevent event from bubbling up to header's drag logic
                showColumnContextMenu(e.currentTarget, cData.id);
            }); // Column context menu.
            h.appendChild(t);
            h.appendChild(m);

            // Make the header draggable, except for the menu button.
            h.addEventListener('mousedown', e => {
                // If the click target is the menu button or its icon, don't drag.
                if (e.target.closest('.column-menu-btn')) {
                    div.draggable = false;
                } else {
                    // Otherwise, allow dragging from anywhere else on the header.
                    div.draggable = true;
                }
            });
            // Reset draggable after mouse up or leaving the column.
            // Note: 'mouseleave' on the column div itself might be too broad if the mouse
            // moves quickly outside during a drag initiation from the header.
            // The dragend on the column should handle resetting draggable for column drags.
            div.addEventListener('mouseup', () => { // Could be on document to catch all mouseups
                div.draggable = false;
            });
             // Ensure draggable is false if mouse leaves while not actively dragging
            h.addEventListener('mouseleave', (e) => {
                if (!draggedColumn || draggedColumn !== div) { // only if not currently dragging this column
                    div.draggable = false;
                }
            });


            // Column drag-and-drop listeners on the main div
            div.addEventListener('dragstart', handleColumnDragStart);
            div.addEventListener('dragend', handleColumnDragEnd);

            const l = document.createElement('div');
            l.className = 'task-list'; // Task container.
            // Task drag-and-drop listeners.
            l.addEventListener('dragover', handleTaskDragOver);
            l.addEventListener('drop', e => handleTaskDrop(e, cData.id));
            l.addEventListener('dragenter', handleTaskDragEnterColumn);
            l.addEventListener('dragleave', handleTaskDragLeaveColumn);

            const taskFragment = document.createDocumentFragment(); // Fragment for tasks.
            cData.tasks.forEach(tData => taskFragment.appendChild(createTaskElement(tData, cData.id)));
            l.appendChild(taskFragment); // Append tasks once.

            const a = document.createElement('div');
            a.className = 'add-card-area'; // Area for new task input.
            const i = document.createElement('input');
            i.type = 'text';
            i.className = 'new-task-input';
            i.placeholder = 'Add a card...';
            i.addEventListener('keypress', e => {
                if (e.key === 'Enter' && i.value.trim()) {
                    addTaskToColumn(cData.id, i.value.trim());
                    i.value = '';
                }
            }); // Add task on Enter.
            const btn = document.createElement('button');
            btn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-md text-sm'; // Example Tailwind classes
            btn.textContent = 'Add Card';
            btn.addEventListener('click', () => {
                if (i.value.trim()) {
                    addTaskToColumn(cData.id, i.value.trim());
                    i.value = '';
                }
            }); // Add task on button click.
            a.appendChild(i);
            a.appendChild(btn);
            div.appendChild(h);
            div.appendChild(l);
            div.appendChild(a);
            return div;
        }

        // Makes a column title editable by replacing it with an input field.
        function makeTitleEditable(titleSpan, columnId) {
            const b = getCurrentBoard();
            if (!b) return;
            const c = b.columns.find(col => col.id === columnId);
            if (!c) return;
            const currentTitle = titleSpan.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentTitle;
            input.className = 'column-title-input';
            titleSpan.style.display = 'none'; // Hide the span
            titleSpan.parentElement.insertBefore(input, titleSpan); // Insert input before span
            input.focus();
            input.select();
            const save = () => {
                const newTitle = input.value.trim();
                if (newTitle) c.title = newTitle;
                // Check if input is still there before removing (might already be gone)
                if (input.parentNode) {
                    input.remove(); // Remove input
                }
                titleSpan.style.display = ''; // Show span again
                renderBoard(); // Rerender - consider a more lightweight update
            };
            input.addEventListener('blur', save);
            input.addEventListener('keypress', e => {
                if (e.key === 'Enter') input.blur();
            });
        }
        // Adds a new column to the current board.
        function addNewColumn() {
            const b = getCurrentBoard();
            if (!b) return;
            const t = prompt("New list title:", "New List");
            if (t && t.trim()) {
                b.columns.push({
                    id: `col-${appState.nextColumnId++}`,
                    title: t.trim(),
                    tasks: [],
                    width: 300,
                    color: DEFAULT_COLUMN_COLOR.value
                });
                renderBoard();
            }
        }
        addColumnBtnGlobal.addEventListener('click', addNewColumn);
        // Confirms and then deletes a column.
        function confirmDeleteColumn(id) {
            if (confirm("Delete this list and all its cards?")) deleteColumn(id);
        }
        // Deletes a column by its ID.
        function deleteColumn(id) {
            const b = getCurrentBoard();
            if (b) {
                b.columns = b.columns.filter(c => c.id !== id);
                renderBoard();
            }
        }


        // Updates the background color of a column.
        function updateColumnColor(id, color) {
            const b = getCurrentBoard();
            const c = b ? b.columns.find(col => col.id === id) : null;
            if (c) {
                c.color = color;
                renderBoard();
            }
        }


        // Sorts tasks within a column by name or date.
        function sortColumn(id, type) {
            const b = getCurrentBoard();
            const c = b ? b.columns.find(col => col.id === id) : null;
            if (!c) return;
            if (type === 'name-az') c.tasks.sort((a, b) => a.text.localeCompare(b.text));
            else if (type === 'date-new') c.tasks.sort((a, b) => b.createdAt - a.createdAt); // Sort newest first
            renderBoard();
        }


        // Removes tasks where all sub-tasks are completed.
        function clearCompleted(id) {
            const b = getCurrentBoard();
            const c = b ? b.columns.find(col => col.id === id) : null;
            if (!c) return;
            // Filter out tasks where all subtasks (if any) are completed.
            // If a task has no subtasks, it's not "completed" in this sense.
            c.tasks = c.tasks.filter(t => {
                if (!t.subTasks || t.subTasks.length === 0) return true; // Keep tasks with no subtasks
                return !t.subTasks.every(st => st.completed); // Keep if not all subtasks are completed
            });
            renderBoard();
        }




        // --- Task Management ---
        // Creates a task (card) DOM element from task data.
        function createTaskElement(tData, cId) {
            const div = document.createElement('div');
            div.className = 'task-item';
            div.dataset.taskId = tData.id;
            div.dataset.columnId = cId;
            div.draggable = true;
            div.style.backgroundColor = tData.color || DEFAULT_TASK_COLOR;
            div.addEventListener('contextmenu', e => {
                e.preventDefault();
                hideAllMenus();
                currentContextMenuTask = {
                    columnId: cId,
                    taskId: tData.id
                };
                populateAndShowContextMenu(e.clientX, e.clientY, tData);
            }); // Task context menu on right-click.
            const star = document.createElement('button');
            star.className = 'star-btn';
            star.innerHTML = '<i class="fas fa-star"></i>';
            star.title = "Star this card";
            if (tData.isStarred) star.classList.add('starred');
            star.addEventListener('click', e => {
                e.stopPropagation();
                toggleStarTask(cId, tData.id);
            }); // Star/unstar task.
            const main = document.createElement('div');
            main.className = 'task-main-content';
            const p = document.createElement('p');
            p.className = 'task-text';
            p.textContent = tData.text;
            p.style.color = getContrastingTextColor(tData.color || DEFAULT_TASK_COLOR); // Task text with contrast color.
            main.appendChild(p);
            div.appendChild(star);
            div.appendChild(main);
            // Form for adding new sub-tasks (initially hidden).
            const subForm = document.createElement('div');
            subForm.className = 'add-subtask-form';
            subForm.style.display = 'none';
            const subInput = document.createElement('input');
            subInput.type = 'text';
            subInput.className = 'new-subtask-input';
            subInput.placeholder = 'New sub-task...';
            const subBtn = document.createElement('button');
            subBtn.className = 'confirm-add-subtask-btn';
            subBtn.textContent = 'Add';
            const addAction = () => {
                if (subInput.value.trim()) {
                    addSubTask(cId, tData.id, subInput.value.trim());
                    subInput.value = '';
                }
            };
            subInput.addEventListener('keypress', e => {
                if (e.key === 'Enter') addAction();
            }); // Add sub-task on Enter.
            subInput.addEventListener('mousedown', e => e.stopPropagation()); // Prevent task drag when clicking input.
            subBtn.addEventListener('click', e => {
                e.stopPropagation();
                addAction();
            }); // Add sub-task on button click.
            subForm.appendChild(subInput);
            subForm.appendChild(subBtn);
            // Container for sub-tasks (initially hidden or shown if sub-tasks exist).
            const subList = document.createElement('div');
            subList.className = 'subtask-list-container';
            subList.style.display = 'none'; // Default to none, show if subtasks exist or form is toggled

            if (tData.subTasks && tData.subTasks.length > 0) {
                const subTaskFragment = document.createDocumentFragment(); // Fragment for sub-tasks.
                tData.subTasks.forEach(st => subTaskFragment.appendChild(createSubTaskElement(st, tData.id, cId, tData.color || DEFAULT_TASK_COLOR)));
                subList.appendChild(subTaskFragment); // Append sub-tasks once.
                subList.style.display = 'flex'; // Show if sub-tasks exist.
            }

            div.appendChild(subForm);
            div.appendChild(subList);
            div.addEventListener('dragstart', handleTaskDragStart);
            div.addEventListener('dragend', handleTaskDragEnd);
            return div;
        }
        // Adds a new task to a specific column.
        function addTaskToColumn(cId, text) {
            const b = getCurrentBoard();
            const c = b ? b.columns.find(col => col.id === cId) : null;
            if (c) {
                c.tasks.push({
                    id: `task-${appState.nextTaskId++}`,
                    text,
                    color: DEFAULT_TASK_COLOR,
                    subTasks: [],
                    isStarred: false,
                    createdAt: Date.now()
                });
                renderBoard(); // This will re-render the board, preserving other columns' scroll positions
                               // and the current column's scroll position before the new task is visually added.

                // After renderBoard has completed and restored general scroll positions,
                // specifically scroll the task list of the column where the new task was added to the bottom.
                const columnElement = boardContainer.querySelector(`.column[data-column-id="${cId}"]`);
                if (columnElement) {
                    const taskListElement = columnElement.querySelector('.task-list');
                    if (taskListElement) {
                        // Ensure new task is visible by scrolling to the bottom of the task list
                        taskListElement.scrollTop = taskListElement.scrollHeight;
                    }
                }
            }
        }
        // Deletes a task by its ID.
        function deleteTask(cId, tId) {
            const b = getCurrentBoard();
            const c = b ? b.columns.find(col => col.id === cId) : null;
            if (c) {
                c.tasks = c.tasks.filter(t => t.id !== tId);
                renderBoard();
            }
        }
        // Updates the color of a task.
        function updateTaskColor(cId, tId, color) {
            const t = getTaskById(cId, tId);
            if (t) {
                t.color = color;
                renderBoard();
            }
        }
        // Toggles the starred status of a task.
        function toggleStarTask(cId, tId) {
            const t = getTaskById(cId, tId);
            if (t) {
                t.isStarred = !t.isStarred;
                renderBoard();
            }
        }
        // Duplicates an existing task.
        function duplicateTask(columnId, taskId) {
            const board = getCurrentBoard();
            if (!board) return;
            const column = board.columns.find(col => col.id === columnId);
            if (!column) return;
            const taskIndex = column.tasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return;
            const originalTask = column.tasks[taskIndex];
            const newTask = {
                id: `task-${appState.nextTaskId++}`,
                text: `${originalTask.text}`, // Create a copy of the text
                color: originalTask.color,
                isStarred: originalTask.isStarred,
                createdAt: Date.now(),
                subTasks: originalTask.subTasks.map(st => ({ // Deep copy sub-tasks
                    id: `subtask-${appState.nextSubTaskId++}`,
                    text: st.text,
                    completed: st.completed
                }))
            };
            column.tasks.splice(taskIndex + 1, 0, newTask);
            renderBoard();
        }

        // --- Sub-task Management ---

        // Toggles the visibility of the sub-task form and list within a task.
        function toggleSubtaskVisibility(cId, tId) {
            const taskElement = document.querySelector(`.task-item[data-task-id="${tId}"][data-column-id="${cId}"]`);
            if (!taskElement) return;

            const subtaskForm = taskElement.querySelector('.add-subtask-form');
            const subtaskListContainer = taskElement.querySelector('.subtask-list-container');

            if (!subtaskForm || !subtaskListContainer) return;

            const isCurrentlyHidden = subtaskForm.style.display === 'none';

            if (isCurrentlyHidden) {
                subtaskForm.style.display = 'flex';
                // Show list container only if it has subtasks or if the form is being shown (to maintain layout consistency)
                subtaskListContainer.style.display = 'flex';
                const inputField = subtaskForm.querySelector('.new-subtask-input');
                if (inputField) inputField.focus();
            } else {
                subtaskForm.style.display = 'none';
                // If form is hidden, only show subtask list if it actually has subtasks
                if (subtaskListContainer.children.length > 0) {
                    subtaskListContainer.style.display = 'flex';
                } else {
                    subtaskListContainer.style.display = 'none';
                }
            }
        }


        // Creates a sub-task DOM element.
        function createSubTaskElement(stData, tId, cId, pColor) { // pColor is parent task's color
            const item = document.createElement('div');
            item.className = 'subtask-item';
            item.dataset.subtaskId = stData.id;

            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.checked = stData.completed;
            chk.addEventListener('change', () => {
                toggleSubTaskComplete(cId, tId, stData.id);
                // No full re-render, just update style of text
                span.classList.toggle('completed', chk.checked);
                saveAppState(); // Save state after toggling
            });
            chk.addEventListener('mousedown', e => e.stopPropagation()); // Prevent task drag.

            const span = document.createElement('span');
            span.textContent = stData.text;
            if (stData.completed) span.classList.add('completed');

            // Determine subtask text color based on parent task's background for better contrast
            const subtaskTextColor = getContrastingTextColor(pColor);
            span.style.color = subtaskTextColor;
            // Also apply to checkbox border and checkmark if needed by theme, or handle via CSS vars

            const controls = document.createElement('div');
            controls.className = 'subtask-controls';
            controls.addEventListener('mousedown', e => e.stopPropagation()); // Prevent task drag.

            const duplicateBtn = document.createElement('button');
            duplicateBtn.className = 'subtask-btn';
            duplicateBtn.innerHTML = '<i class="fas fa-copy"></i>';
            duplicateBtn.title = "Duplicate sub-task";
            duplicateBtn.addEventListener('click', () => duplicateSubTask(cId, tId, stData.id)); // Duplicate button.

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'subtask-btn delete';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>'; // Using fa-times for delete icon
            deleteBtn.title = "Delete sub-task";
            deleteBtn.addEventListener('click', () => deleteSubTask(cId, tId, stData.id)); // Delete button.

            controls.appendChild(duplicateBtn);
            controls.appendChild(deleteBtn);
            item.appendChild(chk);
            item.appendChild(span);
            item.appendChild(controls);
            return item;
        }
        // Adds a new sub-task to a specific task.
        function addSubTask(cId, tId, text) {
            const t = getTaskById(cId, tId);
            if (!t) return;
            if (!t.subTasks) t.subTasks = [];
            t.subTasks.push({
                id: `subtask-${appState.nextSubTaskId++}`,
                text,
                completed: false
            });
            renderBoard(); // Re-render to show the new subtask
            // Ensure the subtask list is visible after adding
            const taskElement = document.querySelector(`.task-item[data-task-id="${tId}"]`);
            if (taskElement) {
                const subtaskList = taskElement.querySelector('.subtask-list-container');
                const subtaskForm = taskElement.querySelector('.add-subtask-form');
                if (subtaskList) subtaskList.style.display = 'flex';
                if (subtaskForm && subtaskForm.style.display === 'flex') { // if form is open
                     const inputField = subtaskForm.querySelector('.new-subtask-input');
                     if (inputField) inputField.focus(); // refocus on input
                }
            }
        }
        // Toggles the completion status of a sub-task.
        function toggleSubTaskComplete(cId, tId, stId) {
            const t = getTaskById(cId, tId);
            const st = t ? t.subTasks.find(s => s.id === stId) : null;
            if (st) {
                st.completed = !st.completed;
                // State is saved by the checkbox's event listener after calling this
            }
            // No renderBoard() here, handled by checkbox's listener for local update + saveAppState
        }
        // Deletes a sub-task by its ID.
        function deleteSubTask(cId, tId, stId) {
            const t = getTaskById(cId, tId);
            if (t) {
                t.subTasks = t.subTasks.filter(s => s.id !== stId);
                renderBoard(); // Re-render to reflect deletion
            }
        }
        // Duplicates an existing sub-task.
        function duplicateSubTask(columnId, taskId, subTaskId) {
            const task = getTaskById(columnId, taskId);
            if (!task || !task.subTasks) return;
            const subTaskIndex = task.subTasks.findIndex(st => st.id === subTaskId);
            if (subTaskIndex === -1) return;
            const originalSubTask = task.subTasks[subTaskIndex];
            const newSubTask = {
                id: `subtask-${appState.nextSubTaskId++}`,
                text: `${originalSubTask.text}`, // Create a copy
                completed: originalSubTask.completed
            };
            task.subTasks.splice(subTaskIndex + 1, 0, newSubTask);
            renderBoard();
        }

        // --- Context Menu Management ---
        // Hides all currently displayed context menus and resets column styles.
        function hideAllMenus() {
            taskColorContextMenu.style.display = 'none';
            columnContextMenu.style.display = 'none';

            // Reset any previously opened column
            if (currentOpenColumnElement) {
                currentOpenColumnElement.style.overflow = 'hidden'; // Set back to hidden
                currentOpenColumnElement.style.zIndex = ''; // Reset z-index
                // Ensure menu is moved back to body if needed, or just hidden
                if (columnContextMenu.parentNode !== body && columnContextMenu.parentNode === currentOpenColumnElement) {
                    body.appendChild(columnContextMenu); // Move back to body if it was inside column
                }
                currentOpenColumnElement = null;
            }
            // Ensure task menu is also back in body if it was moved (though less likely for task menu)
            if (taskColorContextMenu.parentNode !== body) {
                body.appendChild(taskColorContextMenu);
            }
        }

        // Positions a context menu near the mouse click, ensuring it stays within bounds.
        function positionMenu(menuEl, x, y) {
            // This function is now mainly for the task menu (body-relative)
            const scrollX = window.scrollX || window.pageXOffset;
            const scrollY = window.scrollY || window.pageYOffset;
            let finalX = x + scrollX;
            let finalY = y + scrollY;

            menuEl.style.display = 'flex'; // Display first to get accurate rect
            const rect = menuEl.getBoundingClientRect();

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Adjust X if it goes off-screen right
            if ((x + rect.width + 5) > viewportWidth) { // x is clientX here
                finalX = (x + scrollX) - rect.width;
            }
            // Adjust Y if it goes off-screen bottom
            if ((y + rect.height + 5) > viewportHeight) { // y is clientY here
                finalY = (y + scrollY) - rect.height;
            }

            // Ensure it doesn't go off-screen left/top
            finalX = Math.max(scrollX + 5, finalX); // Add scrollX for absolute positioning from viewport relative clientX
            finalY = Math.max(scrollY + 5, finalY); // Add scrollY for absolute positioning from viewport relative clientY


            menuEl.style.left = `${finalX}px`;
            menuEl.style.top = `${finalY}px`;
        }

        // Populates and shows the context menu for a task.
        function populateAndShowContextMenu(x, y, tData) {
            hideAllMenus(); // Hide any other menus first
            taskColorContextMenu.innerHTML = '';
            const {
                columnId,
                taskId
            } = currentContextMenuTask;
            // Ensure task menu is in body before positioning
            if (taskColorContextMenu.parentNode !== body) {
                body.appendChild(taskColorContextMenu);
            }
            const items = [{
                text: 'Sub-tasks',
                icon: 'fa-tasks',
                action: () => toggleSubtaskVisibility(columnId, taskId)
            }, {
                text: 'Duplicate Card',
                icon: 'fa-copy',
                action: () => duplicateTask(columnId, taskId)
            }, {
                text: 'Delete Card',
                icon: 'fa-trash-alt',
                action: () => deleteTask(columnId, taskId),
                isDelete: true
            }];
            items.forEach(i => {
                const d = document.createElement('div');
                d.className = `menu-item ${i.isDelete ? 'delete' : ''}`;
                d.innerHTML = `<i class="fas ${i.icon}"></i><span>${i.text}</span>`;
                d.addEventListener('click', () => {
                    i.action();
                    hideAllMenus();
                });
                taskColorContextMenu.appendChild(d);
            });
            taskColorContextMenu.appendChild(document.createElement('hr')).className = 'menu-divider';
            PRESET_COLORS.forEach(c => {
                const d = document.createElement('div');
                d.className = 'menu-item';
                const s = document.createElement('div');
                s.className = 'context-menu-color-swatch';
                s.style.backgroundColor = c.value;
                d.innerHTML = `<span>${c.name}</span>`;
                if (c.value === tData.color) d.style.fontWeight = 'bold'; // Highlight current color
                d.prepend(s);
                d.addEventListener('click', () => {
                    updateTaskColor(columnId, taskId, c.value);
                    hideAllMenus();
                });
                taskColorContextMenu.appendChild(d);
            });
            positionMenu(taskColorContextMenu, x, y); // Use the (now updated) positionMenu
        }

        // Populates and shows the context menu for a column.
        function showColumnContextMenu(btnEl, cId) {
            hideAllMenus(); // Hide others and reset previous column first
            currentContextMenuColumn.columnId = cId;
            columnContextMenu.innerHTML = ''; // Clear old content

            const columnEl = btnEl.closest('.column'); // Find the parent column element
            if (!columnEl) return; // Exit if we can't find the column

            // --- Style the Column and Move the Menu ---
            // columnEl.style.position = 'relative'; // Make it the positioning context - CSS already handles this
            columnEl.style.overflow = 'visible'; // Allow menu to show outside bounds
            columnEl.style.zIndex = '20'; // Bring it above other columns
            currentOpenColumnElement = columnEl; // Remember which column is open
            columnEl.appendChild(columnContextMenu); // MOVE the menu inside the column!

            // --- Populate Menu Items ---
            const items = [{
                text: 'Rename List',
                icon: 'fa-edit',
                action: () => {
                    const t = document.querySelector(`.column[data-column-id="${cId}"] .column-title`);
                    if (t) makeTitleEditable(t, cId);
                }
            }, {
                text: 'Change Color',
                icon: 'fa-palette',
                submenu: COLUMN_COLORS // Submenu for colors
            }, {
                text: 'Sort by Name',
                icon: 'fa-sort-alpha-down',
                action: () => sortColumn(cId, 'name-az')
            }, {
                text: 'Sort by Date',
                icon: 'fa-sort-numeric-down',
                action: () => sortColumn(cId, 'date-new')
            }, {
                text: 'Clear Completed',
                icon: 'fa-broom',
                action: () => clearCompleted(cId)
            }, {
                text: 'Delete List',
                icon: 'fa-trash-alt',
                action: () => confirmDeleteColumn(cId),
                isDelete: true
            }];

            let needsDividerAfterColors = false;
            items.forEach((i, idx) => {
                // Add dividers strategically
                if (i.text === 'Change Color') {
                     needsDividerAfterColors = true; // Will add divider after colors submenu
                } else if ((i.text === 'Sort by Name' && !needsDividerAfterColors) || i.text === 'Delete List') {
                    columnContextMenu.appendChild(document.createElement('hr')).className = 'menu-divider';
                }


                const d = document.createElement('div');
                d.className = `menu-item ${i.isDelete ? 'delete' : ''} ${i.submenu ? 'submenu' : ''}`;
                d.innerHTML = `<i class="fas ${i.icon}"></i><span>${i.text}</span>`;
                if (i.submenu) {
                    const sub = document.createElement('div');
                    sub.className = 'menu-base submenu-content'; // Use menu-base for consistent styling
                    i.submenu.forEach(col => {
                        const subItem = document.createElement('div');
                        subItem.className = 'menu-item';
                        const s = document.createElement('div');
                        s.className = 'context-menu-color-swatch';
                        s.style.backgroundColor = body.classList.contains('light-mode') ? (col.light || col.value) : col.value;
                        subItem.innerHTML = `<span>${col.name}</span>`;
                        subItem.prepend(s);
                        subItem.addEventListener('click', e => {
                            e.stopPropagation(); // Prevent parent menu item click
                            updateColumnColor(cId, col.value); // Store the dark mode value
                            hideAllMenus();
                        });
                        sub.appendChild(subItem);
                    });
                    d.appendChild(sub);
                     // Add event listener to the parent menu item if it's a submenu trigger
                     // This isn't strictly necessary if using hover via CSS, but can be for click-to-open
                     d.addEventListener('click', (e) => {
                         // If you want click to toggle submenu, add logic here
                         // For hover-only, CSS handles it.
                     });
                } else {
                    d.addEventListener('click', () => {
                        i.action();
                        hideAllMenus();
                    });
                }
                columnContextMenu.appendChild(d);
                if (needsDividerAfterColors && i.text === 'Change Color') {
                    columnContextMenu.appendChild(document.createElement('hr')).className = 'menu-divider';
                    needsDividerAfterColors = false;
                }
            });

            // --- Calculate Position Relative to Column ---
            // Position relative to the button that opened it
            const menuButtonRect = btnEl.getBoundingClientRect();
            const columnRect = columnEl.getBoundingClientRect();

            // Position below the button, aligned to its right edge usually
            let menuX = btnEl.offsetLeft + btnEl.offsetWidth - columnContextMenu.offsetWidth; // Align right of button
            let menuY = btnEl.offsetTop + btnEl.offsetHeight + 2; // Below button

             // Basic boundary checks within the column - this might need refinement
            if (menuX < 0) menuX = 5;
            // if (menuX + columnContextMenu.offsetWidth > columnEl.offsetWidth) menuX = columnEl.offsetWidth - columnContextMenu.offsetWidth - 5;


            // --- Position and Show ---
            columnContextMenu.style.left = `${menuX}px`;
            columnContextMenu.style.top = `${menuY}px`;
            columnContextMenu.style.display = 'flex';
        }

        // --- Drag and Drop ---

        // --- Task Drag and Drop ---
        // Handles the start of a task drag operation.
        function handleTaskDragStart(e) {
            const t = e.target.closest('.task-item');
            // Prevent drag if clicking on interactive elements or if a column drag is in progress.
            if (!t || e.target.closest('input, button, .subtask-controls, .star-btn') || draggedColumn) {
                e.preventDefault();
                return;
            }
            draggedTask = t; // Set the dragged task.
            sourceColumnId = t.dataset.columnId; // Remember where it came from.
            e.dataTransfer.setData('text/plain', t.dataset.taskId); // Set data.
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => t.classList.add('dragging'), 0); // Apply 'dragging' style.
        }
        // Handles the end of a task drag operation (cleanup).
        function handleTaskDragEnd() {
            if (draggedTask) draggedTask.classList.remove('dragging');
            draggedTask = null;
            sourceColumnId = null;
            document.querySelectorAll('.column.drag-over').forEach(c => c.classList.remove('drag-over'));
        }
        // Allows a drop by preventing the default behavior (Task specific).
        function handleTaskDragOver(e) {
            // Only allow drop if a task is being dragged, not a column
            if (draggedTask) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        }
        // Adds a visual indicator when a task is dragged over a column.
        function handleTaskDragEnterColumn(e) {
            const col = e.target.closest('.column'); // Ensure it's the column itself or its task-list
            if (draggedTask && col) { // Check if a task is being dragged
                 // Check if the target is the task-list or the column div itself if task-list is empty
                if (e.target.classList.contains('task-list') || e.target === col) {
                    col.classList.add('drag-over');
                }
            }
        }
        // Removes the visual indicator when a task is dragged out of a column.
        function handleTaskDragLeaveColumn(e) {
            const col = e.target.closest('.column');
             if (draggedTask && col) {
                // Check if the relatedTarget (where the mouse is going) is outside the column
                // or specifically outside the task-list area.
                if (!col.contains(e.relatedTarget) || !e.target.closest('.task-list')) {
                     col.classList.remove('drag-over');
                }
            }
        }
        // Handles dropping a task into a column.
        function handleTaskDrop(e, tColId) { // tColId is targetColumnId from createColumnElement
            e.preventDefault();
            // Only handle drop if it's a task being dragged
            if (!draggedTask || !sourceColumnId) return;

            const tColEl = e.target.closest('.column');
            if (tColEl) tColEl.classList.remove('drag-over'); // Remove visual cue

            const b = getCurrentBoard();
            if (!b) return;

            const tId = draggedTask.dataset.taskId; // ID of the task being dragged
            const sCol = b.columns.find(c => c.id === sourceColumnId); // Source column from appState
            const sIdx = sCol ? sCol.tasks.findIndex(t => t.id === tId) : -1;

            if (sIdx === -1) { // Task not found in source column state (should not happen if drag started correctly)
                console.error("Dragged task not found in source column state.");
                handleTaskDragEnd(); // Clean up drag state
                return;
            }
            const [tData] = sCol.tasks.splice(sIdx, 1); // Remove task data from source column in appState

            const tCol = b.columns.find(c => c.id === tColId); // Target column from appState
            if (!tCol) { // Target column not found (should not happen)
                sCol.tasks.splice(sIdx, 0, tData); // Put task back if target is invalid
                console.error("Target column not found in state.");
                renderBoard(); // Re-render to correct potential visual glitch
                return;
            }
            // Find the position to insert the task based on mouse Y-coordinate within the task list.
            const tListEl = tColEl ? tColEl.querySelector('.task-list') : null;
            if (!tListEl) { // Should not happen if tColEl is valid
                 tCol.tasks.push(tData); // Add to end as fallback
                 renderBoard();
                 return;
            }

            const directDropTargetTask = e.target.closest('.task-item:not(.dragging)');
            let refNode = null;

            if (directDropTargetTask) {
                const rect = directDropTargetTask.getBoundingClientRect();
                // If dropping in the top half of an existing task, insert before it. Otherwise, after.
                // This provides more intuitive placement.
                if (e.clientY < rect.top + rect.height / 2) {
                    refNode = directDropTargetTask;
                } else {
                    // Find the next sibling to insert before, or null if it's the last one
                    refNode = directDropTargetTask.nextElementSibling;
                }
            } else {
                 // If not dropping directly on a task, try to find based on Y position among all tasks
                const tasksInList = Array.from(tListEl.querySelectorAll('.task-item:not(.dragging)'));
                refNode = tasksInList.find(el => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
            }


            const refIdx = refNode ? tCol.tasks.findIndex(t => t.id === refNode.dataset.taskId) : -1;

            if (refIdx !== -1) {
                tCol.tasks.splice(refIdx, 0, tData); // Insert before the reference node in appState
            } else {
                tCol.tasks.push(tData); // Append to target column in appState if no specific position found
            }
            renderBoard(); // Re-render to reflect changes in appState
        }

        // --- Column Drag Handlers ---
        function handleColumnDragStart(e) {
            // Ensure it's the column itself and it's set to draggable (from header mousedown)
            if (e.target.classList.contains('column') && e.target.draggable) {
                draggedColumn = e.target;
                // sourceColumnId = draggedColumn.dataset.columnId; // Already have this from mousedown logic if needed
                e.dataTransfer.setData('text/plain', draggedColumn.dataset.columnId);
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => draggedColumn.classList.add('dragging-col'), 0);
                // draggedTask = null; // Ensure no task drag conflicts, already handled in task drag start
            } else {
                 if (e.target.classList.contains('column') && !e.target.draggable) {
                    e.preventDefault(); // Prevent drag if draggable flag is not set
                 }
            }
        }

        function handleColumnDragEnd() {
            if (draggedColumn) {
                draggedColumn.classList.remove('dragging-col');
                draggedColumn.draggable = false; // Reset draggable state explicitly after drag
            }
            draggedColumn = null;
            // sourceColumnId = null; // Reset if you were using it for column drag logic
            // Clear any column drag over indicators if used
             document.querySelectorAll('.column.drag-over-indicator').forEach(c => c.classList.remove('drag-over-indicator'));
        }

        // Finds the column element that the dragged column should be placed before.
        function getDragAfterColumn(container, x) { // x is clientX
            const draggableColumns = [...container.querySelectorAll('.column:not(.dragging-col)')];

            return draggableColumns.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = x - box.left - box.width / 2; // Find offset from the center
                // If offset is negative (mouse is to the left of center) and closer than previous.
                if (offset < 0 && offset > closest.offset) {
                    return {
                        offset: offset,
                        element: child
                    };
                } else {
                    return closest;
                }
            }, {
                offset: Number.NEGATIVE_INFINITY
            }).element;
        }

        // Handles dragging a column over the board container.
        function handleBoardDragOver(e) {
            e.preventDefault(); // Necessary to allow drop
            if (!draggedColumn) return; // Only act if a column is being dragged.
            e.dataTransfer.dropEffect = 'move';

            // Optional: Add visual indicators for drop position between columns
            document.querySelectorAll('.column.drag-over-indicator').forEach(c => c.classList.remove('drag-over-indicator'));
            const afterElement = getDragAfterColumn(boardContainer, e.clientX);
            if (afterElement) {
                // This logic for indicator needs to be on the element *before* which it would be inserted.
                // So, if 'afterElement' is where it drops *before*, the indicator might be on its left side or on the right of the previous.
                // For simplicity, we could highlight the whole board or the 'afterElement'.
                // Example: afterElement.classList.add('drag-over-indicator'); (CSS needed for .drag-over-indicator)
            }
        }

        // Handles dropping a column onto the board container.
        function handleBoardDrop(e) {
            e.preventDefault();
            if (!draggedColumn) return; // Only act if a column was dropped.

            const currentBoard = getCurrentBoard();
            if (!currentBoard) {
                 handleColumnDragEnd(); // Clean up
                 return;
            }

            const draggedId = draggedColumn.dataset.columnId;
            const draggedIndex = currentBoard.columns.findIndex(c => c.id === draggedId);

            if (draggedIndex === -1) {
                console.error("Dragged column not found in state.");
                handleColumnDragEnd(); // Clean up
                return;
            }

            // Find where to drop the column
            const afterElement = getDragAfterColumn(boardContainer, e.clientX);
            const [movedColumnData] = currentBoard.columns.splice(draggedIndex, 1); // Remove from old position in appState

            if (afterElement == null) { // If no element to drop before, means drop at the end
                currentBoard.columns.push(movedColumnData);
            } else {
                const afterId = afterElement.dataset.columnId;
                const targetIndex = currentBoard.columns.findIndex(c => c.id === afterId);
                if (targetIndex !== -1) {
                    currentBoard.columns.splice(targetIndex, 0, movedColumnData); // Insert at new position in appState
                } else {
                     // Fallback: if targetIndex is somehow not found, add to end
                    currentBoard.columns.push(movedColumnData);
                    console.error("Target column for drop not found, appending to end.");
                }
            }

            handleColumnDragEnd(); // Clean up drag state
            renderBoard(); // Re-render the board with the new order from appState
        }

        // --- Global Listeners ---
        // Handles clicks outside menus or sidebar to close them.
        document.addEventListener('click', (e) => {
            // Close Task Context Menu
            if (!taskColorContextMenu.contains(e.target) && !e.target.closest('.task-item')) { // Also check if click was on a task item to prevent immediate close on open
                if (taskColorContextMenu.style.display === 'flex') { // only hide if it was open
                     // Check if the click was on the item that opened it.
                     // This is tricky because the menu opens on contextmenu, not click.
                     // So, any click outside should close it.
                }
                taskColorContextMenu.style.display = 'none';
            }

            // Close Column Context Menu
            // If the click is NOT inside the column menu AND NOT the 3-dot button (or its icon) that opens it
            if (!columnContextMenu.contains(e.target) && !e.target.closest('.column-menu-btn')) {
                 if (columnContextMenu.style.display === 'flex') { // only hide if it was open
                    hideAllMenus(); // Use hideAllMenus to ensure column styles are reset
                 }
            }

            // Close Sidebar
            if (!sidebar.contains(e.target) && !e.target.closest('#openSidebarBtn') && !sidebar.classList.contains('-translate-x-full')) {
                closeSidebar();
            }
        });

        // Handles the Escape key to close menus and sidebar.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideAllMenus();
                closeSidebar();
            }
        });

        // --- Initialize ---
        // Loads the application state when the DOM is fully loaded.
        document.addEventListener('DOMContentLoaded', () => {
            loadAppState();
            // Add listeners for column drag/drop to the main container
            boardContainer.addEventListener('dragover', handleBoardDragOver);
            boardContainer.addEventListener('drop', handleBoardDrop);

            // Ensure menus are in the body initially and hidden
            // This helps with initial positioning and z-index stacking context.
            if (taskColorContextMenu.parentNode !== body) body.appendChild(taskColorContextMenu);
            if (columnContextMenu.parentNode !== body) body.appendChild(columnContextMenu);
            taskColorContextMenu.style.display = 'none';
            columnContextMenu.style.display = 'none';
        });