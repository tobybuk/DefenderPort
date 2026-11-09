import { parseLine } from './source-util.mjs';
const OPS = { '|': 1, '^': 2, '&': 3, '<<': 4, '>>': 4, '+': 5, '-': 5, '*': 6, '/': 6 };
export function evalAsm(expr, symbols, pc) {
    const tokens = expr.trim().match(/\$[0-9A-Fa-f]+|%[01]+|[A-Za-z_.$][\w.$]*|\d+|<<|>>|[()+\-*/&|^~]/g) || [];
    if (!tokens.length)
        throw new Error(`Empty expression: ${expr}`);
    let index = 0;
    function atom() {
        const token = tokens[index++];
        if (token === undefined)
            throw new Error(`Expected atom in ${expr}`);
        if (token === '(') {
            const v = parse(0);
            if (tokens[index++] !== ')')
                throw new Error(`Missing ) in ${expr}`);
            return v;
        }
        if (token === '-')
            return -atom();
        if (token === '+')
            return atom();
        if (token === '~')
            return ~atom();
        if (token === '*')
            return pc;
        if (/^\$/.test(token))
            return parseInt(token.slice(1), 16);
        if (/^%/.test(token))
            return parseInt(token.slice(1), 2);
        if (/^\d+$/.test(token))
            return Number(token);
        if (Object.hasOwn(symbols, token.toUpperCase()))
            return symbols[token.toUpperCase()];
        throw new Error(`Unresolved symbol ${token} in '${expr}'`);
    }
    function parse(min) {
        let lhs = atom();
        while (index < tokens.length) {
            const op = tokens[index], prec = OPS[op];
            if (prec === undefined || prec < min)
                break;
            index++;
            const rhs = parse(prec + 1);
            switch (op) {
                case '+':
                    lhs += rhs;
                    break;
                case '-':
                    lhs -= rhs;
                    break;
                case '*':
                    lhs *= rhs;
                    break;
                case '/':
                    lhs = Math.trunc(lhs / rhs);
                    break;
                case '<<':
                    lhs <<= rhs;
                    break;
                case '>>':
                    lhs >>= rhs;
                    break;
                case '&':
                    lhs &= rhs;
                    break;
                case '^':
                    lhs ^= rhs;
                    break;
                case '|':
                    lhs |= rhs;
                    break;
            }
        }
        return lhs;
    }
    const n = parse(0);
    if (index !== tokens.length)
        throw new Error(`Unexpected token '${tokens[index]}' in ${expr}`);
    if (!Number.isSafeInteger(n))
        throw new Error(`Unsafe value of ${expr}`);
    return n;
}
export function scanSymbols(lines, { strict = true } = {}) {
    const symbols = {}, issues = [];
    let pc = 0;
    let inMacro = false;
    const seen = new Set();
    for (let index = 0; index < lines.length; index++) {
        const part = parseLine(lines[index]);
        if (!part)
            continue;
        const { label, op, arg } = part;
        if (op === 'MACRO') {
            inMacro = true;
            continue;
        }
        if (op === 'ENDM') {
            inMacro = false;
            continue;
        }
        if (inMacro)
            continue;
        if (op === 'ORG' || op === 'RMB' || op === 'EQU' || op === 'SET' || op === 'SETDP') {
            if (op === 'SETDP')
                continue;
            try {
                if (op === 'RMB' && label) {
                    symbols[label] = pc;
                    seen.add(label);
                }
                const value = evalAsm(arg, symbols, pc);
                if (op === 'ORG')
                    pc = value;
                else if (op === 'RMB') {
                    if (label) {
                        symbols[label] = pc;
                        seen.add(label);
                    }
                    pc += value;
                }
                else if (label) {
                    symbols[label] = value;
                    seen.add(label);
                }
            }
            catch (e) {
                issues.push({ line: index + 1, label, op, arg, error: e.message });
                if (strict)
                    throw new Error(`Source line ${index + 1}: ${e.message}`);
            }
        }
        else if (label) {
            if (!seen.has(label)) {
                symbols[label] = pc;
                seen.add(label);
            }
        }
        if (op === 'FCB')
            pc += (arg.match(/(?:"[^"]*"|'[^']*'|[^,]+)/g) || []).length;
        if (op === 'FDB')
            pc += 2 * (arg.match(/,/g) || []).length + 2;
        if (op === 'FCC') {
            const m = arg.match(/^(["'])(.*?)\1/);
            if (m)
                pc += m[2].length;
        }
    }
    return { symbols, issues, finalPC: pc };
}
