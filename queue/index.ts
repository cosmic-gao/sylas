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

    public poll(): T | undefined {
        if (this.size === 0) return undefined;

        const top = this.heap[0]
        const last = this.heap.pop()!

        if (this.size > 0) {
            this.heap[0] = last
            this.heapifyDown()
        }
        return top
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
        while (index > 0) {
            const parentIndex = this.getParentIndex(index);
            if (this.comparator(this.heap[index], this.heap[parentIndex]) >= 0) break;

            this.swap(index, parentIndex);
            index = parentIndex;
        }
    }

    private heapifyDown(index: number = 0) {
        while (this.hasLeftChild(index)) {
            let smallest = this.getLeftChildIndex(index);

            if (
                this.hasRightChild(index) &&
                this.comparator(
                    this.heap[this.getRightChildIndex(index)],
                    this.heap[smallest]
                ) < 0
            ) {
                smallest = this.getRightChildIndex(index);
            }

            if (this.comparator(this.heap[index], this.heap[smallest]) <= 0)
                break;

            this.swap(index, smallest);
            index = smallest;
        }
    }

    private swap(i: number, j: number) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    private getParentIndex(index: number) {
        return (index - 1) >> 1;
    }

    private hasLeftChild(index: number) {
        return this.getLeftChildIndex(index) < this.size;
    }

    private getLeftChildIndex(index: number) {
        return (index << 1) + 1;
    }

    private hasRightChild(index: number) {
        return this.getRightChildIndex(index) < this.size;
    }

    private getRightChild(index: number) {
        return this.heap[this.getRightChildIndex(index)];
    }

    private getRightChildIndex(index: number) {
        return (index << 1) + 2;
    }
}

const binary = new BinaryHeap<number>((a, b) => a - b);

binary.push(40)
binary.push(30)
binary.push(60)
binary.push(10)
binary.push(100)
binary.push(30)
binary.push(20)
console.log(binary.heap)
