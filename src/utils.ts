export function hasKey<O extends {}>(obj: O, key: keyof O): key is keyof O {
    return key in obj
}
export function isDefined<T>(obj: T | undefined): obj is T {
    return obj !== undefined
}

export function formatError(error: unknown): string {
    if (!(error instanceof Error)) {
        return String(error)
    }
    const err = error as NodeJS.ErrnoException & {
        parent?: NodeJS.ErrnoException
        original?: NodeJS.ErrnoException
    }
    const code = err.code ?? err.parent?.code ?? err.original?.code
    return code ? `${err.message} (code: ${code})` : err.message
}

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type ValueOf<T> = T[keyof T]
