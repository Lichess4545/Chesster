var Q = require("q");
var _ = require("lodash");

const VARIABLE = /^\{(int)(text)|:[a-zA-Z]+\}$/;
const CHOICE_VARIABLE = /^\{([a-zA-Z]+\|?)+\}$/;
const CONSTANT_VALUE = /^[a-zA-Z]+$/;

const VARIABLE_TYPES = {
    "TEXT": {
        match_expression: /text/,
        parse: function(token){
            return token; //all tokens are valid
        }
    },
    "INT": { 
        match_expression: /int/, 
        parse: function(token){
            var value = parseInt(token, 10);
            if(isNaN(value)) throw new InvalidTypeValueError(token, "int");
            return value;
        }
    }
    /*...*/
};

function InvalidTypeValueError(token, type){
    this.token = token;
    this.type = type;
    this.name = 'InvalidTypeValueError';
    this.stack = (new Error()).stack;
}

/* 
 * This command tokenizer takes the following token descriptions
 * constant: constantValue - constant values will be varified to be the exact 
 *           value specified. If it does not match, this function will throw 
 *           InvalidConstantError
 * variable: {type: variableName} - variable values will be varified to be the 
 *           type specified. If the type does not match, this function will throw
 *           InvalidTypeValueError
 * choice:   {option1|option2|option3} - choices must be one of the prespecified  
 *           values. The option will be stored in the key and value of the 
 *           returned token object. If it does not match one of the specified 
 *           options, this function will throw InvalidChoiceError
 * 
 * types:    int, text - type must match one of these. If it does not match, thi
 *           this function will throw InvalidTypeError
 * Commands that are too short will throw TooFewTokensError
 */
function tokenize(command, descriptions){
    return Q.fcall(function(){
        var tokens = getTokens(_.toLower(command), descriptions.length);    

        var parameters = {};
        _.zipWith(tokens, descriptions, function(token, description){
            if(_.isNil(token)){
                throw new TooFewTokensError(tokens, descriptions);
            }else if(description.match(VARIABLE)){
                parameterizeVariableToken(token, description, parameters);
            }else if(description.match(CHOICE_VARIABLE)){
                parameterizeChoiceToken(token, description, parameters);
            }else if(description.match(CONSTANT_VALUE)){
                parameterizeConstantToken(token, description, parameters); 
            }else{
                throw new InvalidTokenDescriptionError(description);
            }
        });
        return parameters;
    });
}

function TooFewTokensError(tokens, descriptions){
    this.tokens = tokens;
    this.descriptions = descriptions;
    this.name = 'TooFewTokensError';
    this.stack = (new Error()).stack;
}

function InvalidTokenDescriptionError(description){
    this.description = description;
    this.name = 'InvalidTokenDescriptionError';
    this.stack = (new Error()).stack;
}

/*
 * separates the text into numTokens-1, where the remaining words make up the final token
 * if the number of tokens is greater than the number of " " separted words, the array of 
 * " " separated words is returned without concatenation
 */
function getTokens(text, numTokens){
    var words = _(text).split(' ').filter().value();
    if(words.length <= numTokens) return words;

    var tokens = _.slice(words, 0, numTokens-1);
    var lastToken = _.slice(words, numTokens-1).join(" ");
    tokens.push(lastToken);

    return tokens;
}

/*
 * get the type of the variable from the description
 * call the specific token verification routine for the type specified
 * get the key from the description for parameterization
 * add the variable to the parameter object using the key from the description
 * if the name or type cannot be determined from the descriptionString, throw InvalidTokenDescription
 * if the type specified is not known, throw InvalidVariableTypeError
 */
function parameterizeVariableToken(token, descriptionString, parameters){
    //create an object splitting the description string into type and name
    var description = 
        _.zipObject(['type', 'name'], _(descriptionString).split(/[\{\:\}]/).filter().value());
    //if either are not specified, the description string is bad.
    if(_.isNil(description.type) || _.isNil(description.name)) 
        throw new InvalidTokenDescriptionError(descriptionString);
    //for each type defined, test it to see if it matches
    //   given a match, parse the token and store
    _.forIn(VARIABLE_TYPES, function (type){
       if(description.type.match(type.match_expression)){
           parameters[description.name] = type.parse(token);
           return false;
       }
    });

    //if value could not be parameterized because the type was not matched, throw InvalidTypeError
    if(!parameters[description.name])
        throw new InvalidTypeError(description.type, descriptionString);
}

function InvalidTypeError(type, description){
    this.type = type;
    this.description = description;
    this.name = 'InvalidTypeError';
    this.stack = (new Error()).stack;
}

/*
 * compare the token to the possible choices and add to parameters if it matches
 * if it doesnt match and of the choices, throw InvalidChoiceError
 */
function parameterizeChoiceToken(token, description, parameters){
    //get the choices from the description
    var choices = _(description).split(/[\{\|\}]/).filter().value();
    //verify the token exists as one of the valid choices
    if(!_.includes(choices, token)) throw new InvalidChoiceError(token);
    parameters[token] = token; // name and token are the same here
}

function InvalidChoiceError(token, description){
    this.token = token;
    this.description = description;
    this.name = 'InvalidChoiceError';
    this.stack = (new Error()).stack;
}

/*
 * verify the token matches the description exactly and add to parameters
 * if it doesnt match, throw InvalidConstantError
 */
function parameterizeConstantToken(token, description, parameters){
    if(_.isEqual(token, description)){
        parameters[description] = token;
    }else{
         throw new InvalidConstantError(token, description);
    }
}

function InvalidConstantError(token, description){
    this.token = token;
    this.description = description;
    this.name = 'InvalidConstantError';
    this.stack = (new Error()).stack;
}

module.exports.tokenize = tokenize;

/* error types */
module.exports.InvalidTypeValueError = InvalidTypeValueError;
module.exports.TooFewTokensError = TooFewTokensError;
module.exports.InvalidTokenDescriptionError = InvalidTokenDescriptionError;
module.exports.InvalidTypeError = InvalidTypeError;
module.exports.InvalidChoiceError = InvalidChoiceError;
module.exports.InvalidConstantError = InvalidConstantError;
