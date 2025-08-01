const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require("socket.io");
const { DiceRoll } = require('rpg-dice-roller');
require('dotenv').config();

const Character = require('./models/Character');
const MapData = require('./models/MapData');
const Combat = require('./models/Combat');
const User = require('./models/User');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const authMiddleware = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }
    try {
        const token = req.headers.authorization.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: "Нет авторизации: Токен не предоставлен." });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        console.error("Ошибка авторизации:", e.message);
        return res.status(401).json({ message: "Нет авторизации: Недействительный или просроченный токен." });
    }
};

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Необходимо указать имя пользователя и пароль." });
        }
        const lowercasedUsername = username.toLowerCase();
        const existingUser = await User.findOne({ username: lowercasedUsername });
        if (existingUser) {
            return res.status(400).json({ message: "Пользователь с таким именем уже существует." });
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = new User({ username: lowercasedUsername, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: "Пользователь успешно зарегистрирован." });
    } catch (error) {
        console.error("Ошибка при регистрации:", error);
        res.status(500).json({ message: "Что-то пошло не так при регистрации, попробуйте снова." });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Необходимо указать имя пользователя и пароль." });
        }
        const lowercasedUsername = username.toLowerCase();
        const user = await User.findOne({ username: lowercasedUsername });
        if (!user) {
            return res.status(400).json({ message: "Пользователь не найден." });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Неверный пароль." });
        }
        const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, userId: user.id, username: user.username });
    } catch (error) {
        console.error("Ошибка при входе:", error);
        res.status(500).json({ message: "Что-то пошло не так при входе, попробуйте снова." });
    }
});

const FIXED_MAP_ID = "main_map";
app.get('/api/map', async (req, res) => {
    try {
        let map = await MapData.findById(FIXED_MAP_ID);
        if (!map) {
            console.log("Карта не найдена в БД, создаем новую.");
            map = new MapData({ _id: FIXED_MAP_ID });
            await map.save();
        }
        res.json(map);
    } catch (error) {
        console.error("Ошибка при получении данных карты:", error);
        res.status(500).json({ message: "Ошибка при получении данных карты." });
    }
});

app.post('/api/map', async (req, res) => {
    try {
        await MapData.findByIdAndUpdate(FIXED_MAP_ID, req.body, { new: true, upsert: true });
        res.status(200).json({ message: "Данные карты успешно сохранены!" });
    } catch (error) {
        console.error("Ошибка при сохранении данных карты:", error);
        res.status(500).json({ message: "Ошибка при сохранении данных карты." });
    }
});

app.get('/api/characters', authMiddleware, async (req, res) => {
    try {
        const characters = await Character.find({ owner: req.user.userId }, '_id name');
        res.json(characters);
    } catch (error) {
        console.error("Ошибка при получении списка персонажей:", error);
        res.status(500).json({ message: "Ошибка при получении списка персонажей." });
    }
});

app.post('/api/characters', authMiddleware, async (req, res) => {
    try {
        const newCharacter = new Character({ owner: req.user.userId });
        await newCharacter.save();
        res.status(201).json(newCharacter);
    } catch (error) {
        console.error("Ошибка при создании персонажа:", error);
        res.status(500).json({ message: "Ошибка при создании персонажа." });
    }
});

app.get('/api/characters/:id', authMiddleware, async (req, res) => {
    try {
        const character = await Character.findOne({ _id: req.params.id, owner: req.user.userId });
        if (!character) {
            return res.status(404).json({ message: "Персонаж не найден или доступ запрещен." });
        }
        res.json(character);
    } catch (error) {
        console.error("Ошибка при получении данных персонажа:", error);
        res.status(500).json({ message: "Ошибка при получении данных персонажа." });
    }
});

app.get('/api/characters/public/:id', authMiddleware, async (req, res) => {
    try {
        const character = await Character.findById(req.params.id);
        if (!character) {
            return res.status(404).json({ message: "Персонаж не найден." });
        }
        res.json(character);
    } catch (error) {
        console.error("Ошибка при получении публичных данных персонажа:", error);
        res.status(500).json({ message: "Ошибка при получении публичных данных персонажа." });
    }
});

app.put('/api/characters/:id', authMiddleware, async (req, res) => {
    try {
        delete req.body.owner;
        const character = await Character.findOneAndUpdate(
            { _id: req.params.id, owner: req.user.userId },
            req.body,
            { new: true }
        );
        if (!character) {
            return res.status(404).json({ message: "Персонаж не найден или доступ запрещен." });
        }

        const charIndex = activeCharacters.findIndex(c => c._id.toString() === character._id.toString());
        if (charIndex !== -1) {
            activeCharacters[charIndex].name = character.name;
            activeCharacters[charIndex].mapX = character.mapX;
            activeCharacters[charIndex].mapY = character.mapY;
            io.emit('map:update', activeCharacters);
        }

        res.json(character);
    } catch (error) {
        console.error("Ошибка при обновлении персонажа:", error);
        res.status(500).json({ message: "Ошибка при обновлении персонажа." });
    }
});

app.delete('/api/characters/:id', authMiddleware, async (req, res) => {
    try {
        const character = await Character.findOneAndDelete({ _id: req.params.id, owner: req.user.userId });
        if (!character) {
            return res.status(404).json({ message: "Персонаж не найден или доступ запрещен." });
        }

        activeCharacters = activeCharacters.filter(c => c._id.toString() !== req.params.id);
        io.emit('map:update', activeCharacters);

        res.json({ message: "Персонаж успешно удален." });
    } catch (error) {
        console.error("Ошибка при удалении персонажа:", error);
        res.status(500).json({ message: "Ошибка при удалении персонажа." });
    }
});

app.put('/api/combat/roll-initiative', authMiddleware, async (req, res) => {
    try {
        if (!combatState || !combatState.isActive) {
            return res.status(400).json({ message: "Бой не активен." });
        }

        const { combatants } = combatState;
        if (!combatants || combatants.length === 0) {
            return res.status(400).json({ message: "В бою нет участников." });
        }

        const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;

        const updatedCombatantsPromises = combatants.map(async (combatant) => {
            if (combatant.initiative !== null) return combatant; // Не перебрасываем тем, у кого уже есть

            const initiativeRoll = rollDie(20);
            let modifier = 0;

            if (combatant.isPlayer && combatant.characterId) {
                try {
                    const character = await Character.findById(combatant.characterId);
                    if (character) {
                        modifier = Math.floor((character.dexterity - 10) / 2);
                    }
                } catch (e) {
                     console.error(`Не удалось найти персонажа ${combatant.characterId} для броска инициативы`, e);
                }
            }
            
            combatant.initiative = initiativeRoll + modifier;
            return combatant;
        });

        const updatedCombatants = await Promise.all(updatedCombatantsPromises);

        updatedCombatants.sort((a, b) => (b.initiative || -1) - (a.initiative || -1));
        
        combatState.combatants = updatedCombatants;
        
        await combatState.save(); 

        io.emit('combat:update', combatState);

        res.status(200).json(combatState); 

    } catch (error) {
        console.error("Ошибка при броске инициативы:", error);
        res.status(500).json({ message: "Внутренняя ошибка сервера при броске инициативы." });
    }
});

app.use(express.static('frontend'));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let activeCharacters = [];
let combatState = null;

async function loadInitialState() {
    try {
        combatState = await Combat.findById('main_combat');
        if (!combatState) {
            console.log("Состояние боя не найдено в БД, создаем новое по умолчанию.");
            combatState = new Combat({ _id: 'main_combat' });
            await combatState.save();
        }
    } catch (e) {
        console.error("Не удалось загрузить состояние боя из БД при запуске:", e);
        process.exit(1);
    }
}

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("Успешное подключение к MongoDB!");
        loadInitialState().then(() => {
            server.listen(port, () => {
                console.log(`Node.js backend запущен на http://localhost:${port}`);
            });
        });
    })
    .catch(err => {
        console.error("Ошибка подключения к MongoDB:", err);
        process.exit(1);
    });

io.on('connection', (socket) => {
    console.log(`Пользователь подключен: ${socket.id}`);

    socket.isGm = false;
    socket.characterId = null;

    socket.emit('map:update', activeCharacters);
    socket.emit('combat:update', combatState);

    socket.on('user:identify', ({ username }) => {
        socket.username = username;
        if (username.toLowerCase() === 'gm') {
            socket.isGm = true;
            console.log(`Пользователь ${username} (${socket.id}) идентифицирован как ГМ.`);
        } else {
            console.log(`Пользователь ${username} (${socket.id}) идентифицирован как игрок.`);
        }
    });

    socket.on('character:join', (charData) => {
        socket.characterId = charData._id.toString();
        const existingCharIndex = activeCharacters.findIndex(c => c._id.toString() === charData._id.toString());
        if (existingCharIndex === -1) {
            activeCharacters.push(charData);
        } else {
            activeCharacters[existingCharIndex] = charData;
        }
        io.emit('map:update', activeCharacters);
    });

    socket.on('character:move', async (moveData) => {
        const charIndex = activeCharacters.findIndex(c => c._id.toString() === moveData._id.toString());
        if (charIndex !== -1) {
            activeCharacters[charIndex].mapX = moveData.mapX;
            activeCharacters[charIndex].mapY = moveData.mapY;
            if (moveData.name) {
                activeCharacters[charIndex].name = moveData.name;
            }
            try {
                await Character.findByIdAndUpdate(moveData._id, { mapX: moveData.mapX, mapY: moveData.mapY, name: moveData.name });
            } catch (e) {
                console.error("Не удалось сохранить данные перемещения персонажа в БД:", e);
            }
            io.emit('map:update', activeCharacters);
        }
    });

    socket.on('map:get', () => {
        socket.emit('map:update', activeCharacters);
    });

    socket.on('disconnect', () => {
        if (socket.characterId) {
            activeCharacters = activeCharacters.filter(c => c._id.toString() !== socket.characterId);
            io.emit('map:update', activeCharacters);
        }
        console.log(`Пользователь отключен: ${socket.id}`);
    });

    socket.on('log:send', (messageData) => {
        const commandMatch = messageData.text.match(/^\/(r|roll)\s+(.*)/);
        if (commandMatch) {
            const notation = commandMatch[2];
            try {
                const roll = new DiceRoll(notation);
                messageData.text = `бросает ${roll.notation}: ${roll.output}`;
                io.emit('log:new_message', messageData);
            } catch (e) {
                messageData.text = `не смог бросить "${notation}" (ошибка в формуле)`;
                io.emit('log:new_message', messageData);
            }
        } else {
            io.emit('log:new_message', messageData);
        }
    });

    socket.on('combat:start', async () => {
        if (!socket.isGm) return;
        if (combatState && !combatState.isActive) {
            combatState.isActive = true;
            combatState.round = 1;
            combatState.turn = 0;
            combatState.combatants = activeCharacters.map(char => ({
                characterId: char._id,
                name: char.name,
                initiative: null,
                isPlayer: true,
                mapX: char.mapX,
                mapY: char.mapY,
            }));
            await combatState.save();
            io.emit('combat:update', combatState);
        }
    });

    socket.on('combat:end', async () => {
        if (!socket.isGm) return;
        if (combatState && combatState.isActive) {
            combatState.isActive = false;
            combatState.combatants = [];
            combatState.round = 1;
            combatState.turn = 0;
            await combatState.save();
            io.emit('combat:update', combatState);
        }
    });

    socket.on('combat:set_initiative', async ({ combatantId, initiative }) => {
        if (combatState && combatState.isActive) {
            const combatant = combatState.combatants.find(c => c._id.toString() === combatantId);
            if (combatant) {
                combatant.initiative = initiative;
                combatState.combatants.sort((a, b) => (b.initiative || -1) - (a.initiative || -1));
                await combatState.save();
                io.emit('combat:update', combatState);
            }
        }
    });

    socket.on('combat:next_turn', async () => {
        if (!socket.isGm) return;
        if (combatState && combatState.isActive && combatState.combatants.length > 0) {
            const currentCombatant = combatState.combatants[combatState.turn];
            if(currentCombatant) {
                currentCombatant.targetId = null;
                currentCombatant.targetName = null;
            }

            combatState.turn++;
            if (combatState.turn >= combatState.combatants.length) {
                combatState.turn = 0;
                combatState.round++;
            }
            
            combatState.markModified('combatants');
            await combatState.save();
            io.emit('combat:update', combatState);
        }
    });

    socket.on('combat:add_npc', async ({ name, initiative }) => {
        if (!socket.isGm) return;
        if (combatState && combatState.isActive) {
            combatState.combatants.push({ name, initiative: isNaN(initiative) ? null : initiative, isPlayer: false, mapX: 100, mapY: 100 });
            combatState.combatants.sort((a, b) => (b.initiative || -1) - (a.initiative || -1));
            await combatState.save();
            io.emit('combat:update', combatState);
        }
    });

    socket.on('combat:remove_combatant', async (combatantId) => {
        if (!socket.isGm) return;
        if (combatState && combatState.isActive) {
            const combatantIndex = combatState.combatants.findIndex(c => c._id.toString() === combatantId);
            if(combatantIndex === -1) return;
            
            if (combatantIndex < combatState.turn) {
                combatState.turn--;
            }

            combatState.combatants.splice(combatantIndex, 1);
            
            if (combatState.combatants.length > 0 && combatState.turn >= combatState.combatants.length) {
                combatState.turn = 0; 
            } else if (combatState.combatants.length === 0) {
                combatState.turn = 0;
            }
            
            await combatState.save();
            io.emit('combat:update', combatState);
        }
    });

    socket.on('combat:get', () => {
        socket.emit('combat:update', combatState);
    });

    socket.on('combat:set_target', async ({ targetId }) => {
        if (!combatState || !combatState.isActive) return;

        const currentTurnCombatant = combatState.combatants[combatState.turn];
        if (!currentTurnCombatant) return;
        
        const isMyTurn = currentTurnCombatant.characterId === socket.characterId;
        if (!socket.isGm && !isMyTurn) return;

        if (currentTurnCombatant.targetId === targetId) {
            currentTurnCombatant.targetId = null;
            currentTurnCombatant.targetName = null;
        } else {
            const targetCombatant = combatState.combatants.find(c => c._id.toString() === targetId);
            if (targetCombatant) {
                currentTurnCombatant.targetId = targetId;
                currentTurnCombatant.targetName = targetCombatant.name;
            }
        }

        combatState.markModified('combatants');
        await combatState.save();
        io.emit('combat:update', combatState);
    });
});