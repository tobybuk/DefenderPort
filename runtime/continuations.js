/** Runtime adapter for the *translated* linked-list scheduler.
 * No emulated PC/opcodes/CPU. Translated functions are registered by their
 * original source LABEL, not by guessed timing. This is not the original EXEC
 * routine (which is NOT YET TRANSLATED).
 */
export class TranslationBoundaryError extends Error {
}
export class Continuations {
    constructor({ RAM, Layout, scheduler }) {
        this.RAM = RAM;
        this.Layout = Layout;
        this.scheduler = scheduler;
        this.entries = new Map();
    }
    register(label, fn) {
        if (!/^[A-Z][A-Z0-9]*$/.test(label) || typeof fn !== 'function')
            throw new Error('Expected source label and JavaScript function');
        if (this.entries.has(label))
            throw new Error(`Duplicate entry ${label}`);
        const address = this.Layout.at(label);
        if ([...this.entries.values()].some(e => e.address === address))
            throw new Error(`Address ${address} already registered`);
        this.entries.set(label, { address, fn });
    }
    resume(dispatchResult) {
        let next = dispatchResult;
        for (let steps = 0; steps < 1000; steps++) {
            if (next.kind === 'end-of-dispatch')
                return next;
            if (next.kind !== 'resume')
                throw new TranslationBoundaryError('Unexpected continuation');
            const registered = [...this.entries.values()].find(v => v.address === next.address);
            if (!registered)
                throw new TranslationBoundaryError(`Untranslated original routine at $${next.address.toString(16).padStart(4, '0')}; no placeholder gameplay allowed`);
            next = registered.fn({ process: next.process, scheduler: this.scheduler });
            if (!next || typeof next.kind !== 'string')
                throw new TranslationBoundaryError('Translated routine did not yield through original scheduler');
        }
        throw new TranslationBoundaryError('Excessive same-tick transitions; inspect original process control flow');
    }
}
