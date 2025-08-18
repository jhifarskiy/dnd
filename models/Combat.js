const mongoose = require('mongoose');

// Схема для отдельного участника боя
const combatantSchema = new mongoose.Schema({
    characterId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Character' 
    },
    name: { 
        type: String, 
        required: true 
    },
    initiative: { 
        type: Number, 
        default: null 
    },
    isPlayer: { 
        type: Boolean, 
        default: true 
    },
    targetId: {
        type: String,
        default: null
    },
    targetName: {
        type: String,
        default: null
    },
    // ИЗМЕНЕНО: Координаты теперь для глобальной карты
    worldMapX: {
        type: Number,
        default: 0
    },
    worldMapY: {
        type: Number,
        default: 0
    },
    // ПАРАМЕТРЫ ЗДОРОВЬЯ
    maxHp: {
        type: Number,
        default: 10
    },
    currentHp: {
        type: Number,
        default: 10
    },
    tempHp: {
        type: Number,
        default: 0
    },
    // КЛАСС БРОНИ
    ac: {
        type: Number,
        default: 10
    }
}, { _id: true });

const combatSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        default: 'main_combat' 
    },
    isActive: { 
        type: Boolean, 
        default: false 
    },
    round: { 
        type: Number, 
        default: 1 
    },
    turn: { 
        type: Number, 
        default: 0 
    },
    combatants: [combatantSchema],
});

module.exports = mongoose.model('Combat', combatSchema);