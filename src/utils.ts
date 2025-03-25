export function hasKey<O>(obj: O, key: keyof any): key is keyof O {
    // @ts-ignore - this was getting in my way when trying to build chesster locally
    return key in obj
}
export function isDefined<T>(obj: T | undefined): obj is T {
    return obj !== undefined
}

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type ValueOf<T> = T[keyof T]
