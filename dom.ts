
export const $ = <T extends HTMLElement>(sel: string, ctx: Document | HTMLElement = document): T | null => ctx.querySelector(sel);
export const $$ = <T extends HTMLElement>(sel: string, ctx: Document | HTMLElement = document): T[] => [...ctx.querySelectorAll(sel)] as T[];
export const on = (el: EventTarget, ev: string, fn: (e: any) => void, opt?: AddEventListenerOptions) => el.addEventListener(ev, fn, opt);
export const cls = (el: HTMLElement, toggles: Record<string, boolean>) => {
    Object.entries(toggles).forEach(([c, v]) => el.classList.toggle(c, v));
};
export const throttle = (fn: (...args: any[]) => void, ms: number) => {
    let last = 0;
    return (...a: any[]) => {
        const now = performance.now();
        if (now - last > ms) {
            last = now;
            fn(...a);
        }
    };
};
