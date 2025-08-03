const mongoose = require('mongoose');

// Вложенные схемы для повторяющихся данных
const EquipmentSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    description: { type: String, default: '' }
}, { _id: false });

// НОВЫЕ СХЕМЫ ДЛЯ АТАК И ЗАКЛИНАНИЙ
const AttackSchema = new mongoose.Schema({
    name: { type: String, required: true },
    bonus: { type: String, default: '+0' },
    damage: { type: String, required: true },
    damageType: { type: String, default: '' }
}, { _id: false });

const SpellSchema = new mongoose.Schema({
    name: { type: String, required: true },
    level: { type: String, default: 'Заговор' },
    attackBonus: { type: String, default: '+0' },
    damage: { type: String, default: '' },
    damageType: { type: String, default: '' },
    description: { type: String, default: '' }
}, { _id: false });

const CharacterSchema = new mongoose.Schema({
    // --- Основная информация ---
    name: { type: String, default: 'Либериус' },
    classLevel: { type: String, default: 'Волшебник 1' },
    background: { type: String, default: 'Магорождённый' },
    playerName: { type: String, default: 'Лев Жифарский' },
    race: { type: String, default: 'Полуэльф' },
    alignment: { type: String, default: 'Нейтрально-добрый' },
    experience: { type: Number, default: 0 },
    
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // --- Характеристики ---
    strength: { type: Number, default: 10 },
    dexterity: { type: Number, default: 16 },
    constitution: { type: Number, default: 14 },
    intelligence: { type: Number, default: 18 },
    wisdom: { type: Number, default: 12 },
    charisma: { type: Number, default: 12 },

    // --- Боевые параметры ---
    proficiencyBonus: { type: Number, default: 2 },
    inspiration: { type: Number, default: 0 },
    ac: { type: Number, default: 13 },
    speed: { type: String, default: '30 футов' },
    maxHp: { type: Number, default: 8 },
    currentHp: { type: Number, default: 8 },
    tempHp: { type: Number, default: 0 },
    hitDice: { type: String, default: '1к6' },
    
    // --- Владение спасбросками ---
    strengthSaveProficient: { type: Boolean, default: false },
    dexteritySaveProficient: { type: Boolean, default: false },
    constitutionSaveProficient: { type: Boolean, default: true },
    intelligenceSaveProficient: { type: Boolean, default: true },
    wisdomSaveProficient: { type: Boolean, default: false },
    charismaSaveProficient: { type: Boolean, default: false },

    // --- Владение навыками ---
    acrobaticsProficient: { type: Boolean, default: false },
    animalHandlingProficient: { type: Boolean, default: false },
    arcanaProficient: { type: Boolean, default: true },
    athleticsProficient: { type: Boolean, default: false },
    deceptionProficient: { type: Boolean, default: true },
    historyProficient: { type: Boolean, default: true },
    insightProficient: { type: Boolean, default: false },
    intimidationProficient: { type: Boolean, default: false },
    investigationProficient: { type: Boolean, default: false },
    medicineProficient: { type: Boolean, default: false },
    natureProficient: { type: Boolean, default: false },
    perceptionProficient: { type: Boolean, default: false },
    performanceProficient: { type: Boolean, default: false },
    persuasionProficient: { type: Boolean, default: true },
    religionProficient: { type: Boolean, default: false },
    sleightOfHandProficient: { type: Boolean, default: false },
    stealthProficient: { type: Boolean, default: false },
    survivalProficient: { type: Boolean, default: false },

    // --- Описание и инвентарь (текстовые поля) ---
    personalityTraits: { type: String, default: 'Я использую заумные слова, чтобы казаться умнее.' },
    ideals: { type: String, default: 'Знания. Путь к самосовершенствованию и могуществу лежит через познание (Нейтральное).' },
    bonds: { type: String, default: 'Я работаю над великой теорией и отчаянно ищу данные для её доказательства.' },
    flaws: { type: String, default: 'Большую часть времени я провожу в своих мыслях, не обращая внимания на своё окружение.' },
    
    features: { type: String, default: 'Наследие фей (преимущество на спасброски от очарования, иммунитет к усыплению).\nМагическое восстановление.\nРитуальное колдовство.' },
    proficienciesAndLanguages: { type: String, default: 'Владение: Кинжалы, дротики, пращи, боевые посохи, лёгкие арбалеты.\nЯзыки: Общий, Эльфийский, Драконий, Гномий.' },
    
    // --- Снаряжение (пока как одно текстовое поле для простоты) ---
    equipment: { type: String, default: 'Боевой посох\nКнига заклинаний\nНабор учёного\nФокусирующая призма' },
    
    // НОВЫЕ ПОЛЯ ДЛЯ АТАК И ЗАКЛИНАНИЙ
    attacks: [AttackSchema],
    spells: [SpellSchema],

    // --- Позиция на карте ---
    mapX: { type: Number, default: 400 },
    mapY: { type: Number, default: 300 }
});

const Character = mongoose.model('Character', CharacterSchema);
module.exports = Character;