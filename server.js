const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require("socket.io");
const { DiceRoll } = require('rpg-dice-roller');
require('dotenv').config();

const Character = require('./models/Character');
const Combat = require('./models/Combat');
const User = require('./models/User');
const WorldMap = require('./models/WorldMap');

const app = express();
const port = process.env.PORT || 8080;

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
        req.user.isGm = decoded.username.toLowerCase() === 'gm';
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

app.get('/api/worldmap', authMiddleware, async (req, res) => {
    try {
        let map = await WorldMap.findById('main_world_map');
        if (!map) {
            map = new WorldMap({ _id: 'main_world_map' });
            await map.save();
        }
        const characters = await Character.find({}, '_id name worldMapX worldMapY isPlayer');
        res.json({
            mapData: map,
            characters: characters
        });
    } catch (error) {
        console.error("Ошибка при получении данных глобальной карты:", error);
        res.status(500).json({ message: "Ошибка при получении данных глобальной карты." });
    }
});

app.post('/api/worldmap', authMiddleware, async (req, res) => {
    try {
        if (!req.user.isGm) {
            return res.status(403).json({ message: "Доступ запрещен." });
        }
        await WorldMap.findByIdAndUpdate('main_world_map', req.body, { new: true, upsert: true });
        io.emit('worldmap:url_update', req.body.backgroundUrl);
        res.status(200).json({ message: "Глобальная карта успешно сохранена!" });
    } catch (error) {
        console.error("Ошибка при сохранении глобальной карты:", error);
        res.status(500).json({ message: "Ошибка при сохранении глобальной карты." });
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
        const newCharacter = new Character({ owner: req.user.userId, name: 'Новый персонаж', isPlayer: true });
        await newCharacter.save();
        const updatedCharacters = await Character.find({}, '_id name worldMapX worldMapY isPlayer');
        io.emit('worldmap:update', updatedCharacters);
        res.status(201).json(newCharacter);
    } catch (error) {
        console.error("Ошибка при создании персонажа:", error);
        res.status(500).json({ message: "Ошибка при создании персонажа." });
    }
});

app.get('/api/characters/all', authMiddleware, async (req, res) => {
    try {
        const characters = await Character.find({}, '_id name');
        res.json(characters);
    } catch (error) {
        console.error("Ошибка при получении списка всех персонажей:", error);
        res.status(500).json({ message: "Ошибка при получении списка всех персонажей." });
    }
});

app.get('/api/characters/:id', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: "Персонаж не найден." });
        }
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
        const updatedCharacters = await Character.find({}, '_id name worldMapX worldMapY isPlayer');
        io.emit('worldmap:update', updatedCharacters);
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
            if (combatant.initiative !== null) return combatant;
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
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'frontend', 'index.html')); });

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });

let combatState = null;

async function loadInitialState() {
    try {
        combatState = await Combat.findById('main_combat');
        if (!combatState) {
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
            httpServer.listen(port, () => {
                console.log(`Node.js backend запущен на http://localhost:${port}`);
            });
        });
    })
    .catch(err => {
        console.error("Ошибка подключения к MongoDB:", err);
        process.exit(1);
    });

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error('Authentication error'));
        }
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        socket.isGm = decoded.username.toLowerCase() === 'gm';
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`Пользователь подключен: ${socket.id} (${socket.username})`);
    socket.characterId = null;
    socket.emit('combat:update', combatState);

    socket.on('character:join', (charData) => {
        socket.characterId = charData._id.toString();
    });

    socket.on('worldmap:character:move', async ({ charId, x, y }) => {
        try {
            const character = await Character.findById(charId);
            if (!character) return;
            if (character.owner.toString() !== socket.userId && !socket.isGm) {
                return;
            }
            await Character.findByIdAndUpdate(charId, { worldMapX: x, worldMapY: y });
            if (combatState && combatState.isActive) {
                const combatant = combatState.combatants.find(c => c.characterId && c.characterId.toString() === charId);
                if (combatant) {
                    combatant.worldMapX = x;
                    combatant.worldMapY = y;
                    combatState.markModified('combatants');
                    await combatState.save();
                    io.emit('combat:update', combatState);
                }
            }
            const updatedCharacters = await Character.find({}, '_id name worldMapX worldMapY isPlayer');
            io.emit('worldmap:update', updatedCharacters);
        } catch(e) {
            console.error("Ошибка при перемещении по глобальной карте:", e);
        }
    });

    socket.on('disconnect', () => {
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
            
            const connectedSockets = Array.from(io.sockets.sockets.values());
            const activePlayerCharIds = connectedSockets
                .map(s => s.characterId)
                .filter(id => id);

            const activePlayerCharacters = await Character.find({ _id: { $in: activePlayerCharIds } });

            combatState.combatants = activePlayerCharacters.map(char => ({
                characterId: char._id,
                name: char.name,
                initiative: null,
                isPlayer: true,
                worldMapX: char.worldMapX,
                worldMapY: char.worldMapY,
                maxHp: char.maxHp,
                currentHp: char.currentHp,
                tempHp: char.tempHp,
                ac: char.ac
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

    socket.on('combat:add_npc', async ({ name, initiative, maxHp, ac, worldMapX, worldMapY }) => {
        if (!socket.isGm) return;
        if (combatState && combatState.isActive) {
            const newNpcData = {
                name,
                initiative: isNaN(initiative) ? null : initiative,
                isPlayer: false,
                worldMapX: worldMapX,
                worldMapY: worldMapY,
                maxHp: maxHp || 10,
                currentHp: maxHp || 10,
                ac: ac || 10,
            };
            combatState.combatants.push(newNpcData);
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
            combatState.markModified('combatants');
            await combatState.save();
            io.emit('combat:update', combatState);
        }
    });

    socket.on('combat:get', () => {
        socket.emit('combat:update', combatState);
    });

    socket.on('combat:set_target', async ({ targetId }) => {
        if (!socket.isGm && !(currentCombatState && currentCombatState.isActive && currentCombatState.combatants[currentCombatState.turn]?.characterId?.toString() === socket.characterId)) return;
    
        const currentTurnCombatant = currentCombatState.combatants[currentCombatState.turn];
        if (!currentTurnCombatant) return;
    
        if (currentTurnCombatant.targetId === targetId) {
            currentTurnCombatant.targetId = null;
            currentTurnCombatant.targetName = null;
        } else {
            const targetIdToFind = currentCombatState.combatants.find(c => (c.characterId || c._id).toString() === targetId);
            if (targetIdToFind) {
                currentTurnCombatant.targetId = (targetIdToFind.characterId || targetIdToFind._id).toString();
                currentTurnCombatant.targetName = targetIdToFind.name;
            }
        }
        combatState.markModified('combatants');
        await combatState.save();
        io.emit('combat:update', combatState);
    });

    socket.on('combat:update_hp', async ({ combatantId, newHp }) => {
        if (!socket.isGm) return;
        if (!combatState || !combatState.isActive) return;
        const combatant = combatState.combatants.find(c => c._id.toString() === combatantId);
        if (combatant) {
            combatant.currentHp = newHp;
            combatState.markModified('combatants');
            await combatState.save();
            io.emit('combat:update', combatState);
        }
    });
});