var assert = require('chai').assert;
var commands = require('../src/commands');

describe('commands', function(){
    describe('#tokenize()', function(){
        function assertIfCalled(message){
            return function(){ assert(false, message); };
        }
        it("should tokenize a constant string as an object containing parameters for each constant, of the same name and with the constant as the value", function(){
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
        it("should throw an InvalidConstantError if the token does not exactly match the specified constant", 
            function(){
                return commands.tokenize('this', ['that']).then(assertIfCalled('tokenize did not throw'))
                    .catch(function(error){
                        assert(
                            error instanceof commands.InvalidConstantError, 
                            'was expecting type InvalidConstantError, got ' + error.name
                        );
                    }
                );
            }
        );
        it("should throw an InvalidTypeError if I create a variable with an unknown type", 
            function(){
                return commands.tokenize('dummy', ['{unknown:variableName}'])
                    .then(assertIfCalled(false, 'tokenize did not throw'))
                    .catch(function(error){
                        assert(
                            error instanceof commands.InvalidTypeError,
                            'was expecting InvalidTypeError, got ' + error.name
                        );
                    }
                );
            }
        );
        it("should throw TooFewTokensError if the number of tokens is less than the number of descriptions", 
            function(){
                return commands.tokenize(
                    'only 3 tokens', 
                    ['{text:expecting}', '{int:someNumber}', '{text:of}', 'tokens']
                ).then(assertIfCalled('tokenize did not throw')).catch(function(error){
                    assert(
                        error instanceof commands.TooFewTokensError,
                        'was expecting TooFewTokensError, got ' + error.name
                    );
                });
            }
        );
        it("should throw InvalidTokenDescriptionError if the token is not  one of the valid descriptions", 
            function(){
                return commands.tokenize('dummy', ['inva!idT0kenD3scription'])
                    .then(assertIfCalled('tokenize did not throw'))
        });
    });
});
