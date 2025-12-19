// ===== MEDIEVAL CARD GAME - LORDS OF WAR (NO MAGIC) =====

// Historic Leaders by Unit Type
const HISTORIC_LEADERS = {
    ranged: [
        {
            id: 'robinHood',
            name: 'Robin Hood',
            health: 48,
            unitType: 'ranged',
            commandCost: 2,
            commandName: 'Ambush Tactics',
            commandText: 'Draw 1 card',
            passive: 'Your ranged units deal +1 damage',
            portrait: 'RH',
            color: '#2d5016',
            description: 'Robin Hood\n\n⚔️ HERO TYPE: Ranged\nHP: 48\n\n📋 PASSIVE ABILITY:\nYour ranged units deal +1 damage\n\n🎯 COUNTERS:\nRanged Mechanics:\n• +1 attack vs Infantry\n• Take no counter-damage from melee\n\n🔄 COUNTERED BY:\nCavalry Mechanics:\n• Deal +1 attack vs Ranged'
        },
        {
            id: 'williamTell',
            name: 'William Tell',
            health: 48,
            unitType: 'ranged',
            commandCost: 2,
            commandName: 'Keen Eyes',
            commandText: 'Draw 1 card',
            passive: 'Once per turn, a random friendly bannerman heals 1 damage',
            portrait: 'WT',
            color: '#1a3a52',
            description: 'William Tell\n\n⚔️ HERO TYPE: Ranged\nHP: 48\n\n📋 PASSIVE ABILITY:\nOnce per turn, a random friendly bannerman heals 1 damage\n\n🎯 COUNTERS:\nRanged Mechanics:\n• +1 attack vs Infantry\n• Take no counter-damage from melee\n\n🔄 COUNTERED BY:\nCavalry Mechanics:\n• Deal +1 attack vs Ranged'
        },
        {
            id: 'houYi',
            name: 'Hou Yi',
            health: 48,
            unitType: 'ranged',
            commandCost: 2,
            commandName: 'Celestial Hunt',
            commandText: 'Draw 1 card',
            passive: 'When you play a ranged ability, gain +1 Gold',
            portrait: 'HY',
            color: '#663300',
            description: 'Hou Yi\n\n⚔️ HERO TYPE: Ranged\nHP: 48\n\n📋 PASSIVE ABILITY:\nWhen you play a ranged ability, gain +1 Gold\n\n🎯 COUNTERS:\nRanged Mechanics:\n• +1 attack vs Infantry\n• Take no counter-damage from melee\n\n🔄 COUNTERED BY:\nCavalry Mechanics:\n• Deal +1 attack vs Ranged'
        },
        {
            id: 'artemis',
            name: 'Artemis',
            health: 48,
            unitType: 'ranged',
            commandCost: 2,
            commandName: 'Divine Arrows',
            commandText: 'Draw 1 card',
            passive: 'Your ranged units have +1 durability',
            portrait: 'AR',
            color: '#2d2d5f',
            description: 'Artemis\n\n⚔️ HERO TYPE: Ranged\nHP: 48\n\n📋 PASSIVE ABILITY:\nYour ranged units have +1 durability\n\n🎯 COUNTERS:\nRanged Mechanics:\n• +1 attack vs Infantry\n• Take no counter-damage from melee\n\n🔄 COUNTERED BY:\nCavalry Mechanics:\n• Deal +1 attack vs Ranged'
        }
    ],
    infantry: [
        {
            id: 'leonidas',
            name: 'Leonidas',
            health: 57,
            unitType: 'infantry',
            commandCost: 2,
            commandName: 'Battle Formation',
            commandText: 'Draw 1 card',
            passive: 'Your infantry units have +1 power',
            portrait: 'LE',
            color: '#5f1a1a',
            description: 'Leonidas\n\n⚔️ HERO TYPE: Infantry\nHP: 57\n\n📋 PASSIVE ABILITY:\nYour infantry units have +1 power\n\n🎯 COUNTERS:\n(None - standard infantry type)\n\n🔄 COUNTERED BY:\nRanged Mechanics:\n• Deal +1 attack vs Infantry'
        },
        {
            id: 'joanOfArc',
            name: 'Joan of Arc',
            health: 57,
            unitType: 'infantry',
            commandCost: 2,
            commandName: 'Holy Crusade',
            commandText: 'Draw 1 card',
            passive: 'When an infantry unit dies, draw a card',
            portrait: 'JA',
            color: '#8b3a3a',
            description: 'Joan of Arc\n\n⚔️ HERO TYPE: Infantry\nHP: 57\n\n📋 PASSIVE ABILITY:\nWhen an infantry unit dies, draw a card\n\n🎯 COUNTERS:\n(None - standard infantry type)\n\n🔄 COUNTERED BY:\nRanged Mechanics:\n• Deal +1 attack vs Infantry'
        },
        {
            id: 'richardLionheart',
            name: 'Richard the Lionheart',
            health: 57,
            unitType: 'infantry',
            commandCost: 2,
            commandName: 'Heraldic Wisdom',
            commandText: 'Draw 1 card',
            passive: 'Your infantry units take 1 less damage',
            portrait: 'RL',
            color: '#6b4423',
            description: 'Richard the Lionheart\n\n⚔️ HERO TYPE: Infantry\nHP: 57\n\n📋 PASSIVE ABILITY:\nYour infantry units take 1 less damage\n\n🎯 COUNTERS:\n(None - standard infantry type)\n\n🔄 COUNTERED BY:\nRanged Mechanics:\n• Deal +1 attack vs Infantry'
        },
        {
            id: 'williamWallace',
            name: 'William Wallace',
            health: 57,
            unitType: 'infantry',
            commandCost: 2,
            commandName: 'Highland Strategy',
            commandText: 'Draw 1 card',
            passive: 'Your infantry units can attack the turn they are played',
            portrait: 'WW',
            color: '#2d3d52',
            description: 'William Wallace\n\n⚔️ HERO TYPE: Infantry\nHP: 57\n\n📋 PASSIVE ABILITY:\nYour infantry units can attack the turn they are played\n\n🎯 COUNTERS:\n(None - standard infantry type)\n\n🔄 COUNTERED BY:\nRanged Mechanics:\n• Deal +1 attack vs Infantry'
        }
    ],
    cavalry: [
        {
            id: 'genghisKhan',
            name: 'Genghis Khan',
            health: 52,
            unitType: 'cavalry',
            commandCost: 2,
            commandName: 'Scouts Report',
            commandText: 'Draw 1 card',
            passive: 'Your cavalry units have +1 power',
            portrait: 'GK',
            color: '#1a3a1a',
            description: 'Genghis Khan\n\n⚔️ HERO TYPE: Cavalry\nHP: 52\n\n📋 PASSIVE ABILITY:\nYour cavalry units have +1 power\n\n🎯 COUNTERS:\nCavalry Mechanics:\n• +1 attack vs Ranged\n\n🔄 COUNTERED BY:\nInfantry Mechanics:\n• Deal +1 attack vs Cavalry'
        },
        {
            id: 'alexander',
            name: 'Alexander the Great',
            health: 52,
            unitType: 'cavalry',
            commandCost: 2,
            commandName: 'Strategic Expansion',
            commandText: 'Draw 1 card',
            passive: 'When you play a cavalry unit, draw a card',
            portrait: 'AT',
            color: '#2d1a5f',
            description: 'Alexander the Great\n\n⚔️ HERO TYPE: Cavalry\nHP: 52\n\n📋 PASSIVE ABILITY:\nWhen you play a cavalry unit, draw a card\n\n🎯 COUNTERS:\nCavalry Mechanics:\n• +1 attack vs Ranged\n\n🔄 COUNTERED BY:\nInfantry Mechanics:\n• Deal +1 damage vs Cavalry'
        },
        {
            id: 'saladin',
            name: 'Saladin',
            health: 52,
            unitType: 'cavalry',
            commandCost: 2,
            commandName: 'Desert Wisdom',
            commandText: 'Draw 1 card',
            passive: 'Your cavalry units have +1 durability',
            portrait: 'SA',
            color: '#5f3a1a',
            description: 'Saladin\n\n⚔️ HERO TYPE: Cavalry\nHP: 52\n\n📋 PASSIVE ABILITY:\nYour cavalry units have +1 durability\n\n🎯 COUNTERS:\nCavalry Mechanics:\n• +1 attack vs Ranged\n\n🔄 COUNTERED BY:\nInfantry Mechanics:\n• Deal +1 damage vs Cavalry'
        },
        {
            id: 'charlemagne',
            name: 'Charlemagne',
            health: 52,
            unitType: 'cavalry',
            commandCost: 2,
            commandName: 'Royal Command',
            commandText: 'Give target cavalry unit +2/+2',
            passive: 'Your cavalry units can attack the turn they are played',
            portrait: 'CH',
            color: '#1a2d5f',
            description: 'Charlemagne\n\n⚔️ HERO TYPE: Cavalry\nHP: 52\n\n📋 PASSIVE ABILITY:\nYour cavalry units can attack the turn they are played\n\n🎯 COUNTERS:\nCavalry Mechanics:\n• +1 attack vs Ranged\n\n🔄 COUNTERED BY:\nInfantry Mechanics:\n• Deal +1 damage vs Cavalry'
        }
    ]
};

const CARD_DATABASE = {
    // ===== RANGED MONSTER CARDS =====
    archer: {
        id: 'archer',
        name: 'Archer',
        type: 'unit',
        unitType: 'ranged',
        cost: 2,
        power: 2,
        durability: 2,
        text: 'Basic ranged unit. No hitback.',
        rarity: 'common'
    },
    crossbow: {
        id: 'crossbow',
        name: 'Crossbowman',
        type: 'unit',
        unitType: 'ranged',
        cost: 3,
        power: 3,
        durability: 3,
        text: 'Powerful ranged unit. No hitback.',
        rarity: 'common'
    },
    skirmisher: {
        id: 'skirmisher',
        name: 'Skirmisher',
        type: 'unit',
        unitType: 'ranged',
        cost: 1,
        power: 1,
        durability: 2,
        text: 'Fast ranged unit. No hitback.',
        rarity: 'common'
    },
    scout: {
        id: 'scout',
        name: 'Scout',
        type: 'unit',
        unitType: 'ranged',
        cost: 3,
        power: 2,
        durability: 4,
        keywords: ['scout'],
        text: 'Scout: When this unit is played, draw a card. No hitback.',
        rarity: 'rare',
        scoutEffect: true
    },

    // ===== INFANTRY MONSTER CARDS =====
    footman: {
        id: 'footman',
        name: 'Footman',
        type: 'unit',
        unitType: 'infantry',
        cost: 2,
        power: 2,
        durability: 3,
        text: 'Basic infantry unit. High durability.',
        rarity: 'common'
    },
    swordsman: {
        id: 'swordsman',
        name: 'Swordsman',
        type: 'unit',
        unitType: 'infantry',
        cost: 3,
        power: 3,
        durability: 4,
        text: 'Trained infantry unit. High durability.',
        rarity: 'common'
    },
    knight: {
        id: 'knight',
        name: 'Knight',
        type: 'unit',
        unitType: 'infantry',
        cost: 4,
        power: 4,
        durability: 6,
        text: 'Elite infantry unit. Very high durability.',
        rarity: 'rare'
    },
    sergeant: {
        id: 'sergeant',
        name: 'Sergeant',
        type: 'unit',
        unitType: 'infantry',
        cost: 3,
        power: 2,
        durability: 5,
        keywords: ['command'],
        text: 'Command: When this unit is played, draw a card. High durability.',
        rarity: 'rare',
        commandEffect: true
    },

    // ===== CAVALRY MONSTER CARDS =====
    horseman: {
        id: 'horseman',
        name: 'Horseman',
        type: 'unit',
        unitType: 'cavalry',
        cost: 2,
        power: 2,
        durability: 2,
        keywords: ['charge'],
        text: 'Charge. Basic cavalry unit.',
        rarity: 'common'
    },
    camelRider: {
        id: 'camelRider',
        name: 'Camel Rider',
        type: 'unit',
        unitType: 'cavalry',
        cost: 3,
        power: 3,
        durability: 3,
        keywords: ['charge'],
        text: 'Charge. Desert cavalry unit.',
        rarity: 'common'
    },
    mountedKnight: {
        id: 'mountedKnight',
        name: 'Mounted Knight',
        type: 'unit',
        unitType: 'cavalry',
        cost: 4,
        power: 4,
        durability: 4,
        keywords: ['charge'],
        text: 'Charge. Elite cavalry unit.',
        rarity: 'rare'
    },
    messenger: {
        id: 'messenger',
        name: 'Messenger',
        type: 'unit',
        unitType: 'cavalry',
        cost: 3,
        power: 2,
        durability: 3,
        keywords: ['charge', 'dispatch'],
        text: 'Charge. Dispatch: When this unit is played, draw a card.',
        rarity: 'rare',
        dispatchEffect: true
    },

    // ===== RANGED ABILITY CARDS =====
    quickShot: {
        id: 'quickShot',
        name: 'Quick Shot',
        type: 'ability',
        unitType: 'ranged',
        cost: 1,
        text: 'Deal 1 ranged damage to a random enemy character.',
        rarity: 'common',
        damageType: 'ranged'
    },
    aimedShot: {
        id: 'aimedShot',
        name: 'Aimed Shot',
        type: 'ability',
        unitType: 'ranged',
        cost: 3,
        text: 'Deal 3 ranged damage to target enemy character.',
        rarity: 'common',
        needsTarget: true,
        damageType: 'ranged'
    },
    masterShot: {
        id: 'masterShot',
        name: 'Master Shot',
        type: 'ability',
        unitType: 'ranged',
        cost: 4,
        text: 'Deal 4 ranged damage to any target. Draw a card.',
        rarity: 'rare',
        needsTarget: true,
        targetType: 'any',
        damageType: 'ranged'
    },
    rangersMark: {
        id: 'rangersMark',
        name: 'Rangers Mark',
        type: 'ability',
        unitType: 'ranged',
        cost: 2,
        text: 'Give target ranged bannerman +2/+2.',
        rarity: 'rare',
        needsTarget: true,
        targetType: 'ranged'
    },
    bowEnchantment: {
        id: 'bowEnchantment',
        name: 'Bow Enchantment',
        type: 'ability',
        unitType: 'ranged',
        cost: 4,
        text: 'Give all bows in your deck, hand, and equipped +1 Damage permanently.',
        rarity: 'epic',
        enchantmentEffect: true,
        enchantmentType: 'bow'
    },
    quiverRefill: {
        id: 'quiverRefill',
        name: 'Quiver Refill',
        type: 'ability',
        unitType: 'ranged',
        cost: 3,
        text: 'Draw 3 cards.',
        rarity: 'common'
    },

    // ===== INFANTRY ABILITY CARDS =====
    quickStrike: {
        id: 'quickStrike',
        name: 'Quick Strike',
        type: 'ability',
        unitType: 'infantry',
        cost: 1,
        text: 'Deal 1 infantry damage to a target enemy character.',
        rarity: 'common',
        needsTarget: true,
        damageType: 'infantry'
    },
    focusStrike: {
        id: 'focusStrike',
        name: 'Focus Strike',
        type: 'ability',
        unitType: 'infantry',
        cost: 3,
        text: 'Deal 3 infantry damage to a target enemy character.',
        rarity: 'common',
        needsTarget: true,
        damageType: 'infantry'
    },
    swordEnchantment: {
        id: 'swordEnchantment',
        name: 'Sword Enchantment',
        type: 'ability',
        unitType: 'infantry',
        cost: 4,
        text: 'Give all swords equipped AND in your hand +1 attack permanently.',
        rarity: 'epic'
    },
    supplyLine: {
        id: 'supplyLine',
        name: 'Supply Line',
        type: 'ability',
        unitType: 'infantry',
        cost: 3,
        text: 'Draw 3 cards.',
        rarity: 'common'
    },
    shieldWall: {
        id: 'shieldWall',
        name: 'Shield Wall',
        type: 'ability',
        unitType: 'infantry',
        cost: 2,
        text: 'Give target infantry unit +0/+2.',
        rarity: 'common',
        needsTarget: true,
        targetType: 'infantry'
    },

    // ===== CAVALRY ABILITY CARDS =====
    quickCharge: {
        id: 'quickCharge',
        name: 'Quick Charge',
        type: 'ability',
        unitType: 'cavalry',
        cost: 1,
        text: 'Deal 1 cavalry damage to a target enemy character.',
        rarity: 'common',
        needsTarget: true,
        damageType: 'cavalry'
    },
    focusCharge: {
        id: 'focusCharge',
        name: 'Focus Charge',
        type: 'ability',
        unitType: 'cavalry',
        cost: 3,
        text: 'Deal 3 cavalry damage to a target enemy character.',
        rarity: 'common',
        needsTarget: true,
        damageType: 'cavalry'
    },
    axeEnchantment: {
        id: 'axeEnchantment',
        name: 'Axe Enchantment',
        type: 'ability',
        unitType: 'cavalry',
        cost: 4,
        text: 'Give all axes equipped AND in your hand +1 attack permanently.',
        rarity: 'epic'
    },
    courierNetwork: {
        id: 'courierNetwork',
        name: 'Courier Network',
        type: 'ability',
        unitType: 'cavalry',
        cost: 3,
        text: 'Draw 3 cards.',
        rarity: 'common'
    },
    cavalryFormation: {
        id: 'cavalryFormation',
        name: 'Cavalry Formation',
        type: 'ability',
        unitType: 'cavalry',
        cost: 2,
        text: 'Give target cavalry unit +2/+2.',
        rarity: 'rare',
        needsTarget: true,
        targetType: 'cavalry'
    },

    // ===== NEW UNIVERSAL ABILITY CARDS =====
    disarmEnemy: {
        id: 'disarmEnemy',
        name: 'Disarm',
        type: 'ability',
        cost: 2,
        text: 'Destroy a random enemy equipment card.',
        rarity: 'rare',
        effectType: 'destroyRandomEquipment'
    },
    targetedDisarm: {
        id: 'targetedDisarm',
        name: 'Confiscate',
        type: 'ability',
        cost: 3,
        text: 'Destroy target enemy equipment.',
        rarity: 'epic',
        needsTarget: true,
        targetType: 'equipment',
        effectType: 'destroyTargetEquipment'
    },
    taxCollection: {
        id: 'taxCollection',
        name: 'Tax Collection',
        type: 'ability',
        cost: 2,
        text: 'Gain 1 additional maximum gold.',
        rarity: 'rare',
        effectType: 'gainMaxGold'
    },
    healingPotion: {
        id: 'healingPotion',
        name: 'Healing Potion',
        type: 'ability',
        cost: 2,
        text: 'Heal 1-4 damage to your character.',
        rarity: 'rare',
        effectType: 'healDamage',
        healAmount: 4
    },

    // ===== EQUIPMENT CARDS =====
    bow: {
        id: 'bow',
        name: 'Bow',
        type: 'equipment',
        unitType: 'ranged',
        cost: 2,
        text: 'Attach to hero. Hero can deal ranged damage to any enemy character once per turn.',
        rarity: 'common',
        equipType: 'ranged',
        equipSlot: 'weapon',
        attackPower: 2
    },
    sword: {
        id: 'sword',
        name: 'Sword',
        type: 'equipment',
        unitType: 'infantry',
        cost: 2,
        text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.',
        rarity: 'common',
        equipType: 'infantry',
        equipSlot: 'weapon',
        attackPower: 2
    },
    axe: {
        id: 'axe',
        name: 'Axe',
        type: 'equipment',
        unitType: 'cavalry',
        cost: 2,
        text: 'Attach to hero. Hero can deal melee damage to any enemy character once per turn.',
        rarity: 'common',
        equipType: 'cavalry',
        equipSlot: 'weapon',
        attackPower: 2
    },
    
    // ===== RANGED ARMOR CARDS (Padded Cloth Set) =====
    clothCoif: {
        id: 'clothCoif',
        name: 'Cloth Coif',
        type: 'equipment',
        unitType: 'ranged',
        cost: 1,
        text: 'Head armor. +1 durability to hero.',
        rarity: 'common',
        equipType: 'ranged',
        equipSlot: 'head',
        armorValue: 1
    },
    paddedClothArmor: {
        id: 'paddedClothArmor',
        name: 'Padded Cloth Armor',
        type: 'equipment',
        unitType: 'ranged',
        cost: 2,
        text: 'Chest armor. +2 durability to hero.',
        rarity: 'common',
        equipType: 'ranged',
        equipSlot: 'chest',
        armorValue: 2
    },
    paddedClothChaps: {
        id: 'paddedClothChaps',
        name: 'Padded Cloth Chaps',
        type: 'equipment',
        unitType: 'ranged',
        cost: 1,
        text: 'Leg armor. +1 durability to hero.',
        rarity: 'common',
        equipType: 'ranged',
        equipSlot: 'legs',
        armorValue: 1
    },
    rangerBoots: {
        id: 'rangerBoots',
        name: 'Ranger Boots',
        type: 'equipment',
        unitType: 'ranged',
        cost: 1,
        text: 'Foot armor. +1 durability to hero.',
        rarity: 'common',
        equipType: 'ranged',
        equipSlot: 'boots',
        armorValue: 1
    },

    // ===== CAVALRY ARMOR CARDS (Leather Set) =====
    leatherCap: {
        id: 'leatherCap',
        name: 'Leather Cap',
        type: 'equipment',
        unitType: 'cavalry',
        cost: 1,
        text: 'Head armor. +1 durability to hero.',
        rarity: 'common',
        equipType: 'cavalry',
        equipSlot: 'head',
        armorValue: 1
    },
    leatherArmor: {
        id: 'leatherArmor',
        name: 'Leather Armor',
        type: 'equipment',
        unitType: 'cavalry',
        cost: 2,
        text: 'Chest armor. +2 durability to hero.',
        rarity: 'common',
        equipType: 'cavalry',
        equipSlot: 'chest',
        armorValue: 2
    },
    leatherLeggings: {
        id: 'leatherLeggings',
        name: 'Leather Leggings',
        type: 'equipment',
        unitType: 'cavalry',
        cost: 1,
        text: 'Leg armor. +1 durability to hero.',
        rarity: 'common',
        equipType: 'cavalry',
        equipSlot: 'legs',
        armorValue: 1
    },
    leatherShield: {
        id: 'leatherShield',
        name: 'Leather Shield',
        type: 'equipment',
        unitType: 'cavalry',
        cost: 2,
        text: 'Shield. +2 durability to hero.',
        rarity: 'common',
        equipType: 'cavalry',
        equipSlot: 'shield',
        armorValue: 2
    },
    leatherBoots: {
        id: 'leatherBoots',
        name: 'Leather Boots',
        type: 'equipment',
        unitType: 'cavalry',
        cost: 1,
        text: 'Foot armor. +1 durability to hero.',
        rarity: 'common',
        equipType: 'cavalry',
        equipSlot: 'boots',
        armorValue: 1
    },

    // ===== INFANTRY ARMOR CARDS (Plate Set) =====
    plateHelmet: {
        id: 'plateHelmet',
        name: 'Plate Helmet',
        type: 'equipment',
        unitType: 'infantry',
        cost: 2,
        text: 'Head armor. +2 durability to hero.',
        rarity: 'common',
        equipType: 'infantry',
        equipSlot: 'head',
        armorValue: 2
    },
    plateBody: {
        id: 'plateBody',
        name: 'Plate Body',
        type: 'equipment',
        unitType: 'infantry',
        cost: 3,
        text: 'Chest armor. +3 durability to hero.',
        rarity: 'common',
        equipType: 'infantry',
        equipSlot: 'chest',
        armorValue: 3
    },
    plateLegs: {
        id: 'plateLegs',
        name: 'Plate Legs',
        type: 'equipment',
        unitType: 'infantry',
        cost: 2,
        text: 'Leg armor. +2 durability to hero.',
        rarity: 'common',
        equipType: 'infantry',
        equipSlot: 'legs',
        armorValue: 2
    },
    kiteShield: {
        id: 'kiteShield',
        name: 'Kite Shield',
        type: 'equipment',
        unitType: 'infantry',
        cost: 3,
        text: 'Shield. +3 durability to hero.',
        rarity: 'common',
        equipType: 'infantry',
        equipSlot: 'shield',
        armorValue: 3
    },
    plateBoots: {
        id: 'plateBoots',
        name: 'Plate Boots',
        type: 'equipment',
        unitType: 'infantry',
        cost: 1,
        text: 'Foot armor. +1 durability to hero.',
        rarity: 'common',
        equipType: 'infantry',
        equipSlot: 'boots',
        armorValue: 1
    },
};

// Make available globally
window.CARD_DATABASE = CARD_DATABASE;
window.HISTORIC_LEADERS = HISTORIC_LEADERS;

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CARD_DATABASE, HISTORIC_LEADERS };
}
