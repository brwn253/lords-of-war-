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
            passive: 'Your ranged bannermen deal +1 damage',
            portrait: 'RH',
            color: '#2d5016',
            description: 'Robin Hood\n\n⚔️ HERO TYPE: Ranged\nHP: 48\n\n📋 PASSIVE ABILITY:\nYour ranged bannermen deal +1 damage\n\nRanged Mechanics:\n• +1 attack vs Infantry\n• Take no counter-damage from melee\n• Cavalry deal +1 attack vs Ranged'
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
            description: 'William Tell\n\n⚔️ HERO TYPE: Ranged\nHP: 48\n\n📋 PASSIVE ABILITY:\nOnce per turn, a random friendly bannerman heals 1 damage\n\nRanged Mechanics:\n• +1 attack vs Infantry\n• Take no counter-damage from melee\n• Cavalry deal +1 attack vs Ranged'
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
            description: 'Hou Yi\n\n⚔️ HERO TYPE: Ranged\nHP: 48\n\n📋 PASSIVE ABILITY:\nWhen you play a ranged ability, gain +1 Gold\n\nRanged Mechanics:\n• +1 attack vs Infantry\n• Take no counter-damage from melee\n• Cavalry deal +1 attack vs Ranged'
        },
        {
            id: 'artemis',
            name: 'Artemis',
            health: 48,
            unitType: 'ranged',
            commandCost: 2,
            commandName: 'Divine Arrows',
            commandText: 'Draw 1 card',
            passive: 'Your ranged bannermen have +1 durability',
            portrait: 'AR',
            color: '#2d2d5f',
            description: 'Artemis\n\n⚔️ HERO TYPE: Ranged\nHP: 48\n\n📋 PASSIVE ABILITY:\nYour ranged bannermen have +1 durability\n\nRanged Mechanics:\n• +1 attack vs Infantry\n• Take no counter-damage from melee\n• Cavalry deal +1 attack vs Ranged'
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
            passive: 'Your infantry bannermen deal +1 damage',
            portrait: 'LE',
            color: '#5f1a1a',
            description: 'Leonidas\n\n⚔️ HERO TYPE: Infantry\nHP: 57\nStarts with: Sword\n\n📋 PASSIVE ABILITY:\nYour infantry bannermen deal +1 damage\n\nInfantry Mechanics:\n• +1 attack vs Cavalry\n• Ranged deal +1 attack vs Infantry'
        },
        {
            id: 'joanOfArc',
            name: 'Joan of Arc',
            health: 57,
            unitType: 'infantry',
            commandCost: 2,
            commandName: 'Holy Crusade',
            commandText: 'Draw 1 card',
            passive: 'When an infantry bannerman dies, draw a card',
            portrait: 'JA',
            color: '#8b3a3a',
            description: 'Joan of Arc\n\n⚔️ HERO TYPE: Infantry\nHP: 57\nStarts with: Sword\n\n📋 PASSIVE ABILITY:\nWhen an infantry bannerman dies, draw a card\n\nInfantry Mechanics:\n• +1 attack vs Cavalry\n• Ranged deal +1 attack vs Infantry'
        },
        {
            id: 'richardLionheart',
            name: 'Richard the Lionheart',
            health: 57,
            unitType: 'infantry',
            commandCost: 2,
            commandName: 'Heraldic Wisdom',
            commandText: 'Draw 1 card',
            passive: 'Your infantry bannermen take 1 less damage',
            portrait: 'RL',
            color: '#6b4423',
            description: 'Richard the Lionheart\n\n⚔️ HERO TYPE: Infantry\nHP: 57\nStarts with: Sword\n\n📋 PASSIVE ABILITY:\nYour infantry bannermen take 1 less damage\n\nInfantry Mechanics:\n• +1 attack vs Cavalry\n• Ranged deal +1 attack vs Infantry'
        },
        {
            id: 'williamWallace',
            name: 'William Wallace',
            health: 57,
            unitType: 'infantry',
            commandCost: 2,
            commandName: 'Highland Strategy',
            commandText: 'Draw 1 card',
            passive: 'Your infantry bannermen can attack the turn they are played',
            portrait: 'WW',
            color: '#2d3d52',
            description: 'William Wallace\n\n⚔️ HERO TYPE: Infantry\nHP: 57\nStarts with: Sword\n\n📋 PASSIVE ABILITY:\nYour infantry bannermen can attack the turn they are played\n\nInfantry Mechanics:\n• +1 attack vs Cavalry\n• Ranged deal +1 attack vs Infantry'
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
            passive: 'Your cavalry bannermen deal +1 damage',
            portrait: 'GK',
            color: '#1a3a1a',
            description: 'Genghis Khan\n\n⚔️ HERO TYPE: Cavalry\nHP: 52\n\n📋 PASSIVE ABILITY:\nYour cavalry bannermen deal +1 damage\n\nCavalry Mechanics:\n• +1 attack vs Ranged\n• Infantry deal +1 attack vs Cavalry'
        },
        {
            id: 'alexander',
            name: 'Alexander the Great',
            health: 52,
            unitType: 'cavalry',
            commandCost: 2,
            commandName: 'Strategic Expansion',
            commandText: 'Draw 1 card',
            passive: 'When you play a cavalry bannerman, draw a card',
            portrait: 'AT',
            color: '#2d1a5f',
            description: 'Alexander the Great\n\n⚔️ HERO TYPE: Cavalry\nHP: 52\n\n📋 PASSIVE ABILITY:\nWhen you play a cavalry bannerman, draw a card\n\nCavalry Mechanics:\n• +1 attack vs Ranged\n• Infantry deal +1 attack vs Cavalry'
        },
        {
            id: 'saladin',
            name: 'Saladin',
            health: 52,
            unitType: 'cavalry',
            commandCost: 2,
            commandName: 'Desert Wisdom',
            commandText: 'Draw 1 card',
            passive: 'Your cavalry bannermen have +1 durability',
            portrait: 'SA',
            color: '#5f3a1a',
            description: 'Saladin\n\n⚔️ HERO TYPE: Cavalry\nHP: 52\n\n📋 PASSIVE ABILITY:\nYour cavalry bannermen have +1 durability\n\nCavalry Mechanics:\n• +1 attack vs Ranged\n• Infantry deal +1 attack vs Cavalry'
        },
        {
            id: 'charlemagne',
            name: 'Charlemagne',
            health: 52,
            unitType: 'cavalry',
            commandCost: 2,
            commandName: 'Royal Command',
            commandText: 'Give target cavalry bannerman +2/+2',
            passive: 'Your cavalry bannermen deal +1 counter-damage',
            portrait: 'CH',
            color: '#1a2d5f',
            description: 'Charlemagne\n\n⚔️ HERO TYPE: Cavalry\nHP: 52\n\n📋 PASSIVE ABILITY:\nYour cavalry bannermen deal +1 counter-damage\n\nCavalry Mechanics:\n• +1 attack vs Ranged\n• Infantry deal +1 attack vs Cavalry'
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
    watchTower: {
        id: 'watchTower',
        name: 'Watch Tower',
        type: 'unit',
        unitType: 'ranged',
        cost: 4,
        power: 0,
        durability: 10,
        text: 'Gets +1 attack for every friendly bannerman on the battlefield. Deals Ranged damage. Cannot attack enemy hero.',
        rarity: 'epic',
        keywords: ['watchtower'],
        watchTowerEffect: true,
        cannotAttackHero: true
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
    battleMedic: {
        id: 'battleMedic',
        name: 'Battle Medic',
        type: 'unit',
        unitType: 'infantry',
        cost: 3,
        power: 1,
        durability: 8,
        text: 'When it enters the battlefield, instantly heal 1 damage to all friendly bannerman and heroes. At the end of each turn, heal 1 damage to a friendly character.',
        rarity: 'epic',
        keywords: ['medic'],
        medicEffect: true,
        healOnEnter: true,
        healEndOfTurn: true
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
        text: 'Hero attack +1. Each weapon or enchantment adds +1 attack.',
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
    launchNet: {
        id: 'launchNet',
        name: 'Launch Net',
        type: 'ability',
        unitType: 'ranged',
        cost: 2,
        text: 'Target Bannerman cannot attack next turn.',
        rarity: 'rare',
        needsTarget: true,
        targetType: 'bannerman',
        effectType: 'stun'
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
        text: 'Hero attack +1. Each weapon or enchantment adds +1 attack.',
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
    disarm: {
        id: 'disarm',
        name: 'Disarm',
        type: 'ability',
        unitType: 'infantry',
        cost: 3,
        text: 'Destroy a random enemy equipment card.',
        rarity: 'rare',
        effectType: 'destroyRandomEquipment'
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
        text: 'Hero attack +1. Each weapon or enchantment adds +1 attack.',
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
    sabotage: {
        id: 'sabotage',
        name: 'Sabotage',
        type: 'ability',
        unitType: 'cavalry',
        cost: 3,
        text: 'Destroy a random enemy equipment card.',
        rarity: 'rare',
        effectType: 'destroyRandomEquipment'
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
        text: 'Attach to hero. First weapon gives +1 attack. Each additional weapon or enchantment adds +1 attack. Hero can deal ranged damage to any enemy character once per turn.',
        rarity: 'common',
        equipType: 'ranged',
        equipSlot: 'weapon',
        attackPower: 1
    },
    sword: {
        id: 'sword',
        name: 'Sword',
        type: 'equipment',
        unitType: 'infantry',
        cost: 2,
        text: 'Attach to hero. First weapon gives +1 attack. Each additional weapon or enchantment adds +1 attack. Hero can deal melee damage to any enemy character once per turn.',
        rarity: 'common',
        equipType: 'infantry',
        equipSlot: 'weapon',
        attackPower: 1
    },
    axe: {
        id: 'axe',
        name: 'Axe',
        type: 'equipment',
        unitType: 'cavalry',
        cost: 2,
        text: 'Attach to hero. First weapon gives +1 attack. Each additional weapon or enchantment adds +1 attack. Hero can deal melee damage to any enemy character once per turn.',
        rarity: 'common',
        equipType: 'cavalry',
        equipSlot: 'weapon',
        attackPower: 1
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

    // ===== SIEGE CARDS (Available to all hero types) =====
    ballista: {
        id: 'ballista',
        name: 'Ballista',
        type: 'unit',
        unitType: 'siege',
        cost: 5,
        power: 4,
        durability: 10,
        text: 'Siege weapon. High attack and durability. No hitback.',
        rarity: 'rare',
        keywords: ['siege']
    },
    catapult: {
        id: 'catapult',
        name: 'Catapult',
        type: 'unit',
        unitType: 'siege',
        cost: 5,
        power: 2,
        durability: 10,
        text: 'Siege weapon. This unit can attack twice in a turn. No hitback.',
        rarity: 'epic',
        keywords: ['siege', 'doubleAttack'],
        doubleAttack: true
    },

    // ===== HIGH COST UNITS (5-7 cost) =====
    
    // Ranged high-cost units
    masterArcher: {
        id: 'masterArcher',
        name: 'Master Archer',
        type: 'unit',
        unitType: 'ranged',
        cost: 5,
        power: 5,
        durability: 5,
        text: 'Elite ranged unit. When this unit attacks, draw a card. No hitback.',
        rarity: 'epic',
        keywords: ['scout'],
        scoutEffect: true
    },
    siegeMaster: {
        id: 'siegeMaster',
        name: 'Siege Master',
        type: 'unit',
        unitType: 'ranged',
        cost: 6,
        power: 4,
        durability: 8,
        text: 'When this unit enters the battlefield, deal 2 damage to all enemy units and hero. No hitback.',
        rarity: 'epic',
        keywords: ['siege'],
        enterBattlefieldEffect: true
    },
    
    // Infantry high-cost units
    champion: {
        id: 'champion',
        name: 'Champion',
        type: 'unit',
        unitType: 'infantry',
        cost: 5,
        power: 5,
        durability: 7,
        text: 'Elite infantry unit. When this unit kills an enemy, gain +1/+1 permanently.',
        rarity: 'epic',
        keywords: ['champion']
    },
    fortressGuard: {
        id: 'fortressGuard',
        name: 'Fortress Guard',
        type: 'unit',
        unitType: 'infantry',
        cost: 6,
        power: 3,
        durability: 10,
        text: 'Defensive unit. When attacked, deal 2 damage back to the attacker.',
        rarity: 'epic',
        keywords: ['fortress']
    },
    warGeneral: {
        id: 'warGeneral',
        name: 'War General',
        type: 'unit',
        unitType: 'infantry',
        cost: 7,
        power: 6,
        durability: 8,
        text: 'Legendary commander. All friendly infantry units gain +1/+1 while this is on the battlefield.',
        rarity: 'legendary',
        keywords: ['command', 'general'],
        auraEffect: true
    },
    
    // Cavalry high-cost units
    heavyCavalry: {
        id: 'heavyCavalry',
        name: 'Heavy Cavalry',
        type: 'unit',
        unitType: 'cavalry',
        cost: 5,
        power: 5,
        durability: 5,
        text: 'Elite cavalry unit. Charge. When this unit attacks, deal 1 damage to all enemy units and hero.',
        rarity: 'epic',
        keywords: ['charge', 'trample']
    },
    cavalryCommander: {
        id: 'cavalryCommander',
        name: 'Cavalry Commander',
        type: 'unit',
        unitType: 'cavalry',
        cost: 6,
        power: 4,
        durability: 7,
        text: 'When this unit enters the battlefield, draw 2 cards. Charge.',
        rarity: 'epic',
        keywords: ['charge', 'command'],
        commandEffect: true,
        drawCards: 2
    },
    
    // ===== HIGH COST ABILITIES (5-7 cost) =====
    
    // Ranged high-cost abilities
    volley: {
        id: 'volley',
        name: 'Volley',
        type: 'ability',
        unitType: 'ranged',
        cost: 5,
        text: 'Deal 2 damage to all enemy units.',
        rarity: 'epic',
        effectType: 'aoeDamage',
        damageAmount: 2
    },
    precisionStrike: {
        id: 'precisionStrike',
        name: 'Precision Strike',
        type: 'ability',
        unitType: 'ranged',
        cost: 6,
        text: 'Deal 5 damage to target enemy character. Draw 2 cards.',
        rarity: 'epic',
        needsTarget: true,
        targetType: 'any',
        damageAmount: 5,
        drawCards: 2
    },
    
    // Infantry high-cost abilities
    battleCry: {
        id: 'battleCry',
        name: 'Battle Cry',
        type: 'ability',
        unitType: 'infantry',
        cost: 5,
        text: 'Give all friendly infantry units +2/+2 until end of turn.',
        rarity: 'epic',
        effectType: 'massBuff'
    },
    lastStand: {
        id: 'lastStand',
        name: 'Last Stand',
        type: 'ability',
        unitType: 'infantry',
        cost: 6,
        text: 'Heal your hero for 5. Draw 3 cards. All friendly units gain +1/+1 until end of turn.',
        rarity: 'epic',
        effectType: 'lastStand',
        healAmount: 5,
        drawCards: 3
    },
    
    // Cavalry high-cost abilities
    cavalryCharge: {
        id: 'cavalryCharge',
        name: 'Cavalry Charge',
        type: 'ability',
        unitType: 'cavalry',
        cost: 5,
        text: 'Give all friendly cavalry units +3/+0 until end of turn. Draw a card.',
        rarity: 'epic',
        effectType: 'cavalryCharge',
        drawCards: 1
    },
    flankingManeuver: {
        id: 'flankingManeuver',
        name: 'Flanking Maneuver',
        type: 'ability',
        unitType: 'cavalry',
        cost: 6,
        text: 'Deal 3 damage to target enemy character. All friendly cavalry units can attack immediately.',
        rarity: 'epic',
        needsTarget: true,
        targetType: 'any',
        damageAmount: 3,
        effectType: 'flanking'
    },
    
    // Universal high-cost abilities
    reinforcements: {
        id: 'reinforcements',
        name: 'Reinforcements',
        type: 'ability',
        cost: 5,
        text: 'Draw 5 cards.',
        rarity: 'epic',
        drawCards: 5
    },
    warCouncil: {
        id: 'warCouncil',
        name: 'War Council',
        type: 'ability',
        cost: 6,
        text: 'Draw 3 cards. Gain +2 maximum essence this turn.',
        rarity: 'epic',
        drawCards: 3,
        effectType: 'essenceBoost'
    },
    totalWar: {
        id: 'totalWar',
        name: 'Total War',
        type: 'ability',
        cost: 7,
        text: 'Deal 3 damage to all enemy characters. Draw 2 cards. Gain +1 maximum essence permanently.',
        rarity: 'legendary',
        effectType: 'totalWar',
        damageAmount: 3,
        drawCards: 2
    },
    
    // ===== MID-COST VARIETY CARDS (4-5 cost) =====
    
    // Ranged mid-cost
    longbowman: {
        id: 'longbowman',
        name: 'Longbowman',
        type: 'unit',
        unitType: 'ranged',
        cost: 4,
        power: 3,
        durability: 4,
        text: 'Elite ranged unit. When this unit attacks, deal 1 damage to a random enemy unit. No hitback.',
        rarity: 'rare',
        keywords: ['piercing']
    },
    ranger: {
        id: 'ranger',
        name: 'Ranger',
        type: 'unit',
        unitType: 'ranged',
        cost: 4,
        power: 3,
        durability: 5,
        text: 'When this unit enters the battlefield, destroy target enemy equipment. No hitback.',
        rarity: 'rare',
        keywords: ['ranger']
    },
    
    // Infantry mid-cost
    pikeman: {
        id: 'pikeman',
        name: 'Pikeman',
        type: 'unit',
        unitType: 'infantry',
        cost: 2,
        power: 2,
        durability: 3,
        text: 'When this unit blocks an attack, deal 1 damage to the attacker before combat.',
        rarity: 'common',
        keywords: ['pike']
    },
    berserker: {
        id: 'berserker',
        name: 'Berserker',
        type: 'unit',
        unitType: 'infantry',
        cost: 3,
        power: 4,
        durability: 2,
        text: 'High attack, low durability. Gains +1 attack when damaged.',
        rarity: 'rare',
        keywords: ['berserk']
    },
    eliteGuard: {
        id: 'eliteGuard',
        name: 'Elite Guard',
        type: 'unit',
        unitType: 'infantry',
        cost: 5,
        power: 4,
        durability: 6,
        text: 'When this unit enters the battlefield, heal your hero for 3.',
        rarity: 'rare',
        keywords: ['guard'],
        healOnEnter: true,
        healAmount: 3
    },
    
    // Cavalry mid-cost
    lightCavalry: {
        id: 'lightCavalry',
        name: 'Light Cavalry',
        type: 'unit',
        unitType: 'cavalry',
        cost: 2,
        power: 2,
        durability: 2,
        text: 'Charge. When this unit attacks, draw a card if it survives.',
        rarity: 'common',
        keywords: ['charge', 'scout']
    },
    dragoon: {
        id: 'dragoon',
        name: 'Dragoon',
        type: 'unit',
        unitType: 'cavalry',
        cost: 4,
        power: 4,
        durability: 4,
        text: 'Charge. When this unit kills an enemy, draw a card.',
        rarity: 'rare',
        keywords: ['charge']
    },
    
    // Universal mid-cost abilities
    rally: {
        id: 'rally',
        name: 'Rally',
        type: 'ability',
        cost: 2,
        text: 'Give all friendly bannermen +1/+1 until end of turn.',
        rarity: 'common',
        effectType: 'rally'
    },
    fortify: {
        id: 'fortify',
        name: 'Fortify',
        type: 'ability',
        cost: 3,
        text: 'Give target friendly bannerman +0/+3 and Taunt (enemies must attack it).',
        rarity: 'rare',
        needsTarget: true,
        targetType: 'bannerman',
        effectType: 'fortify'
    },
    tacticalRetreat: {
        id: 'tacticalRetreat',
        name: 'Tactical Retreat',
        type: 'ability',
        cost: 4,
        text: 'Return target friendly unit to your hand. Draw 2 cards.',
        rarity: 'rare',
        needsTarget: true,
        targetType: 'bannerman',
        effectType: 'retreat',
        drawCards: 2
    },
};

// Make available globally
window.CARD_DATABASE = CARD_DATABASE;
window.HISTORIC_LEADERS = HISTORIC_LEADERS;

// Export for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CARD_DATABASE, HISTORIC_LEADERS };
}
