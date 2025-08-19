document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = '';
    let socket = io(BACKEND_URL, {
        auth: {
            token: localStorage.getItem('token')
        }
    });

    // --- DOM Элементы ---
    const authContainer = document.getElementById('auth-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const authMessage = document.getElementById('authMessage');
    const mainAppContainer = document.getElementById('main-app');
    const logoutBtn = document.getElementById('logoutBtn');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const mainCanvas = document.getElementById('mainCanvas');
    const ctx = mainCanvas.getContext('2d');
    const mapToolbar = document.getElementById('map-toolbar');
    const characterManagerPanel = document.getElementById('character-manager');
    
    // --- ИЗМЕНЕНО: Элементы для кастомного селекта ---
    const characterSelectorWrapper = document.querySelector('.custom-select-wrapper');
    const characterSelectorTrigger = document.getElementById('characterSelectorTrigger');
    const characterSelectorOptions = document.getElementById('characterSelectorOptions');
    
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
    const npcMaxHpInput = document.getElementById('npcMaxHpInput');
    const npcACInput = document.getElementById('npcACInput');
    const actionBar = document.getElementById('action-bar');
    const worldMapGmControls = document.getElementById('world-map-gm-controls');
    const worldMapBackgroundUrlInput = document.getElementById('worldMapBackgroundUrl');
    const saveWorldMapBtn = document.getElementById('saveWorldMapBtn');
    // --- DOM Элементы для модального окна описания ---
    const itemInfoModal = document.getElementById('item-info-modal');
    const closeInfoModalBtn = document.querySelector('.close-info-modal-btn');
    const infoModalTitle = document.getElementById('info-modal-title');
    const infoModalDescription = document.getElementById('info-modal-description');


    // --- Состояние приложения ---
    let userData = { token: null, userId: null, username: null };
    let isGm = false;
    let activeCharacterId = null;
    let currentCharacterData = {};
    let currentCombatState = null;
    let selectedCharacterForMove = null;
    let mousePreviewPosition = null;
    let animatingTokens = new Set(); // Для отслеживания анимирующихся токенов
    let hoveredObject = null;
    let sheetUpdateTimeout = null;
    let selectedCombatAction = null;
    let activeActionTab = 'attacks';

    // --- Состояние для нового виджета атак/заклинаний ---
    let activeSpellLevel = 1;
    let activeFilter = 'attacks';
    let editingItemIndex = null; // null для добавления, index для редактирования

    // --- Состояние для глобальной карты ---
    let worldMapState = {
        image: null,
        imageUrl: '',
        characters: []
    };
    let viewTransform = {
        scale: 0.5,
        offsetX: 0,
        offsetY: 0
    };
    let isPanning = false;
    let lastMousePos = { x: 0, y: 0 };
    let mouseHasMoved = false;
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 3.0;

    // --- Константы для отрисовки ---
    const TOKEN_RADIUS = 20;

    // --- СПИСКИ ДАННЫХ ДЛЯ ГЕНЕРАЦИИ ЛИСТА ---
    const ABILITIES = { strength: 'СИЛА', dexterity: 'ЛОВКОСТЬ', constitution: 'ТЕЛОСЛОЖЕНИЕ', intell: 'ИНТЕЛЛЕКТ', wisdom: 'МУДРОСТЬ', charisma: 'ХАРИЗМА' };
    const SKILLS = { acrobatics: { label: 'Акробатика', ability: 'dexterity' }, animalHandling: { label: 'Уход за животными', ability: 'wisdom' }, arcana: { label: 'Магия', ability: 'intell' }, athletics: { label: 'Атлетика', ability: 'strength' }, deception: { label: 'Обман', ability: 'charisma' }, history: { label: 'История', ability: 'intell' }, insight: { label: 'Проницательность', ability: 'wisdom' }, intimidation: { label: 'Запугивание', ability: 'charisma' }, investigation: { label: 'Анализ', ability: 'intell' }, medicine: { label: 'Медицина', ability: 'wisdom' }, nature: { label: 'Природа', ability: 'intell' }, perception: { label: 'Внимательность', ability: 'wisdom' }, performance: { label: 'Выступление', ability: 'charisma' }, persuasion: { label: 'Убеждение', ability: 'charisma' }, religion: { label: 'Религия', ability: 'intell' }, sleightOfHand: { label: 'Ловкость рук', ability: 'dexterity' }, stealth: { label: 'Скрытность', ability: 'dexterity' }, survival: { label: 'Выживание', ability: 'wisdom' } };

    // ===================================================================
    // === НОВАЯ ЛОГИКА ДЛЯ ИНТЕРАКТИВНОГО БЛОКА АТАК И ЗАКЛИНАНИЙ (V5) ===
    // ===================================================================
    function populateAttacksAndSpellsV5(sheet, charData) {
        const container = sheet.querySelector('.cs-attacks-v5');
        if (!container) return;

        const list = container.querySelector('.cs-attacks-spell-list');
        list.innerHTML = ''; // Очищаем список перед отрисовкой

        let itemsToShow = [];

        if (activeFilter === 'attacks') {
            itemsToShow = (charData.attacks || []).map((item, index) => ({ ...item, type: 'attack', originalIndex: index }));
        } else {
            const spellList = (charData.spells || []).map((item, index) => ({ ...item, type: 'spell', originalIndex: index }));
            if (activeFilter === 'cantrips') {
                itemsToShow = spellList.filter(s => s.level === '0' || s.level === 0 || s.level?.toLowerCase() === 'заговор');
            } else if (activeFilter === 'spells') {
                itemsToShow = spellList.filter(s => s.level == activeSpellLevel);
            }
        }

        itemsToShow.forEach(item => {
            const li = document.createElement('li');
            li.className = 'attack-spell-item';
            li.dataset.index = item.originalIndex;
            li.dataset.type = item.type;

            const stats = [];
            if (item.bonus) stats.push(`БА: ${item.bonus}`);
            if (item.damage) stats.push(item.damage);
            if (item.damageType) stats.push(item.damageType);

            li.innerHTML = `
                <div class="item-main-info">
                    <input type="checkbox" class="item-prepared-checkbox" title="Подготовлено" ${item.prepared ? 'checked' : ''} ${item.type === 'attack' ? 'style="visibility: hidden;"' : ''}>
                    <span class="item-name">${item.name || 'Без названия'}</span>
                    <div class="item-description-marquee">
                        <span class="marquee-text">${item.description || ''}</span>
                    </div>
                    <span class="item-stats">${stats.join(', ')}</span>
                    <button class="item-info-btn" title="Показать описание">
                        <img src="img/icons/info.svg" alt="Инфо" style="width: 12px; height: 12px;">
                    </button>
                    <button class="item-delete-btn" title="Удалить элемент">×</button>
                </div>
                <div class="item-description hidden">
                    <p>${item.description || ''}</p>
                </div>`;
            list.appendChild(li);
        });

        // Проверяем какие тексты нуждаются в анимации
        setTimeout(() => {
            const marqueeElements = list.querySelectorAll('.marquee-text');
            marqueeElements.forEach(marquee => {
                const container = marquee.closest('.item-description-marquee');
                if (marquee.scrollWidth > container.clientWidth) {
                    marquee.classList.add('long-text');
                } else {
                    marquee.classList.remove('long-text');
                }
            });
        }, 100);
    }

    function setupAttacksAndSpellsEventListeners(sheet) {
        const container = sheet.querySelector('.cs-attacks-v5');
        if (!container) return;

        const levelNav = container.querySelector('.cs-spell-level-nav');
        const filters = container.querySelector('.cs-content-filters');
        const contentList = container.querySelector('.cs-attacks-spell-list');
        const addButton = container.querySelector('.add-new-attack-spell-btn');
        const formContainer = container.querySelector('.attack-spell-form-container');
        const form = formContainer.querySelector('.form-grid');
        const formActions = formContainer.querySelector('.form-actions');

        // --- Функция для очистки полей формы ---
        function clearAttackSpellForm() {
            formName.value = '';
            formBonus.value = '';
            formDamage.value = '';
            formDamageType.value = '';
            formRange.value = '';
            formSaveType.value = '';
            formDescription.value = '';
            formPrepared.checked = false;
        }

        // --- Получаем ссылки на все поля формы ---
        const formName = form.querySelector('input[placeholder="Название"]');
        const formBonus = form.querySelector('input[placeholder="Бонус атаки"]');
        const formDamage = form.querySelector('input[placeholder="Урон"]');
        const formDamageType = form.querySelector('input[placeholder="Тип урона"]');
        const formRange = form.querySelector('input[placeholder="Дальность"]');
        const formSaveType = form.querySelector('input[placeholder="Тип спасброска"]');
        const formDescription = formContainer.querySelector('textarea[placeholder="Описание..."]');
        const formPrepared = formContainer.querySelector('input[type="checkbox"]');

        // Навигация по уровням
        levelNav.addEventListener('click', e => {
            if (e.target.classList.contains('cs-level-nav-btn')) {
                levelNav.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                activeSpellLevel = e.target.dataset.level;
                // Автоматически переключаемся на заклинания при выборе уровня
                filters.querySelector('.active')?.classList.remove('active');
                filters.querySelector('[data-filter="spells"]').classList.add('active');
                activeFilter = 'spells';
                populateAttacksAndSpellsV5(sheet, currentCharacterData);
            }
        });

        // Фильтры
        filters.addEventListener('click', e => {
            if (e.target.classList.contains('cs-filter-btn')) {
                filters.querySelector('.active')?.classList.remove('active');
                e.target.classList.add('active');
                activeFilter = e.target.dataset.filter;
                populateAttacksAndSpellsV5(sheet, currentCharacterData);
            }
        });

        // Кнопка "+ Добавить"
        addButton.addEventListener('click', () => {
            editingItemIndex = null; // Режим добавления
            clearAttackSpellForm(); // Очищаем форму для нового элемента
            formContainer.classList.remove('hidden');
            formContainer.dataset.type = activeFilter === 'attacks' ? 'attack' : 'spell';
        });

        // Кнопки в форме
        // Кнопки в форме
        formActions.addEventListener('click', e => {
            if (e.target.classList.contains('form-cancel-btn')) {
                formContainer.classList.add('hidden');
            }
            if (e.target.classList.contains('form-save-btn')) {
                // 1. Собираем данные из полей
                const newItem = {
                    name: formName.value,
                    bonus: formBonus.value,
                    damage: formDamage.value,
                    damageType: formDamageType.value,
                    range: formRange.value,
                    save: formSaveType.value, // Для заклинаний
                    description: formDescription.value,
                    prepared: formPrepared.checked,
                    // Для совместимости со старыми данными
                    attackBonus: formBonus.value
                };

                const type = formContainer.dataset.type;

                // 2. Добавляем в нужный массив
                if (type === 'attack') {
                    if (!currentCharacterData.attacks) currentCharacterData.attacks = [];
                    currentCharacterData.attacks.push(newItem);
                } else { // spell or cantrip
                    if (!currentCharacterData.spells) currentCharacterData.spells = [];
                    // Определяем уровень заклинания
                    if (activeFilter === 'cantrips') {
                        newItem.level = '0';
                    } else {
                        newItem.level = activeSpellLevel;
                    }
                    currentCharacterData.spells.push(newItem);
                }

                // 3. Обновляем интерфейс и сохраняем
                populateAttacksAndSpellsV5(sheet, currentCharacterData);
                formContainer.classList.add('hidden');
                saveSheetData(); // Сохраняем все данные листа
            }
        });

        // Клик по элементам в списке (инфо, чекбокс, удаление)
        contentList.addEventListener('click', e => {
            const itemElement = e.target.closest('.attack-spell-item');
            if (!itemElement) return;

            const type = itemElement.dataset.type;
            const index = parseInt(itemElement.dataset.index, 10);

            // Кнопка "Инфо"
            if (e.target.classList.contains('item-info-btn') || e.target.closest('.item-info-btn')) {
                const description = itemElement.querySelector('.item-description p')?.textContent;
                const name = itemElement.querySelector('.item-name').textContent;
                infoModalTitle.textContent = name;
                infoModalDescription.textContent = description || 'Описание отсутствует.';
                itemInfoModal.classList.remove('hidden');
            }

            // Кнопка "Удалить"
            if (e.target.classList.contains('item-delete-btn')) {
                const name = itemElement.querySelector('.item-name').textContent;
                if (confirm(`Вы уверены, что хотите удалить "${name}"?`)) {
                    if (type === 'attack' && currentCharacterData.attacks) {
                        currentCharacterData.attacks.splice(index, 1);
                    } else if (type === 'spell' && currentCharacterData.spells) {
                        currentCharacterData.spells.splice(index, 1);
                    }
                    populateAttacksAndSpellsV5(sheet, currentCharacterData);
                    saveSheetData();
                }
            }

            // Чекбокс "Подготовлено"
            if (e.target.classList.contains('item-prepared-checkbox')) {
                if (type === 'spell' && currentCharacterData.spells[index]) {
                    currentCharacterData.spells[index].prepared = e.target.checked;
                    saveSheetData();
                }
            }
        });
    }

    if (closeInfoModalBtn) {
        closeInfoModalBtn.addEventListener('click', () => itemInfoModal.classList.add('hidden'));
        itemInfoModal.addEventListener('click', (e) => {
            if (e.target === itemInfoModal) {
                itemInfoModal.classList.add('hidden');
            }
        });
    }

    // ===================================================================
    // === КОНЕЦ НОВОЙ ЛОГИКИ V5                                       ===
    // ===================================================================


    function handleCombatAction(action, targetChar) {
        if (!action || !targetChar) return;
        const allObjects = getVisibleObjects();
        const targetId = targetChar._id;
        const targetCombatant = allObjects.find(o => o._id === targetId);
        const targetName = targetCombatant ? targetCombatant.name : '???';
        const targetAC = targetCombatant?.ac || 10;
        const attackRollCommand = `/roll 1d20${action.bonus}`;
        sendLogMessage(`использует ${action.name} против ${targetName}. Бросок на попадание: ${attackRollCommand} vs AC ${targetAC}`);
        if (action.damage) {
            const damageRollCommand = `/roll ${action.damage}`;
            sendLogMessage(`урон от ${action.name}: ${damageRollCommand} ${action.damageType || ''}`);
        }
    }

    function renderActionBar(charData) {
        if (!charData || !charData.name) {
            actionBar.innerHTML = '';
            actionBar.classList.add('hidden');
            return;
        }
        actionBar.classList.remove('hidden');

        // Создаем массив из 13 слотов
        const totalSlots = 13;
        let items = [];
        let hotbarHTML = '';
        
        if (activeActionTab === 'attacks') {
            items = charData.attacks || [];
        } else if (activeActionTab === 'spells') {
            items = (charData.spells || []).filter(spell => spell.prepared || spell.level === '0' || spell.level === 0);
        } else if (activeActionTab === 'items') {
            items = charData.equipmentList || [];
        }

        // Создаем слоты (заполненные + пустые)
        for (let i = 0; i < totalSlots; i++) {
            if (i < items.length) {
                const item = items[i];
                let buttonData = '';
                let buttonText = item.name || 'Без названия';
                
                if (activeActionTab === 'attacks') {
                    buttonData = `data-type="attack" data-name="${item.name}" data-bonus="${item.bonus || ''}" data-damage="${item.damage || ''}" data-damage-type="${item.damageType || ''}"`;
                } else if (activeActionTab === 'spells') {
                    buttonData = `data-type="spell" data-name="${item.name}" data-bonus="${item.attackBonus || ''}" data-damage="${item.damage || ''}" data-damage-type="${item.damageType || ''}" data-description="${item.description || ''}"`;
                    if (item.level !== '0' && item.level !== 0) {
                        buttonText += `<br><span style="font-size: 8px; opacity: 0.7;">${item.level} ур.</span>`;
                    }
                } else if (activeActionTab === 'items') {
                    buttonData = `data-type="item" data-name="${item.name}"`;
                    buttonText += `<br><span style="font-size: 8px; opacity: 0.7;">(${item.quantity || 1})</span>`;
                }
                
                hotbarHTML += `<button class="hotbar-button" ${buttonData}>${buttonText}</button>`;
            } else {
                // Пустой слот
                hotbarHTML += `<button class="hotbar-button" data-slot="${i}" data-empty="true"></button>`;
            }
        }

        const isMyTurn = currentCombatState?.isActive && currentCombatState.combatants[currentCombatState.turn]?.characterId?.toString() === activeCharacterId;

        actionBar.innerHTML = `
        <div class="action-bar-section action-bar-left">
            <div class="char-portrait" title="${charData.name}">
                ${charData.name.charAt(0).toUpperCase()}
            </div>
        </div>
        <div class="action-bar-section action-bar-center">
            <div class="action-bar-top-row">
                <button class="tab-button ${activeActionTab === 'attacks' ? 'active' : ''}" data-tab="attacks">Атаки</button>
                <button class="tab-button ${activeActionTab === 'spells' ? 'active' : ''}" data-tab="spells">Заклинания</button>
                <button class="tab-button ${activeActionTab === 'items' ? 'active' : ''}" data-tab="items">Предметы</button>
                <button id="action-bar-end-turn" class="end-turn-button ${!isMyTurn && !isGm ? 'disabled' : ''}" title="Завершить ход">
                    Завершить Ход
                </button>
            </div>
            <div class="hotbar-grid">${hotbarHTML}</div>
        </div>`;

        // Добавляем класс long-text для кнопок с длинными названиями
        setTimeout(() => {
            document.querySelectorAll('.hotbar-button:not([data-empty])').forEach(button => {
                const textLength = button.textContent.replace(/\s+/g, '').length;
                if (textLength > 8) { // Если больше 8 символов
                    button.classList.add('long-text');
                }
            });
        }, 10);
    }

    function populateSheet(charData) {
        console.log('Populating sheet with character data:', charData);
        const sheet = sheetContainer.querySelector('.cs-container');
        if (!sheet) {
            console.warn('Sheet container not found!');
            return;
        }

        // Заполняем все поля input, textarea, select с data-field атрибутом
        sheet.querySelectorAll('input, textarea, select').forEach(input => {
            const field = input.dataset.field;
            const group = input.dataset.group;
            if (!field) return;

            let value;
            if (group) {
                value = charData[group] ? charData[group][field] : undefined;
            } else {
                value = charData[field];
            }

            if (input.type === 'checkbox') {
                if (group !== 'deathSaves') {
                    input.checked = !!value;
                }
            } else {
                input.value = (value !== undefined && value !== null) ? value : (input.type === 'number' ? '' : '');
            }
        });

        if (charData.deathSaves) {
            sheet.querySelectorAll('input[data-group="deathSaves"][data-field="successes"]').forEach((cb, i) => {
                cb.checked = i < charData.deathSaves.successes;
            });
            sheet.querySelectorAll('input[data-group="deathSaves"][data-field="failures"]').forEach((cb, i) => {
                cb.checked = i < charData.deathSaves.failures;
            });
        }

        const playerNameInputs = sheet.querySelectorAll('[data-field="playerName"]');
        if (playerNameInputs) {
            playerNameInputs.forEach(input => input.value = charData.playerName || userData.username);
        }

        const nameInputs = sheet.querySelectorAll('[data-field="name"]');
        if (nameInputs) {
            nameInputs.forEach(input => input.value = charData.name || '');
        }

        updateCalculatedFields(sheet, charData);
        populateAttacksAndSpellsV5(sheet, charData); // <--- ИСПОЛЬЗУЕМ НОВУЮ ФУНКЦИЮ
        setupAttacksAndSpellsEventListeners(sheet); // <--- ВЫЗЫВАЕМ НАСТРОЙКУ ОБРАБОТЧИКОВ
        populateEquipment(sheet, charData);
        
        console.log('Sheet populated successfully');
    }

    /* СТАРАЯ ФУНКЦИЯ populateAttacksAndSpells ЗАКОММЕНТИРОВАНА, ТАК КАК ЗАМЕНЕНА НА V5
    function populateAttacksAndSpells(sheet, charData) {
        // ... старый код ...
    }
    */

    function addAttack(parent) {
        if (!currentCharacterData.attacks) currentCharacterData.attacks = [];
        currentCharacterData.attacks.push({ name: '', bonus: '', damage: '', damageType: '' });
        populateAttacksAndSpellsV5(sheetContainer.querySelector('.cs-container'), currentCharacterData);
        saveSheetData();
    }

    function removeAttack(index) {
        currentCharacterData.attacks?.splice(index, 1);
        populateAttacksAndSpellsV5(sheetContainer.querySelector('.cs-container'), currentCharacterData);
        saveSheetData();
    }

    function addSpell() {
        if (!currentCharacterData.spells) currentCharacterData.spells = [];
        currentCharacterData.spells.push({ name: '', level: '0', attackBonus: '', damage: '', damageType: '', description: '' });
        populateAttacksAndSpellsV5(sheetContainer.querySelector('.cs-container'), currentCharacterData);
        saveSheetData();
    }

    function removeSpell(index) {
        currentCharacterData.spells?.splice(index, 1);
        populateAttacksAndSpellsV5(sheetContainer.querySelector('.cs-container'), currentCharacterData);
        saveSheetData();
    }

    function populateEquipment(sheet, charData) {
        const equipmentList = sheet.querySelector('#equipment-list');
        if (!equipmentList) return;
        equipmentList.innerHTML = '';
        if (Array.isArray(charData.equipmentList) && charData.equipmentList.length > 0) {
            charData.equipmentList.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = 'equipment-item';
                li.dataset.index = index;
                li.innerHTML = `<span>${item.name} (${item.quantity})</span><button class="remove-equipment-btn">&times;</button>`;
                equipmentList.appendChild(li);
            });
        }
    }

    function addEquipment(item) {
        if (!currentCharacterData.equipmentList) currentCharacterData.equipmentList = [];
        currentCharacterData.equipmentList.push(item);
        populateEquipment(sheetContainer.querySelector('.cs-container'), currentCharacterData);
        saveSheetData();
    }

    function removeEquipment(index) {
        if (!currentCharacterData.equipmentList) return;
        currentCharacterData.equipmentList.splice(index, 1);
        populateEquipment(sheetContainer.querySelector('.cs-container'), currentCharacterData);
        saveSheetData();
    }

    function updateCalculatedFields(sheet, charData) {
        if (!sheet || !charData) return;
        const proficiencyBonus = parseInt(charData.proficiencyBonus) || 0;

        let abilitiesModifiers = {};

        for (const key in ABILITIES) {
            const score = parseInt(charData[key]) || 10;
            const modifier = Math.floor((score - 10) / 2);
            abilitiesModifiers[key] = modifier;
            const modString = modifier >= 0 ? `+${modifier}` : modifier;
            const modifierInput = sheet.querySelector(`[data-field="${key}Modifier"]`);
            if (modifierInput) modifierInput.value = modString;

            const saveProficient = charData[`${key}SaveProficient`];
            const saveBonus = modifier + (saveProficient ? proficiencyBonus : 0);
            const saveBonusString = saveBonus >= 0 ? `+${saveBonus}` : saveBonus;
            const saveBonusSpan = sheet.querySelector(`[data-field="${key}Save"]`);
            if (saveBonusSpan) saveBonusSpan.textContent = saveBonusString;
        }

        const initiativeInput = sheet.querySelector('[data-field="initiative"]');
        if (initiativeInput) {
            const dexModifier = abilitiesModifiers['dexterity'];
            initiativeInput.value = dexModifier >= 0 ? `+${dexModifier}` : dexModifier;
        }

        for (const key in SKILLS) {
            const skill = SKILLS[key];
            const abilityModifier = abilitiesModifiers[skill.ability];
            const isProficient = charData[`${key}Proficient`];
            const skillBonus = abilityModifier + (isProficient ? proficiencyBonus : 0);
            const skillBonusString = skillBonus >= 0 ? `+${skillBonus}` : skillBonus;
            const skillBonusSpan = sheet.querySelector(`.cs-skills-v2 span[data-field="${key}"]`);
            if (skillBonusSpan) skillBonusSpan.textContent = skillBonusString;
        }

        // Рассчитываем пассивную внимательность
        const passivePerceptionInput = sheet.querySelector('[data-field="passivePerception"]');
        if (passivePerceptionInput) {
            const wisdomModifier = abilitiesModifiers['wisdom'] || 0;
            const perceptionProficient = charData['perceptionProficient'];
            const passivePerception = 10 + wisdomModifier + (perceptionProficient ? proficiencyBonus : 0);
            passivePerceptionInput.value = passivePerception;
        }
    }

    async function saveSheetData() {
        if (!activeCharacterId || isGm) {
            console.log('Save skipped: no active character or user is GM');
            return;
        }
        const sheet = sheetContainer.querySelector('.cs-container');
        if (!sheet) {
            console.log('Save skipped: no sheet container found');
            return;
        }

        console.log('Starting to save sheet data for character:', activeCharacterId);
        const dataToSave = { ...currentCharacterData };

        sheet.querySelectorAll('input, textarea, select').forEach(input => {
            const field = input.dataset.field;
            const group = input.dataset.group;
            if (!field) return;

            if (input.closest('.cs-attacks-v5')) return;

            let value;
            if (input.type === 'checkbox') {
                if (group !== 'deathSaves') {
                    value = input.checked;
                } else { return; }
            } else if (input.type === 'number') {
                value = parseInt(input.value) || 0;
            } else {
                value = input.value;
            }

            if (group) {
                if (!dataToSave[group]) dataToSave[group] = {};
                dataToSave[group][field] = value;
            } else {
                dataToSave[field] = value;
            }
        });

        dataToSave.deathSaves = {
            successes: sheet.querySelectorAll('input[data-group="deathSaves"][data-field="successes"]:checked').length,
            failures: sheet.querySelectorAll('input[data-group="deathSaves"][data-field="failures"]:checked').length
        };

        // Данные атак и заклинаний теперь управляются своей логикой,
        // но они уже находятся в currentCharacterData, так что сохранятся.

        dataToSave.equipmentList = [];
        const equipmentItems = sheet.querySelectorAll('#equipment-list .equipment-item');
        if (equipmentItems.length > 0) {
            equipmentItems.forEach(item => {
                const nameSpan = item.querySelector('span');
                if (nameSpan) {
                    const parts = nameSpan.textContent.match(/(.+) \((\d+)\)/);
                    if (parts) {
                        dataToSave.equipmentList.push({ name: parts[1], quantity: parseInt(parts[2]) });
                    }
                }
            });
        }

        currentCharacterData = dataToSave;

        // Сохраняем данные локально как резервный вариант
        try {
            localStorage.setItem(`characterData_${activeCharacterId}`, JSON.stringify(dataToSave));
        } catch (localError) {
            console.warn("Failed to save character data locally:", localError);
        }

        updateCalculatedFields(sheet, currentCharacterData);
        renderActionBar(currentCharacterData);

        try {
            await fetch(`${BACKEND_URL}/api/characters/${activeCharacterId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userData.token}` },
                body: JSON.stringify(dataToSave)
            });
            socket.emit('character:update', currentCharacterData);
            console.log('Character data saved successfully to server');
        } catch (error) {
            console.error("Failed to save character sheet:", error);
            // Если сохранение на сервер не удалось, пробуем восстановить из localStorage
            alert('Не удалось сохранить данные на сервер. Данные сохранены локально.');
        }
    }

    sheetContainer.addEventListener('input', (e) => {
        // Сохраняем изменения для всех input и textarea в листе персонажа
        if (e.target.matches('input, textarea, select') && 
            !e.target.closest('.cs-attacks-v5') && 
            activeCharacterId) {
            
            console.log('Character sheet field changed:', e.target.dataset.field || e.target.name, e.target.value);
            console.log('Active character ID:', activeCharacterId);
            
            // Немедленно обновляем расчетные поля при изменении характеристик
            const sheet = sheetContainer.querySelector('.cs-container');
            const fieldName = e.target.dataset.field;
            if (sheet && fieldName && (
                fieldName === 'strength' || fieldName === 'dexterity' || fieldName === 'constitution' ||
                fieldName === 'intell' || fieldName === 'wisdom' || fieldName === 'charisma' ||
                fieldName === 'proficiencyBonus'
            )) {
                // Обновляем currentCharacterData с новым значением перед пересчетом
                if (e.target.type === 'number') {
                    currentCharacterData[fieldName] = parseInt(e.target.value) || 0;
                } else {
                    currentCharacterData[fieldName] = e.target.value;
                }
                updateCalculatedFields(sheet, currentCharacterData);
            }
            
            clearTimeout(sheetUpdateTimeout);
            sheetUpdateTimeout = setTimeout(saveSheetData, 500);
        }
    });

    sheetContainer.addEventListener('change', (e) => {
        // Дополнительно обрабатываем change события для checkbox и select
        if (e.target.matches('input[type="checkbox"], select') && 
            !e.target.closest('.cs-attacks-v5') && 
            activeCharacterId) {
            
            console.log('Character sheet field changed (change event):', e.target.dataset.field || e.target.name, e.target.checked || e.target.value);
            
            // Обновляем currentCharacterData с новым значением чекбокса
            const fieldName = e.target.dataset.field;
            const groupName = e.target.dataset.group;
            
            if (fieldName && groupName) {
                if (!currentCharacterData[groupName]) currentCharacterData[groupName] = {};
                currentCharacterData[groupName][fieldName] = e.target.checked;
            } else if (fieldName) {
                currentCharacterData[fieldName] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
            }
            
            // Немедленно обновляем расчетные поля при изменении чекбоксов навыков/спасбросков
            const sheet = sheetContainer.querySelector('.cs-container');
            if (sheet && fieldName && (fieldName.includes('Proficient') || fieldName.includes('Save'))) {
                updateCalculatedFields(sheet, currentCharacterData);
            }
            
            clearTimeout(sheetUpdateTimeout);
            sheetUpdateTimeout = setTimeout(saveSheetData, 500);
        }
    });

    // --- ЛОГИКА АУТЕНТИФИКАЦИИ ---
    function setupAuthEventListeners() {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authMessage.textContent = '';
        });
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            authMessage.textContent = '';
        });
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            try {
                const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    login(data);
                } else {
                    authMessage.textContent = data.message;
                    authMessage.style.color = 'var(--accent-danger)';
                }
            } catch (e) {
                authMessage.textContent = 'Ошибка сети';
            }
        });
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('registerUsername').value;
            const password = document.getElementById('registerPassword').value;
            try {
                const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
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
            } catch (e) {
                authMessage.textContent = 'Ошибка сети';
            }
        });
        logoutBtn.addEventListener('click', logout);
    }

    function login({ token, userId, username }) {
        localStorage.setItem('token', token);
        localStorage.setItem('userData', JSON.stringify({ token, userId, username }));
        socket.auth.token = token;
        socket.connect();

        userData = { token, userId, username };

        if (username.toLowerCase() === 'gm') {
            isGm = true;
        }

        authContainer.classList.add('hidden');
        mainAppContainer.classList.remove('hidden');
        usernameDisplay.textContent = username;
        initializeApp();
    }

    function logout() {
        userData = { token: null, userId: null, username: null };
        localStorage.removeItem('userData');
        localStorage.removeItem('token');
        localStorage.removeItem('activeCharacterId');
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
        });

        socket.on('worldmap:update', (updatedCharacters) => {
            // Интегрируем обновления, не затирая текущие позиции для плавной анимации
            updatedCharacters.forEach(updatedChar => {
                const existingChar = worldMapState.characters.find(c => c._id === updatedChar._id);
                if (existingChar) {
                    // Если персонаж анимируется, не обновляем его координаты
                    if (!animatingTokens.has(updatedChar._id)) {
                        Object.assign(existingChar, updatedChar);
                    } else {
                        // Обновляем только не-координатные данные
                        const { worldMapX, worldMapY, ...otherData } = updatedChar;
                        Object.assign(existingChar, otherData);
                    }
                } else {
                    // Если это новый персонаж, добавляем его
                    worldMapState.characters.push(updatedChar);
                }
            });
        });

        socket.on('worldmap:url_update', (newUrl) => {
            loadWorldMapImage(newUrl);
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
            if (activeCharacterId) {
                renderActionBar(currentCharacterData);
            }
        });

        socket.on('character:view', async (charData) => {
            try {
                const response = await fetch('character-sheet.html');
                if (!response.ok) throw new Error('Не удалось загрузить файл character-sheet.html');
                const sheetHTML = await response.text();
                sheetContainer.innerHTML = sheetHTML;
                sheetContainer.querySelectorAll('.char-sheet-input').forEach(input => input.readOnly = true);
                sheetContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
                populateSheet(charData);
                sheetModal.classList.remove('hidden');
            } catch (error) {
                console.error("Ошибка при просмотре персонажа:", error);
            }
        });
    }

    // --- ЛОГИКА ПРИЛОЖЕНИЯ ---
    function initializeApp() {
        resizeCanvas();
        if (isGm) {
            worldMapGmControls.classList.remove('hidden');
        } else {
            worldMapGmControls.classList.add('hidden');
        }

        setupDiceRoller();
        // resizeCanvas();
        loadCharacterList(); // Теперь восстановление персонажа происходит внутри этой функции
        initializeWorldMap();
        setupMainEventListeners();
        setupSocketListeners();
        gameLoop();
    }

    // --- Управление персонажами ---
    async function loadCharacterList() {
        if (isGm) {
            if (characterManagerPanel) characterManagerPanel.classList.add('hidden');
            return;
        };
        try {
            const response = await fetch(`${BACKEND_URL}/api/characters`, { headers: { 'Authorization': `Bearer ${userData.token}` } });
            if (!response.ok) {
                if (response.status === 401) return logout();
                throw new Error('Failed to fetch characters');
            }
            const characters = await response.json();
            
            if (characterSelectorOptions) {
                characterSelectorOptions.innerHTML = ''; // Clear previous options
            }
            if (characterSelectorTrigger) {
                characterSelectorTrigger.querySelector('span').textContent = '-- Выберите персонажа --'; // Reset trigger text
            }
            if(characterSelectorWrapper) {
                characterSelectorWrapper.dataset.value = ''; // Reset selected value
            }

            if (characters.length > 0) {
                characters.forEach(char => {
                    const option = document.createElement('div');
                    option.classList.add('custom-select-option');
                    option.dataset.value = char._id;
                    option.textContent = char.name;
                    if (characterSelectorOptions) {
                        characterSelectorOptions.appendChild(option);
                    }
                });
                
                // Автоматически восстанавливаем последнего выбранного персонажа
                const savedCharacterId = localStorage.getItem('activeCharacterId');
                if (savedCharacterId && !isGm && !activeCharacterId) {
                    const savedCharExists = characters.find(char => char._id === savedCharacterId);
                    if (savedCharExists) {
                        loadCharacter(savedCharacterId);
                    } else {
                        // Если сохраненный персонаж не найден, очищаем localStorage
                        localStorage.removeItem('activeCharacterId');
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load character list:", error);
        }
    }

    async function loadCharacter(id) {
        if (!id) return;
        try {
            const response = await fetch(`${BACKEND_URL}/api/characters/${id}`, { headers: { 'Authorization': `Bearer ${userData.token}` } });
            if (!response.ok) throw new Error('Character not found');
            currentCharacterData = await response.json();
            activeCharacterId = id;
            
            // Сохраняем ID активного персонажа в localStorage
            localStorage.setItem('activeCharacterId', id);
            
            // Обновляем UI селектора персонажей
            updateCharacterSelectorUI(currentCharacterData);
            
            // Если лист персонажа открыт, обновляем его данными нового персонажа
            if (sheetContainer && sheetContainer.querySelector('.cs-container')) {
                populateSheet(currentCharacterData);
            }
            
            socket.emit('character:update', currentCharacterData);
            renderActionBar(currentCharacterData);
        } catch (error) {
            console.error("Failed to load character:", error);
            
            // Пробуем загрузить из localStorage как резервный вариант
            try {
                const localData = localStorage.getItem(`characterData_${id}`);
                if (localData) {
                    currentCharacterData = JSON.parse(localData);
                    activeCharacterId = id;
                    localStorage.setItem('activeCharacterId', id);
                    updateCharacterSelectorUI(currentCharacterData);
                    
                    if (sheetContainer && sheetContainer.querySelector('.cs-container')) {
                        populateSheet(currentCharacterData);
                    }
                    
                    renderActionBar(currentCharacterData);
                    console.warn("Загружены локально сохраненные данные персонажа");
                    return;
                }
            } catch (localError) {
                console.error("Failed to load local character data:", localError);
            }
            
            // Если персонаж не найден, очищаем сохраненный ID
            localStorage.removeItem('activeCharacterId');
        }
    }

    // Функция для обновления UI селектора персонажей
    function updateCharacterSelectorUI(characterData) {
        if (characterSelectorWrapper) {
            characterSelectorWrapper.dataset.value = characterData._id;
        }
        if (characterSelectorTrigger) {
            characterSelectorTrigger.querySelector('span').textContent = characterData.name;
        }
    }

    async function createNewCharacter() {
        try {
            const response = await fetch(`${BACKEND_URL}/api/characters`, { method: 'POST', headers: { 'Authorization': `Bearer ${userData.token}` } });
            const newCharacter = await response.json();
            await loadCharacterList();
            
            // Обновляем UI селектора с помощью новой функции
            updateCharacterSelectorUI(newCharacter);
            if (characterSelectorOptions) {
                const newOption = characterSelectorOptions.querySelector(`[data-value="${newCharacter._id}"]`);
                if(newOption) newOption.classList.add('selected');
            }

            await loadCharacter(newCharacter._id);

            const mapResponse = await fetch(`${BACKEND_URL}/api/worldmap`, { headers: { 'Authorization': `Bearer ${userData.token}` } });
            const data = await mapResponse.json();
            worldMapState.characters = data.characters;
        } catch (error) {
            console.error("Failed to create character:", error);
        }
    }

    async function deleteCharacter() {
        const selectedId = characterSelectorWrapper ? characterSelectorWrapper.dataset.value : null;
        if (!selectedId) {
            alert("Персонаж не выбран.");
            return;
        }
        const characterName = characterSelectorTrigger ? characterSelectorTrigger.querySelector('span').textContent : '';
        if (confirm(`Вы уверены, что хотите удалить персонажа "${characterName}"?`)) {
            try {
                await fetch(`${BACKEND_URL}/api/characters/${selectedId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${userData.token}` } });
                await loadCharacterList();
                if (activeCharacterId === selectedId) {
                    activeCharacterId = null;
                    currentCharacterData = {};
                    actionBar.innerHTML = '';
                    // Очищаем сохраненный ID персонажа и локальные данные
                    localStorage.removeItem('activeCharacterId');
                    localStorage.removeItem(`characterData_${selectedId}`);
                    // Сбрасываем UI селектора
                    if (characterSelectorWrapper) characterSelectorWrapper.dataset.value = '';
                    if (characterSelectorTrigger) characterSelectorTrigger.querySelector('span').textContent = '-- Выберите персонажа --';
                }
            } catch (error) {
                console.error("Failed to delete character:", error);
            }
        }
    }

    function sendLogMessage(text) {
        if (text && text.trim() !== '') {
            const messageData = { charName: isGm ? 'Мастер' : (currentCharacterData.name || 'Игрок') };
            // Поддержка команды /roll
            const rollMatch = text.match(/^\/(r|roll)\s+(.*)/);
            if (rollMatch) {
                const notation = rollMatch[2];
                messageData.text = `бросает ${notation}`; // Текст, который увидят все
                socket.emit('log:send', { text: messageData.text, notation: notation, charName: messageData.charName });
            } else {
                messageData.text = text;
                socket.emit('log:send', messageData);
            }
        }
    }

    // --- НОВАЯ ЛОГИКА ГЛОБАЛЬНОЙ КАРТЫ ---
    function resizeCanvas() {
    const container = document.getElementById('map-container');
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Устанавливаем реальный размер в пикселях
    mainCanvas.width = rect.width * dpr;
    mainCanvas.height = rect.height * dpr;

    // Устанавливаем отображаемый размер через CSS
    mainCanvas.style.width = `${rect.width}px`;
    mainCanvas.style.height = `${rect.height}px`;

    // Масштабируем контекст, чтобы все рисовалось в высоком разрешении
    ctx.scale(dpr, dpr);
}

    function gameLoop() {
        renderCanvas();
        requestAnimationFrame(gameLoop);
    }

    function renderCanvas() {
        ctx.save();
        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
        ctx.translate(viewTransform.offsetX, viewTransform.offsetY);
        ctx.scale(viewTransform.scale, viewTransform.scale);
        if (worldMapState.image) {
            ctx.drawImage(worldMapState.image, 0, 0);
        } else {
            ctx.fillStyle = '#1A2138';
            ctx.fillRect(0, 0, mainCanvas.width / viewTransform.scale, mainCanvas.height / viewTransform.scale);
        }
        
        // Рисуем предпросмотр места перемещения
        if (selectedCharacterForMove && mousePreviewPosition) {
            ctx.save();
            ctx.translate(mousePreviewPosition.x, mousePreviewPosition.y);
            ctx.scale(1 / viewTransform.scale, 1 / viewTransform.scale);
            
            // Рисуем полупрозрачный круг-предпросмотр
            ctx.beginPath();
            ctx.arc(0, 0, TOKEN_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.restore();
        }
        
        const visibleObjects = getVisibleObjects();
        const currentTurnCombatant = currentCombatState && currentCombatState.isActive ? currentCombatState.combatants[currentCombatState.turn] : null;
        visibleObjects.forEach(obj => {
            const combatantData = currentCombatState?.isActive ? currentCombatState.combatants.find(c => c.characterId?.toString() === obj._id || c._id.toString() === obj._id) : null;
            const isSelected = obj._id === selectedCharacterForMove;
            const isHovered = hoveredObject && hoveredObject._id === obj._id;
            const isTarget = currentTurnCombatant && combatantData && currentTurnCombatant.targetId === (combatantData.characterId?.toString() || combatantData._id.toString());
            ctx.save();
            ctx.translate(obj.worldMapX, obj.worldMapY);
            ctx.scale(1 / viewTransform.scale, 1 / viewTransform.scale);
            drawToken(obj, isSelected, isHovered, isTarget);
            ctx.restore();
        });
        if (currentTurnCombatant && currentTurnCombatant.targetId) {
            const attacker = visibleObjects.find(o => o._id === (currentTurnCombatant.characterId?.toString() || currentTurnCombatant._id.toString()));
            const target = visibleObjects.find(o => o._id === currentTurnCombatant.targetId);
            if (attacker && target) {
                drawArrow(attacker.worldMapX, attacker.worldMapY, target.worldMapX, target.worldMapY, 'rgba(255, 0, 0, 0.7)');
            }
        }
        ctx.restore();
    }

    function drawToken(obj, isSelected, isHovered, isTarget) {
        const isNpc = !obj.isPlayer;
        const color = isNpc ? 'rgba(229, 57, 53, 0.9)' : 'rgba(0, 184, 212, 0.9)';
        ctx.beginPath();
        ctx.arc(0, 0, TOKEN_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (isTarget) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (isSelected) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (isHovered) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Montserrat';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(obj.name, 0, -TOKEN_RADIUS - 5);
        ctx.shadowBlur = 0;
    }

    function getVisibleObjects() {
        const visible = [];
        if (currentCombatState && currentCombatState.isActive) {
            return currentCombatState.combatants.map(c => {
                const charData = worldMapState.characters.find(char => char._id === (c.characterId?.toString() || c._id.toString()));
                // Приоритет отдаем координатам из charData (текущие координаты), а не из c (старые координаты боя)
                return {
                    ...c,
                    ...charData,
                    _id: c.characterId ? c.characterId.toString() : c._id.toString()
                };
            });
        } else if (activeCharacterId) {
            const activeChar = worldMapState.characters.find(c => c._id === activeCharacterId);
            if (activeChar) {
                visible.push(activeChar);
            }
        }
        return visible;
    }

    function drawArrow(fromx, fromy, tox, toy, color) {
        const headlen = 15;
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

    function screenToWorldCoords(x, y) {
        return {
            x: (x - viewTransform.offsetX) / viewTransform.scale,
            y: (y - viewTransform.offsetY) / viewTransform.scale
        };
    }

    function findObjectUnderMouse(screenX, screenY) {
        const visibleObjects = getVisibleObjects();
        for (let i = visibleObjects.length - 1; i >= 0; i--) {
            const obj = visibleObjects[i];
            const objScreenX = obj.worldMapX * viewTransform.scale + viewTransform.offsetX;
            const objScreenY = obj.worldMapY * viewTransform.scale + viewTransform.offsetY;
            const distance = Math.sqrt(Math.pow(screenX - objScreenX, 2) + Math.pow(screenY - objScreenY, 2));
            if (distance <= TOKEN_RADIUS) {
                return obj;
            }
        }
        return null;
    }

    function loadWorldMapImage(url) {
        if (!url) {
            worldMapState.image = null;
            worldMapState.imageUrl = '';
            return;
        }
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => { worldMapState.image = img; };
        img.onerror = () => { console.error('Не удалось загрузить карту мира.'); };
        img.src = url;
        worldMapState.imageUrl = url;
        if (isGm) worldMapBackgroundUrlInput.value = url;
    }

    function initializeWorldMap() {
        loadWorldMapImage('/img/worldmap.jpg');
        fetch(`${BACKEND_URL}/api/worldmap`, { headers: { 'Authorization': `Bearer ${userData.token}` } })
            .then(res => res.json())
            .then(data => {
                worldMapState.characters = data.characters;
            })
            .catch(error => console.error("Ошибка при загрузке данных карты:", error));

        setupMapEventListeners();
    }

    // --- Логика боя ---
    function renderCombatTracker() {
        const gmOnlyControls = [startCombatBtn, endCombatBtn, nextTurnBtn, addNpcForm];
        if (!currentCombatState || !currentCombatState.isActive) {
            initiativeTracker.innerHTML = '';
            const existingRollBtn = document.getElementById('rollAllInitiativeBtn');
            if (existingRollBtn) existingRollBtn.remove();
            if (isGm) {
                startCombatBtn.classList.remove('hidden');
                endCombatBtn.classList.add('hidden');
                nextTurnBtn.classList.add('hidden');
                addNpcForm.classList.remove('hidden');
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
                rollAllBtn.addEventListener('click', async () => { try { const response = await fetch(`${BACKEND_URL}/api/combat/roll-initiative`, { method: 'PUT', headers: { 'Authorization': `Bearer ${userData.token}` } }); if (!response.ok) { const err = await response.json(); console.error('Failed to roll initiative for all:', err.message); } } catch (error) { console.error('Error rolling initiative:', error); } });
                combatControls.insertBefore(rollAllBtn, nextTurnBtn);
            }
        }
        initiativeTracker.innerHTML = '';
        currentCombatState.combatants.forEach((c, index) => {
            const li = document.createElement('li');
            if (index === currentCombatState.turn) { li.classList.add('current-turn'); }
            const nameSpan = document.createElement('span');
            nameSpan.className = 'combatant-name';
            nameSpan.textContent = c.name;
            li.appendChild(nameSpan);
            if (currentCombatState.isActive) {
                const hpHtml = getCombatantHpHtml(c._id.toString(), c.currentHp, c.maxHp);
                li.appendChild(hpHtml);
            }
            const initiativeContainer = document.createElement('div');
            initiativeContainer.className = 'initiative-container';
            if (c.initiative === null) {
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'initiative-input';
                input.placeholder = '...';
                input.dataset.id = c._id;
                input.disabled = !isGm && c.characterId !== activeCharacterId;
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const initiative = parseInt(e.target.value, 10); if (!isNaN(initiative)) { socket.emit('combat:set_initiative', { combatantId: c._id, initiative }); } } });
                initiativeContainer.appendChild(input);
            } else {
                const valueSpan = document.createElement('span');
                valueSpan.className = 'initiative-value';
                valueSpan.textContent = c.initiative;
                initiativeContainer.appendChild(valueSpan);
            }
            li.appendChild(initiativeContainer);
            if (!c.isPlayer && isGm) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-combatant-btn';
                removeBtn.innerHTML = '&times;';
                removeBtn.dataset.id = c._id;
                removeBtn.addEventListener('click', () => { socket.emit('combat:remove_combatant', c._id); });
                li.appendChild(removeBtn);
            }
            initiativeTracker.appendChild(li);
        });
    }
    function getCombatantHpHtml(id, current, max) {
        const hpContainer = document.createElement('div');
        hpContainer.className = 'hp-input-container';
        let hpInput = '';
        if (isGm) {
            hpInput = `<input type="number" class="hp-input" data-id="${id}" value="${current}">`;
        } else {
            hpInput = `<span>${current}</span>`;
        }
        hpContainer.innerHTML = `${hpInput}<span> / ${max}</span>`;
        if (isGm) { const input = hpContainer.querySelector('.hp-input'); input.addEventListener('change', (e) => { const newHp = parseInt(e.target.value, 10); if (!isNaN(newHp)) { sendHpUpdate(id, newHp); } }); }
        return hpContainer;
    }
    function sendHpUpdate(combatantId, newHp) {
        socket.emit('combat:update_hp', { combatantId, newHp });
    }

    // --- ОСНОВНЫЕ ОБРАБОТЧИКИ СОБЫТИЙ ---
    function setupMainEventListeners() {
        window.addEventListener('resize', resizeCanvas);
        
        loadCharacterBtn.addEventListener('click', () => { 
            const selectedId = characterSelectorWrapper.dataset.value; 
            if (selectedId) { 
                activeActionTab = 'attacks'; 
                loadCharacter(selectedId); 
            } else { 
                alert('Пожалуйста, выберите персонажа для загрузки.'); 
            } 
        });

        newCharacterBtn.addEventListener('click', createNewCharacter);
        deleteCharacterBtn.addEventListener('click', deleteCharacter);
        eventLogInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { sendLogMessage(eventLogInput.value); eventLogInput.value = ''; } });
        eventLogSendBtn.addEventListener('click', () => { sendLogMessage(eventLogInput.value); eventLogInput.value = ''; });
        startCombatBtn.addEventListener('click', () => socket.emit('combat:start'));
        endCombatBtn.addEventListener('click', () => socket.emit('combat:end'));
        nextTurnBtn.addEventListener('click', () => socket.emit('combat:next_turn'));
        
        // Обработчик кликов по панели действий
        actionBar.addEventListener('click', (e) => {
            // Кнопка завершения хода
            const endTurnBtn = e.target.closest('#action-bar-end-turn');
            if (endTurnBtn) {
                socket.emit('combat:next_turn');
                return;
            }

            // Переключение табов
            const tabBtn = e.target.closest('.tab-button');
            if (tabBtn && tabBtn.dataset.tab) {
                activeActionTab = tabBtn.dataset.tab;
                renderActionBar(currentCharacterData);
                return;
            }

            // Клик по слоту действия
            const actionBtn = e.target.closest('.hotbar-button');
            if (actionBtn) {
                // Если это пустой слот, показываем информацию
                if (actionBtn.dataset.empty === 'true') {
                    const slotNumber = parseInt(actionBtn.dataset.slot) + 1;
                    alert(`Пустой слот ${slotNumber}. Добавьте ${activeActionTab === 'attacks' ? 'атаку' : activeActionTab === 'spells' ? 'заклинание' : 'предмет'} через лист персонажа.`);
                    return;
                }

                // Предметы пока просто показываем
                if (actionBtn.dataset.type === 'item') {
                    alert(`Выбран предмет: ${actionBtn.dataset.name}`);
                    return;
                }

                // Проверяем, можно ли использовать действие
                const currentTurnCombatant = currentCombatState && currentCombatState.isActive 
                    ? currentCombatState.combatants[currentCombatState.turn] 
                    : null;
                const isMyTurn = currentTurnCombatant && currentTurnCombatant.characterId 
                    && currentTurnCombatant.characterId.toString() === activeCharacterId;

                if (!isMyTurn && !isGm) {
                    alert('Сейчас не ваш ход!');
                    return;
                }

                // Выбираем действие
                selectedCombatAction = { ...actionBtn.dataset };
                document.querySelectorAll('.hotbar-button.active').forEach(b => b.classList.remove('active'));
                actionBtn.classList.add('active');
                
                // Добавляем визуальную обратную связь
                actionBtn.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    actionBtn.style.transform = '';
                }, 150);
            }
        });
        addNpcBtn.addEventListener('click', () => { const name = npcNameInput.value.trim(); const initiative = parseInt(npcInitiativeInput.value, 10); const maxHp = parseInt(npcMaxHpInput.value, 10); const ac = parseInt(npcACInput.value, 10); if (name) { const { x, y } = screenToWorldCoords(mainCanvas.width / 2, mainCanvas.height / 2); socket.emit('combat:add_npc', { name, initiative: isNaN(initiative) ? null : initiative, maxHp: isNaN(maxHp) ? 10 : maxHp, ac: isNaN(ac) ? 10 : ac, worldMapX: x, worldMapY: y, }); npcNameInput.value = ''; npcInitiativeInput.value = ''; if (npcMaxHpInput) npcMaxHpInput.value = ''; if (npcACInput) npcACInput.value = ''; } });

        openSheetBtn.addEventListener('click', async () => {
            if (!activeCharacterId) {
                alert('Сначала загрузите персонажа!');
                return;
            }
            
            try {
                // Проверяем, нужно ли загружать HTML заново
                if (sheetContainer.children.length === 0 || !sheetContainer.querySelector('.cs-container')) {
                    const response = await fetch('character-sheet.html');
                    if (!response.ok) {
                        throw new Error('Не удалось загрузить файл character-sheet.html');
                    }
                    const sheetHTML = await response.text();
                    sheetContainer.innerHTML = sheetHTML;
                }
                
                // Всегда заполняем лист актуальными данными при открытии
                populateSheet(currentCharacterData);
                sheetModal.classList.remove('hidden');
            } catch (error) {
                console.error("Ошибка при открытии листа персонажа:", error);
            }
        });

        closeSheetBtn.addEventListener('click', () => { sheetModal.classList.add('hidden'); });
        sheetModal.addEventListener('click', (e) => { if (e.target === sheetModal) { sheetModal.classList.add('hidden'); } });

        sheetContainer.addEventListener('click', (e) => {
            if (isGm) return;
            // Старая логика добавления/удаления атак и снаряжения.
            // Она будет заменена/адаптирована для нового виджета.
            if (e.target.id === 'add-equipment-btn') {
                const nameInput = document.getElementById('new-item-name');
                const quantityInput = document.getElementById('new-item-quantity');
                const name = nameInput.value;
                const quantity = parseInt(quantityInput.value, 10);
                if (name && !isNaN(quantity) && quantity > 0) {
                    addEquipment({ name, quantity });
                    nameInput.value = '';
                    quantityInput.value = '1';
                }
            } else if (e.target.classList.contains('remove-equipment-btn')) {
                const index = e.target.closest('.equipment-item').dataset.index;
                removeEquipment(index);
            }
        });

        // --- ДОБАВЛЕНО: Логика для кастомного селекта ---
        if (characterSelectorTrigger) {
            characterSelectorTrigger.addEventListener('click', () => {
                characterSelectorWrapper.classList.toggle('open');
            });
        }

        if (characterSelectorOptions) {
            characterSelectorOptions.addEventListener('click', (e) => {
                if (e.target.classList.contains('custom-select-option')) {
                    const selectedOption = characterSelectorOptions.querySelector('.selected');
                    if (selectedOption) {
                        selectedOption.classList.remove('selected');
                    }
                    e.target.classList.add('selected');
                    
                    characterSelectorTrigger.querySelector('span').textContent = e.target.textContent;
                    characterSelectorWrapper.dataset.value = e.target.dataset.value;
                    characterSelectorWrapper.classList.remove('open');
                }
            });
        }
        
        // Закрытие списка при клике вне его
        window.addEventListener('click', (e) => {
            if (characterSelectorWrapper && !characterSelectorWrapper.contains(e.target)) {
                characterSelectorWrapper.classList.remove('open');
            }
        });
    }

    // --- ИСПРАВЛЕННЫЕ ОБРАБОТЧИКИ ДЛЯ КАРТЫ (ZOOM, PAN, CLICK) ---
    function setupMapEventListeners() {
        mainCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const scaleAmount = -e.deltaY * 0.001 * viewTransform.scale;
            const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewTransform.scale + scaleAmount));
            const mouseX = e.clientX - mainCanvas.getBoundingClientRect().left;
            const mouseY = e.clientY - mainCanvas.getBoundingClientRect().top;
            viewTransform.offsetX = mouseX - (mouseX - viewTransform.offsetX) * (newScale / viewTransform.scale);
            viewTransform.offsetY = mouseY - (mouseY - viewTransform.offsetY) * (newScale / viewTransform.scale);
            viewTransform.scale = newScale;
        });

        mainCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                isPanning = true;
                mainCanvas.classList.add('panning');
                lastMousePos = { x: e.clientX, y: e.clientY };
                mouseHasMoved = false;
            }
        });

        mainCanvas.addEventListener('mousemove', (e) => {
            const mouseX = e.clientX - mainCanvas.getBoundingClientRect().left;
            const mouseY = e.clientY - mainCanvas.getBoundingClientRect().top;
            
            if (isPanning) {
                mouseHasMoved = true;
                const dx = e.clientX - lastMousePos.x;
                const dy = e.clientY - lastMousePos.y;
                viewTransform.offsetX += dx;
                viewTransform.offsetY += dy;
                lastMousePos = { x: e.clientX, y: e.clientY };
            } else {
                hoveredObject = findObjectUnderMouse(mouseX, mouseY);
                mainCanvas.classList.toggle('pannable', !hoveredObject);
                
                // Обновляем позицию предпросмотра для перемещения токена
                if (selectedCharacterForMove) {
                    const worldCoords = screenToWorldCoords(mouseX, mouseY);
                    mousePreviewPosition = worldCoords;
                } else {
                    mousePreviewPosition = null;
                }
            }
        });

        mainCanvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                isPanning = false;
                mainCanvas.classList.remove('panning');

                if (!mouseHasMoved) {
                    const mouseX = e.clientX - mainCanvas.getBoundingClientRect().left;
                    const mouseY = e.clientY - mainCanvas.getBoundingClientRect().top;
                    const clickedObject = findObjectUnderMouse(mouseX, mouseY);
                    const isMyTurn = currentCombatState?.isActive && currentCombatState.combatants[currentCombatState.turn]?.characterId?.toString() === activeCharacterId;

                    if (selectedCombatAction && clickedObject && (isGm || isMyTurn)) {
                        handleCombatAction(selectedCombatAction, clickedObject);
                        selectedCombatAction = null;
                        document.querySelectorAll('.hotbar-button.active').forEach(b => b.classList.remove('active'));
                        return;
                    }

                    if (clickedObject) {
                        const isMyCharacter = clickedObject._id === activeCharacterId;
                        if (selectedCharacterForMove === clickedObject._id) {
                            selectedCharacterForMove = null;
                            mousePreviewPosition = null;
                        } else if (isMyCharacter || isGm) {
                            selectedCharacterForMove = clickedObject._id;
                        } else if (currentCombatState && currentCombatState.isActive && (isGm || isMyTurn)) {
                            const combatantId = currentCombatState.combatants.find(c => (c.characterId?.toString() || c._id.toString()) === clickedObject._id)?._id.toString();
                            if (combatantId) socket.emit('combat:set_target', { targetId: combatantId });
                        }
                    } else if (selectedCharacterForMove) {
                        const worldCoords = screenToWorldCoords(mouseX, mouseY);
                        const charToMove = worldMapState.characters.find(c => c._id === selectedCharacterForMove);
                        if (charToMove) {
                            // Вместо прямой отправки на сервер, задаем цель для анимации
                            animateTokenTo(charToMove, worldCoords.x, worldCoords.y);
                        }
                        selectedCharacterForMove = null;
                        mousePreviewPosition = null;
                    }
                }
            }
        });

        mainCanvas.addEventListener('mouseleave', () => {
            isPanning = false;
            mainCanvas.classList.remove('panning');
            mousePreviewPosition = null;
        });
    }

    function setupDiceRoller() {
        const diceRollerPanel = document.getElementById('dice-roller-panel');
        if (diceRollerPanel) {
            const diceButtons = diceRollerPanel.querySelector('#dice-buttons');
            const rollBtn = diceRollerPanel.querySelector('#roll-dice-btn');
            const manualInput = diceRollerPanel.querySelector('#manual-roll-input');
            let selectedDice = null;
            diceButtons.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const currentActive = diceButtons.querySelector('.active');
                    if (currentActive) currentActive.classList.remove('active');
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
                    if (value) {
                        sendLogMessage(`вручную вводит результат: ${value}`);
                        manualInput.value = '';
                    }
                }
            });
        }
    }

    // Новая функция для плавной анимации
    function animateTokenTo(token, targetX, targetY) {
        const duration = 800; // возвращаем нормальную длительность
        const startX = token.worldMapX;
        const startY = token.worldMapY;
        const distanceX = targetX - startX;
        const distanceY = targetY - startY;
        let startTime = null;
        
        // Отмечаем токен как анимирующийся
        animatingTokens.add(token._id);

        // Функция easing для более плавной анимации
        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function animationStep(currentTime) {
            if (!startTime) {
                startTime = currentTime;
            }
            
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const easedProgress = easeInOutCubic(progress);

            token.worldMapX = startX + distanceX * easedProgress;
            token.worldMapY = startY + distanceY * easedProgress;

            if (progress < 1) {
                requestAnimationFrame(animationStep);
            } else {
                // Как только анимация завершена, отправляем финальные координаты на сервер
                token.worldMapX = targetX;
                token.worldMapY = targetY;
                
                // Убираем токен из списка анимирующихся
                animatingTokens.delete(token._id);
                
                socket.emit('worldmap:character:move', { charId: token._id, x: targetX, y: targetY });
            }
        }
        requestAnimationFrame(animationStep);
    }

    // --- Запуск ---
    setupAuthEventListeners();
    checkAuthState();
});