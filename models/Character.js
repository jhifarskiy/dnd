const mongoose = require('mongoose');

// Вложенные схемы для повторяющихся данных
const EquipmentSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    quantity: { type: Number, default: 1 }
}, { _id: false });

const AttackSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    bonus: { type: String, default: '' },
    damage: { type: String, default: '' },
    damageType: { type: String, default: '' }
}, { _id: false });

const SpellSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    level: { type: String, default: '' },
    attackBonus: { type: String, default: '' },
    damage: { type: String, default: '' },
    damageType: { type: String, default: '' },
    description: { type: String, default: '' }
}, { _id: false });

// Новая вложенная схема для денег
const MoneySchema = new mongoose.Schema({
    cp: { type: Number, default: 0 },
    sp: { type: Number, default: 0 },
    ep: { type: Number, default: 0 },
    gp: { type: Number, default: 0 },
    pp: { type: Number, default: 0 }
}, { _id: false });

// Новая вложенная схема для спасбросков от смерти
const DeathSavesSchema = new mongoose.Schema({
    successes: { type: Number, default: 0, min: 0, max: 3 },
    failures: { type: Number, default: 0, min: 0, max: 3 }
}, { _id: false });


const CharacterSchema = new mongoose.Schema({
    // --- Основная информация ---
    name: { type: String, default: 'Новый персонаж' },
    classLevel: { type: String, default: '' },
    background: { type: String, default: '' },
    playerName: { type: String, default: '' },
    race: { type: String, default: '' },
    alignment: { type: String, default: '' },
    experience: { type: Number, default: 0 },
    
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // --- Характеристики ---
    strength: { type: Number, default: 10 },
    dexterity: { type: Number, default: 10 },
    constitution: { type: Number, default: 10 },
    intelligence: { type: Number, default: 10 },
    wisdom: { type: Number, default: 10 },
    charisma: { type: Number, default: 10 },

    // --- Боевые параметры ---
    proficiencyBonus: { type: Number, default: 2 },
    inspiration: { type: Number, default: 0 },
    ac: { type: Number, default: 10 },
    speed: { type: String, default: '30' },
    maxHp: { type: Number, default: 10 },
    currentHp: { type: Number, default: 10 },
    tempHp: { type: Number, default: 0 },
    hitDice: { type: String, default: '' },
    deathSaves: { type: DeathSavesSchema, default: () => ({}) },
    
    // --- Владение спасбросками ---
    strengthSaveProficient: { type: Boolean, default: false },
    dexteritySaveProficient: { type: Boolean, default: false },
    constitutionSaveProficient: { type: Boolean, default: false },
    intelligenceSaveProficient: { type: Boolean, default: false },
    wisdomSaveProficient: { type: Boolean, default: false },
    charismaSaveProficient: { type: Boolean, default: false },

    // --- Владение навыками ---
    acrobaticsProficient: { type: Boolean, default: false },
    animalHandlingProficient: { type: Boolean, default: false },
    arcanaProficient: { type: Boolean, default: false },
    athleticsProficient: { type: Boolean, default: false },
    deceptionProficient: { type: Boolean, default: false },
    historyProficient: { type: Boolean, default: false },
    insightProficient: { type: Boolean, default: false },
    intimidationProficient: { type: Boolean, default: false },
    investigationProficient: { type: Boolean, default: false },
    medicineProficient: { type: Boolean, default: false },
    natureProficient: { type: Boolean, default: false },
    perceptionProficient: { type: Boolean, default: false },
    performanceProficient: { type: Boolean, default: false },
    persuasionProficient: { type: Boolean, default: false },
    religionProficient: { type: Boolean, default: false },
    sleightOfHandProficient: { type: Boolean, default: false },
    stealthProficient: { type: Boolean, default: false },
    survivalProficient: { type: Boolean, default: false },

    // --- Описание и инвентарь (текстовые поля) ---
    personalityTraits: { type: String, default: '' },
    ideals: { type: String, default: '' },
    bonds: { type: String, default: '' },
    flaws: { type: String, default: '' },
    features: { type: String, default: '' },
    proficienciesAndLanguages: { type: String, default: '' },
    
    // --- Снаряжение и Деньги ---
    // ИЗМЕНЕНИЕ: equipment теперь одно большое текстовое поле
    equipmentText: { type: String, default: '' },
    // ИЗМЕНЕНИЕ: equipmentList для структурированных предметов, которые могут понадобиться для Action Bar
    equipmentList: [EquipmentSchema],
    money: { type: MoneySchema, default: () => ({}) },
    
    // --- Атаки и Заклинания ---
    // ИЗМЕНЕНИЕ: Добавлено текстовое поле для описания атак в свободной форме
    attacksAndSpellsText: { type: String, default: '' },
    attacks: [AttackSchema],
    spells: [SpellSchema],

    // --- Позиция на глобальной карте ---
    worldMapX: { type: Number, default: 500 },
    worldMapY: { type: Number, default: 500 }
});


const Character = mongoose.model('Character', CharacterSchema);
module.exports = Character;