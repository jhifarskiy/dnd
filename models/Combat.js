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
    // === НОВЫЕ ПОЛЯ ===
    targetId: {
        type: String, // Храним как строку, т.к. это будет _id другого участника боя
        default: null
    },
    targetName: {
        type: String,
        default: null
    }
}, { _id: true }); // _id нужен для уникальной идентификации каждого участника в бою

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