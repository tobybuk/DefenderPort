/**
 * Red Label cabinet boundary, separate from the original 6809 routines.
 * The settings/audit NUMBERING is from Williams 16P-3000-103, Functions 1–21
 * (also reproduced in Aaron Liddiment's 1995 DefenderSetup posting).
 * These are CMOS operator settings, NOT physical DIP switch positions.
 * Source cabinet START/COIN/RCMOSA are not yet complete native translations:
 * the credit ledger below is an explicit browser adapter.
 */
export const CABINET_STORAGE_KEY = 'williams-defender-red-label-operator-v1';
export const CABINET_DEFAULTS = Object.freeze({
    8: 10000, 9: 3, 10: 3, 11: 1, 12: 4, 13: 1,
    14: 1, 15: 0, 16: 0, 17: 0, 18: 0, 19: 10, 20: 1, 21: 5
});
export const OPERATOR_LABELS = Object.freeze({
    8:'Bonus ship level', 9:'Ships per game', 10:'Coinage select',
    11:'Left coin multiplier', 12:'Centre coin multiplier',
    13:'Right coin multiplier', 14:'Coins per credit',
    15:'Coins for bonus', 16:'Minimum coins', 17:'Free play',
    18:'Starting difficulty', 19:'Progressive wave difficulty limit',
    20:'Background sound', 21:'Planet restore wave'
});
export const AUDIT_LABELS = Object.freeze({
    1:'Coins — left',2:'Coins — centre',3:'Coins — right',
    4:'Paid games',5:'Bonus ships won',6:'Play time (minutes)',7:'Ships played'
});
const LIMITS = Object.freeze({
    8:[0,990000,5000],9:[1,9,1],10:[0,8,1],11:[1,99,1],
    12:[1,99,1],13:[1,99,1],14:[1,99,1],15:[0,99,1],
    16:[0,99,1],17:[0,1,1],18:[0,2,1],19:[4,25,1],20:[0,1,1],21:[1,25,1]
});
function normaliseSettings(input){
    const result = {...CABINET_DEFAULTS};
    for (const k of Object.keys(CABINET_DEFAULTS)) {
        const v=Number(input?.[k]);
        const [low,high,step]=LIMITS[k];
        if (Number.isInteger(v)&&v>=low&&v<=high && v%step===0) result[k]=v;
    }
    return result;
}
export function createCabinetOperator(storage=null){
    let stored=null;
    try {stored=JSON.parse(storage?.getItem(CABINET_STORAGE_KEY)??'null');}catch{}
    let settings=normaliseSettings(stored?.settings);
    let credits=Number.isInteger(stored?.credits) ? Math.max(0,Math.min(99,stored.credits)):0;
    let coinUnits=Number.isInteger(stored?.coinUnits)?Math.max(0,stored.coinUnits):0;
    let rawCoins=Number.isInteger(stored?.rawCoins)?Math.max(0,stored.rawCoins):0;
    let audit=Object.fromEntries(Object.keys(AUDIT_LABELS).map(k=>[k, Number.isInteger(stored?.audit?.[k])?Math.max(0,stored.audit[k]):0]));
    const save=()=>{try{storage?.setItem(CABINET_STORAGE_KEY,JSON.stringify({settings,credits,coinUnits,rawCoins,audit}));return !!storage;}catch{return false;}};
    const addCredit=(n)=>{credits=Math.min(99,credits+n);save();return credits;};
    return Object.freeze({
        get settings(){return {...settings};},
        get credits(){return credits;},
        get audit(){return {...audit};},
        /** Hardware coin switch emulation. Defaults: left chute 1 coin = 1 credit. */
        COIN(slot='left'){
            const chutes={left:[1,11],centre:[2,12],right:[3,13]};
            if (!Object.hasOwn(chutes,slot))throw new RangeError('Unknown coin chute');
            const [counter,mult]=chutes[slot];
            audit[counter]++; rawCoins++;
            // Factory coinage select 3 is the USA 1 credit / left coin case.
            // A full ROM pricing-table decoder (all coinage 0–8) is pending;
            // expose 10–16 but never claim equivalence for non-factory values.
            coinUnits+=settings[mult];
            const needed=Math.max(1,settings[14]);
            if (rawCoins>=settings[16] && coinUnits>=needed){
                const created=Math.floor(coinUnits/needed);
                coinUnits%=needed;
                credits=Math.min(99,credits+created);
            }
            save();return credits;
        },
        CAN_START(players=1){
            return (players===1 || players===2) && (settings[17]===1 || credits>=players);
        },
        START(players=1){
            if (players!==1 && players!==2)throw new RangeError('Players must be 1 or 2');
            if (!(settings[17]===1 || credits>=players))return false;
            if (!settings[17])credits-=players;
            audit[4]+=players;
            audit[7]+=players*settings[9];
            save();return true;
        },
        ADJUST(number,value){
            const n=Number(number),v=Number(value);
            if (!Object.hasOwn(OPERATOR_LABELS,n))throw new RangeError('Unsupported original function '+number);
            const [min,max,step]=LIMITS[n];
            if (!Number.isInteger(v)||v<min||v>max||v%step!==0)throw new RangeError('Invalid operator setting');
            settings={...settings,[n]:v};save();return v;
        },
        FACTORY(){settings={...CABINET_DEFAULTS};save();},
        RESET_AUDITS(){audit=Object.fromEntries(Object.keys(AUDIT_LABELS).map(k=>[k,0]));save();},
        RESET_CREDITS(){credits=0;coinUnits=0;rawCoins=0;save();},
        ADD_BONUS_SHIP(){audit[5]++;save();},
        TICK_PLAY(){/* play-time audit requires accurate cabinet clock */},
        ADD_CREDIT:addCredit
    });
}
