//------------------------------------------------------------------------------
// Utilities for command parsing
// See chesster.js for command definitions.
//------------------------------------------------------------------------------
import _ from 'lodash'

const VARIABLE = /^\{(int)(text)|:[a-zA-Z]+\}$/
const CHOICE_VARIABLE = /^\{([a-zA-Z0-9]+\|?)+\}$/
const CONSTANT_VALUE = /^[a-zA-Z]+$/

export class TextVariable {
    typeName = 'text'
    value: string
    constructor(token: string) {
        this.value = token
    }
}

export class IntVariable {
    typeName = 'int'
    value: number
    constructor(token: string) {
        this.value = parseInt(token, 10)
        if (isNaN(this.value)) throw new InvalidTypeValueError(token, 'int')
    }
}

type Variable = TextVariable | IntVariable
interface VariableConstructor {
    new (token: string): Variable
}
const VARIABLE_TYPES: Record<string, VariableConstructor> = {
    text: TextVariable,
    int: IntVariable,
}
export function isText(v: Variable): v is TextVariable {
    return v.typeName === 'text'
}
export function isNumber(v: Variable): v is IntVariable {
    return v.typeName === 'int'
}

type Parameters = Record<string, Variable>
/*
 * This command tokenizer takes the following token descriptions
 * constant: constantValue - constant values will be verified to be the exact
 *           value specified. If it does not match, this function will throw
 *           InvalidConstantError
 * variable: {type: variableName} - variable values will be verified to be the
 *           type specified. If the type does not match, this function will throw
 *           InvalidTypeValueError
 * choice:   {option1|option2|option3} - choices must be one of the prespecified
 *           values. The option will be stored in the key and value of the
 *           returned token object. If it does not match one of the specified
 *           options, this function will throw InvalidChoiceError
 *
 * types:    int, text - type must match one of these. If it does not match,
 *           this function will throw InvalidTypeError
 * Commands that are too short will throw TooFewTokensError
 */
export function tokenize(command: string, descriptions: string[]): Parameters {
    var tokens = getTokens(_.toLower(command), descriptions.length)

    var parameters: Parameters = {}
    _.zipWith(tokens, descriptions, (token, description) => {
        if (_.isNil(token)) {
            throw new TooFewTokensError(tokens, descriptions)
        } else if (description.match(VARIABLE)) {
            parameterizeVariableToken(token, description, parameters)
        } else if (description.match(CHOICE_VARIABLE)) {
            parameterizeChoiceToken(token, description, parameters)
        } else if (description.match(CONSTANT_VALUE)) {
            parameterizeConstantToken(token, description, parameters)
        } else {
            throw new InvalidTokenDescriptionError(description)
        }
    })
    return parameters
}

/*
 * separates the text into numTokens-1, where the remaining words make up the final token
 * if the number of tokens is greater than the number of " " separated words, the array of
 * " " separated words is returned without concatenation
 */
function getTokens(text: string, numTokens: number) {
    var words = _(text).split(' ').compact().value()
    if (words.length <= numTokens) return words

    var tokens = _.slice(words, 0, numTokens - 1)
    var lastToken = _.slice(words, numTokens - 1).join(' ')
    tokens.push(lastToken)

    return tokens
}

/*
 * get the type of the variable from the description
 * call the specific token verification routine for the type specified
 * get the key from the description for parameterization
 * add the variable to the parameter object using the key from the description
 * if the name or type cannot be determined from the dscription, throw InvalidTokenDescription
 * if the type specified is not known, throw InvalidVariableTypeError
 */
function parameterizeVariableToken(
    token: string,
    dscription: string,
    parameters: Parameters
) {
    //create an object splitting the description string into type and name
    var description = _.zipObject(
        ['type', 'name'],
        _(dscription)
            .split(/[\{\:\}]/)
            .compact()
            .value()
    )

    //if either are not specified, the description string is bad.
    if (_.isNil(description.type) || _.isNil(description.name))
        throw new InvalidTokenDescriptionError(dscription)

    //for each type defined, test it to see if it matches
    //   given a match, parse the token and store

    var ctor = VARIABLE_TYPES[description.type]
    if (ctor) {
        parameters[description.name] = new ctor(token)
    } else {
        throw new InvalidTypeError(description.type, dscription)
    }
}

/*
 * compare the token to the possible choices and add to parameters if it matches
 * if it doesnt match and of the choices, throw InvalidChoiceError
 */
function parameterizeChoiceToken(
    token: string,
    description: string,
    parameters: Parameters
) {
    //get the choices from the description
    var choices = _(description)
        .split(/[\{\|\}]/)
        .compact()
        .value()

    //verify the token exists as one of the valid choices
    if (!_.includes(choices, token))
        throw new InvalidChoiceError(token, description)
    parameters[token] = new TextVariable(token) // name and token are the same here
}

/*
 * verify the token matches the description exactly and add to parameters
 * if it doesnt match, throw InvalidConstantError
 */
function parameterizeConstantToken(
    token: string,
    description: string,
    parameters: Parameters
) {
    if (_.isEqual(token, description)) {
        parameters[description] = new TextVariable(token)
    } else {
        throw new InvalidConstantError(token, description)
    }
}

/*
 * commands error types
 */
class CommandError extends Error {
    type: string = ''
    name: string = ''
    stack: string | undefined
    constructor() {
        super()
        this.stack = new Error().stack
    }
}
export class InvalidTypeValueError extends CommandError {
    name = 'InvalidTypeValueError'
    stack: string = ''
    constructor(public token: string, public type: string) {
        super()
    }
}

export class TooFewTokensError extends CommandError {
    name = 'TooFewTokensError'
    constructor(public tokens: string[], public descriptions: string[]) {
        super()
    }
}

export class InvalidTokenDescriptionError extends CommandError {
    name = 'InvalidTokenDescriptionError'
    constructor(public description: string) {
        super()
    }
}

export class InvalidTypeError extends CommandError {
    name = 'InvalidTypeError'
    constructor(public type: string, public description: string) {
        super()
    }
}

export class InvalidChoiceError extends CommandError {
    name = 'InvalidChoiceError'
    constructor(public token: string, public description: string) {
        super()
    }
}

export class InvalidConstantError extends CommandError {
    name = 'InvalidConstantError'
    constructor(public token: string, public description: string) {
        super()
    }
}
