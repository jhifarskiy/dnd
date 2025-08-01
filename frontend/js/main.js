document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = ''; // Оставляем пустым для работы на одном домене
    let socket = io(BACKEND_URL);

    // --- DOM Элементы ---
    const authContainer = document.getElementById('auth-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const authMessage = document.getElementById('authMessage');
    const mainAppContainer = document.getElementById('main-app');
    const logoutBtn = document.getElementById('logoutBtn');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const battleMapCanvas = document.getElementById('battleMap');
    const ctx = battleMapCanvas.getContext('2d');
    const gridSizeInput = document.getElementById('gridSize');
    const mapBackgroundInput = document.getElementById('mapBackground');
    const loadMapBackgroundBtn = document.getElementById('loadMapBackground');
    const characterManagerPanel = document.getElementById('character-manager');
    const characterSelector = document.getElementById('characterSelector');
    const loadCharacterBtn = document.getElementById('loadCharacterBtn');
    const newCharacterBtn = document.getElementById('newCharacterBtn');
    const deleteCharacterBtn = document.getElementById('deleteCharacterBtn');
    const openSheetBtn = document.getElementById('open-sheet-btn');
    const eventLogDisplay = document.getElementById('eventLogDisplay');
    const eventLogInput = document.getElementById('eventLogInput');
    const eventLogSendBtn = document.getElementById('eventLogSendBtn');
    const combatTrackerPanel = document.getElementById('combat-tracker');
    const initiativeTracker = document.getElementById('initiativeTracker');
    const startCombatBtn = document.getElementById('startCombatBtn');
    const nextTurnBtn = document.getElementById('nextTurnBtn');
    const endCombatBtn = document.getElementById('endCombatBtn');
    const addNpcBtn = document.getElementById('addNpcBtn');
    const npcNameInput = document.getElementById('npcNameInput');
    const npcInitiativeInput = document.getElementById('npcInitiativeInput');
    const addNpcForm = document.getElementById('add-npc-form');
    const combatControls = document.getElementById('combat-controls');
    const sheetModal = document.getElementById('sheet-modal');
    const closeSheetBtn = document.getElementById('close-sheet-btn');
    const sheetContainer = document.getElementById('character-sheet-container');


    // --- Состояние приложения ---
    let userData = { token: null, userId: null, username: null };
    let isGm = false;
    let activeCharacterId = null;
    let currentCharacterData = {};
    let currentCombatState = null;
    let mapData = { gridSize: 50, backgroundUrl: '', backgroundImage: null, characters: [] };
    let selectedCharacterForMove = null;
    let hoveredCell = null;
    let animationFrameId = null;

    // --- HTML-шаблон для листа персонажа ---
    function getCharacterSheetHTML() {
        return `
            <header class="sheet-header">
                <div class="header-section"><span class="label">ИМЯ ПЕРСОНАЖА</span><input type="text" id="characterName" value="Имя"></div>
                <div class="header-section"><span class="label">КЛАСС И УРОВЕНЬ</span><p>Класс 1</p></div>
                <div class="header-section"><span class="label">ПРЕДЫСТОРИЯ</span><p>Предыстория</p></div>
                <div class="header-section"><span class="label">ИМЯ ИГРОКА</span><p>${userData.username}</p></div>
                <div class="header-section"><span class="label">РАСА</span><p>Раса</p></div>
                <div class="header-section"><span class="label">МИРОВОЗЗРЕНИЕ</span><p>Мировоззрение</p></div>
            </header>
            <main class="sheet-main">
                <section class="abilities-section">
                </section>
                <section class="combat-section">
                </section>
            </main>
        `;
    }

    // --- Логика аутентификации ---
    function setupAuthEventListeners() {
        showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden'); authMessage.textContent = ''; });
        showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden'); authMessage.textContent = ''; });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            try {
                const response = await fetch(`${BACKEND_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                const data = await response.json();
                if (response.ok) {
                    login(data);
                } else {
                    authMessage.textContent = data.message;
                    authMessage.style.color = 'var(--accent-danger)';
                }
            } catch (e) { authMessage.textContent = 'Ошибка сети'; }
        });

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const password = document.getElementById('registerPassword').value;
            try {
                const response = await fetch(`${BACKEND_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                const data = await response.json();
                authMessage.textContent = data.message;
                if (response.ok) {
                    authMessage.style.color = 'var(--accent-primary)';
                    document.getElementById('registerUsername').value = '';
                    document.getElementById('registerPassword').value = '';
                    setTimeout(() => showLoginLink.click(), 1000);
                } else {
                    authMessage.style.color = 'var(--accent-danger)';
                }
            } catch (e) { authMessage.textContent = 'Ошибка сети'; }
        });

        logoutBtn.addEventListener('click', logout);
    }

    function login({ token, userId, username }) {
        userData = { token, userId, username };
        localStorage.setItem('userData', JSON.stringify(userData));
        
        if (username.toLowerCase() === 'gm') {
            isGm = true;
        }

        authContainer.classList.add('hidden');
        mainAppContainer.classList.remove('hidden');
        usernameDisplay.textContent = username;
        initializeApp();
        
        socket.emit('user:identify', { username: userData.username });
    }

    function logout() {
        userData = { token: null, userId: null, username: null };
        localStorage.removeItem('userData');
        window.location.reload();
    }

    function checkAuthState() {
        const storedData = localStorage.getItem('userData');
        if (storedData) {
            const data = JSON.parse(storedData);
            if (data.token) {
                login(data);
            }
        } else {
            authContainer.classList.remove('hidden');
            mainAppContainer.classList.add('hidden');
        }
    }

    // --- WebSocket ---
    function setupSocketListeners() {
        socket.on('connect', () => {
            console.log('Socket connected!');
            if(userData.username) {
                socket.emit('user:identify', { username: userData.username });
            }
            socket.emit('map:get');
            socket.emit('combat:get');
        });
        socket.on('map:update', (allCharacters) => {
            allCharacters.forEach(serverChar => {
                const localChar = mapData.characters.find(c => c._id === serverChar._id);
                if (!localChar) {
                    serverChar.spawnTime = performance.now();
                    serverChar.currentX = serverChar.mapX;
                    serverChar.currentY = serverChar.mapY;
                } else {
                    serverChar.spawnTime = localChar.spawnTime;
                    serverChar.currentX = localChar.currentX;
                    serverChar.currentY = localChar.currentY;
                }
            });
            mapData.characters = allCharacters;
        });
        socket.on('log:new_message', (messageData) => {
            const messageElement = document.createElement('p');
            const prefix = messageData.charName ? `<strong>${messageData.charName}:</strong>` : '';
            messageElement.innerHTML = `${prefix} ${messageData.text}`;
            eventLogDisplay.appendChild(messageElement);
            eventLogDisplay.scrollTop = eventLogDisplay.scrollHeight;
        });
        socket.on('combat:update', (newState) => {
            currentCombatState = newState;
            renderCombatTracker();
        });
    }

    // --- Логика приложения ---
    function initializeApp() {
        loadCharacterBtn.textContent = 'Выбрать'; // ИЗМЕНЕНО
        if (isGm) {
            characterManagerPanel.classList.add('hidden');
        } else {
            characterManagerPanel.classList.remove('hidden');
        }
        createDiceRoller();
        resizeCanvas();
        loadCharacterList();
        loadMapData();
        setupMainEventListeners();
        setupSocketListeners();
        gameLoop();
    }

    async function loadCharacterList() {
        if(isGm) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/characters`, { headers: { 'Authorization': `Bearer ${userData.token}` } });
            if (!response.ok) {
                if (response.status === 401) return logout();
                throw new Error('Failed to fetch characters');
            }
            const characters = await response.json();
            characterSelector.innerHTML = '<option disabled selected>-- Выберите персонажа --</option>';
            if (characters.length > 0) {
                characters.forEach(char => {
                    const option = document.createElement('option');
                    option.value = char._id;
                    option.textContent = char.name;
                    characterSelector.appendChild(option);
                });
            }
        } catch (error) { console.error("Failed to load character list:", error); }
    }

    async function loadCharacter(id) {
        if (!id) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/characters/${id}`, { headers: { 'Authorization': `Bearer ${userData.token}` } });
            if (!response.ok) throw new Error('Character not found');
            currentCharacterData = await response.json();
            activeCharacterId = id;
            socket.emit('character:join', currentCharacterData);
        } catch (error) { console.error("Failed to load character:", error); }
    }

    async function createNewCharacter() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/characters`, { method: 'POST', headers: { 'Authorization': `Bearer ${userData.token}` } });
            const newCharacter = await response.json();
            await loadCharacterList();
            characterSelector.value = newCharacter._id;
            await loadCharacter(newCharacter._id);
        } catch (error) { console.error("Failed to create character:", error); }
    }

    async function deleteCharacter() {
        const selectedId = characterSelector.value;
        if (!selectedId || characterSelector.selectedIndex === 0) { alert("Персонаж не выбран."); return; }
        const characterName = characterSelector.options[characterSelector.selectedIndex].text;
        if (confirm(`Вы уверены, что хотите удалить персонажа "${characterName}"?`)) {
            try {
                await fetch(`${BACKEND_URL}/api/characters/${selectedId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${userData.token}` } });
                await loadCharacterList();
                activeCharacterId = null;
                currentCharacterData = {};
            } catch (error) { console.error("Failed to delete character:", error); }
        }
    }

    function sendLogMessage(text) {
        if (text && text.trim() !== '') {
            const messageData = { text: text, charName: isGm ? 'Мастер' : (currentCharacterData.name || 'Игрок') };
            socket.emit('log:send', messageData);
        }
    }

    // --- Логика карты ---
    function resizeCanvas() {
        const container = document.getElementById('map-container');
        battleMapCanvas.width = container.clientWidth;
        battleMapCanvas.height = container.clientHeight;
    }

    function gameLoop() {
        drawMap();
        requestAnimationFrame(gameLoop);
    }

    function drawMap() {
        ctx.clearRect(0, 0, battleMapCanvas.width, battleMapCanvas.height);
        if (mapData.backgroundImage) {
            ctx.drawImage(mapData.backgroundImage, 0, 0, battleMapCanvas.width, battleMapCanvas.height);
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0, 0, battleMapCanvas.width, battleMapCanvas.height);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= battleMapCanvas.width; x += mapData.gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, battleMapCanvas.height); ctx.stroke(); }
        for (let y = 0; y <= battleMapCanvas.height; y += mapData.gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(battleMapCanvas.width, y); ctx.stroke(); }

        if (hoveredCell) {
            ctx.fillStyle = 'rgba(0, 184, 212, 0.2)';
            ctx.fillRect(hoveredCell.x, hoveredCell.y, mapData.gridSize, mapData.gridSize);
        }
        
        const currentTime = performance.now();
        const currentTurnCombatant = currentCombatState && currentCombatState.isActive ? currentCombatState.combatants[currentCombatState.turn] : null;

        mapData.characters.forEach(char => {
            const lerpSpeed = 0.1;
            char.currentX = lerp(char.currentX, char.mapX, lerpSpeed);
            char.currentY = lerp(char.currentY, char.mapY, lerpSpeed);

            const isSelf = char._id === activeCharacterId;
            const isSelectedForMove = char._id === selectedCharacterForMove;
            let radius = mapData.gridSize / 2.5;

            if (char.spawnTime && currentTime - char.spawnTime < 1000) {
                const pulse = Math.sin((currentTime - char.spawnTime) / 1000 * Math.PI * 2) * 2;
                radius += pulse;
            } else {
                char.spawnTime = null;
            }

            ctx.beginPath();
            ctx.arc(char.currentX, char.currentY, radius, 0, Math.PI * 2);
            ctx.fillStyle = isSelf ? 'rgba(0, 184, 212, 0.8)' : 'rgba(229, 57, 53, 0.8)';
            ctx.fill();

            if (isSelectedForMove) {
                const selectionPulse = Math.sin(currentTime / 150) * 2;
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 3 + selectionPulse;
                ctx.stroke();
            }

            if (currentTurnCombatant && currentTurnCombatant.targetId === char._id) {
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
                ctx.lineWidth = 4;
                ctx.stroke();
            }
        });

        if (currentTurnCombatant && currentTurnCombatant.targetId) {
            const attackerCombatant = currentCombatState.combatants[currentCombatState.turn];
            const attacker = mapData.characters.find(c => c._id === attackerCombatant.characterId);
            const target = findCharacterByCombatantId(currentTurnCombatant.targetId);

            if (attacker && target) {
                drawArrow(attacker.currentX, attacker.currentY, target.currentX, target.currentY, 'rgba(255, 0, 0, 0.7)');
            }
        }

        if (selectedCharacterForMove && hoveredCell) {
            const char = mapData.characters.find(c => c._id === selectedCharacterForMove);
            if (char) {
                const targetX_draw = hoveredCell.x + mapData.gridSize / 2;
                const targetY_draw = hoveredCell.y + mapData.gridSize / 2;

                ctx.beginPath();
                ctx.setLineDash([5, 10]);
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
                ctx.lineWidth = 2;
                ctx.moveTo(char.currentX, char.currentY);
                ctx.lineTo(targetX_draw, targetY_draw);
                ctx.stroke();
                ctx.setLineDash([]);

                const distancePx = Math.sqrt(Math.pow(targetX_draw - char.currentX, 2) + Math.pow(targetY_draw - char.currentY, 2));
                const distanceFeet = (distancePx / mapData.gridSize) * 5;
                ctx.fillStyle = 'yellow';
                ctx.font = 'bold 16px Montserrat';
                ctx.textAlign = 'center';
                const textX = char.currentX + (targetX_draw - char.currentX) / 2;
                const textY = char.currentY + (targetY_draw - char.currentY) / 2 - 10;
                ctx.fillText(`${distanceFeet.toFixed(0)} ft`, textX, textY);
            }
        }
    }
    
    function lerp(start, end, amt) {
        if (start === undefined) return end;
        if (end === undefined) return start;
        return (1 - amt) * start + amt * end;
    }

    function drawArrow(fromx, fromy, tox, toy, color) {
        const headlen = 10;
        const dx = tox - fromx;
        const dy = toy - fromy;
        const angle = Math.atan2(dy, dx);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fromx, fromy);
        ctx.lineTo(tox, toy);
        ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(tox, toy);
        ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }

    function findCharacterByCombatantId(combatantId) {
        if (!currentCombatState) return null;
        const combatant = currentCombatState.combatants.find(c => c._id.toString() === combatantId);
        if (!combatant || !combatant.isPlayer) return null;
        return mapData.characters.find(char => char._id === combatant.characterId);
    }
    
    function loadMapBackground(url) {
        if (!url) { mapData.backgroundImage = null; return; }
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => { mapData.backgroundImage = img; };
        img.onerror = () => alert('Не удалось загрузить фон.');
        img.src = url;
    }

    async function loadMapData() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/map`);
            if (!response.ok) throw new Error('Failed to load map');
            const data = await response.json();
            mapData.gridSize = data.gridSize || 50;
            gridSizeInput.value = mapData.gridSize;
            if (data.backgroundUrl) {
                mapBackgroundInput.value = data.backgroundUrl;
                loadMapBackground(data.backgroundUrl);
            }
        } catch (error) { console.error(error); }
    }

    async function saveMapData() {
        try {
            await fetch(`${BACKEND_URL}/api/map`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gridSize: mapData.gridSize, backgroundUrl: mapBackgroundInput.value.trim() })
            });
        } catch (error) { console.error('Failed to save map data:', error); }
    }

    // --- Логика боя ---
    function renderCombatTracker() {
        const gmOnlyControls = [startCombatBtn, endCombatBtn, nextTurnBtn, addNpcForm];

        if (!currentCombatState || !currentCombatState.isActive) {
            initiativeTracker.innerHTML = '';
            const existingRollBtn = document.getElementById('rollAllInitiativeBtn');
            if(existingRollBtn) existingRollBtn.remove();
            
            if (isGm) {
                startCombatBtn.classList.remove('hidden');
                endCombatBtn.classList.add('hidden');
                nextTurnBtn.classList.add('hidden');
                addNpcForm.classList.add('hidden');
            } else {
                gmOnlyControls.forEach(el => el.classList.add('hidden'));
            }
            return;
        }

        startCombatBtn.classList.add('hidden');
        if (isGm) {
            endCombatBtn.classList.remove('hidden');
            nextTurnBtn.classList.remove('hidden');
            addNpcForm.classList.remove('hidden');

            if (!document.getElementById('rollAllInitiativeBtn')) {
                const rollAllBtn = document.createElement('button');
                rollAllBtn.id = 'rollAllInitiativeBtn';
                rollAllBtn.textContent = 'Init Всем';
                rollAllBtn.addEventListener('click', async () => {
                    try {
                        const response = await fetch(`${BACKEND_URL}/api/combat/roll-initiative`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${userData.token}` }
                        });
                        if (!response.ok) {
                           console.error('Failed to roll initiative for all');
                        }
                    } catch (error) {
                        console.error('Error rolling initiative:', error);
                    }
                });
                combatControls.insertBefore(rollAllBtn, nextTurnBtn);
            }
        }

        initiativeTracker.innerHTML = '';
        currentCombatState.combatants.forEach((c, index) => {
            const li = document.createElement('li');
            if (index === currentCombatState.turn) {
                li.classList.add('current-turn');
            }

            const nameSpan = document.createElement('span');
            nameSpan.className = 'combatant-name';
            nameSpan.textContent = c.name;
            li.appendChild(nameSpan);

            const initiativeContainer = document.createElement('div');
            initiativeContainer.className = 'initiative-container';
            if (c.initiative === null) {
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'initiative-input';
                input.placeholder = '...';
                input.dataset.id = c._id;
                input.disabled = !isGm && c.characterId !== activeCharacterId;
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const initiative = parseInt(e.target.value, 10);
                        if (!isNaN(initiative)) {
                            socket.emit('combat:set_initiative', { combatantId: c._id, initiative });
                        }
                    }
                });
                initiativeContainer.appendChild(input);
            } else {
                const valueSpan = document.createElement('span');
                valueSpan.className = 'initiative-value';
                valueSpan.textContent = c.initiative;
                initiativeContainer.appendChild(valueSpan);
            }
            li.appendChild(initiativeContainer);

            const removeBtnContainer = document.createElement('div');
            if (!c.isPlayer && isGm) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-combatant-btn';
                removeBtn.innerHTML = '&times;';
                removeBtn.dataset.id = c._id;
                removeBtn.addEventListener('click', () => {
                    socket.emit('combat:remove_combatant', c._id);
                });
                removeBtnContainer.appendChild(removeBtn);
            }
            li.appendChild(removeBtnContainer);
            initiativeTracker.appendChild(li);
        });
    }


    // --- Обработчики событий ---
    function setupMainEventListeners() {
        window.addEventListener('resize', resizeCanvas);

        loadCharacterBtn.addEventListener('click', () => loadCharacter(characterSelector.value));
        newCharacterBtn.addEventListener('click', createNewCharacter);
        deleteCharacterBtn.addEventListener('click', deleteCharacter);

        eventLogInput.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') {
                sendLogMessage(eventLogInput.value);
                eventLogInput.value = '';
            }
        });
        eventLogSendBtn.addEventListener('click', () => {
            sendLogMessage(eventLogInput.value);
            eventLogInput.value = '';
        });

        loadMapBackgroundBtn.addEventListener('click', () => {
            const url = mapBackgroundInput.value.trim();
            loadMapBackground(url);
            saveMapData();
        });
        gridSizeInput.addEventListener('change', () => {
            mapData.gridSize = parseInt(gridSizeInput.value) || 50;
            saveMapData();
        });

        startCombatBtn.addEventListener('click', () => socket.emit('combat:start'));
        endCombatBtn.addEventListener('click', () => socket.emit('combat:end'));
        nextTurnBtn.addEventListener('click', () => socket.emit('combat:next_turn'));
        addNpcBtn.addEventListener('click', () => {
            const name = npcNameInput.value.trim();
            const initiative = parseInt(npcInitiativeInput.value, 10);
            if (name) {
                socket.emit('combat:add_npc', { name, initiative: isNaN(initiative) ? null : initiative });
                npcNameInput.value = '';
                npcInitiativeInput.value = '';
            }
        });

        battleMapCanvas.addEventListener('mousemove', (e) => {
            const rect = battleMapCanvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const cellX = Math.floor(mouseX / mapData.gridSize) * mapData.gridSize;
            const cellY = Math.floor(mouseY / mapData.gridSize) * mapData.gridSize;
            if (!hoveredCell || hoveredCell.x !== cellX || hoveredCell.y !== cellY) {
                hoveredCell = { x: cellX, y: cellY };
            }
        });
        battleMapCanvas.addEventListener('mouseleave', () => {
            hoveredCell = null;
        });

        battleMapCanvas.addEventListener('click', (e) => {
            const rect = battleMapCanvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
        
            const clickedCharToken = findClickedCharacter(clickX, clickY);
        
            if (currentCombatState && currentCombatState.isActive) {
                const currentTurnCombatant = currentCombatState.combatants[currentCombatState.turn];
                if (!currentTurnCombatant) return;
        
                const isMyTurn = currentTurnCombatant.characterId === activeCharacterId;
        
                if (clickedCharToken && (isGm || isMyTurn)) {
                    const clickedCombatant = findCombatantByCharacterId(clickedCharToken._id);
                    if (clickedCombatant && currentTurnCombatant._id.toString() !== clickedCombatant._id.toString()) {
                        socket.emit('combat:set_target', { 
                            targetId: clickedCombatant._id.toString() 
                        });
                        selectedCharacterForMove = null;
                        return;
                    }
                }
            }
        
            if (clickedCharToken && clickedCharToken._id === activeCharacterId) {
                selectedCharacterForMove = selectedCharacterForMove === clickedCharToken._id ? null : clickedCharToken._id;
            } else if (selectedCharacterForMove && hoveredCell) {
                const charToMove = mapData.characters.find(c => c._id === selectedCharacterForMove);
                if (charToMove) {
                    const targetX = hoveredCell.x + mapData.gridSize / 2;
                    const targetY = hoveredCell.y + mapData.gridSize / 2;
                    socket.emit('character:move', { _id: charToMove._id, name: charToMove.name, mapX: targetX, mapY: targetY });
                }
                selectedCharacterForMove = null;
            }
        });
        
        function findClickedCharacter(x, y) {
            return mapData.characters.find(char => {
                const distance = Math.sqrt(Math.pow(x - char.currentX, 2) + Math.pow(y - char.currentY, 2));
                return distance <= mapData.gridSize / 2.5;
            });
        }
        
        function findCombatantByCharacterId(charId) {
            if (!currentCombatState || !currentCombatState.isActive) return null;
            return currentCombatState.combatants.find(c => c.characterId === charId);
        }

        openSheetBtn.addEventListener('click', () => {
            if (!activeCharacterId) {
                alert('Сначала загрузите персонажа!');
                return;
            }
            sheetContainer.innerHTML = getCharacterSheetHTML();
            sheetModal.classList.remove('hidden');
        });

        closeSheetBtn.addEventListener('click', () => {
            sheetModal.classList.add('hidden');
        });
        sheetModal.addEventListener('click', (e) => {
            if (e.target === sheetModal) {
                sheetModal.classList.add('hidden');
            }
        });
    }
    
    // --- Динамическое создание панели кубиков ---
    function createDiceRoller() {
        const rightSidebar = document.querySelector('.right-sidebar');
        if (!document.getElementById('dice-roller-panel')) {
            const dicePanel = document.createElement('div');
            dicePanel.id = 'dice-roller-panel';
            dicePanel.className = 'sidebar-panel';
            
            dicePanel.innerHTML = `
                <h3>Бросок кубиков</h3>
                <div id="dice-result-display">-</div>
                <div id="dice-buttons">
                    <button data-dice="d4">d4</button>
                    <button data-dice="d6">d6</button>
                    <button data-dice="d8">d8</button>
                    <button data-dice="d10">d10</button>
                    <button data-dice="d12">d12</button>
                    <button data-dice="d20">d20</button>
                    <button data-dice="d100">d100</button>
                </div>
                <div id="dice-actions">
                    <button id="roll-dice-btn">Бросить</button>
                    <input type="number" id="manual-roll-input" placeholder="Вручную">
                </div>
            `;
            rightSidebar.appendChild(dicePanel);
            
            const diceButtons = dicePanel.querySelector('#dice-buttons');
            const rollBtn = dicePanel.querySelector('#roll-dice-btn');
            const manualInput = dicePanel.querySelector('#manual-roll-input');
            const resultDisplay = dicePanel.querySelector('#dice-result-display');
            let selectedDice = null;

            diceButtons.addEventListener('click', (e) => {
                if(e.target.tagName === 'BUTTON') {
                    const currentActive = diceButtons.querySelector('.active');
                    if(currentActive) currentActive.classList.remove('active');
                    e.target.classList.add('active');
                    selectedDice = e.target.dataset.dice;
                }
            });

            rollBtn.addEventListener('click', () => {
                if (selectedDice) {
                    const rollCommand = `/roll 1${selectedDice}`;
                    sendLogMessage(rollCommand);
                } else {
                    alert('Сначала выберите кубик!');
                }
            });
            
            manualInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const value = manualInput.value;
                    if(value) {
                       sendLogMessage(`вручную вводит результат: ${value}`);
                       manualInput.value = '';
                    }
                }
            });
        }
    }

    // --- Запуск ---
    setupAuthEventListeners();
    checkAuthState();
});