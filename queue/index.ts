import { type Comparator, BinaryHeap } from "../heap"

export class PriorityQueue<T> extends BinaryHeap<T> {
    public constructor(comparator: Comparator<T>) {
        super(comparator)
    }

    public update(node: T): boolean {
        const index = this.indices.get(node);
        if (index === undefined) return false;

        if (index === 0) {
            this.heapifyDown(index);
            return true;
        }

        const parentIndex = (index - 1) >> 1;
        if (index > 0 && this.comparator(node, this.heap[parentIndex]) < 0) {
            this.heapifyUp(index);
        } else {
            this.heapifyDown(index);
        }

        return true;
    }
}