export function union<T>(...iterables: Array<Set<T>>): Set<T> {
    const set = new Set<T>()
    iterables.forEach(iterable => {
        iterable.forEach(item => set.add(item))
    })
    return set
}