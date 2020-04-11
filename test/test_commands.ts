import { assert } from 'chai'
import {
    tokenize,
    InvalidConstantError,
    InvalidTokenDescriptionError,
    InvalidTypeError,
    InvalidTypeValueError,
    InvalidChoiceError,
    TooFewTokensError,
    TextVariable,
    IntVariable,
} from '../src/commands'

let t = (v: string) => new TextVariable(v)
let i = (v: number) => new IntVariable(v.toString())

describe('commands', function () {
    describe('#tokenize()', function () {
        it('tokenize a constant string as an object containing parameters for each constant, of the same name and with the constant as the value', function () {
            let parameters = tokenize('a test string of constants', [
                'a',
                'test',
                'string',
                'of',
                'constants',
            ])
            assert.deepEqual(parameters, {
                a: t('a'),
                test: t('test'),
                string: t('string'),
                of: t('of'),
                constants: t('constants'),
            })
        })
        it('tokenize a command with all tokenDescriptors', function () {
            let parameters = tokenize('constant 4 text option1', [
                'constant',
                '{int:intVar}',
                '{text:textVar}',
                '{option1|option2}',
            ])
            assert.deepEqual(parameters, {
                constant: t('constant'),
                intVar: i(4),
                textVar: t('text'),
                option1: t('option1'),
            })
        })
        it('throw an InvalidConstantError if the token does not exactly match the specified constant', function () {
            assert.throws(
                () => tokenize('this', ['that']),
                InvalidConstantError
            )
        })
        it('throw an InvalidTypeError if I create a variable with an unknown type', function () {
            assert.throws(
                () => tokenize('dummy', ['{unknown:variableName}']),
                InvalidTypeError
            )
        })
        it('throw TooFewTokensError if the number of tokens is less than the number of descriptions', function () {
            assert.throws(
                () =>
                    tokenize('only 3 tokens', [
                        '{text:expecting}',
                        '{int:someNumber}',
                        '{text:of}',
                        'tokens',
                    ]),
                TooFewTokensError
            )
        })
        it('throw InvalidTokenDescriptionError if the tokenDescriptor is not  one of the valid descriptions', function () {
            assert.throws(
                () => tokenize('dummy', ['inva!idT0kenD3scription']),
                InvalidTokenDescriptionError
            )
        })
        it('throw an InvalidChoiceError if the token is not token is not one of the valid choices', function () {
            assert.throws(
                () => tokenize('choice0', ['{choice1|choice2|choice3}']),
                InvalidChoiceError
            )
        })
        it('throw an InvalidTypeValueError if the value provided cannot be parsed into the specified type', function () {
            assert.throws(
                () => tokenize('value', ['{int:variable}']),
                InvalidTypeValueError
            )
        })
    })
})
