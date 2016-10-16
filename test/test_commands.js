var assert = require('chai').assert;
var commands = require('../src/commands');

describe('commands', function(){
    describe('#tokenize()', function(){
        function assertIfCalled(message){
            return function(){ assert(false, message); };
        }
        it("tokenize a constant string as an object containing parameters for each constant, of the same name and with the constant as the value", function(){
           return commands.tokenize('this is a test string of constants', [
               'this', 'is', 'a', 'test', 'string', 'of', 'constants'
           ]).then(function(parameters){
               assert.deepEqual(parameters, {
                   'this':'this',
                   'is':'is',
                   'a':'a',
                   'test':'test',
                   'string':'string',
                   'of':'of',
                   'constants':'constants'
               });
           });
        });
        it("tokenize a command with all tokenDescriptors", function(){
            return commands.tokenize('constant 4 text option1', [
                'constant', 
                '{int:intVar}',
                '{text:textVar}',
                '{option1|option2}'
            ]).then(function(parameters){
                assert.deepEqual(parameters, {
                    'constant': 'constant',
                    'intVar': 4,
                    'textVar': 'text',
                    'option1': 'option1',
                });
            });
        });
        it("throw an InvalidConstantError if the token does not exactly match the specified constant", 
            function(){
                return commands.tokenize('this', ['that']).then(assertIfCalled('tokenize did not throw when a constant did not match the expected value'))
                    .catch(function(error){
                        assert(
                            error instanceof commands.InvalidConstantError, 
                            'was expecting type InvalidConstantError, got ' + error.name
                        );
                    }
                );
            }
        );
        it("throw an InvalidTypeError if I create a variable with an unknown type", 
            function(){
                return commands.tokenize('dummy', ['{unknown:variableName}'])
                    .then(assertIfCalled('tokenize did not throw when a variable is created with an unknown type'))
                    .catch(function(error){
                        assert(
                            error instanceof commands.InvalidTypeError,
                            'was expecting InvalidTypeError, got ' + error.name
                        );
                    }
                );
            }
        );
        it("throw TooFewTokensError if the number of tokens is less than the number of descriptions", 
            function(){
                return commands.tokenize(
                    'only 3 tokens', 
                    ['{text:expecting}', '{int:someNumber}', '{text:of}', 'tokens']
                ).then(assertIfCalled('tokenize did not throw when too few tokens present')).catch(function(error){
                    assert(
                        error instanceof commands.TooFewTokensError,
                        'was expecting TooFewTokensError, got ' + error.name
                    );
                });
            }
        );
        it("throw InvalidTokenDescriptionError if the tokenDescriptor is not  one of the valid descriptions", 
            function(){
                return commands.tokenize('dummy', ['inva!idT0kenD3scription'])
                    .then(assertIfCalled('tokenize did not throw when encountering an invalid type descriptor')).catch(function(error){
                    assert(
                        error instanceof commands.InvalidTokenDescriptionError,
                        'was expecting InvalidTokenDescritionError, got ' + error.name
                    );
                });
            }
        );
        it("throw an InvalidChoiceError if the token is not token is not one of the valid choices", 
            function(){
                return commands.tokenize('choice0', ['{choice1|choice2|choice3}'])
                    .then(assertIfCalled('tokenize did not throw when the token is an invalid choice')).catch(function(error){
                    assert(
                        error instanceof commands.InvalidChoiceError,
                        'was expecting InvalidChoiceError, got ' + error.name
                    );
                });
            }
        );
        it("throw an InvalidTypeValueError if the value provided cannot be parsed into the specified type", 
            function(){
                return commands.tokenize('value', ['{int:variable}'])
                    .then(assertIfCalled('tokenize did not throw when encountering an unparseable variable')).catch(function(error){
                    assert(
                        error instanceof commands.InvalidTypeValueError,
                        'was expecting InvalidTypeValueError, got ' + error.name
                    );
                });
            }
        );
    });
});
