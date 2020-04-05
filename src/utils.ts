export function hasKey<O>(obj: O, key: keyof any): key is keyof O {
    return key in obj
}
export function isDefined<T>(obj: T | undefined): obj is T {
    return obj !== undefined
}
