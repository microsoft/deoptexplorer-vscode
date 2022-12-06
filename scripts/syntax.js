// @ts-check
const yaml = require("js-yaml");
const plist = require("plist");
const fs = require("fs");
const path = require("path");

/**
 * @typedef TmGrammarName
 * @property {string} name
 */

/**
 * @typedef TmGrammarMatchRule
 * @property {string} [name]
 * @property {string} match
 * @property {Record<string, TmGrammarName>} [captures]
 */

/**
 * @typedef TmGrammarBeginEndRule
 * @property {string} [name]
 * @property {string} begin
 * @property {string} end
 * @property {Record<string, TmGrammarName>} [beginCaptures]
 * @property {Record<string, TmGrammarName>} [endCaptures]
 * @property {AnyTmGrammarRule[]} [patterns]
 * @property {Record<string, AnyTmGrammarRule>} [repository]
 */

/**
 * @typedef TmGrammarIncludeRule
 * @property {string} include
 */

/**
 * @typedef TmGrammarPatternsRule
 * @property {AnyTmGrammarRule[]} patterns
 */

/**
 * @typedef {TmGrammarMatchRule | TmGrammarBeginEndRule | TmGrammarIncludeRule | TmGrammarPatternsRule} AnyTmGrammarRule
 */

/**
 * @typedef TmGrammar
 * @property {string} name
 * @property {string} scopeName
 * @property {string[]} fileTypes
 * @property {string} uuid
 * @property {Record<string, string>} [variables]
 * @property {AnyTmGrammarRule[]} [patterns]
 * @property {Record<string, AnyTmGrammarRule>} [repository]
 */

/**
 * @typedef {[RegExp, string]} VariableReplacer
 */

/**
 * @param {AnyTmGrammarRule} rule
 * @param {(pattern: string) => string} replacer
 */
function updateGrammarRule(rule, replacer) {
    if ("match" in rule) {
        rule.match = replacer(rule.match);
    }
    else if ("begin" in rule) {
        rule.begin = replacer(rule.begin);
        rule.end = replacer(rule.end);
        updatePatterns(rule.patterns, replacer);
        updateRepository(rule.repository, replacer);
    }
    else if ("patterns" in rule) {
        updatePatterns(rule.patterns, replacer);
    }
}

/**
 * @param {AnyTmGrammarRule[]} patterns 
 * @param {(pattern: string) => string} replacer
 */
function updatePatterns(patterns, replacer) {
    if (patterns) {
        for (const pattern of patterns) {
            updateGrammarRule(pattern, replacer);
        }
    }
}

/**
 * @param {Record<string, AnyTmGrammarRule>} repository 
 * @param {(pattern: string) => string} replacer
 */
function updateRepository(repository, replacer) {
    for (const key in repository) {
        updateGrammarRule(repository[key], replacer);
    }
}

/**
 * @param {TmGrammar} grammar 
 * @param {(pattern: string) => string} replacer
 */
function updateGrammarVariables(grammar, replacer) {
    updatePatterns(grammar.patterns, replacer);
    updateRepository(grammar.repository, replacer);
}

/**
 * @param {string} pattern 
 * @param {VariableReplacer[]} replacers 
 */
function replacePatternVariables(pattern, replacers) {
    let result = pattern;
    for (const [variableName, value] of replacers) {
        result = result.replace(variableName, value);
    }
    return result;
}

/**
 * @param {TmGrammar} grammar 
 */
function replaceVariables(grammar) {
    const variables = grammar.variables;
    delete grammar.variables;
    /** @type {VariableReplacer[]} */
    const replacers = [];
    for (const variableName in variables) {
        const pattern = replacePatternVariables(variables[variableName], replacers);
        replacers.push([new RegExp(`{{${variableName}}}`, "gim"), pattern]);
    }
    return updateGrammarVariables(grammar, pattern => replacePatternVariables(pattern, replacers));
}

const grammar = /** @type {TmGrammar} */(yaml.load(fs.readFileSync(path.join(__dirname, "../src/syntax/v8-map.yaml"), "utf8")));
replaceVariables(grammar);
try { fs.mkdirSync(path.join(__dirname, "../dist"), { recursive: true }) } catch { }
fs.writeFileSync(path.join(__dirname, "../dist/v8-map.tmLanguage"), plist.build(grammar), { encoding: "utf8" });