export type Comparator<T> = (a: T, b: T) => number;

export class BinaryHeap<T> {
    public readonly heap: T[] = []

    protected readonly indices: Map<T, number> = new Map()

    public get size(): number {
        return this.heap.length
    }

    public constructor(protected readonly comparator: Comparator<T>) { }

    public peek(): T | undefined {
        return this.heap[0];
    }

    public poll(): T | undefined {
        if (this.size === 0) return undefined;
        return this.deleteAt(0);
    }

    public push(...nodes: T[]): number {
        if (nodes.length === 0) return this.size;

        const lastIndex = this.size;
        this.heap.push(...nodes);

        if (nodes.length === 1) {
            this.indices.set(nodes[0], lastIndex);
            this.heapifyUp(lastIndex);
            return this.size;
        }

        for (let i = (this.size >> 1) - 1; i >= 0; i--) {
            this.heapifyDown(i);
        }

        for (let i = lastIndex; i < this.size; i++) {
            this.indices.set(this.heap[i], i);
        }

        return this.size;
    }

    public replace(node: T): T | undefined {
        if (this.size === 0) {
            this.heap.push(node);
            this.indices.set(node, 0);
            return undefined;
        }

        const top = this.heap[0];
        this.indices.delete(top);
        this.heap[0] = node;
        this.indices.set(node, 0);
        this.heapifyDown();

        return top;
    }

    public delete(node: T): boolean {
        const index = this.indices.get(node);
        if (index === undefined) return false;
        this.deleteAt(index);
        return true;
    }

    public has(node: T) {
        return this.indices.has(node);
    }

    public clear(): void {
        this.heap.length = 0;
        this.indices.clear();
    }

    public empty(): boolean {
        return this.size === 0
    }

    protected heapifyUp(index: number = this.size - 1): void {
        while (index > 0) {
            const parentIndex = (index - 1) >> 1;
            if (this.comparator(this.heap[index], this.heap[parentIndex]) >= 0) break;

            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    protected heapifyDown(index: number = 0): void {
        const halfIndex = this.size >> 1;

        while (index < halfIndex) {
            let leftIndex = (index << 1) + 1;
            let rightIndex = leftIndex + 1;
            let smallestIndex = leftIndex;

            if (rightIndex < this.size && this.comparator(this.heap[rightIndex], this.heap[leftIndex]) < 0) {
                smallestIndex = rightIndex;
            }

            if (this.comparator(this.heap[index], this.heap[smallestIndex]) <= 0) break;

            this.swap(index, smallestIndex);
            index = smallestIndex;
        }
    }

    protected deleteAt(index: number = 0): T {
        const lastIndex = this.size - 1;
        const removed = this.heap[index];
        this.indices.delete(removed);

        if (index === lastIndex) {
            this.heap.pop();
            return removed;
        }

        const last = this.heap.pop()!;
        this.heap[index] = last;
        this.indices.set(last, index);

        const parentIndex = (index - 1) >> 1;
        if (index > 0 && this.comparator(this.heap[index], this.heap[parentIndex]) < 0) {
            this.heapifyUp(index);
        } else {
            this.heapifyDown(index);
        }

        return removed;
    }

    private swap(i: number, j: number): void {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];

        this.indices.set(this.heap[i], i);
        this.indices.set(this.heap[j], j);
    }
}

export class FibonacciHeap<T> {

}

export class PairingHeapNode<T> {
    public constructor(
        public weight: number,
        public value: T,
        public child: PairingHeapNode<T> | null = null,
        public sibling: PairingHeapNode<T> | null = null
    ) { }
}

export class PairingHeap<T> {
    private root: PairingHeapNode<T> | null = null;
}