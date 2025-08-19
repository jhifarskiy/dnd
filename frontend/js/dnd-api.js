// API для получения данных D&D 5e
class DnDAPI {
    constructor() {
        this.baseURL = 'https://www.dnd5eapi.co/api';
        this.cache = new Map();
    }

    // Получить заклинание по индексу
    async getSpell(index) {
        const cacheKey = `spell_${index}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.baseURL}/spells/${index}`);
            if (!response.ok) throw new Error('Spell not found');
            
            const spell = await response.json();
            this.cache.set(cacheKey, spell);
            return spell;
        } catch (error) {
            console.warn(`Не удалось получить заклинание ${index}:`, error);
            return null;
        }
    }

    // Поиск заклинания по имени (приблизительный)
    async searchSpell(name) {
        try {
            const response = await fetch(`${this.baseURL}/spells`);
            const data = await response.json();
            
            const found = data.results.find(spell => 
                spell.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(spell.name.toLowerCase())
            );
            
            if (found) {
                return await this.getSpell(found.index);
            }
            return null;
        } catch (error) {
            console.warn(`Поиск заклинания ${name} не удался:`, error);
            return null;
        }
    }

    // Получить оружие по индексу
    async getEquipment(index) {
        const cacheKey = `equipment_${index}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.baseURL}/equipment/${index}`);
            if (!response.ok) throw new Error('Equipment not found');
            
            const equipment = await response.json();
            this.cache.set(cacheKey, equipment);
            return equipment;
        } catch (error) {
            console.warn(`Не удалось получить оружие ${index}:`, error);
            return null;
        }
    }

    // Конвертировать данные API в наш формат
    convertSpellToOurFormat(apiSpell) {
        if (!apiSpell) return null;

        const damage = this.extractDamage(apiSpell);
        
        return {
            name: this.translateSpellName(apiSpell.name),
            level: apiSpell.level,
            school: this.translateSchool(apiSpell.school?.name),
            damage: damage.dice,
            damageType: damage.type,
            range: this.convertRange(apiSpell.range),
            castingTime: this.convertCastingTime(apiSpell.casting_time),
            duration: this.convertDuration(apiSpell.duration),
            description: this.extractDescription(apiSpell),
            isAttackSpell: this.isAttackSpell(apiSpell),
            hasSavingThrow: this.hasSavingThrow(apiSpell)
        };
    }

    // Извлечь урон из описания заклинания
    extractDamage(spell) {
        if (spell.damage && spell.damage.damage_at_slot_level) {
            const slotLevel = spell.level || 1;
            const damageFormula = spell.damage.damage_at_slot_level[slotLevel];
            return {
                dice: damageFormula,
                type: this.translateDamageType(spell.damage.damage_type?.name)
            };
        }
        
        if (spell.damage && spell.damage.damage_at_character_level) {
            // Для заговоров - урон по уровню персонажа
            const damage = spell.damage.damage_at_character_level['1'] || 
                          spell.damage.damage_at_character_level['5'] ||
                          Object.values(spell.damage.damage_at_character_level)[0];
            return {
                dice: damage,
                type: this.translateDamageType(spell.damage.damage_type?.name)
            };
        }

        return { dice: '', type: '' };
    }

    // Проверить, является ли заклинание атакующим
    isAttackSpell(spell) {
        const desc = spell.desc?.join(' ').toLowerCase() || '';
        return desc.includes('ranged spell attack') || 
               desc.includes('melee spell attack') || 
               desc.includes('spell attack');
    }

    // Проверить, есть ли спасбросок
    hasSavingThrow(spell) {
        return spell.dc && spell.dc.dc_type;
    }

    // Переводы
    translateSpellName(name) {
        const translations = {
            'Fire Bolt': 'Огненный снаряд',
            'Sacred Flame': 'Священное пламя',
            'Eldritch Blast': 'Мистический взрыв',
            'Chill Touch': 'Холодящее прикосновение',
            'Magic Missile': 'Волшебная стрела',
            'Cure Wounds': 'Лечение ран',
            'Healing Word': 'Слово лечения',
            'Shield': 'Щит',
            'Fireball': 'Огненный шар',
            'Lightning Bolt': 'Молния'
        };
        return translations[name] || name;
    }

    translateDamageType(type) {
        const translations = {
            'fire': 'огонь',
            'cold': 'холод',
            'lightning': 'электричество',
            'thunder': 'звук',
            'acid': 'кислота',
            'poison': 'яд',
            'psychic': 'психический',
            'necrotic': 'некротический',
            'radiant': 'излучение',
            'force': 'силовое поле',
            'piercing': 'колющий',
            'slashing': 'рубящий',
            'bludgeoning': 'дробящий'
        };
        return translations[type] || type;
    }

    translateSchool(school) {
        const translations = {
            'Evocation': 'Воплощение',
            'Transmutation': 'Преобразование',
            'Abjuration': 'Ограждение',
            'Conjuration': 'Вызов',
            'Divination': 'Прорицание',
            'Enchantment': 'Очарование',
            'Illusion': 'Иллюзия',
            'Necromancy': 'Некромантия'
        };
        return translations[school] || school;
    }

    convertRange(range) {
        if (range === 'Self') return 'На себя';
        if (range === 'Touch') return 'Касание';
        if (range.includes('feet')) {
            const feet = range.match(/(\d+)/)?.[1];
            return `${feet} футов`;
        }
        return range;
    }

    convertCastingTime(time) {
        if (time === '1 action') return '1 действие';
        if (time === '1 bonus action') return '1 бонусное действие';
        if (time === '1 reaction') return '1 реакция';
        return time;
    }

    convertDuration(duration) {
        if (duration === 'Instantaneous') return 'Мгновенно';
        if (duration.includes('Concentration')) return duration.replace('Concentration, ', 'Концентрация, ');
        return duration;
    }

    extractDescription(spell) {
        return spell.desc?.join('\n') || '';
    }
}

// Создаем глобальный экземпляр API
window.dndAPI = new DnDAPI();
