export interface ReactiveNode {
    deps?: Link;
    depsTail?: Link;
    subs?: Link;
    subsTail?: Link;
}

export interface Link {
    version: number;
    dep: ReactiveNode;
    sub: ReactiveNode;
    prevSub: Link | undefined;
    nextSub: Link | undefined;
    prevDep: Link | undefined;
    nextDep: Link | undefined;
}

export class Reactive {
    public link(dep: ReactiveNode, sub: ReactiveNode, version: number) {
        const prevDep = sub.depsTail;
        if (prevDep !== undefined && prevDep.dep === dep) {
            return;
        }
    }

    public unlink() { }
}