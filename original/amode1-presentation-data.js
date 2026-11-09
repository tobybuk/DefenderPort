/** Red Label ROMC8.SRC DEFALT (lines 781-797): factory high-score table. */
export const DEFAULT_HALL_OF_FAME = Object.freeze([
    { score: 21270, initials: 'DRJ' }, { score: 18315, initials: 'SAM' },
    { score: 15920, initials: 'LED' }, { score: 14285, initials: 'PGD' },
    { score: 12520, initials: 'CRB' }, { score: 11035, initials: 'MRS' },
    { score: 8265, initials: 'SSR' }, { score: 6010, initials: 'TMH' }
]);
/** AMODE1.SRC CPRTAB lines 1105-1115: copyright original pixel columns. */
export const CPRTAB = Uint8Array.from(`
3E 41 41 22 00 3E 41 41 3E 00 7F 09 09 06 00 03
04 78 04 03 00 7F 09 19 66 00 41 7F 41 00 3E 41
49 3A 00 7F 08 08 7F 00 01 01 7F 01 01 00 1C 22
5D 63 55 22 1C 22 7F 4B 45 22 1C 00 00 00 42 7F
40 00 26 49 49 3E 00 36 49 49 36 00 3E 41 41 3E
`.trim().split(/\s+/).map(v => parseInt(v, 16)));
