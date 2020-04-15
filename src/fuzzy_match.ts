// -----------------------------------------------------------------------------
// Utilities for inexactly matching strings to patterns
// See:  https://en.wikipedia.org/wiki/Approximate_string_matching
// -----------------------------------------------------------------------------
import levenshtein from 'fast-levenshtein'

export interface Result {
    distance: number
    value: string
}

export function findBestMatches(results: Result[]): Result[] {
    results.sort((a, b) => a.distance - b.distance)
    return results.filter((r) => r.distance === results[0].distance)
}

export function rankChoices(searchString: string, targets: string[]) {
    return findBestMatches(
        targets
            .map((value) => ({
                value,
                distance: levenshtein.get(searchString, value),
            }))
            .filter((r) => r.distance < searchString.length / 2)
    )
}
