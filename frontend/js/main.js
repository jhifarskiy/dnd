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
    
    // НОВЫЕ DOM ЭЛЕМЕНТЫ
    const attacksForCombat = document.getElementById('attacks-for-combat');
    const spellsForCombat = document.getElementById('spells-for-combat');
    const equipmentForCombat = document.getElementById('equipment-for-combat');

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
    let sheetUpdateTimeout = null;
    let selectedCombatAction = null; // Новое поле для хранения выбранной атаки/заклинания

    // --- СПИСКИ ДАННЫХ ДЛЯ ГЕНЕРАЦИИ ЛИСТА ---
    const ABILITIES = {
        strength: 'СИЛА',
        dexterity: 'ЛОВКОСТЬ',
        constitution: 'ТЕЛОСЛОЖЕНИЕ',
        intelligence: 'ИНТЕЛЛЕКТ',
        wisdom: 'МУДРОСТЬ',
        charisma: 'ХАРИЗМА'
    };

    const SKILLS = {
        acrobatics: { label: 'Акробатика', ability: 'dexterity' },
        animalHandling: { label: 'Уход за животными', ability: 'wisdom' },
        arcana: { label: 'Магия', ability: 'intelligence' },
        athletics: { label: 'Атлетика', ability: 'strength' },
        deception: { label: 'Обман', ability: 'charisma' },
        history: { label: 'История', ability: 'intelligence' },
        insight: { label: 'Проницательность', ability: 'wisdom' },
        intimidation: { label: 'Запугивание', ability: 'charisma' },
        investigation: { label: 'Анализ', ability: 'intelligence' },
        medicine: { label: 'Медицина', ability: 'wisdom' },
        nature: { label: 'Природа', ability: 'intelligence' },
        perception: { label: 'Внимательность', ability: 'wisdom' },
        performance: { label: 'Выступление', ability: 'charisma' },
        persuasion: { label: 'Убеждение', ability: 'charisma' },
        religion: { label: 'Религия', ability: 'intelligence' },
        sleightOfHand: { label: 'Ловкость рук', ability: 'dexterity' },
        stealth: { label: 'Скрытность', ability: 'dexterity' },
        survival: { label: 'Выживание', ability: 'wisdom' }
    };

    // --- ГЕНЕРАЦИЯ HTML ЛИСТА ПЕРСОНАЖА ---
    function getCharacterSheetHTML(readonly = false) {
        const abilitiesHTML = Object.entries(ABILITIES).map(([key, label]) => `
            <div class="ability-score">
                <span class="label">${label}</span>
                <input type="text" data-field="${key}Modifier" class="modifier-input" readonly>
                <input type="number" data-field="${key}" class="score-input char-sheet-input" ${readonly ? 'readonly' : ''}>
            </div>
        `).join('');

        const savingThrowsHTML = Object.entries(ABILITIES).map(([key, label]) => `
             <li class="skill-item">
                <input type="checkbox" data-field="${key}SaveProficient" class="char-sheet-input proficient-checkbox" ${readonly ? 'disabled' : ''}>
                <span class="skill-bonus" data-field="${key}Save" readonly>+0</span>
                <span class="skill-label">${label}</span>
            </li>
        `).join('');

        const skillsHTML = Object.entries(SKILLS).map(([key, {label, ability}]) => `
            <li class="skill-item">
                <input type="checkbox" data-field="${key}Proficient" class="char-sheet-input proficient-checkbox" ${readonly ? 'disabled' : ''}>
                <span class="skill-bonus" data-field="${key}" readonly>+0</span>
                <span class="skill-label">${label} <span class="skill-ability">(${ABILITIES[ability].slice(0,3)})</span></span>
            </li>
        `).join('');

        return `
        <div class="character-sheet">
            <header class="sheet-header">
                <div class="header-section char-name-section">
                    <input type="text" data-field="name" class="char-sheet-input" id="characterName" placeholder="Имя персонажа" ${readonly ? 'readonly' : ''}>
                </div>
                 <div class="header-info-grid">
                    <div class="header-section"><span class="label">КЛАСС И УРОВЕНЬ</span><input type="text" data-field="classLevel" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                    <div class="header-section"><span class="label">ПРЕДЫСТОРИЯ</span><input type="text" data-field="background" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                    <div class="header-section"><span class="label">ИМЯ ИГРОКА</span><input type="text" data-field="playerName" class="char-sheet-input" readonly></div>
                    <div class="header-section"><span class="label">РАСА</span><input type="text" data-field="race" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                    <div class="header-section"><span class="label">МИРОВОЗЗРЕНИЕ</span><input type="text" data-field="alignment" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                    <div class="header-section"><span class="label">ОПЫТ</span><input type="number" data-field="experience" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                </div>
            </header>

            <main class="sheet-main">
                <div class="main-column-left">
                    <div class="abilities-section">${abilitiesHTML}</div>
                    <div class="sub-column">
                        <div class="proficiency-bonus-section">
                            <input type="number" data-field="proficiencyBonus" class="char-sheet-input" ${readonly ? 'readonly' : ''}>
                            <span class="label">БОНУС МАСТЕРСТВА</span>
                        </div>
                        <div class="saving-throws-section">
                            <h3>СПАСБРОСКИ</h3>
                            <ul>${savingThrowsHTML}</ul>
                        </div>
                    </div>
                    <div class="skills-section">
                        <h3>НАВЫКИ</h3>
                        <ul>${skillsHTML}</ul>
                    </div>
                </div>
                <div class="main-column-center">
                    <div class="combat-stats-section">
                         <div class="combat-stat"><span class="label">КЛАСС БРОНИ</span><input type="number" data-field="ac" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                         <div class="combat-stat"><span class="label">ИНИЦИАТИВА</span><input type="text" data-field="initiative" class="char-sheet-input" readonly></div>
                         <div class="combat-stat"><span class="label">СКОРОСТЬ</span><input type="text" data-field="speed" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                    </div>
                     <div class="hp-section">
                        <div class="hp-max"><span class="label">Максимум хитов</span><input type="number" data-field="maxHp" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                        <div class="hp-current"><span class="label">ТЕКУЩИЕ ХИТЫ</span><input type="number" data-field="currentHp" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                        <div class="hp-temp"><span class="label">Временные хиты</span><input type="number" data-field="tempHp" class="char-sheet-input" ${readonly ? 'readonly' : ''}></div>
                    </div>
                    <div class="attacks-section">
                        <h3>АТАКИ, ЗАКЛИНАНИЯ И ЗАГОВОРЫ</h3>
                        <div id="attacks-list"></div>
                        <button class="add-attack-btn" data-type="attack" ${readonly ? 'disabled' : ''}>Добавить атаку</button>
                        <div id="spells-list"></div>
                        <button class="add-spell-btn" data-type="spell" ${readonly ? 'disabled' : ''}>Добавить заклинание</button>
                    </div>
                </div>
                <div class="main-column-right">
                    <div class="features-section">
                        <h3>УМЕНИЯ И ОСОБЕННОСТИ</h3>
                        <textarea data-field="features" class="char-sheet-input" ${readonly ? 'readonly' : ''}></textarea>
                    </div>
                    <div class="equipment-section">
                         <h3>СНАРЯЖЕНИЕ</h3>
                        <textarea data-field="equipment" class="char-sheet-input" ${readonly ? 'readonly' : ''}></textarea>
                    </div>
                </div>
            </main>
        </div>
        `;
    }

    // --- ЛОГИКА АУТЕНТИФИКАЦИИ ---
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
                    serverChar.currentX = serverChar.mapX || 100;
                    serverChar.currentY = serverChar.mapY || 100;
                } else {
                    serverChar.spawnTime = localChar.spawnTime;
                    serverChar.currentX = localChar.currentX;
                    serverChar.currentY = localChar.currentY;
                }
            });
            mapData.characters = allCharacters;
            console.log('Map updated with characters:', mapData.characters);
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
        socket.on('character:view', (charData) => {
            sheetContainer.innerHTML = getCharacterSheetHTML(true);
            populateSheet(charData);
            sheetModal.classList.remove('hidden');
        });
    }

    // --- ЛОГИКА ПРИЛОЖЕНИЯ ---
    function initializeApp() {
        loadCharacterBtn.textContent = 'Выбрать';
        if (isGm) {
            characterManagerPanel.classList.add('hidden');
        } else {
            characterManagerPanel.classList.remove('hidden');
            createViewOthersButton();
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
            // Устанавливаем начальные координаты, если они отсутствуют
            if (!currentCharacterData.mapX || !currentCharacterData.mapY) {
                currentCharacterData.mapX = 100;
                currentCharacterData.mapY = 100;
                await fetch(`${BACKEND_URL}/api/characters/${id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userData.token}`
                    },
                    body: JSON.stringify({ mapX: 100, mapY: 100 })
                });
            }
            socket.emit('character:join', currentCharacterData);
            console.log('Character loaded:', currentCharacterData);
            // НОВЫЕ ВЫЗОВЫ ФУНКЦИЙ
            renderCombatActionsAndEquipment();
            renderEquipment();
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

    async function viewOtherCharacters() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/characters/all`, { headers: { 'Authorization': `Bearer ${userData.token}` } });
            if (!response.ok) throw new Error('Failed to fetch all characters');
            const characters = await response.json();
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="sheet-modal-content">
                    <button class="close-btn" id="close-others-modal">&times;</button>
                    <h2>Персонажи</h2>
                    <select id="otherCharacterSelector">
                        <option disabled selected>-- Выберите персонажа --</option>
                        ${characters.map(char => `<option value="${char._id}">${char.name}</option>`).join('')}
                    </select>
                    <button id="viewOtherCharacterBtn">Просмотреть</button>
                </div>
            `;
            document.body.appendChild(modal);
            const closeBtn = modal.querySelector('#close-others-modal');
            const viewBtn = modal.querySelector('#viewOtherCharacterBtn');
            const selector = modal.querySelector('#otherCharacterSelector');

            closeBtn.addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
            viewBtn.addEventListener('click', async () => {
                const charId = selector.value;
                if (charId) {
                    try {
                        const response = await fetch(`${BACKEND_URL}/api/characters/public/${charId}`, { headers: { 'Authorization': `Bearer ${userData.token}` } });
                        if (!response.ok) throw new Error('Character not found');
                        const charData = await response.json();
                        socket.emit('character:view', charData);
                        modal.remove();
                    } catch (error) { console.error("Failed to view character:", error); }
                }
            });
        } catch (error) { console.error("Failed to load other characters:", error); }
    }

    function createViewOthersButton() {
        const charButtons = characterManagerPanel.querySelector('.char-buttons');
        const viewOthersBtn = document.createElement('button');
        viewOthersBtn.id = 'viewOthersBtn';
        viewOthersBtn.textContent = 'Просмотреть других';
        viewOthersBtn.addEventListener('click', viewOtherCharacters);
        charButtons.appendChild(viewOthersBtn);
    }

    function sendLogMessage(text) {
        if (text && text.trim() !== '') {
            const messageData = { charName: isGm ? 'Мастер' : (currentCharacterData.name || 'Игрок') };
            const rollMatch = text.match(/^\/(r|roll)\s+(.*)/);
            if (rollMatch) {
                const notation = rollMatch[2];
                messageData.text = `бросает ${notation}`;
                socket.emit('log:send', messageData);
            } else {
                messageData.text = text;
                socket.emit('log:send', messageData);
            }
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
            char.currentX = lerp(char.currentX, char.mapX || 100, lerpSpeed);
            char.currentY = lerp(char.currentY, char.mapY || 100, lerpSpeed);

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

            if (currentTurnCombatant && findCombatantByCharacterId(char._id) && currentTurnCombatant.targetId === findCombatantByCharacterId(char._id)._id.toString()) {
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
        if (!combatant) return null;
        return combatant.isPlayer ? mapData.characters.find(char => char._id === combatant.characterId) : combatant;
    }
    
    function findCombatantByCharacterId(charId) {
        if (!currentCombatState || !currentCombatState.isActive) return null;
        return currentCombatState.combatants.find(c => c.characterId === charId);
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
                           const err = await response.json();
                           console.error('Failed to roll initiative for all:', err.message);
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
    
    // НОВЫЕ ФУНКЦИИ ДЛЯ БОЕВЫХ ДЕЙСТВИЙ
    function renderCombatActionsAndEquipment() {
        if (!currentCharacterData || !currentCharacterData.attacks || !currentCharacterData.spells) {
            attacksForCombat.innerHTML = '<p>Загрузите персонажа</p>';
            spellsForCombat.innerHTML = '';
            return;
        }

        // Атаки
        attacksForCombat.innerHTML = `<h4>Атаки</h4>`;
        currentCharacterData.attacks.forEach(attack => {
            const btn = document.createElement('button');
            btn.className = 'combat-action-btn';
            btn.dataset.type = 'attack';
            btn.dataset.name = attack.name;
            btn.dataset.bonus = attack.bonus;
            btn.dataset.damage = attack.damage;
            btn.dataset.damageType = attack.damageType;
            btn.textContent = `${attack.name} (${attack.bonus}, ${attack.damage})`;
            attacksForCombat.appendChild(btn);
        });
        
        // Заклинания
        spellsForCombat.innerHTML = `<h4>Заклинания</h4>`;
        currentCharacterData.spells.forEach(spell => {
            const btn = document.createElement('button');
            btn.className = 'combat-action-btn';
            btn.dataset.type = 'spell';
            btn.dataset.name = spell.name;
            btn.dataset.bonus = spell.attackBonus;
            btn.dataset.damage = spell.damage;
            btn.dataset.damageType = spell.damageType;
            btn.dataset.description = spell.description;
            btn.textContent = `${spell.name} (${spell.level})`;
            spellsForCombat.appendChild(btn);
        });
    }
    
    function renderEquipment() {
        if (!currentCharacterData || !currentCharacterData.equipment) {
            equipmentForCombat.innerHTML = '<p>Загрузите персонажа</p>';
            return;
        }
        equipmentForCombat.innerHTML = `<textarea readonly>${currentCharacterData.equipment}</textarea>`;
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
            console.log(`Map clicked at: x=${clickX}, y=${clickY}`);

            const clickedCharToken = findClickedCharacter(clickX, clickY);
            console.log('Clicked character:', clickedCharToken);
            
            const currentTurnCombatant = currentCombatState && currentCombatState.isActive ? currentCombatState.combatants[currentCombatState.turn] : null;
            const isMyTurn = currentTurnCombatant && currentTurnCombatant.characterId === activeCharacterId;

            // Если выбрано действие, пытаемся применить его
            if (selectedCombatAction && clickedCharToken && (isGm || isMyTurn)) {
                handleCombatAction(selectedCombatAction, clickedCharToken);
                selectedCombatAction = null;
                document.querySelectorAll('.combat-action-btn.active').forEach(b => b.classList.remove('active'));
                return;
            }

            // Выбор токена для перемещения
            if (clickedCharToken && (isGm || clickedCharToken._id === activeCharacterId)) {
                selectedCharacterForMove = selectedCharacterForMove === clickedCharToken._id ? null : clickedCharToken._id;
                console.log('Selected for move:', selectedCharacterForMove);
            } else if (selectedCharacterForMove && hoveredCell) {
                const charToMove = mapData.characters.find(c => c._id === selectedCharacterForMove);
                if (charToMove && (isGm || charToMove._id === activeCharacterId)) {
                    const targetX = hoveredCell.x + mapData.gridSize / 2;
                    const targetY = hoveredCell.y + mapData.gridSize / 2;
                    if (targetX >= 0 && targetY >= 0 && targetX <= battleMapCanvas.width && targetY <= battleMapCanvas.height) {
                        socket.emit('character:move', { _id: charToMove._id, name: charToMove.name, mapX: targetX, mapY: targetY });
                        console.log('Moving character:', charToMove._id, 'to', { targetX, targetY });
                    } else {
                        console.log('Invalid move coordinates:', { targetX, targetY });
                    }
                    selectedCharacterForMove = null;
                } else {
                    console.log('No permission to move:', charToMove);
                }
            }

            // Выбор цели в бою
            if (currentCombatState && currentCombatState.isActive) {
                if (currentTurnCombatant) {
                    if (clickedCharToken && (isGm || isMyTurn)) {
                        const clickedCombatant = findCombatantByCharacterId(clickedCharToken._id);
                        if (clickedCombatant && currentTurnCombatant._id.toString() !== clickedCombatant._id.toString()) {
                            socket.emit('combat:set_target', { 
                                targetId: clickedCombatant._id.toString() 
                            });
                            console.log('Target set:', clickedCombatant);
                            selectedCharacterForMove = null;
                        }
                    }
                }
            }
        });
        
        function findClickedCharacter(x, y) {
            return mapData.characters.find(char => {
                if (!char.currentX || !char.currentY) {
                    console.warn(`Character ${char._id} has no coordinates:`, char);
                    return false;
                }
                const distance = Math.sqrt(Math.pow(x - char.currentX, 2) + Math.pow(y - char.currentY, 2));
                return distance <= mapData.gridSize; // Увеличен радиус для точного клика
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
            populateSheet(currentCharacterData);
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
        
        // ОБНОВЛЕННЫЕ ОБРАБОТЧИКИ ДЛЯ ЛИСТА ПЕРСОНАЖА
        sheetContainer.addEventListener('click', (e) => {
            if (isGm) return; // GM не может редактировать лист персонажа
            if (e.target.classList.contains('add-attack-btn')) {
                addAttack(e.target.closest('.attacks-section'));
            } else if (e.target.classList.contains('add-spell-btn')) {
                addSpell(e.target.closest('.attacks-section'));
            } else if (e.target.classList.contains('remove-attack-btn')) {
                const index = e.target.closest('.attack-item').dataset.index;
                removeAttack(index);
            } else if (e.target.classList.contains('remove-spell-btn')) {
                const index = e.target.closest('.spell-item').dataset.index;
                removeSpell(index);
            }
        });
        
        // НОВЫЙ ОБРАБОТЧИК ДЛЯ БОЕВЫХ ДЕЙСТВИЙ
        document.getElementById('attack-spells-panel').addEventListener('click', (e) => {
            const btn = e.target.closest('.combat-action-btn');
            if (btn) {
                const currentTurnCombatant = currentCombatState && currentCombatState.isActive ? currentCombatState.combatants[currentCombatState.turn] : null;
                const isMyTurn = currentTurnCombatant && currentTurnCombatant.characterId === activeCharacterId;
                
                if (!isMyTurn && !isGm) {
                    alert('Сейчас не ваш ход!');
                    return;
                }
                
                selectedCombatAction = {
                    name: btn.dataset.name,
                    type: btn.dataset.type,
                    bonus: btn.dataset.bonus,
                    damage: btn.dataset.damage,
                    damageType: btn.dataset.damageType,
                    description: btn.dataset.description,
                };
                
                document.querySelectorAll('.combat-action-btn.active').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    }

    function handleCombatAction(action, targetChar) {
        if (!action || !targetChar) return;
        
        const targetCombatant = findCombatantByCharacterId(targetChar._id);
        const targetName = targetCombatant ? targetCombatant.name : targetChar.name;

        // Бросок на попадание
        const attackRollCommand = `/roll 1d20${action.bonus} vs AC ${targetName}`;
        sendLogMessage(`использует ${action.name} против ${targetName}. Бросок на попадание: ${attackRollCommand}`);
        
        // Бросок на урон
        const damageRollCommand = `/roll ${action.damage}`;
        sendLogMessage(`урон от ${action.name}: ${damageRollCommand} ${action.damageType}`);
    }
    
    // --- ЛОГИКА ЛИСТА ПЕРСОНАЖА ---
    function populateSheet(charData) {
        const sheet = sheetContainer.querySelector('.character-sheet');
        if (!sheet) return;

        const inputs = sheet.querySelectorAll('.char-sheet-input');
        inputs.forEach(input => {
            const field = input.dataset.field;
            if (field in charData) {
                if (input.type === 'checkbox') {
                    input.checked = charData[field];
                } else {
                    input.value = charData[field] || '';
                }
            }
        });
        
        const playerNameInput = sheet.querySelector('[data-field="playerName"]');
        if (playerNameInput) playerNameInput.value = charData.playerName || userData.username;

        updateCalculatedFields(sheet, charData);
        populateAttacksAndSpells(sheet, charData);
    }

    function populateAttacksAndSpells(sheet, charData) {
        const attacksList = sheet.querySelector('#attacks-list');
        const spellsList = sheet.querySelector('#spells-list');

        attacksList.innerHTML = '';
        spellsList.innerHTML = '';

        if (charData.attacks && charData.attacks.length > 0) {
            charData.attacks.forEach((attack, index) => {
                const attackItem = document.createElement('div');
                attackItem.className = 'attack-item';
                attackItem.dataset.index = index;
                attackItem.innerHTML = `
                    <input type="text" placeholder="Название" data-field="name" value="${attack.name}" class="char-sheet-input attack-input" ${isGm ? 'readonly' : ''}>
                    <input type="text" placeholder="Бонус атаки" data-field="bonus" value="${attack.bonus}" class="char-sheet-input attack-input" ${isGm ? 'readonly' : ''}>
                    <input type="text" placeholder="Урон" data-field="damage" value="${attack.damage}" class="char-sheet-input attack-input" ${isGm ? 'readonly' : ''}>
                    <input type="text" placeholder="Тип урона" data-field="damageType" value="${attack.damageType}" class="char-sheet-input attack-input" ${isGm ? 'readonly' : ''}>
                    ${!isGm ? '<button class="remove-attack-btn">&times;</button>' : ''}
                `;
                attacksList.appendChild(attackItem);
            });
        }
        
        if (charData.spells && charData.spells.length > 0) {
            charData.spells.forEach((spell, index) => {
                const spellItem = document.createElement('div');
                spellItem.className = 'spell-item';
                spellItem.dataset.index = index;
                spellItem.innerHTML = `
                    <div class="spell-header">
                        <input type="text" placeholder="Название" data-field="name" value="${spell.name}" class="char-sheet-input spell-input spell-title" ${isGm ? 'readonly' : ''}>
                        <input type="text" placeholder="Уровень" data-field="level" value="${spell.level}" class="char-sheet-input spell-input" ${isGm ? 'readonly' : ''}>
                        ${!isGm ? '<button class="remove-spell-btn">&times;</button>' : ''}
                    </div>
                    <div class="spell-details">
                        <input type="text" placeholder="Бонус атаки" data-field="attackBonus" value="${spell.attackBonus}" class="char-sheet-input spell-input" ${isGm ? 'readonly' : ''}>
                        <input type="text" placeholder="Урон" data-field="damage" value="${spell.damage}" class="char-sheet-input spell-input" ${isGm ? 'readonly' : ''}>
                        <input type="text" placeholder="Тип урона" data-field="damageType" value="${spell.damageType}" class="char-sheet-input spell-input" ${isGm ? 'readonly' : ''}>
                    </div>
                    <textarea placeholder="Описание" data-field="description" class="char-sheet-input spell-input" ${isGm ? 'readonly' : ''}>${spell.description}</textarea>
                `;
                spellsList.appendChild(spellItem);
            });
        }
    }

    function addAttack(parent) {
        if (!currentCharacterData.attacks) currentCharacterData.attacks = [];
        currentCharacterData.attacks.push({ name: '', bonus: '', damage: '', damageType: '' });
        populateAttacksAndSpells(parent.closest('.character-sheet'), currentCharacterData);
        saveSheetData();
    }

    function removeAttack(index) {
        if (!currentCharacterData.attacks) return;
        currentCharacterData.attacks.splice(index, 1);
        populateAttacksAndSpells(sheetContainer.querySelector('.character-sheet'), currentCharacterData);
        saveSheetData();
    }
    
    function addSpell(parent) {
        if (!currentCharacterData.spells) currentCharacterData.spells = [];
        currentCharacterData.spells.push({ name: '', level: 'Заговор', attackBonus: '', damage: '', damageType: '', description: '' });
        populateAttacksAndSpells(parent.closest('.character-sheet'), currentCharacterData);
        saveSheetData();
    }

    function removeSpell(index) {
        if (!currentCharacterData.spells) return;
        currentCharacterData.spells.splice(index, 1);
        populateAttacksAndSpells(sheetContainer.querySelector('.character-sheet'), currentCharacterData);
        saveSheetData();
    }
    
    function updateCalculatedFields(sheet, charData) {
        if (!sheet || !charData) return;
        
        const proficiencyBonus = parseInt(charData.proficiencyBonus) || 0;

        for (const key in ABILITIES) {
            const score = parseInt(charData[key]) || 10;
            const modifier = Math.floor((score - 10) / 2);
            const modString = modifier >= 0 ? `+${modifier}` : modifier;
            sheet.querySelector(`[data-field="${key}Modifier"]`).value = modString;
            
            const saveProficient = charData[`${key}SaveProficient`];
            const saveBonus = modifier + (saveProficient ? proficiencyBonus : 0);
            const saveBonusString = saveBonus >= 0 ? `+${saveBonus}` : saveBonus;
            sheet.querySelector(`[data-field="${key}Save"]`).textContent = saveBonusString;
        }
        
        const dexModifier = Math.floor(((parseInt(charData.dexterity) || 10) - 10) / 2);
        sheet.querySelector('[data-field="initiative"]').value = dexModifier >= 0 ? `+${dexModifier}` : dexModifier;

        for (const key in SKILLS) {
            const skill = SKILLS[key];
            const abilityScore = parseInt(charData[skill.ability]) || 10;
            const abilityModifier = Math.floor((abilityScore - 10) / 2);
            const isProficient = charData[`${key}Proficient`];
            const skillBonus = abilityModifier + (isProficient ? proficiencyBonus : 0);
            const skillBonusString = skillBonus >= 0 ? `+${skillBonus}` : skillBonus;
            sheet.querySelector(`[data-field="${key}"]`).textContent = skillBonusString;
        }
    }

    async function saveSheetData() {
        if (!activeCharacterId) return;
        if (isGm) return;

        const sheet = sheetContainer.querySelector('.character-sheet');
        if (!sheet) return;
        
        const dataToSave = { ...currentCharacterData };

        // Сохранение простых полей
        const inputs = sheet.querySelectorAll('.char-sheet-input:not(.attack-input):not(.spell-input)');
        inputs.forEach(input => {
            const field = input.dataset.field;
            if (input.type === 'checkbox') {
                dataToSave[field] = input.checked;
            } else if (input.type === 'number') {
                dataToSave[field] = parseInt(input.value) || 0;
            } else {
                dataToSave[field] = input.value;
            }
        });
        
        // Сохранение атак
        dataToSave.attacks = [];
        const attackItems = sheet.querySelectorAll('.attack-item');
        attackItems.forEach(item => {
            const attack = {};
            item.querySelectorAll('.attack-input').forEach(input => {
                attack[input.dataset.field] = input.value;
            });
            dataToSave.attacks.push(attack);
        });

        // Сохранение заклинаний
        dataToSave.spells = [];
        const spellItems = sheet.querySelectorAll('.spell-item');
        spellItems.forEach(item => {
            const spell = {};
            item.querySelectorAll('.spell-input').forEach(input => {
                spell[input.dataset.field] = input.value;
            });
            dataToSave.spells.push(spell);
        });
        
        currentCharacterData = dataToSave;
        updateCalculatedFields(sheet, currentCharacterData);
        populateAttacksAndSpells(sheet, currentCharacterData);

        try {
            await fetch(`${BACKEND_URL}/api/characters/${activeCharacterId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userData.token}`
                },
                body: JSON.stringify(dataToSave)
            });
            socket.emit('character:join', currentCharacterData);
        } catch (error) {
            console.error("Failed to save character sheet:", error);
        }
    }
    
    sheetContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('char-sheet-input')) {
            clearTimeout(sheetUpdateTimeout);
            sheetUpdateTimeout = setTimeout(saveSheetData, 1000);
        }
    });

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