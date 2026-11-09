/**
 * Source symbol lengths and sequence transcribed from pinned src/phr6.src,
 * lines 212-531. No guessed RAM addresses or synthetic runtime layout.
 * Source: https://github.com/mwenge/defender/blob/e74006344b16d19245510b5e55780f90d7606bb8/src/phr6.src
 * Verify against npm run source:symbols when upstream is checked out.
 */
import { Layout } from './ram.js';
const blocks = [
    // $A000 direct-page and global RAM
    `BGSAV:32 BGL:2 BGLX:2 GTIME PDFLG PCRAM:16 MAPCR CREDIT CUNITS BUNITS
 TEMP1A TEMP1B TEMP1C TEMP2A:2 TEMP2B:2 TEMP2C:2 TEMP2D:2 TEMP2E:2
 ASBUFF ASLAST ASCNTR CURSR2:2 CHARSP LINESP TOPL:2 CURSER:2 MESPT:2 WORDPT:2 MESEND:2 SPACEF
 NUMBER:2 ROMPTR:2 TIMER OVCNT ACTIVE:2 FREE:2 CRPROC:2 OPTR:2 OFREE:2 SPFREE:2 IPTR:2 SPTR:2
 ITEMP:2 ITEMP2:2 XTEMP:2 XTEMP2:2 TEMP48:2 PIA01 PIA02 PIA21 PIA22 PIA31 SLMCNT LCCNT RCCNT CCCNT
 SWPROC:8 SCRFLG CURPLR PLRCNT PLRX:2 IRQHK:3 IFLG PCX:2 BGDELT:2 SETEND:2 BMBCNT SBFLG TPTR:2
 SHTEMP:2 THX:2 XXX1 XXX2 XXX3 FISX:2 BAX:2 FBX:2 TFLG REPLA:2 THFLG STRCNT REVFLG
 SNDX:2 SNDPRI SNDTMR SNDREP LFLG LCOLRX PWRFLG WCURS:2 STATUS
 NPLAD:2 PLADIR:2 PLAXC PLAYC NPLAXC NPLAYC PLAX16:2 PLAY16:2 PLAXV:3 PLAYV:2 PLABX:2
 XCNT YCNT OX1 OY1 PX1 PY1 OBHT PLHT ULX ULY LRX LRY CTEMP:2 CTEMP2:2 PCFLG
 SEED HSEED LSEED LSEXPL:2 XOFF YOFF FLAVOR SIZE DSIZE XSTART:2 YSTART:2 ODDEVN:2
 VSTART:2 WIDTHC LENGTC DATPTR:2 YSKIP BLKADD:2 CENTMP:2 ASTCNT
 LNDRES TIERES PRBRES SCZRES SWMRES WAVTIM WAVSIZ LNDXV LNDYV:2 LDSTIM TIEXV SZRY
 SZYV:2 SZXV SZSTIM SWXV SWSTIM SWAC UFOTIM UFSTIM UFOSK
 LNDCNT TIECNT PRBCNT SCZCNT SWCNT WAVTMR UFOTMR UFOCNT
 TLIST:40 FISTAB:32 THTAB:64 FBTAB:32
 P1SCR:4 P1RP:3 P1LAS P1WAV P1SBC P1TRG P1ENM:50
 P2SCR:4 P2RP:3 P2LAS P2WAV P2SBC P2TRG P2ENM:50
 OLIST:2185 PTAB:1125 SPTAB:115 SMAP:64 MONOTB:128 SETAB:200 STETAB:128`,
];
const alias = {
    RAM: 0xa000, YMAX: 240, YMIN: 42, HSTK: 0xbfff, MAPC: 0xd000,
    PSIZE: 15, SPSIZE: 23, OSIZE: 23, CTYPE: 2, STYPE: 0, ATYPE: 1,
    PLINK: 0, PADDR: 2, PTIME: 4, PTYPE: 5, PCOD: 6, PD: 7, PD1: 8, PD2: 9, PD3: 10, PD4: 11, PD5: 12, PD6: 13, PD7: 14,
    OBJW: 0, OBJH: 1, OBJP0: 2, OBJP1: 4, OBJWRT: 6, OBJDEL: 8, OBJL: 10,
    OLINK: 0, OPICT: 2, OBJX: 4, OBJY: 5, OBJID: 6, OCVECT: 8, OX16: 10, OY16: 12,
    OXV: 14, OYV: 16, OBJCOL: 18, OTYP: 20, ODATA: 21,
};
function expand(raw, start) {
    let pc = start;
    for (const token of raw.trim().split(/\s+/)) {
        const [name, length] = token.includes(':') ? token.split(':') : [token, '1'];
        if (Object.hasOwn(alias, name))
            throw new Error('duplicate symbol ' + name);
        alias[name] = pc;
        pc += Number(length);
    }
    return pc;
}
expand(blocks[0], 0xa000);
// Source EQU aliases whose values are the program counter at these boundaries.
alias.TABEND = alias.PTAB + 75 * 15;
alias.SPTEND = alias.SPTAB + 5 * 23;
alias.OLEND = alias.OLIST + 95 * 23;
alias.PLDATA = alias.P1SCR;
alias.P1END = alias.P2SCR;
alias.PLDEND = alias.OLIST;
alias.PLDLEN = alias.P2SCR - alias.P1SCR;
alias.ELIST = alias.LNDRES;
alias.ELIST1 = alias.WAVTIM;
alias.ELEND = alias.LNDCNT;
alias.ECNTS = alias.LNDCNT;
alias.ECEND = alias.TLIST;
alias.TLEND = alias.TLIST + 40;
alias.FISEND = alias.FISTAB + 32;
alias.HSRFLG = alias.THTAB;
alias.THTEND = alias.THTAB + 64;
alias.FBTEND = alias.FBTAB + 32;
alias.SSX = alias.SMAP;
alias.SSY = alias.SMAP + 1;
alias.SSCOL = alias.SMAP + 2;
alias.SX = 0;
alias.SY = 1;
alias.SCOL = 2;
alias.SNUM = 16;
alias.SLGTH = 4;
alias.SMEND = alias.SMAP + 64;
alias.PENEMY = alias.P1ENM - alias.P1SCR;
alias.PWAV = alias.P1WAV - alias.P1SCR;
alias.PLAS = alias.P1LAS - alias.P1SCR;
alias.PSBC = alias.P1SBC - alias.P1SCR;
alias.PTARG = alias.P1TRG - alias.P1SCR;
export const PHR6_SYMBOLS = Object.freeze(alias);
export const PHR6_LAYOUT = new Layout(PHR6_SYMBOLS);
