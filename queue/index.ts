export type Comparator<T> = (a: T, b: T) => number;

export class BinaryHeap<T> {
    public heap: T[] = []

    public get size(): number {
        return this.heap.length
    }

    public constructor(public readonly comparator: Comparator<T>) { }

    public peek(): T {
        return this.heap[0];
    }

    public pop(): T | undefined {
        const last = this.heap.pop()
        if (this.size > 0 && last !== undefined) {

        }
        return last
    }

    public push(node: T): number {
        this.heap.push(node);
        this.heapifyUp()
        return this.size
    }

    public clear(): void {
        this.heap.length = 0
    }

    private heapifyUp(index: number = this.size - 1) {
        while (this.hasParent(index) && this.comparator(this.heap[index], this.getParent(index)) < 0) {
            const parentIndex = this.getParentIndex(index);
            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    private heapifyDown(index: number = 0) {

    }

    private swap(i: number, j: number) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    private hasParent(index: number) {
        return this.getParentIndex(index) >= 0
    }

    private getParent(index: number) {
        return this.heap[this.getParentIndex(index)];
    }

    private getParentIndex(index: number) {
        return index - 1 >> 1;
    }
}

const binary = new BinaryHeap<number>((a, b) => a - b);

binary.push(40)
binary.push(30)
binary.push(60)
binary.push(10)
binary.push(100)
console.log(binary.heap)
